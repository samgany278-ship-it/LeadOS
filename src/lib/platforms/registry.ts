/**
 * Ezz / LeadOS — سجل المنصات + عقدة الموجة (Wave Runner)
 * --------------------------------------------------------
 * الترتيب (أمر المالك): المنصات بدون تسجيل دخول كلها أولًا، واللي محتاجين
 * دخول في الآخر — مع الحفاظ على قاعدة §4: REDDIT + TELEGRAM أول أول دايمًا.
 *
 * المصدر: §4 (عدالة التوزيع: round-robin حتى 4 جولات + دلو لكل نوع + دمج
 * متناوب + سقف 10 بحث/جوبة و18 للمسح الشامل) + §20.5 (العقد) + §20.11
 * (عزل الأعطال + بوابة السياسة) + §21 (لا ادعاء نجاح ميزة لم تختبر).
 */

import type { PlatformAdapter, PlatformType, SearchOptions, UnifiedResult } from './contract.ts';
import { PLATFORM_CONFIGS, validatePolicy, type PlatformConfig } from './platform-configs.ts';
import { buildPublicSearchConnector, type FactoryOptions } from './connector-factory.ts';
import { buildRedditConnector } from './connectors/reddit.ts';
import { buildTelegramConnector } from './connectors/telegram.ts';

// ---------------------------------------------------------------------------
// الترتيب المعتمد
// ---------------------------------------------------------------------------

/** أولًا: بدون تسجيل دخول (14 منصة) — REDDIT وTELEGRAM على القمة حسب §4 */
export const NO_LOGIN_ORDER: PlatformType[] = [
  'REDDIT', 'TELEGRAM',
  'QUORA', 'FREELANCE', 'JOBS', 'ADS_LIBRARY',
  'DIRECTORY', 'REVIEWS', 'EVENTS', 'DISCORD',
  'GOOGLE_MAPS', 'GOOGLE_SEARCH', 'WEBSITE', 'YOUTUBE',
];

/** أخيرًا: محتاجة تسجيل دخول/تفويض رسمي (6 منصات) — أمر المالك */
export const LOGIN_REQUIRED_ORDER: PlatformType[] = [
  'FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'X', 'WHATSAPP', 'LINKEDIN',
];

export const ALL_PLATFORM_ORDER: PlatformType[] = [...NO_LOGIN_ORDER, ...LOGIN_REQUIRED_ORDER];

// ---------------------------------------------------------------------------
// بناء السجل
// ---------------------------------------------------------------------------

export interface RegistryOptions extends FactoryOptions {
  telegramChannels?: string[];
}

export function buildRegistry(opts: RegistryOptions = {}): Map<PlatformType, PlatformAdapter> {
  const map = new Map<PlatformType, PlatformAdapter>();

  for (const type of NO_LOGIN_ORDER) {
    if (type === 'REDDIT') {
      map.set(type, buildRedditConnector({ limitsPerDay: opts.limitsPerDay }));
      continue;
    }
    if (type === 'TELEGRAM') {
      map.set(type, buildTelegramConnector({ limitsPerDay: opts.limitsPerDay, channels: opts.telegramChannels }));
      continue;
    }
    map.set(type, buildPublicSearchConnector(PLATFORM_CONFIGS[type], {
      providers: opts.providers,
      limitsPerDay: opts.limitsPerDay,
      limitsPerHour: opts.limitsPerHour,
    }));
  }

  // الموصلات المحتاجة دخول: موصلات بوابة — تعلن حالتها وسببها ولا تتجاوز (§20.11-2/3)
  for (const type of LOGIN_REQUIRED_ORDER) {
    map.set(type, buildLoginGateConnector(PLATFORM_CONFIGS[type]));
  }

  return map;
}

/**
 * موصل بوابة لمنصة محتاجة دخول: يعلن الحالة والسبب (§20.11-2)، ويعيد صفر
 * نتايج، ولا يحاول أي التفاف (§20.11-3) — التفعيل الحقيقي يقع ضمن P1
 * (Local Agent + Extension حسب §20.10) بعد فحص المستودع الفعلي.
 */
export function buildLoginGateConnector(cfg: PlatformConfig): PlatformAdapter {
  const verdict = validatePolicy(cfg);
  return {
    id: cfg.type,
    displayName: cfg.displayName,
    platformType: cfg.type,
    capabilities: {
      publicSearch: false,
      officialApi: cfg.officialApiAvailable,
      requiresLogin: true,
      localBrowser: cfg.accessMethod === 'LOCAL_BROWSER',
      supportsGroups: ['FACEBOOK', 'X'].includes(cfg.type), // §11 GROUP_PLATFORMS
      supportsBusinessListings: false,
    },
    accessMethod: cfg.accessMethod,
    connectionState() { return verdict.state; },
    async checkAvailability() { return verdict.state; },
    validatePolicy() { return verdict; },
    async search() {
      // سبب واضح ومعلن — لا نتايج ولا التفاف (§20.11-2/3)
      return [];
    },
    healthCheck() {
      return { ok: false, lastError: null, lastSuccessAt: null, lastGateReason: verdict.reason };
    },
    getUsageBudget() {
      return {
        platform: cfg.type, usedToday: 0, limitPerDay: 0, usedThisHour: 0,
        limitPerHour: 0, consecutiveFailures: 0, circuitOpen: false, circuitOpenUntil: null,
      };
    },
    getLastError() { return null; },
    pause() { /* بوابة — لا شيء يُوقف */ },
    disconnect() { /* بوابة */ },
    revoke() { /* بوابة */ },
  };
}

