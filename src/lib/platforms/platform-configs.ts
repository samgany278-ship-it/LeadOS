/**
 * Ezz / LeadOS — إعدادات المنصات الـ20 + بوابة السياسة
 * -----------------------------------------------------
 * المصدر: Ezz-Company-OS-Spec §4 (المصادر وأشكال الأسئلة والحداثة) + الملحق D (الأنواع)
 * + §20.3/§20.4 (الحالات وطرق الوصول) + §22 (مراجع السياسات)
 *
 * القواعد المنقولة حرفيًا من الوثيقة:
 *  - REDDIT + TELEGRAM «مجاني دايمًا — بيشتغلوا أول أول» (§4).
 *  - الحداثة: كورا/ديسكورد 90 يومًا · فعاليات/معارض 75 · أدلة/تقييمات 60 · إعلانات/سوق 30 (§4).
 *  - أشكال الأسئلة بلغة المنصة: ووظايف تفهم «مطلوب»، أوليكس يفهم «للبيع»، كورا تفهم «أفضل/إزاي» + بذور مضمونة (§4).
 *  - geoPin: مصر تلقائيًا إلا لو الاستعلام خليجي (§4).
 *  - لينكدإن: يمنع الكشط — APIs/شراكات رسمية فقط (§20.4 + §22)؛ البروفايلات الشخصية /in/ مرفوضة أصلًا (§5).
 *  - واتساب: WhatsApp Business Platform فقط — لا أتمتة ويب كبديل تلقائي (§20.4).
 */

import type { AccessMethod, PlatformType, PolicyVerdict } from './contract.ts';

export interface PlatformConfig {
  type: PlatformType;
  displayName: string;
  /** فلاتر site: — يمنع تسريب النتايج بين المنصات (§4 matchesSite: host+path) */
  domains: string[];
  /** أشكال الأسئلة بلغة المنصة (§4 PLATFORM_QUERY_SHAPES) — {niche} يُستبدل بالنيش */
  queryShapes: string[];
  /** بذور مضمونة لكل منصة (§4) */
  seedQueries: string[];
  /** حداثة المحتوى بالأيام — null = تُحدد من SearchRule عند الدمج (§4) */
  freshnessDays: number | null;
  /** هل الوصول العميق يحتاج حساب/جلسة مستخدم؟ (§20.3/§20.4) */
  requiresLogin: boolean;
  /** هل يوجد API رسمي يمكن تفعيله بمفتاح (المفتاح ليس تسجيل دخول مستخدم)؟ */
  officialApiAvailable: boolean;
  accessMethod: AccessMethod;
  /** سبب الحاجة لتسجيل الدخول — يظهر للمستخدم (§20.11-2) */
  loginReason: string | null;
  policyNote: string;
  /** مراجع سياسات §22 الخاصة بالمنصة */
  policyRefs: string[];
}

// مراجع §22 الموثقة في الوثيقة
const REF = {
  meta: 'https://www.facebook.com/legal/automated_data_collection_terms',
  linkedin: 'https://www.linkedin.com/help/linkedin/answer/a1341387/prohibition-of-scraping-software?lang=en-us',
  reddit: 'https://support.reddithelp.com/hc/en-us/articles/360043512931-Don-t-break-the-site',
  xAutomation: 'https://help.x.com/en/rules-and-policies/x-automation',
  googleOAuth: 'https://developers.google.com/identity/protocols/oauth2/',
} as const;

