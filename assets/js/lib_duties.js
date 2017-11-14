/* exported get_preset_duty */
/* exported get_preset_non_duties_by_date */
/* exported calculate_group_duties_status */
/* exported calculate_group_duties */

/**
 * Get the duty by a given date.
 * @param {Array} preset_duties The preset duties array.
 * @param {string} date_str The given date.
 * @return {number} The duty on the given date.
 */
function get_preset_duty(preset_duties, date_str) {
    var duty;
    if (is_worker_env()) { // cannot use jquery in web workers
        preset_duties.some(function(d) {
            if (d[0] == date_str) {
                duty = parseInt(d[1]);
                return true;
            }
        });
    } else {
        $.each(preset_duties, function(i, d) {
            if (d[0] == date_str) {
                duty = parseInt(d[1]);
                return true;
            }
        });
    }
    return duty;
}

/**
 * Get the preset non-duty by a given date.
 * @param {Array} preset_non_duties The preset non duties array.
 * @param {string} date_str The given date.
 * @return {number[]} The non-duties array on the given date.
 */
function get_preset_non_duties_by_date(preset_non_duties, date_str) {
    var duties = [];
    if (is_worker_env()) { // cannot use jquery in web workers
        preset_non_duties.forEach(function(d) {
            if (d[0] == date_str) {
                duties.push(parseInt(d[1]));
            }
        });
    } else {
        $.each(preset_non_duties, function(i, d) {
            if (d[0] == date_str) {
                duties.push(parseInt(d[1]));
            }
        });
    }
    return duties;
}

/**
 * Cound duty pattern.
 * @param {Array} dates The array of dates.
 * @param {Array} preset_holidays The array of preset holidays.
 * @return {number[]} The array of total numbers of Ordinary, Friday, Holiday.
 */
function count_duty_pattern(dates, preset_holidays) {
    var o_count = 0;
    var f_count = 0;
    var h_count = 0;
    if (is_worker_env()) { // cannot use jquery in web workers
        dates.forEach(function(date) {
            if (is_weekend(date) || is_holiday(preset_holidays, date)) {
                h_count++;
            } else if (is_friday(preset_holidays, date)) {
                f_count++;
            } else {
                o_count++;
            }
        });
    } else {
        $.each(dates, function(i, date) {
            if (is_weekend(date) || is_holiday(preset_holidays, date)) {
                h_count++;
            } else if (is_friday(preset_holidays, date)) {
                f_count++;
            } else {
                o_count++;
            }
        });
    }
    // console.log("dates: " + dates);
    // console.log("pattern: " + [o_count, f_count, h_count].toString());
    return [o_count, f_count, h_count];
}

/**
 * Calculate group duties status.
 * @param {Array} groups The groups of duty patern.
 * @param {Array} preset_holidays The array of preset holidays.
 * @return {Array} The array of groups.
 */
function calculate_group_duties_status(groups, preset_holidays) {
    for (person in groups) {
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
function calculate_group_duties(duties, is_continuous_duties) {
    // is_continuous_duties is used in worker, reduce moment.js obj to enhance efficiency.
    is_continuous_duties = typeof is_continuous_duties !== 'undefined' ? is_continuous_duties : false;

    var sorted_duties = duties.sort(function(a, b) {
        // return moment(a[0], "YYYY-MM-DD") - moment(b[0], "YYYY-MM-DD")
        return a[0].localeCompare(b[0]);
    }); // sort by date

    // cannot use $.map or Array.map
    var duties_simple_array = [];
    for (var i = 0; i < sorted_duties.length; i++) {
        duties_simple_array.push(sorted_duties[i]);
    }

    var groups = {};
    var total_people = 0;

    var do_group_duties = function(arg1, arg2) {
        var index;
        var duty;
        if (is_worker_env()) { // cannot use jquery in web workers
            index = arg2;
            duty = arg1;
        } else {
            index = arg1;
            duty = arg2;
        }

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

    if (is_worker_env()) { // cannot use jquery in web workers
        sorted_duties.forEach(do_group_duties);
    } else {
        $.each(sorted_duties, do_group_duties);
    }

    // calculate standard deviations
    for (person in groups) {
        if ({}.hasOwnProperty.call(groups, person)) {
            // console.log(groups[person].intervals);
            var std_dev = standardDeviation(groups[person].intervals);
            groups[person].std_dev = std_dev;
            // console.log(person + ": " + std_dev);
        }
    }
    return groups;
}
