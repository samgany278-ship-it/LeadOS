// LeadOS — Local Agent: حالة الجهاز للوحة التحكم (Spec §20.2 + §20.9)
// تعرض حالة الاتصال (CONNECTED_LOCAL_BROWSER / NOT_CONFIGURED / PAUSED_BY_USER...) وآخر نبضة والطابور.
import { json, requireAuth, isResponse } from "@/lib/api-helpers"
import { getLocalDevice, localQueueStats, DEVICE_LIVE_MS, LOCAL_TASK_TYPE, type LocalDeviceMeta } from "@/lib/agent/local"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const device = await getLocalDevice(auth.workspace.id)
  const stats = await localQueueStats(auth.workspace.id)
  if (!device) {
    return json({
      ok: true, configured: false, connectionState: "NOT_CONFIGURED",
      note: "لا يوجد جهاز مربوط — ابدأ الربط من زر «ربط جهاز محلي»",
      queue: stats,
    })
  }
  const meta = (device.sessionMeta ?? {}) as LocalDeviceMeta
  const lastSeen = meta.lastSeenAt ? new Date(meta.lastSeenAt) : null
  const liveMs = lastSeen ? Date.now() - lastSeen.getTime() : null
  const isLive = liveMs !== null && liveMs < DEVICE_LIVE_MS
  const connectionState =
    device.status === "ACTIVE" && isLive ? "CONNECTED_LOCAL_BROWSER"
    : device.status === "PAUSED" ? "PAUSED_BY_USER"
    : device.status === "DISABLED" ? "REVOKED"
    : device.status === "WARMING" ? "WAITING_FOR_DEVICE"
    : "UNAVAILABLE"
  const recent = await db.job.findMany({
    where: { workspaceId: auth.workspace.id, type: LOCAL_TASK_TYPE },
    orderBy: { createdAt: "desc" }, take: 8,
    select: { id: true, status: true, payload: true, createdAt: true, completedAt: true, errorMessage: true },
  })
  return json({
    ok: true, configured: true, deviceId: device.id, connectionState,
    device: meta.device ?? null,
    binding: meta.bindingHash ? "SET" : "REVOKED",
    registeredAt: meta.registeredAt ?? null,
    lastSeenAt: meta.lastSeenAt ?? null,
    liveSeconds: liveMs !== null ? Math.floor(liveMs / 1000) : null,
    live: isLive,
    queue: stats,
    recentTasks: recent,
    security: "لا تُخزَّن كوكيز أو جلسات من الجهاز في السحابة — سر الربط hash فقط",
  })
}
