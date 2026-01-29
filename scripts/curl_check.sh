#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   AIF_TOKEN="..." ./scripts/curl_check.sh agent_123

BASE_URL="${BASE_URL:-https://aifgateway.fivra.ai}"
TOKEN="${AIF_TOKEN:-}"
AGENT_ID="${1:-}"

if [[ -z "${TOKEN}" ]]; then
  echo "Set AIF_TOKEN env var (service token)" >&2
  exit 1
fi

if [[ -z "${AGENT_ID}" ]]; then
  echo "Pass an agent id, e.g. ./scripts/curl_check.sh agent_..." >&2
  exit 1
fi

curl -sS -X POST "${BASE_URL}/api/agents/check" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"agent_id\":\"${AGENT_ID}\",\"action\":\"retrieve\",\"system\":\"kb\"}" | jq
