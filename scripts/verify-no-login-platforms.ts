/**
 * Ezz / LeadOS — اختبارات قبول حزمة المنصات بدون تسجيل دخول
 * -----------------------------------------------------------
 * مرجع المطابقة: §20.11 «اختبارات قبول لا يجوز تجاوزها» — كل فحص يحمل رقم
 * البند المقابل له، زائد فحوص ميكانيزم المحرك من §4 و§5.
 *
 * التشغيل (Node ≥ 23.6 أو bun/tsx داخل مستودع LeadOS):
 *   node verify.ts
 * لا يحتاج شبكة ولا مفاتيح — كل النداءات الخارجية محقونة كـfake providers.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PLATFORM_TYPES, CONNECTION_STATES } from '../src/lib/platforms/contract.ts';
import { PLATFORM_CONFIGS, validatePolicy } from '../src/lib/platforms/platform-configs.ts';
import { BudgetTracker } from '../src/lib/platforms/budget.ts';
import {
  matchesSite, geoPinSuffix, setProviderChainForTests, type SearchProvider, type RawHit,
} from '../src/lib/platforms/search-provider.ts';
import {
  buildPublicSearchConnector, normalizeHit, canonicalUrl, DEFAULT_BUCKET_CAP,
} from '../src/lib/platforms/connector-factory.ts';
import {
  buildRegistry, NO_LOGIN_ORDER, LOGIN_REQUIRED_ORDER, planQueries,
  interleave, maxQueriesForMode, runNoLoginWave,
} from '../src/lib/platforms/registry.ts';

const here = dirname(fileURLToPath(import.meta.url));

let passed = 0;
const failures: string[] = [];
function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed += 1; console.log(`  ✓ ${name}`); })
    .catch((e) => { failures.push(name); console.log(`  ✗ ${name}\n    ${e instanceof Error ? e.message : String(e)}`); });
}

// مزودات وهمية للاختبار — بدون شبكة
function fakeProvider(name: string, hits: RawHit[] | Error): SearchProvider {
  return {
    name,
    isConfigured: () => true,
    async search() {
      if (hits instanceof Error) throw hits;
      return hits;
    },
  };
}
const hit = (url: string, extra: Partial<RawHit> = {}): RawHit => ({
  title: extra.title !== undefined ? extra.title : 'عنوان تجريبي',
  url, snippet: extra.snippet !== undefined ? extra.snippet : 'مطلوب شركة برمجيات في مصر',
  // ملاحظة: null المقصود لازم يفضل null (مش بيتحول لتاريخ حالي)
  publishedAt: extra.publishedAt !== undefined ? extra.publishedAt : new Date().toISOString(),
  provider: extra.provider ?? 'fake',
});

async function main(): Promise<void> {
  console.log('\n=== اختبارات القبول — حزمة المنصات بدون تسجيل دخول (§20.11) ===\n');

  // ---------------------------------------------------------------- فحوص البنية
  console.log('— بنية السجل والترتيب (أمر المالك + ملحق D) —');
  await check('1. السجل يشمل كل الأنواع الـ20 الموثقة (ملحق D)', () => {
    const reg = buildRegistry();
    assert.equal(reg.size, PLATFORM_TYPES.length);
    for (const t of PLATFORM_TYPES) assert.ok(reg.has(t), `ناقص ${t}`);
  });
  await check('2. الترتيب: بدون دخول (14) أولًا ثم المحتاجة دخول (6)', () => {
    assert.equal(NO_LOGIN_ORDER.length, 14);
    assert.equal(LOGIN_REQUIRED_ORDER.length, 6);
    const first = NO_LOGIN_ORDER[0], second = NO_LOGIN_ORDER[1];
    assert.equal(first, 'REDDIT');
    assert.equal(second, 'TELEGRAM'); // §4: المجاني الأول REDDIT+TELEGRAM دايمًا
    const idx = (t: string) => [...NO_LOGIN_ORDER, ...LOGIN_REQUIRED_ORDER].indexOf(t as never);
    for (const t of NO_LOGIN_ORDER) for (const l of LOGIN_REQUIRED_ORDER) assert.ok(idx(t) < idx(l));
  });
  await check('3. كل منصة بدون دخول حالتها PUBLIC_ACCESS والمحتاجة دخول حالتها معلنة', () => {
    const reg = buildRegistry();
    for (const t of NO_LOGIN_ORDER) {
      const v = reg.get(t)!.validatePolicy();
      assert.equal(v.state, 'PUBLIC_ACCESS', `${t} supposed PUBLIC_ACCESS got ${v.state}`);
    }
    assert.equal(reg.get('LINKEDIN')!.validatePolicy().state, 'POLICY_BLOCKED');
    assert.equal(reg.get('WHATSAPP')!.validatePolicy().state, 'REQUIRES_APPROVAL');
    for (const t of ['FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'X'] as const) {
      assert.equal(reg.get(t)!.validatePolicy().state, 'NEEDS_USER_LOGIN');
    }
  });

  console.log('\n— §20.11-2/3: بوابة منصات الدخول — سبب واضح ولا التفاف —');
  await check('4. موصلات الدخول تعيد صفر نتايج مع سبب معلن', async () => {
    const reg = buildRegistry();
    for (const t of LOGIN_REQUIRED_ORDER) {
      const a = reg.get(t)!;
      const results = await a.search('أي استعلام');
      assert.equal(results.length, 0, `${t} لازم صفر نتايج`);
      const reason = a.healthCheck().lastGateReason;
      assert.ok(reason && reason.length > 10, `${t} لازم سبب معلن`);
    }
  });
  await check('5. لينكدإن: الكشط POLICY_BLOCKED بمرجع سياسة §22', () => {
    const v = validatePolicy(PLATFORM_CONFIGS.LINKEDIN);
    assert.equal(v.state, 'POLICY_BLOCKED');
    assert.ok(v.policyRefs[0].includes('linkedin.com'));
  });

  console.log('\n— §4: ميكانيزم المحرك الموثق —');
  await check('6. الحداثة لكل منصة: كورا/ديسكورد 90 · معارض 75 · أدلة/تقييمات 60 · إعلانات 30', () => {
    assert.equal(PLATFORM_CONFIGS.QUORA.freshnessDays, 90);
    assert.equal(PLATFORM_CONFIGS.DISCORD.freshnessDays, 90);
    assert.equal(PLATFORM_CONFIGS.EVENTS.freshnessDays, 75);
    assert.equal(PLATFORM_CONFIGS.DIRECTORY.freshnessDays, 60);
    assert.equal(PLATFORM_CONFIGS.REVIEWS.freshnessDays, 60);
    assert.equal(PLATFORM_CONFIGS.ADS_LIBRARY.freshnessDays, 30);
  });
  await check('7. geoPin: مصر افتراضيًا والاستعلام الخليجي بدون مصر', () => {
    assert.equal(geoPinSuffix('برامج محاسبة'), ' مصر');
    assert.equal(geoPinSuffix('مطاعم دبي'), '');
    assert.equal(geoPinSuffix('marketing agency riyadh'), '');
  });
  await check('8. matchesSite يمنع تسريب النتايج بين المنصات (host+path)', () => {
    assert.equal(matchesSite('https://www.facebook.com/ads/library/active/?q=x', ['facebook.com/ads/library']), true);
    assert.equal(matchesSite('https://facebook.com/somepage', ['facebook.com/ads/library']), false);
    assert.equal(matchesSite('https://reddit.com/r/egypt', ['reddit.com']), true);
    assert.equal(matchesSite('https://notreddit.com/r/egypt', ['reddit.com']), false);
  });
  await check('9. سقف الجوبة: wave=10 وfull=18 استعلام (§4/ملحق H)', () => {
    assert.equal(maxQueriesForMode('wave'), 10);
    assert.equal(maxQueriesForMode('full'), 18);
    const plan = planQueries(['برامج محاسبة', 'أنظمة CRM'], NO_LOGIN_ORDER, 'full');
    assert.ok(plan.length <= 18);
    // عدالة التوزيع (§4): كل منصة ليها حضور
    const seen = new Set(plan.map((p) => p.platform));
    assert.ok(seen.size >= 8, `توزيع ضعيف: ${seen.size}`);
  });
  await check('10. سقف الدلو: limit افتراضي 12 = limitPerQuery×2 (§4)', () => {
    assert.equal(DEFAULT_BUCKET_CAP, 12);
  });
  await check('11. الدمج المتناوب: كل منصة ليها حضور في النتيجة (§4)', () => {
    const mixed = interleave([
      { platform: 'REDDIT', results: [{ dedupeKey: 'r1' } as never, { dedupeKey: 'r2' } as never] },
      { platform: 'QUORA', results: [{ dedupeKey: 'q1' } as never] },
    ]);
    assert.equal(mixed.length, 3);
    assert.equal(mixed[0].dedupeKey, 'r1');
    assert.equal(mixed[1].dedupeKey, 'q1'); // تناوب فعلي
    assert.equal(mixed[2].dedupeKey, 'r2');
  });

  console.log('\n— §20.11-4: التوحيد والدليل والحقول الناقصة —');
  await check('12. كل نتيجة موحدة لها مصدر ووقت التقاط ومفتاح منع تكرار، والناقص null', () => {
    const r = normalizeHit({
      platform: 'QUORA', url: 'https://quora.com/q/1', title: null, snippet: null,
      publishedAt: null, providerName: 'fake', accessMethod: 'SEARCH_PROVIDER',
    });
    assert.equal(r.sourceUrl, 'https://quora.com/q/1');
    assert.ok(r.collectedAt);
    assert.equal(r.title, null); // §20.11-4: مش بنخمّن
    assert.equal(r.snippet, null);
    assert.ok(r.dedupeKey.startsWith('QUORA:'));
  });
  await check('13. نتايج مكتبات الإعلانات تُوسم AD_SPENDER (§5)', async () => {
    const conn = buildPublicSearchConnector(PLATFORM_CONFIGS.ADS_LIBRARY, {
      providers: [fakeProvider('fake', [hit('https://facebook.com/ads/library/x')])],
    });
    const results = await conn.search('برامج محاسبة مصر');
    assert.equal(results[0]?.intentSignal, 'AD_SPENDER');
  });
  await check('14. الحداثة بتشيل الأقدم من 90 يوم للكورا، والناقص التاريخ بيخفض الثقة (مش بينشيله)', async () => {
    const conn = buildPublicSearchConnector(PLATFORM_CONFIGS.QUORA, {
      providers: [fakeProvider('fake', [
        hit('https://quora.com/fresh', { publishedAt: new Date(Date.now() - 10 * 86400000).toISOString() }),
        hit('https://quora.com/stale', { publishedAt: new Date(Date.now() - 120 * 86400000).toISOString() }),
        hit('https://quora.com/nodate', { publishedAt: null }),
      ])],
    });
    const results = await conn.search('افضل برامج محاسبة في مصر');
    const urls = results.map((r) => r.sourceUrl);
    assert.ok(urls.includes('https://quora.com/fresh'));
    assert.ok(!urls.includes('https://quora.com/stale'), 'القديم عن 90 يوم لازم يتشال (§4)');
    assert.ok(urls.includes('https://quora.com/nodate'));
    const nodate = results.find((r) => r.sourceUrl === 'https://quora.com/nodate')!;
    assert.ok(nodate.confidence < 0.5);
  });

  console.log('\n— §20.11-8 + §29: عزل الأعطال وقاطع الدائرة —');
  await check('15. فشل موصل واحد لا يوقف الموجة (عزل كامل)', async () => {
    setProviderChainForTests([fakeProvider('broken', new Error('انفجر المزود'))]);
    try {
      const reg = buildRegistry();
      const report = await runNoLoginWave(reg, ['برامج محاسبة'], 'wave', { limit: 3 });
      // REDDIT بيشتغل بدون مزودات — ربما يعطي صفر على شبكة مختبرية؛ المهم عدم الرمي وجود تقرير
      assert.ok(Array.isArray(report.results));
      assert.ok(Array.isArray(report.errors));
    } finally {
      setProviderChainForTests(null);
    }
  });
  await check('16. قاطع الدائرة يفتح بعد 3 أعطال متتالية (§29)', async () => {
    const conn = buildPublicSearchConnector(PLATFORM_CONFIGS.GOOGLE_SEARCH, {
      providers: [fakeProvider('broken', new Error('نفد الرصيد'))],
      limitsPerDay: 100,
    });
    for (let i = 0; i < 3; i++) await conn.search('استعلام');
    assert.equal(conn.getUsageBudget().circuitOpen, true);
    assert.equal(conn.connectionState(), 'RATE_LIMITED'); // §20.3: توقف احترامًا للحدود
    assert.ok(conn.getLastError()!.includes('نفد الرصيد'));
  });
  await check('17. سقف الميزانية اليومي يرجّع RATE_LIMITED بدون نداء (§20.7)', async () => {
    const conn = buildPublicSearchConnector(PLATFORM_CONFIGS.GOOGLE_SEARCH, {
      providers: [fakeProvider('fake', [hit('https://example.com/a')])],
      limitsPerDay: 1, limitsPerHour: 1,
    });
    const first = await conn.search('q');
    assert.equal(first.length, 1);
    assert.equal(conn.connectionState(), 'RATE_LIMITED');
    const second = await conn.search('q');
    assert.equal(second.length, 0);
  });
  await check('18. BudgetTracker: نجاح واحد بعد فشل يصفّر العداد (§29)', () => {
    const b = new BudgetTracker('TEST', { perDay: 100, perHour: 100 });
    b.recordFailure(); b.recordFailure();
    b.recordSuccess();
    assert.equal(b.snapshot().consecutiveFailures, 0);
    assert.equal(b.snapshot().circuitOpen, false);
  });

  console.log('\n— §20.11-1: خصوصية الجلسات — مفيش لمس كوكيز/جلسات في مسار بدون دخول —');
  await check('19. فحص بنيوي: ملفات الموصلات العامة لا تحتوي cookie/localStorage/session-store', () => {
    const files = [
      '../src/lib/platforms/contract.ts',
      '../src/lib/platforms/platform-configs.ts',
      '../src/lib/platforms/budget.ts',
      '../src/lib/platforms/search-provider.ts',
      '../src/lib/platforms/connector-factory.ts',
      '../src/lib/platforms/registry.ts',
      '../src/lib/platforms/connectors/reddit.ts',
      '../src/lib/platforms/connectors/telegram.ts',
    ];
    for (const f of files) {
      const content = readFileSync(join(here, f), 'utf8');
      assert.ok(!/cookie|localStorage|session-store|remote-debugging/i.test(content), `${f} فيه إشارة لجلسات/كوكيز`);
    }
  });
  await check('20. الحالات العشر موثقة زي ما هي في §20.3', () => {
    assert.equal(CONNECTION_STATES.length, 10);
    for (const s of ['NOT_CONFIGURED', 'PUBLIC_ACCESS', 'NEEDS_USER_LOGIN', 'CONNECTED_OFFICIAL_API',
      'CONNECTED_LOCAL_BROWSER', 'PAUSED_BY_USER', 'RATE_LIMITED', 'REQUIRES_APPROVAL', 'POLICY_BLOCKED', 'UNAVAILABLE']) {
      assert.ok(CONNECTION_STATES.includes(s as never));
    }
  });
  await check('21. canonicalUrl بيحططل تتبع utm وبيثبّت مفتاح التكرار', () => {
    const a = canonicalUrl('https://Example.com/page/?utm_source=x&id=2');
    const b = canonicalUrl('https://www.example.com/page/?id=2#sec');
    assert.equal(a, 'example.com/page?id=2');
    assert.equal(a, b);
  });

  console.log(`\n=== النتيجة: ${passed} نجح — ${failures.length} فشل ===\n`);
  if (failures.length > 0) {
    console.log('الفحوص الفاشلة:', failures.join(' · '));
    process.exit(1);
  }
}

main();
