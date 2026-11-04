// Ezz Web — عرض/أرشفة/حذف نموذج
import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse } from "@/lib/api-helpers"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const draft = await db.siteDraft.findFirst({ where: { id, workspaceId: auth.workspace.id } })
  if (!draft) return jsonError("النموذج غير موجود", 404)
  return json({
    draft: { id: draft.id, name: draft.name, template: draft.template, score: draft.score, status: draft.status, checks: draft.checks, data: draft.data, createdAt: draft.createdAt },
    previewPath: `/api/web/${draft.id}/preview`,
  })
}

export async function PATCH(_req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const existing = await db.siteDraft.findFirst({ where: { id, workspaceId: auth.workspace.id } })
  if (!existing) return jsonError("النموذج غير موجود", 404)
  const draft = await db.siteDraft.update({ where: { id }, data: { status: existing.status === "ARCHIVED" ? "PREVIEW" : "ARCHIVED" } })
  return json({ draft: { id: draft.id, status: draft.status } })
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const existing = await db.siteDraft.findFirst({ where: { id, workspaceId: auth.workspace.id } })
  if (!existing) return jsonError("النموذج غير موجود", 404)
  await db.siteDraft.delete({ where: { id } })
  return json({ ok: true })
}
