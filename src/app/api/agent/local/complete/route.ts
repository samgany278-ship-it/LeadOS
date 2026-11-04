// LeadOS — Local Agent: تسليم نتيجة مهمة (Spec §20.2)
// الجهاز يرفع النتيجة للمهمة المحجوزة باسمه فقط — idempotent على مستوى الحالة (RUNNING فقط تُقبل).
import { json, jsonError, readBody } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { authenticateDevice, touchDevice, completeLocalTask } from "@/lib/agent/local"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const deviceId = req.headers.get("x-leados-device")?.trim()
  if (!deviceId) return jsonError("ترويسة x-leados-device مفقودة", 400)
  const row = await db.platformAccount.findUnique({ where: { id: deviceId } })
  if (!row || row.kind !== "LOCAL_AGENT") return jsonError("جهاز غير معروف", 401)
  const auth = await authenticateDevice(row.workspaceId, req.headers.get("x-leados-binding"))
  if (!auth.ok) return jsonError(auth.error, auth.status)
  await touchDevice(row.id, req.headers.get("x-forwarded-for") ?? null)
  const body = await readBody<{ jobId?: string; ok?: boolean; result?: unknown; error?: string }>(req)
  if (!body?.jobId) return jsonError("jobId مفقود", 400)
  const r = await completeLocalTask(body.jobId, row.id, body.ok !== false, body.result, body.error)
  if (!r.ok) return jsonError(r.error ?? "فشل تسليم النتيجة", 409)
  return json({ ok: true })
}
