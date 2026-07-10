import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { validateRegionBbox } from "@/lib/regionPresets";
import { saveRegionBbox } from "@/lib/regionSave";
import type { NextRequest } from "next/server";


export { dynamic } from "@/lib/apiRoute";
/**
 * POST /api/admin/region/apply
 * Body: { bbox, presetId?, exportConfirmed? }
 * Saves region metadata only — OSM ingestion is offline via CLI.
 */
export async function POST(req: NextRequest) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  let body: {
    bbox?: string;
    presetId?: string;
    exportConfirmed?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const validated = validateRegionBbox(body.bbox ?? "", body.presetId);
  if (!validated.ok) {
    return NextResponse.json({ message: validated.message }, { status: 400 });
  }

  try {
    const result = await saveRegionBbox(validated.bbox, {
      presetId: body.presetId,
      exportConfirmed: body.exportConfirmed,
    });
    return NextResponse.json({ savedOnly: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Export audited")) {
      return NextResponse.json(
        { message, requiresExport: true },
        { status: 400 }
      );
    }
    return NextResponse.json({ message }, { status: 400 });
  }
}
