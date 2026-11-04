#!/usr/bin/env bash
# LeadOS — مشرف موجات المتصفح الدورية («شغالة زي الساعة» — طلب المالك 2026-11-04)
# كل WAVE_MIN دقيقة: زرع موجة PUBLIC_FETCH بدوران روابط → تشغيل runner لكل منصة عليها طابور
# النتيجة: اسكرينات إثبات في public/proof/<platform>/ + manifest.jsonl
# يقف بأمان: pkill -f proof-wave-supervisor.sh
set -u
cd "$(dirname "${BASH_SOURCE[0]}")/.."
export DATABASE_URL="file:$PWD/db/custom.db"
export LEADOS_ACTIVE_HOURS_247="${LEADOS_ACTIVE_HOURS_247:-1}"
SECRET=$(grep '^CRON_SECRET=' .env.local | cut -d= -f2)
WAVE_MIN="${WAVE_MIN:-15}"
LOG="/tmp/proof-supervisor.log"

log() { echo "[$(TZ=Africa/Cairo date '+%H:%M:%S')] $*" >> "$LOG"; }

log "🚀 المشرف بدأ — موجة كل ${WAVE_MIN} دقيقة"

while true; do
  log "═══ موجة جديدة ═══"
  SEED_OUT=$(timeout 120 bun run scripts/seed-browser-wave.ts 2>&1 | tail -3)
  log "بذرة: $SEED_OUT"

  # منصات عليها جوبات QUEUED — runner واحد لكل منصة (§1 متصفح واحد = منصة واحدة)
  PLATFORMS=$(python3 - <<'PY'
import sqlite3, json
c = sqlite3.connect("db/custom.db")
seen = []
for (p,) in c.execute("select payload from Job where type='BROWSER_SCAN' and status in ('QUEUED','RETRYING')").fetchall():
    try: plat = (json.loads(p) or {}).get("platform", "?")
    except Exception: plat = "?"
    if plat not in seen: seen.append(plat)
print(" ".join(seen))
PY
)
  log "منصات عليها طابور: $PLATFORMS"
  for P in $PLATFORMS; do
    log "runner $P → بدأ"
    LEADOS_BASE_URL=http://localhost:3000 LEADOS_RUNNER_SECRET="$SECRET" \
      LEADOS_PLATFORM="$P" LEADOS_RUNNER_ID="runner-$P-$(date +%s)" \
      timeout 900 bun scripts/browser-runtime/runner.mjs > "/tmp/runners/$P-$(date +%H%M).log" 2>&1
    log "runner $P → خلص (rc=$?)"
    sleep 5
  done

  PROOFS=$(find public/proof -name "*.jpg" 2>/dev/null | wc -l)
  log "📸 اسكرينات الإثبات المجمعة: $PROOFS"
  sleep $((WAVE_MIN * 60))
done
