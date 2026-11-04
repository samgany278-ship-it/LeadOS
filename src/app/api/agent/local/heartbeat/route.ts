// LeadOS — Local Agent: نبضة الجهاز (Spec §20.2)
// تحدّث آخر ظهور وترجع حالة التحكم (موقوف؟ مفصول؟) + إحصاء الطابور للعرض المحلي.
import { json, jsonError } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { authenticateDevice, touchDevice, localQueueStats } from "@/lib/agent/local"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const deviceId = req.headers.get("x-leados-device")?.trim()
  if (!deviceId) return jsonError("ترويسة x-leados-device مفقودة", 400)
  const row = await db.platformAccount.findUnique({ where: { id: deviceId } })
  if (!row || row.kind !== "LOCAL_AGENT") return jsonError("جهاز غير معروف", 401)
  const auth = await authenticateDevice(row.workspaceId, req.headers.get("x-leados-binding"))
  if (!auth.ok) return jsonError(auth.error, auth.status)
  await touchDevice(row.id, req.headers.get("x-forwarded-for") ?? null)
  const stats = await localQueueStats(row.workspaceId)
  return json({
    ok: true,
    paused: row.status === "PAUSED",
    revoked: row.status === "DISABLED",
    systemState: (await db.systemState.findUnique({ where: { id: "singleton" } }))?.state ?? "RUNNING",
    queue: stats,
  })
}
