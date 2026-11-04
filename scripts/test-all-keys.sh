#!/usr/bin/env bash
# اختبار حي لكل مفاتيح dahl و NVIDIA الموجودة في .env — نداء صغير max_tokens=8
set -u
cd "$(dirname "${BASH_SOURCE[0]}")/.."

DAHL_BASE="https://inference.dahl.global/v1"
NIM_BASE="https://integrate.api.nvidia.com/v1"

echo "=== dahl keys (11) — model: deepseek-ai/DeepSeek-V4-Flash-0731 ==="
i=0
while IFS='=' read -r name val; do
  case "$name" in
    DAHL_API_KEY|DAHL_API_KEY_*)
      i=$((i+1))
      code=$(curl -s -o /tmp/dahl_out.json -w "%{http_code}" --max-time 45 \
        -X POST "$DAHL_BASE/chat/completions" \
        -H "Authorization: Bearer $val" -H "Content-Type: application/json" \
        -d '{"model":"deepseek-ai/DeepSeek-V4-Flash-0731","messages":[{"role":"user","content":"قل: تمام"}],"max_tokens":8}')
      if [ "$code" = "200" ]; then
        echo "OK   $name (${#val} chars) -> 200"
      else
        msg=$(head -c 160 /tmp/dahl_out.json | tr '\n' ' ')
        echo "FAIL $name -> HTTP $code : $msg"
      fi
      ;;
  esac
done < <(grep -E '^(DAHL_API_KEY(_[0-9]+)?)=' .env)

echo ""
echo "=== NVIDIA keys — model: z-ai/glm-5.3-flash (deepseek-v4-flash وصل EOL على NIM — 410، موثق BATCH-003) ==="
j=0
while IFS='=' read -r name val; do
  case "$name" in
    NVIDIA_API_KEY|NVIDIA_API_KEY_*)
      j=$((j+1))
      code=$(curl -s -o /tmp/nim_out.json -w "%{http_code}" --max-time 45 \
        -X POST "$NIM_BASE/chat/completions" \
        -H "Authorization: Bearer $val" -H "Content-Type: application/json" \
        -d '{"model":"z-ai/glm-5.3-flash","messages":[{"role":"user","content":"say ok"}],"max_tokens":8}')
      if [ "$code" = "200" ]; then
        echo "OK   $name (${#val} chars) -> 200"
      else
        msg=$(head -c 160 /tmp/nim_out.json | tr '\n' ' ')
        echo "FAIL $name -> HTTP $code : $msg"
      fi
      ;;
  esac
done < <(grep -E '^(NVIDIA_API_KEY(_[0-9]+)?)=' .env)
