---
name: Phase 2 Refactor
description: HunterInterest module, User.activeContextTeamId, vaga ownership via context, DELETE /applications/:id — added 2026-05-23
type: project
---

Phase 2 backend implemented on 2026-05-23.

**Why:** Part of the multi-mode dashboard refactor (Profissional/Hunter/Empresa). Hunters need to register interest in vagas; users need to switch team context when publishing; candidates need to remove their own applications.

**How to apply:** When working on hunter flows, context switching, or application management, verify these features are in place before adding more.

## New module: hunter-interests/
- `src/hunter-interests/hunter-interest.entity.ts` — HunterInterest entity with status enum (PENDING/ACCEPTED/REJECTED), unique(vagaId, hunterUserId), CASCADE FK on both.
- `src/hunter-interests/dto/update-hunter-interest.dto.ts`
- `src/hunter-interests/hunter-interests.service.ts`
- `src/hunter-interests/hunter-interests.controller.ts`
- `src/hunter-interests/hunter-interests.module.ts`

## Endpoints added
- `POST /vagas/:id/hunter-interest` — express hunter interest (auth, vaga must have allowHunters=true, 409 if duplicate)
- `GET /me/hunter-interests` — list own interests with vaga join; contact only revealed when ACCEPTED
- `GET /vagas/:id/hunter-interests` — vaga owner only; returns hunter name+email+phone
- `PATCH /vagas/:id/hunter-interests/:hunterId` — vaga owner accepts/rejects (body: {status: ACCEPTED|REJECTED})
- `PATCH /profile/me/active-context` — set/clear activeContextTeamId (validates membership)
- `DELETE /applications/:id` — candidate self-deletes own application (204)

## Schema changes (migration 1748000002000)
- `users.activeContextTeamId UUID NULL` — no FK (soft reference); index where NOT NULL
- `hunter_interests` table with enum type `hunter_interest_status_enum`

## Ownership via context (vagas.service.create)
When `user.activeContextTeamId` is set and no explicit `companyId` in the DTO, auto-resolves to the first company owned by the team owner. Also sets `assignedToId = user.id` so the vaga appears in the actor's pipeline within the team listing. `createdById` always stays as the real actor.

## Modules updated
- `app.module.ts` — HunterInterestsModule registered
- `database/database.config.ts` — SavedVaga, SavedFilter, HunterInterest added to entities list (was missing phase 1 entities)
- `data-source.ts` — HunterInterest added
- `vagas/vagas.module.ts` — Team entity added to forFeature
- `profile/profile.module.ts` — Team + TeamMember added for active-context validation
