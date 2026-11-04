#!/usr/bin/env bash
# LeadOS/Ezz — اختبار صلب للوحدات الأربعة الجديدة (T-036 Decision Lab / T-038 Ezz Web / T-039 Social / T-040 Finance)
# سلوكيات موجبة + سلبية + عدالة القيود (سبك §28/§30/§31/§37) — السيرفر يشتغل ويُختبر ويقفل في جلسة واحدة
set -u
cd "$(dirname "${BASH_SOURCE[0]}")/.."
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✅ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ❌ $1"; }

api() { # api <method> <path> [data] [expect_code] — يستخدم كوكي الجلسة
  local m="$1" p="$2" d="${3:-}" want="${4:-}"
  local args=(-s -o /tmp/ezz-units.out -w "%{http_code}" -b /tmp/ezz-cj.txt --max-time 30 -X "$m" "http://localhost:3000$p")
  [ -n "$d" ] && args+=(-H "Content-Type: application/json" -d "$d")
  local code; code=$(curl "${args[@]}")
  if [ -n "$want" ] && [ "$code" != "$want" ]; then echo "    (HTTP $code متوقع $want): $(head -c 140 /tmp/ezz-units.out | tr '\n' ' ')" >&2; return 1; fi
  echo "$code"
}
api_noauth() { # بدون كوكي — لازم يرد 401
  local m="$1" p="$2" d="${3:-}"
  local args=(-s -o /dev/null -w "%{http_code}" --max-time 30 -X "$m" "http://localhost:3000$p")
  [ -n "$d" ] && args+=(-H "Content-Type: application/json" -d "$d")
  curl "${args[@]}"
}

