---
name: Fase 4 Pipeline Enriquecimento
description: CandidateDrawer extendido com Nota Geral, CandidateProcessHistory, ShareProcessModal, pagina publica /processo/[token] e botao X em VagasSalvas
type: project
---

Backend fase 3 ja disponivel (PATCH /applications/:id/general, PATCH /applications/:id/stage-notes/:stageKey, GET /applications/:id/history, POST/DELETE /applications/:id/share/:token, GET /public/processo/:token, GET /applications/:id/pdf).

**Decisao UX: historico no proprio drawer** (seccao expansivel inline, nao coluna lateral separada) — drawer e 460px e coluna lateral causaria overflow em mobile.

**Arquivos criados/modificados:**
- `src/utils/api.ts` — novos tipos StageHistoryEntry, StageNote, ProcessShareLink, PublicProcessSnapshot; novo objeto `applications` extendido (updateGeneral, updateStageNotes, history, share, revokeShare, pdfUrl) + `publicProcesso.get(token)`
- `src/data/mock-recrutador.ts` — MockCandidate extendido com applicationId?, generalScore?, generalNote?
- `src/components/dashboard/CandidateDrawer.vue` — Nota Geral no header (input number, debounce 800ms, auto-save), anotacao geral collapsible, importa CandidateProcessHistory + ShareProcessModal, botao "Compartilhar" no footer
- `src/components/dashboard/CandidateProcessHistory.vue` — novo; cards expansiveis por etapa, campos observacoes/nota com debounce 800ms via updateStageNotes, timeline de eventos cronologica
- `src/components/dashboard/ShareProcessModal.vue` — novo; selector validade 7/30/90/365 dias, gerar link, copiar, WhatsApp (wa.me/?text=), Baixar PDF, lista links ativos com revogar (ConfirmDialog)
- `src/pages/processo/[token].astro` — nova pagina publica SSR; trata 404/410/500 com mensagens amigaveis; readonly snapshot; @media print; sem botao PDF (requer auth)
- `src/components/profissional/VagasSalvas.vue` — botao X em candidatadas ativado (applications.remove + ConfirmDialog)

**Por que sem botao PDF na pagina publica:** endpoint GET /applications/:id/pdf requer auth JWT; link publico nao tem token. Decisao: omitir e mostrar apenas "Compartilhado por X" + link VitrinePro.

**Why:** Backend fase 3 concluido; frontend precisava fechar o loop de notas/historico/compartilhamento do pipeline para o produto ser utilizavel.
**How to apply:** Ao trabalhar no CandidateDrawer, lembrar que applicationId e campo novo em MockCandidate — populado quando vem da API real, null em mocks.
