import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()
const jobs = await db.searchJob.findMany({ orderBy: { createdAt: "desc" }, take: 3 })
for (const j of jobs) {
  const meta = j.metadata as any
  const skillCount = meta?.skills?.length ?? 0
  const firstSkills = (meta?.skills ?? []).slice(0, 4).map((s: any) => `${s.platform}:${s.skill ?? "بلا مهارة"}(${s.why})`)
  const selBy = meta?.selectedBy ?? meta?.selectBy ?? null
  console.log(`جوب ${j.id} | ${j.status} | query="${(j.query ?? "").slice(0, 40)}" | results=${j.resultCount} | skills=${skillCount} | selectedBy=${selBy}`)
  if (firstSkills.length) console.log(`   أمثلة: ${firstSkills.join(" | ")}`)
}
const leads = await db.lead.count()
const recent = await db.lead.findMany({
  orderBy: { firstSeenAt: "desc" }, take: 6,
  select: { id: true, summary: true, sourcePlatform: true, intentSignal: true, score: true, intent: true, firstSeenAt: true },
})
console.log(`\nإجمالي الليدز: ${leads}`)
for (const l of recent) console.log(`  [${l.sourcePlatform ?? "?"}|${l.intentSignal ?? "-"}|${l.score}] ${(l.summary ?? "").slice(0, 70)}`)
const runs = await db.aiRun.count()
const lastRuns = await db.aiRun.findMany({ orderBy: { id: "desc" }, take: 8, select: { provider: true, model: true, type: true, latencyMs: true } })
console.log(`\nAiRun إجمالي: ${runs}`)
for (const r of lastRuns) console.log(`  ${r.provider}/${r.model} ${r.type} ${r.latencyMs ?? "-"}ms`)
const gitSkills = await (db as any).gitSkill.count().catch(() => "جدول GitSkill غير متاح")
console.log(`GitSkill مخزنة: ${gitSkills}`)
const lessons = await (db as any).skillLesson.count().catch(() => "غير متاح")
console.log(`SkillLesson دروس: ${lessons}`)
await db.$disconnect()
