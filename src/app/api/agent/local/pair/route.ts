// LeadOS — Local Agent: ربط جهاز جديد (Spec §20.2)
// من اللوحة بجلسة مصرّح بها: يولّد سر ربط عشوائي قوي، يُخزَّن hash فقط، ويُعرض مرة واحدة.
import { db } from "@/lib/db"
import { json, requireAuth, isResponse, jsonError } from "@/lib/api-helpers"
import { LOCAL_AGENT_PLATFORM, sha256, getLocalDevice, type LocalDeviceMeta } from "@/lib/agent/local"
import crypto from "crypto"

export const dynamic = "force-dynamic"

export async function POST() {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const secret = crypto.randomBytes(32).toString("hex")
  const existing = await getLocalDevice(auth.workspace.id)
  if (existing) {
    // إعادة ربط: يلغي أي سر قديم ويصدر سرًا جديدًا (دوران الربط — Spec §20.2)
    const meta: LocalDeviceMeta = {
      kind: "LOCAL_AGENT", deviceId: existing.id, bindingHash: sha256(secret),
      device: undefined, registeredAt: undefined, lastSeenAt: undefined, lastIp: null,
    }
    await db.platformAccount.update({ where: { id: existing.id }, data: { status: "WARMING", sessionMeta: meta, lastError: null } })
    return json({ ok: true, rebind: true, deviceId: existing.id, bindingSecret: secret, expiresInNote: "يُعرض هذا السر مرة واحدة — لا يمكن استرجاعه لاحقًا" })
  }
  const created = await db.platformAccount.create({
    data: {
      workspaceId: auth.workspace.id,
      platform: LOCAL_AGENT_PLATFORM,
      handle: "local-bridge",
      label: "العامل المحلي (إضافة Chrome/Edge)",
      kind: "LOCAL_AGENT",
      status: "WARMING",
      sessionMeta: { kind: "LOCAL_AGENT", deviceId: "", bindingHash: sha256(secret) } as never,
    },
  })
  const meta: LocalDeviceMeta = { kind: "LOCAL_AGENT", deviceId: created.id, bindingHash: sha256(secret) }
  await db.platformAccount.update({ where: { id: created.id }, data: { sessionMeta: meta } })
  return json({ ok: true, rebind: false, deviceId: created.id, bindingSecret: secret, expiresInNote: "يُعرض هذا السر مرة واحدة — لا يمكن استرجاعه لاحقًا" })
}

export async function GET() {
  return jsonError("استخدم POST", 405)
}
