import moment from 'moment';

/**
 * Check if the date is a holiday or not by comparing the presets.
 * @param {Array} preset_holidays The array of preset holidays.
 * @param {string} date_str The date to be checked.
 * @return {boolean} is or not a holiday.
 */
export function is_holiday(preset_holidays, date_str) {
    return preset_holidays.indexOf(date_str) > -1;
}

/**
 * Check if the date is a holiday or not by comparing the presets.
 * @param {Array} preset_holidays The array of preset holidays.
 * @param {string} the_day_str The date to be checked.
 * @return {boolean} is or not a friday.
 */
export function is_friday(preset_holidays, the_day_str) {
    var the_day = moment(the_day_str);
    var next_day_str = the_day.clone().add(1, 'days').format('YYYY-MM-DD');
    return (the_day.isoWeekday() === 5 && !is_holiday(preset_holidays, the_day_str)) || is_holiday(preset_holidays, next_day_str);
}

/**
 * Check if the date is Saterday/Sunday or not.
 * @param {string} the_day_str The date to be checked.
 * @return {boolean} is or not a weekend.
 */
export function is_weekend(the_day_str) {
    var the_day = moment(the_day_str);
    return (the_day.isoWeekday() === 6 || the_day.isoWeekday() === 7);
}