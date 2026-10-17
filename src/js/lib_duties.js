import moment from 'moment';
import { standardDeviation } from './private_functions.js';
import { is_holiday, is_friday, is_weekend } from './lib_holidays.js';

/**
 * Get the duty by a given date.
 * @param {Array} preset_duties The preset duties array.
 * @param {string} date_str The given date.
 * @return {number} The duty on the given date.
 */
export function get_preset_duty(preset_duties, date_str) {
    var duty;
    // preset_duties is an array of [date, duty]
    for (var i = 0; i < preset_duties.length; i++) {
        if (preset_duties[i][0] == date_str) {
            duty = parseInt(preset_duties[i][1]);
            break;
        }
    }
    return duty;
}

/**
 * Get the preset non-duty by a given date.
 * @param {Array} preset_non_duties The preset non duties array.
 * @param {string} date_str The given date.
 * @return {number[]} The non-duties array on the given date.
 */
export function get_preset_non_duties_by_date(preset_non_duties, date_str) {
    var duties = [];
    preset_non_duties.forEach(function(d) {
        if (d[0] == date_str) {
            duties.push(parseInt(d[1]));
        }
    });
    return duties;
}

/**
 * Cound duty pattern.
 * @param {Array} dates The array of dates.
 * @param {Array} preset_holidays The array of preset holidays.
 * @return {number[]} The array of total numbers of Ordinary, Friday, Holiday.
 */
export function count_duty_pattern(dates, preset_holidays) {
    var o_count = 0;
    var f_count = 0;
    var h_count = 0;
    
    dates.forEach(function(date) {
        if (is_weekend(date) || is_holiday(preset_holidays, date)) {
            h_count++;
        } else if (is_friday(preset_holidays, date)) {
            f_count++;
        } else {
            o_count++;
        }
    });
    
    return [o_count, f_count, h_count];
}

/**
 * Calculate group duties status.
 * @param {Array} groups The groups of duty patern.
 * @param {Array} preset_holidays The array of preset holidays.
 * @return {Array} The array of groups.
 */
export function calculate_group_duties_status(groups, preset_holidays) {
    for (var person in groups) {
        if ({}.hasOwnProperty.call(groups, person)) {
            var duty_pattern = count_duty_pattern(groups[person].dates, preset_holidays);
            groups[person].ordinary_count = duty_pattern[0];
            groups[person].friday_count = duty_pattern[1];
            groups[person].holiday_count = duty_pattern[2];
        }
    }
    return groups;
}

/**
 * Calculate group duties.
 * @param {Array} duties The groups of duties.
 * @param {boolean} is_continuous_duties Is or Not continuous duties.
 * @return {Array} The array of groups.
 */
export function calculate_group_duties(duties, is_continuous_duties) {
    // is_continuous_duties is used in worker, reduce moment.js obj to enhance efficiency.
    is_continuous_duties = typeof is_continuous_duties !== 'undefined' ? is_continuous_duties : false;

    var sorted_duties = duties.sort(function(a, b) {
        // return moment(a[0], "YYYY-MM-DD") - moment(b[0], "YYYY-MM-DD")
        return a[0].localeCompare(b[0]);
    }); // sort by date

    var groups = {};
    var total_people = 0;

    var do_group_duties = function(duty, index) {
        var person = duty[1];
        if (groups[person] === undefined) {
            groups[person] = {
                positions: [],
                intervals: [],
                dates: [],
            };
            total_people++;
        }

        if (is_continuous_duties) {
            groups[person].positions.push(index);
        }
        groups[person].dates.push(duty[0]);
        var len = groups[person].dates.length;
        if (len > 1) {
            if (is_continuous_duties) {
                var interval = index - groups[person].positions[len - 2];
            } else {
                var interval = moment(duty[0], 'YYYY-MM-DD').diff(moment(groups[person].dates[len - 2]), 'days');
            }
            groups[person].intervals.push(interval);
        }
    };

    // Use native forEach. Note: forEach callback is (element, index)
    // The original code had (index, element) because of $.each.
    // I swapped arguments in my helper function above, wait.
    // native forEach: (element, index, array)
    // $.each: (index, element)
    // My do_group_duties definition above: function(duty, index). This matches forEach signature!
    sorted_duties.forEach(do_group_duties);

    // calculate standard deviations
    for (var person in groups) {
        if ({}.hasOwnProperty.call(groups, person)) {
            var std_dev = standardDeviation(groups[person].intervals);
            groups[person].std_dev = std_dev;
        }
    }
    return groups;
}

/**
 * Helper to check if event has a specific class.
 * @param {Object} event The event object.
 * @param {string} className The class name to check.
 * @return {boolean} True if event has class.
 */
function event_has_class(event, className) {
    if (!event || !event.className) {
        return false;
    }
    if (Array.isArray(event.className)) {
        return event.className.indexOf(className) > -1;
    }
    if (typeof event.className === 'string') {
        return event.className.split(/\s+/).indexOf(className) > -1;
    }
    return false;
}

/**
 * Check if there is a conflict when dropping an event onto target date's existing events.
 * @param {Object} event The event being dropped (contains title and className).
 * @param {Array} same_day_events The array of existing events on the target date.
 * @return {string|undefined} The conflict message, or undefined if no conflict.
 */
export function get_drop_conflict_status(event, same_day_events) {
    if (!event || !event.title) {
        return;
    }
    var person = parseInt(event.title);
    if (isNaN(person)) {
        return;
    }

    var is_duty = event_has_class(event, 'duty-event') || event_has_class(event, 'preset-duty-event');
    var is_non_duty = event_has_class(event, 'preset-non-duty-event');

    if (!is_duty && !is_non_duty) {
        return;
    }

    if (!same_day_events || !same_day_events.length) {
        return;
    }

    for (var i = 0; i < same_day_events.length; i++) {
        var other_event = same_day_events[i];
        if (!other_event || !other_event.title) {
            continue;
        }
        var other_person = parseInt(other_event.title);
        if (other_person === person) {
            var other_is_duty = event_has_class(other_event, 'duty-event') || event_has_class(other_event, 'preset-duty-event');
            var other_is_non_duty = event_has_class(other_event, 'preset-non-duty-event');

            if (is_duty) {
                if (other_is_duty) {
                    return '人員 ' + person + ' 本日已設為值班！';
                }
                if (other_is_non_duty) {
                    return '人員 ' + person + ' 本日已設為不可值班！';
                }
            } else if (is_non_duty) {
                if (other_is_duty) {
                    return '人員 ' + person + ' 本日已設為值班，不可再設為不值！';
                }
                if (other_is_non_duty) {
                    return '重覆設定不值班人員';
                }
            }
        }
    }
}
