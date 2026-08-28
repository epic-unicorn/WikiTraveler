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
 * Migrates both AuditPhoto.url and legacy AuditSubmission.photoUrls.
 */

import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { getPhotoStorage, r2S3Endpoint, resetPhotoStorageCache } from "../lib/photoStorage";

const repoRoot = path.resolve(__dirname, "../../..");
loadEnv({ path: path.join(repoRoot, ".env"), override: true });
loadEnv({ path: path.resolve(process.cwd(), ".env") });
resetPhotoStorageCache();

const prisma = new PrismaClient();

function isDataUri(s: string): boolean {
  return s.startsWith("data:") || (!s.startsWith("http") && s.length > 100);
}

async function main() {
  const provider = (process.env.PHOTO_STORAGE_PROVIDER ?? "").toLowerCase();
  if (!provider || provider === "base64") {
    console.error(
      "❌  PHOTO_STORAGE_PROVIDER is not set — nothing to migrate.\n" +
        "    Set it to 'r2' or 'supabase' and provide the matching credentials."
    );
    process.exit(1);
  }

  console.log(`\n📦  Migrating photos to '${provider}' storage…`);
  if (provider === "r2") {
    const accountId = process.env.R2_ACCOUNT_ID ?? "";
    const endpoint = r2S3Endpoint(accountId);
    const kind = endpoint.includes(".eu.") ? "eu" : endpoint.includes(".us.") ? "us" : "global";
    console.log(`    R2 bucket: ${process.env.R2_BUCKET ?? "(unset)"} (${kind} endpoint)\n`);
  } else {
    console.log("");
  }

  const storage = await getPhotoStorage();

  const submissions = await prisma.auditSubmission.findMany({
    where: {
      OR: [{ NOT: { photoUrls: { equals: [] } } }, { photos: { some: {} } }],
    },
    select: {
      id: true,
      propertyId: true,
      photoUrls: true,
      photos: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true } },
    },
  });

  console.log(`    Found ${submissions.length} submission(s) with photos.\n`);

  let migrated = 0;
  let alreadyDone = 0;
  let failed = 0;
  let uploaded = 0;

  for (const sub of submissions) {
    const legacy = Array.isArray(sub.photoUrls) ? (sub.photoUrls as string[]) : [];
    const structuredNeed = sub.photos.some((p) => isDataUri(p.url));
    const legacyNeed = legacy.some((p) => isDataUri(p));
    if (!structuredNeed && !legacyNeed) {
      alreadyDone++;
      continue;
    }

    try {
      const structuredUrls: string[] = [];
      for (let i = 0; i < sub.photos.length; i++) {
        const photo = sub.photos[i];
        let url = photo.url;
        if (isDataUri(url)) {
          const dataUri = url.startsWith("data:") ? url : `data:image/jpeg;base64,${url}`;
          const ext = dataUri.match(/data:image\/(\w+)/)?.[1] ?? "jpg";
          const key = `photos/${sub.propertyId}/${photo.id}.${ext}`;
          url = await storage.upload(dataUri, key);
          uploaded++;
          await prisma.auditPhoto.update({ where: { id: photo.id }, data: { url } });
        }
        structuredUrls.push(url);
      }

      let nextLegacy = legacy;
      if (structuredUrls.length > 0) {
        nextLegacy = structuredUrls;
      } else if (legacyNeed) {
        nextLegacy = await Promise.all(
          legacy.map(async (photo, i) => {
            if (!isDataUri(photo)) return photo;
            const dataUri = photo.startsWith("data:")
              ? photo
              : `data:image/jpeg;base64,${photo}`;
            const ext = dataUri.match(/data:image\/(\w+)/)?.[1] ?? "jpg";
            const key = `photos/${sub.propertyId}/${sub.id}-${i}.${ext}`;
            uploaded++;
            return storage.upload(dataUri, key);
          })
        );
      }

      await prisma.auditSubmission.update({
        where: { id: sub.id },
        data: { photoUrls: nextLegacy },
      });

      console.log(
        `  ✓  ${sub.id}  (${sub.photos.length || legacy.length} photo${(sub.photos.length || legacy.length) !== 1 ? "s" : ""})`
      );
      migrated++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗  ${sub.id}  — ${msg}`);
      failed++;
    }
  }

  console.log(
    `\n  Submissions migrated : ${migrated}\n` +
      `  Already on HTTPS     : ${alreadyDone}\n` +
      `  Objects uploaded     : ${uploaded}\n` +
      `  Failed               : ${failed}\n`
  );

  if (failed > 0) process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
