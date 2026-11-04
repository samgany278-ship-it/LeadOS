// Ezz Social & Publish (سبك §30) — مسودات جاهزة للنشر
// القاعدة الصارمة: ممنوع أي إرسال آلي — النشر اليدوي أو عبر API رسمي بعد تفويض المالك فقط
// فحوص السياسة: ساعات النشر 10ص-8م توقيت مصر (PROJECT.md §6) + حد الحروف لكل منصة + منع التكرار
// GET  : قائمة المسودات + حالة التفويض لكل منصة
// POST : إنشاء مسودة + فحوص
import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"

const PLATFORMS = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "X", "TELEGRAM", "WHATSAPP"] as const
const LIMITS: Record<string, number> = { X: 280, FACEBOOK: 2200, INSTAGRAM: 2200, LINKEDIN: 3000, TELEGRAM: 4096, WHATSAPP: 4096 }

interface PolicyCheck { id: string; label: string; level: "OK" | "WARN"; detail: string }

function egyptHour(): number {
  const now = new Date()
  const cairo = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Cairo" }))
  return cairo.getHours()
}

function runPolicyChecks(content: string, platform: string, scheduledAt: Date | null, accountId: string | null): { checks: PolicyCheck[]; blocked: boolean } {
  const checks: PolicyCheck[] = []

  const limit = LIMITS[platform] ?? 2200
  checks.push({
    id: "length",
    label: `حد حروف ${platform} (${limit})`,
    level: content.length <= limit ? "OK" : "WARN",
    detail: content.length <= limit ? `المحتوى ${content.length} حرف` : `المحتوى ${content.length} حرف — فوق حد المنصة`,
  })

  const targetHour = scheduledAt ? egyptHourAt(scheduledAt) : egyptHour()
  const inHours = targetHour >= 10 && targetHour < 20
  checks.push({
    id: "send_hours",
    label: "ساعات النشر 10ص-8م (توقيت مصر)",
    level: inHours ? "OK" : "WARN",
    detail: inHours ? "داخل ساعات النشاط" : `خارج الساعات المسموحة (الساعة الآن/المجدولة: ${targetHour}:00)`,
  })

  checks.push({
    id: "authorization",
    label: "حالة التفويض",
    level: accountId ? "OK" : "WARN",
    detail: accountId
      ? "مرتبط بحساب مصرح به — النشر يبقى يدوي/بـAPI رسمي بعد تفويض المالك"
      : "لا يوجد حساب مصرح به — النشر اليدوي فقط (نسخ/لصق أو تفويض لاحق)",
  })

  const spammy = /(اكتب كلمة|اشترك في قناة|تابعنا فورا|خصم 100%|مجانا 100%)/.test(content)
  checks.push({
    id: "no_spam",
    label: "لا صياغة سبام",
    level: spammy ? "WARN" : "OK",
    detail: spammy ? "الصياغة تحمل وعود مبالغ فيها — راجعها قبل النشر" : "صياغة سليمة",
  })

  return { checks, blocked: false } // مسودات — لا إرسال آلي أصلاً، فلا حظر، لكن التحذيرات موثقة
}

function egyptHourAt(d: Date): number {
  const cairo = new Date(d.toLocaleString("en-US", { timeZone: "Africa/Cairo" }))
  return cairo.getHours()
}

export async function GET() {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const drafts = await db.postDraft.findMany({
    where: { workspaceId: auth.workspace.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  const accounts = await db.platformAccount.findMany({
    where: { workspaceId: auth.workspace.id },
    select: { id: true, platform: true, handle: true, status: true, kind: true },
  })
  const authorized = Object.fromEntries(
    PLATFORMS.map((p) => [p, accounts.filter((a) => a.platform === p && a.status === "ACTIVE" && a.kind === "OUTBOX").length]),
  )
  return json({ drafts, authorizedPerPlatform: authorized })
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const body = await readBody<{ platform?: string; content?: string; accountId?: string; scheduledAt?: string; mediaKind?: string; notes?: string }>(req)
  if (!body) return jsonError("جسم الطلب غير صالح")
  if (!PLATFORMS.includes(body.platform as never)) return jsonError(`المنصة لازم تكون من: ${PLATFORMS.join(", ")}`)
  if (!body.content?.trim() || body.content.trim().length < 20) return jsonError("المحتوى مطلوب (20 حرف على الأقل)")

  let accountId: string | null = null
  if (body.accountId?.trim()) {
    const acc = await db.platformAccount.findFirst({
      where: { id: body.accountId.trim(), workspaceId: auth.workspace.id, platform: body.platform },
    })
    if (!acc) return jsonError("الحساب غير موجود أو مش على نفس المنصة", 404)
    accountId = acc.id
  }

  const scheduledAt = body.scheduledAt && !Number.isNaN(Date.parse(body.scheduledAt)) ? new Date(body.scheduledAt) : null
  const { checks } = runPolicyChecks(body.content, body.platform!, scheduledAt, accountId)

  // منع التكرار: نفس النص لنفس المنصة — §6 «ممنوع نفس الرسالة»
  const dup = await db.postDraft.findFirst({
    where: { workspaceId: auth.workspace.id, platform: body.platform!, content: body.content.trim() },
  })
  if (dup) return jsonError("نفس المحتوى موجود بالفعل كمسودة لنفس المنصة — منع التكرار (سياسة anti-ban)", 409)

  const draft = await db.postDraft.create({
    data: {
      workspaceId: auth.workspace.id,
      platform: body.platform!,
      accountId,
      content: body.content.trim(),
      mediaKind: body.mediaKind?.trim() || "TEXT",
      policyChecks: checks as never,
      scheduledAt,
      notes: body.notes?.trim() || null,
      status: "DRAFT", // دايمًا يبدأ مسودة — لا مسار إرسال آلي
    },
  })
  return json({ draft, publishPath: null, publishNote: "النشر اليدوي فقط — بعد النشر سجّل الرابط عبر PATCH status=PUBLISHED_MANUAL" }, 201)
}
