# vitrinepro-bakend — Guia para Claude (documento vivo)

Backend NestJS 11 que serve o frontend `../vitrinepro-frontend-v2`. **É a fonte de verdade dos contratos de API.**

> ⚠️ **REGRA OBRIGATÓRIA — LER E ATUALIZAR SEMPRE**
> 1. **Antes** de qualquer tarefa neste repo, ler este arquivo inteiro.
> 2. **Depois** de adicionar/alterar um endpoint, entidade, migração, módulo ou regra de negócio, **atualizar este arquivo no mesmo commit** (mapa de módulos §Endpoints e/ou §Regras). Um endpoint novo que não está aqui é um bug de documentação.
> 3. Gaps e regras de negócio de produto vivem em `../vitrinepro-frontend-v2/PLANO_DESENVOLVIMENTO.md` (§BACKEND, códigos B1..B16 e RN-*). Este arquivo é o "como está implementado"; aquele é o "o que falta".

## Stack
- **NestJS 11** + **TypeORM 0.3.28** + **PostgreSQL** (`pg`). Node/TS.
- Auth: `@nestjs/jwt` + Passport (`passport-jwt`, Google + LinkedIn OAuth). Hash: `bcryptjs`.
- Uploads/CV/avatar: AWS S3 (`@aws-sdk/client-s3`) + `sharp` + `pdfkit` (PDF de processo).
- Agendamento: `@nestjs/schedule`. Slugs: `slugify`. Validação: `class-validator` + `class-transformer`.

## Comandos
```bash
npm run start:dev        # dev (porta 3000, watch)
npm run build            # nest build
npm run migration:run    # aplica migrações pendentes
npm run migration:revert # reverte a última
npm run migration:show   # lista estado
npm run seed             # seed base   · npm run seed:fake  (dados fake)
npm run lint             # eslint --fix
```

## Convenções (seguir à risca — copiar de módulos existentes)
- **Rotas sem prefixo global** (não há `setGlobalPrefix`). Controllers usam `@Controller()` vazio e declaram o path completo no método: `@Get('vagas/:id/applications')`. Rotas públicas são livres; protegidas usam `@UseGuards(JwtAuthGuard)`.
- **`req.user` é a entidade `User` completa** (retornada por `JwtStrategy.validate` → `authService.validateUser`). Tipar como `{ user: { id: string; role: UserRole } }` no controller e ler `req.user.id` / `req.user.role`. Ownership/autorização é aplicada **no service**, não no controller.
- **DTOs** com `class-validator` (`@IsString`, `@IsEmail`, `@IsUUID`, `@IsOptional`, `@MaxLength`…). `ValidationPipe` global é `{ whitelist: true, transform: true }` — campos não declarados no DTO são removidos silenciosamente.
- **Entities**: `@PrimaryGeneratedColumn('uuid')`, `@CreateDateColumn`/`@UpdateDateColumn`, FKs via `@ManyToOne` + coluna `xxxId` explícita (`@Column({ type: 'uuid' })`) + `@JoinColumn`. `jsonb` para estruturas flexíveis. Enums deprecados ficam documentados no arquivo (ver `ApplicationStatus`), não se usam em código novo.
- **Migrações** (`src/migrations/<timestamp>-<nome>.ts`): `synchronize: false` — **toda mudança de schema exige migração**. Padrão: `up`/`down` idempotentes com `IF NOT EXISTS` / `IF EXISTS`, `uuid_generate_v4()` para PKs, constraints e índices nomeados (`PK_`, `FK_`, `UQ_`, `IDX_`). Nome da classe = `Nome<timestamp>` e propriedade `name` igual. Registrar a entity nova no `TypeOrmModule.forFeature([...])` do seu módulo.
- **⚠️ Registro de entidades em 3 lugares (senão quebra):** toda entity nova precisa ser adicionada ao array `entities` de **`src/data-source.ts`** (usado pelo CLI `migration:run`) **E** de **`src/database/database.config.ts`** (runtime da app), além do `forFeature` do módulo. Esquecer a lista causa `TypeORMError: Entity metadata for X#relation was not found`.
- **Módulos**: cada feature = pasta `src/<feature>/` com `<feature>.module.ts` + `.controller.ts` + `.service.ts` + `<entity>.entity.ts` + `dto/`. Registrar o módulo em `src/app.module.ts` (`imports`). Se outro módulo precisar do repositório, exportá-lo no `exports` do módulo dono.
- **Erros**: usar exceções Nest (`NotFoundException`, `ForbiddenException`, `ConflictException`, `BadRequestException`) com mensagem em **PT-BR** (a UI mostra a mensagem). Códigos de app (ex.: `PLAN_LIMIT_REACHED`) vão no corpo quando o front precisa reagir.
- CORS liberado para `localhost:3000/4321` e domínios `v8pro.com.br` (`src/main.ts`).

