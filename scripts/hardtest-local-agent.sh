#!/usr/bin/env bash
# LeadOS — اختبار عقد العامل المحلي في جلسة واحدة (سيرفر يشتغل ويُفحص ويُقفل)
set -u
cd "$(dirname "${BASH_SOURCE[0]}")/.."
echo "═══ تشغيل السيرفر ═══"
NODE_OPTIONS="--max-old-space-size=1024" nohup bun run dev > /tmp/local-agent-dev.log 2>&1 &
DEVPID=$!
code="000"
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:3000/ 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 1
done
if [ "$code" != "200" ]; then echo "❌ السيرفر ما اشتغلش"; tail -5 /tmp/local-agent-dev.log; kill $DEVPID 2>/dev/null; exit 1; fi
echo "  ✅ dev server ready"
echo "═══ تنفيذ اختبار العقد ═══"
bun scripts/hardtest-local-agent.ts
RC=$?
kill $DEVPID 2>/dev/null
wait $DEVPID 2>/dev/null
exit $RC
