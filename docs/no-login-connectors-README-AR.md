# Ezz — حزمة موصلات المنصات بدون تسجيل دخول (v0.1.0)

> **حالة الحزمة (قاعدة §38):** منفذة ومُختبَرة بوحداتها هنا (21/21 اختبار قبول ✓) —
> لكنها **غير مختبرة تكامليًا على المستودع الفعلي `C:\LeadOS`**. لا تُعتبر منجزة إلا
> بعد الدمج وتشغيل اختبار حي وتسجيل النتيجة في `worklog.md`.

## 1) فكرة الحزمة في سطرين

تنفيذ بند المالك: **المنصات اللي مش محتاجة تسجيل دخول كلها الأول، واللي محتاجين في الآخر** —
مبنية على عقد Platform Adapter الموحد (§20.5)، وحالات الاتصال (§20.3)، وأولوية طرق
الوصول (§20.4)، وميكانيزم المحرك الموثق (§4)، واختبارات القبول (§20.11).

**قرار تكامل آمن (Zero-Touch):** الحزمة **متلمسش أي ملف موجود** في LeadOS —
`discovery.ts` و`queue.ts` و`schema.prisma` كله زي ما هو. النتايج بتتبعت على
`/api/ingest/webhook` — نفس مسار الـWorker الخارجي بالظبط (§12) — فتمرّ على نفس خط
التطبيع ← منع التكرار ← تصنيف AI ← Scoring ← تنبيهات الموجود.

## 2) التصنيف المعتمد (من الوثيقة فقط)

### أولًا: 14 منصة بدون تسجيل دخول — `PUBLIC_ACCESS`

| # | المنصة | المسار | الحداثة | المرجع |
|---|---|---|---|---|
| 1 | **REDDIT** | JSON عام + مزود بحث | من SearchRule | §4 «مجاني دايمًا — أول أول» |
| 2 | **TELEGRAM** | معاينة t.me/s/ عامة + مزود بحث | من SearchRule | §4 «مجاني دايمًا — أول أول» |
| 3 | **QUORA** | مزود بحث | 90 يوم | §4 (كورا تفهم «أفضل/إزاي») |
| 4 | **FREELANCE** | مزود بحث (mostaql/khamsat) | من SearchRule | §4 «أوليكس يفهم للبيع» |
| 5 | **JOBS** | مزود بحث (wuzzuf) — مدير/مبرمج/مبيعات/تسويق فقط | من SearchRule | §4 + فلتر §5 |
| 6 | **ADS_LIBRARY** | مكتبات إعلانات عامة — يوسم AD_SPENDER | 30 يوم | §4 + §5 |
| 7 | **DIRECTORY** | مزود بحث — دومينات من SearchRule | 60 يوم | §4 + §5 (MARKET_LIST ≥45) |
| 8 | **REVIEWS** | tripadvisor/elmenus | 60 يوم | §4 |
| 9 | **EVENTS** | fb/events + egyta + cairoict | 75 يوم | §4 |
| 10 | **DISCORD** | اكتشاف بمزود بحث فقط (العمق محتاج دعوة/حساب) | 90 يوم | §4 + §11 |
| 11 | **GOOGLE_MAPS** | API رسمي بمفتاح موجود على Vercel / مزود | من SearchRule | §4 + ملحق E |
| 12 | **GOOGLE_SEARCH** | Exa أساسي ← Tavily ← SerpAPI (§13) | من SearchRule | §13 |
| 13 | **WEBSITE** | ويب عام | من SearchRule | §20.4 |
| 14 | **YOUTUBE** | مزود بحث / Data API | من SearchRule | ملحق D + §36 |

### ثانيًا: 6 منصات محتاجة تسجيل دخول/تفويض — موقوفة بالبوابة (في الآخر بأمر المالك)

| المنصة | الحالة | السبب المعلن للمستخدم |
|---|---|---|
| FACEBOOK | `NEEDS_USER_LOGIN` | جلسات/ستيلث محلية (§11) — تاريخيًا متوقفة بسقف Modal (§17) |
| INSTAGRAM | `NEEDS_USER_LOGIN` | الملفات/الهاشتاجات تحتاج جلسة المستخدم بنفسه (§20.2) |
| TIKTOK | `NEEDS_USER_LOGIN` | الوصول العميق حساب — والنشر عبر Content Posting API (§36) |
| X | `NEEDS_USER_LOGIN` | API رسمي أو وصول مصرح صراحةً (§22) |
| WHATSAPP | `REQUIRES_APPROVAL` | WhatsApp Business Platform فقط بموافقات (§20.4) + موافقة المالك (§32) |
| LINKEDIN | `POLICY_BLOCKED` | الكشط ممنوع بشروط لينكدإن (§22) — رسمي فقط |

## 3) التركيب على جهازك (Windows — C:\LeadOS)