export const PLATFORM_CONFIGS: Record<PlatformType, PlatformConfig> = {
  // =========================================================================
  // القسم الأول — منصات بدون تسجيل دخول (أمر المالك: كلها أولًا)
  // =========================================================================

  REDDIT: {
    type: 'REDDIT',
    displayName: 'ريديت',
    domains: ['reddit.com'],
    // §4: REDDIT «مجاني دايمًا» — أول أول في expandSourceTypes
    queryShapes: ['{niche} مصر reddit', 'site:reddit.com {niche} recommendation', '{niche} بديل توصية reddit'],
    seedQueries: ['افضل شركة برمجيات في مصر reddit'],
    freshnessDays: null, // غير محددة في الوثيقة — تُضبط من SearchRule عند الدمج
    requiresLogin: false,
    officialApiAvailable: false, // القراءة العامة JSON لا تحتاج مفتاحًا؛ أي توسعة مستقبلًا عبر Data API رسميًا
    accessMethod: 'PUBLIC_WEB',
    loginReason: null,
    policyNote: 'قراءة عامة فقط — لا حسابات ولا رسائل ولا تصويت آلي (§22: Reddit يمنع الكشط غير المصرح به)',
    policyRefs: [REF.reddit],
  },

  TELEGRAM: {
    type: 'TELEGRAM',
    displayName: 'تليجرام',
    domains: ['t.me'],
    // §4: TELEGRAM «مجاني دايمًا» — أول أول؛ §11: من ضمن GROUP_PLATFORMS لمراقبة الجروبات
    queryShapes: ['{niche} قناة تليجرام مصر', 'site:t.me {niche}', '{niche} جروب تليجرام'],
    seedQueries: ['{niche} مصر تليجرام'],
    freshnessDays: null,
    requiresLogin: false,
    officialApiAvailable: true, // Bot API يحتاج بوت موثق — البوت لا يرى إلا ما تسمح به صلاحياته (§20.4)
    accessMethod: 'PUBLIC_WEB',
    loginReason: null,
    policyNote: 'معاينة القنوات العامة t.me/s/ + Bot API مصرح به — لا انضمام آلي ولا رسائل جماعية',
    policyRefs: [],
  },

  QUORA: {
    type: 'QUORA',
    displayName: 'كورا',
    domains: ['quora.com', 'ar.quora.com'],
    // §4: كورا بتفهم «أفضل/إزاي» + حداثة 90 يومًا + درس موثق §6
    queryShapes: ['افضل {niche} في مصر', 'إزاي أختار {niche}', '{niche} بديل توصية'],
    seedQueries: ['افضل برنامج كاشير للمطاعم الصغيرة'], // درس محفوظ من ليدز حقيقية (§6)
    freshnessDays: 90,
    requiresLogin: false,
    officialApiAvailable: false,
    accessMethod: 'SEARCH_PROVIDER',
    loginReason: null,
    policyNote: 'أسئلة وردود عامة عبر مزود البحث — أسئلة النية هي الأهم هنا (§20.6-2)',
    policyRefs: [],
  },

  FREELANCE: {
    type: 'FREELANCE',
    displayName: 'منصات العمل الحر (مستقل/خمسات)',
    domains: ['mostaql.com', 'khamsat.com'],
    // §4: أوليكس بيفهم «للبيع» — ناس بتشتري خدمات
    queryShapes: ['{niche} مطلوب مستقل', '{niche} للبيع خمسات', 'مطلوب مبرمج {niche} مستقل'],
    seedQueries: ['مطلوب مطور موقع مستقل'],
    freshnessDays: null,
    requiresLogin: false,
    officialApiAvailable: false,
    accessMethod: 'SEARCH_PROVIDER',
    loginReason: null,
    policyNote: 'قوائم مشاريع عامة — مراجعة شروط كل منصة قبل أي توسعة (§20.4: فحص شروط كل مصدر)',
    policyRefs: [],
  },

  JOBS: {
    type: 'JOBS',
    displayName: 'الوظائف (wuzzuf)',
    domains: ['wuzzuf.net'],
    // §4: ووظايف بتفهم «مطلوب» — §5: JOBS مدير/مبرمج/مبيعات/تسويق فقط
    queryShapes: ['مطلوب مدير {niche}', 'مطلوب مبرمج {niche}', 'وظائف مبيعات وتسويق {niche}'],
    seedQueries: ['مطلوب مدير تسويق شركة مصر'],
    freshnessDays: null,
    requiresLogin: false,
    officialApiAvailable: false,
    accessMethod: 'SEARCH_PROVIDER',
    loginReason: null,
    policyNote: 'فلتر الأدوار إلزامي: مدير/مبرمج/مبيعات/تسويق فقط (§5) — الباقي يُستبعد',
    policyRefs: [],
  },

  ADS_LIBRARY: {
    type: 'ADS_LIBRARY',
    displayName: 'مكتبات الإعلانات (Meta/TikTok/LinkedIn)',
    domains: ['facebook.com/ads/library', 'library.tiktok.com', 'linkedin.com/ad-library'],
    // §4: مكتبة إعلانات ميتا + تيك توك + لينكدإن — حداثة 30 يومًا (§4: إعلانات/سوق 30)
    queryShapes: ['{niche} إعلانات ممولة مصر', '{niche} ads'],
    seedQueries: ['{niche} مصر إعلان'],
    freshnessDays: 30,
    requiresLogin: false,
    officialApiAvailable: false,
    accessMethod: 'PUBLIC_WEB',
    loginReason: null,
    policyNote: 'مكتبات الإعلانات عامة بالتصميم — النتايج تُوسم AD_SPENDER (§5: مكافأتها وتقييمها في خط الابتلاع)',
    policyRefs: [REF.meta],
  },

  DIRECTORY: {
    type: 'DIRECTORY',
    displayName: 'أدلة الأعمال',
    domains: [], // §4 لا تسمي دومينات الأدلة — تُغذى من SearchRule؛ MARKET_LIST بحد أدنى score≥45 (§5)
    queryShapes: ['دليل شركات {niche} مصر', 'شركات {niche} في مصر قائمة'],
    seedQueries: ['دليل شركات برمجيات مصر'],
    freshnessDays: 60,
    requiresLogin: false,
    officialApiAvailable: false,
    accessMethod: 'SEARCH_PROVIDER',
    loginReason: null,
    policyNote: 'بيزنس مسجل رسميًا — isListingBusiness يتأكد أن القوائم الحقيقية لا تُرفض بالغلط (§5)',
    policyRefs: [],
  },

  REVIEWS: {
    type: 'REVIEWS',
    displayName: 'التقييمات (TripAdvisor/Elmenus/Maps)',
    domains: ['tripadvisor.com', 'elmenus.com'],
    // §4: maps + tripadvisor + elmenus — حداثة 60 (§4: أدلة/تقييمات 60)
    queryShapes: ['{niche} تقييمات شكاوى', '{niche} reviews complaints مصر'],
    seedQueries: ['{niche} مصر تقييمات'],
    freshnessDays: 60,
    requiresLogin: false,
    officialApiAvailable: false,
    accessMethod: 'SEARCH_PROVIDER',
    loginReason: null,
    policyNote: 'بيزنس عنده شكاوى تقييمات = فرصة خدمة — بيزنس مؤهل فقط (§5)',
    policyRefs: [],
  },

  EVENTS: {
    type: 'EVENTS',
    displayName: 'الفعاليات والمعارض',
    domains: ['facebook.com/events', 'egyta.com', 'cairoict.com'],
    // §4: fb/events + egyta + cairoict + إكسبوهات — حداثة 75 (§4: معارض 75)
    // ملاحظة: دومين egyta يحتاج تأكيدًا من قواعد البحث الفعلية عند الدمج
    queryShapes: ['معارض ومؤتمرات {niche} مصر 2026', '{niche} expo cairo'],
    seedQueries: ['معرض تكنولوجيا القاهرة'],
    freshnessDays: 75,
    requiresLogin: false,
    officialApiAvailable: false,
    accessMethod: 'SEARCH_PROVIDER',
    loginReason: null,
    policyNote: 'فعاليات B2B وشبكينج عامة — صفحات الفعاليات العامة فقط',
    policyRefs: [],
  },

  DISCORD: {
    type: 'DISCORD',
    displayName: 'ديسكورد (اكتشاف بالبحث فقط)',
    domains: ['discord.com', 'discord.gg'],
    // §4: حداثة 90 (كورا/ديسكورد 90) — §11: مراقبة الجروبات لا تشمل DISCORD (GROUP_PLATFORMS فقط)
    queryShapes: ['{niche} discord server مصر', 'site:discord.gg {niche}'],
    seedQueries: ['{niche} discord مجتمع'],
    freshnessDays: 90,
    requiresLogin: true, // الانضمام والقراءة العميقة يحتاج دعوة/حساب — الاكتشاف عبر مزود البحث فقط
    officialApiAvailable: true, // Bot API للسيرفرات المصرح بها فقط (§20.4: البوت لا يرى إلا ما تسمح به صلاحياته)
    accessMethod: 'SEARCH_PROVIDER',
    loginReason: 'قراءة محتوى السيرفرات تحتاج دعوة وحسابًا — الاكتشاف العام عبر مزود البحث فقط؛ مراقبة الجروبات غير مدعومة لها في التوثيق (§11)',
    policyNote: 'اكتشاف دعوات عامة فقط — لا انضمام آلي للحسابات',
    policyRefs: [],
  },

  GOOGLE_MAPS: {
    type: 'GOOGLE_MAPS',
    displayName: 'خرائط جوجل',
    domains: ['google.com/maps'],
    // §4: Serper Places ← Google Places — GOOGLE_MAPS_API_KEY موجودة على Vercel (ملحق E)
    queryShapes: ['{niche} قريبة مني', '{niche} في مصر'],
    seedQueries: ['{niche} مصر'],
    freshnessDays: null,
    requiresLogin: false,
    officialApiAvailable: true, // مفتاح API رسمي — المفتاح ليس تسجيل دخول مستخدم
    accessMethod: 'OFFICIAL_API',
    loginReason: null,
    policyNote: 'API رسمي (Places) أو مزود بحث متوافق — حدود الرصيد والدقة الجغرافية تُعرض في مركز المنصات (§20.4)',
    policyRefs: [REF.googleOAuth],
  },

  GOOGLE_SEARCH: {
    type: 'GOOGLE_SEARCH',
    displayName: 'بحث جوجل العام (عبر المزودين)',
    domains: [],
    // §13: سلسلة البحث — Exa هو محرك المنصات الأساسي، ثم Tavily/z-ai/SerpAPI؛ Serper منتهي الرصيد تاريخيًا (2026-09-28)
    queryShapes: ['{niche} مصر'],
    seedQueries: ['{niche}'],
    freshnessDays: null,
    requiresLogin: false,
    officialApiAvailable: true,
    accessMethod: 'SEARCH_PROVIDER',
    loginReason: null,
    policyNote: 'عبر مزودي البحث الموثوقين بمفاتيح — لا يفتح متصفح المستخدم بلا داعٍ (§20.2)',
    policyRefs: [],
  },

  WEBSITE: {
    type: 'WEBSITE',
    displayName: 'مواقع الشركات (ويب عام)',
    domains: [],
    // §20.4: HTTP أو sitemap أو صفحات عامة مع احترام شروط الموقع — detectAdPixels للبيكسلات (§5)
    queryShapes: ['{niche} موقع رسمي مصر'],
    seedQueries: ['{niche} شركة مصر'],
    freshnessDays: null,
    requiresLogin: false,
    officialApiAvailable: false,
    accessMethod: 'PUBLIC_WEB',
    loginReason: null,
    policyNote: 'صفحات عامة فقط — لا زحف إلى مناطق خاصة أو محتوى يحتاج صلاحيات غير ممنوحة (§20.4)',
    policyRefs: [],
  },

  YOUTUBE: {
    type: 'YOUTUBE',
    displayName: 'يوتيوب',
    domains: ['youtube.com'],
    // الملحق D: YOUTUBE ضمن المصادر — §36 مرجع YouTube Data API الرسمي
    queryShapes: ['{niche} مصر يوتيوب', 'site:youtube.com {niche}'],
    seedQueries: ['{niche} شرح'],
    freshnessDays: null,
    requiresLogin: false,
    officialApiAvailable: true, // YouTube Data API بمفتاح — وظائفه محددة ولا تعني تصريحًا لكل جمع بيانات (§20.4)
    accessMethod: 'SEARCH_PROVIDER',
    loginReason: null,
    policyNote: 'بحث عام أو Data API رسمي — وجود API لا يعني الإذن بكل نوع من جمع البيانات (§20.4)',
    policyRefs: [],
  },

  // =========================================================================
  // القسم الثاني — منصات محتاجة تسجيل دخول/تفويض رسمي (أمر المالك: في الآخر)
  // =========================================================================

  FACEBOOK: {
    type: 'FACEBOOK',
    displayName: 'فيسبوك',
    domains: ['facebook.com'],
    queryShapes: [],
    seedQueries: [],
    freshnessDays: null,
    requiresLogin: true,
    officialApiAvailable: true,
    accessMethod: 'LOCAL_BROWSER',
    loginReason: 'الجلسات والستيلث تعمل عبر متصفح محلي بكوكيز جلسة (§11) — تاريخيًا متوقفة بسبب سقف Modal (§17)؛ الوصول العميق يحتاج تسجيل دخول المستخدم بنفسه (§20.2)',
    policyNote: 'لا يُفترض أن تسجيل الدخول الشخصي يجيز كشط الصفحات/المجموعات آليًا (§20.4) — شروط Meta للجمع الآلي تتطلب إذنًا صريحًا',
    policyRefs: [REF.meta],
  },

  INSTAGRAM: {
    type: 'INSTAGRAM',
    displayName: 'انستجرام',
    domains: ['instagram.com'],
    queryShapes: [],
    seedQueries: [], // درس موثق (§6): «كافيه مصر انستجرام» — يُفعّل بعد تسجيل الدخول المحلي فقط
    freshnessDays: null,
    requiresLogin: true,
    officialApiAvailable: true, // Instagram Platform (§36)
    accessMethod: 'LOCAL_BROWSER',
    loginReason: 'الملفات والهاشتاجات تحتاج جلسة مستخدم — يدخل بنفسه في المتصفح المحلي ويُنجز التحقق بنفسه (§20.2/§20.3)',
    policyNote: 'APIs الرسمية والصلاحيات الممنوحة فقط — لا كشط بالجلسة الشخصية (§20.4)',
    policyRefs: [REF.meta],
  },

  TIKTOK: {
    type: 'TIKTOK',
    displayName: 'تيك توك',
    domains: ['tiktok.com'],
    queryShapes: [],
    seedQueries: [],
    freshnessDays: null,
    requiresLogin: true,
    officialApiAvailable: true, // TikTok Content Posting API (§36) — للنشر، والجمع عبر مساراته الرسمية
    accessMethod: 'LOCAL_BROWSER',
    loginReason: 'الوصول العميق يحتاج حسابًا — والنشر عبر Content Posting API الرسمي بموافقة صاحب الحساب (§20.4/§36)',
    policyNote: 'وظائف كل API تختلف — لا يعتبر وجود API تصريحًا لكل نوع من جمع البيانات (§20.4)',
    policyRefs: [],
  },

  WHATSAPP: {
    type: 'WHATSAPP',
    displayName: 'واتساب',
    domains: [],
    queryShapes: [],
    seedQueries: [],
    freshnessDays: null,
    requiresLogin: true,
    officialApiAvailable: true, // WhatsApp Business Platform (§20.4)
    accessMethod: 'OFFICIAL_API',
    loginReason: 'الرسائل التجارية عبر WhatsApp Business Platform بموافقات المستخدمين — وأتمتة WhatsApp Web لا تُعتمد بديلًا تلقائيًا (§20.4)؛ الأرقام تُكتشف من القوائم العامة فقط',
    policyNote: 'ممنوع منعًا باتًا: رسالة مخصصة لقناة واحدة لكل ليد وخارج سياسة التواصل (§7) — أي ربط يحتاج موافقة المالك (§32)',
    policyRefs: [],
  },

  LINKEDIN: {
    type: 'LINKEDIN',
    displayName: 'لينكدإن',
    domains: ['linkedin.com'],
    queryShapes: [],
    seedQueries: [],
    freshnessDays: null,
    requiresLogin: true,
    officialApiAvailable: true,
    accessMethod: 'OFFICIAL_API',
    loginReason: 'لا تفعّل كشط الملفات أو أتمتة النشاط المخالفة للشروط — APIs أو شراكات/صلاحيات رسمية فقط (§20.4)؛ البروفايلات الشخصية /in/ مرفوضة من الجودة أصلًا (§5)',
    policyNote: 'لينكدإن يمنع أدوات الكشط والأتمتة غير المصرح بها صراحةً (§22) — الحالة POLICY_BLOCKED لأي مسار غير رسمي',
    policyRefs: [REF.linkedin],
  },

  X: {
    type: 'X',
    displayName: 'إكس (تويتر سابقًا)',
    domains: ['x.com', 'twitter.com'],
    queryShapes: [],
    seedQueries: [],
    freshnessDays: null,
    requiresLogin: true,
    officialApiAvailable: true,
    accessMethod: 'OFFICIAL_API',
    loginReason: 'API الرسمي أو وصول مصرح به صراحة — ومراقبة الجروبات (§11) تحتاج حسابًا؛ لا تجاوز لحدود API ولا جمع دون تصريح (§20.4)',
    policyNote: 'الأتمتة المسموحة مرتبطة بسياسات X وتصريحاتها (§22)',
    policyRefs: [REF.xAutomation],
  },
};

