export const PREF_STORAGE_KEY = 'rd_preferences_v1';
export const DRAFT_STORAGE_KEY = 'rd_draft_v1';

export const DEFAULT_PREFERENCES = {
    mode_switch: false,             // false: 1個月, true: 2個月
    use_qod_limit: true,
    inputQodLimitSlider: 1,
    use_week_hours_limit: true,
    inputWeekHoursLimitSlider: 80,
    inputPeopleSlider: 4,
    auto_save_draft: true,          // 是否自動暫存排班草稿
};

export const DEFAULT_DRAFT = {
    currentMonth: null,             // 'YYYY-MM-01'
    deletedHolidays: [],            // ['eventId1', ...]
    customHolidays: [],             // [{ id, date, title }]
    presetDuties: [],               // [['YYYY-MM-DD', personNo]]
    presetNonDuties: [],            // [['YYYY-MM-DD', personNo]]
    generatedDuties: [],            // [['YYYY-MM-DD', personNo]]
    customPatterns: {},             // { 'YYYY-MM_span_people': [[o,f,h], ...] }
};

const LEGACY_COOKIE_KEYS = [
    'mode_switch',
    'use_qod_limit',
    'inputQodLimitSlider',
    'use_week_hours_limit',
    'inputWeekHoursLimitSlider',
    'inputPeopleSlider',
];

/**
 * Parse legacy cookies from document.cookie or custom cookie string.
 * @param {string} [cookieStr] Optional cookie string for SSR or testing.
 * @return {Object} Key-value pairs of cookies.
 */
export function parseLegacyCookies(cookieStr) {
    var rawCookie = cookieStr !== undefined ? cookieStr : (typeof document !== 'undefined' ? document.cookie : '');
    if (!rawCookie) {
        return {};
    }
    var pairs = rawCookie.split(';');
    var cookies = {};
    for (var i = 0; i < pairs.length; i++) {
        var parts = pairs[i].trim().split('=');
        if (parts.length >= 2) {
            var key = decodeURIComponent(parts[0].trim());
            var val = decodeURIComponent(parts.slice(1).join('=').trim());
            cookies[key] = val;
        }
    }
    return cookies;
}

/**
 * Expire legacy cookies if present.
 */
function clearLegacyCookies() {
    if (typeof document === 'undefined') {
        return;
    }
    for (var i = 0; i < LEGACY_COOKIE_KEYS.length; i++) {
        var key = LEGACY_COOKIE_KEYS[i];
        document.cookie = key + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    }
}

/**
 * Cast a preference key/value pair into appropriate boolean or number.
 * @param {string} key Preference key
 * @param {*} value Raw value
 * @return {*} Formatted value
 */
function castPreferenceValue(key, value) {
    if (value === undefined || value === null) {
        return DEFAULT_PREFERENCES[key];
    }
    if (typeof DEFAULT_PREFERENCES[key] === 'boolean') {
        if (typeof value === 'boolean') {
            return value;
        }
        return value === 'true' || value === 1 || value === '1';
    }
    if (typeof DEFAULT_PREFERENCES[key] === 'number') {
        var parsed = parseInt(value, 10);
        return isNaN(parsed) ? DEFAULT_PREFERENCES[key] : parsed;
    }
    return value;
}

/**
 * Load user preferences from storage with backward-compatible cookie migration.
 * @param {Storage} [storage=window.localStorage] Storage implementation.
 * @param {string} [cookieStr] Optional cookie string (defaults to document.cookie).
 * @return {Object} Normalized preferences object.
 */
export function loadPreferences(storage, cookieStr) {
    var s = storage !== undefined ? storage : (typeof window !== 'undefined' ? window.localStorage : null);
    var raw = null;
    if (s && typeof s.getItem === 'function') {
        raw = s.getItem(PREF_STORAGE_KEY);
    }

    if (raw) {
        try {
            var parsed = JSON.parse(raw);
            var result = {};
            for (var key in DEFAULT_PREFERENCES) {
                if ({}.hasOwnProperty.call(DEFAULT_PREFERENCES, key)) {
                    result[key] = castPreferenceValue(key, parsed[key]);
                }
            }
            return result;
        } catch {
            // fallback to defaults if corrupt
        }
    }

    // Attempt migration from legacy cookies if storage is empty
    var cookies = parseLegacyCookies(cookieStr);
    var hasCookie = false;
    var migrated = {};
    for (var k in DEFAULT_PREFERENCES) {
        if ({}.hasOwnProperty.call(DEFAULT_PREFERENCES, k)) {
            if (cookies[k] !== undefined) {
                hasCookie = true;
                migrated[k] = castPreferenceValue(k, cookies[k]);
            } else {
                migrated[k] = DEFAULT_PREFERENCES[k];
            }
        }
    }

    if (hasCookie && s && typeof s.setItem === 'function') {
        s.setItem(PREF_STORAGE_KEY, JSON.stringify(migrated));
    }

    return migrated;
}

