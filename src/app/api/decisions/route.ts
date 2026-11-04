// Ezz Decision Lab (سبك §28 — المعمل العلمي للقرار)
// بطاقة قرار علمية: هدف + مقياس + خط أساس + بدائل + أدلة مؤرخة + عدم يقين + قياس مقابل خط الأساس
// GET  : قائمة البطاقات + إحصاء حسب الحالة
// POST : إنشاء بطاقة (بدائل ≥2 + دليل مؤرخ ≥1) — القرارات عالية الخطورة تُقفل على موافقة المالك (§32)
import { db } from "@/lib/db"
import { json, jsonError, requireAuth, isResponse, readBody } from "@/lib/api-helpers"

interface OptionInput { name?: string; cost?: string; benefit?: string; risk?: string; confidence?: string }
interface EvidenceInput { source?: string; url?: string; date?: string; kind?: string }
const EVIDENCE_KINDS = ["OBSERVED", "ESTIMATE", "HYPOTHESIS"] as const

// §32 — فئات تحتاج موافقة صريحة لكل مرة
const HIGH_RISK_PATTERNS = /(شراء|دومين|خطة مدفوعة|إنفاق|إعلان مدفوع|عقد|خصم|استرجاع|حذف بيانات|دفعة)/

export async function GET() {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const cards = await db.decisionCard.findMany({
    where: { workspaceId: auth.workspace.id },
    orderBy: { updatedAt: "desc" },
    take: 100,
  })
  const byStatus: Record<string, number> = {}
  for (const c of cards) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1
  return json({ cards, byStatus })
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isResponse(auth)) return auth
  const body = await readBody<{
    goal?: string; successMetric?: string; baseline?: Record<string, unknown>
    options?: OptionInput[]; evidence?: EvidenceInput[]; unknowns?: string[]
    reviewAt?: string; approvalRequired?: boolean
  }>(req)

  if (!body?.goal?.trim()) return jsonError("الهدف مطلوب (§28.2: المشكلة قبل الأداة)")
  const options = (body.options ?? []).filter((o) => o?.name?.trim())
  if (options.length < 2) return jsonError("قرار بدون بدائل حقيقية مرفوض — على الأقل بديلان (§28.2: مقارنة بدائل)")
  if (options.length > 6) return jsonError("الحد الأقصى 6 بدائل")

  const evidence = (body.evidence ?? [])
    .filter((e) => e?.source?.trim())
    .map((e) => ({
      source: e.source!.trim(),
      url: e.url?.trim() || null,
      date: e.date?.trim() || new Date().toISOString().slice(0, 10),
      kind: EVIDENCE_KINDS.includes(e.kind as never) ? e.kind : "OBSERVED",
    }))
  if (evidence.length < 1) return jsonError("بطاقة قرار بلا دليل مؤرخ مرفوضة (§28.2: دليل قبل ادعاء)")

  // قرارات عالية الخطورة → موافقة المالك إلزامية (§32 جدول الاستقلالية)
  const approvalRequired = body.approvalRequired === true || HIGH_RISK_PATTERNS.test(body.goal)

  const card = await db.decisionCard.create({
    data: {
      workspaceId: auth.workspace.id,
      goal: body.goal.trim(),
      successMetric: body.successMetric?.trim() || null,
      baseline: (body.baseline ?? null) as never,
      options: options as never,
      evidence: evidence as never,
      unknowns: (body.unknowns ?? []).filter((u) => u?.trim()) as never,
      reviewAt: body.reviewAt && !Number.isNaN(Date.parse(body.reviewAt)) ? new Date(body.reviewAt) : null,
      approvalRequired,
    },
  })
  return json({ card }, 201)
}
