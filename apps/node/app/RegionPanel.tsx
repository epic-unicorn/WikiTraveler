"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RegionMapEditor } from "./RegionMapEditor";

interface Preset {
  id: string;
  label: string;
  bbox: string;
  tier: "city" | "country" | "region" | "geofabrik";
}

interface Settings {
  bbox: string | null;
  region: string | null;
  presetId: string | null;
  isConfigured: boolean;
  lastIngestAt: string | null;
  lastIngestCount: number | null;
  auditedReimportPending: boolean;
}

interface Preview {
  changeType: string;
  requiresExport: boolean;
  requiresIngest: boolean;
  propertiesToRemove: number;
  propertiesInside: number;
  regionLabel: string;
  tileCount: number;
  warnLarge: boolean;
  areaKm2: number;
  estimatedDurationSec: number;
  ingestMode: "overpass" | "geofabrik";
  geofabrikDownloadMb: number | null;
  ingestEstimate: {
    elementCount: number | null;
    propertyEstimate: number | null;
    downloadSizeKb: number | null;
    downloadSizeMb?: number | null;
    durationSeconds: number | null;
    isEstimate: boolean;
    isGeofabrik?: boolean;
    sampledTiles?: number;
  } | null;
}

interface JobStatus {
  id: string;
  status: string;
  phase: string | null;
  progress: number;
  message: string | null;
  error: string | null;
  stats: Record<string, unknown> | null;
  tileCount?: number | null;
  tilesDone?: number;
}

const PRESET_TIER_LABELS: Record<Preset["tier"], string> = {
  city: "Major cities",
  country: "Countries",
  region: "Multi-country regions",
  geofabrik: "Large countries (Geofabrik import)",
};

const PRESET_TIER_ORDER: Preset["tier"][] = ["city", "country", "region", "geofabrik"];

const CHANGE_LABELS: Record<string, string> = {
  initial: "First-time setup",
  shrink: "Shrinking region",
  expand: "Expanding region",
  move: "Moving region",
  unchanged: "No change",
};

