/**
 * Ezz / LeadOS — مصنع الموصل العام (بحث عام بدون تسجيل دخول)
 * ------------------------------------------------------------
 * المصدر: §20.5 (العقد والتوحيد) + §4 (سقف الدلو limitPerQuery×2 + الحداثة)
 * + §5 (وسم النية الأولي — التقييم النهائي في خط الابتلاع الحالي)
 * + §20.11-4/8 (الحقول الناقصة null — وعزل أعطال الموصل الواحد)
 */

import type {
  ConnectorCapabilities, ConnectorHealth, PlatformAdapter, PlatformType,
  PolicyVerdict, SearchOptions, UnifiedResult, UsageBudget,
} from './contract.ts';
import type { PlatformConfig } from './platform-configs.ts';
import { validatePolicy } from './platform-configs.ts';
import { BudgetTracker } from './budget.ts';
import { looksGulf, matchesSite, searchViaChain, type SearchProvider } from './search-provider.ts';

/** سقف الدلو — §4: limitPerQuery×2 (بقيمة limitPerQuery=6 الموثقة) */
export const DEFAULT_BUCKET_CAP = 12;

// ---------------------------------------------------------------------------
// توحيد النتائج — §20.5 + §20.11-4
// ---------------------------------------------------------------------------

export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = '';
    const junk: string[] = [];
    u.searchParams.forEach((_v, k) => { if (/^(utm_|fbclid|gclid|ref)/i.test(k)) junk.push(k); });
    junk.forEach((k) => u.searchParams.delete(k));
    const path = u.pathname.replace(/\/+$/, ''); // إزالة السلاش النهائي لتثبيت المفتاح
    let s = `${u.hostname.replace(/^www\./, '')}${path}`;
    const q = u.searchParams.toString();
    if (q) s += `?${q}`;
    return s.replace(/\/+$/, '');
  } catch {
    return raw.trim();
  }
}

export function detectLanguage(text: string): string | null {
  const arabic = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  if (arabic === 0 && latin === 0) return null;
  return arabic / Math.max(1, arabic + latin) >= 0.3 ? 'ar' : 'en';
}

// وسوم النية الأولية — قواميس مشتقة من الوثيقة فقط:
// §5: EXPLICIT_NEED «محتاج/عايز/مطلوب» وCOMPETITOR_ENGAGER «بديل/توصية/مقارنة»
// §20.6-2: «محتاج»، «بدور على»، «رشحولي»، «مطلوب شركة»
const EXPLICIT_NEED_RE = /(محتاج|عايز|مطلوب|بدور على|رشحولي|أريد|اريد|i need|looking for)/i;
const COMPETITOR_RE = /(بديل|توصية|رشحولي|مقارنة|أفضل بديل|alternative|recommend|vs\.?\s)/i;

export function presetIntentSignal(text: string): 'EXPLICIT_NEED' | 'COMPETITOR_ENGAGER' | undefined {
  if (COMPETITOR_RE.test(text)) return 'COMPETITOR_ENGAGER';
  if (EXPLICIT_NEED_RE.test(text)) return 'EXPLICIT_NEED';
  return undefined;
}

export function isWithinFreshness(publishedAt: string | null, freshnessDays: number | null): boolean {
  if (!freshnessDays || !publishedAt) return true; // بدون تاريخ → يُبقي ويُخفض الثقة (لا تخمين تواريخ)
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return true;
  return Date.now() - t <= freshnessDays * 86_400_000;
}

export interface NormalizeInput {
  platform: PlatformType;
  url: string;
  title: string | null;
  snippet: string | null;
  publishedAt: string | null;
  providerName: string;
  accessMethod: 'OFFICIAL_API' | 'SEARCH_PROVIDER' | 'PUBLIC_WEB' | 'LOCAL_BROWSER';
  forcedIntent?: UnifiedResult['intentSignal'];
}

export function normalizeHit(input: NormalizeInput): UnifiedResult {
  const text = `${input.title ?? ''} ${input.snippet ?? ''}`;
  let confidence = 0.5; // أساس: نتيجة بحث عام موثقة المصدر
  if (input.publishedAt && !Number.isNaN(Date.parse(input.publishedAt))) confidence += 0.2;
  else confidence *= 0.7; // §20.6-4: غياب التاريخ يخفض الثقة — مش بنخمن
  const urlOk = /^https?:\/\//.test(input.url);
  if (!urlOk) confidence *= 0.5;

  return {
    sourcePlatform: input.platform,
    sourceUrl: input.url,
    title: input.title,
    snippet: input.snippet,
    publishedAt: input.publishedAt,
    collectedAt: new Date().toISOString(),
    accessMethod: input.accessMethod,
    evidence: `نتيجة عامة من ${input.providerName} — ${input.url}`,
    confidence: Math.round(Math.min(1, confidence) * 100) / 100,
    country: looksGulf(text) ? null : 'EG', // §4 geoPin
    language: detectLanguage(text),
    dedupeKey: `${input.platform}:${canonicalUrl(input.url)}`,
    intentSignal: input.forcedIntent ?? presetIntentSignal(text),
    providerName: input.providerName,
  };
}

