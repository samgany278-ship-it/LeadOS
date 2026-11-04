/**
 * Ezz / LeadOS — الـRunner المحلي لموجات المنصات بدون تسجيل دخول
 * ----------------------------------------------------------------
 * الفكرة (نفس نمط الـWorker الخارجي §12): المشروع الأصلي محدوش — الـrunner
 * بيشغّل الموجة محليًا ويرسل النتايج الموحدة على /api/ingest/webhook، فتمرّ
 * على نفس خط التطبيع ومنع التكرار والتصنيف والتقييم الموجودين في LeadOS.
 * صفر تعديل على discovery.ts أو queue.ts («متكسرهاش» §4).
 *
 * التشغيل:
 *   LEADOS_BASE_URL=https://leados-v2.vercel.app INGEST_API_KEY=*** \
 *   bunx tsx runner/run-no-login-wave.ts --niche "برامج محاسبة" --mode wave
 *
 * أول تشغيل يفضل --dry عشان تشوف النتايج قبل أي إرسال.
 *
 * ⚠ صيغة ترويسة المصادقة في /api/ingest/webhook غير موثقة حرفيًا في الملخص —
 *   راجع worker/leados_client.py (§12) قبل أول إرسال حقيقي وعدّل
 *   INGEST_HEADER_FORMAT لو مختلفة. ممنوع تمرير أي أسرار في query strings (§18).
 */

import { buildRegistry, runNoLoginWave, type WaveMode } from '../src/lib/platforms/registry.ts';

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function postToIngest(results: unknown[]): Promise<number> {
  const base = process.env.LEADOS_BASE_URL;
  const key = process.env.INGEST_API_KEY;
  if (!base || !key) throw new Error('LEADOS_BASE_URL وINGEST_API_KEY مطلوبين للإرسال (أسماء موثقة §12/ملحق E)');

  const headerFormat = process.env.INGEST_HEADER_FORMAT ?? 'x-api-key'; // ✓ مؤكد من worker/leados_client.py: x-api-key
  const headers: Record<string, string> = { 'Content-Type': 'application/json', [headerFormat]: key };
  if (headerFormat === 'bearer') headers.Authorization = `Bearer ${key}`;

  let ok = 0;
  const BATCH = 25;
  for (let i = 0; i < results.length; i += BATCH) {
    const batch = results.slice(i, i + BATCH);
    const res = await fetch(`${base.replace(/\/+$/, '')}/api/ingest/webhook`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ source: 'no-login-connectors', results: batch }),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.ok) ok += batch.length;
    else console.error(`  ✗ دفعة ${i}-${i + batch.length}: HTTP ${res.status}`);
  }
  return ok;
}

async function main(): Promise<void> {
  const niche = argValue('--niche') ?? 'برامج محاسبة';
  const mode: WaveMode = (argValue('--mode') as WaveMode) === 'full' ? 'full' : 'wave';
  const dry = process.argv.includes('--dry') || !process.env.INGEST_API_KEY;
  const limit = Number(argValue('--limit') ?? '12');

  console.log(`\n🟢 Ezz No-Login Wave — نيش: «${niche}» — وضع: ${mode}${dry ? ' (DRY — بدون إرسال)' : ''}\n`);

  const registry = buildRegistry();
  const t0 = Date.now();
  const report = await runNoLoginWave(registry, [niche], mode, { limit });

  console.log('— توزيع النتايج على المنصات (بدون تسجيل دخول) —');
  for (const [p, n] of Object.entries(report.byPlatform)) console.log(`  ${p.padEnd(14)} ${n}`);
  const total = Object.values(report.byPlatform).reduce((a, b) => a + b, 0);
  console.log(`  المجموع: ${total} نتيجة موحدة في ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

  if (report.errors.length > 0) {
    console.log('— أخطاء معزولة (المنصات التانية اشتغلت عادي §20.11-8) —');
    for (const e of report.errors) console.log(`  ✗ ${e.platform}: ${e.error}`);
    console.log('');
  }

  console.log('— منصات محتاجة دخول (موقوفة بالبوابة — في الآخر بأمر المالك) —');
  for (const g of report.gates) console.log(`  ⛔ ${g.platform} [${g.state}] ${g.reason.slice(0, 90)}…`);
  console.log('');

  // شفافية الأخطاء — §20.4: لوحة توضح الأخطاء وآخر نجاح لكل منصة
  const sick = [...registry.values()].filter((a) => a.getLastError());
  if (sick.length > 0) {
    console.log('— صحة المنصات العامة بعد الموجة (آخر خطأ لكل واحدة) —');
    for (const a of sick) console.log(`  ⚠ ${a.platformType}: ${a.getLastError()?.slice(0, 100)}`);
    console.log('');
  }

  if (dry) {
    for (const r of report.results.slice(0, 10)) {
      console.log(`• [${r.sourcePlatform}] ${r.title ?? '(بدون عنوان)'}`);
      console.log(`  ${r.sourceUrl}`);
      console.log(`  ثقة=${r.confidence} نية=${r.intentSignal ?? '—'} لغة=${r.language ?? '—'} دليل=${r.evidence.slice(0, 80)}`);
    }
    console.log(`\n✅ DRY انتهى — للإرسال الفعلي أضف LEADOS_BASE_URL + INGEST_API_KEY (وشيل --dry).`);
    return;
  }

  const sent = await postToIngest(report.results);
  console.log(`\n📨 اتبعت ${sent}/${report.results.length} نتيجة على /api/ingest/webhook — هتتطبّع وتتصنف وتتقيّم في خط LeadOS الحالي (§12).`);
}

main().catch((e) => {
  console.error('فشل الـrunner:', e instanceof Error ? e.message : e);
  process.exit(1);
});
