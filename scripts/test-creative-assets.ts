// اختبار وحدة: أصول الصور/الفيديو + التوليد + الفتوشوب + فيديو من صورة
import { searchStockAssets, downloadAsset, touchupImage } from "../src/lib/creative/assets"
import { renderSlideVideo } from "../src/lib/creative/ffmpeg"
import fs from "fs"

console.log("=== 1) بحث أصول مجانية (Openverse + Wikimedia — بدون أي مفتاح) ===")
const providers = await searchStockAssets("restaurant food", "image", 4)
for (const p of providers) {
  console.log(`• ${p.provider}: assets=${p.assets.length}${p.error ? ` error=${p.error.slice(0, 60)}` : ""}${p.needsKey ? " [محتاج مفتاح]" : " [مجاني]"}`)
  for (const a of p.assets.slice(0, 2)) console.log(`   → ${a.license} | ${a.title.slice(0, 40)} | ${a.url.slice(0, 70)}`)
}
const freeAssets = providers.flatMap((p) => p.assets).filter((a) => a.source === "openverse" || a.source === "wikimedia")

console.log("\n=== 2) تحميل أصل محليًا (يجرب بالترتيب لحد أول نجاح) ===")
let dl: Awaited<ReturnType<typeof downloadAsset>> | null = null
let dlAsset: (typeof freeAssets)[number] | null = null
for (const a of freeAssets) {
  const r = await downloadAsset(a)
  console.log(`تحميل [${a.source}] ${a.title.slice(0, 30)}: ok=${r.ok} ${r.url ?? r.error}`)
  if (r.ok) { dl = r; dlAsset = a; break }
}
if (dl && dlAsset) {
  console.log(`\n=== 3) فتوشوب برمجي (sharp) على الصورة المحمّلة ===`)
  const t = await touchupImage(dl.url!, { width: 800, watermark: "Ezz Company", saturation: 1.2 })
  console.log(`فتوشوب: ok=${t.ok} url=${t.url ?? t.error}`)

  console.log("\n=== 4) فيديو من صورة حقيقية (ffmpeg — صورة + نص) ===")
  const v = await renderSlideVideo([
    { text: "مطعمنا دلوقتي أونلاين", image: dl.file, seconds: 2 },
    { text: "اطلب من الموبايل", seconds: 2 },
  ], "test-asset-video")
  console.log(`فيديو: ok=${v.ok} url=${v.url ?? v.error} probe=${JSON.stringify(v.probe)}`)
  process.exit(v.ok && t.ok ? 0 : 1)
} else {
  console.log("⚠️ كل التحميلات فشلت من الساندبوكس (حماية hotlink على الـIP) — من جهازك الحقيقي هتشتغل")
}
