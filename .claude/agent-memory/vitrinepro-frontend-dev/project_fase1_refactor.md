---
name: Fase 1 Dashboard Refactor (3-Mode Sidebar + Radar)
description: Sidebar rewritten for 3 modes (Profissional/Hunter/Empresa), SignupForm company toggle, Radar de Vagas new page, api.ts extensions
type: project
---

Implemented 2026-05-23. 

**Files created:**
- `src/components/profissional/RadarVagas.vue` — full radar grid, heart toggle, apply modal, double-click to save
- `src/components/profissional/RadarFilters.vue` — segment/type/workMode/city/order filters + saved-filter chips + save-filter modal
- `src/components/profissional/Preferencias.vue` — saved filters as cards with edit/delete/setDefault
- `src/components/profissional/ProfissionalWorkspace.vue` — tab router (radar | preferencias | salvas), wraps DashboardLayout
- `src/pages/dashboard/profissional.astro` — client-only page mounting ProfissionalWorkspace

**Files modified:**
- `src/utils/api.ts` — added VagaSegment union type, Vaga.segment/allowHunters/hunterContactPhone, FullProfile.isCompany/companyName/companyIndustry/companyLogoUrl, registerUser accepts optional company fields, new modules: savedVagas / savedFilters / radar
- `src/components/SignupForm.vue` — Profissional/Empresa toggle at top; empresa fields: companyName (required) + companyIndustry (select); firstName/lastName re-labeled "Responsavel" when empresa is toggled
- `src/components/dashboard/DashboardLayout.vue` — 3-mode nav (isEmpresaMode computed from user.isCompany, activeRole 'profissional'|'hunter' persisted to localStorage), "Meus dados" collapsible section, "Acessando como" selector (hidden for empresa), empresa header (companyLogoUrl or initials), mobile bottom-nav per mode; plan ring/badge CSS updated for RECRUITER/TEAM/ENTERPRISE

**Key decisions:**
- activeRole persisted in `localStorage.activeRole`; loaded after getMyPlan() so canBeHunter is known
- `#meus-dados` href is a sentinel value triggering a toggle button, not a real link
- VagasList.vue now uses `radar.search` as primary endpoint with fallback to getPublicVagas
- Template literal backticks in Vue template attributes cause parse errors — use computed properties instead

**Why:** Backend Fase 1 done (isCompany, Vaga.segment, savedVagas, savedFilters, radar endpoint). Frontend needs to segment users so Profissionals get a clean job-search UX without the recruiter clutter.

**How to apply:** When working on sidebar nav additions or role-gated features, read DashboardLayout.vue navEntries computed — it has 3 branches. New dashboard pages follow the same pattern: Astro shell imports Vue workspace component that wraps DashboardLayout.
