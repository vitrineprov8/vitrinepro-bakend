import { IsEnum } from 'class-validator';

export enum DisputeResolution {
  /** Confirma o placement como se o hunter tivesse aceitado (dados corretos). */
  CONFIRM = 'CONFIRM',
  /** Cancela o placement — sem fee, sem garantia (dados de fato incorretos/indevidos). */
  CANCEL = 'CANCEL',
}

/** Body for POST /placements/:id/resolve-dispute (A3 — admin resolve disputa). Só ADMIN. */
export class ResolveDisputeDto {
  @IsEnum(DisputeResolution)
  resolution: DisputeResolution;
}
