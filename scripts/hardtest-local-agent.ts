// LeadOS — Local Agent contract test (Spec §20.2 / §20.11)
// دورة حياة كاملة حية ضد السيرفر: ربط → تسجيل → استطلاع → سند → تسليم → تحكم (إيقاف/استئناف/إبطال).
// سلبيات إلزامية: بدون جلسة 401، سر خاطئ 401، جهاز مجهول 401، إبطال → 403 + إفشال الجاري.
import { db } from "../src/lib/db"
import { createLocalTask } from "../src/lib/agent/local"

const BASE = process.env.BASE_URL || "http://localhost:3000"
const EMAIL = "admin@leados.com"
const PASSWORD = "admin123"
let pass = 0, fail = 0
function ok(name: string) { pass++; console.log(`  ✅ ${name}`) }
function bad(name: string, extra = "") { fail++; console.log(`  ❌ ${name} ${extra}`) }
function expect(name: string, cond: boolean, extra = "") { cond ? ok(name) : bad(name, extra) }

async function api(pathname: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${pathname}`, init)
  let data: Record<string, unknown> = {}
  try { data = await res.json() } catch { /* HTML */ }
  return { status: res.status, data, cookies: res.headers.getSetCookie?.() ?? [] }
}

async function main() {
  console.log("═══ Local Agent contract — دورة حياة كاملة ═══")

  // تنظيف بقايا جوبات محلية قديمة (درس BATCH-004: نظّف الطابور قبل الاختبار)
  const del = await db.job.deleteMany({ where: { type: "LOCAL_BROWSER_TASK" } })
  if (del.count) console.log(`  (تنظيف ${del.count} جوب محلي قديم)`)

  // 1) الدخول
  const login = await api("/api/auth/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  expect("login 200", login.status === 200)
  const cookie = (login.data as { cookie?: string }).cookie ?? login.cookies.map((c) => c.split(";")[0]).join("; ")
  const CJ = { cookie, "content-type": "application/json" }

  // 2) N: pair بلا جلسة
  const noAuth = await api("/api/agent/local/pair", { method: "POST" })
  expect("pair بدون جلسة → 401", noAuth.status === 401, `got ${noAuth.status}`)

  // 3) pair بجلسة
  const pair = await api("/api/agent/local/pair", { method: "POST", headers: CJ })
  expect("pair 200 + secret مرة واحدة", pair.status === 200 && typeof (pair.data as { bindingSecret?: string }).bindingSecret === "string")
  const { deviceId, bindingSecret: SECRET } = pair.data as { deviceId: string; bindingSecret: string }

  // 4) N: register بسر خاطئ
  const wrong = await api("/api/agent/local/register", {
    method: "POST", headers: { "content-type": "application/json", "x-leados-device": deviceId, "x-leados-binding": "deadbeef".repeat(8) },
    body: JSON.stringify({ browser: "test", os: "linux" }),
  })
  expect("register بسر خاطئ → 401", wrong.status === 401, `got ${wrong.status}`)

  // 5) N: register بجهاز مجهول
  const unknownDev = await api("/api/agent/local/register", {
    method: "POST", headers: { "content-type": "application/json", "x-leados-device": "nonexistent-id", "x-leados-binding": SECRET },
    body: "{}",
  })
  expect("register بجهاز مجهول → 401", unknownDev.status === 401, `got ${unknownDev.status}`)

  // 6) register صحيح
  const reg = await api("/api/agent/local/register", {
    method: "POST", headers: { "content-type": "application/json", "x-leados-device": deviceId, "x-leados-binding": SECRET },
    body: JSON.stringify({ browser: "Chrome 140 (contract-test)", os: "Linux sandbox", extVersion: "1.0.0" }),
  })
  expect("register → ACTIVE", reg.status === 200 && (reg.data as { status?: string }).status === "ACTIVE")

  // 7) استطلاع فارغ
  const pollEmpty = await api("/api/agent/local/poll", {
    method: "POST", headers: { "x-leados-device": deviceId, "x-leados-binding": SECRET }, body: "{}",
  })
  expect("poll فارغ → empty:true", pollEmpty.status === 200 && (pollEmpty.data as { empty?: boolean }).empty === true)

  // 8) مهمة حقيقية في الطابور الموحد
  const ws = await db.workspace.findFirstOrThrow({ select: { id: true } })
  const t1 = await createLocalTask({ workspaceId: ws.id, platform: "FACEBOOK", action: "PUBLIC_OPEN", url: "https://example.com/la-t1", note: "عقد العامل المحلي T1" })
  const pollTask = await api("/api/agent/local/poll", {
    method: "POST", headers: { "x-leados-device": deviceId, "x-leados-binding": SECRET }, body: "{}",
  })
  const got = (pollTask.data as { task?: { id: string; payload?: Record<string, unknown> } }).task
  expect("poll يسند المهمة (lease)", pollTask.status === 200 && got?.id === t1.jobId)
  expect("الحمولة عامة بلا أسرار", JSON.stringify(got?.payload ?? {}).includes("PUBLIC_OPEN"))

  // 9) تسليم النتيجة
  const done = await api("/api/agent/local/complete", {
    method: "POST", headers: { "x-leados-device": deviceId, "x-leados-binding": SECRET, "content-type": "application/json" },
    body: JSON.stringify({ jobId: t1.jobId, ok: true, result: { pageTitle: "Example Domain" } }),
  })
  expect("complete 200", done.status === 200)
  const j1 = await db.job.findUnique({ where: { id: t1.jobId } })
  expect("المهمة SUCCESS في الطابور", j1?.status === "SUCCESS")

  // 10) نبضة + إحصاء
  const hb = await api("/api/agent/local/heartbeat", {
    method: "POST", headers: { "x-leados-device": deviceId, "x-leados-binding": SECRET }, body: "{}",
  })
  expect("heartbeat يعود بـqueue stats", hb.status === 200 && typeof (hb.data as { queue?: unknown }).queue === "object")

  // 11) إيقاف مؤقت → لا سند
  await api("/api/agent/local/control", { method: "POST", headers: CJ, body: JSON.stringify({ action: "PAUSE" }) })
  const pollPaused = await api("/api/agent/local/poll", {
    method: "POST", headers: { "x-leados-device": deviceId, "x-leados-binding": SECRET }, body: "{}",
  })
  expect("PAUSED → poll paused:true", (pollPaused.data as { paused?: boolean }).paused === true)

  // 12) استئناف → مهمة تانية RUNNING ثم REVOKE يفشلها
  await api("/api/agent/local/control", { method: "POST", headers: CJ, body: JSON.stringify({ action: "RESUME" }) })
  const t2 = await createLocalTask({ workspaceId: ws.id, platform: "X", action: "PUBLIC_OPEN", url: "https://example.com/la-t2" })
  const poll2 = await api("/api/agent/local/poll", {
    method: "POST", headers: { "x-leados-device": deviceId, "x-leados-binding": SECRET }, body: "{}",
  })
  expect("بعد RESUME يسند مجددًا", (poll2.data as { task?: { id: string } }).task?.id === t2.jobId)
  const revoke = await api("/api/agent/local/control", { method: "POST", headers: CJ, body: JSON.stringify({ action: "REVOKE", reason: "عقد الاختبار" }) })
  expect("REVOKE يفشل الجاري", revoke.status === 200 && (revoke.data as { abortedRunningTasks?: number }).abortedRunningTasks === 1)
  const j2 = await db.job.findUnique({ where: { id: t2.jobId } })
  expect("الجاري أُفشل بأمان", j2?.status === "FAILED" && (j2?.errorMessage ?? "").includes("REVOKE"))

  // 13) N: بعد الإبطال السر ميت
  const afterRevoke = await api("/api/agent/local/poll", {
    method: "POST", headers: { "x-leados-device": deviceId, "x-leados-binding": SECRET }, body: "{}",
  })
  expect("بعد REVOKE → 403", afterRevoke.status === 403, `got ${afterRevoke.status}`)

  // 14) الحالة من اللوحة + دوران الربط (rebind يصدر سرًا جديدًا)
  const st1 = await api("/api/agent/local/status", { headers: { cookie } })
  expect("status → REVOKED", (st1.data as { connectionState?: string }).connectionState === "REVOKED")
  const rebind = await api("/api/agent/local/pair", { method: "POST", headers: CJ })
  expect("rebind (دوران سر) 200", rebind.status === 200 && typeof (rebind.data as { bindingSecret?: string }).bindingSecret === "string" && (rebind.data as { rebind?: boolean }).rebind === true)
  const oldDead = await api("/api/agent/local/register", {
    method: "POST", headers: { "content-type": "application/json", "x-leados-device": deviceId, "x-leados-binding": SECRET }, body: "{}",
  })
  expect("السر القديم ميت بعد الدوران → 401", oldDead.status === 401, `got ${oldDead.status}`)

  // تنظيف المهمة المفشلة الاختبارية؟ تبقى كسجل أثر حي — لا حذف (دليل). نجاح؟
  console.log(`═══ النتيجة: نجاح=${pass} فشل=${fail} ═══`)
  await db.$disconnect()
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error("FATAL", e); process.exit(1) })
