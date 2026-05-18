import { PlanTier } from '../users/user.entity';

/**
 * Monthly vaga publish slots per plan.
 * -1 = unlimited (ENTERPRISE).
 * FREE = 1 slot/month (to allow trial publish).
 */
export const PLAN_VAGA_LIMITS: Record<PlanTier, number> = {
  FREE: 1,
  RECRUITER: 5,
  TEAM: 30,
  ENTERPRISE: -1,
};

/**
 * Monthly price in BRL (0 = free tier).
 */
export const PLAN_PRICES_BRL: Record<PlanTier, number> = {
  FREE: 0,
  RECRUITER: 50,
  TEAM: 350,
  ENTERPRISE: 2500,
};

/**
 * Maximum number of team member seats per plan.
 * -1 = unlimited (ENTERPRISE).
 */
export const PLAN_SEAT_LIMITS: Record<PlanTier, number> = {
  FREE: 1,
  RECRUITER: 1,
  TEAM: 5,
  ENTERPRISE: -1,
};

export const PLAN_NAMES: Record<PlanTier, string> = {
  FREE: 'Gratuito',
  RECRUITER: 'Recruiter',
  TEAM: 'Recruiter Team',
  ENTERPRISE: 'Recruiter Enterprise',
};

export const PLAN_FEATURES: Record<PlanTier, string[]> = {
  FREE: [
    'Perfil público',
    'Dashboard básico',
    '1 vaga publicada por mês',
    '1 acesso',
  ],
  RECRUITER: [
    'Até 5 vagas publicadas por mês',
    'Painel de candidatos',
    'Compartilhamento ilimitado',
    '1 acesso',
  ],
  TEAM: [
    'Até 30 vagas publicadas por mês',
    'Tudo do Recruiter',
    'Até 5 acessos simultâneos',
    'Gestão de clientes (Empresas)',
    'Destaque nas buscas',
  ],
  ENTERPRISE: [
    'Vagas ilimitadas',
    'Tudo do Recruiter Team',
    'Acessos ilimitados',
    'Gestão avançada de clientes',
    'Suporte prioritário',
  ],
};
