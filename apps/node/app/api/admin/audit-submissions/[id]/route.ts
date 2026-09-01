import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, getAuthUser, auditorId } from "@/lib/auth";
import { getPhotoStorage } from "@/lib/photoStorage";
import { reconcileFactsAfterSubmissionDelete } from "@/lib/auditReconcile";

export const dynamic = "force-dynamic";

// DELETE /api/admin/audit-submissions/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireRole(req, "AUDITOR");
  if (authError) return authError;

  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const me = auditorId(authUser);

  const { id } = await params;
  const submission = await prisma.auditSubmission.findUnique({
    where: { id },
    include: { photos: true, property: { select: { id: true } } },
  });

  if (!submission) {
    return NextResponse.json({ message: "Submission not found" }, { status: 404 });
  }

  const isAdmin = authUser.role === "ADMIN";
  if (!isAdmin && submission.auditorToken !== me) {
    return NextResponse.json({ message: "You can only delete your own submissions" }, { status: 403 });
  }

  const remaining = await prisma.auditSubmission.findMany({
    where: { propertyId: submission.propertyId, NOT: { id } },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, facts: true },
  });

  const reconcile = await reconcileFactsAfterSubmissionDelete({
    propertyId: submission.propertyId,
    deletedSubmissionId: submission.id,
    deletedFacts: submission.facts,
    deletedAuditor: submission.auditorToken,
    deletedAt: submission.createdAt,
    remainingSubmissions: remaining,
  });

  const storage = await getPhotoStorage();
  for (const photo of submission.photos) {
    try {
      await storage.remove(photo.url);
    } catch {
      /* best-effort blob cleanup */
    }
  }

  await prisma.auditSubmission.delete({ where: { id } });

  return NextResponse.json({
    ok: true,
    reconcile,
  });
}
