import { describe, it, expect } from 'vitest';
import {
    get_preset_duty,
    get_preset_non_duties_by_date,
    count_duty_pattern,
    calculate_group_duties,
    calculate_group_duties_status,
    get_drop_conflict_status,
} from '../src/js/lib_duties.js';

describe('lib_duties', () => {
    describe('get_preset_duty', () => {
        const presets = [
            ['2026-10-01', '1'],
            ['2026-10-02', 2],
            ['2026-10-05', '3'],
        ];

        it('應回傳指定日期的指定值班人員代號（數值型態）', () => {
            expect(get_preset_duty(presets, '2026-10-01')).toBe(1);
            expect(get_preset_duty(presets, '2026-10-02')).toBe(2);
        });

        it('當日期未在預設班表清單中時應回傳 undefined', () => {
            expect(get_preset_duty(presets, '2026-10-03')).toBeUndefined();
        });
    });

    describe('get_preset_non_duties_by_date', () => {
        const nonDuties = [
            ['2026-10-01', '1'],
            ['2026-10-01', '2'],
            ['2026-10-02', '3'],
        ];

        it('應回傳特定日期所有不值班人員代號陣列', () => {
            expect(get_preset_non_duties_by_date(nonDuties, '2026-10-01')).toEqual([1, 2]);
            expect(get_preset_non_duties_by_date(nonDuties, '2026-10-02')).toEqual([3]);
        });

        it('當特定日期無不值班紀錄時應回傳空陣列', () => {
            expect(get_preset_non_duties_by_date(nonDuties, '2026-10-03')).toEqual([]);
        });
    });

    describe('count_duty_pattern', () => {
        it('應正確統計平日班、週五班與假日班天數', () => {
            // 2026-10-05 (週一, 平日)
            // 2026-10-06 (週二, 平日)
            // 2026-10-09 (週五, 週五班)
            // 2026-10-10 (週六, 週末假日)
            // 2026-10-12 (週一, 設為國定假日)
            const dates = [
                '2026-10-05',
                '2026-10-06',
                '2026-10-09',
                '2026-10-10',
                '2026-10-12',
            ];
            const presetHolidays = ['2026-10-12'];

            const [ordinary, friday, holiday] = count_duty_pattern(dates, presetHolidays);
            expect(ordinary).toBe(2); // 10-05, 10-06
            expect(friday).toBe(1);   // 10-09
            expect(holiday).toBe(2);  // 10-10 (週末), 10-12 (國定假日)
        });
    });

    describe('calculate_group_duties', () => {
        it('應能將班表依人員分組並計算班距與標準差', () => {
            // 未照日期排序傳入，驗證內部是否會正確依日期字串排序
            const duties = [
                ['2026-10-07', 'Alice'],
                ['2026-10-01', 'Alice'],
                ['2026-10-04', 'Alice'],
                ['2026-10-02', 'Bob'],
                ['2026-10-05', 'Bob'],
            ];

            const groups = calculate_group_duties(duties);

            // Alice: 10-01, 10-04, 10-07 -> 間隔為 3 天, 3 天
            expect(groups['Alice'].dates).toEqual(['2026-10-01', '2026-10-04', '2026-10-07']);
            expect(groups['Alice'].intervals).toEqual([3, 3]);
            expect(groups['Alice'].std_dev).toBe(0);

            // Bob: 10-02, 10-05 -> 間隔為 3 天
            expect(groups['Bob'].dates).toEqual(['2026-10-02', '2026-10-05']);
            expect(groups['Bob'].intervals).toEqual([3]);
            expect(groups['Bob'].std_dev).toBe(0);
        });

        it('支援 is_continuous_duties 模式（用於 Worker 高效計算模式）', () => {
            const duties = [
                ['2026-10-01', 'Alice'], // index 0
                ['2026-10-02', 'Bob'],   // index 1
                ['2026-10-03', 'Alice'], // index 2
            ];

            const groups = calculate_group_duties(duties, true);
            expect(groups['Alice'].positions).toEqual([0, 2]);
            expect(groups['Alice'].intervals).toEqual([2]); // index 2 - index 0 = 2
        });
    });

    describe('calculate_group_duties_status', () => {
        it('應為每位人員填入 ordinary_count, friday_count 與 holiday_count', () => {
            const groups = {
                'Alice': {
                    dates: ['2026-10-05', '2026-10-09', '2026-10-10'], // 週一、週五、週六
                },
            };
            const presetHolidays = [];

            const result = calculate_group_duties_status(groups, presetHolidays);
            expect(result['Alice'].ordinary_count).toBe(1);
            expect(result['Alice'].friday_count).toBe(1);
            expect(result['Alice'].holiday_count).toBe(1);
        });
    });

    describe('get_drop_conflict_status', () => {
        it('當拖曳值班事件且目標日該人員已排定值班時應回傳警告', () => {
            const dropEvent = { title: '1', className: ['duty-event'] };
            const sameDayEvents = [
                { title: '1', className: ['duty-event'] },
            ];
            expect(get_drop_conflict_status(dropEvent, sameDayEvents)).toBe('人員 1 本日已設為值班！');

            const sameDayPreset = [
                { title: '1', className: 'preset-duty-event' },
            ];
            expect(get_drop_conflict_status(dropEvent, sameDayPreset)).toBe('人員 1 本日已設為值班！');
        });

        it('當拖曳值班事件且目標日該人員已設為不值班時應回傳不可值班警告', () => {
            const dropEvent = { title: '2', className: ['preset-duty-event'] };
            const sameDayEvents = [
                { title: '2 不值', className: ['preset-non-duty-event'] },
            ];
            expect(get_drop_conflict_status(dropEvent, sameDayEvents)).toBe('人員 2 本日已設為不可值班！');
        });

        it('當拖曳不值班事件且目標日該人員已有值班時應回傳警告', () => {
            const dropEvent = { title: '3 不值', className: ['preset-non-duty-event'] };
            const sameDayEvents = [
                { title: '3', className: ['duty-event'] },
            ];
            expect(get_drop_conflict_status(dropEvent, sameDayEvents)).toBe('人員 3 本日已設為值班，不可再設為不值！');
        });

        it('當拖曳不值班事件且目標日該人員已重複設定不值時應回傳警告', () => {
            const dropEvent = { title: '4 不值', className: ['preset-non-duty-event'] };
            const sameDayEvents = [
                { title: '4 不值', className: ['preset-non-duty-event'] },
            ];
            expect(get_drop_conflict_status(dropEvent, sameDayEvents)).toBe('重覆設定不值班人員');
        });

        it('當目標日為其他人值班或無衝突時應回傳 undefined 允許拖曳', () => {
            const dropEvent = { title: '1', className: ['duty-event'] };
            const sameDayEvents = [
                { title: '2', className: ['duty-event'] },
                { title: '3 不值', className: ['preset-non-duty-event'] },
                { title: '假日 國慶日', className: ['gcal-holiday'] },
            ];
            expect(get_drop_conflict_status(dropEvent, sameDayEvents)).toBeUndefined();
            expect(get_drop_conflict_status(dropEvent, [])).toBeUndefined();
        });

        it('當事件無效或非排班事件時應回傳 undefined', () => {
            expect(get_drop_conflict_status(null, [])).toBeUndefined();
            expect(get_drop_conflict_status({ title: '假日 國慶日', className: ['gcal-holiday'] }, [])).toBeUndefined();
        });
    });
});

