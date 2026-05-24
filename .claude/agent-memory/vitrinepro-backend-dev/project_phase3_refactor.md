---
name: Phase 3 Refactor
description: VagaApplication notes/history/share + ProcessShareLink + PDF endpoint added 2026-05-23
type: project
---

Phase 3 backend implemented 2026-05-23.

**Why:** Pipeline enrichment — recruiters need per-stage notes, general score/note, audit trail of stage moves, shareable public links, and downloadable PDFs.

**How to apply:** These features are gated to vaga owners/admins (same pattern as updateStatus). Public token endpoint has no auth guard.

## Migration
`1748000003000-phase3-application-notes-share.ts`
- `vaga_applications`: added `generalScore DECIMAL(3,1)`, `generalNote TEXT`, `stageHistory JSONB DEFAULT '[]'`, `stageNotes JSONB DEFAULT '{}'`; GIN index on stageHistory.
- `process_share_links`: new table with `token VARCHAR(64) UNIQUE`, `expiresAt`, `revokedAt`, FK to vaga_applications + users; partial index on token WHERE revokedAt IS NULL.

## New module
`src/process-share/` — ProcessShareLink entity, ProcessShareService, PdfService, ProcessShareController, ProcessShareModule.

## New endpoints
- `PATCH /applications/:id/general` — set generalScore/generalNote
- `PATCH /applications/:id/stage-notes/:stageKey` — merge stageNotes[stageKey]
- `GET /applications/:id/history` — stageHistory desc with author names
- `POST /applications/:id/share` — generate token (default 30d, max 365d). Uses PUBLIC_BASE_URL env (default https://v8pro.com.br)
- `DELETE /applications/:id/share/:token` — revoke (sets revokedAt)
- `GET /public/processo/:token` — public no-auth snapshot (no phone/email/cv-urls)
- `GET /applications/:id/pdf` — streams PDF via pdfkit (no chromium dep)

## Auto-history
`updateStatus` now appends to stageHistory when pipelineStage changes (only on actual change, not same value).

## PDF lib choice
`pdfkit` — chosen over puppeteer because no Chromium dependency (lighter on Railway). Import via `require()` due to TS namespace-import limitation with `@types/pdfkit`.
