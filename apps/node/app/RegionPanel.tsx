"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@wikitraveler/ui";

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

function presetTierLabel(
  tier: Preset["tier"],
  t: (key: string) => string
): string {
  const keys: Record<Preset["tier"], string> = {
    city: "ui.adminPresetTierCity",
    country: "ui.adminPresetTierCountry",
    region: "ui.adminPresetTierRegion",
    geofabrik: "ui.adminPresetTierGeofabrik",
  };
  return t(keys[tier]);
}

const PRESET_TIER_ORDER: Preset["tier"][] = ["city", "country", "region", "geofabrik"];

export function RegionPanel({ token }: { token: string }) {
  const { t, locale } = useLocale();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [draftBbox, setDraftBbox] = useState<string>("");
  const [presetId, setPresetId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token]
  );

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/region", { headers: authHeaders() });
    if (!res.ok) return;
    const data = (await res.json()) as { settings: Settings; presets: Preset[] };
    setSettings(data.settings);
    setPresets(data.presets);
    setDraftBbox(data.settings.bbox ?? "");
    setPresetId(data.settings.presetId ?? "");
  }, [authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSaveRegion() {
    if (!draftBbox.trim()) return;
    if (settings?.bbox && draftBbox.trim() !== settings.bbox && !window.confirm(t("ui.adminRegionChangeConfirm"))) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/region/apply", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          bbox: draftBbox.trim(),
          presetId: presetId || undefined,
          exportConfirmed: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? t("ui.adminSaveFailed"));
        return;
      }
      void load();
    } catch {
      setError(t("ui.adminCouldNotReachServer"));
    } finally {
      setSaving(false);
    }
  }

  async function handleExportData() {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/export", {
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
      a.download = `wikitraveler-export-${new Date().toISOString().slice(0, 10)}.json.gz`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
    } finally {
      setExporting(false);
    }
  }

  async function handleImportData(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportStatus(null);
    try {
      const buffer = await file.arrayBuffer();
      const isGzip = file.name.endsWith(".gz");
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": isGzip ? "application/gzip" : "application/json",
        },
        body: buffer,
      });
      const data = await res.json();
      setImportStatus(
        res.ok
          ? t("ui.adminImportSuccess", {
              properties: data.propertiesUpserted ?? 0,
              facts: data.factsImported ?? 0,
            })
          : (data.message ?? t("ui.adminImportFailed"))
      );
      if (res.ok) void load();
    } catch {
      setImportStatus(t("ui.adminImportFailed"));
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  async function handleLoadSample() {
    setLoadingSample(true);
    setImportStatus(null);
    try {
      const res = await fetch("/api/admin/import/sample", {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      setImportStatus(
        res.ok
          ? t("ui.adminSampleLoaded", { count: data.propertiesUpserted ?? 0 })
          : (data.message ?? t("ui.adminImportFailed"))
      );
      if (res.ok) void load();
    } catch {
      setImportStatus(t("ui.adminImportFailed"));
    } finally {
      setLoadingSample(false);
    }
  }

  async function handleImportAudited(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = await fetch("/api/admin/import/audited", {
        method: "POST",
        headers: authHeaders(),
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

  function handlePresetChange(id: string) {
    setPresetId(id);
    const p = presets.find((x) => x.id === id);
    if (p) setDraftBbox(p.bbox);
  }

  if (!settings) return null;

  return (
    <div className="wt-admin-panel">
      <h3 className="wt-admin-panel__title">{t("ui.adminRegionTitle")}</h3>
      <p className="wt-admin-panel__lead">{t("ui.adminRegionLeadOffline")}</p>

      {settings.isConfigured && (
        <div className="wt-admin-banner wt-admin-banner--ok">
          <strong>{settings.region}</strong>
          {settings.lastIngestAt ? (
            <span className="wt-admin-muted">
              {" "}
              {t("ui.adminLastIngest", { date: new Date(settings.lastIngestAt).toLocaleString(locale) })}
              {settings.lastIngestCount != null &&
                ` ${t("ui.adminLastIngestElements", { count: settings.lastIngestCount })}`}
            </span>
          ) : (
            <span className="wt-admin-warn"> {t("ui.adminNoDataYet")}</span>
          )}
        </div>
      )}

      {!settings.isConfigured && (
        <div className="wt-admin-banner wt-admin-banner--info" style={{ marginBottom: 16 }}>
          <p style={{ margin: "0 0 8px" }}>{t("ui.adminSampleLead")}</p>
          <button type="button" onClick={() => void handleLoadSample()} disabled={loadingSample} className="wt-admin-btn wt-admin-btn--primary">
            {loadingSample ? t("ui.adminStarting") : t("ui.adminLoadSample")}
          </button>
        </div>
      )}

      <label className="wt-admin-label">{t("ui.adminPresetOptional")}</label>
      <select value={presetId} onChange={(e) => handlePresetChange(e.target.value)} className="wt-admin-select">
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

      <label className="wt-admin-label">{t("ui.adminBboxField")}</label>
      <input
        type="text"
        value={draftBbox}
        onChange={(e) => { setDraftBbox(e.target.value); setPresetId(""); }}
        placeholder="minLat,minLon,maxLat,maxLon"
        className="wt-admin-select"
        spellCheck={false}
      />

      <div className="wt-admin-actions">
        <button type="button" onClick={() => void handleSaveRegion()} disabled={!draftBbox.trim() || saving} className="wt-admin-btn wt-admin-btn--primary">
          {saving ? t("ui.adminSaving") : t("ui.adminSaveRegion")}
        </button>
      </div>

      <div className="wt-admin-section-divider">
        <h4 className="wt-admin-subtitle">{t("ui.adminDataTransferTitle")}</h4>
        <p className="wt-admin-muted">{t("ui.adminDataTransferDesc")}</p>
        <div className="wt-admin-actions">
          <button type="button" onClick={() => void handleExportData()} disabled={exporting} className="wt-admin-btn">
            {exporting ? t("ui.adminBackupPreparing") : t("ui.adminExportProduction")}
          </button>
          <label className="wt-admin-btn wt-admin-btn--file">
            {importing ? t("ui.adminRestoring") : t("ui.adminImportProduction")}
            <input type="file" accept=".json,.gz,.json.gz" disabled={importing} onChange={(e) => void handleImportData(e)} />
          </label>
          <button type="button" onClick={() => void handleLoadSample()} disabled={loadingSample} className="wt-admin-btn">
            {loadingSample ? t("ui.adminStarting") : t("ui.adminLoadSample")}
          </button>
        </div>
        {importStatus && <p className="wt-admin-status">{importStatus}</p>}
        <p className="wt-admin-hint">{t("ui.adminOfflineIngestHint")}</p>
      </div>

      {settings.auditedReimportPending && (
        <div className="wt-admin-section-divider">
          <h4 className="wt-admin-subtitle">{t("ui.adminReimportAuditedTitle")}</h4>
          <p className="wt-admin-muted">{t("ui.adminReimportAuditedDesc")}</p>
          <input type="file" accept="application/json" onChange={(e) => void handleImportAudited(e)} />
        </div>
      )}

      {error && <p className="wt-admin-error">{error}</p>}
    </div>
  );
}
