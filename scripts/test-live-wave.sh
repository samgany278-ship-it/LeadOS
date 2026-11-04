#!/usr/bin/env bash
# اختبار الموجة الحية الكاملة: سيرفر + /api/skills (19 مهارة) + tick شامل + فحص النتائج
set -u
cd "$(dirname "${BASH_SOURCE[0]}")/.."
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✅ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ❌ $1"; }

echo "═══ 1) إقلاع السيرفر ═══"
NODE_OPTIONS="--max-old-space-size=1024" nohup bun run dev > /tmp/wave-dev.log 2>&1 &
DEVPID=$!
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:3000/ 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 1
done
[ "$code" = "200" ] && ok "dev server ready" || { bad "server didn't start"; tail -10 /tmp/wave-dev.log; exit 1; }

echo "═══ 2) عقل المهارات /api/skills ═══"
SECRET=$(grep '^CRON_SECRET=' .env | cut -d= -f2)
curl -s --max-time 30 "http://localhost:3000/api/skills?secret=$SECRET" > /tmp/skills.json 2>/dev/null || curl -s --max-time 30 "http://localhost:3000/api/skills" > /tmp/skills.json
python3 - <<'PYEOF'
import json
d = json.load(open('/tmp/skills.json'))
def walk(x, key):
    if isinstance(x, dict):
        for k, v in x.items():
            if k == key: return v
            r = walk(v, key)
            if r is not None: return r
    if isinstance(x, list):
        for it in x:
            r = walk(it, key)
            if r is not None: return r
    return None
skills = walk(d, 'skills') or d.get('catalog') or []
if isinstance(skills, dict): skills = skills.get('list', [])
print(f"  skills structure keys: {list(d.keys())[:8]}")
print(f"  SKILLS COUNT: {len(skills) if isinstance(skills, list) else '؟'}")
if isinstance(skills, list) and skills:
    names = [s.get('platform', '?') for s in skills[:6]]
    print(f"  first platforms: {names}")
PYEOF

echo "═══ 3) الموجة الشاملة الحية (full sweep) ═══"
curl -s --max-time 20 "http://localhost:3000/api/cron/tick?secret=$SECRET&full=1&max=1" > /tmp/tick.json
cat /tmp/tick.json | head -c 300; echo ""
echo "  (الشغل بيكمل في الخلفية — استنى 100 ثانية)"
sleep 100

echo "═══ 4) فحص نتائج الموجة من القاعدة ═══"
bun run /tmp/check-wave.ts 2>/dev/null || bun -e '
import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()
const now = Date.now()
const jobs = await db.searchJob.findMany({ orderBy: { id: "desc" }, take: 3 })
console.log("آخر جوبات:", jobs.map(j => ({ id: j.id, status: j.status, type: j.jobType, found: j.foundCount, meta: j.metadata ? JSON.stringify(j.metadata).slice(0, 200) : null })))
const leads = await db.lead.count()
const recentLeads = await db.lead.findMany({ orderBy: { id: "desc" }, take: 5, select: { id: true, name: true, sourcePlatform: true, intentSignal: true, score: true } })
console.log("إجمالي الليدز:", leads)
console.log("آخر 5 ليدز:", recentLeads)
const aiRuns = await db.aiRun.count()
console.log("AiRun total:", aiRuns)
await db.$disconnect()
'

kill $DEVPID 2>/dev/null; pkill -f "next dev" 2>/dev/null; pkill -f next-server 2>/dev/null
echo "═══ النتيجة: نجاح=$PASS فشل=$FAIL ═══"
