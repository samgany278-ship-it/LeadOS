// LeadOS — Creative hardtest (Master-Prompt §8: ملفات حقيقية + تحقق نوع/حجم/جودة + رفض المزيف)
import fs from "fs"
import path from "path"

const BASE = process.env.BASE_URL || "http://localhost:3000"
let pass = 0, fail = 0
const ok = (n: string) => { pass++; console.log(`  ✅ ${n}`) }
const bad = (n: string, e = "") => { fail++; console.log(`  ❌ ${n} ${e}`) }
const expect = (n: string, c: boolean, e = "") => (c ? ok(n) : bad(n, e))

async function api(pathname: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${pathname}`, init)
  let data: Record<string, unknown> = {}
  try { data = await res.json() } catch { /* html */ }
  return { status: res.status, data, headers: res.headers }
}

async function main() {
  console.log("═══ Creative FFmpeg — ملفات حقيقية وتحقق صادق ═══")
  const login = await api("/api/auth/login", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "admin@leados.com", password: "admin123" }),
  })
  const setCookie = (login.data as { cookie?: string }).cookie ?? (login as unknown as { headers: Headers }).headers.get("set-cookie") ?? ""
  const cookie = setCookie.split(",")[0].split(";")[0].trim()
  expect("login 200", login.status === 200)

  // 1) رندر شريحتين عربيتين
  const r1 = await api("/api/creative/render", {
    method: "POST", headers: { ...{ cookie }, "content-type": "application/json" },
    body: JSON.stringify({ slides: [{ text: "عرض خاص: موقع لمطعمك في 3 أيام", seconds: 2 }, { text: "Ezz — شركة خدمات رقمية", seconds: 2 }], name: "hardtest-demo" }),
  })
  expect("render 200", r1.status === 200, JSON.stringify(r1.data).slice(0, 200))
  const v = r1.data.verification as { detectedKind?: string; kindMatch?: boolean; sizeBytes?: number } | undefined
  const p = r1.data.probe as { width?: number; height?: number; seconds?: number; codec?: string } | undefined
  expect("magic bytes تقول mp4 (ftyp)", v?.detectedKind === "mp4" && v.kindMatch === true)
  expect("الحجم > 10KB (ملف حقيقي)", (v?.sizeBytes ?? 0) > 10_240, `size=${v?.sizeBytes}`)
  expect("ffprobe: 1280x720 h264", p?.width === 1280 && p?.height === 720 && p?.codec === "h264")
  expect("المدة ≈ 4 ثوانٍ", typeof p?.seconds === "number" && p.seconds >= 3.5 && p.seconds <= 5, `s=${p?.seconds}`)
  const url = r1.data.url as string
  const dl = await fetch(`${BASE}${url}`)
  const buf = Buffer.from(await dl.arrayBuffer())
  expect("الملف يُخدم HTTP 200 بنفس magic", dl.status === 200 && buf.subarray(4, 8).toString("ascii") === "ftyp")

  // 2) رفض المزيف: mp4 مسمى png — verifyMedia يجب أن يكشف الكذب
  const { verifyMedia } = await import("../src/lib/creative/ffmpeg")
  const tmpFake = "/tmp/fake.png"
  fs.writeFileSync(tmpFake, buf) // mp4 bytes بامتداد png
  const verdict = verifyMedia(tmpFake, "png")
  expect("كشف الملف المزيف (mp4 مسمى png)", verdict.detectedKind === "mp4" && verdict.kindMatch === false && !verdict.ok, verdict.note)

  // 3) سلبيات الحدود
  const r2 = await api("/api/creative/render", { method: "POST", headers: { ...{ cookie }, "content-type": "application/json" }, body: JSON.stringify({ slides: Array.from({ length: 7 }, (_, i) => ({ text: `س${i}` })) }) })
  expect("رفض >5 شرائح → 400", r2.status === 400)
  const r3 = await api("/api/creative/render", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slides: [{ text: "بدون جلسة" }] }) })
  expect("بلا جلسة → 401", r3.status === 401)
  const r4 = await api("/api/creative/render", { method: "POST", headers: { ...{ cookie }, "content-type": "application/json" }, body: JSON.stringify({ slides: [{ text: "طويل", seconds: 100 }, { text: "أخرى", seconds: 100 }] }) })
  // سياسة الميزانية الموثقة: المدة تُقص إلى 10 ثوانٍ/شريحة (أقصى 50 إجمالًا) — لا رفض، بل التزام بالحد
  const p4 = r4.data.probe as { seconds?: number } | undefined
  expect("الميزانية: المدة تُقص على 10 ثوانٍ/شريحة (≤50 إجمالًا)", r4.status === 200 && typeof p4?.seconds === "number" && p4.seconds <= 50 && p4.seconds > 0, `got ${r4.status} s=${p4?.seconds}`)

  console.log(`═══ النتيجة: نجاح=${pass} فشل=${fail} ═══`)
  process.exit(fail === 0 ? 0 : 1)
}
main().catch((e) => { console.error("FATAL", e); process.exit(1) })
