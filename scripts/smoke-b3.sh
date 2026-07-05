#!/usr/bin/env bash
#
# Smoke-test do B3 — pool de candidatos do hunter + submissão.
# Requisitos: backend rodando (npm run start:dev), `curl` e `jq`.
#
# Uso:
#   API=http://localhost:3000 \
#   EMAIL=hunter@teste.com PASS=senha123 \
#   VAGA_ID=<uuid-de-uma-vaga-PUBLISHED-com-allowHunters=true> \
#   bash scripts/smoke-b3.sh
#
set -euo pipefail

API="${API:-http://localhost:3000}"
EMAIL="${EMAIL:?defina EMAIL do hunter}"
PASS="${PASS:?defina PASS}"
VAGA_ID="${VAGA_ID:?defina VAGA_ID (vaga PUBLISHED com allowHunters=true)}"
RND="$RANDOM"
CAND_EMAIL="candidato+${RND}@teste.com"

echo "▶ 1. Login"
TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | jq -r '.access_token // .token')
[ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] && echo "  ✔ token ok" || { echo "  ✗ login falhou"; exit 1; }
AUTH=(-H "Authorization: Bearer $TOKEN")

echo "▶ 2. Criar candidato no pool ($CAND_EMAIL)"
CID=$(curl -s -X POST "$API/hunter-candidates" "${AUTH[@]}" \
  -H 'Content-Type: application/json' \
  -d "{\"fullName\":\"Candidato Teste\",\"email\":\"$CAND_EMAIL\",\"headline\":\"Dev Pleno\"}" | jq -r '.id')
echo "  ✔ candidato $CID"

echo "▶ 3. Submeter SEM consentimento (espera 400)"
curl -s -o /dev/null -w "  → HTTP %{http_code} (esperado 400)\n" \
  -X POST "$API/vagas/$VAGA_ID/submissions" "${AUTH[@]}" \
  -H 'Content-Type: application/json' -d "{\"hunterCandidateId\":\"$CID\"}"

echo "▶ 4. Solicitar consentimento (retorna token em dev)"
CTOKEN=$(curl -s -X POST "$API/hunter-candidates/$CID/request-consent" "${AUTH[@]}" | jq -r '.consentToken')
echo "  ✔ consentToken $CTOKEN"

echo "▶ 5. Conceder consentimento (endpoint público)"
curl -s -o /dev/null -w "  → HTTP %{http_code} (esperado 200)\n" \
  -X POST "$API/public/candidate-consent/$CTOKEN" \
  -H 'Content-Type: application/json' -d '{"decision":"GRANTED"}'

echo "▶ 6. Submeter COM consentimento (espera 201)"
curl -s -o /dev/null -w "  → HTTP %{http_code} (esperado 201)\n" \
  -X POST "$API/vagas/$VAGA_ID/submissions" "${AUTH[@]}" \
  -H 'Content-Type: application/json' -d "{\"hunterCandidateId\":\"$CID\",\"message\":\"Ótimo perfil\"}"

echo "▶ 7. Submeter DE NOVO o mesmo (espera 409 — trava 90d)"
curl -s -o /dev/null -w "  → HTTP %{http_code} (esperado 409)\n" \
  -X POST "$API/vagas/$VAGA_ID/submissions" "${AUTH[@]}" \
  -H 'Content-Type: application/json' -d "{\"hunterCandidateId\":\"$CID\"}"

echo "▶ 8. Listar minhas submissões"
curl -s "$API/hunter-candidates/submissions" "${AUTH[@]}" \
  | jq -r 'if type=="array" then "  ✔ \(length) submissão(ões)" else . end'

echo "✅ Smoke-test B3 concluído."
