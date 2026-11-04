// LeadOS — Ezz Resource Router: أصول الصور والفيديو (Spec §25/§26 — «يحدد أكثر من موقع يقدمه استخدام مجاني ويستخدمهم»)
// مزودات بدون أي مفتاح (مجانية 100%):
//   • Openverse — كل النتائج تراخيص CC (استخدام مجاني موثّق بالترخيص)
//   • Wikimedia Commons — تراخيص حرة موثقة
// مزودات بمفتاح مجاني (تُفعَّل تلقائيًا بمجرد وجود المفتاح في البيئة — الروابط في التقرير):
//   • Unsplash   → https://unsplash.com/developers   (UNSPLASH_ACCESS_KEY)
//   • Pexels     → https://www.pexels.com/api/       (PEXELS_API_KEY — صور + فيديو)
//   • Pixabay    → https://pixabay.com/api/docs/     (PIXABAY_API_KEY — صور + فيديو)
// التوليد والفتوشوب: محرك AI المدمج (z-ai-web-dev-sdk — بدون مفتاح خارجي) —
//   generate = توليد صورة من نص | edit = فتوشوب AI (تعديل صورة موجودة بوصف نصي) | touchup = فتوشوب برمجي (sharp)
// كل ملف يُحفظ محليًا في public/creative/ — القاعدة الواحدة + ملفات المشروع، لا تخزين خارجي.
import fs from "fs"
import path from "path"
import crypto from "crypto"
import { CREATIVE_DIR, detectKind } from "./ffmpeg"

export type AssetKind = "image" | "video"
export interface StockAsset {
  source: "openverse" | "wikimedia" | "unsplash" | "pexels" | "pixabay"
  title: string
  url: string          // رابط الملف الأصلي (للتحميل)
  thumb?: string
  author?: string
  license: string      // نص الترخيص — إلزامي (Spec: «مصدر/ترخيص الأصول»)
  sourcePage?: string  // صفحة الأصل على المصدر (إثبات الاستخدام المجاني)
  width?: number
  height?: number
  kind: AssetKind
  providerError?: never
}
export interface ProviderResult { provider: string; assets: StockAsset[]; error?: string; needsKey?: boolean }

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
// Wikimedia وOpenverse بيطلبو UA وصفي (سياسة الـUA بتاعة Wikimedia صريحة: UA متصفح عام = 429/بلوك)
const API_UA = "LeadOS/1.0 (https://leados.app; contact: admin@leados.com)"

// كاش موت بسيط: مزود 429/مشترك فشل → نطنشه فترة بدل ما نأخر كل طلب
const deadUntil = new Map<string, number>()
function isDead(p: string): boolean { return (deadUntil.get(p) ?? 0) > Date.now() }
function noteDead(p: string, minutes: number): void { deadUntil.set(p, Date.now() + minutes * 60_000) }

