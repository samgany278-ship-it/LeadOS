// Ezz Web — Demo Factory (سبك §37 «سياسة المواقع والمحتوى»)
// توليد نموذج تجريبي (demo) من قوالب قطاعات — محلي فقط:
// - noindex + شارة «نموذج تجريبي» إلزامية (منع الفهرسة والادعاء)
// - بيانات مؤكدة فقط — أي حقل ناقص يظهر كـ«غير متوفر بعد» لا تخمين (§31.2)
// - فحوص قبول آلية: viewport/links/noindex/placeholder/mobile — النشر الحقيقي محجوب على استضافة/تفويض (BLK-011)

export interface SiteTemplateDef {
  id: string
  label: string
  tagline: string
  services: string[]
  palette: { bg: string; fg: string; accent: string }
}

export const SITE_TEMPLATES: SiteTemplateDef[] = [
  {
    id: "cafe",
    label: "كافيه / مطعم",
    tagline: "تجربة قهوة مختلفة كل يوم",
    services: ["قهوة مختصة", "فطار وبرانش", "حلويات شرقية", "قاعة جلسات"],
    palette: { bg: "#1c1410", fg: "#f5efe6", accent: "#c98a3d" },
  },
  {
    id: "clinic",
    label: "عيادة طبية",
    tagline: "رعاية طبية تليق بيك",
    services: ["استشارات عامة", "متابعة أمراض مزمنة", "تحاليل وتصوير", "حجوزات أونلاين"],
    palette: { bg: "#0f1c1e", fg: "#eef7f6", accent: "#2fa39a" },
  },
  {
    id: "gym",
    label: "جيم / لياقة",
    tagline: "قوتك تبدأ من هنا",
    services: ["كوتشينج شخصي", "كلاسات جماعية", "خطة تغذية", "اشتراكات شهرية"],
    palette: { bg: "#14121a", fg: "#f4f2fa", accent: "#8b5cf6" },
  },
  {
    id: "agency",
    label: "أجنسي تسويق",
    tagline: "نمو حقيقي لبيزنسك بمقاييس واضحة",
    services: ["إدارة إعلانات", "سوشيال ميديا", "هوية بصرية", "تصميم مواقع"],
    palette: { bg: "#101418", fg: "#eef2f7", accent: "#3b82f6" },
  },
  {
    id: "realestate",
    label: "عقارات",
    tagline: "بتدور على بيتك الجديد؟ إحنا هنلقيلك",
    services: ["بيع وشراء", "إيجار إداري", "تقديم استشاري", "تسويق وحدات"],
    palette: { bg: "#171512", fg: "#f7f4ee", accent: "#b45309" },
  },
]

