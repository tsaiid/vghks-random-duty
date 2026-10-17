import { describe, it, expect } from 'vitest';
import {
    less_than_qod_times,
    has_continuous_duties,
    prepare_week_hours_context,
    calculate_person_week_hours,
    less_than_max_week_hours
} from '../src/js/lib_filters.js';

describe('lib_filters', () => {
    describe('less_than_qod_times', () => {
        it('當所有人隔日班 (QOD, 間隔為2) 次數皆小於或等於門檻時應回傳 true', () => {
            const groupDuties = {
                'Alice': { intervals: [3, 4, 3] }, // 0 次 QOD
                'Bob': { intervals: [2, 4, 2] },   // 2 次 QOD
            };

            expect(less_than_qod_times(groupDuties, 2)).toBe(true);
            expect(less_than_qod_times(groupDuties, 3)).toBe(true);
        });

        it('若有任何一人 QOD 次數大於門檻時應回傳 false', () => {
            const groupDuties = {
                'Alice': { intervals: [3, 4] },
                'Bob': { intervals: [2, 2, 2] }, // 3 次 QOD
            };

            expect(less_than_qod_times(groupDuties, 2)).toBe(false);
        });

        it('門檻值為字串型態時亦能正確轉換與判斷', () => {
            const groupDuties = {
                'Alice': { intervals: [2, 2] }, // 2 次 QOD
            };

            expect(less_than_qod_times(groupDuties, '1')).toBe(false);
            expect(less_than_qod_times(groupDuties, '2')).toBe(true);
        });
    });

    describe('has_continuous_duties', () => {
        it('當有任何連續值班（間隔為 1 天）時應回傳 true', () => {
            const groupDuties = {
                'Alice': { intervals: [3, 1, 4] },
                'Bob': { intervals: [3, 4] },
            };

            expect(has_continuous_duties(groupDuties)).toBe(true);
        });

        it('當完全無連續值班（所有間隔皆 >= 2）時應回傳 false', () => {
            const groupDuties = {
                'Alice': { intervals: [2, 3, 4] },
                'Bob': { intervals: [3, 3, 5] },
            };

            expect(has_continuous_duties(groupDuties)).toBe(false);
        });

        it('當 intervals 為空陣列時應回傳 false', () => {
            const groupDuties = {
                'Alice': { intervals: [] },
            };

            expect(has_continuous_duties(groupDuties)).toBe(false);
        });
    });

    describe('calculate_person_week_hours & prepare_week_hours_context', () => {
        it('能正確計算基準工作日與計入 PM off 後的週工時', () => {
            // 2026-10-01 為週四
            // 第 0 週（10/01~10/04）：週四、週五上班 -> 16 小時基準
            // 第 1 週（10/05~10/11）：週一至週五上班 -> 40 小時基準
            const context = prepare_week_hours_context('2026-10-01', 31, [], true);
            expect(context.baseline_week_hours[0]).toBe(16);
            expect(context.baseline_week_hours[1]).toBe(40);

            // 測試同仁於 10/05 (週一) 與 10/10 (週六) 值班
            // 10/05 (週一)：平日班 +16h，隔天 10/06 為平日 PM off -4h -> 淨增 12h
            // 10/10 (週六)：假日班 +24h，隔天 10/11 為週日無 PM off -> 淨增 24h
            // 第 1 週工時：
            // 未計 PM Off: 40 + 16 + 24 = 80h
            // 計入 PM Off: 40 + 12 + 24 = 76h
            const res = calculate_person_week_hours(['2026-10-05', '2026-10-10'], context);
            expect(res.week_hours[1]).toBe(80);
            expect(res.week_hours_pm_off[1]).toBe(76);
        });

        it('若值班隔日為國定假日，不重複扣除 PM off', () => {
            // 假設 10/09 為國定假日
            // 10/08 (週四) 值班：平日班 +16h，隔日 10/09 為假日，無 PM off 扣除 -> 淨增 16h
            const context = prepare_week_hours_context('2026-10-01', 31, ['2026-10-09'], true);
            // 第 1 週基準：10/05~10/08 (4 天平日) -> 32h
            expect(context.baseline_week_hours[1]).toBe(32);

            const res = calculate_person_week_hours(['2026-10-08'], context);
            expect(res.week_hours_pm_off[1]).toBe(32 + 16);
        });
    });

    describe('less_than_max_week_hours', () => {
        const options = {
            since_date_str: '2026-10-01',
            total_days: 31,
            preset_holidays: [],
            use_pm_off: true,
        };

        it('當所有人每週工時皆小於或等於門檻時應回傳 true', () => {
            // Alice 在第 1 週 (10/05~10/11) 值班 10/05 (平日, +12h) 與 10/10 (假日, +24h) -> 40 + 36 = 76h
            const groupDuties = {
                'Alice': { dates: ['2026-10-05', '2026-10-10'] },
                'Bob': { dates: ['2026-10-06'] }, // 40 + 12 = 52h
            };

            expect(less_than_max_week_hours(groupDuties, 80, options)).toBe(true);
            expect(less_than_max_week_hours(groupDuties, '80', options)).toBe(true);
        });

        it('當有任何一人每週工時超過門檻時應回傳 false', () => {
            // Alice 在第 1 週值 10/05 (平日, +12h), 10/07 (平日, +12h), 10/10 (假日, +24h) -> 40 + 48 = 88h
            const groupDuties = {
                'Alice': { dates: ['2026-10-05', '2026-10-07', '2026-10-10'] },
                'Bob': { dates: ['2026-10-06'] },
            };

            expect(less_than_max_week_hours(groupDuties, 80, options)).toBe(false);
            // 但如果門檻是 88 小時則合法
            expect(less_than_max_week_hours(groupDuties, 88, options)).toBe(true);
        });

        it('傳入預先計算之 context 應與傳入 options 行為完全一致', () => {
            const context = prepare_week_hours_context('2026-10-01', 31, [], true);
            const groupDuties = {
                'Alice': { dates: ['2026-10-05', '2026-10-07', '2026-10-10'] },
            };

            expect(less_than_max_week_hours(groupDuties, 80, context)).toBe(false);
            expect(less_than_max_week_hours(groupDuties, 88, context)).toBe(true);
        });

        it('空陣列或無值班日期時應回傳 true', () => {
            expect(less_than_max_week_hours({}, 80, options)).toBe(true);
            expect(less_than_max_week_hours({ 'Alice': { dates: [] } }, 80, options)).toBe(true);
        });

        it('雙月模式（61 天）跨月情境能正確判定週工時', () => {
            // 2026-10-01 至 2026-11-30（共 61 天）
            const twoMonthContext = prepare_week_hours_context('2026-10-01', 61, ['2026-10-10'], true);
            const groupDuties = {
                'Alice': {
                    dates: [
                        '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26',
                        '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23'
                    ]
                },
                'Bob': {
                    dates: [
                        '2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27',
                        '2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24'
                    ]
                }
            };
            expect(less_than_max_week_hours(groupDuties, 80, twoMonthContext)).toBe(true);
        });

        it('高頻呼叫效能測試：10,000 次候選排班驗證應於極短時間內完成', () => {
            const context = prepare_week_hours_context('2026-10-01', 31, [], true);
            const candidateSchedule = {
                '1': { dates: ['2026-10-01', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'] },
                '2': { dates: ['2026-10-02', '2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27'] },
                '3': { dates: ['2026-10-03', '2026-10-07', '2026-10-14', '2026-10-21', '2026-10-28'] },
                '4': { dates: ['2026-10-04', '2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29'] },
            };

            const startTime = performance.now();
            let passCount = 0;
            for (let i = 0; i < 10000; i++) {
                if (less_than_max_week_hours(candidateSchedule, 80, context)) {
                    passCount++;
                }
            }
            const elapsed = performance.now() - startTime;
            expect(passCount).toBe(10000);
            expect(elapsed).toBeLessThan(500); // 10,000 次檢查應於 500ms 內完成（通常只要 20~40ms）
        });
    });
});


