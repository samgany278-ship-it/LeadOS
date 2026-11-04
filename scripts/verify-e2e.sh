#!/usr/bin/env bash
# LeadOS — فحص شامل end-to-end في جلسة واحدة (السيرفر بيشتغل وبيتفحص ويقفل)
# يغطي: صفحات UI الرئيسية + مصادقة + API + فحص AI الحي (ping + تصنيف حقيقي)
set -u
cd "$(dirname "${BASH_SOURCE[0]}")/.."
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✅ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ❌ $1"; }
probe() { # probe <name> <path> <expected_code> [cookie_file]
  local name="$1" path="$2" want="$3" cj="${4:-}"
  local code
  if [ -n "$cj" ]; then
    code=$(curl -s -o /tmp/probe.out -w "%{http_code}" -b "$cj" --max-time 30 "http://localhost:3000$path")
  else
    code=$(curl -s -o /tmp/probe.out -w "%{http_code}" --max-time 30 "http://localhost:3000$path")
  fi
  if [ "$code" = "$want" ]; then ok "$name → $code"; else bad "$name → $code (متوقع $want): $(head -c 100 /tmp/probe.out | tr '\n' ' ')"; fi
}

echo "═══ 1) تشغيل السيرفر ═══"
export DATABASE_URL="file:$PWD/db/custom.db"
NODE_OPTIONS="--max-old-space-size=1024" nohup bun run dev > /tmp/verify-dev.log 2>&1 &
DEVPID=$!
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:3000/ 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 1
done
if [ "$code" = "200" ]; then ok "dev server ready on :3000"; else bad "dev server didn't start"; tail -10 /tmp/verify-dev.log; exit 1; fi

echo "═══ 2) صفحات الواجهة ═══"
probe "الصفحة الرئيسية /" "/" 200
probe "تسجيل الدخول /login" "/login" 200

echo "═══ 3) المصادقة end-to-end ═══"
rm -f /tmp/leados-cj.txt
code=$(curl -s -c /tmp/leados-cj.txt -o /tmp/login.out -w "%{http_code}" --max-time 30 -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" -d '{"email":"admin@leados.com","password":"admin123"}')
if [ "$code" = "200" ]; then ok "login admin@leados.com → 200"; else bad "login → $code: $(head -c 120 /tmp/login.out)"; fi
probe "GET /api/me (بالكوكي)" "/api/me" 200 /tmp/leados-cj.txt
WS_NAME=$(python3 -c "import json;d=json.load(open('/tmp/probe.out'));print(d.get('workspaces',[{}])[0].get('name','?') if d.get('workspaces') else d.get('workspace',{}).get('name','?'))" 2>/dev/null || echo "?")
echo "      workspace: $WS_NAME"

echo "═══ 4) فحص AI الحي (ping حقيقي + تصنيف ليد حقيقي) ═══"
SECRET=$(grep '^CRON_SECRET=' .env | cut -d= -f2)
curl -s --max-time 150 "http://localhost:3000/api/ai-check?secret=$SECRET" > /tmp/aicheck.json
if python3 - <<'PYEOF'
import json
d = json.load(open('/tmp/aicheck.json'))
env = d.get("envProbe", {})
ping = d.get("ping", {})
cls = d.get("classify") or {}
print(f'  envProbe: dahlKey={env.get("dahlKeyInEnv")} nvidiaKey={env.get("nvidiaKeyInEnv")}')
print(f'  dahl pool: {d.get("dahl")}')
print(f'  nvidia pool: {d.get("nvidiaKeys")}')
print(f'  ping: ok={ping.get("ok")} provider={ping.get("provider")} model={ping.get("model")} latency={ping.get("latencyMs")}ms text="{str(ping.get("text",""))[:30]}"')
print(f'  classify: engine={cls.get("engine")} is_lead={cls.get("is_lead")} score={cls.get("score")} intent={cls.get("intent")}')
print(f'  reason: {str(cls.get("reason",""))[:70]}')
assert env.get("dahlKeyInEnv"), "مفتاح dahl مش ظاهر للسيرفر (NVIDIA اختياري — مش موجود في البيئة دي)"
assert ping.get("ok"), "AI ping فشل"
assert cls.get("engine") in ("AI","ai","hybrid","rules+ai"), f"engine غير متوقع: {cls.get('engine')}"
# العقل الحي بيتقاس بـ: مسار AI شغّال + مبرر سليم — الحكم نفسه (ليد/مش ليد) بيقرّره النموذج
# وممكن يختلف بين MiniMax/GLM (تقلب طبيعي موثق في worklog 2026-11-04)
assert cls.get("is_lead") in (True, False), "التصنيف ما رجعش قرار"
assert str(cls.get("reason", "")).strip(), "التصنيف ما رجعش مبرر"
print("AI-E2E-OK")
PYEOF
then ok "AI end-to-end (ping + تصنيف عربي حقيقي)"; else bad "AI end-to-end — راجع التفاصيل فوق"; fi

echo "═══ 5) مسارات API المحمية (بالكوكي) ═══"
for p in /api/me /api/skills; do probe "GET $p" "$p" 200 /tmp/leados-cj.txt; done

echo "═══ 6) الأصول الإبداعية + جلسات المنصات (المكوّنات الجديدة) ═══"
probe "GET /api/platforms/sessions (حالة الكوكيز)" "/api/platforms/sessions" 200 /tmp/leados-cj.txt
code=$(curl -s -b /tmp/leados-cj.txt -o /tmp/assets.out -w "%{http_code}" --max-time 60 "http://localhost:3000/api/creative/assets?q=restaurant&limit=2")
if [ "$code" = "200" ]; then
  PROVS=$(python3 -c "import json;d=json.load(open('/tmp/assets.out'));print('،'.join(p['provider']+('='+str(len(p['assets'])) if p['assets'] else '=err') for p in d.get('providers',[])))" 2>/dev/null || echo "?")
  ok "GET /api/creative/assets → 200 — المزودات: $PROVS"
else
  bad "GET /api/creative/assets → $code: $(head -c 120 /tmp/assets.out | tr '\n' ' ')"
fi

echo "═══ 7) البحث الدائم الداخلي (instrumentation tick) ═══"
TICK=""
for i in $(seq 1 30); do
  TICK=$(grep "\[internal-tick\]" /tmp/verify-dev.log | head -1)
  [ -n "$TICK" ] && break
  sleep 7
done
if [ -n "$TICK" ]; then
  ok "النبضة الدائمة شغالة داخل السيرفر: $(echo "$TICK" | head -c 130)"
else
  bad "النبضة الدائمة مظهرتش في اللوج (فاصل النبضة الموثق 3 دقايق — استنى 210 ثانية)"
fi

kill $DEVPID 2>/dev/null; pkill -f "next dev" 2>/dev/null; pkill -f next-server 2>/dev/null; sleep 1
echo ""
echo "═══ النتيجة: نجاح=$PASS فشل=$FAIL ═══"
[ $FAIL -eq 0 ] && echo "ALL-GREEN" || echo "HAS-FAILURES"
