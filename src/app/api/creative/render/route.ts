// LeadOS — Creative Render API (Spec §26 — بديل FFmpeg البرمجي)
// توليد فيديو MP4 حقيقي من شرائح نصية + تحقق نوع/حجم/جودة بالبايتات وffprobe.
// مسار AI التوليدي (صور/فيديو) يحتاج مفاتيح مزودات — محجوب خارجيًا ولا يُدّعى هنا.
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"
import { renderSlideVideo, MAX_SLIDES, type Slide } from "@/lib/creative/ffmpeg"

export const maxDuration = 60
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const body = await readBody<{ slides?: Slide[]; name?: string }>(req)
  const slides = body?.slides
  if (!Array.isArray(slides) || slides.length === 0) return jsonError("slides مطلوبة (نصوص الشريحة)", 400)
  if (slides.length > MAX_SLIDES) return jsonError(`أقصى ${MAX_SLIDES} شرائح`, 400)
  const r = await renderSlideVideo(slides, body?.name?.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40) || undefined)
  if (!r.ok) return jsonError(r.error ?? "فشل التوليد", 500, { stderr: r.error })
  return json({
    ok: true,
    url: r.url,
    file: r.path,
    verification: r.verification,
    probe: r.probe,
    engine: "ffmpeg (بديل برمجي — Spec §26)",
    aiPath: "BLOCKED_EXTERNAL: لا مفاتيح توليد صور/فيديو في البيئة",
  })
}
