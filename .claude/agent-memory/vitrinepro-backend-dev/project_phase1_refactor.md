---
name: Phase 1 Refactor — Company accounts, Vaga segments, SavedVaga, SavedFilter, Radar
description: Documents all entities, endpoints and rules added in phase 1 of the Profissional/Hunter/Empresa refactor
type: project
---

Phase 1 backend completed (2026-05-23). Migration timestamp: 1748000001000.

**Why:** Reestruturação do dashboard para suportar 3 modos: Profissional / Hunter / Empresa. Plan de execução confirmado em `C:\Users\andr3\.claude\plans\adaptive-singing-lark.md`.

**New columns:**
- `users.isCompany BOOLEAN DEFAULT false` — marks an account as a company (no public profile, cannot apply)
- `users.companyName VARCHAR NULL`, `companyIndustry VARCHAR NULL`, `companyLogoUrl VARCHAR NULL`
- `vagas.segment VARCHAR(50) NULL` — uses VagaSegment enum (COMERCIO_VENDAS, LOGISTICA_TRANSPORTE, etc.)
- `vagas.allowHunters BOOLEAN DEFAULT false`, `vagas.hunterContactPhone VARCHAR(50) NULL`

**New tables:**
- `saved_vagas` — (userId, vagaId) unique; CASCADE FK on both; IDX on userId and vagaId
- `saved_filters` — userId, name, filters JSONB, isDefault BOOL, position INT; IDX on userId

**New modules:** `src/saved-vagas/`, `src/saved-filters/`

**New endpoints:**
- `GET /vagas/radar` — public, paginated, filters: q, segment, city, type, workMode, salaryMin, order=recent|relevance
- `POST /vagas/:id/save` — JWT, saves a published vaga
- `DELETE /vagas/:id/save` — JWT, removes bookmark
- `GET /me/saved-vagas` — JWT, paginated list with vaga join
- `POST /me/saved-filters` — JWT, create filter
- `GET /me/saved-filters` — JWT, list ordered by position
- `PATCH /me/saved-filters/:id` — JWT, update
- `DELETE /me/saved-filters/:id` — JWT, remove
- `POST /me/saved-filters/:id/default` — JWT, atomic default swap

**Business rules:**
- `profile.getPublicProfile` returns 404 for `isCompany=true` users
- `vaga-applications.apply` returns 403 for `isCompany=true` users
- `POST /auth/register` accepts `isCompany?, companyName?, companyIndustry?`; companyName required when isCompany=true
- `GET /vagas/radar` route MUST stay above `GET /vagas/:slug` in controller to avoid route collision

**How to apply:** When touching User, Vaga, profile, or applications logic, respect these rules. Phases 2/3 are not implemented yet (HunterInterest, activeContext, notes/history/share/PDF).
