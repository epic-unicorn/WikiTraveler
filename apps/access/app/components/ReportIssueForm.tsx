"use client";

import { useState } from "react";
import { useLocale } from "@wikitraveler/ui";
import { submitCommunitySignal, type SignalType } from "../lib/accessApi";

const TYPES: SignalType[] = ["MISSING", "INCORRECT", "OUTDATED", "LOCATION", "DEMAND"];

interface Props {
  propertyId: string;
  nodeUrl: string;
  fieldName?: string;
  currentValue?: string;
  currentTier?: string;
  onSubmitted?: () => void;
  onCancel?: () => void;
}

export function ReportIssueForm({
  propertyId,
  nodeUrl,
  fieldName,
  currentValue,
  currentTier,
  onSubmitted,
  onCancel,
}: Props) {
  const { t, getFieldLabel } = useLocale();
  const [type, setType] = useState<SignalType>(fieldName ? "INCORRECT" : "MISSING");
  const [note, setNote] = useState("");
  const [suggestedValue, setSuggestedValue] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await submitCommunitySignal(nodeUrl, propertyId, {
        type,
        fieldName,
        currentValue,
        currentTier,
        suggestedValue: suggestedValue.trim() || undefined,
        note: note.trim() || undefined,
        visitDate: visitDate || undefined,
      });
      setOk(true);
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("ui.signalSubmitFailed"));
    } finally {
      setLoading(false);
    }
  }

  if (ok) {
    return (
      <div className="fk-report-form" role="status">
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--wt-success)" }}>{t("ui.signalSubmitOk")}</p>
        <p style={{ fontSize: 13, color: "var(--wt-text-muted)" }}>{t("ui.signalSubmitOkBody")}</p>
      </div>
    );
  }

  return (
    <form className="fk-report-form" onSubmit={handleSubmit}>
      <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>{t("ui.signalReportTitle")}</h3>
      {fieldName && (
        <p style={{ fontSize: 12, color: "var(--wt-text-muted)", marginBottom: 10 }}>
          {getFieldLabel(fieldName)}
          {currentValue ? ` · ${currentValue}` : ""}
        </p>
      )}
      <label htmlFor="signal-type" style={labelStyle}>{t("ui.signalTypeLabel")}</label>
      <select
        id="signal-type"
        value={type}
        onChange={(e) => setType(e.target.value as SignalType)}
        style={inputStyle}
      >
        {TYPES.map((tp) => (
          <option key={tp} value={tp}>{t(`ui.signalType${tp}`)}</option>
        ))}
      </select>
      <label htmlFor="signal-note" style={labelStyle}>{t("ui.signalNoteLabel")}</label>
      <textarea
        id="signal-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder={t("ui.signalNotePlaceholder")}
        style={{ ...inputStyle, resize: "vertical" }}
      />
      {(type === "INCORRECT" || type === "MISSING") && (
        <>
          <label htmlFor="signal-suggested" style={labelStyle}>{t("ui.signalSuggestedLabel")}</label>
          <input
            id="signal-suggested"
            type="text"
            value={suggestedValue}
            onChange={(e) => setSuggestedValue(e.target.value)}
            style={inputStyle}
          />
        </>
      )}
      <label htmlFor="signal-visit" style={labelStyle}>{t("ui.signalVisitLabel")}</label>
      <input
        id="signal-visit"
        type="date"
        value={visitDate}
        onChange={(e) => setVisitDate(e.target.value)}
        style={inputStyle}
      />
      {error && <p role="alert" style={{ color: "var(--wt-danger)", fontSize: 13 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 1 }}>
          {loading ? t("ui.loading") : t("ui.signalSubmit")}
        </button>
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {t("ui.cancel")}
          </button>
        )}
      </div>
      <p style={{ fontSize: 11, color: "var(--wt-text-muted)", marginTop: 10 }}>{t("ui.signalDisclaimer")}</p>
    </form>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--wt-text-muted)",
  marginBottom: 4,
  marginTop: 10,
  textTransform: "uppercase",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  border: "1px solid var(--wt-border)",
  borderRadius: "var(--wt-radius-sm)",
  fontSize: 14,
  background: "var(--wt-bg)",
  color: "var(--wt-text)",
  fontFamily: "inherit",
};
