/**
 * Ezz / LeadOS — ميزانيات الاستخدام وقاطع الدائرة
 * -------------------------------------------------
 * المصدر: §20.7 (ميزانية مستقلة لكل موصل + قواطع تعطل) + §29 (Recovery:
 * عدد محدود من المحاولات للأعطال المؤقتة، لا إعادة محاولة عند حظر السياسة
 * أو نفاد الحصة حتى تتغير الحالة بطريقة مشروعة).
 *
 * قاعدة §26: «لا يثبت الحصص المجانية في الكود» — الافتراضيات هنا متحفظة
 * للتشغيل الأول فقط، وتُضبط من متغيرات البيئة عند الدمج.
 */

import type { UsageBudget } from './contract.ts';

export interface BudgetLimits {
  perDay: number;
  perHour: number;
}

/** افتراضيات متحفظة للتشغيل الأول — راجع §26 قبل رفعها */
export const DEFAULT_LIMITS: BudgetLimits = { perDay: 40, perHour: 10 };

/** عتبة قاطع الدائرة: 3 أعطال متتالية → فتح مؤقت (§29: سقف محاولات) */
export const CIRCUIT_FAILURE_THRESHOLD = 3;
/** مدة فتح القاطع بالدقائق قبل نصف فتح تجريبي */
export const CIRCUIT_COOLDOWN_MINUTES = 30;

export class BudgetTracker {
  private usedToday = 0;
  private usedThisHour = 0;
  private dayKey = '';
  private hourKey = '';
  private consecutiveFailures = 0;
  private circuitOpenUntil: number | null = null;

  private limits: BudgetLimits;
  private readonly platform: string;

  constructor(platform: string, limits: BudgetLimits = { ...DEFAULT_LIMITS }) {
    this.platform = platform;
    this.limits = { ...limits };
  }

  setLimits(l: BudgetLimits): void {
    this.limits = { ...l };
  }

  getLimits(): BudgetLimits {
    return { ...this.limits };
  }

  private nowKeys(): { d: string; h: string } {
    const now = new Date();
    const d = now.toISOString().slice(0, 10);
    const h = `${d}T${String(now.getUTCHours()).padStart(2, '0')}`;
    return { d, h };
  }

  private rollCounters(): void {
    const { d, h } = this.nowKeys();
    if (d !== this.dayKey) { this.dayKey = d; this.usedToday = 0; }
    if (h !== this.hourKey) { this.hourKey = h; this.usedThisHour = 0; }
  }

  /** هل يجوز تنفيذ نداء الآن؟ (§29: لا إعادة محاولة بلا نهاية) */
  canRun(): boolean {
    this.rollCounters();
    if (this.circuitOpenUntil !== null) {
      if (Date.now() < this.circuitOpenUntil) return false;
      this.circuitOpenUntil = null; // انتهت مدة الفتح — نصف فتح تجريبي
      this.consecutiveFailures = 0;
    }
    return this.usedToday < this.limits.perDay && this.usedThisHour < this.limits.perHour;
  }

  recordCall(): void {
    this.rollCounters();
    this.usedToday += 1;
    this.usedThisHour += 1;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
      this.circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MINUTES * 60_000;
    }
  }

  snapshot(): UsageBudget {
    this.rollCounters();
    return {
      platform: this.platform,
      usedToday: this.usedToday,
      limitPerDay: this.limits.perDay,
      usedThisHour: this.usedThisHour,
      limitPerHour: this.limits.perHour,
      consecutiveFailures: this.consecutiveFailures,
      circuitOpen: this.circuitOpenUntil !== null && Date.now() < this.circuitOpenUntil,
      circuitOpenUntil: this.circuitOpenUntil !== null
        ? new Date(this.circuitOpenUntil).toISOString()
        : null,
    };
  }
}