// ---------------------------------------------------------------------------
// عقدة الموجة — §4: سقف 10 استعلامات/جوبة (18 للمسح الشامل) + عدالة التوزيع
// ---------------------------------------------------------------------------

export type WaveMode = 'wave' | 'full';

export function maxQueriesForMode(mode: WaveMode): number {
  return mode === 'full' ? 18 : 10; // §4/ملحق H
}

export interface WavePlanItem {
  platform: PlatformType;
  query: string;
}

/** تطبيع النيش على أشكال المنصة (§4: أسئلة كل منصة بلغتها + بذور مضمونة) */
export function planQueries(niches: string[], platforms: PlatformType[], mode: WaveMode): WavePlanItem[] {
  const budget = maxQueriesForMode(mode);
  const plan: WavePlanItem[] = [];
  const queues = new Map<PlatformType, string[]>();

  for (const p of platforms) {
    const cfg = PLATFORM_CONFIGS[p];
    if (!cfg || cfg.requiresLogin) continue; // المحتاجة دخول خارج الموجة العامة (أمر المالك + §20.11)
    const shapes = cfg.queryShapes.length > 0 ? cfg.queryShapes : ['{niche}'];
    const q: string[] = [];
    for (const niche of niches) {
      for (const shape of shapes) q.push(shape.replaceAll('{niche}', niche));
      for (const seed of cfg.seedQueries) {
        if (seed.includes('{niche}')) q.push(seed.replaceAll('{niche}', niche));
        else q.push(seed); // بذرة مضمونة ثابتة (مثل درس كورا §6)
      }
    }
    if (q.length > 0) queues.set(p, q);
  }

  // round-robin بعدالة التوزيع (§4) — جولتان افتراضيًا هنا والمحرك الأصلي حتى 4
  const rounds = 2;
  for (let r = 0; r < rounds && plan.length < budget; r++) {
    for (const p of platforms) {
      const q = queues.get(p);
      if (!q || q.length === 0) continue;
      const item = q.shift();
      if (item) {
        plan.push({ platform: p, query: item });
        if (plan.length >= budget) break; // §4: سقف الاستعلامات للجوبة
      }
    }
  }
  return plan;
}

/** دمج متناوب — §4: «كل منصة ليها حضور في النتيجة مهما كان ترتيبها» */
export function interleave(groups: Array<{ platform: PlatformType; results: UnifiedResult[] }>): UnifiedResult[] {
  const out: UnifiedResult[] = [];
  const maxLen = Math.max(0, ...groups.map((g) => g.results.length));
  for (let i = 0; i < maxLen; i++) {
    for (const g of groups) if (g.results[i]) out.push(g.results[i]);
  }
  return out;
}

export interface WaveReport {
  mode: WaveMode;
  planSize: number;
  byPlatform: Record<string, number>;
  results: UnifiedResult[];
  errors: Array<{ platform: PlatformType; error: string }>;
  gates: Array<{ platform: PlatformType; state: string; reason: string }>;
  budgets: ReturnType<PlatformAdapter['getUsageBudget']>[];
}

/** تشغيل موجة على المنصات العامة — عزل كامل بين الموصلات (§20.11-8) */
export async function runNoLoginWave(
  registry: Map<PlatformType, PlatformAdapter>,
  niches: string[],
  mode: WaveMode = 'wave',
  searchOptions: SearchOptions = {},
): Promise<WaveReport> {
  const plan = planQueries(niches, NO_LOGIN_ORDER, mode);
  const groups: Array<{ platform: PlatformType; results: UnifiedResult[] }> = [];
  const errors: WaveReport['errors'] = [];
  const seen = new Set<string>(); // منع تكرار أولي داخل الموجة — النهائي في خط الابتلاع (§5/§20.6-5)

  for (const item of plan) {
    const adapter = registry.get(item.platform);
    if (!adapter) continue;
    try {
      const results = await adapter.search(item.query, searchOptions);
      const fresh = results.filter((r) => !seen.has(r.dedupeKey));
      fresh.forEach((r) => seen.add(r.dedupeKey));
      groups.push({ platform: item.platform, results: fresh });
    } catch (e) {
      // الدفاعات الداخلية عادة تمنع الرمي — هذه شبكة أمان إضافية
      errors.push({ platform: item.platform, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const byPlatform: Record<string, number> = {};
  for (const g of groups) byPlatform[g.platform] = (byPlatform[g.platform] ?? 0) + g.results.length;

  const gates: WaveReport['gates'] = [];
  for (const type of LOGIN_REQUIRED_ORDER) {
    const a = registry.get(type);
    if (!a) continue;
    const v = a.validatePolicy();
    gates.push({ platform: type, state: v.state, reason: v.reason });
  }

  const budgets = ALL_PLATFORM_ORDER.map((t) => registry.get(t)?.getUsageBudget()).filter((b): b is NonNullable<typeof b> => Boolean(b));

  return {
    mode,
    planSize: plan.length,
    byPlatform,
    results: interleave(groups), // §4: دمج متناوب
    errors,
    gates,
    budgets,
  };
}
