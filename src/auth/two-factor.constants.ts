/**
 * B27 — contrato do "challenge token" (login em 2 etapas), num arquivo próprio
 * porque os dois lados precisam dele e importam um ao outro de outra forma:
 * `AuthService` **emite** o token (no `login`) e `TwoFactorService` o
 * **verifica** (no `verifyLoginChallenge`), mas `TwoFactorService` já depende
 * de `AuthService` para criar a sessão final. Um arquivo só de constantes
 * quebra o ciclo sem duplicar a definição nos dois lugares.
 */

/**
 * Claim que marca o token como "senha OK, 2FA pendente".
 * O `JwtStrategy` REJEITA qualquer token que o contenha — é isso que impede
 * que o challenge token seja usado como credencial em rotas autenticadas.
 */
export const TWO_FACTOR_PENDING_CLAIM = 'twoFactorPending';

/**
 * Validade do challenge token: tempo suficiente para abrir o app autenticador
 * e digitar, curto o bastante para não virar credencial útil se vazar.
 */
export const TWO_FACTOR_CHALLENGE_TTL = '5m';
