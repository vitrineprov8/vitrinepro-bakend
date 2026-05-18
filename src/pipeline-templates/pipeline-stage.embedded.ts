/**
 * Represents a single stage in a recruiter's pipeline template.
 * Stored as elements of a JSONB array in the pipeline_templates table.
 */
export interface PipelineStage {
  /** Slug-style identifier, e.g. 'para_analisar'. Used as a logical FK from VagaApplication.pipelineStage. */
  id: string;
  /** Human-readable label shown in the kanban board, e.g. "Para analisar". */
  label: string;
  /** Optional hex color or design-token, e.g. '#3B82F6'. */
  color?: string;
  /** Sort order within the pipeline (0-based). The rejected stage is conventionally order 99). */
  order: number;
  /** True only on the single special "rejected" stage. Enables fast is_rejected queries on applications. */
  isRejected?: boolean;
}
