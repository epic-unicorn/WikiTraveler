import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getNodeSettings, updateNodeSettings } from "@/lib/nodeSettings";
import type { NextRequest } from "next/server";

/** GET /api/admin/settings — node settings (registration, etc.) */
export async function GET(req: NextRequest) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  const settings = await getNodeSettings();
  return NextResponse.json({
    openRegistration: settings.openRegistration,
  });
}

/** PATCH /api/admin/settings — update node settings */
export async function PATCH(req: NextRequest) {
  const authError = await requireRole(req, "ADMIN");
  if (authError) return authError;

  let body: { openRegistration?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  if (body.openRegistration === undefined) {
    return NextResponse.json({ message: "No settings to update" }, { status: 400 });
  }

  const settings = await updateNodeSettings({
    openRegistration: Boolean(body.openRegistration),
  });

  return NextResponse.json({
    openRegistration: settings.openRegistration,
  });
}
