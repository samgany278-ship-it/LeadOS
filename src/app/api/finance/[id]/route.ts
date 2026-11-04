// Ezz Finance — حذف قيد مالي
import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse } from "@/lib/api-helpers"

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const { id } = await params
  const existing = await db.financeEntry.findFirst({ where: { id, workspaceId: auth.workspace.id } })
  if (!existing) return jsonError("القيد غير موجود", 404)
  await db.financeEntry.delete({ where: { id } })
  return json({ ok: true })
}
