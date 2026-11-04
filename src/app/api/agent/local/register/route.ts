// LeadOS — Local Agent: تسجيل الجهاز بعد الربط (Spec §20.2)
// صادر من الجهاز: x-leados-binding: <secret> — يتحقق من الـhash ويفعّل الحالة ACTIVE.
import { json, jsonError, readBody } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { authenticateDevice, touchDevice, type LocalDeviceMeta } from "@/lib/agent/local"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const body = await readBody<{ browser?: string; os?: string; extVersion?: string }>(req) ?? {}
  const deviceId = req.headers.get("x-leados-device")?.trim()
  if (!deviceId) return jsonError("ترويسة x-leados-device مفقودة", 400)
  const row = await db.platformAccount.findUnique({ where: { id: deviceId } })
  if (!row || row.kind !== "LOCAL_AGENT") return jsonError("جهاز غير معروف", 401)
  const auth = await authenticateDevice(row.workspaceId, req.headers.get("x-leados-binding"))
  if (!auth.ok) return jsonError(auth.error, auth.status)
  await touchDevice(row.id, req.headers.get("x-forwarded-for") ?? null, {
    browser: body.browser?.slice(0, 60), os: body.os?.slice(0, 60), extVersion: body.extVersion?.slice(0, 30),
  })
  const meta = (row.sessionMeta ?? {}) as LocalDeviceMeta
  if (!meta.registeredAt) {
    await db.platformAccount.update({
      where: { id: row.id },
      data: { sessionMeta: { ...meta, registeredAt: new Date().toISOString() } },
    })
  }
  if (row.status === "PAUSED") {
    return json({ ok: true, paused: true, note: "الجهاز موقوف مؤقتًا من اللوحة — لن تُسند له مهام حتى الاستئناف" })
  }
  await db.platformAccount.update({ where: { id: row.id }, data: { status: "ACTIVE" } })
  return json({
    ok: true, deviceId: row.id, status: "ACTIVE",
    pollIntervalMs: 10_000, heartbeatIntervalMs: 60_000,
    protocol: { poll: "/api/agent/local/poll", heartbeat: "/api/agent/local/heartbeat", complete: "/api/agent/local/complete" },
    rules: [
      "اتصال صادر فقط — لا يُفتح أي منفذ محلي للسحابة",
      "لا تُنقل كوكيز أو جلسات أو Local Storage إلى السحابة أبدًا",
      "أي مهمة تحتاج تبويبًا تُنفَّذ في متصفح المستخدم المرئي بموافقته",
    ],
  })
}