// ---------------------------------------------------------------------------
// المصنع — يبني موصلًا كامل العقد لأي إعداد منصة عامة
// ---------------------------------------------------------------------------

export interface FactoryOptions {
  /** حقن مزودات للاختبارات — الإنتاج يستخدم السلسلة الافتراضية (§13) */
  providers?: SearchProvider[];
  limitsPerDay?: number;
  limitsPerHour?: number;
}

export function buildPublicSearchConnector(cfg: PlatformConfig, opts: FactoryOptions = {}): PlatformAdapter {
  const budget = new BudgetTracker(cfg.type, {
    perDay: opts.limitsPerDay ?? 40,
    perHour: opts.limitsPerHour ?? 10,
  });
  const health: ConnectorHealth = { ok: false, lastError: null, lastSuccessAt: null, lastGateReason: null };
  let paused = false;
  let policy: PolicyVerdict = validatePolicy(cfg);

  const capabilities: ConnectorCapabilities = {
    publicSearch: !cfg.requiresLogin,
    officialApi: cfg.officialApiAvailable,
    requiresLogin: cfg.requiresLogin,
    localBrowser: cfg.accessMethod === 'LOCAL_BROWSER',
    supportsGroups: cfg.type === 'REDDIT' || cfg.type === 'TELEGRAM' || cfg.type === 'FACEBOOK' || cfg.type === 'X',
    supportsBusinessListings: ['GOOGLE_MAPS', 'DIRECTORY', 'REVIEWS', 'ADS_LIBRARY'].includes(cfg.type),
  };

  async function chainSearch(query: string, limit: number) {
    if (opts.providers) {
      // مسار الاختبار: سلسلة محقونة
      const errors: string[] = [];
      for (const p of opts.providers) {
        try {
          const hits = await p.search({ query, domains: cfg.domains, limit, freshnessDays: cfg.freshnessDays });
          if (hits.length > 0) return hits;
        } catch (e) { errors.push(`${p.name}: ${e instanceof Error ? e.message : String(e)}`); }
      }
      if (errors.length > 0) throw new Error(errors.join(' | '));
      return [];
    }
    return searchViaChain({ query, domains: cfg.domains, limit, freshnessDays: cfg.freshnessDays });
  }

  return {
    id: cfg.type,
    displayName: cfg.displayName,
    platformType: cfg.type,
    capabilities,
    accessMethod: cfg.accessMethod,

    connectionState() {
      if (paused) return 'PAUSED_BY_USER';
      if (!policy.allowed) return policy.state;
      if (!budget.canRun()) return 'RATE_LIMITED';
      return 'PUBLIC_ACCESS';
    },

    async checkAvailability() {
      policy = validatePolicy(cfg);
      if (policy.allowed && (cfg.officialApiAvailable || cfg.accessMethod !== 'OFFICIAL_API')) return this.connectionState();
      return this.connectionState();
    },

    validatePolicy() { return policy; },

    async search(query, options) {
      // §20.11-2/3: البوابة تشرح السبب ولا تحاول الالتفاف
      if (!policy.allowed) {
        health.lastGateReason = policy.reason;
        return [];
      }
      if (paused) {
        health.lastGateReason = 'الموصل موقوف بواسطة المستخدم (§20.5 pause)';
        return [];
      }
      if (!budget.canRun()) {
        health.lastGateReason = 'تم الوصول لسقف الميزانية (§20.7) — RATE_LIMITED';
        return [];
      }
      budget.recordCall();
      const limit = Math.min(options?.limit ?? DEFAULT_BUCKET_CAP, DEFAULT_BUCKET_CAP);
      try {
        const hits = await chainSearch(query, limit);
        const results: UnifiedResult[] = [];
        for (const h of hits) {
          if (!matchesSite(h.url, cfg.domains)) continue; // §4: يمنع تسريب النتايج بين المنصات
          if (!isWithinFreshness(h.publishedAt, cfg.freshnessDays)) continue; // §4: حداثة لكل منصة
          results.push(normalizeHit({
            platform: cfg.type,
            url: h.url,
            title: h.title,
            snippet: h.snippet,
            publishedAt: h.publishedAt,
            providerName: h.provider,
            accessMethod: cfg.accessMethod,
            // §5: نتايج مكتبات الإعلانات تُوسم AD_SPENDER قسرًا (التقييم النهائي في الابتلاع)
            forcedIntent: cfg.type === 'ADS_LIBRARY' ? 'AD_SPENDER' : undefined,
          }));
        }
        health.ok = true;
        health.lastError = null;
        health.lastGateReason = null;
        health.lastSuccessAt = new Date().toISOString();
        budget.recordSuccess();
        return results;
      } catch (e) {
        // §20.11-8: فشل منصة واحدة لا يوقف الباقي — الخطأ يُسجل والنتيجة جزئية
        const msg = e instanceof Error ? e.message : String(e);
        health.ok = false;
        health.lastError = msg;
        budget.recordFailure();
        return [];
      }
    },

    healthCheck() { return { ...health }; },
    getUsageBudget(): UsageBudget { return budget.snapshot(); },
    getLastError() { return health.lastError; },

    pause() { paused = true; },
    disconnect() { paused = true; },
    revoke() { paused = true; },
  };
}
