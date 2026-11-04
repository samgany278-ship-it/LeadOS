// LeadOS — زرع قواعد بحث حقيقية لمساحة Ezz Company (غير مدمر — يضيف فقط)
// حسب وثائق المشروع: وحدة Rules (#4) — قواعد بحث + توسيع استعلامات + استثناءات
// Run: bun run scripts/seed-rules.ts
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

const RULES = [
  {
    name: "بيزنس مصري محتاج موقع/متجر إلكتروني",
    description: "مطاعم وكافيهات وعيادات ومحلات — عملاء خدمات Ezz Web",
    keywords: ["كافيه للبيع", "مطعم جديد", "عيادة تفتح", "محل يحتاج موقع", "متجر اونلاين"],
    industries: ["مطاعم", "كافيهات", "عيادات", "تجارة إلكترونية"],
    cities: ["القاهرة", "الجيزة", "الإسكندرية", "مدينة نصر"],
    sourceTypes: ["FACEBOOK", "INSTAGRAM", "DIRECTORY", "MARKETPLACE", "REVIEWS"],
    priority: 120,
  },
  {
    name: "طلبات صريحة لخدمات رقمية (نية شراء)",
    description: "ناس بتكتب محتاج/مطلوب/بدور على مبرمج أو تسويق أو سيستم",
    keywords: ["محتاج مبرمج", "مطلوب سيستم", "بدور على شركة تسويق", "محتاج موقع لشركتي", "رشحولي وكالة"],
    industries: ["خدمات رقمية"],
    cities: ["مصر"],
    sourceTypes: ["FREELANCE", "JOBS", "REDDIT", "TELEGRAM", "QUORA"],
    priority: 130,
  },
  {
    name: "معلنون وميزانيات إعلانية (AD_SPENDER)",
    description: "بيزنس بيصرف على إعلانات = عنده ميزانية — مكتبات الإعلانات",
    keywords: ["اعلانات ممولة", "حملة إعلانية"],
    industries: ["أي نشاط تجاري"],
    cities: ["مصر"],
    sourceTypes: ["ADS_LIBRARY", "GOOGLE_SEARCH", "LINKEDIN"],
    priority: 110,
  },
] as const

async function main() {
  const ws = await db.workspace.findFirst({ where: { name: { contains: "Ezz" } }, select: { id: true, name: true } })
  if (!ws) throw new Error("مساحة Ezz Company غير موجودة")
  console.log(`Workspace: ${ws.name} (${ws.id})`)

  let added = 0
  for (const r of RULES) {
    const exists = await db.searchRule.findFirst({ where: { workspaceId: ws.id, name: r.name } })
    if (exists) {
      console.log(`موجودة مسبقًا: ${r.name}`)
      continue
    }
    await db.searchRule.create({
      data: {
        workspaceId: ws.id,
        name: r.name,
        description: r.description,
        enabled: true,
        priority: r.priority,
        countries: ["مصر"],
        cities: [...r.cities],
        industries: [...r.industries],
        keywords: [...r.keywords],
        excludedWords: ["وظيفة خالية", "استيراد", "كراء"],
        sourceTypes: [...r.sourceTypes],
        minLeadScore: 0,
        startResearch: true,
        researchDepth: "DEEP",
        config: {},
      },
    })
    added++
    console.log(`✅ أُضيفت: ${r.name}`)
  }

  // مصدر ACTIVE واحد مطلوب للجدولة (الموجود: Browser Runtime Test) — نتأكد إن فيه واحد
  const activeSource = await db.source.findFirst({ where: { workspaceId: ws.id, status: "ACTIVE" } })
  if (!activeSource) {
    await db.source.create({
      data: { workspaceId: ws.id, name: "محرك الاكتشاف الرئيسي", type: "OTHER", status: "ACTIVE", config: {} },
    })
    console.log("✅ أُنشئ مصدر ACTIVE")
  }

  const total = await db.searchRule.count({ where: { workspaceId: ws.id, enabled: true } })
  console.log(`إجمالي القواعد المفعّلة الآن: ${total} (أُضيف هذه الجلسة: ${added})`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
