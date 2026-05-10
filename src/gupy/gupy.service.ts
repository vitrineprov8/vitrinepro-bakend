import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import slugify from 'slugify';
import { GupyConfig } from './gupy-config.entity';
import { CreateGupyConfigDto } from './dto/create-gupy-config.dto';
import { UpdateGupyConfigDto } from './dto/update-gupy-config.dto';
import {
  Vaga,
  VagaSource,
  VagaStatus,
  VagaWorkMode,
} from '../vagas/vaga.entity';

export interface RemoteJobSummary {
  id: number;
  title: string;
  type: string | null;
  department: string | null;
  city: string | null;
  state: string | null;
  workplaceType: string | null;
  alreadyImported: boolean;
  importedVagaId?: string;
  importedStatus?: VagaStatus;
}

export interface RemoteJobsResponse {
  config: GupyConfig;
  jobs: RemoteJobSummary[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  errors: { jobId: number; reason: string }[];
}

export interface SyncResult {
  total: number;
  closed: number;
  updated: number;
  errors: { vagaId: string; reason: string }[];
  syncedAt: string;
}

@Injectable()
export class GupyService {
  constructor(
    @InjectRepository(GupyConfig)
    private gupyConfigRepository: Repository<GupyConfig>,
    @InjectRepository(Vaga)
    private vagasRepository: Repository<Vaga>,
  ) {}

  list(): Promise<GupyConfig[]> {
    return this.gupyConfigRepository.find({
      order: { displayName: 'ASC' },
    });
  }

  async findById(id: string): Promise<GupyConfig> {
    const config = await this.gupyConfigRepository.findOne({ where: { id } });
    if (!config) throw new NotFoundException('Configuração Gupy não encontrada.');
    return config;
  }

  async create(dto: CreateGupyConfigDto): Promise<GupyConfig> {
    const subdomain = dto.subdomain.toLowerCase().trim();
    const existing = await this.gupyConfigRepository.findOne({
      where: { subdomain },
    });
    if (existing) {
      throw new ConflictException('Já existe uma configuração com este subdomain.');
    }
    const config = this.gupyConfigRepository.create({
      displayName: dto.displayName.trim(),
      subdomain,
      enabled: dto.enabled ?? true,
    });
    return this.gupyConfigRepository.save(config);
  }

  async update(id: string, dto: UpdateGupyConfigDto): Promise<GupyConfig> {
    const config = await this.findById(id);
    if (dto.subdomain && dto.subdomain.toLowerCase().trim() !== config.subdomain) {
      const newSub = dto.subdomain.toLowerCase().trim();
      const existing = await this.gupyConfigRepository.findOne({
        where: { subdomain: newSub },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('Já existe uma configuração com este subdomain.');
      }
      config.subdomain = newSub;
    }
    if (dto.displayName !== undefined) config.displayName = dto.displayName.trim();
    if (dto.enabled !== undefined) config.enabled = dto.enabled;
    return this.gupyConfigRepository.save(config);
  }

  async remove(id: string): Promise<void> {
    const config = await this.findById(id);
    await this.gupyConfigRepository.remove(config);
  }

  buildJobUrl(subdomain: string, externalJobId: string): string {
    return `https://${subdomain}.gupy.io/jobs/${externalJobId}?jobBoardSource=gupy_public_page`;
  }

  // ---------- Remote scraping ----------

  private async fetchHtml(url: string): Promise<string> {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; VitrinePro/1.0; +https://v8pro.com.br)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
    } catch (err) {
      throw new ServiceUnavailableException(
        `Falha ao acessar Gupy: ${(err as Error).message}`,
      );
    }
    if (res.status === 404) {
      throw new NotFoundException('Página não encontrada na Gupy.');
    }
    if (!res.ok) {
      throw new ServiceUnavailableException(
        `Gupy respondeu com status ${res.status}.`,
      );
    }
    return res.text();
  }

  private extractNextData(html: string): any {
    const match = html.match(
      /__NEXT_DATA__"\s+type="application\/json">([\s\S]+?)<\/script>/,
    );
    if (!match) {
      throw new ServiceUnavailableException(
        'Não foi possível ler os dados da página Gupy.',
      );
    }
    try {
      return JSON.parse(match[1]);
    } catch {
      throw new ServiceUnavailableException(
        'JSON inválido na resposta da Gupy.',
      );
    }
  }

