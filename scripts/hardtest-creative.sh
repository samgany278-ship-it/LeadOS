#!/usr/bin/env bash
# LeadOS — اختبار Creative (FFmpeg) في جلسة واحدة
set -u
cd "$(dirname "${BASH_SOURCE[0]}")/.."
NODE_OPTIONS="--max-old-space-size=1024" nohup bun run dev > /tmp/creative-dev.log 2>&1 &
DEVPID=$!
code="000"
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:3000/ 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 1
done
if [ "$code" != "200" ]; then echo "❌ السيرفر ما اشتغلش"; tail -5 /tmp/creative-dev.log; kill $DEVPID 2>/dev/null; exit 1; fi
echo "  ✅ dev server ready"
bun scripts/hardtest-creative.ts
RC=$?
kill $DEVPID 2>/dev/null
wait $DEVPID 2>/dev/null
exit $RC