async function getJson(url: string, headers: Record<string, string> = {}, timeoutMs = 20000): Promise<unknown> {
  const res = await fetch(url, { headers: { "User-Agent": API_UA, ...headers }, signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ─── Openverse — بدون مفتاح — تراخيص CC ───
async function openverse(q: string, kind: AssetKind, limit: number): Promise<StockAsset[]> {
  if (kind !== "image") return [] // Openverse للصور فقط
  const data = (await getJson(
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=${Math.min(limit, 20)}&license_type=all-cc&mature=false`,
  )) as { results?: Array<Record<string, unknown>> }
  return (data.results ?? []).slice(0, limit).map((r) => ({
    source: "openverse" as const,
    title: String(r.title ?? "بدون عنوان"),
    url: String(r.url ?? ""),
    thumb: r.thumbnail ? String(r.thumbnail) : undefined,
    author: r.creator ? String(r.creator) : undefined,
    license: `CC ${r.license ?? ""} ${r.license_version ?? ""}`.trim() || "CC (openverse)",
    sourcePage: r.foreign_landing_url ? String(r.foreign_landing_url) : undefined,
    width: r.width ? Number(r.width) : undefined,
    height: r.height ? Number(r.height) : undefined,
    kind: "image" as const,
  })).filter((a) => a.url)
}

// ─── Wikimedia Commons — بدون مفتاح — تراخيص حرة ───
async function wikimedia(q: string, kind: AssetKind, limit: number): Promise<StockAsset[]> {
  if (kind !== "image") return []
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*` +
    `&generator=search&gsrsearch=${encodeURIComponent(q + " filetype:bitmap")}&gsrnamespace=6&gsrlimit=${Math.min(limit, 20)}` +
    `&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1280`
  const data = (await getJson(url)) as {
    query?: { pages?: Record<string, { title?: string; imageinfo?: Array<Record<string, unknown>> }> }
  }
  const pages = Object.values(data.query?.pages ?? {})
  return pages.slice(0, limit).map((p) => {
    const info = p.imageinfo?.[0] ?? {}
    const meta = (info.extmetadata ?? {}) as Record<string, { value?: string }>
    return {
      source: "wikimedia" as const,
      title: String(p.title ?? "").replace(/^File:/, ""),
      url: String(info.thumburl ?? info.url ?? ""),
      thumb: info.thumburl ? String(info.thumburl) : undefined,
      author: meta?.Artist?.value ? String(meta.Artist.value).replace(/<[^>]+>/g, "").slice(0, 80) : undefined,
      license: meta?.LicenseShortName?.value ? String(meta.LicenseShortName.value) : "Wikimedia (راجع صفحة الأصل)",
      sourcePage: info.descriptionurl ? String(info.descriptionurl) : undefined,
      width: info.width ? Number(info.width) : undefined,
      height: info.height ? Number(info.height) : undefined,
      kind: "image" as const,
    }
  }).filter((a) => a.url)
}

// ─── Unsplash — مفتاح مجاني اختياري ───
async function unsplash(q: string, kind: AssetKind, limit: number): Promise<StockAsset[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key) throw new Error("no key")
  if (kind !== "image") return []
  const data = (await getJson(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=${Math.min(limit, 20)}`,
    { Authorization: `Client-ID ${key}` },
  )) as { results?: Array<Record<string, unknown>> }
  return (data.results ?? []).slice(0, limit).map((r) => {
    const urls = (r.urls ?? {}) as Record<string, string>
    const user = (r.user ?? {}) as Record<string, string>
    return {
      source: "unsplash" as const,
      title: String((r.alt_description as string) ?? (r.description as string) ?? "Unsplash photo"),
      url: urls.regular ?? urls.full ?? "",
      thumb: urls.small,
      author: user.name,
      license: "Unsplash License (استخدام تجاري مجاني)",
      sourcePage: (r.links as Record<string, string> | undefined)?.html,
      width: r.width ? Number(r.width) : undefined,
      height: r.height ? Number(r.height) : undefined,
      kind: "image" as const,
    }
  }).filter((a) => a.url)
}

// ─── Pexels — مفتاح مجاني اختياري — صور + فيديو ───
async function pexels(q: string, kind: AssetKind, limit: number): Promise<StockAsset[]> {
  const key = process.env.PEXELS_API_KEY
  if (!key) throw new Error("no key")
  if (kind === "image") {
    const data = (await getJson(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${Math.min(limit, 20)}`, { Authorization: key })) as { photos?: Array<Record<string, unknown>> }
    return (data.photos ?? []).slice(0, limit).map((r) => {
      const src = (r.src ?? {}) as Record<string, string>
      const user = (r.user ?? {}) as Record<string, string>
      return {
        source: "pexels" as const, title: String((r.alt as string) ?? "Pexels photo"),
        url: src.large2x ?? src.large ?? src.original ?? "", thumb: src.medium, author: user.name,
        license: "Pexels License (استخدام مجاني)", sourcePage: r.url ? String(r.url) : undefined,
        width: r.width ? Number(r.width) : undefined, height: r.height ? Number(r.height) : undefined, kind: "image" as const,
      }
    }).filter((a) => a.url)
  }
  const data = (await getJson(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=${Math.min(limit, 10)}`, { Authorization: key })) as { videos?: Array<Record<string, unknown>> }
  return (data.videos ?? []).slice(0, limit).map((r) => {
    const files = ((r.video_files ?? []) as Array<Record<string, unknown>>)
      .filter((f) => f.file_type === "video/mp4" && Number(f.width ?? 0) >= 640 && Number(f.width ?? 0) <= 1920)
      .sort((a, b) => Number(b.width ?? 0) - Number(a.width ?? 0))
    const user = (r.user ?? {}) as Record<string, string>
    const best = files[0]
    return {
      source: "pexels" as const, title: `Pexels video ${r.id ?? ""}`.trim(),
      url: best ? String(best.link) : "", author: user.name,
      license: "Pexels License (استخدام مجاني)", sourcePage: r.url ? String(r.url) : undefined,
      width: best?.width ? Number(best.width) : undefined, height: best?.height ? Number(best.height) : undefined, kind: "video" as const,
    }
  }).filter((a) => a.url)
}

// ─── Pixabay — مفتاح مجاني اختياري — صور + فيديو ───
async function pixabay(q: string, kind: AssetKind, limit: number): Promise<StockAsset[]> {
  const key = process.env.PIXABAY_API_KEY
  if (!key) throw new Error("no key")
  const endpoint = kind === "image" ? "api" : "api/videos"
  const data = (await getJson(`https://pixabay.com/${endpoint}/?key=${key}&q=${encodeURIComponent(q)}&per_page=${Math.min(limit, 20)}&safesearch=true`)) as { hits?: Array<Record<string, unknown>> }
  return (data.hits ?? []).slice(0, limit).map((r) => {
    if (kind === "image") {
      return {
        source: "pixabay" as const, title: String((r.tags as string) ?? "Pixabay image").split(",").slice(0, 3).join(", "),
        url: String(r.largeImageURL ?? r.webformatURL ?? ""), thumb: r.webformatURL ? String(r.webformatURL) : undefined,
        author: r.user ? String(r.user) : undefined, license: "Pixabay Content License (استخدام مجاني)",
        sourcePage: r.pageURL ? String(r.pageURL) : undefined,
        width: r.imageWidth ? Number(r.imageWidth) : undefined, height: r.imageHeight ? Number(r.imageHeight) : undefined, kind: "image" as const,
      }
    }
    const vids = (r.videos ?? {}) as Record<string, { url?: string; width?: number; height?: number }>
    const best = vids.large ?? vids.medium ?? Object.values(vids)[0]
    return {
      source: "pixabay" as const, title: String((r.tags as string) ?? "Pixabay video").split(",").slice(0, 3).join(", "),
      url: best?.url ?? "", author: r.user ? String(r.user) : undefined, license: "Pixabay Content License (استخدام مجاني)",
      sourcePage: r.pageURL ? String(r.pageURL) : undefined,
      width: best?.width, height: best?.height, kind: "video" as const,
    }
  }).filter((a) => a.url)
}

/**
 * البحث الموحّد عبر كل مزودات الأصول — المجاني بلا مفتاح أولًا، وبعدين اللي عندهم مفاتيح.
 * لا مولدات وهمية: مزود فاشل بيرجع error والباقي يكمل.
 */
export async function searchStockAssets(q: string, kind: AssetKind = "image", limit = 8): Promise<ProviderResult[]> {
  const providers: Array<{ name: string; needsKey: boolean; run: () => Promise<StockAsset[]> }> = [
    { name: "openverse", needsKey: false, run: () => openverse(q, kind, limit) },
    { name: "wikimedia", needsKey: false, run: () => wikimedia(q, kind, limit) },
    { name: "unsplash", needsKey: true, run: () => unsplash(q, kind, limit) },
    { name: "pexels", needsKey: true, run: () => pexels(q, kind, limit) },
    { name: "pixabay", needsKey: true, run: () => pixabay(q, kind, limit) },
  ]
  const out: ProviderResult[] = []
  await Promise.all(providers.map(async (p) => {
    try {
      if (isDead(p.name)) { out.push({ provider: p.name, assets: [], error: "dead-cache", needsKey: p.needsKey }); return }
      const assets = await p.run()
      out.push({ provider: p.name, assets, needsKey: p.needsKey })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === "no key") out.push({ provider: p.name, assets: [], error: "مفيش مفتاح — مجاني من الرابط في التقرير", needsKey: true })
      else {
        if (msg.includes("HTTP 429")) noteDead(p.name, 15)
        out.push({ provider: p.name, assets: [], error: msg.slice(0, 120), needsKey: p.needsKey })
      }
    }
  }))
  // المجاني الفعلي الأول — اللي محتاج مفتاح بعده (نظام يدور على المجاني ويستخدمه — طلب المستخدم)
  return out.sort((a, b) => (b.assets.length && a.needsKey !== b.needsKey ? Number(a.needsKey) - Number(b.needsKey) : 0) || b.assets.length - a.assets.length)
}

const STOCK_DIR = path.join(CREATIVE_DIR, "stock")

/** تحميل أصل من مزود للمجلد المحلي — النوع يُستنتج من magic bytes (لا الامتداد) */
export async function downloadAsset(asset: StockAsset): Promise<{ ok: boolean; url?: string; file?: string; error?: string; license: string; source: string }> {
  try {
    const res = await fetch(asset.url, {
      headers: { "User-Agent": UA, ...(asset.sourcePage ? { Referer: asset.sourcePage } : {}) },
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, license: asset.license, source: asset.source }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 8 * 1024) return { ok: false, error: "الملف أصغر من 8KB — غالبًا صفحة خطأ", license: asset.license, source: asset.source }
    const kind = detectKind(buf)
    if (kind === "unknown") return { ok: false, error: "نوع ملف غير معروف من magic bytes", license: asset.license, source: asset.source }
    fs.mkdirSync(STOCK_DIR, { recursive: true })
    const slug = `${asset.source}-${crypto.randomBytes(4).toString("hex")}`
    const file = path.join(STOCK_DIR, `${slug}.${kind === "mp4" || kind === "webm" ? kind : kind === "png" ? "png" : "jpg"}`)
    fs.writeFileSync(file, buf)
    return { ok: true, url: `/creative/stock/${path.basename(file)}`, file, license: asset.license, source: asset.source }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message.slice(0, 140) : "فشل التحميل", license: asset.license, source: asset.source }
  }
}

// ─── التوليد والفتوشوب AI (z-ai-web-dev-sdk — بدون مفتاح خارجي) ───
const GEN_SIZES = new Set(["1024x1024", "768x1344", "864x1152", "1344x768", "1152x864", "1440x720", "720x1440"])
type GenSize = "1024x1024" | "768x1344" | "864x1152" | "1344x768" | "1152x864" | "1440x720" | "720x1440"
function genSize(s?: string): GenSize {
  return (GEN_SIZES.has(s ?? "") ? s : "1024x1024") as GenSize
}

async function zaiClient(): Promise<import("z-ai-web-dev-sdk").default> {
  const mod = await import("z-ai-web-dev-sdk")
  return await (mod.default ?? mod).create()
}

/** توليد صورة من وصف نصي */
export async function generateImage(prompt: string, size = "1024x1024"): Promise<{ ok: boolean; url?: string; file?: string; error?: string }> {
  try {
    const zai = await zaiClient()
    const res = await zai.images.generations.create({ prompt, size: genSize(size) })
    const b64 = res.data?.[0]?.base64
    if (!b64) return { ok: false, error: "المحرك رجّع نتيجة فاضية" }
    const buf = Buffer.from(b64, "base64")
    fs.mkdirSync(CREATIVE_DIR, { recursive: true })
    const name = `gen-${crypto.randomBytes(4).toString("hex")}.png`
    const file = path.join(CREATIVE_DIR, name)
    fs.writeFileSync(file, buf)
    return { ok: true, url: `/creative/${name}`, file }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message.slice(0, 200) : "فشل التوليد" }
  }
}

/** فتوشوب AI — تعديل صورة موجودة (رابط عام /creative/... أو data URL) بوصف نصي */
export async function aiEditImage(imageRef: string, prompt: string, size = "1024x1024"): Promise<{ ok: boolean; url?: string; file?: string; error?: string }> {
  try {
    let dataUrl = imageRef
    if (!imageRef.startsWith("data:")) {
      const localPath = imageRef.startsWith("/creative/") ? path.join(process.cwd(), "public", imageRef) : null
      if (localPath && fs.existsSync(localPath)) {
        const buf = fs.readFileSync(localPath)
        const mime = detectKind(buf) === "png" ? "image/png" : "image/jpeg"
        dataUrl = `data:${mime};base64,${buf.toString("base64")}`
      } else if (/^https?:\/\//.test(imageRef)) {
        // رابط خارجي — ننزّله ونحوله data URL عشان المحرك يستقبله
        const res = await fetch(imageRef, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) })
        if (!res.ok) return { ok: false, error: `تعذر جلب الصورة: HTTP ${res.status}` }
        const buf = Buffer.from(await res.arrayBuffer())
        const mime = detectKind(buf) === "png" ? "image/png" : "image/jpeg"
        dataUrl = `data:${mime};base64,${buf.toString("base64")}`
      } else {
        return { ok: false, error: "الصورة غير موجودة محليًا" }
      }
    }
    const zai = await zaiClient()
    // ملاحظة: نوع الـSDK 0.0.18 بيقول `image` (مفرد) لكن السيرفر الفعلي بيرفض من غير `images`
    // (مصفوفة {url}) — الخطأ الحي: «image_to_image task must provide images». نرسل اللي السيرفر عايزه.
    const editBody = { prompt, size: genSize(size), images: [{ url: dataUrl }] } as unknown as Parameters<typeof zai.images.generations.edit>[0]
    const res = await zai.images.generations.edit(editBody)
    const b64 = res.data?.[0]?.base64
    if (!b64) return { ok: false, error: "المحرك رجّع نتيجة فاضية" }
    const buf = Buffer.from(b64, "base64")
    fs.mkdirSync(CREATIVE_DIR, { recursive: true })
    const name = `edit-${crypto.randomBytes(4).toString("hex")}.png`
    const file = path.join(CREATIVE_DIR, name)
    fs.writeFileSync(file, buf)
    return { ok: true, url: `/creative/${name}`, file }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message.slice(0, 200) : "فشل الفتوشوب" }
  }
}

