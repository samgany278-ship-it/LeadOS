"use client";
// Ezz Web — Demo Factory (سبك §37) — قوالب قطاعات + معاينة محلية + فحوص قبول
import { useState } from "react"
import { useApi, apiSend, timeAgo, LoadingBlock, EmptyState } from "../shared"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Globe, ExternalLink, Archive, ArchiveRestore, Trash2 } from "lucide-react"

interface Tpl { id: string; label: string; tagline: string; services: string[] }
interface Draft {
  id: string; name: string; template: string; score: number; status: string
  checks: { id: string; label: string; pass: boolean }[]; createdAt: string
  data: { title: string }
}
interface TemplatesRes { drafts: Draft[]; templates: Tpl[] }

export function WebStudioView() {
  const { data, loading, refresh } = useApi<TemplatesRes>("/api/web")
  const { toast } = useToast()
  const [tpl, setTpl] = useState("cafe")
  const [name, setName] = useState("")
  const [title, setTitle] = useState("")
  const [tagline, setTagline] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [busy, setBusy] = useState(false)

  const generate = async () => {
    setBusy(true)
    try {
      const res = await apiSend<{ draft: { id: string; score: number } }>("/api/web", "POST", {
        template: tpl, name, data: { title, tagline: tagline || undefined, phone: phone || undefined, address: address || undefined },
      })
      toast({ title: `النموذج جاهز 🌐 (${res.draft.score}/8 فحوص ماجحة)`, description: "افتح المعاينة من القايمة تحت" })
      setName(""); setTitle(""); setTagline(""); setPhone(""); setAddress(""); refresh()
    } catch (e) {
      toast({ title: "التوليد فشل", description: (e as Error).message, variant: "destructive" })
    } finally { setBusy(false) }
  }

  const act = async (id: string, action: "archive" | "delete") => {
    if (action === "delete") await apiSend(`/api/web/${id}`, "DELETE")
    else await apiSend(`/api/web/${id}`, "PATCH", {})
    refresh()
  }

  const drafts = data?.drafts ?? []
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">نماذج تجريبية محلية فقط: noindex + شارة «نموذج تجريبي» + بيانات مؤكدة لا تخمين — النشر الحقيقي محتاج استضافة وتفويض المالك (BLK-011)</p>

      <Card><CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          {(data?.templates ?? []).map((t) => (
            <button key={t.id} onClick={() => { setTpl(t.id); setTagline("") }}
              className={`rounded-xl border px-3 py-2 text-start text-xs transition ${tpl === t.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}>
              <p className="font-bold">{t.label}</p>
              <p className="text-[10px] text-muted-foreground">{t.tagline}</p>
            </button>
          ))}
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم النموذج داخلياً: مثال «ديمو كافيه مصر»" />
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="اسم النشاط اللي هيظهر: مثال «كافيه لوز»" />
          <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="الشعار (اختياري — فيه افتراضي للقالب)" />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="تليفون مؤكد (اختياري — يظهر «غير متوفر بعد» لو فاضي)" />
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="عنوان مؤكد (اختياري)" />
          <Button onClick={generate} disabled={busy || !name || !title}><Globe className="h-4 w-4" /> توليد + فحص</Button>
        </div>
      </CardContent></Card>

      {loading && !data ? <LoadingBlock /> : drafts.length === 0 ? (
        <EmptyState icon={<Globe className="h-10 w-10" />} title="لا نماذج بعد" hint="اختر قالب قطاع واملأ البيانات المؤكدة فقط — والفحوص هترفض أي نموذج فيه placeholder" />
      ) : (
        <div className="space-y-2">
          {drafts.map((d) => (
            <Card key={d.id} className="border-border/70"><CardContent className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{d.name} <span className="text-muted-foreground">• {d.data?.title}</span></p>
                <p className="text-[11px] text-muted-foreground">
                  {d.template} • {timeAgo(d.createdAt)} • فحوص {d.score}/8
                  {d.status === "ARCHIVED" && " • مؤرشف"}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {d.checks?.filter((c) => !c.pass).map((c) => (
                    <Badge key={c.id} className="bg-rose-500/15 text-[10px] text-rose-300">✗ {c.label}</Badge>
                  ))}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => window.open(`/api/web/${d.id}/preview`, "_blank")}>
                <ExternalLink className="h-3.5 w-3.5" /> معاينة
              </Button>
              <Button size="sm" variant="ghost" onClick={() => act(d.id, "archive")}>
                {d.status === "ARCHIVED" ? <><ArchiveRestore className="h-3.5 w-3.5" /> إرجاع</> : <><Archive className="h-3.5 w-3.5" /> أرشفة</>}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => act(d.id, "delete")}><Trash2 className="h-3.5 w-3.5 text-rose-400" /></Button>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  )
}
