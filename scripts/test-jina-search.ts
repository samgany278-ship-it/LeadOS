// اختبار سريع: Jina Search (المفتاح الرابع) داخل سلسلة البحث الحقيقية
import { agentWebSearch } from "../src/lib/discovery"

const t0 = Date.now()
const { results, provider } = await agentWebSearch("مطعم محتاج موقع الكتروني القاهرة", 6, 30)
console.log(`provider=${provider} results=${results.length} in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
for (const r of results.slice(0, 6)) console.log(`• [${r.host_name}] ${r.name.slice(0, 70)} — ${r.url.slice(0, 80)}`)
if (!results.length) { console.error("❌ مفيش نتايج"); process.exit(1) }
console.log("✅ Jina شغال داخل السلسلة")
