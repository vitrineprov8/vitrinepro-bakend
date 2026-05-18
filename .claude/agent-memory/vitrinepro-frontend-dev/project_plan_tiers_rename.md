---
name: Plan Tiers Renamed
description: PlanTier enum renamed from PERSONAL/HUNTER/EMPRESARIAL to RECRUITER/TEAM/ENTERPRISE with new pricing, as of 2026-05-15
type: project
---

PlanTier is now `'FREE' | 'RECRUITER' | 'TEAM' | 'ENTERPRISE'` throughout the entire frontend. The old values PERSONAL, HUNTER, EMPRESARIAL were completely removed.

Display names: FREE=Gratuito, RECRUITER=Recruiter, TEAM=Recruiter Team, ENTERPRISE=Recruiter Enterprise.

Pricing: FREE=R$0, RECRUITER=R$50/mês, TEAM=R$350/mês, ENTERPRISE=R$2500/mês.

Vaga limits: FREE=1/mês, RECRUITER=5/mês, TEAM=30/mês, ENTERPRISE=ilimitado (-1).

**Why:** Business decision to align naming with the recruiter-focused product positioning.

**How to apply:** Any new component showing plan names must use RECRUITER/TEAM/ENTERPRISE. The canonical mapping is defined locally in each component that needs it — no shared util file (per CLAUDE.md rule: no helpers for single use). The `Plan` interface in api.ts now includes `seatLimit: number` (-1 = unlimited).

Files updated: `src/utils/api.ts`, `src/components/dashboard/PlansPage.vue`, `src/components/dashboard/DashboardLayout.vue`, `src/components/dashboard/CheckoutPage.vue`, `src/components/dashboard/UpgradePlanModal.vue`, `src/components/dashboard/VagaEditor.vue`, `src/components/dashboard/VagasAdminList.vue`.
