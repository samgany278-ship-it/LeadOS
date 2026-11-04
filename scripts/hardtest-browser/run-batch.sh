#!/bin/bash
# LeadOS — تشغيل دفعة اختبارات hardtest-browser مع سيرفر حي داخل نفس الجلسة
# الاستخدام: bash scripts/hardtest-browser/run-batch.sh t1-affinity t2-session-continuity ...
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

# سيرفر مؤقت داخل نفس النداء (الساندبوكس يقتل العمليات بين النداءات)
bun run scripts/backup-db.ts --startup >/dev/null 2>&1 || true
npx next dev --webpack -p 3000 >/tmp/batch-server.log 2>&1 &
SRV=$!
for i in $(seq 1 30); do
  C=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ --max-time 5 2>/dev/null)
  [ "$C" = "200" ] && break
  sleep 2
done
echo "── server ready (attempt $i, code $C) ──"

FAIL=0; PASS=0
for t in "$@"; do
  echo "════▶ $t"
  timeout 240 bun run "scripts/hardtest-browser/$t.ts" 2>&1 | grep -E "✅|❌|SEEDED|fatal|refused" | sed 's/^/  /'
done

kill $SRV 2>/dev/null; pkill -f "next dev" 2>/dev/null; pkill -f "next-server" 2>/dev/null
echo "── batch done ──"
