// LeadOS — Creative: مسار FFmpeg البرمجي (Spec §26: «بدائل واحتياطي FFmpeg/قوالب»)
// يولّد فيديو MP4 حقيقي من شرائح نصية — والتحقق من النوع والجودة بالبايتات لا بالاسم:
// «عدم وصف ملف SVG أو غيره بأنه PNG مزيف» (Master-Prompt §8) — النوع يُستنتج من magic bytes دائمًا.
import { spawn } from "child_process"
import fs from "fs"
import path from "path"
import crypto from "crypto"

export const CREATIVE_DIR = path.join(process.cwd(), "public", "creative")
const FONT = process.env.CREATIVE_FONT || "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
export const MAX_SLIDES = 5
export const MAX_TOTAL_SECONDS = 60

export type Slide = { text: string; seconds?: number; bg?: string; /** صورة الشريحة: مسار /creative/... أو ملف مطلق — صورة ستوك أو مولدة AI (Spec §26.4) */ image?: string }
export type MediaVerification = {
  ok: boolean
  declaredKind: string
  detectedKind: "mp4" | "png" | "jpg" | "webm" | "unknown"
  mimeType: string
  sizeBytes: number
  kindMatch: boolean
  note: string
}

/** كشف النوع من magic bytes — مصدر الحقيقة الوحيد للنوع (لا الثقة في الامتداد) */
export function detectKind(buf: Buffer): MediaVerification["detectedKind"] {
  if (buf.length > 11 && buf.subarray(4, 8).toString("ascii") === "ftyp") return "mp4"
  if (buf.length > 7 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png"
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg"
  if (buf.length > 15 && buf.subarray(0, 4).toString("ascii") === "\x1a\x45\xdf\xa3") return "webm"
  return "unknown"
}

/** تحقق كامل: النوع المكتشف مقابل المعلن + الحجم — صادق ولا يلفّق نوعًا */
export function verifyMedia(filePath: string, declaredKind: string): MediaVerification {
  const st = fs.existsSync(filePath) ? fs.statSync(filePath) : null
  const sizeBytes = st?.size ?? 0
  const head = fs.existsSync(filePath) ? fs.readFileSync(filePath).subarray(0, 64) : Buffer.alloc(0)
  const detectedKind = detectKind(head)
  const mimeMap: Record<string, string> = { mp4: "video/mp4", png: "image/png", jpg: "image/jpeg", webm: "video/webm", unknown: "application/octet-stream" }
  const kindMatch = detectedKind === declaredKind
  return {
    ok: kindMatch && sizeBytes > 1024,
    declaredKind,
    detectedKind,
    mimeType: mimeMap[detectedKind],
    sizeBytes,
    kindMatch,
    note: kindMatch
      ? `النوع المكتشف من البايتات مطابق (${detectedKind}) والحجم ${sizeBytes} بايت`
      : `⚠ عدم تطابق: معلن ${declaredKind} لكن البايتات تقول ${detectedKind} — يُرفض كملف مزيف`,
  }
}

function esc(t: string): string {
  return t.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\u2019").replace(/%/g, "\\%").replace(/\n/g, " ").slice(0, 220)
}

function run(args: string[], timeoutMs = 120_000): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const p = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] })
    let err = ""
    const timer = setTimeout(() => p.kill("SIGKILL"), timeoutMs)
    p.stderr.on("data", (d) => { err += d.toString(); if (err.length > 8000) err = err.slice(-8000) })
    p.on("error", (e) => { clearTimeout(timer); resolve({ code: -1, stderr: `spawn: ${e.message}` }) })
    p.on("close", (code) => { clearTimeout(timer); resolve({ code: code ?? -1, stderr: err.slice(-1500) }) })
  })
}

/** تقدير الجودة: دقة فعلية ومدة فعلية عبر ffprobe — لا ادعاء بجودة لم تُقَس */
export async function probeMedia(filePath: string): Promise<{ width?: number; height?: number; seconds?: number; codec?: string; ok: boolean; note: string }> {
  return new Promise((resolve) => {
    const p = spawn("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,codec_name", "-show_entries", "format=duration", "-of", "json", filePath], { stdio: ["ignore", "pipe", "ignore"] })
    let out = ""
    p.stdout.on("data", (d) => { out += d.toString() })
    p.on("error", () => resolve({ ok: false, note: "ffprobe غير متاح — لا يمكن إثبات الجودة" }))
    p.on("close", () => {
      try {
        const j = JSON.parse(out) as { streams?: Array<{ width?: number; height?: number; codec_name?: string }>; format?: { duration?: string } }
        const s = j.streams?.[0]
        resolve({ width: s?.width, height: s?.height, codec: s?.codec_name, seconds: j.format?.duration ? Math.round(parseFloat(j.format.duration) * 10) / 10 : undefined, ok: true, note: "قياس ffprobe فعلي" })
      } catch {
        resolve({ ok: false, note: "تعذر تحليل ffprobe" })
      }
    })
  })
}

