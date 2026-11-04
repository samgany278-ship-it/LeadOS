// Ezz Web — Demo Factory (سبك §37)
// GET  : قائمة النماذج + القوالب المتاحة
// POST : توليد نموذج تجريبي من قالب + بيانات مؤكدة → HTML + فحوص قبول آلية
import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"
import { SITE_TEMPLATES, generateSite, runSiteChecks } from "@/lib/web/generator"

export async function GET() {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const drafts = await db.siteDraft.findMany({
    where: { workspaceId: auth.workspace.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, name: true, template: true, score: true, status: true, checks: true, createdAt: true, data: true },
  })
  return json({ drafts, templates: SITE_TEMPLATES.map((t) => ({ id: t.id, label: t.label, tagline: t.tagline, services: t.services })) })
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const body = await readBody<{ template?: string; name?: string; data?: { title?: string; tagline?: string; services?: string[]; phone?: string; address?: string } }>(req)
  if (!body?.name?.trim()) return jsonError("اسم النموذج مطلوب")
  if (!body.data?.title?.trim()) return jsonError("اسم النشاط (data.title) مطلوب — لا نموذج بلا هوية")
  if (!SITE_TEMPLATES.some((t) => t.id === body.template)) {
    return jsonError(`القالب لازم يكون من: ${SITE_TEMPLATES.map((t) => t.id).join(" | ")}`)
  }

  const siteData = {
    title: body.data.title!,
    tagline: body.data.tagline || undefined,
    services: body.data.services,
    phone: body.data.phone || undefined,
    address: body.data.address || undefined,
  }
  const { html } = generateSite(body.template!, siteData)
  const { checks, score } = runSiteChecks(html, siteData)
  const failed = checks.filter((c) => !c.pass)
  if (failed.length > 0) return jsonError(`النموذج رسبل ${failed.length} من فحوص القبول — اتصلح الأول`, 422, { checks })

  const draft = await db.siteDraft.create({
    data: {
      workspaceId: auth.workspace.id,
      businessId: null,
      name: body.name.trim(),
      template: body.template!,
      data: siteData as never,
      html,
      checks: checks as never,
      score,
      status: "PREVIEW", // محلي فقط — النشر الحقيقي محجوب على استضافة/تفويض المالك (BLK-011)
    },
  })
  return json(
    {
      draft: { id: draft.id, name: draft.name, template: draft.template, score: draft.score, status: draft.status, checks },
      previewPath: `/api/web/${draft.id}/preview`,
      publishPath: null, // صراحة: مفيش مسار نشر محلي — صدق حسب Master-Prompt §2
      publishBlocker: "BLK-011: النشر الحقيقي محتاج استضافة/دومين تحت سيطرة المالك وتفويض صريح (§37)",
    },
    201,
  )
}
