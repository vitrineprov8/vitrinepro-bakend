import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { LessThan, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  SlugTombstone,
  TombstoneType,
  TombstoneReason,
} from './slug-tombstone.entity';

const TOMBSTONE_TTL_DAYS = 180;

export interface CreateTombstoneOptions {
  type: TombstoneType;
  slug: string;
  reason: TombstoneReason;
  redirectTo?: string | null;
}

export type TombstoneLookupResult =
  | { exists: false }
  | { exists: true; reason: TombstoneReason; redirectTo?: string };

@Injectable()
export class SeoService {
  private readonly logger = new Logger(SeoService.name);

  private readonly indexNowKey: string | undefined;
  private readonly siteUrl: string;

  constructor(
    @InjectRepository(SlugTombstone)
    private tombstoneRepo: Repository<SlugTombstone>,
    private configService: ConfigService,
  ) {
    this.indexNowKey = this.configService.get<string>('INDEXNOW_KEY');
    this.siteUrl = this.configService.get<string>('PUBLIC_SITE_URL') ?? 'https://v8pro.com.br';
  }

  /**
   * Notifies IndexNow-compatible search engines (Bing, Yandex, Seznam) that
   * one or more URLs have been created, updated, or deleted.
   *
   * This accelerates (de)indexing from weeks to hours for those engines.
   * The method is always fire-and-forget: errors are logged but never thrown.
   *
   * No-op when INDEXNOW_KEY is not configured (e.g. local dev).
   *
   * @param urls - one or more RELATIVE paths (e.g. '/portfolio/foo') OR full URLs.
   *               Relative paths are converted to absolute using PUBLIC_SITE_URL.
   */
  async notifyIndexNow(urls: string | string[]): Promise<void> {
    if (!this.indexNowKey) {
      this.logger.debug('notifyIndexNow: INDEXNOW_KEY not set, skipping ping');
      return;
    }

    const urlList = (Array.isArray(urls) ? urls : [urls]).map((u) =>
      u.startsWith('http') ? u : `${this.siteUrl}${u}`,
    );

    const payload = {
      host: new URL(this.siteUrl).hostname,
      key: this.indexNowKey,
      keyLocation: `${this.siteUrl}/${this.indexNowKey}.txt`,
      urlList,
    };

    try {
      const res = await fetch('https://api.indexnow.org/IndexNow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        this.logger.warn(
          `notifyIndexNow: API responded ${res.status} for urls: ${urlList.join(', ')}`,
        );
      } else {
        this.logger.debug(
          `notifyIndexNow: pinged ${urlList.length} url(s) → HTTP ${res.status}`,
        );
      }
    } catch (err) {
      this.logger.warn(`notifyIndexNow: fetch failed — ${(err as Error).message}`);
    }
  }

  /**
   * Creates or updates a tombstone for the given (type, slug) pair.
   * Idempotent: if a tombstone already exists for this pair it is updated
   * in-place (reason, redirectTo, and expiresAt are refreshed).
   */
  async createTombstone(opts: CreateTombstoneOptions): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TOMBSTONE_TTL_DAYS);

    // Upsert pattern: find existing or create new, then save.
    // TypeORM's upsert with onConflict would require raw SQL for the partial
    // unique index; the find-then-save approach is clear and safe here because
    // tombstone writes are low-frequency (triggered only on user delete/hide).
    let tombstone = await this.tombstoneRepo.findOne({
      where: { type: opts.type, slug: opts.slug },
    });

    if (tombstone) {
      tombstone.reason = opts.reason;
      tombstone.redirectTo = opts.redirectTo ?? null;
      tombstone.expiresAt = expiresAt;
    } else {
      tombstone = this.tombstoneRepo.create({
        type: opts.type,
        slug: opts.slug,
        reason: opts.reason,
        redirectTo: opts.redirectTo ?? null,
        expiresAt,
      });
    }

    await this.tombstoneRepo.save(tombstone);
  }

  /**
   * Removes a tombstone for the given (type, slug) pair.
   * Used when content becomes live again (e.g. profile re-published).
   * No-op if tombstone does not exist.
   */
  async removeTombstone(type: TombstoneType, slug: string): Promise<void> {
    await this.tombstoneRepo.delete({ type, slug });
  }

  /**
   * Looks up a tombstone by (type, slug), filtering out expired entries.
   * Returns the tombstone data if found, or { exists: false } otherwise.
   */
  async lookupTombstone(
    type: TombstoneType,
    slug: string,
  ): Promise<TombstoneLookupResult> {
    const tombstone = await this.tombstoneRepo
      .createQueryBuilder('t')
      .select(['t.reason', 't.redirectTo'])
      .where('t.type = :type', { type })
      .andWhere('t.slug = :slug', { slug })
      .andWhere('t.expiresAt > NOW()')
      .getOne();

    if (!tombstone) {
      return { exists: false };
    }

    const result: Extract<TombstoneLookupResult, { exists: true }> = {
      exists: true,
      reason: tombstone.reason,
    };

    if (tombstone.redirectTo) {
      result.redirectTo = tombstone.redirectTo;
    }

    return result;
  }

  /**
   * Purges expired tombstones.  Runs daily at 03:00 UTC.
   * Keeps the table lean — expired rows have no semantic value.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpired(): Promise<void> {
    try {
      const result = await this.tombstoneRepo.delete({
        expiresAt: LessThan(new Date()),
      });
      this.logger.log(
        `purgeExpired: deleted ${result.affected ?? 0} expired tombstone(s)`,
      );
    } catch (err) {
      this.logger.error('purgeExpired failed', err);
    }
  }
}