## Mapa de módulos (`src/`)
`auth` · `users` · `profile` (inclui `CompanyPublicController`, B6) · `education` · `cv` · `tags` · `portfolio` · `uploads` · `storage` · `search` · `vagas` · `vaga-applications` · `vaga-publish-ledger` · `pipeline-templates` · `hunter-interests` · `hunter-candidates` (B3) · `mail` (B14, **@Global**) · `process-share` · `plans` · `subscriptions` · `coupons` · `companies` · `teams` (inclui `TeamInvitePublicController`, B7) · `saved-vagas` · `saved-filters` · `seo` · `stats` · `seed` (só fora de produção).

## Endpoints por módulo (manter atualizado)
- **auth**: `POST /auth/register` (isCompany), `POST /auth/login`, OAuth Google/LinkedIn callbacks. **B2 ✅ reset de senha real**: `POST /auth/forgot-password` (resposta sempre genérica, anti-enumeração; contas OAuth sem senha não geram token), `POST /auth/reset-password/:token` (token 1h, uso único; 404 se não existe, 410 se expirado; `passwordResetToken`/`passwordResetExpiresAt` em `User` com `select:false`).
- **vagas**: CRUD do dono (`/vagas/me`, create/patch), `POST /vagas/:id/publish` (consome slot; erro `PLAN_LIMIT_REACHED`→Modal Upgrade), radar público `GET /vagas/radar` (filtros q/segmento/cidade/tipo/modo/salário/ordem), `GET /vagas/:slug` público, `GET /vagas/me/usage` (slots). `allowHunters` marca vaga aberta a hunters.
- **vaga-applications**: `POST /vagas/:slug/apply`, `GET /me/applications`, `GET /vagas/:id/applications` (dono/admin), `PATCH /applications/:id/status` (mover etapa/rejeitar), `PATCH /applications/:id/general` (score/nota), `PATCH /applications/:id/stage-notes/:stageKey`, `GET /applications/:id/history`, `DELETE /applications/:id` (candidato).
- **hunter-candidates (B3)**: pool privado do hunter + submissão a vagas + consentimento LGPD. Ver §Regras B3 abaixo.
- **mail (B14, @Global)**: `MailService` envia e-mail transacional via **Resend** (REST por `fetch`, sem dependência nova). Se `RESEND_API_KEY` ausente → **modo STUB** (loga, não envia; não quebra o fluxo). Nunca lança. Métodos: `sendConsentRequest(to,nome,token)` (B3), `sendWelcome`, `sendPasswordReset(to,token)` (B2 ✅ ligado em `AuthService`), `sendTeamInvite(to,teamName,inviterName,role,token)` (B7 ✅ ligado em `TeamsService.invite`). Templates HTML inline em `mail/mail.templates.ts`. Links usam `FRONTEND_URL`. Páginas públicas que recebem o clique: `/consentimento/[token]` → `POST /public/candidate-consent/:token`; `/redefinir-senha/[token]` → `POST /auth/reset-password/:token`; `/convite/[token]` → `GET /public/team-invite/:token` + `POST /team-invite/:token/accept`.
- **pipeline-templates**: `PATCH /me/pipeline-template` (renomear/cor/reordenar/add-remover etapas; `rejected` fixo).
- **process-share**: gerar/revogar link público de processo + PDF; consumo público em `GET /public/processo/:token`.
- **hunter-interests**: interesse do hunter numa vaga (marketplace parcial; fee/termos = gap B4).
- **plans / subscriptions / coupons**: `GET /plans`, checkout/confirm **mock** (gap B11), cupons ok.
- **companies / teams**: contas empresa, seats, membros. **B7 ✅ convite por token**: `POST /me/team/invite` agora gera `inviteToken` (64 hex, `select:false`) e dispara e-mail real via `MailService.sendTeamInvite`; em produção o response omite o token (só chega por e-mail). Rotas públicas/token em `TeamInvitePublicController` (path plano, fora do prefixo `me/team`): `GET /public/team-invite/:token` (sem auth — nome do time, papel, e-mail convidado, status) e `POST /team-invite/:token/accept` (com `JwtAuthGuard` — exige que `req.user.email` bata com `invitedEmail`; token é one-time, limpo após aceite). Fluxo por `memberId` (`POST /me/team/accept/:memberId`, exige já estar logado) continua existindo em paralelo, usado pela listagem `GET /me/team/invites/pending`.
- **saved-vagas / saved-filters / search / seo / stats**: utilitários. `GET /stats/home` (openVagas, professionals, companies).
- **profile**: `GET /profile/me`, `PATCH /profile`, `GET /profile/:username` (candidato público, 404 se `isCompany`). **B6 ✅**: `GET /empresas/:slug` (`CompanyPublicController`, path plano) — mesmo `username` como slug, exige `isCompany=true` (inverso do anterior); retorna `{ ...camposPublicos, vagasAbertas }` via `VagasService.findPublicByOwner(userId)` (vagas `PUBLISHED` do dono, projeção enxuta: id/slug/title/location/type/workMode/segment/salaryMin/salaryMax/publishedAt). `ProfileModule` agora importa `VagasModule`.

