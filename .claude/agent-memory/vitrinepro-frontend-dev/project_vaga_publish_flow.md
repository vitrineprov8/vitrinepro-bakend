---
name: Vaga Publish Anti-Abuse Flow
description: New vaga publish flow using POST /vagas/:id/publish with slot ledger — PATCH /vagas/:id no longer accepts PUBLISHED status
type: project
---

As of 2026-05-15, publishing a vaga requires `POST /vagas/:id/publish` (NOT PATCH with status=PUBLISHED, which returns 400).

**Backend error shapes to handle:**
- 403 with body `{ statusCode: 403, message: { code: "PLAN_LIMIT_REACHED", used: N, limit: N, cycleEnd: "...", message: "..." } }` — limit reached
- 409 — vaga already published
- 400 — vaga not in DRAFT state

**Frontend helpers in api.ts:**
- `isPlanLimitReachedError(err)` — type guard for the 403 PLAN_LIMIT_REACHED shape
- `extractPlanLimitBody(err)` — extracts the nested body object
- `formatPlanLimitMessage(body)` — PT-BR human message
- `getMyVagaUsage()` — GET /vagas/me/usage → `{ used, limit, cycleStart, cycleEnd, planTier }`; `limit === -1` means unlimited
- `publishVaga(id)` — POST /vagas/:id/publish
- `unpublishVaga(id)` — POST /vagas/:id/unpublish

**VagaEditor.vue flow:** Save draft → load usage → open ConfirmDialog → call publishVaga. Publish button disabled when `used >= limit && limit !== -1`.

**VagasAdminList.vue:** Shows usage counter ("Vagas publicadas este mês: X/Y") with tooltip explaining the irreversible ledger. Per-row actions: DRAFT→"Publicar" (confirm), PUBLISHED→"Encerrar" (direct unpublish), CLOSED→"Republicar" (confirm). Refetches usage after each publish/unpublish/delete.

**Why:** Anti-abuse rule — publishing consumes a non-refundable slot in the billing cycle. Deleting a published vaga does NOT return the slot.
