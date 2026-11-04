// Ezz Decision Lab — دورة حياة البطاقة:
// decide  → اختيار بديل (مرفوض لو بطاقة عالية الخطورة لسه محتاجة موافقة §32)
// measure → تسجيل النتيجة الفعلية مقابل خط الأساس (§28.4: القياس على نتائج فعلية)
// review  → تسجيل مراجعة القرار / retire → إتلاف البطاقة
import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"

type Params = { params: Promise<{ id: string }> }

interface Option { name: string; cost?: string; benefit?: string; risk?: string; confidence?: string }

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const existing = await db.decisionCard.findFirst({ where: { id, workspaceId: auth.workspace.id } })
  if (!existing) return jsonError("بطاقة القرار غير موجودة", 404)
  const body = await readBody<{
    action?: string; chosenOption?: string; uncertaintyNote?: string
    outcome?: { metric?: string; value?: number; baselineValue?: number; note?: string }
    approvalGranted?: boolean; reviewNote?: string
  }>(req)
  if (!body?.action) return jsonError("action مطلوب: decide | measure | review | retire")

  if (body.action === "decide") {
    if (existing.approvalRequired && body.approvalGranted !== true)
      return jsonError("قرار عالي الخطورة — محتاج موافقة المالك صراحة (approvalGranted=true) حسب §32", 403)
    const options = (existing.options as unknown as Option[]) ?? []
    const chosen = options.find((o) => o.name === body.chosenOption?.trim())
    if (!chosen) return jsonError("البديل المختار لازم يكون اسمه من ضمن بدائل البطاقة بالحرف")
    const card = await db.decisionCard.update({
      where: { id },
      data: {
        chosenOption: chosen.name,
        status: "DECIDED",
        decidedAt: new Date(),
        decidedBy: auth.user.id,
        uncertainty: (body.uncertaintyNote ? { note: body.uncertaintyNote } : (existing.uncertainty ?? null)) as never,
      },
    })
    return json({ card })
  }

  if (body.action === "measure") {
    if (existing.status !== "DECIDED") return jsonError("القياس محتاج بطاقة بحالة DECIDED أول (§28.4: قياس بعد التنفيذ)")
    if (!body.outcome || typeof body.outcome.value !== "number")
      return jsonError("outcome لازم فيه metric + value رقمي — القياس على نتائج فعلية لا تقييم نموذج")
    const card = await db.decisionCard.update({
      where: { id },
      data: {
        status: "MEASURED",
        measuredOutcome: {
          metric: body.outcome.metric?.trim() || existing.successMetric || "outcome",
          value: body.outcome.value,
          baselineValue: body.outcome.baselineValue ?? (existing.baseline as { value?: number } | null)?.value ?? null,
          note: body.outcome.note?.trim() || null,
          measuredAt: new Date().toISOString().slice(0, 16),
        } as never,
      },
    })
    return json({ card })
  }

  if (body.action === "review") {
    const card = await db.decisionCard.update({
      where: { id },
      data: {
        metadata: { ...(existing.metadata as object | null ?? {}), lastReview: { note: body.reviewNote?.trim() || "", at: new Date().toISOString() } } as never,
      },
    })
    return json({ card })
  }

  if (body.action === "retire") {
    const card = await db.decisionCard.update({ where: { id }, data: { status: "RETIRED" } })
    return json({ card })
  }

  return jsonError("action غير معروف: decide | measure | review | retire")
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const existing = await db.decisionCard.findFirst({ where: { id, workspaceId: auth.workspace.id } })
  if (!existing) return jsonError("بطاقة القرار غير موجودة", 404)
  await db.decisionCard.delete({ where: { id } })
  return json({ ok: true })
}
