import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getPhotoStorage } from "@/lib/photoStorage";

export const dynamic = "force-dynamic";

// DELETE /api/properties/:id/audits — wipe all auditor submissions + verified facts (ADMIN)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  const { id } = await params;
  const property = await prisma.property.findFirst({
    where: { OR: [{ id }, { canonicalId: id }] },
    select: { id: true, name: true },
  });
  if (!property) {
    return NextResponse.json({ message: "Property not found" }, { status: 404 });
  }

  const confirm = req.nextUrl.searchParams.get("confirm");
  if (confirm !== property.name) {
    return NextResponse.json(
      { message: "Pass ?confirm=<exact property name> to wipe all audit data" },
      { status: 422 }
    );
  }

  const submissions = await prisma.auditSubmission.findMany({
    where: { propertyId: property.id },
    include: { photos: true },
  });

  const storage = await getPhotoStorage();
  for (const sub of submissions) {
    for (const photo of sub.photos) {
      try {
        await storage.remove(photo.url);
      } catch {
        /* best-effort */
      }
    }
  }

  const [deletedFacts, deletedSubmissions] = await prisma.$transaction([
    prisma.accessibilityFact.deleteMany({
      where: {
        propertyId: property.id,
        sourceType: "AUDITOR",
        tier: { in: ["VERIFIED", "CONFIRMED"] },
      },
    }),
    prisma.auditSubmission.deleteMany({ where: { propertyId: property.id } }),
  ]);

  return NextResponse.json({
    ok: true,
    deletedSubmissions: deletedSubmissions.count,
    deletedFacts: deletedFacts.count,
  });
}
