// Ezz Social — دورة حياة المسودة:
// approve           → APPROVED (جاهزة للنشر اليدوي)
// published-manual  → PUBLISHED_MANUAL + رابط/مرجع النشر الفعلي (بعد ما المالك ينشر بيده)
// discard           → DISCARDED
// ممنوع أي مسار "publish-api" من هنا — النشر الآلي محتاج تفويض OAuth رسمي لكل منصة (سبك §30.4)
import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const existing = await db.postDraft.findFirst({ where: { id, workspaceId: auth.workspace.id } })
  if (!existing) return jsonError("المسودة غير موجودة", 404)
  const body = await readBody<{ action?: string; publishedRef?: string; notes?: string }>(req)
  if (!body?.action) return jsonError("action مطلوب: approve | published-manual | discard")

  if (body.action === "approve") {
    const draft = await db.postDraft.update({ where: { id }, data: { status: "APPROVED" } })
    return json({ draft })
  }

  if (body.action === "published-manual") {
    if (!body.publishedRef?.trim()) return jsonError("لازم مرجع/رابط المنشور الفعلي — لا اعتبار نشر ناجحا قبل التحقق (§30.1.8)")
    const draft = await db.postDraft.update({
      where: { id },
      data: { status: "PUBLISHED_MANUAL", publishedRef: body.publishedRef.trim(), publishedAt: new Date() },
    })
    return json({ draft })
  }

  if (body.action === "discard") {
    const draft = await db.postDraft.update({ where: { id }, data: { status: "DISCARDED" } })
    return json({ draft })
  }

  return jsonError("action غير معروف")
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const existing = await db.postDraft.findFirst({ where: { id, workspaceId: auth.workspace.id } })
  if (!existing) return jsonError("المسودة غير موجودة", 404)
  await db.postDraft.delete({ where: { id } })
  return json({ ok: true })
}
