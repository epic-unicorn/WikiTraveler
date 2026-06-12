/**
 * One-off migration: move base64-encoded photos from Postgres into the
 * configured object-storage backend (R2 or Supabase).
 *
 * Run after setting PHOTO_STORAGE_PROVIDER and the matching credentials:
 *
 *   # Cloudflare R2
 *   PHOTO_STORAGE_PROVIDER=r2 \
 *   R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
 *   R2_BUCKET=... R2_PUBLIC_URL=https://pub.example.com \
 *   DATABASE_URL=postgresql://... \
 *   pnpm db:migrate-photos
 *
 *   # Supabase
 *   PHOTO_STORAGE_PROVIDER=supabase \
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=... \
 *   DATABASE_URL=postgresql://... \
 *   pnpm db:migrate-photos
 *
 * Safe to re-run: rows that already contain HTTPS URLs are skipped.
 * If a row has a mix of URLs and data-URIs, only the data-URIs are re-uploaded.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { getPhotoStorage } from "../lib/photoStorage";

const prisma = new PrismaClient();

function isDataUri(s: string): boolean {
  return s.startsWith("data:") || (!s.startsWith("http") && s.length > 100);
}

async function main() {
  const provider = process.env.PHOTO_STORAGE_PROVIDER ?? "";
  if (!provider) {
    console.error(
      "❌  PHOTO_STORAGE_PROVIDER is not set — nothing to migrate.\n" +
        "    Set it to 'r2' or 'supabase' and provide the matching credentials."
    );
    process.exit(1);
  }

  console.log(`\n📦  Migrating photos to '${provider}' storage…\n`);

  const storage = await getPhotoStorage();

  // Load all submissions that have at least one photo
  const submissions = await prisma.auditSubmission.findMany({
    where: { NOT: { photoUrls: { equals: [] } } },
    select: { id: true, propertyId: true, photoUrls: true },
  });

  console.log(`    Found ${submissions.length} submission(s) with photos.\n`);

  let migrated = 0;
  let alreadyDone = 0;
  let failed = 0;

  for (const sub of submissions) {
    const photos = sub.photoUrls as string[];
    if (!Array.isArray(photos) || photos.length === 0) {
      alreadyDone++;
      continue;
    }

    // Skip if every reference is already a URL
    if (photos.every((p) => !isDataUri(p))) {
      alreadyDone++;
      continue;
    }

    try {
      const updated = await Promise.all(
        photos.map((photo, i) => {
          if (!isDataUri(photo)) return Promise.resolve(photo); // already a URL

          // Normalise plain base64 → data-URI before upload
          const dataUri = photo.startsWith("data:")
            ? photo
            : `data:image/jpeg;base64,${photo}`;

          const ext = dataUri.match(/data:image\/(\w+)/)?.[1] ?? "jpg";
          const key = `photos/${sub.propertyId}/${sub.id}-${i}.${ext}`;

          return storage.upload(dataUri, key);
        })
      );

      await prisma.auditSubmission.update({
        where: { id: sub.id },
        data: { photoUrls: updated },
      });

      console.log(
        `  ✓  ${sub.id}  (${photos.length} photo${photos.length > 1 ? "s" : ""})`
      );
      migrated++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗  ${sub.id}  — ${msg}`);
      failed++;
    }
  }

  console.log(
    `\n  Migrated : ${migrated}\n` +
      `  Skipped  : ${alreadyDone}\n` +
      `  Failed   : ${failed}\n`
  );

  if (failed > 0) process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
