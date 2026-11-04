/**
 * Ezz / LeadOS — طبقة مزودات البحث + الـFallback ثلاثي + فلاتر المنصات
 * ---------------------------------------------------------------------
 * المصدر: §13 (سلسلة البحث: Exa هو محرك المنصات الأساسي عبر includeDomains،
 * ثم Tavily / z-ai / SerpAPI؛ Serper منتهي الرصيد تاريخيًا منذ 2026-09-28؛
 * ZenRows→Bing مسار احتياطي) + §4 (الـ3-tier fallback وmatchesSite وgeoPin).
 *
 * أسماء متغيرات البيئة: مذكورة بالأسماء فقط — راجع .env.example الفعلي
 * عند الدمج لتأكيد الأسماء الحالية (ملحق E: «القائمة ليست بديلًا عن فحص
 * .env.example وVercel Environment Variables»).
 */

export interface RawHit {
  title: string | null;
  url: string;
  snippet: string | null;
  publishedAt: string | null;
  provider: string;
}

export interface SearchRequest {
  query: string;
  domains: string[];
  limit: number;
  freshnessDays: number | null;
}

export interface SearchProvider {
  name: string;
  isConfigured(): boolean;
  search(req: SearchRequest): Promise<RawHit[]>;
}

// ---------------------------------------------------------------------------
// geoPin — §4: «مصر تلقائيًا إلا لو الاستعلام خليجي»
// ---------------------------------------------------------------------------
const GULF_HINTS = [
  'السعودية', 'السعوديه', 'الرياض', 'جدة', 'الإمارات', 'الامارات', 'دبي',
  'أبوظبي', 'الكويت', 'قطر', 'الدوحة', 'البحرين', 'عُمان', 'عمان', 'الخليج',
  'saudi', 'uae', 'dubai', 'riyadh', 'kuwait', 'qatar', 'bahrain',
] as const;

export function looksGulf(query: string): boolean {
  const q = query.toLowerCase();
  return GULF_HINTS.some((h) => q.includes(h.toLowerCase()));
}

/** يرجع ' مصر' للاستعلامات غير الخليجية — حرف الارتباط يُلحق بالاستعلام */
export function geoPinSuffix(query: string): string {
  return looksGulf(query) ? '' : ' مصر';
}

// ---------------------------------------------------------------------------
// matchesSite — §4: «host+path — يمنع تسريب النتايج بين المنصات»
// ---------------------------------------------------------------------------
export function matchesSite(url: string, domains: string[]): boolean {
  if (domains.length === 0) return true;
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  const path = u.pathname.toLowerCase();
  return domains.some((raw) => {
    const d = raw.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase().replace(/\/+$/, '');
    const slash = d.indexOf('/');
    if (slash === -1) {
      return host === d || host.endsWith(`.${d}`);
    }
    const dHost = d.slice(0, slash);
    const dPath = d.slice(slash);
    return (host === dHost || host.endsWith(`.${dHost}`)) && (path === dPath || path.startsWith(`${dPath}/`) || path.startsWith(dPath));
  });
}

// ---------------------------------------------------------------------------
// الـ3-tier fallback — §4: «(site:A OR site:B) q ← site:A + أول 5 كلمات ← بحث عام يتبعه فلتر»
// للمزودات اللي بتدعم includeDomains بشكل أصلي (Exa/Tavily) المراتب مش محتاجة.
// ---------------------------------------------------------------------------
export function buildTierQueries(domains: string[], query: string): string[] {
  if (domains.length === 0) return [query];
  const firstFive = query.trim().split(/\s+/).slice(0, 5).join(' '); // §4: أول خمس كلمات
  const tier1 = `(${domains.map((d) => `site:${d}`).join(' OR ')}) ${query}`;
  const tier2 = `site:${domains[0]} ${firstFive}`;
  const tier3 = query; // بحث عام — يتبعه فلتر matchesSite
  return [tier1, tier2, tier3];
}

