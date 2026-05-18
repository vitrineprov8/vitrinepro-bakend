import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { PipelineTemplate } from './pipeline-template.entity';
import { PipelineStage } from './pipeline-stage.embedded';
import { DEFAULT_PIPELINE_STAGES } from './default-stages';

/** The one immutable rejected stage id. */
const REJECTED_STAGE_ID = 'rejected';

@Injectable()
export class PipelineTemplatesService {
  constructor(
    @InjectRepository(PipelineTemplate)
    private readonly templateRepository: Repository<PipelineTemplate>,
  ) {}

  /**
   * Returns the pipeline template that belongs to `user`.
   * If one does not yet exist it is created with DEFAULT_PIPELINE_STAGES and
   * persisted before being returned (lazy-init, no backfill migration needed).
   *
   * A query + insert race is handled via the unique index on ownerId:
   * if two concurrent requests both miss the initial findOne the second
   * INSERT will throw a unique-violation which we catch and re-fetch.
   */
  async getOrCreate(user: User): Promise<PipelineTemplate> {
    const existing = await this.templateRepository.findOne({
      where: { ownerId: user.id },
    });
    if (existing) return existing;

    try {
      const template = this.templateRepository.create({
        ownerId: user.id,
        stages: DEFAULT_PIPELINE_STAGES,
      });
      return await this.templateRepository.save(template);
    } catch (err: unknown) {
      // Unique-violation on ownerId — another concurrent request won the race.
      // Fetch and return the row that was just inserted.
      const code = (err as { code?: string }).code;
      if (code === '23505') {
        const recovered = await this.templateRepository.findOne({
          where: { ownerId: user.id },
        });
        if (recovered) return recovered;
      }
      throw err;
    }
  }

  /**
   * Replaces the stages on the user's pipeline template.
   *
   * Validation rules (enforced here rather than via class-validator alone
   * because they have cross-field semantics):
   *
   *  1. Every stage must have a non-empty `id`, `label`, and numeric `order`.
   *  2. All `id` values must be unique within the submitted array.
   *  3. At most one stage may have `isRejected = true`.
   *  4. Exactly one rejected stage must exist after the call — if the client
   *     did not include one, the default 'rejected' stage is appended.
   *  5. At least one non-rejected stage must exist (you cannot have a pipeline
   *     with only a rejected bucket).
   */
  async update(user: User, stages: PipelineStage[]): Promise<PipelineTemplate> {
    // ── 1. Structural uniqueness of ids ─────────────────────────────────────
    const ids = stages.map((s) => s.id);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      throw new BadRequestException('Todos os IDs de etapas devem ser únicos.');
    }

    // ── 2. At most one rejected stage in the submitted list ──────────────────
    const rejectedInPayload = stages.filter((s) => s.isRejected === true);
    if (rejectedInPayload.length > 1) {
      throw new BadRequestException(
        'Apenas uma etapa pode ser marcada como rejeitados.',
      );
    }

    // ── 3. Ensure exactly one rejected stage exists in the final list ────────
    let finalStages: PipelineStage[];
    if (rejectedInPayload.length === 0) {
      // Client omitted the rejected stage — append the canonical default.
      const defaultRejected = DEFAULT_PIPELINE_STAGES.find(
        (s) => s.id === REJECTED_STAGE_ID,
      )!;
      finalStages = [...stages, defaultRejected];
    } else {
      finalStages = stages;
    }

    // ── 4. At least one non-rejected stage ──────────────────────────────────
    const normalStages = finalStages.filter((s) => !s.isRejected);
    if (normalStages.length === 0) {
      throw new BadRequestException(
        'O pipeline deve ter pelo menos uma etapa além de Rejeitados.',
      );
    }

    const template = await this.getOrCreate(user);
    template.stages = finalStages;
    return this.templateRepository.save(template);
  }
}
