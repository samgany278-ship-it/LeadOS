// تشخيص: منين example.com بيدخل؟ اختبار الأدابترات عبر runDiscovery على مصدر مؤقت
// platformAdapter غير مُصدَّر — نستخدم rawWebSearch (نفس السلسلة) + فحص فولباك reddit مباشر
import { rawWebSearch } from "/home/z/my-project/src/lib/discovery"

async function main() {
  for (const q of ["site:reddit.com مطلوب مبرمج مصر", "site:facebook.com جروب بيزنس مصر", "site:t.me أعمال مصر"]) {
    console.log(`═══ rawWebSearch: ${q} ═══`)
    try {
      const { results, provider } = await rawWebSearch(q, 5, 30)
      console.log(`  provider: ${provider} | count: ${results.length}`)
      for (const it of results.slice(0, 4)) {
        console.log(`  [title=${(it.title ?? "").slice(0, 45)}] url=${(it.url ?? "").slice(0, 70)}`)
      }
    } catch (e) {
      console.log("  خطأ:", (e as Error).message.slice(0, 150))
    }
  }
  console.log("═══ فحص مباشر: bun fetch لـ reddit search.json ═══")
  try {
    const res = await fetch("https://www.reddit.com/search.json?q=test&limit=2", { headers: { "User-Agent": "LeadOS/1.0" } })
    const text = await res.text()
    console.log(`  status=${res.status} | first 90 chars: ${text.slice(0, 90).replace(/\n/g, " ")}`)
  } catch (e) {
    console.log("  خطأ:", (e as Error).message.slice(0, 150))
  }
  process.exit(0)
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1) })
