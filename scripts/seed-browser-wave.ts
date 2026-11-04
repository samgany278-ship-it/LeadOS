// بذرة موجة إثبات المنصات — PUBLIC_FETCH عام بدون جلسة (طلب المالك 2026-11-04)
// «ابدأ دلوقتي بكل المنصات اللي مش محتاجة تسجيل دخول واللي هتشتغل من المتصفح»
// دوران بالساعة: كل موجة بتاخد رابط مختلف من مخزون كل منصة (HOUR % POOL)
// X/INSTAGRAM مستثناة من الدوران — ورا جدار دخول (NEEDS_SESSION موثق بصدق §34) — تحتاج كوكيز من المالك
import { db } from "@/lib/db"
import { seedPublicFetchJob } from "@/lib/browser/seed"

const POOL: Record<string, Array<[string, string]>> = {
  REDDIT: [
    ["https://old.reddit.com/r/egypt/new/", "r/egypt — الجديدة"],
    ["https://old.reddit.com/r/Cairo/new/", "r/Cairo — الجديدة"],
    ["https://old.reddit.com/r/egyptyouth/new/", "r/egyptyouth — الجديدة"],
  ],
  YOUTUBE: [
    ["https://www.youtube.com/results?search_query=%D9%85%D8%B7%D8%A7%D8%B9%D9%85+%D8%A7%D9%84%D9%82%D8%A7%D9%87%D8%B1%D8%A9", "مطاعم القاهرة"],
    ["https://www.youtube.com/results?search_query=%D8%B9%D9%8A%D8%A7%D8%AF%D8%A7%D8%AA+%D8%A3%D8%B3%D9%86%D8%A7%D9%86+%D8%A7%D9%84%D9%82%D8%A7%D9%87%D8%B1%D8%A9", "عيادات أسنان القاهرة"],
    ["https://www.youtube.com/results?search_query=%D8%B5%D8%A7%D9%84%D9%88%D9%86%D8%A7%D8%AA+%D8%AA%D8%AC%D9%85%D9%8A%D9%84+%D9%85%D8%B5%D8%B1", "صالونات تجميل مصر"],
    ["https://www.youtube.com/results?search_query=%D8%AC%D9%8A%D9%85+%D9%85%D8%B5%D8%B1", "جيم مصر"],
  ],
  TELEGRAM: [
    ["https://t.me/s/telegram", "قناة تليجرام الرسمية"],
    ["https://t.me/s/durov", "قناة دوروف"],
    ["https://t.me/s/telegramtips", "نصائح تليجرام الرسمية"],
  ],
  DISCORD: [
    ["https://discord.com/", "الصفحة العامة"],
    ["https://disboard.org/servers/tag/egypt", "دليل سيرفرات مصرية عامة"],
  ],
  TIKTOK: [
    ["https://www.tiktok.com/tag/egypt", "تاج مصر"],
    ["https://www.tiktok.com/tag/cairo", "تاج القاهرة"],
  ],
  LINKEDIN: [
    ["https://www.linkedin.com/company/linkedin/", "شركة لينكدإن"],
    ["https://www.linkedin.com/company/google/", "شركة جوجل"],
    ["https://www.linkedin.com/company/microsoft/", "شركة مايكروسوفت"],
  ],
  FACEBOOK: [
    ["https://mbasic.facebook.com/", "mbasic — فحص الجلسة/الجدار بصدق"],
  ],
}

const ws = await db.workspace.findFirst({ select: { id: true } })
if (!ws) {
  console.error("لا مساحة عمل")
  process.exit(1)
}

const hour = new Date().getHours()
let seeded = 0
for (const [platform, urls] of Object.entries(POOL)) {
  const [url, label] = urls[hour % urls.length]
  const id = await seedPublicFetchJob(ws.id, platform, url)
  if (id) seeded++
  console.log(`${id ? "🌱" : "⛔"} ${platform.padEnd(10)} ${label} — ${url.slice(0, 58)}`)
}

const queued = await db.job.count({ where: { type: "BROWSER_SCAN", status: "QUEUED" } })
console.log(`الموجة زرعت ${seeded} — الطابور دلوقتي: ${queued} جوبة متصفح`)
await db.$disconnect()
