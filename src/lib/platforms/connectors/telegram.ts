/**
 * Ezz / LeadOS — موصل Telegram العام (بدون تسجيل دخول)
 * -----------------------------------------------------
 * المصدر: §4 «TELEGRAM مجاني دايمًا — بيشتغل أول أول» + §11 (من GROUP_PLATFORMS)
 * + §20.4 (Bot API: البوت لا يرى إلا ما تسمح به صلاحياته).
 *
 * المسار العام بدون دخول:
 *  1) معاينة القنوات العامة t.me/s/<channel> (صفحة ويب عامة بدون حساب).
 *  2) بحث عبر مزودي البحث بفلتر site:t.me (نفس آلية المحرك §4).
 * قائمة القنوات تُغذى من إعدادات المشروع (TELEGRAM_PUBLIC_CHANNELS) — ومكان
 * الدمج الطبيعي جدول MonitoredGroup/SearchRule (§8/§11).
 */

import type { PlatformAdapter, UnifiedResult } from '../contract.ts';
import { PLATFORM_CONFIGS, validatePolicy } from '../platform-configs.ts';
import { BudgetTracker } from '../budget.ts';
import { canonicalUrl, detectLanguage, presetIntentSignal } from '../connector-factory.ts';
import { geoPinSuffix, matchesSite } from '../search-provider.ts';

const UA = 'LeadOS-Ezz-NoLogin/0.1 (local discovery runner; respects platform rules)';

export function publicChannelsFromEnv(): string[] {
  return (process.env.TELEGRAM_PUBLIC_CHANNELS ?? '')
    .split(',')
    .map((s) => s.trim().replace(/^@/, ''))
    .filter((s) => s.length > 0);
}

/** استخراج منشورات صفحة المعاينة العامة — تحليل دفاعي بدون اعتماديات */
export function parseChannelPreview(html: string, channel: string): Array<{ url: string; text: string; publishedAt: string | null }> {
  const out: Array<{ url: string; text: string; publishedAt: string | null }> = [];
  // كل رسالة تحمل data-post="<channel>/<id>"
  const blocks = html.match(/data-post="([^"]+)"[\s\S]{0,4000}?<time\s[^>]*datetime="([^"]+)"[\s\S]{0,4000}?class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g) ?? [];
  for (const b of blocks) {
    const post = /data-post="([^"]+)"/.exec(b)?.[1];
    const dt = /datetime="([^"]+)"/.exec(b)?.[1] ?? null;
    const inner = /class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(b)?.[1] ?? '';
    if (!post) continue;
    const text = inner
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length < 10) continue;
    out.push({ url: `https://t.me/${post}`, text, publishedAt: dt });
  }
  return out;
}

export function buildTelegramConnector(opts: { limitsPerDay?: number; channels?: string[] } = {}): PlatformAdapter {
  const cfg = PLATFORM_CONFIGS.TELEGRAM;
  const budget = new BudgetTracker('TELEGRAM', { perDay: opts.limitsPerDay ?? 40, perHour: 10 });
  const health = { ok: false, lastError: null as string | null, lastSuccessAt: null as string | null, lastGateReason: null as string | null };
  let paused = false;
  const policy = validatePolicy(cfg);

  return {
    id: 'TELEGRAM',
    displayName: cfg.displayName,
    platformType: 'TELEGRAM',
    capabilities: {
      publicSearch: true,
      officialApi: true, // Bot API ممكن عند الدمج — بمفتاح بوت موثق (§20.4)
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
      const channels = opts.channels ?? publicChannelsFromEnv();
      const out: UnifiedResult[] = [];
      try {
        // المسار 1: معاينات القنوات العامة
        for (const ch of channels.slice(0, 10)) { // سقف متحفظ لكل نداء
          const res = await fetch(`https://t.me/s/${encodeURIComponent(ch)}`, {
            headers: { 'User-Agent': UA, Accept: 'text/html' },
            signal: AbortSignal.timeout(20_000),
          });
          if (!res.ok) continue; // قناة غير متاحة → نكمل الباقي (عزل §20.11-8)
          const html = await res.text();
          for (const p of parseChannelPreview(html, ch)) {
            if (matchesSite(p.url, cfg.domains)) {
              out.push({
                sourcePlatform: 'TELEGRAM',
                sourceUrl: p.url,
                title: `t.me/${ch}`,
                snippet: p.text.slice(0, 500),
                publishedAt: p.publishedAt,
                collectedAt: new Date().toISOString(),
                accessMethod: 'PUBLIC_WEB',
                evidence: `منشور عام في قناة t.me/${ch} — ${p.url}`,
                confidence: 0.55,
                country: 'EG',
                language: detectLanguage(p.text),
                dedupeKey: `TELEGRAM:${canonicalUrl(p.url)}`,
                intentSignal: presetIntentSignal(p.text),
                providerName: 'tme-public-preview',
              });
            }
          }
        }
        health.ok = true;
        health.lastError = null;
        health.lastGateReason = null;
        health.lastSuccessAt = new Date().toISOString();
        budget.recordSuccess();
        return out.slice(0, options?.limit ?? 12);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        health.ok = false; health.lastError = msg;
        budget.recordFailure();
        return [];
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

/** استعلامات شكل تليجرام — §4: بذور مضمونة + geoPin مصر (يستخدمها الـrunner) */
export function telegramQueryFor(niche: string): string {
  return `site:t.me ${niche}${geoPinSuffix(niche)}`;
}
