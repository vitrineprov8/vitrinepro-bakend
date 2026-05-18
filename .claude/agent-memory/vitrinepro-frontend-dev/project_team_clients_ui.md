---
name: Team & Clients UI (Task #11)
description: New components for TEAM/ENTERPRISE users — TeamMembersList, ClientsList, ClientEditorModal; plus VagaEditor/VagasAdminList extensions
type: project
---

New components added 2026-05-15 for Task #11 of plan `squishy-percolating-charm.md`.

**New components:**
- `src/components/dashboard/TeamMembersList.vue` — lists team members, invite modal, role change, remove with ConfirmDialog
- `src/components/dashboard/ClientsList.vue` — card grid of companies, delete with ConfirmDialog
- `src/components/dashboard/ClientEditorModal.vue` — create/edit company with logo upload via ImageAdjustModal (1:1)

**Modified components:**
- `RecrutadorWorkspace.vue` — fetches `getMyPlan()` on mount; adds "Meu Time" and "Clientes" sub-tabs only when `plan === 'TEAM' || 'ENTERPRISE'`; `subTabs` is now a `computed` (was a static array)
- `VagaEditor.vue` — loads plan + companies list; shows "Cliente" select for TEAM/ENTERPRISE; `buildPayload` includes `companyId`
- `VagasAdminList.vue` — shows `v.company.name` badge for all plans; shows assigned-to chip + assign modal for TEAM/ENTERPRISE; lazy-loads team members on modal open

**API additions in `src/utils/api.ts`:**
- `Company` interface + `CompanyPayload`
- `companies` namespace: `list`, `get`, `create`, `update`, `remove`
- `TeamRole`, `TeamMemberStatus`, `TeamMember`, `Team` interfaces
- `team` namespace: `getMine`, `listMembers`, `invite`, `updateMember`, `removeMember`
- `vagasAssignment.assign(vagaId, userId | null)` → `PATCH /vagas/:id/assign`
- `Vaga` type extended with `company?`, `companyId?`, `assignedTo?`, `assignedToId?`
- `uploadGenericImage` added (same endpoint as `uploadContentImage` — `/uploads/image`)

**Gating pattern:** `userPlan` ref fetched non-blocking in `onMounted`; defaults to `FREE` so features stay hidden on error.

**Why:** Plan per the task — backend endpoints for `/companies`, `/me/team`, `/me/team/members`, `/vagas/:id/assign` all ready.

**How to apply:** When touching any of these components, note `subTabs` in RecrutadorWorkspace is a `computed`, not a static array. Always gate TEAM/ENTERPRISE features on `isTeamOrEnterprise` computed, never inline check.
