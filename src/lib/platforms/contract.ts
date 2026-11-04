/**
 * Ezz / LeadOS — عقد الموصلات الموحد (Platform Adapter Contract)
 * ---------------------------------------------------------------
 * المصدر: Ezz-Company-OS-Spec §20.5 (العقد) + §20.3 (حالات الاتصال) + §20.4 (أولوية طرق الوصول)
 * قاعدة الوثيقة §38: وجود الميزة في الحزمة لا يعني أنها مختبرة على المستودع الفعلي —
 * لا تُعتبر منجزة إلا بعد فحص الكود وتشغيل اختبار مناسب وتسجيل النتيجة.
 *
 * ملاحظة تصميمية: لا توجد أي اعتماديات خارجية — الملفات تُنسخ داخل مستودع LeadOS كما هي.
 */

// ---------------------------------------------------------------------------
// أنواع المنصات — الملحق D (20 نوعًا موثقًا في الوثيقة)
// ---------------------------------------------------------------------------
export const PLATFORM_TYPES = [
  'GOOGLE_MAPS', 'WEBSITE', 'GOOGLE_SEARCH', 'ADS_LIBRARY',
  'FREELANCE', 'JOBS', 'DIRECTORY', 'REVIEWS', 'EVENTS',
  'QUORA', 'DISCORD', 'REDDIT', 'TELEGRAM',
  'FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'WHATSAPP', 'LINKEDIN', 'X', 'YOUTUBE',
] as const;
export type PlatformType = (typeof PLATFORM_TYPES)[number];

// ---------------------------------------------------------------------------
// حالات الاتصال — §20.3 (القائمة الموثقة حرفيًا)
// ---------------------------------------------------------------------------
export const CONNECTION_STATES = [
  'NOT_CONFIGURED',            // لم يتم إعداد مصدر أو حساب
  'PUBLIC_ACCESS',             // وصول عام دون تسجيل دخول
  'NEEDS_USER_LOGIN',          // مطلوب تدخل المستخدم في المتصفح
  'CONNECTED_OFFICIAL_API',    // اتصال رسمي موثق
  'CONNECTED_LOCAL_BROWSER',   // الإضافة المحلية متصلة وجاهزة
  'PAUSED_BY_USER',            // أوقف المستخدم الموصل مؤقتًا
  'RATE_LIMITED',              // توقف احترامًا لحدود الاستخدام
  'REQUIRES_APPROVAL',         // يتطلب صلاحية/موافقة إضافية
  'POLICY_BLOCKED',            // طريقة الوصول غير مسموح بها
  'UNAVAILABLE',               // لا توجد طريقة مدعومة حاليًا
] as const;
export type ConnectionState = (typeof CONNECTION_STATES)[number];

// ---------------------------------------------------------------------------
// طرق الوصول — §20.4: الأولوية OFFICIAL_API ثم SEARCH_PROVIDER ثم PUBLIC_WEB
// ثم LOCAL_BROWSER (بموافقة) — وغير ذلك يبقى معطلًا ومشروحًا
// ---------------------------------------------------------------------------
export const ACCESS_METHODS = ['OFFICIAL_API', 'SEARCH_PROVIDER', 'PUBLIC_WEB', 'LOCAL_BROWSER'] as const;
export type AccessMethod = (typeof ACCESS_METHODS)[number];

// ---------------------------------------------------------------------------
// إشارات النية — §5: المكافآت (+8/+5/+8 و MARKET_LIST score≥45) تُطبَّق في
// خط التقييم الحالي داخل المشروع (ingestDiscoveredItems) — الموصل يوسم فقط
// ---------------------------------------------------------------------------
export const INTENT_SIGNALS = ['EXPLICIT_NEED', 'COMPETITOR_ENGAGER', 'AD_SPENDER', 'MARKET_LIST'] as const;
export type IntentSignal = (typeof INTENT_SIGNALS)[number];

