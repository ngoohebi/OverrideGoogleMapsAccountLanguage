// Interface languages that google.com/maps actually renders when given ?hl=<code>.
// Started from https://developers.google.com/maps/faq#languagesupport and verified
// with `npm run check:languages` (2026-11-02). Dropped from that list because the
// website ignores them or treats them as another entry: be, sr-Latn (fall back to
// the visitor's default), zh-HK (= zh-TW), en-AU, en-GB (= en), fr-CA (= fr),
// zh (= zh-CN), pt (= pt-BR). Users can still type any code as a custom code.
export const MAPS_LANGUAGES = [
  'af', 'am', 'ar', 'az', 'bg', 'bn', 'bs', 'ca', 'cs', 'da', 'de', 'el',
  'en', 'es', 'es-419', 'et', 'eu', 'fa', 'fi', 'fil', 'fr', 'gl', 'gu',
  'hi', 'hr', 'hu', 'hy', 'id', 'is', 'it', 'iw', 'ja', 'ka', 'kk', 'km',
  'kn', 'ko', 'ky', 'lo', 'lt', 'lv', 'mk', 'ml', 'mn', 'mr', 'ms', 'my',
  'ne', 'nl', 'no', 'pa', 'pl', 'pt-BR', 'pt-PT', 'ro', 'ru', 'si', 'sk',
  'sl', 'sq', 'sr', 'sv', 'sw', 'ta', 'te', 'th', 'tr', 'uk', 'ur', 'uz',
  'vi', 'zh-CN', 'zh-TW', 'zu',
];

// Google uses legacy codes in a few places; map them for Intl name lookup.
const INTL_ALIASES = { iw: 'he', no: 'nb' };

function displayName(code, inLocale) {
  try {
    const name = new Intl.DisplayNames([inLocale], { type: 'language' }).of(
      INTL_ALIASES[code] ?? code,
    );
    return name && name !== code ? name : code;
  } catch {
    return code;
  }
}

/** [{ code, english, native }] sorted by English name. */
export function languageEntries(codes = MAPS_LANGUAGES) {
  return codes
    .map((code) => {
      const intlCode = INTL_ALIASES[code] ?? code;
      return {
        code,
        english: displayName(code, 'en'),
        native: displayName(code, intlCode),
      };
    })
    .sort((a, b) => a.english.localeCompare(b.english, 'en'));
}

/** Human-readable name, e.g. "Japanese · 日本語", "English", or the code if unknown. */
export function languageName(code) {
  const english = displayName(code, 'en');
  const native = displayName(code, INTL_ALIASES[code] ?? code);
  if (english === code) return code;
  return native === english || native === code ? english : `${english} · ${native}`;
}
