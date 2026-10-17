import moment from 'moment';
import { multiIndexOf } from './private_functions.js';
import { is_holiday, is_weekend } from './lib_holidays.js';

/**
 * Precompute weekly baseline work hours and date information for fast week work hours evaluation.
 * @param {string} since_date_str Start date string (YYYY-MM-DD)
 * @param {number} total_days Number of days
 * @param {Array} [preset_holidays=[]] Array of holiday date strings
 * @param {boolean} [use_pm_off=true] Whether to apply PM Off deduction
 * @return {Object} Context containing baseline_week_hours, date_info_map, and total_weeks
 */
export function prepare_week_hours_context(since_date_str, total_days, preset_holidays = [], use_pm_off = true) {
    preset_holidays = preset_holidays || [];
    var start_date = moment(since_date_str, 'YYYY-MM-DD');
    var end_date = start_date.clone().add(total_days, 'days');
    var view_start_date = start_date.clone().startOf('isoWeek');

    var total_weeks = Math.floor(moment.duration(end_date.diff(view_start_date)).asWeeks());
    var baseline_week_hours = [];
    for (var i = 0; i <= total_weeks; i++) {
        baseline_week_hours[i] = 0;
    }

    var date_info_map = {};

    for (var cur = start_date.clone(); cur < end_date; cur.add(1, 'day')) {
        var date_str = cur.format('YYYY-MM-DD');
        var week_no = Math.floor(moment.duration(cur.diff(view_start_date)).asWeeks());
        var is_hol = is_holiday(preset_holidays, date_str);
        var is_wknd = is_weekend(date_str);

        // Baseline: 8 hours for non-holiday weekdays
        if (!is_hol && !is_wknd) {
            baseline_week_hours[week_no] += 8;
        }

        // Duty hours: 24 hours for holiday/weekend, 16 hours for regular weekday
        var duty_hours = (is_hol || is_wknd) ? 24 : 16;

        // PM off deduction: 4 hours if next day is a non-holiday weekday
        var next_date = cur.clone().add(1, 'day');
        var next_date_str = next_date.format('YYYY-MM-DD');
        var next_is_hol = is_holiday(preset_holidays, next_date_str);
        var next_is_wknd = is_weekend(next_date_str);
        var pm_off_deduction = (!next_is_hol && !next_is_wknd) ? 4 : 0;

        date_info_map[date_str] = {
            week_no: week_no,
            duty_hours: duty_hours,
            pm_off_deduction: pm_off_deduction,
        };
    }

    return {
        baseline_week_hours: baseline_week_hours,
        date_info_map: date_info_map,
        total_weeks: total_weeks,
        use_pm_off: use_pm_off,
        since_date_str: since_date_str,
        total_days: total_days,
        preset_holidays: preset_holidays,
    };
}

/**
 * Calculate weekly work hours and PM off weekly work hours for a person's duty dates.
 * @param {string[]} dates Array of duty date strings (YYYY-MM-DD).
 * @param {Object} [options={}] Context or configuration options.
 * @return {Object} Object with week_hours and week_hours_pm_off arrays.
 */
export function calculate_person_week_hours(dates, options = {}) {
    var context;
    if (options && options.baseline_week_hours && options.date_info_map) {
        context = options;
    } else {
        var preset_holidays = options.preset_holidays || [];
        var since_date_str = options.since_date_str;
        var total_days = options.total_days;

        if (!since_date_str || !total_days) {
            if (dates && dates.length > 0) {
                var sorted = dates.slice().sort();
                var min_m = moment(sorted[0], 'YYYY-MM-DD').startOf('month');
                var max_m = moment(sorted[sorted.length - 1], 'YYYY-MM-DD').endOf('month');
                since_date_str = since_date_str || min_m.format('YYYY-MM-DD');
                total_days = total_days || max_m.diff(min_m, 'days') + 1;
            } else {
                return { week_hours: [], week_hours_pm_off: [] };
            }
        }
        context = prepare_week_hours_context(since_date_str, total_days, preset_holidays, true);
    }

    var week_hours = context.baseline_week_hours.slice();
    var week_hours_pm_off = context.baseline_week_hours.slice();

    if (dates && dates.length > 0) {
        for (var i = 0; i < dates.length; i++) {
            var info = context.date_info_map[dates[i]];
            if (info) {
                week_hours[info.week_no] += info.duty_hours;
                week_hours_pm_off[info.week_no] += (info.duty_hours - info.pm_off_deduction);
            }
        }
    }

    return {
        week_hours: week_hours,
        week_hours_pm_off: week_hours_pm_off,
    };
}