```bat
:: 1) انسخ المجلد جوه المستودع
xcopy /E /I ezz-no-login-connectors\src\lib\platforms C:\LeadOS\src\lib\platforms
copy  ezz-no-login-connectors\runner\run-no-login-wave.ts C:\LeadOS\scripts\
copy  ezz-no-login-connectors\verify.ts C:\LeadOS\scripts\verify-no-login-platforms.ts

:: 2) شغّل اختبارات القبول (مش محتاج شبكة ولا مفاتيح)
cd C:\LeadOS && bunx tsx scripts\verify-no-login-platforms.ts

:: 3) أول موجة حية — DRY الأول دايمًا
bunx tsx scripts\run-no-login-wave.ts --niche "برامج محاسبة" --mode wave --dry

:: 4) موجة حية بإرسال فعلي (بعد التأكد من صيغة الترويسة — انظر §6)
set LEADOS_BASE_URL=https://leados-v2.vercel.app
set INGEST_API_KEY=<من Vercel Environment Variables>
bunx tsx scripts\run-no-login-wave.ts --niche "برامج محاسبة" --mode wave
```

## 4) متغيرات البيئة (أسماء فقط — قاعدة §18: لا أسرار في أي ملف أو لوج)

| المتغير | مصدره في التوثيق | ملاحظة |
|---|---|---|
| `LEADOS_BASE_URL` | §12 (Worker) | موثق رسميًا |
| `INGEST_API_KEY` | ملحق E (Vercel) | موثق رسميًا |
| `INGEST_HEADER_FORMAT` | **يحتاج تأكيد** | صيغة الترويسة الفعلية في `worker/leados_client.py` |
| `EXA_API_KEY` / `TAVILY_API_KEY` / `SERPAPI_API_KEY` | ملحق E («مفاتيح موفري البحث») | **أسماء مقترحة — راجع `.env.example` الفعلي** |
| `TELEGRAM_PUBLIC_CHANNELS` | قنوات عامة — تُغذى لاحقًا من `MonitoredGroup` (§8/§11) | CSV بدون @ |

مزود **z-ai** المدمج (§13): عند الدمج داخل التطبيق استدعِ `setCustomProvider(...)` لحقنه
أول السلسلة — الحزمة لا تفترض وجود SDK خارجها.

## 5) الإيقاف والرجوع (§20.11-10)

- **رجوع كامل:** امسح `src/lib/platforms/` وملفين الـrunner — الحزمة مستقلة 100% ومفيش أي ملف قديم اتعدل.
- **إيقاف مؤقت:** زر واحد — `adapter.pause()` أو متغير الميزانية `limitsPerDay: 0`.
- **قاطع الدائرة (§29):** 3 أعطال متتالية → فتح تلقائي 30 دقيقة، بلا retry لا نهائي.

## 6) تقرير الفجوات — إيه اللي لازم يتفتش على المستودع الفعلي قبل الاعتماد (قاعدة §21/§37)

1. **صيغة ترويسة `/api/ingest/webhook`** — راجع `worker/leados_client.py` وعدّل `INGEST_HEADER_FORMAT`؛ أول إرسال فعلي بعد DRY فقط.
2. **أسماء مفاتيح البحث الفعلية** في `.env.example` وVercel (ملحق E ذكر الفئات لا الأسماء الدقيقة).
3. **توقيعات المحرك الفعلية** — `expandSourceTypes` و`PLATFORM_QUERY_SHAPES` و`ingestDiscoveredItems` في `src/lib/discovery.ts`/`queue.ts`: الحزمة تستخدم الأسماء كما وردت في التوثيق؛ مطابقة التوقيعات تتم عند الدمج في P1.
4. **محتوى `src/config/platform-policies/` الحالي** (10 ملفات) — سياسات الحزمة متوافقة مع نص §20.4 لكن مراجعة الملفات الفعلية إلزامية (ملحق G-8: أي موصل يحتاج إعادة تحقق يوم التنفيذ).
5. **حالة Serper/DAHL/Modal الحالية** — التوثيق مؤرخ 2026-10-23 (§17: Serper منتهي، توحيد Neon معلق). الحزمة لا تعتمد على Serper إطلاقًا.
6. **دومين egyta** — مذكور في §4 بدون TLD دقيق؛ مؤقتًا `egyta.com` يحتاج تأكيدًا من قواعد البحث.

## 7) حدود الحزمة (صراحةً — ممنوع الادعاء §21)

- REDDIT/TELEGRAM مباشرين ومكتملين. باقي الـ12 منصة بتمر عبر مزودي البحث — بدون مفاتيح مضبوطة الموجة ترجع صفر نتايج بشكل صحيح وآمن.
- مراقبة الجروبات العميقة (Facebook/Telegram/Reddit/X) **خارج الحزمة** — مسارها Local Agent + Extension في P1 (§20.10) بعد فحص المستودع.
- الحزمة **ما بتفترضش أي حصص مجانية** (§26) — الميزانيات الافتراضية متحفظة وبتتظبط من الإعدادات.
- مفيش أي تجاوز CAPTCHA/OTP/Rate Limits في أي سطر (إخلاء §55/§20.11).

## 8) مراجع السياسات المضمّنة (§22 — تُراجع يوم التنفيذ)

- Meta Automated Data Collection: https://www.facebook.com/legal/automated_data_collection_terms
- LinkedIn Prohibited Software: https://www.linkedin.com/help/linkedin/answer/a1341387/
- Reddit — Don't break the site: https://support.reddithelp.com/hc/en-us/articles/360043512931
- X Automation Rules: https://help.x.com/en/rules-and-policies/x-automation
- Google OAuth 2.0: https://developers.google.com/identity/protocols/oauth2/
