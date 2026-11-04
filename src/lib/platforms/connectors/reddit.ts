/**
 * Ezz / LeadOS — موصل Reddit العام (بدون تسجيل دخول)
 * ---------------------------------------------------
 * المصدر: §4 «REDDIT مجاني دايمًا — بيشتغل أول أول» + §11 (من GROUP_PLATFORMS
 * لمراقبة الجروبات) + §22 (مرجع سياسة Reddit — لا كشط غير مصرح ولا حسابات
 * آلية ولا رسائل غير مرغوبة).
 *
 * المسار: JSON العام للبحث (reddit.com/search.json) — قراءة عامة فقط.
 * حدود المعدل: فاصل ≥1.1 ثانية بين النداءات احترامًا لحدود الموقع (§20.4-3).
 */

import type { PlatformAdapter, UnifiedResult } from '../contract.ts';
import { PLATFORM_CONFIGS, validatePolicy } from '../platform-configs.ts';
import { BudgetTracker } from '../budget.ts';
import { canonicalUrl, detectLanguage, presetIntentSignal } from '../connector-factory.ts';

const USER_AGENT = 'LeadOS-Ezz-NoLogin/0.1 (local discovery runner; respects platform rules)';

let lastCallAt = 0;
async function politeGap(): Promise<void> {
  const gap = Date.now() - lastCallAt;
  if (gap < 1100) await new Promise((r) => setTimeout(r, 1100 - gap));
  lastCallAt = Date.now();
}

interface RedditListing {
  data?: {
    children?: Array<{
      data?: {
        title?: string;
        permalink?: string;
        url?: string;
        selftext?: string;
        created_utc?: number;
        subreddit?: string;
        subreddit_name_prefixed?: string;
        over_18?: boolean;
      };
    }>;
  };
}

export function buildRedditConnector(opts: { limitsPerDay?: number } = {}): PlatformAdapter {
  const cfg = PLATFORM_CONFIGS.REDDIT;
  const budget = new BudgetTracker('REDDIT', { perDay: opts.limitsPerDay ?? 40, perHour: 10 });
  const health = { ok: false, lastError: null as string | null, lastSuccessAt: null as string | null, lastGateReason: null as string | null };
  let paused = false;
  const policy = validatePolicy(cfg); // PUBLIC_ACCESS متوقع

  return {
    id: 'REDDIT',
    displayName: cfg.displayName,
    platformType: 'REDDIT',
    capabilities: {
      publicSearch: true,
      officialApi: false,
      requiresLogin: false,
      localBrowser: false,
      supportsGroups: true, // §11 GROUP_PLATFORMS
      supportsBusinessListings: false,
    },
    accessMethod: 'PUBLIC_WEB',

    connectionState() {
      if (paused) return 'PAUSED_BY_USER';
      if (!policy.allowed) return policy.state;
      if (!budget.canRun()) return 'RATE_LIMITED';
      return 'PUBLIC_ACCESS';
    },
    async checkAvailability() { return this.connectionState(); },
    validatePolicy() { return policy; },

    async search(query, options): Promise<UnifiedResult[]> {
      if (!policy.allowed) { health.lastGateReason = policy.reason; return []; }
      if (paused) { health.lastGateReason = 'الموصل موقوف بواسطة المستخدم'; return []; }
      if (!budget.canRun()) { health.lastGateReason = 'سقف الميزانية (§20.7)'; return []; }
      budget.recordCall();
      try {
        await politeGap();
        const limit = Math.min(options?.limit ?? 12, 25);
        const url = new URL('https://www.reddit.com/search.json');
        url.searchParams.set('q', query);
        url.searchParams.set('limit', String(limit));
        url.searchParams.set('sort', 'new');
        url.searchParams.set('t', 'year');
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
        if (!res.ok) throw new Error(`Reddit HTTP ${res.status}`);
        const data = await res.json() as RedditListing;
        const out: UnifiedResult[] = [];
        for (const child of data.data?.children ?? []) {
          const d = child.data;
          if (!d?.permalink) continue;
          if (d.over_18) continue; // فلتر محتوى
          const sourceUrl = `https://www.reddit.com${d.permalink}`;
          const text = `${d.title ?? ''} ${d.selftext ?? ''}`;
          out.push({
            sourcePlatform: 'REDDIT',
            sourceUrl,
            title: d.title ?? null,
            snippet: d.selftext?.slice(0, 500) ?? null,
            publishedAt: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : null, // حقيقي من المنصة — مش تخمين
            collectedAt: new Date().toISOString(),
            accessMethod: 'PUBLIC_WEB',
            evidence: `منشور عام في ${d.subreddit_name_prefixed ?? d.subreddit ?? 'reddit'} — ${sourceUrl}`,
            confidence: 0.6,
            country: 'EG',
            language: detectLanguage(text),
            dedupeKey: `REDDIT:${canonicalUrl(sourceUrl)}`,
            intentSignal: presetIntentSignal(text),
            providerName: 'reddit-public-json',
          });
        }
        health.ok = true; health.lastError = null; health.lastGateReason = null;
        health.lastSuccessAt = new Date().toISOString();
        budget.recordSuccess();
        return out;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        health.ok = false; health.lastError = msg;
        budget.recordFailure();
        return []; // عزل الأعطال — §20.11-8
      }
    },

    healthCheck() { return { ...health }; },
    getUsageBudget() { return budget.snapshot(); },
    getLastError() { return health.lastError; },
    pause() { paused = true; },
    disconnect() { paused = true; },
    revoke() { paused = true; },
  };
}
