// LeadOS — ضمان دخول الأدمن على النسخة المسترجعة (idempotent)
// يعيد تعيين كلمة سر admin@leados.com إلى admin123 ويتأكد من عضويته في مساحة العمل
import { PrismaClient } from "@prisma/client"
import { hashPassword } from "../src/lib/auth"

const db = new PrismaClient()
const EMAIL = "admin@leados.com"
const PASSWORD = "admin123"

async function main() {
  let user = await db.user.findUnique({ where: { email: EMAIL } })
  if (!user) {
    user = await db.user.create({
      data: { email: EMAIL, name: "Ezz Admin", passwordHash: hashPassword(PASSWORD), role: "OWNER" },
    })
    console.log("تم إنشاء المستخدم:", user.email)
  } else {
    await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(PASSWORD) } })
    console.log("تم تحديث كلمة السر للمستخدم:", user.email)
  }

  const ws = await db.workspace.findFirst()
  if (!ws) {
    console.log("لا توجد مساحة عمل — سيتم إنشاء واحدة")
    const created = await db.workspace.create({ data: { name: "LeadOS" } })
    await db.workspaceMember.create({ data: { workspaceId: created.id, userId: user.id, role: "OWNER" } })
    console.log("تم إنشاء المساحة وربط الأدمن بها:", created.id)
  } else {
    const membership = await db.workspaceMember.findFirst({ where: { workspaceId: ws.id, userId: user.id } })
    if (!membership) {
      await db.workspaceMember.create({ data: { workspaceId: ws.id, userId: user.id, role: "OWNER" } })
      console.log("تم ربط الأدمن بالمساحة الموجودة:", ws.id)
    } else {
      console.log("العضوية موجودة مسبقاً في المساحة:", ws.id)
    }
  }
  console.log("الدخول جاهز:", EMAIL, "/", PASSWORD)
}

main()
  .catch((e) => {
    console.error("FAILED:", e instanceof Error ? e.message.slice(0, 300) : e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
