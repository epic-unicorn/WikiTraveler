import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import type { NextRequest } from "next/server";


export { dynamic } from "@/lib/apiRoute";
/** GET /api/admin/users/export — export user accounts (no passwords) */
export async function GET(req: NextRequest) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  const users = await prisma.user.findMany({
    select: { username: true, role: true, createdAt: true },
    orderBy: { username: "asc" },
  });

  const export_ = {
    version: 1,
    type: "users",
    createdAt: new Date().toISOString(),
    users,
  };

  return new NextResponse(JSON.stringify(export_, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="wikitraveler-users-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