echo "═══ 1) سيرفر + مصادقة ═══"
nohup bun run dev > /tmp/ezz-units-dev.log 2>&1 &
DEVPID=$!
code=""
for i in $(seq 1 45); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:3000/ 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 1
done
if [ "$code" = "200" ]; then ok "dev server ready"; else bad "dev server didn't start"; tail -8 /tmp/ezz-units-dev.log; kill $DEVPID 2>/dev/null; exit 1; fi
rm -f /tmp/ezz-cj.txt
code=$(curl -s -c /tmp/ezz-cj.txt -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@leados.com","password":"admin123"}')
[ "$code" = "200" ] && ok "login → 200" || { bad "login → $code"; kill $DEVPID 2>/dev/null; exit 1; }

echo "═══ 2) T-040 Finance ═══"
[ "$(api_noauth GET /api/finance)" = "401" ] && ok "بلا جلسة → 401" || bad "بلا جلسة مش 401"
[ "$(api POST /api/finance '{"kind":"BUY","category":"TOOL","title":"x","amount":5}' 400)" = "400" ] && ok "kind غير معروف → 400" || bad "kind غير معروف مش 400"
[ "$(api POST /api/finance '{"kind":"COST","category":"NOPE","title":"x","amount":5}' 400)" = "400" ] && ok "category غير معروفة → 400" || bad "category مش 400"
[ "$(api POST /api/finance '{"kind":"COST","category":"TOOL","title":"x","amount":-3}' 400)" = "400" ] && ok "مبلغ سالب → 400" || bad "مبلغ سالب مش 400"
[ "$(api POST /api/finance '{"kind":"REVENUE","category":"DEAL","title":"بيع بلا صفقة","amount":500}' 400)" = "400" ] && ok "إيراد DEAL بلا صفقة → 400" || bad "إيراد DEAL بلا صفقة مش 400"
[ "$(api POST /api/finance '{"kind":"REVENUE","category":"SERVICE","title":"إيراد تقديري","amount":900,"confidence":"ESTIMATED"}' 400)" = "400" ] && ok "إيراد ESTIMATED مرفوض (§31.2) → 400" || bad "إيراد ESTIMATED مش مرفوض"
api POST /api/finance '{"kind":"COST","category":"TOOL","title":"اشتراك أدوات اختبار","amount":250,"source":"فاتورة #1"}' 201 >/dev/null && ok "قيد مصروف → 201" || bad "قيد مصروف"
api POST /api/finance '{"kind":"REVENUE","category":"SERVICE","title":"دفعة عميل (موثقة)","amount":900,"source":"استحقاق #1"}' 201 >/dev/null && ok "قيد إيراد → 201" || bad "قيد إيراد"
S=$(api GET /api/finance)
echo "$S" | python3 -c "
import json,sys
d=json.load(sys.stdin)
s=d['summary']
assert abs(s['revenue']-900)<0.01, s['revenue']
assert abs(s['cost']-250)<0.01, s['cost']
assert abs(s['profit']-650)<0.01, s['profit']
exp=round((650/900)*100,1)
assert abs(s['marginPct']-exp)<0.2, (s['marginPct'], exp)
assert s['breakdown']['manualCost']==250
print('OK')" 2>/tmp/fin-err >/dev/null && ok "الملخص الحسابي سليم (650=900−250، هامش 72.2%)" || bad "حساب الملخص: $(cat /tmp/fin-err)"

echo "═══ 3) T-036 Decision Lab ═══"
[ "$(api_noauth GET /api/decisions)" = "401" ] && ok "بلا جلسة → 401" || bad "بلا جلسة مش 401"
[ "$(api POST /api/decisions '{"goal":"قرار بلا بدائل","evidence":[{"source":"x"}]}' 400)" = "400" ] && ok "بلا بدائل → 400 (§28.2)" || bad "بلا بدائل مش 400"
[ "$(api POST /api/decisions '{"goal":"بلا أدلة","options":[{"name":"أ"},{"name":"ب"}]}' 400)" = "400" ] && ok "بلا دليل → 400 (§28.2)" || bad "بلا دليل مش 400"
api POST /api/decisions '{"goal":"شراء دومين للبراند","options":[{"name":"شراء من GoDaddy"},{"name":"التأجيل"}],"evidence":[{"source":"تسعيرة رسمية","kind":"OBSERVED"}]}' 201 >/dev/null && python3 -c "import json;d=json.load(open('/tmp/ezz-units.body'));assert d['card']['approvalRequired']==True" 2>/dev/null && ok "قرار عالي الخطورة (شراء دومين) → موافقة مالك إلزامية (§32)" || bad "عالي الخطورة مش متقفل"
api POST /api/decisions '{"goal":"اختيار مزود بحث أساسي للموجة","successMetric":"نتايج/جوب","baseline":{"value":30},"options":[{"name":"Exa includeDomains","cost":"مجاني"},{"name":"z-ai fallback","cost":"مجاني"}],"evidence":[{"source":"AiRun آخر أسبوع","kind":"OBSERVED"}],"unknowns":["استقرار Exa من IP داتا سنتر"]}' 201 >/tmp/ezz-units.out && ok "بطاقة قرار سليمة → 201" || bad "بطاقة سليمة"
DID=$(python3 -c "import json;print(json.load(open('/tmp/ezz-units.out'))['card']['id'])")
[ "$(api PATCH /api/decisions/$DID '{"action":"decide","chosenOption":"غير موجود"}' 400)" = "400" ] && ok "اختيار بديل خارج القايمة → 400" || bad "بديل خارج القايمة مش 400"
[ "$(api PATCH /api/decisions/$DID '{"action":"measure","outcome":{"metric":"نتايج/جوب","value":42}}' 400)" = "400" ] && ok "قياس قبل القرار → 400 (§28.4)" || bad "قياس قبل القرار مش 400"
api PATCH /api/decisions/$DID '{"action":"decide","chosenOption":"Exa includeDomains"}' 200 >/dev/null && ok "اختيار بديل → 200 DECIDED" || bad "اختيار بديل"
[ "$(api PATCH /api/decisions/$DID '{"action":"measure","outcome":{"metric":"نص"}}' 400)" = "400" ] && ok "قياس بلا value رقمي → 400" || bad "قياس بلا رقم مش 400"
api PATCH /api/decisions/$DID '{"action":"measure","outcome":{"metric":"نتايج/جوب","value":42,"baselineValue":30,"note":"قياس حي"}}' 200 >/dev/null && ok "تسجيل نتيجة فعلية → MEASURED" || bad "تسجيل نتيجة"

echo "═══ 4) T-038 Ezz Web ═══"
[ "$(api_noauth GET /api/web)" = "401" ] && ok "بلا جلسة → 401" || bad "بلا جلسة مش 401"
[ "$(api POST /api/web '{"template":"nope","name":"x","data":{"title":"y"}}' 400)" = "400" ] && ok "قالب غير معروف → 400" || bad "قالب غير معروف مش 400"
[ "$(api POST /api/web '{"template":"cafe","name":"x","data":{}}' 400)" = "400" ] && ok "بلا اسم نشاط → 400" || bad "بلا اسم نشاط مش 400"
api POST /api/web '{"template":"cafe","name":"ديمو كافيه اختبار","data":{"title":"كافيه لوز","tagline":"قهوة مختصة","phone":"01000000000","address":"مدينة نصر"}}' 201 >/tmp/ezz-units.out && ok "توليد نموذج → 201" || bad "توليد نموذج"
WID=$(python3 -c "import json;print(json.load(open('/tmp/ezz-units.out'))['draft']['id'])")
python3 -c "
import json
d=json.load(open('/tmp/ezz-units.out'))
assert d['draft']['score']==8, d['draft']['score']
assert d['publishPath'] is None, d['publishPath']
assert 'BLK-011' in d['publishBlocker']
print('OK')" 2>/tmp/web-err >/dev/null && ok "الفحوص 8/8 + مسار النشر صراحة null مع BLK-011" || bad "فحوص النموذج: $(cat /tmp/web-err)"
api GET /api/web/$WID/preview 200 >/dev/null
PREV=$(curl -s -b /tmp/ezz-cj.txt "http://localhost:3000/api/web/$WID/preview")
echo "$PREV" | rg -q 'noindex, nofollow' && ok "المعاينة فيها noindex" || bad "المعاينة من غير noindex"
echo "$PREV" | rg -q 'نموذج تجريبي' && ok "شارة النموذج التجريبي ظاهرة" || bad "شارة النموذج ناقصة"
echo "$PREV" | rg -q 'dir="rtl"' && ok "عربي RTL" || bad "مش RTL"
H=$(curl -s -o /dev/null -w '%{http_code}' -I "http://localhost:3000/api/web/$WID/preview" -D - 2>/dev/null | rg -qi 'X-Robots-Tag' && echo has)
[ -n "$H" ] && ok "هيدر X-Robots-Tag حماية مضاعفة" || bad "X-Robots-Tag ناقص"
api GET /api/web/$WID 200 >/dev/null && ok "تفاصيل النموذج → 200" || bad "تفاصيل النموذج"
api PATCH /api/web/$WID 200 >/dev/null && ok "أرشفة → 200" || bad "أرشفة"

echo "═══ 5) T-039 Social Drafts ═══"
[ "$(api_noauth GET /api/social/drafts)" = "401" ] && ok "بلا جلسة → 401" || bad "بلا جلسة مش 401"
[ "$(api POST /api/social/drafts '{"platform":"SNAP","content":"نص طويل كفاية للاختبار ان شاء الله"}' 400)" = "400" ] && ok "منصة غير معروفة → 400" || bad "منصة غير معروفة مش 400"
[ "$(api POST /api/social/drafts '{"platform":"X","content":"قصير"}' 400)" = "400" ] && ok "محتوى أقصر من 20 حرف → 400" || bad "قصير مش 400"
LONG=$(python3 -c "print('ح'*300)")
[ "$(api POST /api/social/drafts "{\"platform\":\"X\",\"content\":\"$LONG\"}" 201 | python3 -c "
import json,sys
d=json.load(sys.stdin)
checks={c['id']:c for c in d['draft']['policyChecks']}
print('WARN' if checks['length']['level']=='WARN' else 'OK-FAIL')")" = "WARN" ] && ok "محتوى فوق حد X (280) → تحذير سياسة موثق" || bad "فحص حد حروف X"
api POST /api/social/drafts '{"platform":"FACEBOOK","content":"عرض جديد: خصم على الاشتراكات الشهرية لأول 20 عميل — التفاصيل في الرسائل"}' 201 >/tmp/ezz-units.out && ok "مسودة سليمة → 201" || bad "مسودة سليمة"
SID=$(python3 -c "import json;print(json.load(open('/tmp/ezz-units.out'))['draft']['id'])")
python3 -c "
import json
d=json.load(open('/tmp/ezz-units.out'))
assert d['draft']['status']=='DRAFT'
assert d['publishPath'] is None
checks={c['id']:c for c in d['draft']['policyChecks']}
assert 'authorization' in checks and 'send_hours' in checks and 'no_spam' in checks
print('OK')" 2>/tmp/soc-err >/dev/null && ok "بدأت DRAFT + publishPath=null + فحوص السياسة موجودة" || bad "بنية المسودة: $(cat /tmp/soc-err)"
[ "$(api POST /api/social/drafts '{"platform":"FACEBOOK","content":"عرض جديد: خصم على الاشتراكات الشهرية لأول 20 عميل — التفاصيل في الرسائل"}' 409)" = "409" ] && ok "تكرار نفس المحتوى → 409 (anti-ban §6)" || bad "التكرار مش مرفوض"
api PATCH /api/social/drafts/$SID '{"action":"approve"}' 200 >/dev/null && ok "اعتماد → APPROVED" || bad "اعتماد"
[ "$(api PATCH /api/social/drafts/$SID '{"action":"published-manual"}' 400)" = "400" ] && ok "نشر بلا مرجع → 400 (لا ادعاء نشر §30.1.8)" || bad "نشر بلا مرجع مش 400"
api PATCH /api/social/drafts/$SID '{"action":"published-manual","publishedRef":"https://facebook.com/permalink/123"}' 200 >/dev/null && ok "نشر يدوي بمرجع → PUBLISHED_MANUAL" || bad "نشر يدوي"

echo "═══ 6) تنظيف بيانات الاختبار ═══"
api DELETE /api/finance 2>/dev/null >/dev/null
FIN_IDS=$(api GET /api/finance | python3 -c "import json,sys;[print(e['id']) for e in json.load(sys.stdin)['entries'] if 'اختبار' in e['title'] or 'موثقة' in e['title'] or 'بلا صفقة' in e['title']]" 2>/dev/null)
for fid in $FIN_IDS; do api DELETE /api/finance/$fid 200 >/dev/null; done
api DELETE /api/decisions/$DID 200 >/dev/null && ok "بطاقة القرار اتشالت" || bad "حذف بطاقة القرار"
api PATCH /api/web/$WID 200 >/dev/null
api DELETE /api/web/$WID 200 >/dev/null && ok "النموذج اتشال (قابل للحذف §37)" || bad "حذف النموذج"
api DELETE /api/social/drafts/$SID 200 >/dev/null && ok "المسودة اتشالت" || bad "حذف المسودة"

kill $DEVPID 2>/dev/null
wait $DEVPID 2>/dev/null
echo "══════════════════════════════════"
echo "نجاح=$PASS فشل=$FAIL"
[ $FAIL -eq 0 ] && echo "EZZ-UNITS-ALL-GREEN" || echo "EZZ-UNITS-FAILURES"
