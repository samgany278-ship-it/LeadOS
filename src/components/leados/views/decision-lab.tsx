"use client";
// Ezz Decision Lab (سبك §28.4) — بطاقات قرار علمية: أدلة + بدائل + قياس مقابل خط أساس
import { useState } from "react"
import { useApi, apiSend, timeAgo, LoadingBlock, EmptyState } from "../shared"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { FlaskConical, Scale, CheckCircle2, Gauge } from "lucide-react"

interface Ev { source: string; url: string | null; date: string; kind: string }
interface Opt { name: string; cost?: string; benefit?: string; risk?: string }
interface Card_ {
  id: string; goal: string; successMetric: string | null; status: string
  options: Opt[]; evidence: Ev[]; chosenOption: string | null
  approvalRequired: boolean; measuredOutcome: { metric: string; value: number; baselineValue: number | null; note?: string } | null
  reviewAt: string | null; updatedAt: string
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  PROPOSED: { label: "مقترح", cls: "bg-amber-500/15 text-amber-300" },
  IN_REVIEW: { label: "قيد المراجعة", cls: "bg-sky-500/15 text-sky-300" },
  DECIDED: { label: "متخذ", cls: "bg-violet-500/15 text-violet-300" },
  MEASURED: { label: "مقاس النتيجة", cls: "bg-emerald-500/15 text-emerald-300" },
  RETIRED: { label: "مستبعد", cls: "bg-muted text-muted-foreground" },
}

export function DecisionLabView() {
  const { data, loading, refresh } = useApi<{ cards: Card_[]; byStatus: Record<string, number> }>("/api/decisions")
  const { toast } = useToast()
  const [goal, setGoal] = useState("")
  const [metric, setMetric] = useState("")
  const [optA, setOptA] = useState("")
  const [optB, setOptB] = useState("")
  const [evSource, setEvSource] = useState("")
  const [busy, setBusy] = useState(false)

  const create = async () => {
    setBusy(true)
    try {
      await apiSend("/api/decisions", "POST", {
        goal, successMetric: metric || undefined,
        options: [{ name: optA, cost: "—" }, { name: optB, cost: "—" }],
        evidence: [{ source: evSource, kind: "OBSERVED" }],
        baseline: null,
      })
      toast({ title: "بطاقة قرار اتولدت 🧪" })
      setGoal(""); setMetric(""); setOptA(""); setOptB(""); setEvSource(""); refresh()
    } catch (e) {
      toast({ title: "اترفضت البطاقة", description: (e as Error).message, variant: "destructive" })
    } finally { setBusy(false) }
  }

  const act = async (c: Card_, action: string, extra: Record<string, unknown> = {}) => {
    try {
      await apiSend(`/api/decisions/${c.id}`, "PATCH", { action, ...extra })
      refresh()
    } catch (e) {
      toast({ title: "فشل الإجراء", description: (e as Error).message, variant: "destructive" })
    }
  }

  const cards = data?.cards ?? []
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">المبدأ: مشكلة قبل أداة • دليل قبل ادعاء • مقارنة بدائل • قياس على نتائج فعلية لا تقييم نموذج (سبك §28.2)</p>

      <Card><CardContent className="grid gap-2 p-4 md:grid-cols-2">
        <Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="الهدف: مثال «تقليل تكلفة الليد المؤهل»" />
        <Input value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="مقياس النجاح: مثال «تكلفة العميل المؤهل بالجنيه»" />
        <Input value={optA} onChange={(e) => setOptA(e.target.value)} placeholder="البديل الأول" />
        <Input value={optB} onChange={(e) => setOptB(e.target.value)} placeholder="البديل الثاني" />
        <Input value={evSource} onChange={(e) => setEvSource(e.target.value)} placeholder="الدليل: مثال «AiRun الشهر ده — 300 نداء»" />
        <Button onClick={create} disabled={busy || !goal || !optA || !optB || !evSource}><FlaskConical className="h-4 w-4" /> إنشاء بطاقة</Button>
      </CardContent></Card>

      {loading && !data ? <LoadingBlock /> : cards.length === 0 ? (
        <EmptyState icon={<Scale className="h-10 w-10" />} title="لا بطاقات قرار بعد" hint="سجل قراراتك المهمة هنا بأدلة وبدائل — والنتيجة الفعلية بتتقاس بعد التنفيذ" />
      ) : (
        <div className="space-y-2">
          {cards.map((c) => {
            const st = STATUS_LABELS[c.status] ?? STATUS_LABELS.PROPOSED
            return (
              <Card key={c.id} className="border-border/70"><CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={st.cls}>{st.label}</Badge>
                  {c.approvalRequired && <Badge className="bg-rose-500/15 text-rose-300">🔒 موافقة المالك مطلوبة (§32)</Badge>}
                  <p className="flex-1 text-sm font-bold">{c.goal}</p>
                  <span className="text-[11px] text-muted-foreground">{timeAgo(c.updatedAt)}</span>
                </div>
                {c.successMetric && <p className="text-xs text-muted-foreground">📏 المقياس: {c.successMetric}</p>}
                <div className="flex flex-wrap gap-2">
                  {c.options?.map((o) => (
                    <Badge key={o.name} variant="outline" className={c.chosenOption === o.name ? "border-violet-400/60 text-violet-300" : ""}>
                      {c.chosenOption === o.name ? "✓ " : ""}{o.name}
                    </Badge>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">📚 الأدلة: {c.evidence?.map((e) => `${e.source} (${e.kind}, ${e.date})`).join(" • ")}</p>
                {c.measuredOutcome && (
                  <p className="text-xs text-emerald-300">📊 النتيجة: {c.measuredOutcome.metric} = {c.measuredOutcome.value}{c.measuredOutcome.baselineValue != null ? ` (خط الأساس: ${c.measuredOutcome.baselineValue})` : ""}</p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  {c.status === "PROPOSED" && (
                    <>
                      {c.options?.map((o) => (
                        <Button key={o.name} size="sm" variant="outline" onClick={() => act(c, "decide", { chosenOption: o.name, approvalGranted: true })}>
                          اختيار: {o.name}
                        </Button>
                      ))}
                    </>
                  )}
                  {c.status === "DECIDED" && (
                    <Button size="sm" variant="outline" onClick={() => act(c, "measure", { outcome: { metric: c.successMetric || "نتيجة", value: 1, baselineValue: 0 } })}>
                      <Gauge className="h-3.5 w-3.5" /> تسجيل نتيجة (من شاشة التفاصيل)
                    </Button>
                  )}
                  {c.status !== "RETIRED" && c.status !== "PROPOSED" && (
                    <Button size="sm" variant="ghost" onClick={() => act(c, "retire")}>إستبعاد</Button>
                  )}
                  <CheckCircle2 className="ms-auto h-4 w-4 self-center text-muted-foreground/40" />
                </div>
              </CardContent></Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
