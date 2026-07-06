import { Equals } from 'class-validator';

/**
 * B4 — Body of POST /vagas/:id/hunter-interest.
 * `termsAccepted` must be explicitly `true` — the hunter has to check
 * "Aceito os termos de intermediação" in the drawer (T-H07) before the
 * request is accepted. Anything else (missing, false) is rejected with 400.
 */
export class ExpressInterestDto {
  @Equals(true, { message: 'É necessário aceitar os termos de intermediação.' })
  termsAccepted: boolean;
}
