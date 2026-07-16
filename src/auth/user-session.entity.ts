import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * B26 — "Sessões ativas com revogar" (design-spec `06_ADMIN_E_FLUXOS_TRANSVERSAIS.md
 * §C`, tab Dados de acesso). O JWT deste projeto era 100% stateless (sem jti,
 * sem tabela nenhuma) — não dava pra revogar um token já emitido antes de
 * expirar (24h). Esta entidade adiciona uma camada mínima de estado: 1 linha
 * por login bem-sucedido (`AuthService.createSession`), cujo próprio `id` é
 * usado como `jti` no payload do JWT. `JwtStrategy.validate()` confere se a
 * sessão ainda existe e não foi revogada a cada requisição autenticada.
 *
 * Compatibilidade: tokens emitidos ANTES desta mudança não têm `jti` no
 * payload — `JwtStrategy` trata esse caso como "sessão não rastreada" e deixa
 * passar (não desloga quem já estava logado no momento do deploy). Só tokens
 * novos (emitidos após o deploy) ficam de fato revogáveis.
 */
@Entity('user_sessions')
export class UserSession {
  /** Também usado como `jti` do JWT — ver `AuthService.createSession`. */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_user_sessions_userId')
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @CreateDateColumn()
  createdAt: Date;

  /** Atualizado a cada requisição autenticada validada com esta sessão. */
  @Column({ type: 'timestamp', nullable: true })
  lastSeenAt: Date | null;

  /** Setado quando o usuário revoga a sessão (ou exclui a conta — revoga todas). */
  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date | null;
}