// ---------------------------------------------------------------------------
// المزودات — HTTP فقط، بدون أي اعتماديات خارجية
// ملاحظة أسماء env: EXA_API_KEY / TAVILY_API_KEY / SERPAPI_API_KEY — أسماء
// مقترحة تحتاج تأكيدًا من .env.example الفعلي عند الدمج (ملحق E)
// ---------------------------------------------------------------------------

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url.split('?')[0]}`);
  return res.json() as Promise<unknown>;
}

export const exaProvider: SearchProvider = {
  name: 'exa',
  isConfigured: () => Boolean(process.env.EXA_API_KEY),
  async search(req) {
    const key = process.env.EXA_API_KEY;
    if (!key) throw new Error('EXA_API_KEY غير مضبوط');
    const body: Record<string, unknown> = {
      query: req.query + geoPinSuffix(req.query), // §4 geoPin
      numResults: Math.min(req.limit, 20),
      type: 'auto',
    };
    if (req.domains.length > 0) body.includeDomains = req.domains; // §13: محرك المنصات الأساسي
    if (req.freshnessDays) body.startPublishedDaysAgo = req.freshnessDays;
    const data = await fetchJson('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as { results?: Array<{ title?: string; url?: string; publishedDate?: string; text?: string; summary?: string }> };
    return (data.results ?? []).map((r) => ({
      title: r.title ?? null,
      url: r.url ?? '',
      snippet: (r.summary ?? r.text ?? null)?.slice(0, 500) ?? null,
      publishedAt: r.publishedDate ?? null,
      provider: 'exa',
    })).filter((r) => r.url !== '');
  },
};

export const tavilyProvider: SearchProvider = {
  name: 'tavily',
  isConfigured: () => Boolean(process.env.TAVILY_API_KEY),
  async search(req) {
    const key = process.env.TAVILY_API_KEY;
    if (!key) throw new Error('TAVILY_API_KEY غير مضبوط');
    const body: Record<string, unknown> = {
      api_key: key,
      query: req.query + geoPinSuffix(req.query),
      max_results: Math.min(req.limit, 20),
      search_depth: 'basic',
    };
    if (req.domains.length > 0) body.include_domains = req.domains;
    const data = await fetchJson('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as { results?: Array<{ title?: string; url?: string; content?: string; published_date?: string }> };
    return (data.results ?? []).map((r) => ({
      title: r.title ?? null,
      url: r.url ?? '',
      snippet: r.content?.slice(0, 500) ?? null,
      publishedAt: r.published_date ?? null,
      provider: 'tavily',
    })).filter((r) => r.url !== '');
  },
};

export const serpApiProvider: SearchProvider = {
  name: 'serpapi',
  isConfigured: () => Boolean(process.env.SERPAPI_API_KEY),
  async search(req) {
    const key = process.env.SERPAPI_API_KEY;
    if (!key) throw new Error('SERPAPI_API_KEY غير مضبوط');
    // SerpAPI لا يدعم includeDomains أصليًا — المراتب الثلاثة بتعمل الشغل (§4)
    const tiers = buildTierQueries(req.domains, req.query);
    let lastErr: unknown = null;
    for (const tierQuery of tiers) {
      try {
        const url = new URL('https://serpapi.com/search.json');
        url.searchParams.set('engine', 'google');
        url.searchParams.set('q', tierQuery + geoPinSuffix(req.query));
        url.searchParams.set('num', String(Math.min(req.limit, 20)));
        url.searchParams.set('api_key', key);
        const data = await fetchJson(url.toString()) as {
          organic_results?: Array<{ title?: string; link?: string; snippet?: string; date?: string }>;
        };
        const hits = (data.organic_results ?? [])
          .map((r) => ({
            title: r.title ?? null,
            url: r.link ?? '',
            snippet: r.snippet?.slice(0, 500) ?? null,
            publishedAt: r.date ?? null,
            provider: 'serpapi',
          }))
          .filter((r) => r.url !== '' && matchesSite(r.url, req.domains)); // tier3: بحث عام يتبعه فلتر
        if (hits.length > 0) return hits;
      } catch (e) { lastErr = e; }
    }
    if (lastErr) throw lastErr;
    return [];
  },
};

// ---------------------------------------------------------------------------
// ZenRows→Bing — §13: «ZenRows — سكراب SERP بديل بعد موت Serper (3 مفاتيح،
// 1000 كريدت/شهر لكل مفتاح، 1 كريدت/بحث Bing)» — mkt=en-US إجباري،
// Bing من سيرفرات DC بيتعمله TLS soft-block وZenRows بيحل المسار ده.
// المفاتيح في ZENROWS_API_KEYS (CSV) — دوران بينها لتوزيع الحصة (ملحق E).
// ---------------------------------------------------------------------------

const ZENROWS_ENDPOINT = 'https://api.zenrows.com/v1/';
let zenrowsKeyCursor = 0;

function zenrowsKeys(): string[] {
  return (process.env.ZENROWS_API_KEYS ?? '')
    .split(',').map((k) => k.trim()).filter((k) => k.length > 0);
}

/** لينكات Bing الملفوفة /ck/a?u=a1<base64url> بتتفك لرابط المصدر الحقيقي */
function decodeBingRedirect(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === 'www.bing.com' && u.pathname === '/ck/a') {
      const raw = u.searchParams.get('u') ?? '';
      if (raw.startsWith('a1')) {
        const b64 = raw.slice(2).replace(/-/g, '+').replace(/_/g, '/');
        const decoded = Buffer.from(b64, 'base64').toString('utf8');
        if (/^https?:\/\//.test(decoded)) return decoded;
      }
    }
  } catch { /* الرابط الأصلي زي ما هو */ }
  return url;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseBingHtml(html: string, limit: number): RawHit[] {
  const hits: RawHit[] = [];
  const blocks = html.split('<li class="b_algo');
  for (let i = 1; i < blocks.length && hits.length < limit; i++) {
    const block = blocks[i].slice(0, 4000);
    const linkMatch = block.match(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
      ?? block.match(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;
    const url = decodeBingRedirect(linkMatch[1].replace(/&amp;/g, '&'));
    if (!/^https?:\/\//.test(url)) continue;
    const title = stripTags(linkMatch[2]) || null;
    const pMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const snippet = pMatch ? stripTags(pMatch[1]).slice(0, 500) : null;
    // §20.11-4: التاريخ مش متوفر من Bing HTML → null مش تخمين
    hits.push({ title, url, snippet, publishedAt: null, provider: 'zenrows-bing' });
  }
  return hits;
}

export const zenrowsBingProvider: SearchProvider = {
  name: 'zenrows-bing',
  isConfigured: () => zenrowsKeys().length > 0,
  async search(req) {
    const keys = zenrowsKeys();
    if (keys.length === 0) throw new Error('ZENROWS_API_KEYS غير مضبوط');
    // Bing بيدعم site: أصليًا — نفس المراتب الثلاثة زي SerpAPI (§4)
    const tiers = buildTierQueries(req.domains, req.query);
    let lastErr: unknown = null;
    for (const tierQuery of tiers) {
      const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(tierQuery + geoPinSuffix(req.query))}&mkt=en-US&count=${Math.min(req.limit, 20)}`; // mkt=en-US إجباري (§13)
      for (let k = 0; k < keys.length; k++) {
        const idx = (zenrowsKeyCursor + k) % keys.length;
        try {
          const res = await fetch(`${ZENROWS_ENDPOINT}?apikey=${encodeURIComponent(keys[idx])}&url=${encodeURIComponent(bingUrl)}`, { signal: AbortSignal.timeout(25_000) });
          if (!res.ok) throw new Error(`HTTP ${res.status} من ZenRows (مفتاح رقم ${idx + 1})`);
          zenrowsKeyCursor = (idx + 1) % keys.length; // دوران لتوزيع الحصة
          const hits = parseBingHtml(await res.text(), req.limit)
            .filter((r) => matchesSite(r.url, req.domains)); // tier3: بحث عام يتبعه فلتر
          if (hits.length > 0) return hits;
          break; // الطلب نجح لكن صفر نتايج → جرب المراتب التانية
        } catch (e) { lastErr = e; } // مفتاح فاشل → التالي (ملحق G-7: بديل مش retry لا نهائي)
      }
    }
    if (lastErr) throw lastErr;
    return [];
  },
};