// ---------------------------------------------------------------------------
// بوابة السياسة — §20.4: توقف أي طريقة وصول غير مصرح بها وتشرح السبب
// بدل الالتفاف على القيود (§20.11-3)
// ---------------------------------------------------------------------------
export function validatePolicy(cfg: PlatformConfig): PolicyVerdict {
  if (cfg.type === 'LINKEDIN') {
    return {
      allowed: false,
      state: 'POLICY_BLOCKED',
      reason: 'الكشط ممنوع بشروط لينكدإن (§22) — المسار الوحيد المسموح API/شراكة رسمية بموافقة المالك',
      policyRefs: cfg.policyRefs,
    };
  }
  if (cfg.type === 'DISCORD') {
    // الاكتشاف عبر مزود البحث بدون دخول (§4) — الوصول العميق يحتاج دعوة/حسابًا
    // ولا يُنفذ آليًا؛ مراقبة الجروبات لا تشمل ديسكورد في التوثيق (§11 GROUP_PLATFORMS)
    return {
      allowed: true,
      state: 'PUBLIC_ACCESS',
      reason: 'اكتشاف عام عبر مزود البحث فقط (§4) — الانضمام/القراءة العميقة تحتاج دعوة وحسابًا ولا يُنفذان آليًا',
      policyRefs: cfg.policyRefs,
    };
  }
  if (cfg.type === 'WHATSAPP') {
    return {
      allowed: false,
      state: 'REQUIRES_APPROVAL',
      reason: 'رسائل واتساب فقط عبر WhatsApp Business Platform بموافقات صريحة (§20.4) — تحتاج موافقة المالك (§32)',
      policyRefs: cfg.policyRefs,
    };
  }
  if (cfg.requiresLogin) {
    return {
      allowed: false,
      state: 'NEEDS_USER_LOGIN',
      reason: cfg.loginReason ?? 'الوصول العميق يحتاج تسجيل دخول المستخدم في المتصفح المحلي (§20.2)',
      policyRefs: cfg.policyRefs,
    };
  }
  return {
    allowed: true,
    state: 'PUBLIC_ACCESS',
    reason: 'وصول عام مصرح به عبر مزود بحث/ويب عام بدون تسجيل دخول (§20.4)',
    policyRefs: cfg.policyRefs,
  };
}

// ---------------------------------------------------------------------------
