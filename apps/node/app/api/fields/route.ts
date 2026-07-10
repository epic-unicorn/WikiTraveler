import { NextResponse } from "next/server";
import { listFieldDefinitions } from "@/lib/fieldRegistry";
import { resolveLocale, DEFAULT_LOCALE } from "@wikitraveler/i18n";
import type { NextRequest } from "next/server";


export { dynamic } from "@/lib/apiRoute";
// GET /api/fields?locale=nl
export async function GET(req: NextRequest) {
  const locale = resolveLocale({
    stored: req.nextUrl.searchParams.get("locale"),
    acceptLanguage: req.headers.get("accept-language"),
    nodeDefault: process.env.NODE_DEFAULT_LOCALE ?? null,
  }) ?? DEFAULT_LOCALE;

  const fields = await listFieldDefinitions(locale);
  return NextResponse.json({ locale, fields });
}
