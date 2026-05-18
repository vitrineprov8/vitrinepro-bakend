import { PipelineStage } from './pipeline-stage.embedded';

/**
 * The out-of-the-box stages every new recruiter gets on their first visit to
 * GET /me/pipeline-template.  The 'rejected' stage is always appended last and
 * is not removable via the API.
 */
export const DEFAULT_PIPELINE_STAGES: PipelineStage[] = [
  { id: 'para_analisar', label: 'Para analisar', order: 0 },
  { id: 'analisados', label: 'Analisados', order: 1 },
  { id: 'abordados', label: 'Abordados', order: 2 },
  { id: 'entrev_recrutador', label: 'Entrevista Recrutador', order: 3 },
  { id: 'entrev_rh', label: 'Entrevista RH', order: 4 },
  { id: 'entrev_gestor', label: 'Entrevista Gestor', order: 5 },
  { id: 'entrev_final', label: 'Entrevista Final', order: 6 },
  { id: 'rejected', label: 'Rejeitados', order: 99, isRejected: true },
];
