"use client";
// Ezz Social & Publish (سبك §30) — مسودات جاهزة للنشر اليدوي + فحوص سياسات
import { useState } from "react"
import { useApi, apiSend, timeAgo, LoadingBlock, EmptyState } from "../shared"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { CalendarClock, ShieldCheck, Check, X, Link2 } from "lucide-react"

const PLATFORMS = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "X", "TELEGRAM", "WHATSAPP"] as const
const PL_LABELS: Record<string, string> = { FACEBOOK: "فيسبوك", INSTAGRAM: "إنستجرام", LINKEDIN: "لينكدإن", X: "X", TELEGRAM: "تليجرام", WHATSAPP: "واتساب" }
const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "مسودة", cls: "bg-amber-500/15 text-amber-300" },
  APPROVED: { label: "معتمدة", cls: "bg-sky-500/15 text-sky-300" },
  PUBLISHED_MANUAL: { label: "منشورة يدوياً", cls: "bg-emerald-500/15 text-emerald-300" },
  DISCARDED: { label: "مستبعدة", cls: "bg-muted text-muted-foreground" },
}

interface Check { id: string; label: string; level: "OK" | "WARN"; detail: string }
interface Draft {
  id: string; platform: string; content: string; status: string
  policyChecks: Check[]; publishedRef: string | null; createdAt: string
}

export function SocialView() {
  const { data, loading, refresh } = useApi<{ drafts: Draft[]; authorizedPerPlatform: Record<string, number> }>("/api/social/drafts")
  const { toast } = useToast()
  const [platform, setPlatform] = useState("FACEBOOK")
  const [content, setContent] = useState("")
  const [busy, setBusy] = useState(false)

  const create = async () => {
    setBusy(true)
    try {
      await apiSend("/api/social/drafts", "POST", { platform, content })
      toast({ title: "المسودة اتسجلت 📝", description: "بعد النشر اليدوي سجّل الرابط" })
      setContent(""); refresh()
    } catch (e) {
      toast({ title: "اترفضت المسودة", description: (e as Error).message, variant: "destructive" })
    } finally { setBusy(false) }
  }

  const act = async (id: string, action: string, extra: Record<string, unknown> = {}) => {
    try {
      await apiSend(`/api/social/drafts/${id}`, "PATCH", { action, ...extra })
      if (action === "published-manual") toast({ title: "مبروك! اتحفظ مرجع النشر ✅" })
      refresh()
    } catch (e) {
      toast({ title: "فشل الإجراء", description: (e as Error).message, variant: "destructive" })
    }
  }

  const drafts = data?.drafts ?? []
  const auth = data?.authorizedPerPlatform ?? {}
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((p) => (
          <Badge key={p} variant="outline" className="gap-1">
            {PL_LABELS[p]}: {auth[p] ? `✅ ${auth[p]} حساب مصرح` : "⚠️ يدوي فقط"}
          </Badge>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">ممنوع النشر الآلي بلا تفويض رسمي — الفحوص بتظهر تحت كل مسودة (ساعات النشر 10ص-8م مصر + حدود الحروف + منع التكرار)</p>

      <Card><CardContent className="space-y-2 p-4">
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{PL_LABELS[p]}</SelectItem>)}</SelectContent>
        </Select>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder="نص المنشور... (20 حرف على الأقل)" />
        <Button onClick={create} disabled={busy || content.trim().length < 20}><CalendarClock className="h-4 w-4" /> حفظ كمسودة</Button>
      </CardContent></Card>

      {loading && !data ? <LoadingBlock /> : drafts.length === 0 ? (
        <EmptyState icon={<CalendarClock className="h-10 w-10" />} title="لا مسودات بعد" hint="اكتب منشور، احفظه مسودة، وبعد النشر اليدوي سجل الرابط بتاع المنشور الحقيقي" />
      ) : (
        <div className="space-y-2">
          {drafts.map((d) => {
            const st = STATUS[d.status] ?? STATUS.DRAFT
            const warns = (d.policyChecks ?? []).filter((c) => c.level === "WARN")
            return (
              <Card key={d.id} className="border-border/70"><CardContent className="space-y-2 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={st.cls}>{st.label}</Badge>
                  <Badge variant="outline">{PL_LABELS[d.platform] ?? d.platform}</Badge>
                  <p className="flex-1 text-sm">{d.content.slice(0, 120)}{d.content.length > 120 ? "…" : ""}</p>
                  <span className="text-[11px] text-muted-foreground">{timeAgo(d.createdAt)}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(d.policyChecks ?? []).map((c) => (
                    <Badge key={c.id} variant="outline" className={`gap-1 text-[10px] ${c.level === "WARN" ? "border-amber-500/40 text-amber-300" : "border-emerald-500/30 text-emerald-300"}`}>
                      <ShieldCheck className="h-3 w-3" /> {c.label}
                    </Badge>
                  ))}
                </div>
                {d.publishedRef && <p className="flex items-center gap-1 text-[11px] text-emerald-300"><Link2 className="h-3 w-3" /> {d.publishedRef}</p>}
                <div className="flex flex-wrap gap-2">
                  {d.status === "DRAFT" && <Button size="sm" variant="outline" onClick={() => act(d.id, "approve")}><Check className="h-3.5 w-3.5" /> اعتماد</Button>}
                  {(d.status === "APPROVED" || d.status === "DRAFT") && (
                    <Button size="sm" variant="outline" onClick={() => {
                      const ref = window.prompt("لصق رابط/مرجع المنشور بعد النشر اليدوي:")
                      if (ref?.trim()) act(d.id, "published-manual", { publishedRef: ref.trim() })
                    }}><Check className="h-3.5 w-3.5" /> اتنشر يدوياً — سجّل الرابط</Button>
                  )}
                  {d.status !== "DISCARDED" && d.status !== "PUBLISHED_MANUAL" && (
                    <Button size="sm" variant="ghost" onClick={() => act(d.id, "discard")}><X className="h-3.5 w-3.5" /> استبعاد</Button>
                  )}
                  {warns.length > 0 && <span className="self-center text-[11px] text-amber-300">⚠️ {warns.length} تحذير سياسة</span>}
                </div>
              </CardContent></Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
