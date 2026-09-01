export interface ExistingFact {
  fieldName: string;
  scopeKey?: string;
  value: string;
  displayValue?: string;
  valueLocale?: string | null;
  machineTranslated?: boolean;
  tier: string;
  sourceType?: string;
  signatureHash?: string | null;
  timestamp?: string;
}

export interface AuditPhotoItem {
  id?: string;
  url: string;
  caption?: string | null;
  fieldName?: string | null;
  scopeKey?: string | null;
}