/**
 * Save preferences into storage. Clears draft if auto_save_draft is disabled.
 * @param {Object} prefs Partial or complete preferences to update.
 * @param {Storage} [storage=window.localStorage] Storage implementation.
 * @return {Object} Updated full preferences.
 */
export function savePreferences(prefs, storage) {
    var s = storage !== undefined ? storage : (typeof window !== 'undefined' ? window.localStorage : null);
    var current = loadPreferences(s);
    var updated = Object.assign({}, current);

    if (prefs && typeof prefs === 'object') {
        for (var key in DEFAULT_PREFERENCES) {
            if ({}.hasOwnProperty.call(DEFAULT_PREFERENCES, key) && prefs[key] !== undefined) {
                updated[key] = castPreferenceValue(key, prefs[key]);
            }
        }
    }

    if (s && typeof s.setItem === 'function') {
        s.setItem(PREF_STORAGE_KEY, JSON.stringify(updated));
    }

    if (updated.auto_save_draft === false) {
        clearDraft(s);
    }

    return updated;
}

/**
 * Load draft data from storage if auto_save_draft is enabled.
 * @param {Storage} [storage=window.localStorage] Storage implementation.
 * @return {Object|null} Draft object if present and enabled, else null.
 */
export function loadDraft(storage) {
    var s = storage !== undefined ? storage : (typeof window !== 'undefined' ? window.localStorage : null);
    var prefs = loadPreferences(s);
    if (!prefs.auto_save_draft) {
        return null;
    }

    if (!s || typeof s.getItem !== 'function') {
        return null;
    }

    var raw = s.getItem(DRAFT_STORAGE_KEY);
    if (!raw) {
        return null;
    }

    try {
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
            return null;
        }
        return {
            currentMonth: parsed.currentMonth || DEFAULT_DRAFT.currentMonth,
            deletedHolidays: Array.isArray(parsed.deletedHolidays) ? parsed.deletedHolidays : [],
            customHolidays: Array.isArray(parsed.customHolidays) ? parsed.customHolidays : [],
            presetDuties: Array.isArray(parsed.presetDuties) ? parsed.presetDuties : [],
            presetNonDuties: Array.isArray(parsed.presetNonDuties) ? parsed.presetNonDuties : [],
            generatedDuties: Array.isArray(parsed.generatedDuties) ? parsed.generatedDuties : [],
            customPatterns: (parsed.customPatterns && typeof parsed.customPatterns === 'object') ? parsed.customPatterns : {},
        };
    } catch {
        return null;
    }
}

/**
 * Save draft data into storage if auto_save_draft is enabled.
 * @param {Object} draftData Draft data.
 * @param {Storage} [storage=window.localStorage] Storage implementation.
 * @return {boolean} True if saved, false otherwise.
 */
export function saveDraft(draftData, storage) {
    var s = storage !== undefined ? storage : (typeof window !== 'undefined' ? window.localStorage : null);
    var prefs = loadPreferences(s);
    if (!prefs.auto_save_draft) {
        return false;
    }

    if (!s || typeof s.setItem !== 'function') {
        return false;
    }

    var toSave = Object.assign({}, DEFAULT_DRAFT, draftData);
    s.setItem(DRAFT_STORAGE_KEY, JSON.stringify(toSave));
    return true;
}

/**
 * Clear draft data from storage.
 * @param {Storage} [storage=window.localStorage] Storage implementation.
 */
export function clearDraft(storage) {
    var s = storage !== undefined ? storage : (typeof window !== 'undefined' ? window.localStorage : null);
    if (s && typeof s.removeItem === 'function') {
        s.removeItem(DRAFT_STORAGE_KEY);
    }
}

/**
 * Clear all random-duty storage items and legacy cookies.
 * @param {Storage} [storage=window.localStorage] Storage implementation.
 */
export function clearAllStorage(storage) {
    var s = storage !== undefined ? storage : (typeof window !== 'undefined' ? window.localStorage : null);
    if (s && typeof s.removeItem === 'function') {
        s.removeItem(PREF_STORAGE_KEY);
        s.removeItem(DRAFT_STORAGE_KEY);
    }
    clearLegacyCookies();
}