// ---------------------------------------------------------------------------
// السلسلة — §13: فشل مزود يفعّل البديل المسموح، لا retry بلا نهاية (ملحق G-7)
// z-ai: SDK مدمج في المشروع (§13) — يستضيفه التطبيق عبر setCustomProvider
// ---------------------------------------------------------------------------

let customProvider: SearchProvider | null = null;

/** يستدعيه التطبيق المضيف لحقن مزود z-ai المدمج (z-ai-web-dev-sdk §13) */
export function setCustomProvider(p: SearchProvider | null): void {
  customProvider = p;
}

function defaultChain(): SearchProvider[] {
  const list: SearchProvider[] = [];
  if (customProvider) list.push(customProvider); // z-ai أولًا إن كان محقونًا
  list.push(exaProvider, tavilyProvider, serpApiProvider, zenrowsBingProvider); // §13: Exa أساسي ثم البدائل ثم ZenRows→Bing احتياطي
  return list;
}

let chainOverride: SearchProvider[] | null = null; // للاختبارات فقط

export function setProviderChainForTests(providers: SearchProvider[] | null): void {
  chainOverride = providers;
}

export async function searchViaChain(req: SearchRequest): Promise<RawHit[]> {
  const chain = chainOverride ?? defaultChain();
  const errors: string[] = [];
  for (const p of chain) {
    if (!p.isConfigured()) continue;
    try {
      const hits = await p.search(req);
      if (hits.length > 0) return hits;
      // مزود رجّع صفر بدون خطأ → جرب التالي (§4: fallback من استعلام متعدد النطاقات لأبسط ثم عام)
    } catch (e) {
      errors.push(`${p.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (errors.length > 0 && chain.every((p) => !p.isConfigured() || errors.some((x) => x.startsWith(p.name)))) {
    throw new Error(`كل مزودات البحث فشلت — ${errors.join(' | ')}`);
  }
  return [];
}