// ---------------------------------------------------------------------------
// القدرات — §20.5: capabilities تعلن ما يفعله الموصل فعلًا
// ---------------------------------------------------------------------------
export interface ConnectorCapabilities {
  publicSearch: boolean;             // بحث عام بدون تسجيل دخول
  officialApi: boolean;              // قادر على الاتصال بـ API رسمي عند توفير مفتاح
  requiresLogin: boolean;            // الوصول العميق يحتاج حساب/جلسة مستخدم
  localBrowser: boolean;             // يحتاج المتصفح المحلي/الإضافة
  supportsGroups: boolean;           // مراقبة جروبات (§11: FACEBOOK/TELEGRAM/REDDIT/X)
  supportsBusinessListings: boolean; // قوائم أعمال/خرائط
}

// ---------------------------------------------------------------------------
// النتيجة الموحدة — §20.5: كل نتيجة تحمل المصدر والدليل والثقة ومفتاح منع التكرار
// (§20.11-4: الحقول غير المتوفرة null — لا تخمين ولا اختلاق)
// ---------------------------------------------------------------------------
export interface UnifiedResult {
  sourcePlatform: PlatformType;
  sourceUrl: string;
  title: string | null;
  snippet: string | null;
  publishedAt: string | null;        // ISO أو null
  collectedAt: string;               // ISO — وقت الالتقاط إلزامي
  accessMethod: AccessMethod;
  evidence: string;                  // وصف الدليل + رابط المصدر
  confidence: number;                // 0..1 — ثقة منفصلة عن درجة الشراء (§20.6-4)
  country: string | null;            // geoPin مصر افتراضيًا إلا لو الاستعلام خليجي (§4)
  language: string | null;
  dedupeKey: string;                 // منع تكرار متعدد المصادر (§20.6-5)
  intentSignal?: IntentSignal;       // وسم أولي — التصنيف النهائي في خط الابتلاع الحالي
  providerName: string;              // أي مزود بحث/مسار جلب النتيجة
}

// ---------------------------------------------------------------------------
// خيارات البحث — §4: سقف الدلو limitPerQuery×2، حداثة لكل منصة، geoPin
// ---------------------------------------------------------------------------
export interface SearchOptions {
  limit?: number;             // افتراضي 12 (دلو limitPerQuery×2 بقيمة 6 موثقة في §4)
  freshnessDays?: number | null;
  country?: string;
  language?: string;
}

export interface ConnectorHealth {
  ok: boolean;
  lastError: string | null;
  lastSuccessAt: string | null;
  lastGateReason: string | null;   // سبب منع البوابة (§20.11-2/3: سبب ظاهر دايمًا)
}

// ---------------------------------------------------------------------------
// الميزانية — §20.7 (ميزانية لكل موصل) + §29 (قاطع الدائرة / Circuit Breaker)
// ---------------------------------------------------------------------------
export interface UsageBudget {
  platform: string;
  usedToday: number;
  limitPerDay: number;
  usedThisHour: number;
  limitPerHour: number;
  consecutiveFailures: number;
  circuitOpen: boolean;
  circuitOpenUntil: string | null;
}

// ---------------------------------------------------------------------------
// حكم بوابة السياسة — §20.4 (بوابة السياسة توقف أي طريقة غير مصرح بها وتشرح السبب)
// ---------------------------------------------------------------------------
export interface PolicyVerdict {
  allowed: boolean;
  state: ConnectionState;
  reason: string;
  policyRefs: string[];   // مراجع §22 للمراجعة وقت التنفيذ
}

// ---------------------------------------------------------------------------
// العقد الموحد — §20.5 (مواصفة التصميم المقترحة في الوثيقة)
// ---------------------------------------------------------------------------
export interface PlatformAdapter {
  id: string;
  displayName: string;
  platformType: PlatformType;
  capabilities: ConnectorCapabilities;
  accessMethod: AccessMethod;

  connectionState(): ConnectionState;
  checkAvailability(): Promise<ConnectionState>;
  validatePolicy(): PolicyVerdict;

  /** بحث واحد — يعيد نتائج موحدة ولا يرمي استثناء أبدًا (عزل الأعطال §20.11-8) */
  search(query: string, options?: SearchOptions): Promise<UnifiedResult[]>;

  healthCheck(): ConnectorHealth;
  getUsageBudget(): UsageBudget;
  getLastError(): string | null;

  pause(): void;      // §20.5: إيقاف عند توفره
  disconnect(): void;
  revoke(): void;
}
