---
name: Dashboard KPIs Extended (Task #12)
description: VagasMetrics extended to 5 cards; PipelineOverviewCard and RecentActivityFeed new components for TEAM/ENTERPRISE
type: project
---

Task #12 implemented 2026-05-15. Dashboard KPIs extended for TEAM/ENTERPRISE users.

**Why:** Plan task to give TEAM/ENTERPRISE recrutadores a richer dashboard with pipeline aggregation and activity feed, matching PDF page 7 design.

**How to apply:** Gate PipelineOverviewCard and RecentActivityFeed behind `isTeamOrEnterprise` computed. The 5th KPI card (conversion rate) is also only shown for TEAM/ENTERPRISE.

## Changes

### VagasMetrics.vue
- Grid changed from `repeat(4, 1fr)` to `auto-fill minmax(160px, 1fr)` — supports any number of cards cleanly.
- Metric IDs now: `publicadas`, `em_analise`, `entrevistas`, `contratadas`, and (TEAM/ENTERPRISE only) `conversao`.
- **Conversion rate formula**: `contratados / total_candidatos * 100`. Total candidatos = sum of `applicantsCount` across all mock vagas. Displayed as percentage string (e.g. "18%").

### PipelineOverviewCard.vue (NEW)
- Location: `src/components/dashboard/PipelineOverviewCard.vue`
- Fetches: (1) `GET /me/pipeline-template`, (2) `GET /vagas/me?limit=10&status=PUBLISHED`, (3) parallel `GET /vagas/:id/applications` for vagas with `applicationsCount > 0`.
- Aggregates by `pipelineStage`; excludes `isRejected=true` candidates.
- Shows horizontal progress bars proportional to `maxCount`.
- Hint: "Agregado das N vagas mais recentes" — transparent about client-side limitation.
- TODO in code: replace with server-side aggregation endpoint when available.
- Fallback stages if `/me/pipeline-template` fails: 7 default stages.

### RecentActivityFeed.vue (NEW)
- Location: `src/components/dashboard/RecentActivityFeed.vue`
- Same fetch strategy as PipelineOverviewCard (reuses vagas list).
- Merges all applications, sorts by `createdAt` desc, takes top 10.
- Relative time via `Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })` — inline, not extracted as util (single use).
- Uses `avatarColor()` from `mock-recrutador.ts` for initials avatar colors.

### RecrutadorWorkspace.vue
- Imports `PipelineOverviewCard` and `RecentActivityFeed`.
- `activeSub === 'vagas'` panel now has `.rw-two-col` (TEAM/ENTERPRISE) or `.rw-one-col` (others).
- `.rw-two-col`: `grid-template-columns: 1fr 320px` — collapses to single column below 1100px.
- Sidebar (`.rw-sidebar-col`): sticky at `top: var(--spacing-lg)`.

### api.ts
- `VagaApplicationAdminView` extended with `pipelineStage?: string | null`, `isRejected?: boolean`, `vagaId?: string`, `vagaTitle?: string` — needed for aggregation logic.

## Known Limitations
- Client-side aggregation only processes the 10 most recent PUBLISHED vagas. Server-side aggregation endpoint needed for completeness.
- Mock metrics in RecrutadorWorkspace still use `MOCK_METRICS` — real data requires wiring up `getMyVagas` + `getVagaApplications` at workspace level.
