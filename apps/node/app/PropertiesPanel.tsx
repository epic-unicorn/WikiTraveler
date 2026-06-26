"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useLocale } from "@wikitraveler/ui";
import { reverseGeocode } from "@/lib/nominatim";
import type { PropertyMetadataFieldName } from "@wikitraveler/core";

const MapPicker = dynamic(() => import("./properties/new/MapPicker").then((m) => m.MapPicker), {
  ssr: false,
  loading: () => <div className="wt-admin-map-loading">…</div>,
});

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

interface PropertyRow {
  id: string;
  name: string;
  location: string;
  canonicalId: string;
  lat: number | null;
  lon: number | null;
  dataSource?: string;
  osmId?: string | null;
}

interface FieldProvenance {
  fieldName: PropertyMetadataFieldName;
  source: "base" | "local" | "peer";
  sourceNodeId?: string;
  timestamp?: string;
  baseValue: string;
  effectiveValue: string;
}

interface PropertyDetail extends PropertyRow {
  baseMetadata?: { name: string; location: string; lat: number | null; lon: number | null };
  metadataProvenance?: FieldProvenance[];
}

interface Props {
  token: string;
}

export function PropertiesPanel({ token }: Props) {
  const { t } = useLocale();
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<PropertyDetail | null>(null);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [canonicalId, setCanonicalId] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locationTouched, setLocationTouched] = useState(false);
  const [provenance, setProvenance] = useState<FieldProvenance[]>([]);

  const headers = useCallback(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        admin: "1",
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (debouncedQuery) params.set("q", debouncedQuery);

      const res = await fetch(`/api/properties?${params}`, { headers: headers() });
      if (!res.ok) {
        setError(t("ui.adminLoadPropertiesFailed"));
        return;
      }
      const data = (await res.json()) as {
        properties: PropertyRow[];
        total: number;
        page: number;
        pageSize: number;
      };
      setProperties(data.properties);
      setTotal(data.total);
    } catch {
      setError(t("ui.adminCouldNotReachServer"));
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, headers, page, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const prefillName = params.get("name");
    if (prefillName && !creating && !editing) {
      setName(prefillName);
      setCreating(true);
    }
  }, [creating, editing]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeTo = Math.min(page * PAGE_SIZE, total);

  function resetForm() {
    setName("");
    setLocation("");
    setCanonicalId("");
    setLat(null);
    setLon(null);
    setShowMap(false);
    setLocationTouched(false);
    setProvenance([]);
    setEditing(null);
    setCreating(false);
  }

  function startCreate() {
    resetForm();
    setCreating(true);
  }

  async function startEdit(p: PropertyRow) {
    setCreating(false);
    setName(p.name);
    setLocation(p.location);
    setCanonicalId(p.canonicalId);
    setLat(p.lat);
    setLon(p.lon);
    setLocationTouched(true);
    setShowMap(p.lat != null && p.lon != null);
    setEditing(p);

    try {
      const res = await fetch(`/api/properties/${p.id}`, { headers: headers() });
      if (res.ok) {
        const data = (await res.json()) as { property: PropertyDetail };
        setEditing(data.property);
        setProvenance(data.property.metadataProvenance ?? []);
        setName(data.property.name);
        setLocation(data.property.location);
        setLat(data.property.lat);
        setLon(data.property.lon);
      }
    } catch {
      /* list row values are still usable */
    }
  }

  function provenanceLabel(field: PropertyMetadataFieldName): string {
    const row = provenance.find((p) => p.fieldName === field);
    if (!row || row.source === "base") {
      return editing?.osmId ? t("ui.adminMetadataOsm") : t("ui.adminMetadataBase");
    }
    if (row.source === "local") return t("ui.adminMetadataLocal");
    return t("ui.adminMetadataPeer", { node: row.sourceNodeId ?? "?" });
  }

  function baseHint(field: PropertyMetadataFieldName): string | null {
    const row = provenance.find((p) => p.fieldName === field);
    if (!row || row.source === "base" || row.baseValue === row.effectiveValue) return null;
    return t("ui.adminMetadataBaseValue", { value: row.baseValue });
  }

  async function handleMapPick(pick: { lat: number; lon: number }) {
    setLat(pick.lat);
    setLon(pick.lon);
    if (!locationTouched || !location.trim()) {
      const address = await reverseGeocode(pick.lat, pick.lon);
      if (address) setLocation(address);
    }
  }

  async function handleSave() {
    if (!name.trim() || !location.trim()) {
      setError(t("ui.createPropertyNameLocationRequired"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = {
        name: name.trim(),
        location: location.trim(),
        ...(canonicalId.trim() ? { canonicalId: canonicalId.trim() } : {}),
        ...(lat != null && lon != null ? { lat, lon } : {}),
      };

      const res = editing
        ? await fetch(`/api/properties/${editing.id}`, { method: "PATCH", headers: headers(), body: JSON.stringify(body) })
        : await fetch("/api/properties", { method: "POST", headers: headers(), body: JSON.stringify(body) });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? t("ui.adminSavePropertyFailed"));
        return;
      }
      resetForm();
      void load();
    } catch {
      setError(t("ui.adminCouldNotReachServer"));
    } finally {
      setSaving(false);
    }
  }

  async function handleResetFields(fields: PropertyMetadataFieldName[]) {
    if (!editing) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/properties/${editing.id}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ resetFields: fields }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? t("ui.adminSavePropertyFailed"));
        return;
      }
      const property = data.property as PropertyDetail;
      setName(property.name);
      setLocation(property.location);
      setLat(property.lat);
      setLon(property.lon);
      setProvenance(property.metadataProvenance ?? []);
      void load();
    } catch {
      setError(t("ui.adminCouldNotReachServer"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: PropertyRow) {
    const msg = p.osmId
      ? t("ui.adminDeleteOsmPropertyConfirm", { name: p.name })
      : t("ui.adminDeletePropertyConfirm", { name: p.name });
    if (!window.confirm(msg)) return;

    const res = await fetch(`/api/properties/${p.id}`, { method: "DELETE", headers: headers() });
    if (!res.ok) {
      const data = await res.json();
      setError(data.message ?? t("ui.adminDeletePropertyFailed"));
      return;
    }
    if (editing?.id === p.id) resetForm();
    void load();
  }

  const hasManualOverrides = provenance.some((p) => p.source !== "base");
  const formOpen = creating || editing != null;

  function fieldResetButton(field: PropertyMetadataFieldName, label: string) {
    const row = provenance.find((p) => p.fieldName === field);
    if (!row || row.source === "base") return null;
    return (
      <button
        type="button"
        className="wt-admin-btn wt-admin-btn--sm"
        disabled={saving}
        onClick={() => void handleResetFields([field])}
      >
        {t("ui.adminResetField", { field: label })}
      </button>
    );
  }

  return (
    <div className="wt-admin-panel">
      <h3 className="wt-admin-panel__title">{t("ui.adminPropertiesTitle")}</h3>
      <p className="wt-admin-panel__lead">{t("ui.adminPropertiesLead")}</p>

      <div className="wt-admin-toolbar">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("ui.adminSearchProperties")}
          className="wt-admin-input wt-admin-toolbar__search"
          aria-label={t("ui.adminSearchProperties")}
        />
        <button type="button" onClick={() => void load()} className="wt-admin-btn" disabled={loading}>
          {t("ui.adminRefresh")}
        </button>
        <button type="button" onClick={startCreate} className="wt-admin-btn wt-admin-btn--primary">
          {t("ui.adminAddProperty")}
        </button>
      </div>

      <div className="wt-admin-table-wrap">
        <table className="wt-admin-table wt-admin-table--crud">
          <thead>
            <tr>
              <th>{t("ui.createPropertyName")}</th>
              <th>{t("ui.createPropertyLocation")}</th>
              <th>{t("ui.adminPropertySource")}</th>
              <th className="wt-admin-table__num">{t("ui.adminCoordsCol")}</th>
              <th className="wt-admin-table__actions">{t("ui.adminTableActions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="wt-admin-table__empty">
                  {t("ui.adminLoadingProperties")}
                </td>
              </tr>
            ) : properties.length === 0 ? (
              <tr>
                <td colSpan={5} className="wt-admin-table__empty">
                  {t("ui.adminNoProperties")}
                </td>
              </tr>
            ) : (
              properties.map((p) => (
                <tr key={p.id}>
                  <td className="wt-admin-table__name">
                    <a href={`/properties/${p.id}`}>{p.name}</a>
                    {p.lat == null && (
                      <span className="wt-admin-badge wt-admin-badge--warn" title={t("ui.adminNoCoords")}>
                        !
                      </span>
                    )}
                  </td>
                  <td className="wt-admin-table__location">{p.location}</td>
                  <td>{p.osmId ? `OSM ${p.osmId}` : (p.dataSource ?? "local")}</td>
                  <td className="wt-admin-table__num wt-admin-mono">
                    {p.lat != null && p.lon != null
                      ? `${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`
                      : "—"}
                  </td>
                  <td className="wt-admin-table__actions">
                    <button type="button" onClick={() => void startEdit(p)} className="wt-admin-btn wt-admin-btn--sm">
                      {t("ui.adminEditProperty")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(p)}
                      className="wt-admin-btn wt-admin-btn--sm wt-admin-btn--danger"
                    >
                      {t("ui.adminDelete")}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="wt-admin-pagination">
        <span className="wt-admin-muted">
          {t("ui.adminShowing", { from: String(rangeFrom), to: String(rangeTo), total: String(total) })}
        </span>
        <div className="wt-admin-pagination__controls">
          <button
            type="button"
            className="wt-admin-btn wt-admin-btn--sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t("ui.adminPrevPage")}
          </button>
          <span className="wt-admin-muted">
            {t("ui.adminPageOf", { page: String(page), total: String(totalPages) })}
          </span>
          <button
            type="button"
            className="wt-admin-btn wt-admin-btn--sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("ui.adminNextPage")}
          </button>
        </div>
      </div>

      {formOpen && (
        <div className="wt-admin-modal-backdrop" role="presentation" onClick={resetForm}>
          <div
            className="wt-admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="property-form-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 id="property-form-title" className="wt-admin-modal__title">
              {editing ? t("ui.adminEditProperty") : t("ui.adminAddProperty")}
            </h4>

            <label className="wt-admin-label">{t("ui.createPropertyNameRequired")}</label>
            <input className="wt-admin-input" value={name} onChange={(e) => setName(e.target.value)} required />
            {editing && (
              <p className="wt-admin-muted wt-admin-provenance">
                {provenanceLabel("name")}
                {baseHint("name") ? ` — ${baseHint("name")}` : ""}
              </p>
            )}
            {editing && fieldResetButton("name", t("ui.createPropertyName"))}

            <label className="wt-admin-label">{t("ui.createPropertyLocationRequired")}</label>
            <input
              className="wt-admin-input"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                setLocationTouched(true);
              }}
              required
            />
            {editing && (
              <p className="wt-admin-muted wt-admin-provenance">
                {provenanceLabel("location")}
                {baseHint("location") ? ` — ${baseHint("location")}` : ""}
              </p>
            )}
            {editing && fieldResetButton("location", t("ui.createPropertyLocation"))}

            <label className="wt-admin-label">{t("ui.createPropertyCanonicalId")}</label>
            <input
              className="wt-admin-input"
              value={canonicalId}
              onChange={(e) => setCanonicalId(e.target.value)}
              disabled={!!editing?.osmId}
            />

            <button type="button" onClick={() => setShowMap((v) => !v)} className="wt-admin-btn">
              {showMap ? t("ui.createPropertyHideMap") : lat != null ? t("ui.createPropertyAdjustPin") : t("ui.createPropertyPickMap")}
            </button>
            {lat != null && lon != null && (
              <>
                <p className="wt-admin-muted">{t("ui.createPropertyPin", { lat: lat.toFixed(5), lon: lon.toFixed(5) })}</p>
                {editing && (
                  <p className="wt-admin-muted wt-admin-provenance">
                    {provenanceLabel("lat")} / {provenanceLabel("lon")}
                    {baseHint("lat") ? ` — ${baseHint("lat")}, ${baseHint("lon") ?? ""}` : ""}
                  </p>
                )}
                {editing && (
                  <button
                    type="button"
                    className="wt-admin-btn wt-admin-btn--sm"
                    disabled={saving || provenance.filter((p) => (p.fieldName === "lat" || p.fieldName === "lon") && p.source !== "base").length === 0}
                    onClick={() => void handleResetFields(["lat", "lon"])}
                  >
                    {t("ui.adminResetCoords")}
                  </button>
                )}
              </>
            )}
            {showMap && (
              <div className="wt-admin-modal__map">
                <MapPicker lat={lat} lon={lon} onPick={(pick) => void handleMapPick(pick)} />
              </div>
            )}

            {editing && hasManualOverrides && (
              <button
                type="button"
                className="wt-admin-btn wt-admin-btn--sm"
                disabled={saving}
                onClick={() =>
                  void handleResetFields(["name", "location", "lat", "lon"])
                }
              >
                {t("ui.adminResetAllMetadata")}
              </button>
            )}

            <div className="wt-admin-actions">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="wt-admin-btn wt-admin-btn--primary"
              >
                {saving ? t("ui.adminSaving") : t("ui.adminSave")}
              </button>
              <button type="button" onClick={resetForm} className="wt-admin-btn">
                {t("ui.adminCancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <p className="wt-admin-error">{error}</p>}
    </div>
  );
}
