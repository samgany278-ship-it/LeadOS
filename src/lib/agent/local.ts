// LeadOS — Local Agent cloud contract (Spec §20.2)
// العقل السحابي للعامل المحلي: تسجيل جهاز موثّق + طابور مهام متصفح محلي + تحكم (إيقاف/استئناف/إبطال).
// قواعد صارمة من السبك:
//  - الاتصال صادر من الجهاز دائمًا (poll) — لا منفذ عام ولا اتصال وارد.
//  - لا تُنقل كلمات المرور أو الكوكيز أو Local Storage أو رموز الجلسات إلى السحابة أبدًا.
//  - سر الربط يُخزَّن hash فقط (sha256) — يُعرض مرة واحدة عند الربط ثم لا يُعاد.
//  - التخزين على بنية قائمة: PlatformAccount (حالة الاتصال) + Job (الطابور الموحد) — لا جداول جديدة.
import crypto from "crypto"
import { db } from "@/lib/db"

export const LOCAL_AGENT_PLATFORM = "LOCAL_AGENT"
export const LOCAL_TASK_TYPE = "LOCAL_BROWSER_TASK"
/** الجهاز يُعتبر حيًا إذا نبض خلال هذه المدة */
export const DEVICE_LIVE_MS = 3 * 60_000

export type LocalDeviceMeta = {
  kind: "LOCAL_AGENT"
  deviceId: string
  bindingHash: string | null // sha256 hex — null = مُبطَل
  device?: { browser?: string; os?: string; extVersion?: string }
  registeredAt?: string
  lastSeenAt?: string
  lastIp?: string | null
  revocationReason?: string
}

export function sha256(v: string): string {
  return crypto.createHash("sha256").update(v).digest("hex")
}

