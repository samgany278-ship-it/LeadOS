// LeadOS — Creative Assets API (Spec §25/§26 — صور وفيديو من مواقع استخدام مجاني + توليد/فتوشوب AI)
// GET  /api/creative/assets?q=...&kind=image|video&limit=8          → بحث موحّد في كل المزودات (الترخيص إلزامي)
// GET  /api/creative/assets?q=...&download=3                        → بحث + تحميل أفضل 3 محليًا
// POST { action: "generate", prompt, size }                          → توليد صورة AI من نص
// POST { action: "edit", image, prompt, size }                       → فتوشوب AI (تعديل صورة بوصف)
// POST { action: "touchup", image, ops }                             → فتوشوب برمجي (sharp: تحجيم/مائية/تدرج...)
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"
import { searchStockAssets, downloadAsset, generateImage, aiEditImage, touchupImage, type AssetKind, type TouchupOps } from "@/lib/creative/assets"

export const maxDuration = 120
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const url = new URL(req.url)
  const q = (url.searchParams.get("q") ?? "").trim()
  if (!q) return jsonError("q مطلوب (وصف الصورة/الفيديو)", 400)
  const kind = (url.searchParams.get("kind") === "video" ? "video" : "image") as AssetKind
  const limit = Math.min(12, Math.max(1, Number(url.searchParams.get("limit") ?? 8)))
  const downloadN = Math.min(6, Math.max(0, Number(url.searchParams.get("download") ?? 0)))

  const providers = await searchStockAssets(q, kind, limit)
  const all = providers.flatMap((p) => p.assets)

  const downloaded: Array<Record<string, unknown>> = []
  if (downloadN > 0) {
    // المجاني الفعلي (ترخيص موثّق) هو اللي بيتحمّل — يجرب بالترتيب لحد ما يكمّل العدد المطلوب
    // (بعض الـCDNs ليها حماية hotlink — الفشل في أصل مش بيقفل العملية)
    for (const asset of all) {
      if (downloaded.filter((d) => d.ok).length >= downloadN || downloaded.length >= downloadN * 3) break
      const r = await downloadAsset(asset)
      downloaded.push({ ...r, title: asset.title, sourcePage: asset.sourcePage, author: asset.author })
    }
  }
  return json({ ok: true, q, kind, providers, downloaded })
}

interface AssetBody {
  action?: "generate" | "edit" | "touchup"
  prompt?: string
  image?: string
  size?: string
  ops?: TouchupOps
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const body = await readBody<AssetBody>(req)
  const action = body?.action

  if (action === "generate") {
    const prompt = (body?.prompt ?? "").trim()
    if (!prompt) return jsonError("prompt مطلوب (وصف الصورة)", 400)
    const r = await generateImage(prompt, body?.size ?? "1024x1024")
    return r.ok ? json({ ...r }) : jsonError(r.error ?? "فشل التوليد", 502)
  }

  if (action === "edit") {
    const prompt = (body?.prompt ?? "").trim()
    const image = (body?.image ?? "").trim()
    if (!prompt || !image) return jsonError("prompt + image مطلوبين (الفتوشوب = صورة موجودة + وصف التعديل)", 400)
    const r = await aiEditImage(image, prompt, body?.size ?? "1024x1024")
    return r.ok ? json({ ...r }) : jsonError(r.error ?? "فشل الفتوشوب", 502)
  }

  if (action === "touchup") {
    const image = (body?.image ?? "").trim()
    if (!image || !body?.ops) return jsonError("image + ops مطلوبين", 400)
    const r = await touchupImage(image, body.ops)
    return r.ok ? json({ ...r }) : jsonError(r.error ?? "فشل الفتوشوب البرمجي", 500)
  }

  return jsonError("action لازم تكون generate | edit | touchup", 400)
}