## Regras de negócio implementadas (RN)
- Não se pode publicar vaga via PATCH — só `POST /vagas/:id/publish` (consome slot do plano).
- Conta empresa (`isCompany`) não pode se candidatar como candidato.
- Candidatura é única por `(vagaId, userId)`.

### B3 — Submissão de candidatos por hunter
- `hunter_candidates`: pool privado por hunter (candidato "fantasma" sem conta). Único por `(hunterId, email)`.
- Consentimento LGPD por token de e-mail (envio real via B14; stub se sem chave): status `PENDING/GRANTED/DECLINED`. Submissão exige `GRANTED`.
- `POST /vagas/:id/submissions`: exige `vaga.allowHunters`; **limite N por hunter por vaga** (RN-NOVA-01) e **trava de duplicidade 90 dias** por candidato+vaga (RN-NOVA-02). Cria `VagaApplication` com `source='HUNTER'`, `submittedByHunterId`, `hunterCandidateId` (e `userId` null para fantasma).

## Env (além de DB/JWT/OAuth — ver `.env.example`)
- `FRONTEND_URL` (default `http://localhost:4321`) — usado em redirects OAuth e **links de e-mail**.
- `RESEND_API_KEY` (opcional) — sem ela, `MailService` fica em modo STUB. `MAIL_FROM` (default `VitrinePro <onboarding@resend.dev>`).

## Dívidas conhecidas (ver PLANO §BACKEND para a lista completa)
- **B14** ✅ (backend): módulo `mail` (Resend) feito; consentimento de B3, reset de senha (B2) e convite de time (B7) já usam envio real. Domínio `send.v8pro.com.br` verificado em prod.
- **B2** ✅ (backend+front, validado E2E 2026-07-05): reset de senha real ligado (ver §Endpoints/auth). Andres recebeu o e-mail e redefiniu a senha da conta de teste de verdade — fluxo completo confirmado.
- **B7** ✅ (backend+front): convite por token real ligado (ver §Endpoints/companies·teams). Falta: validar E2E completo com uma conta de plano TEAM/ENTERPRISE (não existe em `qa-test-accounts.json` ainda) — Andres precisa criar o convite e aceitar logado.
- **B6** ✅ (backend+front, validado E2E 2026-07-06): página pública de empresa ligada (ver §Endpoints/profile). 404 e caminho feliz confirmados com conta real (`andresempresa@getnada.com`).
- **B15**: `listByVaga/updateStatus` exigem `createdById` — abrir para OWNER/MANAGER do time.
- **B16**: remover campos de Serviços legados, `PlanLimitGuard` morto, enums deprecados.

