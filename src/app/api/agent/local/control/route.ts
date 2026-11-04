// LeadOS — Local Agent: أزرار التحكم من اللوحة (Spec §20.2)
// PAUSE (إيقاف مؤقت) | RESUME (استئناف) | REVOKE (إلغاء صلاحية الربط — الإضافة تفصل فورًا)
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"
import { getLocalDevice, type LocalDeviceMeta } from "@/lib/agent/local"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const body = await readBody<{ action?: string; reason?: string }>(req)
  const action = body?.action
  if (!action || !["PAUSE", "RESUME", "REVOKE"].includes(action)) return jsonError("action يجب أن يكون PAUSE أو RESUME أو REVOKE", 400)
  const device = await getLocalDevice(auth.workspace.id)
  if (!device) return jsonError("لا يوجد جهاز مربوط", 404)

  if (action === "PAUSE") {
    await db.platformAccount.update({ where: { id: device.id }, data: { status: "PAUSED" } })
    return json({ ok: true, connectionState: "PAUSED_BY_USER", note: "العامل المحلي موقوف مؤقتًا — لن تُسند له مهام جديدة" })
  }
  if (action === "RESUME") {
    await db.platformAccount.update({ where: { id: device.id }, data: { status: "ACTIVE" } })
    return json({ ok: true, connectionState: "CONNECTED_LOCAL_BROWSER", note: "استؤنف العامل المحلي" })
  }
  // REVOKE: إبطال فوري للسر (hash=null) — أي نداء قادم بالسر القديم يُرفض 403
  const meta = (device.sessionMeta ?? {}) as LocalDeviceMeta
  await db.platformAccount.update({
    where: { id: device.id },
    data: {
      status: "DISABLED",
      sessionMeta: { ...meta, bindingHash: null, revocationReason: (body?.reason ?? "بطلب من المالك").slice(0, 200) },
    },
  })
  // المهام RUNNING المسندة له تُفشل بأمان (Spec §20.11-6: عند الفصل لا يتحكم أي جوب جديد في المتصفح)
  const aborted = await db.job.updateMany({
    where: { workspaceId: auth.workspace.id, type: "LOCAL_BROWSER_TASK", status: "RUNNING", workerId: device.id },
    data: { status: "FAILED", errorMessage: "العامل المحلي فُصل (REVOKE) أثناء التنفيذ", completedAt: new Date(), lockedAt: null },
  })
  return json({ ok: true, connectionState: "REVOKED", abortedRunningTasks: aborted.count, note: "أُبطلت صلاحية الربط — أعد الربط لإعادة التشغيل" })
}
