// Ezz Finance (سبك §31.1 المالية) — سجل تكاليف وإيرادات وربحية
// GET  : ملخص حي = إيرادات + تكاليف (قيود يدوية) + تكلفة AI الفعلية من AiRun + الربح
// POST : إضافة قيد COST أو REVENUE (مصدر + درجة ثقة RECORDED/ESTIMATED حسب §31.2)
import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"

const KINDS = ["COST", "REVENUE"] as const
const CATEGORIES = ["AI_API", "TOOL", "HOSTING", "ADS", "DOMAIN", "DEAL", "SERVICE", "OTHER"] as const
const CONFIDENCE = ["RECORDED", "ESTIMATED"] as const

export async function GET() {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const wsId = auth.workspace.id

  const [entries, aiAgg, dealAgg, dealCount] = await Promise.all([
    db.financeEntry.findMany({ where: { workspaceId: wsId }, orderBy: { occurredAt: "desc" }, take: 200 }),
    db.aiRun.aggregate({
      where: { workspaceId: wsId, estimatedCost: { not: null } },
      _sum: { estimatedCost: true },
      _count: true,
    }),
    db.deal.aggregate({
      where: { workspaceId: wsId, status: { in: ["WON", "OPEN"] } },
      _sum: { value: true },
    }),
    db.deal.count({ where: { workspaceId: wsId, status: "WON" } }),
  ])

  const manualCost = entries.filter((e) => e.kind === "COST").reduce((s, e) => s + e.amount, 0)
  const manualRevenue = entries.filter((e) => e.kind === "REVENUE").reduce((s, e) => s + e.amount, 0)
  const aiCost = aiAgg._sum.estimatedCost ?? 0
  const dealRevenue = dealAgg._sum.value ?? 0

  const byCategory: Record<string, number> = {}
  for (const e of entries) {
    if (e.kind !== "COST") continue
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount
  }
  byCategory["AI_API"] = (byCategory["AI_API"] ?? 0) + aiCost

  const totalRevenue = manualRevenue + dealRevenue
  const totalCost = manualCost + aiCost
  const profit = totalRevenue - totalCost
  const margin = totalRevenue > 0 ? Math.round((profit / totalRevenue) * 1000) / 10 : null

  return json({
    summary: {
      revenue: Math.round(totalRevenue * 100) / 100,
      cost: Math.round(totalCost * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      marginPct: margin,
      currency: "EGP",
      breakdown: {
        manualCost: Math.round(manualCost * 100) / 100,
        manualRevenue: Math.round(manualRevenue * 100) / 100,
        aiRunCost: Math.round(aiCost * 100) / 100,
        aiRunCount: aiAgg._count,
        dealRevenue: Math.round(dealRevenue * 100) / 100,
        wonDeals: dealCount,
      },
      byCategory: Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, Math.round(v * 100) / 100])),
    },
    entries,
  })
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const body = await readBody<{
    kind?: string; category?: string; title?: string; amount?: number
    currency?: string; dealId?: string; leadId?: string; source?: string
    confidence?: string; occurredAt?: string; notes?: string
  }>(req)

  if (!body) return jsonError("جسم الطلب غير صالح")
  if (!KINDS.includes(body.kind as never)) return jsonError("kind لازم يكون COST أو REVENUE")
  if (!CATEGORIES.includes(body.category as never)) return jsonError(`category لازم تكون من: ${CATEGORIES.join(", ")}`)
  if (!body.title?.trim()) return jsonError("العنوان مطلوب")
  if (typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount <= 0)
    return jsonError("المبلغ لازم يكون رقم أكبر من صفر")
  if (body.kind === "REVENUE" && !body.dealId && body.category === "DEAL")
    return jsonError("إيراد من فئة DEAL لازم يرتبط بصفقة (dealId)")
  const confidence = body.confidence && CONFIDENCE.includes(body.confidence as never) ? body.confidence : "RECORDED"
  if (body.kind === "REVENUE" && confidence === "ESTIMATED")
    return jsonError("إيراد ESTIMATED مرفوض — الإيراد لازم يكون موثق من مصدر (§31.2: المدفوعات المؤكدة من مصدر موثوق)")

  const entry = await db.financeEntry.create({
    data: {
      workspaceId: auth.workspace.id,
      kind: body.kind!,
      category: body.category!,
      title: body.title.trim(),
      amount: body.amount,
      currency: body.currency?.trim() || "EGP",
      dealId: body.dealId?.trim() || null,
      leadId: body.leadId?.trim() || null,
      source: body.source?.trim() || null,
      confidence,
      metadata: body.notes ? { notes: body.notes } : undefined,
      ...(body.occurredAt && !Number.isNaN(Date.parse(body.occurredAt)) ? { occurredAt: new Date(body.occurredAt) } : {}),
    },
  })
  return json({ entry }, 201)
}