export interface TouchupOps {
  width?: number; height?: number;          // تحجيم
  rotate?: number;                          // دوران بالدرجات
  grayscale?: boolean;                      // أبيض وأسود
  brightness?: number;                      // 0.5 = أغمق، 1.5 = أفتح
  saturation?: number;                      // 0 = رمادي، 2 = مشبع
  watermark?: string;                       // نص مائية أسفل الصورة
}
/** فتوشوب برمجي سريع (sharp) — تحجيم/دوران/تدرج/إضاءة/علامة مائية */
export async function touchupImage(imageRef: string, ops: TouchupOps): Promise<{ ok: boolean; url?: string; file?: string; error?: string }> {
  try {
    const localPath = imageRef.startsWith("/creative/") ? path.join(process.cwd(), "public", imageRef) : null
    let buf: Buffer
    if (localPath && fs.existsSync(localPath)) buf = fs.readFileSync(localPath)
    else if (/^https?:\/\//.test(imageRef)) {
      const res = await fetch(imageRef, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) })
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
      buf = Buffer.from(await res.arrayBuffer())
    } else if (imageRef.startsWith("data:")) buf = Buffer.from(imageRef.split(",")[1] ?? "", "base64")
    else return { ok: false, error: "الصورة غير موجودة" }

    const sharp = (await import("sharp")).default
    let img = sharp(buf)
    const meta = await img.metadata()
    if (ops.width || ops.height) img = img.resize(ops.width ?? undefined, ops.height ?? undefined, { fit: "cover" })
    if (ops.rotate) img = img.rotate(ops.rotate)
    if (ops.grayscale) img = img.grayscale()
    if (ops.brightness || ops.saturation) img = img.modulate({ brightness: ops.brightness ?? 1, saturation: ops.saturation ?? 1 })
    if (ops.watermark) {
      const w = ops.width ?? meta.width ?? 1024
      const svg = `<svg width="${w}" height="60"><text x="${w - 12}" y="42" text-anchor="end" font-size="26" fill="white" fill-opacity="0.75" font-family="sans-serif">${ops.watermark.replace(/[<>&]/g, "")}</text></svg>`
      img = img.composite([{ input: Buffer.from(svg), gravity: "southeast" }])
    }
    const out = await img.jpeg({ quality: 88 }).toBuffer()
    fs.mkdirSync(CREATIVE_DIR, { recursive: true })
    const name = `touchup-${crypto.randomBytes(4).toString("hex")}.jpg`
    const file = path.join(CREATIVE_DIR, name)
    fs.writeFileSync(file, out)
    return { ok: true, url: `/creative/${name}`, file }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message.slice(0, 200) : "فشل الفتوشوب البرمجي" }
  }
}