export function RegionPanel({ token }: { token: string }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [draftBbox, setDraftBbox] = useState<string | null>(null);
  const [presetId, setPresetId] = useState<string>("");
  const [presetBbox, setPresetBbox] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [exportConfirmed, setExportConfirmed] = useState(false);
  const [exportedAudited, setExportedAudited] = useState(false);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [geojsonStatus, setGeojsonStatus] = useState<string | null>(null);
  const [geojsonImporting, setGeojsonImporting] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current != null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token]
  );

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/region", { headers: authHeaders() });
    if (!res.ok) {
      stopPolling();
      setJob(null);
      return;
    }
    const data = (await res.json()) as {
      settings: Settings;
      presets: Preset[];
      activeIngestJob: JobStatus | null;
    };
    setSettings(data.settings);
    setPresets(data.presets);
    setDraftBbox(data.settings.bbox);
    const pid = data.settings.presetId ?? "";
    setPresetId(pid);
    const matchedPreset = data.presets.find((p) => p.id === pid);
    setPresetBbox(matchedPreset?.bbox ?? null);

    if (!data.activeIngestJob) {
      stopPolling();
      setJob(null);
      return;
    }

    const jobRes = await fetch(`/api/admin/ingest/${data.activeIngestJob.id}`, {
      headers: authHeaders(),
    });
    if (!jobRes.ok) {
      stopPolling();
      setJob(null);
      return;
    }
    setJob((await jobRes.json()) as JobStatus);
  }, [authHeaders, stopPolling]);

  useEffect(() => {
    stopPolling();
    setJob(null);
    void load();
    return () => stopPolling();
  }, [load, stopPolling]);

  useEffect(() => {
    const jobId = job?.id;
    const jobStatus = job?.status;
    if (!jobId || jobStatus === "COMPLETED" || jobStatus === "FAILED") {
      stopPolling();
      return;
    }

    const tick = async () => {
      const res = await fetch(`/api/admin/ingest/${jobId}`, { headers: authHeaders() });
      if (!res.ok) {
        stopPolling();
        setJob(null);
        return;
      }
      const data = (await res.json()) as JobStatus;
      setJob(data);
      if (data.status === "COMPLETED" || data.status === "FAILED") {
        stopPolling();
        if (data.status === "COMPLETED") void load();
      }
    };

    stopPolling();
    void tick();
    pollIntervalRef.current = setInterval(() => void tick(), 2000);
    return () => stopPolling();
  }, [job?.id, job?.status, authHeaders, load, stopPolling]);

  const headers = authHeaders();

  async function handlePreview() {
    if (!draftBbox) return;
    setPreviewLoading(true);
    setError("");
    setPreview(null);
    try {
      const res = await fetch("/api/admin/region/preview", {
        method: "POST",
        headers,
        body: JSON.stringify({ bbox: draftBbox, presetId: presetId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Preview failed");
        return;
      }
      setPreview(data as Preview);
    } catch {
      setError("Could not reach server");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleExportAudited() {
    const res = await fetch("/api/admin/export/audited", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setError("Export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wikitraveler-audited-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 1000);
    setExportedAudited(true);
  }

  async function handleReingest() {
    const bbox = settings?.bbox ?? draftBbox;
    if (!bbox) return;
    const effectivePresetId = presetId || settings?.presetId || "";
    setApplying(true);
    setError("");
    try {
      const res = await fetch("/api/admin/region/apply", {
        method: "POST",
        headers,
        body: JSON.stringify({
          bbox,
          presetId: effectivePresetId || undefined,
          reingest: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Re-ingest failed");
        return;
      }
      if (data.jobId) {
        setJob({ id: data.jobId, status: "RUNNING", phase: null, progress: 0, message: null, error: null, stats: null });
        setPreview(null);
      }
    } catch {
      setError("Could not reach server");
    } finally {
      setApplying(false);
    }
  }

  async function handleApply() {
    if (!draftBbox || !preview) return;
    if (preview.requiresExport && !exportConfirmed) {
      setError("Confirm you exported audited data before continuing.");
      return;
    }
    setApplying(true);
    setError("");
    try {
      const res = await fetch("/api/admin/region/apply", {
        method: "POST",
        headers,
        body: JSON.stringify({
          bbox: draftBbox,
          presetId: presetId || undefined,
          exportConfirmed: preview.requiresExport ? exportConfirmed : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Apply failed");
        return;
      }
      if (data.changeType === "unchanged" && !data.jobId) {
        setError(data.message ?? "Region unchanged. Use Re-ingest to download OSM data again.");
        return;
      }
      if (data.jobId) {
        setJob({ id: data.jobId, status: "RUNNING", phase: null, progress: 0, message: null, error: null, stats: null });
      }
      setPreview(null);
      setExportConfirmed(false);
      setExportedAudited(false);
      void load();
    } catch {
      setError("Could not reach server");
    } finally {
      setApplying(false);
    }
  }

  async function handleImportGeoJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const bbox = draftBbox ?? settings?.bbox;
    if (!file || !bbox) return;
    setGeojsonStatus(null);
    setGeojsonImporting(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("bbox", bbox);
      const res = await fetch("/api/admin/ingest/geojson", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setGeojsonStatus(data.message ?? "GeoJSON import failed");
        return;
      }
      if (data.jobId) {
        setJob({ id: data.jobId, status: "RUNNING", phase: null, progress: 0, message: null, error: null, stats: null });
        setGeojsonStatus("Import started — see progress below.");
      }
    } catch {
      setGeojsonStatus("GeoJSON import failed");
    } finally {
      setGeojsonImporting(false);
      e.target.value = "";
    }
  }

  async function handleImportAudited(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/admin/import/audited", {
        method: "POST",
        headers,
        body: text,
      });
      const data = await res.json();
      setImportStatus(data.message ?? (res.ok ? "Imported" : "Import failed"));
      if (res.ok) void load();
    } catch {
      setImportStatus("Import failed");
    }
    e.target.value = "";
  }

  async function handleRetryJob() {
    if (!job) return;
    setError("");
    try {
      const res = await fetch(`/api/admin/ingest/${job.id}/retry`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Retry failed");
        return;
      }
      setJob({ ...job, status: "RUNNING", error: null });
    } catch {
      setError("Could not reach server");
    }
  }

  function handlePresetChange(id: string) {
    setPresetId(id);
    const p = presets.find((x) => x.id === id);
    setPresetBbox(p?.bbox ?? null);
  }

  if (!settings) return null;

  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "20px 24px", marginBottom: 24 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: "#111827" }}>Region &amp; OSM ingest</h3>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
        Configure the geographic area this node serves — from a city up to a full country. Large regions are downloaded in tiles from OpenStreetMap.
      </p>

      {settings.isConfigured && (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          <strong>{settings.region}</strong>
          {settings.lastIngestAt ? (
            <span style={{ color: "#6b7280", marginLeft: 8 }}>
              Last ingest: {new Date(settings.lastIngestAt).toLocaleString()}
              {settings.lastIngestCount != null && ` (${settings.lastIngestCount} elements)`}
            </span>
          ) : (
            <span style={{ color: "#b45309", marginLeft: 8 }}>OSM ingest not completed yet</span>
          )}
          {!settings.lastIngestAt && (
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={() => void handleReingest()}
                disabled={applying || (!!job && job.status === "RUNNING")}
                style={btnStyle("#2563eb", "#fff")}
              >
                {applying ? "Starting…" : "Start OSM ingest"}
              </button>
            </div>
          )}
          {settings.lastIngestAt && (
            <details style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
              <summary style={{ cursor: "pointer", color: "#374151", fontWeight: 600 }}>
                Refresh OSM data
              </summary>
              <p style={{ margin: "8px 0" }}>
                Re-download OpenStreetMap for this region. Use when OSM has changed or you need a clean baseline.
                Large regions can take hours (e.g. Benelux ~128 tiles).
              </p>
              <button
                type="button"
                onClick={() => void handleReingest()}
                disabled={applying || (!!job && job.status === "RUNNING")}
                style={btnStyle("#f3f4f6", "#111827")}
              >
                {applying ? "Starting…" : "Re-ingest OSM data"}
              </button>
            </details>
          )}
        </div>
      )}

      <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Preset (optional)</label>
      <select
        value={presetId}
        onChange={(e) => handlePresetChange(e.target.value)}
        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", marginBottom: 16, fontSize: 14 }}
      >
        <option value="">— Custom / draw on map —</option>
        {PRESET_TIER_ORDER.map((tier) => {
          const tierPresets = presets.filter((p) => p.tier === tier);
          if (tierPresets.length === 0) return null;
          return (
            <optgroup key={tier} label={PRESET_TIER_LABELS[tier]}>
              {tierPresets.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </optgroup>
          );
        })}
      </select>

      <RegionMapEditor
        bbox={draftBbox}
        onChange={setDraftBbox}
        presetBbox={presetBbox}
      />

      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => void handlePreview()}
          disabled={!draftBbox || previewLoading}
          style={btnStyle("#f3f4f6", "#111827")}
        >
          {previewLoading ? "Estimating…" : "Preview changes"}
        </button>
      </div>

      {preview && (
        <div style={{ marginTop: 16, padding: 14, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{CHANGE_LABELS[preview.changeType] ?? preview.changeType}</div>
          <div>Region label: <strong>{preview.regionLabel}</strong></div>
          <div>
            Area: {Math.round(preview.areaKm2).toLocaleString()} km²
            {preview.tileCount > 1 && ` · ${preview.tileCount} tiles`}
          </div>
          {preview.warnLarge && preview.ingestMode === "overpass" && (
            <div style={{ color: "#b45309", marginTop: 6 }}>
              Large region — ingest may take ~{Math.round(preview.estimatedDurationSec / 60)} minutes.
            </div>
          )}
          {preview.ingestMode === "geofabrik" && (
            <div style={{ color: "#1d4ed8", marginTop: 6 }}>
              Geofabrik import — downloads ~{preview.geofabrikDownloadMb ?? "?"} MB extract.
              Requires osmium-tool on the server (Docker dev image includes it).
            </div>
          )}
          {preview.propertiesToRemove > 0 && (
            <div style={{ color: "#b45309" }}>{preview.propertiesToRemove} properties will be removed (outside new area)</div>
          )}
          {preview.propertiesInside > 0 && (
            <div>{preview.propertiesInside} properties kept inside the new area</div>
          )}
          {preview.ingestEstimate && !preview.ingestEstimate.error && (
            <div style={{ marginTop: 8, color: "#374151" }}>
              {preview.ingestEstimate.isGeofabrik ? (
                <>
                  <div>Est. properties: ~{preview.ingestEstimate.propertyEstimate ?? "?"}</div>
                  <div>Est. download: ~{preview.ingestEstimate.downloadSizeMb ?? "?"} MB (Geofabrik .pbf)</div>
                  <div>Est. duration: ~{Math.round((preview.ingestEstimate.durationSeconds ?? 0) / 60)} min</div>
                </>
              ) : (
                <>
                  <div>Est. OSM elements: ~{preview.ingestEstimate.elementCount ?? "?"}</div>
                  <div>Est. properties: ~{preview.ingestEstimate.propertyEstimate ?? "?"}</div>
                  <div>Est. download: ~{preview.ingestEstimate.downloadSizeKb ?? "?"} KB</div>
                  <div>Est. duration: ~{preview.ingestEstimate.durationSeconds ?? "?"}s</div>
                </>
              )}
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                Estimates only — actual values may differ
                {preview.ingestEstimate.sampledTiles != null && preview.ingestEstimate.sampledTiles > 1 && (
                  <span> (sampled {preview.ingestEstimate.sampledTiles} tiles)</span>
                )}
              </div>
            </div>
          )}
          {preview.requiresExport && (
            <div style={{ marginTop: 12, padding: 12, background: "#fef3c7", borderRadius: 8 }}>
              <p style={{ margin: "0 0 8px" }}>
                Moving to a new area requires exporting <strong>audited field work</strong> first (auditor facts and submissions only).
                This is smaller and safer than a full backup — re-import merges into the new region by OSM ID.
              </p>
              <p style={{ margin: "0 0 8px", fontSize: 12, color: "#92400e" }}>
                Full backup (below in Admin) includes auditor data too, but restore replaces the entire database — do not use it for a region move.
              </p>
              <button type="button" onClick={() => void handleExportAudited()} style={btnStyle("#f59e0b", "#fff")}>
                {exportedAudited ? "Downloaded ✓" : "Export audited data"}
              </button>
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={exportConfirmed}
                  onChange={(e) => setExportConfirmed(e.target.checked)}
                  disabled={!exportedAudited}
                />
                I exported audited data and understand properties outside the new region will be removed
              </label>
            </div>
          )}
          {preview.changeType !== "unchanged" && (
            <button
              type="button"
              onClick={() => void handleApply()}
              disabled={applying || (preview.requiresExport && !exportConfirmed)}
              style={{ ...btnStyle("#2563eb", "#fff"), marginTop: 12 }}
            >
              {applying ? "Starting…" : preview.requiresIngest ? "Apply & ingest" : "Apply changes"}
            </button>
          )}
          {preview.changeType === "unchanged" && settings.isConfigured && (
            <div style={{ marginTop: 12 }}>
              <p style={{ margin: "0 0 8px", color: "#6b7280" }}>
                Region bbox is already saved. Use Re-ingest to download OSM data for this area.
              </p>
              <button
                type="button"
                onClick={() => void handleReingest()}
                disabled={applying || (!!job && job.status === "RUNNING")}
                style={btnStyle("#2563eb", "#fff")}
              >
                {applying ? "Starting…" : "Re-ingest OSM data"}
              </button>
            </div>
          )}
        </div>
      )}

      {job && (
        <div style={{ marginTop: 16, padding: 14, background: "#eff6ff", borderRadius: 8, fontSize: 13 }}>
          <div style={{ fontWeight: 600 }}>
            Ingest job: {job.status}
            {job.tileCount != null && job.tileCount > 0 && (
              <span style={{ fontWeight: 400, color: "#6b7280" }}>
                {" "}· tile {job.tilesDone ?? 0}/{job.tileCount}
              </span>
            )}
          </div>
          {job.message && <div>{job.message}</div>}
          {job.status === "RUNNING" && (
            <div style={{ marginTop: 8, background: "#dbeafe", borderRadius: 4, height: 8 }}>
              <div style={{ width: `${job.progress}%`, background: "#2563eb", height: 8, borderRadius: 4, transition: "width 0.3s" }} />
            </div>
          )}
          {job.error && (
            <div style={{ marginTop: 8 }}>
              <div style={{ color: "#dc2626" }}>{job.error}</div>
              <button
                type="button"
                onClick={() => void handleRetryJob()}
                style={{ ...btnStyle("#f3f4f6", "#111827"), marginTop: 8 }}
              >
                Retry failed ingest
              </button>
            </div>
          )}
        </div>
      )}

      {settings.isConfigured && (
        <div style={{ marginTop: 20, borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Import OSM GeoJSON</div>
          <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
            Load accommodations from a pre-exported GeoJSON or geojsonseq file (e.g. from osmium), clipped to the current region bbox.
            This is an <strong>OSM data source</strong>, not a backup or restore of node data.
          </p>
          <input
            type="file"
            accept=".json,.geojson,.geojsonl,.geojsonseq,application/geo+json,application/json"
            disabled={geojsonImporting || (!!job && job.status === "RUNNING")}
            onChange={(e) => void handleImportGeoJson(e)}
          />
          {geojsonStatus && <p style={{ fontSize: 12, marginTop: 8 }}>{geojsonStatus}</p>}
        </div>
      )}

      {settings.isConfigured && settings.auditedReimportPending && (
        <div style={{ marginTop: 20, borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Re-import audited data</div>
          <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
            You moved to a new region. After OSM ingest finishes, upload the <em>Export audited data</em> JSON
            to re-attach field audits (matched by OSM ID). Merges into existing properties — unlike full backup restore.
          </p>
          {(!!job && job.status === "RUNNING") || !settings.lastIngestAt ? (
            <p style={{ fontSize: 12, color: "#b45309", marginBottom: 8 }}>
              Wait until the OSM ingest job completes before importing.
            </p>
          ) : null}
          <input
            type="file"
            accept="application/json"
            disabled={(!!job && job.status === "RUNNING")}
            onChange={(e) => void handleImportAudited(e)}
          />
          {importStatus && <p style={{ fontSize: 12, marginTop: 8 }}>{importStatus}</p>}
        </div>
      )}

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginTop: 12 }}>{error}</p>}
    </div>
  );
}

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    padding: "8px 16px",
    borderRadius: 8,
    border: "none",
    background: bg,
    color,
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  };
}
