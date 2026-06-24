"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@wikitraveler/ui";
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
    error?: string;
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

const PRESET_TIER_ORDER: Preset["tier"][] = ["city", "country", "region", "geofabrik"];

function presetTierLabel(
  tier: Preset["tier"],
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  const keys: Record<Preset["tier"], string> = {
    city: "ui.adminPresetTierCity",
    country: "ui.adminPresetTierCountry",
    region: "ui.adminPresetTierRegion",
    geofabrik: "ui.adminPresetTierGeofabrik",
  };
  return t(keys[tier]);
}

function changeLabel(
  changeType: string,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  const keys: Record<string, string> = {
    initial: "ui.adminChangeInitial",
    shrink: "ui.adminChangeShrink",
    expand: "ui.adminChangeExpand",
    move: "ui.adminChangeMove",
    unchanged: "ui.adminChangeUnchanged",
  };
  return keys[changeType] ? t(keys[changeType]) : changeType;
}

function jobStatusLabel(
  status: string,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  const keys: Record<string, string> = {
    RUNNING: "ui.adminJobStatusRunning",
    COMPLETED: "ui.adminJobStatusCompleted",
    FAILED: "ui.adminJobStatusFailed",
    PENDING: "ui.adminJobStatusPending",
  };
  return keys[status] ? t(keys[status]) : status;
}

