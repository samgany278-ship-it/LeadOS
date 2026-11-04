"use client";
// Ezz Finance (سبك §31.1) — تكاليف وإيرادات وربحية حية
import { useState } from "react"
import { useApi, apiSend, timeAgo, LoadingBlock, EmptyState } from "../shared"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Wallet, TrendingUp, TrendingDown, Percent, Plus } from "lucide-react"

const CATEGORIES = ["AI_API", "TOOL", "HOSTING", "ADS", "DOMAIN", "DEAL", "SERVICE", "OTHER"] as const
const CAT_LABELS: Record<string, string> = {
  AI_API: "ذكاء اصطناعي", TOOL: "أدوات", HOSTING: "استضافة", ADS: "إعلانات",
  DOMAIN: "دومين", DEAL: "صفقة", SERVICE: "خدمة", OTHER: "أخرى",
}

interface Entry {
  id: string; kind: string; category: string; title: string; amount: number
  currency: string; confidence: string; source: string | null; occurredAt: string
}
interface Summary {
  revenue: number; cost: number; profit: number; marginPct: number | null; currency: string
  breakdown: { manualCost: number; manualRevenue: number; aiRunCost: number; aiRunCount: number; dealRevenue: number; wonDeals: number }
  byCategory: Record<string, number>
}

export function FinanceView() {
  const { data, loading, refresh } = useApi<{ summary: Summary; entries: Entry[] }>("/api/finance")
  const { toast } = useToast()
  const [kind, setKind] = useState("COST")
  const [category, setCategory] = useState("TOOL")
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [busy, setBusy] = useState(false)

  const s = data?.summary
  const fmt = (n: number) => `${n.toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ${s?.currency ?? "EGP"}`

  const add = async () => {
    setBusy(true)
    try {
      await apiSend("/api/finance", "POST", { kind, category, title, amount: Number(amount) })
      toast({ title: kind === "COST" ? "اتسجل مصروف ✅" : "اتسجل إيراد ✅" })
      setTitle(""); setAmount(""); refresh()
    } catch (e) {
      toast({ title: "اترفض القيد", description: (e as Error).message, variant: "destructive" })
    } finally { setBusy(false) }
  }

  const remove = async (id: string) => { await apiSend(`/api/finance/${id}`, "DELETE"); refresh() }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> الإيرادات</p>
          <p className="mt-1 text-xl font-extrabold text-emerald-400">{s ? fmt(s.revenue) : "—"}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{s ? `قيود ${fmt(s.breakdown.manualRevenue)} + صفقات ${fmt(s.breakdown.dealRevenue)} (${s.breakdown.wonDeals} صفقة كسبانة)` : ""}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><TrendingDown className="h-3.5 w-3.5 text-rose-400" /> التكاليف</p>
          <p className="mt-1 text-xl font-extrabold text-rose-400">{s ? fmt(s.cost) : "—"}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{s ? `قيود ${fmt(s.breakdown.manualCost)} + AI حي ${fmt(s.breakdown.aiRunCost)} (${s.breakdown.aiRunCount} نداء)` : ""}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Wallet className="h-3.5 w-3.5" /> الربح الصافي</p>
          <p className={`mt-1 text-xl font-extrabold ${(s?.profit ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{s ? fmt(s.profit) : "—"}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">إيرادات − تكاليف (قيود + AI)</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Percent className="h-3.5 w-3.5" /> هامش الربح</p>
          <p className="mt-1 text-xl font-extrabold">{s?.marginPct != null ? `${s.marginPct}%` : "—"}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">محسوب من إجمالي الإيراد</p>
        </CardContent></Card>
      </div>

      {s && Object.keys(s.byCategory).length > 0 && (
        <Card><CardContent className="flex flex-wrap gap-2 p-3">
          {Object.entries(s.byCategory).map(([k, v]) => (
            <Badge key={k} variant="outline" className="gap-1">{CAT_LABELS[k] ?? k}: <b>{fmt(v)}</b></Badge>
          ))}
        </CardContent></Card>
      )}

      <Card><CardContent className="flex flex-wrap items-end gap-2 p-4">
        <div className="space-y-1"><p className="text-xs text-muted-foreground">النوع</p>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="COST">مصروف</SelectItem>
              <SelectItem value="REVENUE">إيراد</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><p className="text-xs text-muted-foreground">الفئة</p>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CAT_LABELS[c]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="min-w-40 flex-1 space-y-1"><p className="text-xs text-muted-foreground">البيان</p>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: اشتراك أدوات" />
        </div>
        <div className="w-28 space-y-1"><p className="text-xs text-muted-foreground">المبلغ</p>
          <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <Button onClick={add} disabled={busy || !title || !amount}><Plus className="h-4 w-4" /> تسجيل</Button>
        <p className="w-full text-[11px] text-muted-foreground">الإيراد المصنف «تقدير» مرفوض — المدفوعات المؤكدة من مصدر موثوق (سبك §31.2)</p>
      </CardContent></Card>

      {loading && !data ? <LoadingBlock /> : (data?.entries ?? []).length === 0 ? (
        <EmptyState icon={<Wallet className="h-10 w-10" />} title="لا قيود مسجلة بعد" hint="تكلفة الـAI الحية بتتحسب تلقائيًا من سجل نداءات العقل — وسجّل قيودك اليدوية فوق" />
      ) : (
        <div className="space-y-2">
          {data!.entries.map((e) => (
            <Card key={e.id} className="border-border/70"><CardContent className="flex flex-wrap items-center gap-3 p-3">
              <Badge className={e.kind === "REVENUE" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}>
                {e.kind === "REVENUE" ? "إيراد" : "مصروف"}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{e.title}</p>
                <p className="text-[11px] text-muted-foreground">{CAT_LABELS[e.category] ?? e.category} • {timeAgo(e.occurredAt)}{e.source ? ` • ${e.source}` : ""}{e.confidence === "ESTIMATED" ? " • تقدير" : " • موثق"}</p>
              </div>
              <p className={`text-sm font-extrabold ${e.kind === "REVENUE" ? "text-emerald-400" : "text-rose-400"}`}>{fmt(e.amount)}</p>
              <Button variant="ghost" size="sm" onClick={() => remove(e.id)}>حذف</Button>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  )
}
