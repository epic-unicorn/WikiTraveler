import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPhotoStorage,
  photoToVisionInput,
  resetPhotoStorageCache,
  r2S3Endpoint,
} from "./photoStorage";

describe("photoToVisionInput", () => {
  it("passes HTTPS URLs through unchanged", () => {
    const url = "https://cdn.example.com/photos/a.jpg";
    expect(photoToVisionInput(url)).toBe(url);
  });

  it("passes data URIs through unchanged", () => {
    const dataUri = "data:image/png;base64,abc123";
    expect(photoToVisionInput(dataUri)).toBe(dataUri);
  });

  it("wraps plain base64 in a JPEG data URI", () => {
    expect(photoToVisionInput("abc123")).toBe("data:image/jpeg;base64,abc123");
  });
});

describe("getPhotoStorage", () => {
  beforeEach(() => {
    resetPhotoStorageCache();
    delete process.env.PHOTO_STORAGE_PROVIDER;
  });

  afterEach(() => {
    resetPhotoStorageCache();
    delete process.env.PHOTO_STORAGE_PROVIDER;
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_BUCKET;
    delete process.env.R2_PUBLIC_URL;
    delete process.env.R2_JURISDICTION;
    delete process.env.R2_ENDPOINT;
  });

  it("uses base64 passthrough by default", async () => {
    const storage = await getPhotoStorage();
    const dataUri = "data:image/jpeg;base64,/9j/abc";
    await expect(storage.upload(dataUri, "photos/x.jpg")).resolves.toBe(dataUri);
    await expect(storage.remove(dataUri)).resolves.toBeUndefined();
  });

  it("throws when r2 provider is set without required env vars", async () => {
    process.env.PHOTO_STORAGE_PROVIDER = "r2";
    await expect(getPhotoStorage()).rejects.toThrow(/R2 storage requires/);
  });

  it("throws when supabase provider is set without credentials", async () => {
    process.env.PHOTO_STORAGE_PROVIDER = "supabase";
    await expect(getPhotoStorage()).rejects.toThrow(/Supabase storage requires/);
  });
});

describe("r2S3Endpoint", () => {
  afterEach(() => {
    delete process.env.R2_JURISDICTION;
    delete process.env.R2_ENDPOINT;
  });

  it("uses the EU jurisdiction hostname", () => {
    process.env.R2_JURISDICTION = "eu";
    expect(r2S3Endpoint("abc")).toBe("https://abc.eu.r2.cloudflarestorage.com");
  });

  it("prefers an explicit endpoint override", () => {
    process.env.R2_JURISDICTION = "eu";
    process.env.R2_ENDPOINT = "https://custom.example/r2/";
    expect(r2S3Endpoint("abc")).toBe("https://custom.example/r2");
  });
});