export function timingSafeEqualHex(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const ab = Buffer.from(a, "utf8")
  const bb = Buffer.from(b, "utf8")
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

/** استخراج سر الربط من ترويسة الطلب الصادر من الجهاز */
export function bindingFromRequest(req: Request): string | null {
  const h = req.headers.get("x-leados-binding")
  if (h && h.trim()) return h.trim()
  // بديل تشخيصي محدود: ترويسة Authorization: Binding <secret>
  const a = req.headers.get("authorization")
  if (a && a.startsWith("Binding ")) return a.slice("Binding ".length).trim()
  return null
}

/** جلب صف جهاز العامل المحلي للمساحة (أو null) */
export async function getLocalDevice(workspaceId: string) {
  return db.platformAccount.findFirst({
    where: { workspaceId, platform: LOCAL_AGENT_PLATFORM, kind: "LOCAL_AGENT" },
    orderBy: { createdAt: "asc" },
  })
}

/** التحقق من هوية الجهاز (سر ربط + حالة ENABLED). يرجع {device, meta} أو {error} */
export async function authenticateDevice(
  workspaceId: string,
  secret: string | null,
): Promise<{ ok: true; device: NonNullable<Awaited<ReturnType<typeof getLocalDevice>>>; meta: LocalDeviceMeta } | { ok: false; status: number; error: string }> {
  if (!secret) return { ok: false, status: 401, error: "ترويسة x-leados-binding مفقودة" }
  const device = await getLocalDevice(workspaceId)
  if (!device || device.kind !== "LOCAL_AGENT") return { ok: false, status: 401, error: "لا يوجد جهاز مربوط — ابدأ بالربط من اللوحة" }
  const meta = (device.sessionMeta ?? {}) as LocalDeviceMeta
  if (device.status === "DISABLED" || meta.bindingHash === null) {
    return { ok: false, status: 403, error: "صلاحية الربط مُبطلة — يجب إعادة الربط من اللوحة" }
  }
  const hash = sha256(secret)
  if (!timingSafeEqualHex(hash, meta.bindingHash)) return { ok: false, status: 401, error: "سر ربط غير صحيح" }
  return { ok: true, device, meta }
}

/** تحديث نبضة الجهاز + وصفه */
export async function touchDevice(deviceId: string, ip: string | null, deviceInfo?: LocalDeviceMeta["device"]): Promise<void> {
  const row = await db.platformAccount.findUnique({ where: { id: deviceId } })
  if (!row) return
  const meta = (row.sessionMeta ?? {}) as LocalDeviceMeta
  meta.lastSeenAt = new Date().toISOString()
  meta.lastIp = ip
  if (deviceInfo) meta.device = { ...(meta.device ?? {}), ...deviceInfo }
  await db.platformAccount.update({ where: { id: deviceId }, data: { sessionMeta: meta, lastVerifiedAt: new Date() } })
}

/** هل النظام موقوف بالزر الشامل؟ (SystemState — Spec §32) */
export async function systemStopped(): Promise<boolean> {
  const st = await db.systemState.findUnique({ where: { id: "singleton" } })
  return st?.state === "STOPPED"
}

/** إنشاء مهمة متصفح محلي في الطابور الموحد — الحمولة عامة فقط: منصة/فعل/رابط، بلا أسرار */
export async function createLocalTask(input: {
  workspaceId: string
  platform: string
  action: string
  url: string
  note?: string
  priority?: number
}): Promise<{ jobId: string }> {
  const job = await db.job.create({
    data: {
      workspaceId: input.workspaceId,
      type: LOCAL_TASK_TYPE,
      status: "QUEUED",
      priority: input.priority ?? 50,
      payload: { platform: input.platform, action: input.action, url: input.url, note: input.note ?? null, transport: "LOCAL_AGENT" },
    },
    select: { id: true },
  })
  return { jobId: job.id }
}

/** حجز أقدم مهمة QUEUED مستحقة لهذا الجهاز (lease واحد لكل استطلاع) */
export async function claimLocalTask(workspaceId: string, deviceId: string) {
  const now = new Date()
  const candidate = await db.job.findFirst({
    where: { workspaceId, type: LOCAL_TASK_TYPE, status: "QUEUED", scheduledAt: { lte: now } },
    orderBy: [{ priority: "asc" }, { scheduledAt: "asc" }],
    select: { id: true, payload: true, attempts: true, maxAttempts: true },
  })
  if (!candidate) return null
  const claimed = await db.job.updateMany({
    where: { id: candidate.id, status: "QUEUED" }, // منع السباق: يُحجز فقط ما زال QUEUED
    data: { status: "RUNNING", lockedAt: now, workerId: deviceId, attempts: { increment: 1 }, startedAt: now },
  })
  if (claimed.count !== 1) return null
  return { id: candidate.id, payload: candidate.payload as Record<string, unknown>, attempts: candidate.attempts + 1, maxAttempts: candidate.maxAttempts }
}

/** حسم نتيجة مهمة من الجهاز */
export async function completeLocalTask(jobId: string, deviceId: string, ok: boolean, result?: unknown, error?: string) {
  const job = await db.job.findFirst({ where: { id: jobId, type: LOCAL_TASK_TYPE, workerId: deviceId } })
  if (!job) return { ok: false, error: "مهمة غير موجودة لهذا الجهاز" }
  if (job.status !== "RUNNING") return { ok: false, error: `حالة المهمة ${job.status} — لا تُقبل نتيجة` }
  await db.job.update({
    where: { id: job.id },
    data: {
      status: ok ? "SUCCESS" : "FAILED",
      completedAt: new Date(),
      result: (result ?? null) as never,
      errorMessage: ok ? null : (error ?? "فشل غير محدد من الجهاز").slice(0, 500),
      lockedAt: null,
    },
  })
  return { ok: true }
}

/** عدد مهام العامل المحلي المعلقة/الحية للعرض في اللوحة */
export async function localQueueStats(workspaceId: string) {
  const [queued, running, doneToday] = await Promise.all([
    db.job.count({ where: { workspaceId, type: LOCAL_TASK_TYPE, status: "QUEUED" } }),
    db.job.count({ where: { workspaceId, type: LOCAL_TASK_TYPE, status: "RUNNING" } }),
    db.job.count({ where: { workspaceId, type: LOCAL_TASK_TYPE, status: "SUCCESS", completedAt: { gte: new Date(Date.now() - 86_400_000) } } }),
  ])
  return { queued, running, doneToday }
}