  async fetchRemoteJobs(configId: string): Promise<RemoteJobsResponse> {
    const config = await this.findById(configId);
    const html = await this.fetchHtml(`https://${config.subdomain}.gupy.io/`);
    const data = this.extractNextData(html);
    const jobs: any[] = data?.props?.pageProps?.jobs ?? [];

    const existing = await this.vagasRepository.find({
      where: { gupyConfigId: config.id },
      select: ['id', 'externalJobId', 'status'],
    });
    const existingByJobId = new Map(
      existing
        .filter((v) => v.externalJobId)
        .map((v) => [String(v.externalJobId), v]),
    );

    const remoteJobs: RemoteJobSummary[] = jobs.map((j) => {
      const existingVaga = existingByJobId.get(String(j.id));
      return {
        id: j.id,
        title: j.title,
        type: j.type ?? null,
        department: j.department ?? null,
        city: j.workplace?.address?.city ?? null,
        state: j.workplace?.address?.stateShortName ?? null,
        workplaceType: j.workplace?.workplaceType ?? null,
        alreadyImported: !!existingVaga,
        importedVagaId: existingVaga?.id,
        importedStatus: existingVaga?.status,
      };
    });

    return { config, jobs: remoteJobs };
  }

  async fetchRemoteJob(subdomain: string, jobId: string): Promise<any> {
    const html = await this.fetchHtml(this.buildJobUrl(subdomain, jobId));
    const data = this.extractNextData(html);
    const job = data?.props?.pageProps?.job;
    if (!job) {
      throw new NotFoundException('Vaga não encontrada na Gupy.');
    }
    return job;
  }

  // ---------- Import ----------

  async importJobs(
    configId: string,
    adminId: string,
    jobIds: number[],
  ): Promise<ImportResult> {
    const config = await this.findById(configId);
    if (!config.enabled) {
      throw new BadRequestException('Esta configuração Gupy está desabilitada.');
    }
    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      throw new BadRequestException('Selecione pelo menos uma vaga.');
    }
    if (jobIds.length > 50) {
      throw new BadRequestException('Importe no máximo 50 vagas por vez.');
    }

    const existing = await this.vagasRepository.find({
      where: { gupyConfigId: config.id },
      select: ['id', 'externalJobId'],
    });
    const existingIds = new Set(
      existing.map((v) => String(v.externalJobId)).filter(Boolean),
    );

    const result: ImportResult = {
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    for (const jobId of jobIds) {
      const externalJobId = String(jobId);
      if (existingIds.has(externalJobId)) {
        result.skipped++;
        continue;
      }
      try {
        const remote = await this.fetchRemoteJob(config.subdomain, externalJobId);
        const vaga = this.buildVagaFromRemote(
          config,
          adminId,
          externalJobId,
          remote,
        );
        vaga.slug = await this.uniqueSlug(
          `gupy-${config.subdomain}-${externalJobId}`,
        );
        await this.vagasRepository.save(vaga);
        result.imported++;
      } catch (err) {
        result.failed++;
        result.errors.push({
          jobId,
          reason: (err as Error).message || 'Erro desconhecido',
        });
      }
    }

    return result;
  }

  // ---------- Sync ----------