## ⚠️ Ambiente de dev/validação (sandbox do Claude) — evita re-derivar
Estas restrições já foram descobertas à força; **ler antes de tentar rodar/validar de novo**:
- **O sandbox Linux do Claude NÃO alcança a DB** (Neon, DNS bloqueado: `EAI_AGAIN`) nem sobe os servers de forma útil. Migrations/seed/backend rodam **na máquina do Andres**, não aqui.
- **`node_modules` do front foi instalado no Windows** → binários nativos (`oxc-parser`) não carregam no sandbox Linux → **`nuxt typecheck`/`dev` não rodam no sandbox**. `npx tsc --noEmit` do **backend** roda (deps compatíveis).
- **O mount de bash serve versão OBSOLETA/truncada de arquivos editados pelas file-tools (Read/Write/Edit).** A verdade é o host (via Read tool). Para um `tsc` limpo no sandbox, **re-escrever o arquivo via bash `cat > arquivo <<'EOF'`** para sincronizar; erros tipo "Invalid character"/"Unterminated"/"Declaration expected" num arquivo recém-editado costumam ser esse artefato, não bug real. Confirmação definitiva = `npm run build` na máquina do Andres.
- **Validação E2E é no navegador (Chrome MCP) contra os servers locais do Andres.** Claude **não digita senhas nem cria contas** (política) — o Andres faz login/cadastro; o **JWT vive em cookie**, então sobrevive a restart dos servers. Contas de teste em `../qa-test-accounts.json` (classificadas por role).
- **Truque p/ validar consentimento (B3) sem caixa de e-mail:** em dev o token sai no console (`[dev] consentToken:`) e/ou usa-se `javascript_tool` no Chrome para `POST /public/candidate-consent/:token {decision:'GRANTED'}` (simula o clique do candidato). Fluxo E2E já validado 1x: cadastrar candidato → pedir consentimento → conceder → publicar vaga (checkbox "Aceitar hunters") → submeter (3 passos) → 201; reenvio → 409 (RN-NOVA-02).
- **Chrome MCP bloqueia navegação para domínios de caixa de e-mail temporária** (`inboxes.com`, `getnada.com`) — "Navigation to this domain is not allowed"/"Permission denied". Não dá pra abrir a caixa de e-mail para conferir visualmente o template a partir daqui; Andres precisa checar a caixa manualmente (ou aprovar o domínio no Chrome) quando precisar ver o e-mail renderizado. `localhost:4321`/`:3000` funcionam normalmente.
- **B2 validado E2E completo (2026-07-05):** `POST /auth/forgot-password` disparado de verdade pela UI (`testeia@getnada.com`) → e-mail real recebido → Andres redefiniu a senha de verdade pelo link → login com a nova senha OK. Nova senha registrada em `../qa-test-accounts.json`.
- **B7 ainda falta validar E2E completo** — precisa de uma conta com plano TEAM/ENTERPRISE (não existe em `qa-test-accounts.json`) para criar um convite de verdade e aceitar logado como o convidado. `/convite/[token]` renderiza certo para token inválido (404 real do backend, não mock), mas o caminho feliz completo (criar convite → e-mail → aceitar) ainda não foi exercitado ponta a ponta.
- **B6 validado E2E completo (2026-07-06):** conta `isCompany` real (`andresempresa@getnada.com`, username `andreshernandez9975`) confirmou `/empresa/andreshernandez9975` com nome/indústria corretos e estado vazio de vagas. Falta só testar `vagasAbertas` com uma vaga publicada de verdade (sem workspace Empresa ainda).