/** توليد فيديو شرائح حقيقي: كل شريحة drawtext بخلفية متناوبة ثم concat ثم h264/yuv420p للتوافق الأقصى */
export async function renderSlideVideo(slides: Slide[], outName?: string): Promise<{ ok: boolean; path?: string; url?: string; verification?: MediaVerification; probe?: Awaited<ReturnType<typeof probeMedia>>; error?: string }> {
  const clean = slides.filter((s) => (s.text && s.text.trim()) || s.image)
  if (clean.length === 0) return { ok: false, error: "لا شرائح صالحة" }
  if (clean.length > MAX_SLIDES) return { ok: false, error: `أقصى ${MAX_SLIDES} شرائح` }
  const durs = clean.map((s) => Math.min(10, Math.max(1, s.seconds ?? 3)))
  const total = durs.reduce((a, b) => a + b, 0)
  if (total > MAX_TOTAL_SECONDS) return { ok: false, error: `أقصى ${MAX_TOTAL_SECONDS} ثانية إجمالًا` }

  fs.mkdirSync(CREATIVE_DIR, { recursive: true })
  const id = outName ?? `cv-${crypto.randomBytes(5).toString("hex")}`
  const out = path.join(CREATIVE_DIR, `${id}.mp4`)
  const PALETTE = ["0x0b1020", "0x10231b", "0x1d1030", "0x301a10", "0x0a1f2b"]

  const inputs: string[] = []
  const filters: string[] = []
  clean.forEach((s, i) => {
    const imgAbs = s.image
      ? (s.image.startsWith("/creative/") ? path.join(process.cwd(), "public", s.image) : s.image)
      : null
    if (imgAbs && fs.existsSync(imgAbs)) {
      // شريحة بصورة حقيقية: الصورة تُمدّد على المدة + تتقص 1280x720 + النص فوقها
      inputs.push("-loop", "1", "-t", String(durs[i]), "-i", imgAbs)
      filters.push(
        `[${i}:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,` +
        `drawtext=fontfile=${FONT}:text='${esc(s.text)}':fontcolor=white:fontsize=56:borderw=2:bordercolor=black@0.7:x=(w-text_w)/2:y=h-160,` +
        `drawtext=fontfile=${FONT}:text='Ezz Creative':fontcolor=0x8ab4f8@0.8:fontsize=26:x=(w-text_w)/2:y=h-70,` +
        `format=yuv420p,fps=25[v${i}]`,
      )
    } else {
      inputs.push("-f", "lavfi", "-t", String(durs[i]), "-i", `color=c=${s.bg ?? PALETTE[i % PALETTE.length]}:s=1280x720:r=25`)
      // سطر رئيسي في المنتصف + سطر توقيع صغير أسفل — الحد من عرض النص يمنع خروج الحروف
      filters.push(
        `[${i}:v]drawtext=fontfile=${FONT}:text='${esc(s.text)}':fontcolor=white:fontsize=56:x=(w-text_w)/2:y=(h-text_h)/2,` +
        `drawtext=fontfile=${FONT}:text='Ezz Creative (FFmpeg)':fontcolor=0x8ab4f8@0.8:fontsize=26:x=(w-text_w)/2:y=h-70,` +
        `format=yuv420p[v${i}]`,
      )
    }
  })
  const joinIns = clean.map((_, i) => `[v${i}]`).join("")
  const args = ["-y", "-hide_banner", "-loglevel", "error", ...inputs,
    "-filter_complex", `${filters.join(";")};${joinIns}concat=n=${clean.length}:v=1:a=0[out]`,
    "-map", "[out]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-movflags", "+faststart", out]

  const r = await run(args)
  if (r.code !== 0 || !fs.existsSync(out)) return { ok: false, error: `ffmpeg exit=${r.code}: ${r.stderr.slice(-300)}` }
  const verification = verifyMedia(out, "mp4")
  const probe = await probeMedia(out)
  return { ok: verification.ok && probe.ok, path: out, url: `/creative/${id}.mp4`, verification, probe }
}