  async syncJobs(configId: string): Promise<SyncResult> {
    const config = await this.findById(configId);
    const result: SyncResult = {
      total: 0,
      closed: 0,
      updated: 0,
      errors: [],
      syncedAt: new Date().toISOString(),
    };

    const vagas = await this.vagasRepository.find({
      where: { gupyConfigId: config.id, source: VagaSource.GUPY },
    });
    result.total = vagas.length;
    if (vagas.length === 0) return result;

    let remoteJobs: any[] = [];
    try {
      const html = await this.fetchHtml(`https://${config.subdomain}.gupy.io/`);
      const data = this.extractNextData(html);
      remoteJobs = data?.props?.pageProps?.jobs ?? [];
    } catch (err) {
      throw new ServiceUnavailableException(
        `Falha ao buscar listagem Gupy: ${(err as Error).message}`,
      );
    }
    const remoteIds = new Set(remoteJobs.map((j) => String(j.id)));

    const now = new Date();
    for (const vaga of vagas) {
      if (!vaga.externalJobId) continue;
      try {
        if (!remoteIds.has(String(vaga.externalJobId))) {
          if (vaga.status !== VagaStatus.CLOSED) {
            vaga.status = VagaStatus.CLOSED;
            result.closed++;
          }
          vaga.lastSyncedAt = now;
          await this.vagasRepository.save(vaga);
          continue;
        }
        const remote = await this.fetchRemoteJob(
          config.subdomain,
          vaga.externalJobId,
        );
        const remoteStatus = remote?.status;
        const wasClosed = vaga.status === VagaStatus.CLOSED;
        if (remoteStatus !== 'published') {
          if (vaga.status !== VagaStatus.CLOSED) {
            vaga.status = VagaStatus.CLOSED;
            result.closed++;
          }
        } else {
          this.applyRemoteToVaga(vaga, remote);
          if (wasClosed) {
            vaga.status = VagaStatus.PUBLISHED;
          }
          result.updated++;
        }
        vaga.lastSyncedAt = now;
        await this.vagasRepository.save(vaga);
      } catch (err) {
        result.errors.push({
          vagaId: vaga.id,
          reason: (err as Error).message || 'Erro desconhecido',
        });
      }
    }

    return result;
  }

  // ---------- Helpers ----------

  private buildVagaFromRemote(
    config: GupyConfig,
    adminId: string,
    externalJobId: string,
    remote: any,
  ): Vaga {
    const vaga = this.vagasRepository.create({
      title: this.sanitizeTitle(remote.name || `Vaga ${externalJobId}`),
      description: this.htmlToText(remote.description || ''),
      requirements: remote.prerequisites
        ? this.htmlToText(remote.prerequisites)
        : null,
      benefits: null,
      location: this.buildLocation(remote),
      type: null,
      workMode: this.mapWorkMode(remote.workplaceType),
      salaryMin: null,
      salaryMax: null,
      deadline: this.parseDeadline(remote),
      status: VagaStatus.PUBLISHED,
      contactEmail: null,
      source: VagaSource.GUPY,
      companyName: config.displayName,
      gupyConfigId: config.id,
      externalJobId,
      lastSyncedAt: new Date(),
      createdById: adminId,
    });
    return vaga;
  }

  private applyRemoteToVaga(vaga: Vaga, remote: any) {
    vaga.title = this.sanitizeTitle(remote.name || vaga.title);
    if (remote.description) vaga.description = this.htmlToText(remote.description);
    if (remote.prerequisites) {
      vaga.requirements = this.htmlToText(remote.prerequisites);
    }
    const loc = this.buildLocation(remote);
    if (loc) vaga.location = loc;
    const wm = this.mapWorkMode(remote.workplaceType);
    if (wm) vaga.workMode = wm;
    const dl = this.parseDeadline(remote);
    if (dl) vaga.deadline = dl;
  }

  private sanitizeTitle(t: string): string {
    return t.replace(/\s+/g, ' ').trim().slice(0, 255);
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private buildLocation(remote: any): string | null {
    const city = remote.addressCity;
    const state = remote.addressStateShortName || remote.addressState;
    if (city && state) return `${city}/${state}`;
    if (city) return city;
    if (state) return state;
    return null;
  }

  private mapWorkMode(type: string | null | undefined): VagaWorkMode | null {
    if (!type) return null;
    const t = type.toLowerCase();
    if (t.includes('remote')) return VagaWorkMode.REMOTE;
    if (t.includes('hybrid')) return VagaWorkMode.HYBRID;
    if (t.includes('on-site') || t.includes('onsite')) return VagaWorkMode.ONSITE;
    return null;
  }

  private parseDeadline(remote: any): Date | null {
    const candidate = remote.expiresAt || remote.registerEndDate;
    if (!candidate) return null;
    const d = new Date(candidate);
    if (isNaN(d.getTime())) return null;
    return d;
  }

  private async uniqueSlug(base: string): Promise<string> {
    const baseSlug = slugify(base, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 2;
    while (true) {
      const existing = await this.vagasRepository.findOne({ where: { slug } });
      if (!existing) break;
      slug = `${baseSlug}-${counter++}`;
    }
    return slug;
  }
}
