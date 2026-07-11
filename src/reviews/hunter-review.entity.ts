import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * B10 — avaliação de hunter (RN-NOVA-07, design-spec 05_WORKSPACE_EMPRESA.md).
 *
 * "Após cada placement/encerramento, card 'Avalie {hunter}' → estrelas 1–5 +
 * comentário opcional + chips rápidos → alimenta o perfil público, não
 * editável depois."
 *
 * 1 review por placement (unique em placementId) — imutável: não existe
 * endpoint de update/delete. `hunterId` é denormalizado do placement pra
 * permitir agregação rápida (média/contagem) sem join no perfil público (B5).
 */
export enum ReviewTag {
  AGIL = 'AGIL',
  BONS_CANDIDATOS = 'BONS_CANDIDATOS',
  COMUNICACAO_CLARA = 'COMUNICACAO_CLARA',
}

@Entity('hunter_reviews')
export class HunterReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_hunter_reviews_placementId', { unique: true })
  @Column({ type: 'uuid' })
  placementId: string;

  @Index('IDX_hunter_reviews_hunterId')
  @Column({ type: 'uuid' })
  hunterId: string;

  @Column({ type: 'uuid', nullable: true })
  vagaId: string | null;

  /** Quem escreveu a avaliação (dono da vaga, delegado de time ou admin). */
  @Column({ type: 'uuid' })
  reviewedById: string;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ type: 'simple-array', nullable: true })
  tags: ReviewTag[] | null;

  @CreateDateColumn()
  createdAt: Date;
}
