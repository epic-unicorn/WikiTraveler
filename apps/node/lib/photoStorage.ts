/**
 * Photo storage adapter.
 *
 * Controlled by the PHOTO_STORAGE_PROVIDER env var:
 *   (unset / "")    → base64 passthrough — stores data-URIs directly in Postgres (MVP default)
 *   "r2"            → Cloudflare R2 (S3-compatible, generous free tier)
 *   "supabase"      → Supabase Storage
 *
 * Every adapter exposes the same two-method interface so callers never need
 * to know which backend is active.
 */

export interface PhotoStorageAdapter {
  /**
   * Store a photo and return a stable reference.
   * - base64 adapter: returns the data-URI unchanged.
   * - r2 / supabase adapters: uploads the image and returns a public HTTPS URL.
   */
  upload(dataUri: string, key: string): Promise<string>;
  /** Remove a previously stored photo. No-op for the base64 adapter. */
  remove(ref: string): Promise<void>;
}

// ── base64 passthrough (zero config, default) ─────────────────────────────

function createBase64Adapter(): PhotoStorageAdapter {
  return {
    async upload(dataUri) {
      return dataUri;
    },
    async remove() {},
  };
}

// ── Cloudflare R2 ─────────────────────────────────────────────────────────
// Required env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
//                    R2_BUCKET, R2_PUBLIC_URL

export function r2S3Endpoint(accountId: string): string {
  const explicit = process.env.R2_ENDPOINT?.replace(/\/$/, "");
  if (explicit) return explicit;
  const jurisdiction = (process.env.R2_JURISDICTION ?? "").trim().toLowerCase();
  if (jurisdiction === "eu" || jurisdiction === "us" || jurisdiction === "fedramp") {
    return `https://${accountId}.${jurisdiction}.r2.cloudflarestorage.com`;
  }
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

async function createR2Adapter(): Promise<PhotoStorageAdapter> {
  const { S3Client, PutObjectCommand, DeleteObjectCommand } = await import(
    "@aws-sdk/client-s3"
  );

  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET;
  const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");

  if (!accountId || !bucket || !publicUrl) {
    throw new Error(
      "R2 storage requires R2_ACCOUNT_ID, R2_BUCKET, and R2_PUBLIC_URL env vars."
    );
  }

  const client = new S3Client({
    region: "auto",
    endpoint: r2S3Endpoint(accountId),
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    },
  });

  return {
    async upload(dataUri, key) {
      const [header, base64] = dataUri.split(",");
      const contentType =
        header?.match(/:(.*?);/)?.[1] ?? "image/jpeg";
      const buffer = Buffer.from(base64 ?? "", "base64");

      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          CacheControl: "public, max-age=31536000, immutable",
        })
      );

      return `${publicUrl}/${key}`;
    },

    async remove(ref) {
      const key = ref.startsWith(publicUrl + "/")
        ? ref.slice(publicUrl.length + 1)
        : ref;
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

// ── Supabase Storage ──────────────────────────────────────────────────────
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY
// Optional:         SUPABASE_STORAGE_BUCKET (default: "photos")

async function createSupabaseAdapter(): Promise<PhotoStorageAdapter> {
  const { StorageClient } = await import("@supabase/storage-js");

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "photos";

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Supabase storage requires SUPABASE_URL and SUPABASE_SERVICE_KEY env vars."
    );
  }

  const storage = new StorageClient(`${supabaseUrl}/storage/v1`, {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  });

  return {
    async upload(dataUri, key) {
      const [header, base64] = dataUri.split(",");
      const contentType =
        header?.match(/:(.*?);/)?.[1] ?? "image/jpeg";
      const buffer = Buffer.from(base64 ?? "", "base64");

      const { error } = await storage.from(bucket).upload(key, buffer, {
        contentType,
        upsert: true,
      });
      if (error) throw error;

      const {
        data: { publicUrl },
      } = storage.from(bucket).getPublicUrl(key);
      return publicUrl;
    },

    async remove(ref) {
      // Extract just the path segment after the bucket name
      const marker = `/${bucket}/`;
      const key = ref.includes(marker)
        ? ref.slice(ref.indexOf(marker) + marker.length)
        : ref;
      await storage.from(bucket).remove([key]);
    },
  };
}

// ── Factory ───────────────────────────────────────────────────────────────

let _adapter: PhotoStorageAdapter | null = null;

/**
 * Return the configured photo storage adapter.
 * The result is cached for the lifetime of the serverless function instance.
 */
export async function getPhotoStorage(): Promise<PhotoStorageAdapter> {
  if (_adapter) return _adapter;

  const provider = (process.env.PHOTO_STORAGE_PROVIDER ?? "").toLowerCase();

  switch (provider) {
    case "r2":
      _adapter = await createR2Adapter();
      break;
    case "supabase":
      _adapter = await createSupabaseAdapter();
      break;
    default:
      _adapter = createBase64Adapter();
  }

  return _adapter;
}

/** Clears the cached adapter — for tests only. */
export function resetPhotoStorageCache(): void {
  _adapter = null;
}

/**
 * Normalise a stored photo reference into a data-URI suitable for AI vision.
 * - HTTPS URLs: returned as-is (OpenAI / hosted models accept them natively).
 *   Note: local Ollama instances cannot reach public URLs — use the base64
 *   adapter when running AI locally.
 * - data-URI strings: returned as-is.
 * - Plain base64 strings (legacy): wrapped in `data:image/jpeg;base64,...`.
 */
export function photoToVisionInput(ref: string): string {
  if (/^https?:\/\//.test(ref) || ref.startsWith("data:")) return ref;
  return `data:image/jpeg;base64,${ref}`;
}

/** Same normalisation as vision input — suitable for <img src> in clients. */
export const photoToDisplayUrl = photoToVisionInput;