export function RegionPanel({ token }: { token: string }) {
  const { t, locale } = useLocale();
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
        setError(data.message ?? t("ui.adminPreviewFailed"));
        return;
      }
      setPreview(data as Preview);
    } catch {
      setError(t("ui.adminCouldNotReachServer"));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleExportAudited() {
    const res = await fetch("/api/admin/export/audited", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setError(t("ui.adminExportFailed"));
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
        setError(data.message ?? t("ui.adminReingestFailed"));
        return;
      }
      if (data.jobId) {
        setJob({ id: data.jobId, status: "RUNNING", phase: null, progress: 0, message: null, error: null, stats: null });
        setPreview(null);
      }
    } catch {
      setError(t("ui.adminCouldNotReachServer"));
    } finally {
      setApplying(false);
    }
  }

  async function handleSaveOnly() {
    if (!draftBbox || !preview) return;
    if (preview.requiresExport && !exportConfirmed) {
      setError(t("ui.adminConfirmExportFirst"));
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
          saveOnly: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? t("ui.adminSaveFailed"));
        return;
      }
      setPreview(null);
      setExportConfirmed(false);
      setExportedAudited(false);
      void load();
    } catch {
      setError(t("ui.adminCouldNotReachServer"));
    } finally {
      setApplying(false);
    }
  }

  async function handleApply() {
    if (!draftBbox || !preview) return;
    if (preview.requiresExport && !exportConfirmed) {
      setError(t("ui.adminConfirmExportFirst"));
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
        setError(data.message ?? t("ui.adminApplyFailed"));
        return;
      }
      if (data.changeType === "unchanged" && !data.jobId) {
        setError(data.message ?? t("ui.adminRegionUnchanged"));
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
      setError(t("ui.adminCouldNotReachServer"));
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
        setGeojsonStatus(data.message ?? t("ui.adminGeojsonImportFailed"));
        return;
      }
      if (data.jobId) {
        setJob({ id: data.jobId, status: "RUNNING", phase: null, progress: 0, message: null, error: null, stats: null });
        setGeojsonStatus(t("ui.adminImportStarted"));
      }
    } catch {
      setGeojsonStatus(t("ui.adminGeojsonImportFailed"));
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
      setImportStatus(data.message ?? (res.ok ? t("ui.adminImported") : t("ui.adminImportFailed")));
      if (res.ok) void load();
    } catch {
      setImportStatus(t("ui.adminImportFailed"));
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
        setError(data.message ?? t("ui.adminRetryFailed"));
        return;
      }
      setJob({ ...job, status: "RUNNING", error: null });
    } catch {
      setError(t("ui.adminCouldNotReachServer"));
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
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: "#111827" }}>{t("ui.adminRegionTitle")}</h3>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
        {t("ui.adminRegionLead")}
      </p>

      {settings.isConfigured && (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          <strong>{settings.region}</strong>
          {settings.lastIngestAt ? (
            <span style={{ color: "#6b7280", marginLeft: 8 }}>
              {t("ui.adminLastIngest", { date: new Date(settings.lastIngestAt).toLocaleString(locale) })}
              {settings.lastIngestCount != null && ` ${t("ui.adminLastIngestElements", { count: settings.lastIngestCount })}`}
            </span>
          ) : (
            <span style={{ color: "#b45309", marginLeft: 8 }}>{t("ui.adminOsmIngestIncomplete")}</span>
          )}
          {!settings.lastIngestAt && (
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={() => void handleReingest()}
                disabled={applying || (!!job && job.status === "RUNNING")}
                style={btnStyle("#2563eb", "#fff")}
              >
                {applying ? t("ui.adminStarting") : t("ui.adminStartOsmIngest")}
              </button>
            </div>
          )}
          {settings.lastIngestAt && (
            <details style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
              <summary style={{ cursor: "pointer", color: "#374151", fontWeight: 600 }}>
                {t("ui.adminRefreshOsmData")}
              </summary>
              <p style={{ margin: "8px 0" }}>
                {t("ui.adminRefreshOsmDesc")}
              </p>
              <button
                type="button"
                onClick={() => void handleReingest()}
                disabled={applying || (!!job && job.status === "RUNNING")}
                style={btnStyle("#f3f4f6", "#111827")}
              >
                {applying ? t("ui.adminStarting") : t("ui.adminReingestOsmData")}
              </button>
            </details>
          )}
        </div>
      )}

      <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>{t("ui.adminPresetOptional")}</label>
      <select
        value={presetId}
        onChange={(e) => handlePresetChange(e.target.value)}
        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", marginBottom: 16, fontSize: 14 }}
      >
        <option value="">{t("ui.adminPresetCustom")}</option>
        {PRESET_TIER_ORDER.map((tier) => {
          const tierPresets = presets.filter((p) => p.tier === tier);
          if (tierPresets.length === 0) return null;
          return (
            <optgroup key={tier} label={presetTierLabel(tier, t)}>
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
          {previewLoading ? t("ui.adminEstimating") : t("ui.adminPreviewChanges")}
        </button>
      </div>

      {preview && (
        <div style={{ marginTop: 16, padding: 14, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{changeLabel(preview.changeType, t)}</div>
          <div>{t("ui.adminRegionLabel")} <strong>{preview.regionLabel}</strong></div>
          <div>
            {t("ui.adminAreaKm2", { area: Math.round(preview.areaKm2).toLocaleString(locale) })}
            {preview.tileCount > 1 && ` ${t("ui.adminTileCount", { count: preview.tileCount })}`}
          </div>
          {preview.warnLarge && preview.ingestMode === "overpass" && (
            <div style={{ color: "#b45309", marginTop: 6 }}>
              {t("ui.adminLargeRegionWarning", { minutes: Math.round(preview.estimatedDurationSec / 60) })}
            </div>
          )}
          {preview.ingestMode === "geofabrik" && (
            <div style={{ color: "#1d4ed8", marginTop: 6 }}>
              {t("ui.adminGeofabrikWarning", { mb: preview.geofabrikDownloadMb ?? "?" })}
            </div>
          )}
          {preview.propertiesToRemove > 0 && (
            <div style={{ color: "#b45309" }}>{t("ui.adminPropertiesRemoved", { count: preview.propertiesToRemove })}</div>
          )}
          {preview.propertiesInside > 0 && (
            <div>{t("ui.adminPropertiesKept", { count: preview.propertiesInside })}</div>
          )}
          {preview.ingestEstimate && !preview.ingestEstimate.error && (
            <div style={{ marginTop: 8, color: "#374151" }}>
              {preview.ingestEstimate.isGeofabrik ? (
                <>
                  <div>{t("ui.adminEstProperties", { count: preview.ingestEstimate.propertyEstimate ?? "?" })}</div>
                  <div>{t("ui.adminEstDownloadMb", { mb: preview.ingestEstimate.downloadSizeMb ?? "?" })}</div>
                  <div>{t("ui.adminEstDurationMin", { min: Math.round((preview.ingestEstimate.durationSeconds ?? 0) / 60) })}</div>
                </>
              ) : (
                <>
                  <div>{t("ui.adminEstOsmElements", { count: preview.ingestEstimate.elementCount ?? "?" })}</div>
                  <div>{t("ui.adminEstProperties", { count: preview.ingestEstimate.propertyEstimate ?? "?" })}</div>
                  <div>{t("ui.adminEstDownloadKb", { kb: preview.ingestEstimate.downloadSizeKb ?? "?" })}</div>
                  <div>{t("ui.adminEstDurationSec", { sec: preview.ingestEstimate.durationSeconds ?? "?" })}</div>
                </>
              )}
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                {t("ui.adminEstimatesDisclaimer")}
                {preview.ingestEstimate.sampledTiles != null && preview.ingestEstimate.sampledTiles > 1 && (
                  <span> {t("ui.adminEstimatesSampled", { count: preview.ingestEstimate.sampledTiles })}</span>
                )}
              </div>
            </div>
          )}
          {preview.requiresExport && (
            <div style={{ marginTop: 12, padding: 12, background: "#fef3c7", borderRadius: 8 }}>
              <p style={{ margin: "0 0 8px" }}>
                {t("ui.adminExportAuditedLead")}
              </p>
              <p style={{ margin: "0 0 8px", fontSize: 12, color: "#92400e" }}>
                {t("ui.adminExportAuditedNote")}
              </p>
              <button type="button" onClick={() => void handleExportAudited()} style={btnStyle("#f59e0b", "#fff")}>
                {exportedAudited ? t("ui.adminExportAuditedDownloaded") : t("ui.adminExportAudited")}
              </button>
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={exportConfirmed}
                  onChange={(e) => setExportConfirmed(e.target.checked)}
                  disabled={!exportedAudited}
                />
                {t("ui.adminExportConfirmCheckbox")}
              </label>
            </div>
          )}
          {preview.changeType !== "unchanged" && (
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => void handleApply()}
                disabled={applying || (preview.requiresExport && !exportConfirmed)}
                style={btnStyle("#2563eb", "#fff")}
              >
                {applying ? t("ui.adminStarting") : preview.requiresIngest ? t("ui.adminApplyAndIngest") : t("ui.adminApplyChanges")}
              </button>
              {preview.requiresIngest && (
                <button
                  type="button"
                  onClick={() => void handleSaveOnly()}
                  disabled={applying || (preview.requiresExport && !exportConfirmed)}
                  style={btnStyle("#f3f4f6", "#111827")}
                >
                  {applying ? t("ui.adminSaving") : t("ui.adminSaveRegionOnly")}
                </button>
              )}
            </div>
          )}
          {preview.changeType !== "unchanged" && preview.requiresIngest && (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#6b7280" }}>
              {t("ui.adminSaveRegionOnlyHint")}
            </p>
          )}
          {preview.changeType === "unchanged" && settings.isConfigured && (
            <div style={{ marginTop: 12 }}>
              <p style={{ margin: "0 0 8px", color: "#6b7280" }}>
                {t("ui.adminRegionUnchangedHint")}
              </p>
              <button
                type="button"
                onClick={() => void handleReingest()}
                disabled={applying || (!!job && job.status === "RUNNING")}
                style={btnStyle("#2563eb", "#fff")}
              >
                {applying ? t("ui.adminStarting") : t("ui.adminReingestOsmData")}
              </button>
            </div>
          )}
        </div>
      )}

      {job && (
        <div style={{ marginTop: 16, padding: 14, background: "#eff6ff", borderRadius: 8, fontSize: 13 }}>
          <div style={{ fontWeight: 600 }}>
            {t("ui.adminIngestJob", { status: jobStatusLabel(job.status, t) })}
            {job.tileCount != null && job.tileCount > 0 && (
              <span style={{ fontWeight: 400, color: "#6b7280" }}>
                {" "}{t("ui.adminIngestTileProgress", { done: job.tilesDone ?? 0, total: job.tileCount })}
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
                {t("ui.adminRetryIngest")}
              </button>
            </div>
          )}
        </div>
      )}

      {settings.isConfigured && (
        <div style={{ marginTop: 20, borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t("ui.adminImportGeoJsonTitle")}</div>
          <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
            {t("ui.adminImportGeoJsonDesc")}
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
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t("ui.adminReimportAuditedTitle")}</div>
          <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
            {t("ui.adminReimportAuditedDesc")}
          </p>
          {(!!job && job.status === "RUNNING") || !settings.lastIngestAt ? (
            <p style={{ fontSize: 12, color: "#b45309", marginBottom: 8 }}>
              {t("ui.adminWaitForIngest")}
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