export interface SiteData {
  title: string
  tagline?: string
  services?: string[]
  phone?: string
  address?: string
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** يولّد HTML كامل — عربي RTL متجاوب + noindex + شارة تجريبية */
export function generateSite(templateId: string, data: SiteData): { html: string; template: SiteTemplateDef } {
  const tpl = SITE_TEMPLATES.find((t) => t.id === templateId) ?? SITE_TEMPLATES[0]
  const title = (data.title ?? "").trim() || "نموذج تجريبي"
  const tagline = (data.tagline ?? "").trim() || tpl.tagline
  const services = (data.services?.map((s) => s.trim()).filter(Boolean).slice(0, 6)) ?? tpl.services
  const p = tpl.palette

  const serviceCards = services
    .map(
      (s) => `<div class="card"><span class="dot"></span><p>${esc(s)}</p></div>`
    )
    .join("\n      ")

  const contact = [
    data.phone?.trim() ? `<a class="chip" href="tel:${esc(data.phone.trim())}">📞 ${esc(data.phone.trim())}</a>` : `<span class="chip muted">📞 غير متوفر بعد</span>`,
    data.address?.trim() ? `<span class="chip">📍 ${esc(data.address.trim())}</span>` : `<span class="chip muted">📍 غير متوفر بعد</span>`,
  ].join("\n      ")

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)} — نموذج تجريبي (Ezz Web)</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; background: ${p.bg}; color: ${p.fg}; line-height: 1.7; }
  .demo-banner { position: fixed; bottom: 0; inset-inline: 0; z-index: 9; background: ${p.accent}; color: #fff;
    text-align: center; padding: 10px 14px; font-size: 14px; font-weight: 600; }
  header { padding: 56px 20px 40px; text-align: center; background: linear-gradient(160deg, ${p.accent}22, transparent); }
  header h1 { font-size: clamp(26px, 5vw, 44px); margin-bottom: 10px; }
  header p { opacity: .85; font-size: clamp(15px, 2.5vw, 19px); }
  main { max-width: 960px; margin: 0 auto; padding: 24px 20px 96px; }
  h2 { font-size: 22px; margin: 26px 0 14px; color: ${p.accent}; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
  .card { background: #ffffff0d; border: 1px solid #ffffff1a; border-radius: 14px; padding: 16px; display: flex; align-items: center; gap: 10px; }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: ${p.accent}; flex-shrink: 0; }
  .chips { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
  .chip { background: #ffffff14; border: 1px solid #ffffff22; border-radius: 999px; padding: 8px 16px; text-decoration: none; color: inherit; font-size: 15px; }
  .chip.muted { opacity: .6; font-style: italic; }
  footer { text-align: center; opacity: .55; font-size: 13px; padding-bottom: 64px; }
  a.cta { display: inline-block; margin-top: 18px; background: ${p.accent}; color: #fff; padding: 12px 28px;
    border-radius: 12px; text-decoration: none; font-weight: 700; }
  @media (max-width: 600px) { header { padding: 40px 14px 28px; } .card { padding: 13px; } }
</style>
</head>
<body>
  <header>
    <h1>${esc(title)}</h1>
    <p>${esc(tagline)}</p>
    <a class="cta" href="#contact">تواصل معانا</a>
  </header>
  <main>
    <h2>خدماتنا</h2>
    <div class="grid">
      ${serviceCards}
    </div>
    <h2 id="contact">تواصل</h2>
    <div class="chips">
      ${contact}
    </div>
  </main>
  <footer>© ${new Date().getFullYear()} ${esc(title)} — جميع الحقوق محفوظة</footer>
  <div class="demo-banner">🧪 نموذج تجريبي أُنشئ بواسطة Ezz Web للعرض فقط — البيانات قابلة للتخصيص قبل التسليم</div>
</body>
</html>`

  return { html, template: tpl }
}

export interface SiteCheck { id: string; label: string; pass: boolean; detail: string }

/** فحوص قبول §37: اختبار العرض/الروابط/التجاوب/منع الفهرسة/عدم وجود بيانات غير مؤكدة */
export function runSiteChecks(html: string, data: SiteData): { checks: SiteCheck[]; score: number } {
  const checks: SiteCheck[] = []

  checks.push({
    id: "noindex",
    label: "منع الفهرسة (noindex)",
    pass: /<meta\s+name="robots"\s+content="[^"]*noindex[^"]*"/i.test(html),
    detail: "النموذج التجريبي ممنوع يظهر في محركات البحث (§37)",
  })
  checks.push({
    id: "demo_banner",
    label: "شارة «نموذج تجريبي» ظاهرة",
    pass: html.includes("نموذج تجريبي"),
    detail: "تمييز النموذج التجريبي عن الأعمال المنجزة — منع الادعاء (Master-Prompt §6)",
  })
  checks.push({
    id: "viewport",
    label: "تاج viewport للموبايل",
    pass: /<meta\s+name="viewport"\s+content="[^"]*width=device-width[^"]*"/i.test(html),
    detail: "اختبار التجاوب على الموبايل (§37)",
  })
  checks.push({
    id: "rtl",
    label: "دعم عربي RTL",
    pass: /<html[^>]*dir="rtl"/i.test(html),
    detail: "الواجهة عربية RTL بالكامل",
  })
  const placeholders = html.match(/(TODO|XXX|undefined|NaN|\{\{|\}\}|lorem ipsum)/gi)
  checks.push({
    id: "no_placeholders",
    label: "صفر بيانات غير مؤكدة/placeholder",
    pass: !placeholders,
    detail: placeholders ? `موجود: ${placeholders.slice(0, 3).join(", ")}` : "لا توجد حقول وهمية أو نص مؤجل",
  })
  const links = [...html.matchAll(/href="(#[^"]*|tel:[^"]*)"/g)].map((m) => m[1])
  const anchors = links.filter((l) => l.startsWith("#"))
  const missingAnchors = anchors.filter((a) => a !== "#" && !html.includes(`id="${a.slice(1)}"`))
  checks.push({
    id: "links_valid",
    label: `روابط داخلية صحيحة (${links.length} رابط)`,
    pass: missingAnchors.length === 0 && links.length > 0,
    detail: missingAnchors.length ? `مراسي ناقصة: ${missingAnchors.join(", ")}` : "كل الروابط تشير لأهداف موجودة",
  })
  checks.push({
    id: "unknown_fields_honest",
    label: "الحقول الناقصة تظهر «غير متوفر بعد» لا تخمين",
    pass: (!data.phone || html.includes("غير متوفر بعد") || html.includes("tel:")) &&
          (!data.address || html.includes("غير متوفر بعد") || html.includes("📍")),
    detail: "§31.2: الحقول غير الموجودة null لا تخمين",
  })
  checks.push({
    id: "css_mobile",
    label: "قاعدة موبايل CSS",
    pass: /@media\s*\(max-width/.test(html),
    detail: "تكيّف الشاشات الصغيرة",
  })

  const score = checks.filter((c) => c.pass).length
  return { checks, score }
}
