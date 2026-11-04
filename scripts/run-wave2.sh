#!/usr/bin/env bash
# موجة تحقق ثانية: سيرفر + full sweep + فحص أن الإصلاحين اشتغلوا (عناوين مشتقة + ليد المستقل)
set -u
cd "$(dirname "${BASH_SOURCE[0]}")/.."
echo "═══ إقلاع السيرفر ═══"
NODE_OPTIONS="--max-old-space-size=1024" nohup bun run dev > /tmp/wave2-dev.log 2>&1 &
DEVPID=$!
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:3000/ 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 1
done
[ "$code" = "200" ] && echo "  ✅ dev server ready" || { echo "  ❌ server didn't start"; tail -10 /tmp/wave2-dev.log; exit 1; }

SECRET=$(grep '^CRON_SECRET=' .env | cut -d= -f2)
echo "═══ موجة شاملة (full sweep) ═══"
curl -s --max-time 20 "http://localhost:3000/api/cron/tick?secret=$SECRET&full=1&max=1" | head -c 200; echo ""
echo "  (الشغل في الخلفية — انتظار 120 ثانية)"
sleep 120
kill $DEVPID 2>/dev/null; pkill -f "next dev" 2>/dev/null; pkill -f next-server 2>/dev/null
echo "═══ فحص النتائج ═══"
