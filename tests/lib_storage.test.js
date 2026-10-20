import { describe, it, expect, beforeEach } from 'vitest';
import {
    PREF_STORAGE_KEY,
    DRAFT_STORAGE_KEY,
    DEFAULT_PREFERENCES,
    loadPreferences,
    savePreferences,
    loadDraft,
    saveDraft,
    clearDraft,
    clearAllStorage,
    parseLegacyCookies,
    deduplicateDutyPairs,
    deduplicateCustomHolidays,
} from '../src/js/lib_storage.js';

class MockStorage {
    constructor() {
        this.store = {};
    }
    getItem(key) {
        return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
    }
    setItem(key, value) {
        this.store[key] = String(value);
    }
    removeItem(key) {
        delete this.store[key];
    }
    clear() {
        this.store = {};
    }
}

describe('lib_storage', () => {
    let mockStorage;

    beforeEach(() => {
        mockStorage = new MockStorage();
    });

    describe('loadPreferences & savePreferences', () => {
        it('在無任何紀錄時應回傳預設偏好設定', () => {
            const prefs = loadPreferences(mockStorage);
            expect(prefs).toEqual(DEFAULT_PREFERENCES);
            expect(prefs.mode_switch).toBe(false);
            expect(prefs.inputPeopleSlider).toBe(4);
            expect(prefs.auto_save_draft).toBe(true);
        });

        it('能正常更新並儲存偏好設定', () => {
            const updated = savePreferences({
                mode_switch: true,
                inputPeopleSlider: 6,
                use_qod_limit: false,
            }, mockStorage);

            expect(updated.mode_switch).toBe(true);
            expect(updated.inputPeopleSlider).toBe(6);
            expect(updated.use_qod_limit).toBe(false);
            // 未更動欄位應維持原預設值
            expect(updated.inputWeekHoursLimitSlider).toBe(80);

            // 再次載入驗證持久化
            const reloaded = loadPreferences(mockStorage);
            expect(reloaded).toEqual(updated);
        });

        it('儲存時應確保型別正確轉換', () => {
            savePreferences({
                mode_switch: 'true',
                inputPeopleSlider: '8',
                inputQodLimitSlider: '2',
            }, mockStorage);

            const reloaded = loadPreferences(mockStorage);
            expect(reloaded.mode_switch).toBe(true);
            expect(reloaded.inputPeopleSlider).toBe(8);
            expect(reloaded.inputQodLimitSlider).toBe(2);
        });
    });

    describe('排班草稿自動存檔 (loadDraft & saveDraft)', () => {
        const sampleDraft = {
            currentMonth: '2026-11-01',
            presetDuties: [['2026-11-01', 1]],
            presetNonDuties: [['2026-11-02', 2]],
            generatedDuties: [['2026-11-03', 3]],
            customHolidays: [{ id: 'h1', date: '2026-11-12', title: '自訂假日' }],
            deletedHolidays: ['h2'],
            customPatterns: { '2026-11_1_4': [[5, 1, 2]] },
        };

        it('當 auto_save_draft 為 true 時可正常存取排班草稿', () => {
            // 預設 auto_save_draft 為 true
            const saved = saveDraft(sampleDraft, mockStorage);
            expect(saved).toBe(true);

            const loaded = loadDraft(mockStorage);
            expect(loaded).not.toBeNull();
            expect(loaded.currentMonth).toBe('2026-11-01');
            expect(loaded.presetDuties).toEqual([['2026-11-01', 1]]);
            expect(loaded.customHolidays).toEqual([{ id: 'h1', date: '2026-11-12', title: '自訂假日' }]);
        });

        it('當 auto_save_draft 切換為 false 時應自動清除草稿且禁止寫入', () => {
            // 先儲存草稿
            saveDraft(sampleDraft, mockStorage);
            expect(loadDraft(mockStorage)).not.toBeNull();

            // 關閉自動暫存開關
            savePreferences({ auto_save_draft: false }, mockStorage);

            // 草稿應被自動清除，且 loadDraft 回傳 null
            expect(loadDraft(mockStorage)).toBeNull();
            expect(mockStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull();

            // 嘗試再次寫入草稿應被阻擋並回傳 false
            const saved = saveDraft(sampleDraft, mockStorage);
            expect(saved).toBe(false);
            expect(loadDraft(mockStorage)).toBeNull();
        });

        it('clearDraft 能獨立清除草稿而不影響偏好設定', () => {
            savePreferences({ inputPeopleSlider: 5 }, mockStorage);
            saveDraft(sampleDraft, mockStorage);

            clearDraft(mockStorage);
            expect(loadDraft(mockStorage)).toBeNull();

            // 偏好設定依然保留
            expect(loadPreferences(mockStorage).inputPeopleSlider).toBe(5);
        });

        it('saveDraft 與 loadDraft 應自動去除重複的值班與自訂假日資料', () => {
            const draftWithDuplicates = {
                currentMonth: '2026-11-01',
                presetDuties: [
                    ['2026-11-01', 1],
                    ['2026-11-01', 1], // 重複
                    ['2026-11-02', 2],
                ],
                presetNonDuties: [
                    ['2026-11-03', 3],
                    ['2026-11-03', 3], // 重複
                ],
                generatedDuties: [
                    ['2026-11-04', 4],
                    ['2026-11-04', 4], // 重複
                    ['2026-11-05', 1],
                ],
                customHolidays: [
                    { id: 'h1', date: '2026-11-12', title: '自訂假日' },
                    { id: 'h1', date: '2026-11-12', title: '自訂假日' }, // 重複 ID
                ],
                deletedHolidays: ['del1', 'del1'], // 重複
            };

            saveDraft(draftWithDuplicates, mockStorage);
            const loaded = loadDraft(mockStorage);

            expect(loaded.presetDuties).toEqual([
                ['2026-11-01', 1],
                ['2026-11-02', 2],
            ]);
            expect(loaded.presetNonDuties).toEqual([
                ['2026-11-03', 3],
            ]);
            expect(loaded.generatedDuties).toEqual([
                ['2026-11-04', 4],
                ['2026-11-05', 1],
            ]);
            expect(loaded.customHolidays).toEqual([
                { id: 'h1', date: '2026-11-12', title: '自訂假日' },
            ]);
            expect(loaded.deletedHolidays).toEqual(['del1']);
        });

        it('loadDraft 能修復 storage 中舊有的重複草稿資料', () => {
            // 模擬已受污染的舊草稿 JSON 字串直接存在 storage
            const rawDirtyJson = JSON.stringify({
                currentMonth: '2026-11-01',
                generatedDuties: [
                    ['2026-11-01', 1],
                    ['2026-11-01', 1],
                    ['2026-11-02', 2],
                    ['2026-11-02', 2],
                ],
            });
            mockStorage.setItem(DRAFT_STORAGE_KEY, rawDirtyJson);

            const loaded = loadDraft(mockStorage);
            expect(loaded.generatedDuties).toEqual([
                ['2026-11-01', 1],
                ['2026-11-02', 2],
            ]);
        });
    });

    describe('clearAllStorage', () => {
        it('能完整清除偏好設定與草稿資料', () => {
            savePreferences({ inputPeopleSlider: 7 }, mockStorage);
            saveDraft({ currentMonth: '2026-12-01' }, mockStorage);

            expect(mockStorage.getItem(PREF_STORAGE_KEY)).not.toBeNull();
            expect(mockStorage.getItem(DRAFT_STORAGE_KEY)).not.toBeNull();

            clearAllStorage(mockStorage);

            expect(mockStorage.getItem(PREF_STORAGE_KEY)).toBeNull();
            expect(mockStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull();

            // 再次讀取時應重置為預設偏好
            expect(loadPreferences(mockStorage)).toEqual(DEFAULT_PREFERENCES);
            expect(loadDraft(mockStorage)).toBeNull();
        });
    });

    describe('Cookie 向下相容遷移', () => {
        it('parseLegacyCookies 應正確解析 cookie 字串', () => {
            const raw = 'mode_switch=true; inputPeopleSlider=5; use_qod_limit=false';
            const parsed = parseLegacyCookies(raw);
            expect(parsed.mode_switch).toBe('true');
            expect(parsed.inputPeopleSlider).toBe('5');
            expect(parsed.use_qod_limit).toBe('false');
        });

        it('首次啟動且 localStorage 無紀錄時應自 Cookie 讀取並遷移至 Storage', () => {
            const legacyCookieStr = 'mode_switch=true; inputPeopleSlider=5; use_qod_limit=false';

            const prefs = loadPreferences(mockStorage, legacyCookieStr);
            expect(prefs.mode_switch).toBe(true);
            expect(prefs.inputPeopleSlider).toBe(5);
            expect(prefs.use_qod_limit).toBe(false);

            // 驗證已寫入 mockStorage
            expect(mockStorage.getItem(PREF_STORAGE_KEY)).not.toBeNull();
            const stored = JSON.parse(mockStorage.getItem(PREF_STORAGE_KEY));
            expect(stored.inputPeopleSlider).toBe(5);
        });
    });
});
