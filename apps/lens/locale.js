// locale.js — Lens locale helpers (chrome.storage.sync, key wt_locale)

/** @returns {Promise<string>} */
async function wtGetLocale() {
  const key = WtI18n.LOCALE_STORAGE_KEY;
  const items = await chrome.storage.sync.get({ [key]: WtI18n.DEFAULT_LOCALE });
  return WtI18n.resolveLocale({
    stored: items[key],
    acceptLanguage: navigator.language,
    nodeDefault: null,
  });
}

/** @param {string} locale */
async function wtSetLocale(locale) {
  if (!WtI18n.isSupportedLocale(locale)) return;
  const key = WtI18n.LOCALE_STORAGE_KEY;
  await chrome.storage.sync.set({ [key]: locale });
  document.documentElement.lang = locale;
}

/** @param {string} key @param {string} locale @param {Record<string, string|number>} [params] */
function wtT(key, locale, params) {
  return WtI18n.t(key, locale, params);
}

/** @param {string} fieldName @param {string} locale */
function wtFieldLabel(fieldName, locale) {
  return WtI18n.getFieldLabel(fieldName, locale);
}

/** @param {string} tier @param {string} locale */
function wtTierLabel(tier, locale) {
  return WtI18n.getTierLabel(tier, locale);
}

/** @param {string} locale */
function wtApplyLocaleSelect(selectEl, locale) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  for (const loc of WtI18n.SUPPORTED_LOCALES) {
    const opt = document.createElement("option");
    opt.value = loc;
    opt.textContent = WtI18n.LOCALE_LABELS[loc];
    if (loc === locale) opt.selected = true;
    selectEl.appendChild(opt);
  }
}
