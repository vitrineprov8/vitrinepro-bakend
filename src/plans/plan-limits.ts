import { PlanTier } from '../users/user.entity';

export const PLAN_VAGA_LIMITS: Record<PlanTier, number> = {
  FREE: 0,
  PERSONAL: 5,
  HUNTER: 15,
  EMPRESARIAL: 50,
};

export const PLAN_PRICES_BRL: Record<PlanTier, number> = {
  FREE: 0,
  PERSONAL: 49,
  HUNTER: 99,
  EMPRESARIAL: 249,
};

export const PLAN_NAMES: Record<PlanTier, string> = {
  FREE: 'Gratuito',
  PERSONAL: 'Personal',
  HUNTER: 'Hunter',
  EMPRESARIAL: 'Empresarial',
};

export const PLAN_FEATURES: Record<PlanTier, string[]> = {
  FREE: ['Acesso ao dashboard', 'Perfil público'],
  PERSONAL: ['Até 5 vagas ativas', 'Painel de candidatos', 'Compartilhamento ilimitado'],
  HUNTER: ['Até 15 vagas ativas', 'Tudo do Personal', 'Destaque nas buscas'],
  EMPRESARIAL: ['Até 50 vagas ativas', 'Tudo do Hunter', 'Suporte prioritário'],
};