/**
 * Check if group_duties are within the max weekly work hours limit.
 * @param {Object} group_duties The duties grouped by person.
 * @param {number|string} max_hours The maximum allowed weekly work hours.
 * @param {Object|Array} [options={}] Options object or preset_holidays array.
 * @return {boolean} True if all persons' weekly work hours are <= max_hours, false otherwise.
 */
export function less_than_max_week_hours(group_duties, max_hours, options = {}) {
    var max_limit = parseInt(max_hours, 10);
    if (isNaN(max_limit)) {
        return true;
    }

    var context;
    if (options && options.baseline_week_hours && options.date_info_map) {
        context = options;
    } else {
        var preset_holidays = [];
        var since_date_str;
        var total_days;
        var use_pm_off = true;

        if (Array.isArray(options)) {
            preset_holidays = options;
            since_date_str = arguments[3];
            total_days = arguments[4];
            if (arguments[5] !== undefined) {
                use_pm_off = arguments[5];
            }
        } else if (typeof options === 'object') {
            preset_holidays = options.preset_holidays || [];
            since_date_str = options.since_date_str;
            total_days = options.total_days;
            if (options.use_pm_off !== undefined) {
                use_pm_off = options.use_pm_off;
            }
        }

        if (!since_date_str || !total_days) {
            var all_dates = [];
            for (var p in group_duties) {
                if ({}.hasOwnProperty.call(group_duties, p) && group_duties[p].dates) {
                    all_dates = all_dates.concat(group_duties[p].dates);
                }
            }
            if (all_dates.length === 0) {
                return true;
            }
            all_dates.sort();
            var min_m = moment(all_dates[0], 'YYYY-MM-DD').startOf('month');
            var max_m = moment(all_dates[all_dates.length - 1], 'YYYY-MM-DD').endOf('month');
            since_date_str = since_date_str || min_m.format('YYYY-MM-DD');
            total_days = total_days || max_m.diff(min_m, 'days') + 1;
        }

        context = prepare_week_hours_context(since_date_str, total_days, preset_holidays, use_pm_off);
    }

    var baseline = context.baseline_week_hours;
    var date_info = context.date_info_map;
    var use_pm_off = context.use_pm_off !== undefined ? context.use_pm_off : true;

    for (var person in group_duties) {
        if ({}.hasOwnProperty.call(group_duties, person)) {
            var dates = group_duties[person].dates;
            if (!dates || dates.length === 0) {
                continue;
            }

            var person_week_hours = baseline.slice();

            for (var i = 0; i < dates.length; i++) {
                var d_str = dates[i];
                var info = date_info[d_str];
                if (info) {
                    var hours_to_add = info.duty_hours - (use_pm_off ? info.pm_off_deduction : 0);
                    person_week_hours[info.week_no] += hours_to_add;
                }
            }

            for (var w = 0; w < person_week_hours.length; w++) {
                if (person_week_hours[w] > max_limit) {
                    return false;
                }
            }
        }
    }

    return true;
}

/**
 * Check if group_duties are within the QOD limit or not.
 * @param {Object[]} group_duties The duties grouped.
 * @param {number} qod_limit The second number.
 * @return {boolean} The sum of the two numbers.
 */
export function less_than_qod_times(group_duties, qod_limit) {
    for (var person in group_duties) {
        if ({}.hasOwnProperty.call(group_duties, person)) {
            var qod_times = multiIndexOf(group_duties[person].intervals, 2).length;
            if (qod_times > parseInt(qod_limit)) {
                // console.log("qod_times: " + qod_times + ", intervals: " + group_duties[person].intervals.toString());
                return false;
            }
        }
    }

    return true;
}

/**
 * Check if group_duties have continuous duties or not.
 * @param {Object[]} group_duties The duties grouped.
 * @return {boolean} has or has no continuous duties.
 */
export function has_continuous_duties(group_duties) {
    for (var person in group_duties) {
        if ({}.hasOwnProperty.call(group_duties, person)) {
            var qd_times = multiIndexOf(group_duties[person].intervals, 1).length;
            if (qd_times > 0) {
                // console.log("qd_times: " + qd_times + ", intervals: " + group_duties[person].intervals.toString());
                return true;
            }
        }
    }
    return false;
}