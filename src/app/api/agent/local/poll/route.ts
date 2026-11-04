// LeadOS — Local Agent: استطلاع المهام (poll صادر من الجهاز — Spec §20.2)
// يسند مهمة واحدة لكل نداء من الطابور الموحد (Job type=LOCAL_BROWSER_TASK).
// الجهاز الموقوف (PAUSED) لا تُسند له مهام؛ النظام الموقوف شاملًا (SystemState STOPPED) يجمّد السند.
import { json, jsonError } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { authenticateDevice, touchDevice, claimLocalTask, systemStopped, DEVICE_LIVE_MS } from "@/lib/agent/local"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const deviceId = req.headers.get("x-leados-device")?.trim()
  if (!deviceId) return jsonError("ترويسة x-leados-device مفقودة", 400)
  const row = await db.platformAccount.findUnique({ where: { id: deviceId } })
  if (!row || row.kind !== "LOCAL_AGENT") return jsonError("جهاز غير معروف", 401)
  const auth = await authenticateDevice(row.workspaceId, req.headers.get("x-leados-binding"))
  if (!auth.ok) return jsonError(auth.error, auth.status)
  await touchDevice(row.id, req.headers.get("x-forwarded-for") ?? null)

  if (await systemStopped()) {
    return json({ ok: true, paused: true, reason: "SYSTEM_STOPPED", note: "النظام موقوف بالزر الشامل — لا سند مهام" })
  }
  if (row.status === "PAUSED" || row.status === "DISABLED") {
    return json({ ok: true, paused: true, reason: row.status === "PAUSED" ? "PAUSED_BY_USER" : "REVOKED" })
  }
  // مهام قديمة RUNNING لهذا الجهاز تجاوزت مهلتها (نبض متوقف > 3 دقائق) → تُترك ليقرر الـreaper العام
  const live = auth.meta.lastSeenAt ? Date.now() - new Date(auth.meta.lastSeenAt).getTime() < DEVICE_LIVE_MS : true
  const task = await claimLocalTask(row.workspaceId, row.id)
  if (!task) return json({ ok: true, empty: true, live })
  return json({ ok: true, task, live })
}
