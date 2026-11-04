// LeadOS — البحث الدائم (طلب المستخدم: «عايز البحث يكون دائم يفضل ينتقل من منصة لمنصة بدون توقف»)
// Next.js instrumentation hook: بيشتغل مرة واحدة مع بداية السيرفر —
// بيشغّل نبضة الأوركستراتور (processTick) كل 3 دقايق للأبد من داخل السيرفر نفسه:
//  • كل نبضة بتجدول القواعد المستحقة (rate-limit: جوبة لكل قاعدة كل 10 دقايق)
//  • expandSourceTypes بيلفّ موجة 4 منصات كل ساعة على الـ16+ منصة (دوران بأوزان متعلمة)
//  • الجوبات بتتحسب وتتصطاد — النتايج بتتسجل في نفس قاعدة البيانات المحلية الواحدة
// لو عايز تقفه: NEXT_INTERNAL_TICK=0 في البيئة. النبضة الخارجية (cron-job.org) لسه شغالة زي ما هي.
export async function register(): Promise<void> {
  console.log(`[instrumentation] register called — runtime=${process.env.NEXT_RUNTIME} dev=${process.env.NODE_ENV}`)
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  if (process.env.NEXT_INTERNAL_TICK === "0") return

  const g = globalThis as typeof globalThis & { __leadOsTickTimer?: ReturnType<typeof setTimeout>; __leadOsTickBusy?: boolean }
  if (g.__leadOsTickTimer) return // السيرفر بيعمل hot-reload — من غير الحارس كل reload يولّد loop جديد

  const INTERVAL_MS = 3 * 60 * 1000
  let first = true

  const loop = async (): Promise<void> => {
    if (g.__leadOsTickBusy) return // النبضة السابقة لسه شغالة — مفيش تداخل أبدًا
    g.__leadOsTickBusy = true
    const t0 = Date.now()
    try {
      const { processTick } = await import("@/lib/queue")
      const r = await processTick(2)
      console.log(
        `[internal-tick] ${first ? "أول نبضة" : "نبضة"} — jobs=${r.processed} scheduled=${r.scheduledRules} in ${((Date.now() - t0) / 1000).toFixed(1)}s` +
          (r.details.length ? ` — ${r.details.slice(0, 3).join(" | ").slice(0, 240)}` : ""),
      )
    } catch (err) {
      console.error("[internal-tick] فشلت النبضة (هتعيد المحاولة الدورة الجاية):", err instanceof Error ? err.message.slice(0, 200) : err)
    } finally {
      first = false
      g.__leadOsTickBusy = false
    }
  }

  // أول نبضة بعد 45ث من إقلاع السيرفر (نسيب الـbuild/dev يستقر)، وبعدين كل 3 دقايق — للأبد
  g.__leadOsTickTimer = setTimeout(() => {
    void loop()
    const iv = setInterval(() => void loop(), INTERVAL_MS)
    // لا يُفصَل — النبضة عايزة تعيش مع السيرفر
    iv.unref?.()
  }, 45_000)
  g.__leadOsTickTimer.unref?.()
}
