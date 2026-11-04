// اختبار خط الإنتاج الكامل بصورة محلية: توليد AI → فتوشوب sharp → فيديو ffmpeg من الصورة
import { generateImage, touchupImage } from "../src/lib/creative/assets"
import { renderSlideVideo } from "../src/lib/creative/ffmpeg"

console.log("=== 1) توليد صورة AI (z-ai sdk — بدون مفتاح خارجي) ===")
const g = await generateImage("professional photo of a busy Egyptian restaurant interior, warm lighting", "1344x768")
console.log(`توليد: ok=${g.ok} url=${g.url ?? g.error}`)
if (!g.ok) process.exit(1)

console.log("\n=== 2) فتوشوب برمجي (sharp: تحجيم + علامة مائية + تشبع) ===")
const t = await touchupImage(g.url!, { width: 1280, watermark: "Ezz Company", saturation: 1.15 })
console.log(`فتوشوب: ok=${t.ok} url=${t.url ?? t.error}`)
if (!t.ok) process.exit(1)

console.log("\n=== 3) فيديو من الصورة (ffmpeg — صورة مولدة + نص عربي فوقها) ===")
const v = await renderSlideVideo([
  { text: "مطعمنا دلوقتي أونلاين", image: t.file, seconds: 2 },
  { text: "اطلب من الموبايل", seconds: 2 },
], "test-gen-video")
console.log(`فيديو: ok=${v.ok} url=${v.url ?? v.error}`)
console.log(`تحقق: ${JSON.stringify(v.verification)}`)
process.exit(v.ok ? 0 : 1)
