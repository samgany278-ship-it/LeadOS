// اختبار مباشر: (1) سلسلة البحث SERP — فين الـjunk بتاع example.com؟ (2) تصنيف عنصر مستقل حقيقي
import { rawWebSearch } from "/home/z/my-project/src/lib/discovery"

async function main() {
  console.log("═══ 1) اختبار سلسلة البحث على استعلام site:reddit.com ═══")
  try {
    const { results, provider } = await rawWebSearch("site:reddit.com مطلوب مبرمج مصر", 5, 30)
    console.log(`  provider: ${provider}`)
    for (const it of results.slice(0, 5)) {
      console.log(`  [${(it.title ?? "").slice(0, 50)}] url=${(it.url ?? "").slice(0, 60)}`)
    }
    if (!results.length) console.log("  (لا نتائج)")
  } catch (e) {
    console.log("  خطأ:", (e as Error).message.slice(0, 120))
  }

  console.log("\n═══ 2) تصنيف عنصر مستقل حقيقي ═══")
  const { classifyContent } = await import("../src/lib/classification")
  const ws = await (await import("../src/lib/db")).db.workspace.findFirst({ select: { id: true } })
  if (!ws) return console.log("لا مساحة عمل")
  const cls = await classifyContent(
    ws.id,
    "مطلوب كاتب محتوى تريندي بالمصري | مستقل",
    "مشروع من مستقل: مطلوب كاتب محتوى تريندي بالمصري لمتجر اونلاين. الميزانية 500 جنيه. مطلوب 10 بوستات شهريا.",
    JSON.stringify({ platform: "FREELANCE", url: "https://mostaql.com/project/xyz" }),
  )
  console.log("  is_lead:", cls.classification.is_lead, "| score:", cls.classification.score, "| intent:", cls.classification.intent)
  console.log("  reason:", (cls.classification.reason ?? "").slice(0, 120))
  process.exit(0)
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1) })
