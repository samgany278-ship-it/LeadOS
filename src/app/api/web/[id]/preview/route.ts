// Ezz Web — معاينة HTML للنموذج التجريبي (المصدر الوحيد للعرض — لا ملفات على القرص)
// النموذج noindex أصلاً + هيدر X-Robots-Tag حماية مضاعفة
import { db } from "@/lib/db"
import { getSessionUser, getWorkspaceForUser } from "@/lib/auth"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const user = await getSessionUser()
  if (!user) return new Response("غير مسجل الدخول", { status: 401 })
  const workspace = await getWorkspaceForUser(user.id)
  if (!workspace) return new Response("لا توجد مساحة عمل", { status: 403 })
  const { id } = await params
  const draft = await db.siteDraft.findFirst({ where: { id, workspaceId: workspace.id } })
  if (!draft) return new Response("النموذج غير موجود", { status: 404 })
  return new Response(draft.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  })
}
