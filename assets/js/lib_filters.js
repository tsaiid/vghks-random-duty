/* exported less_than_qod_times */
/* exported has_continuous_duties */

/**
 * Check if group_duties are within the QOD limit or not.
 * @param {Object[]} group_duties The duties grouped.
 * @param {number} qod_limit The second number.
 * @return {boolean} The sum of the two numbers.
 */
function less_than_qod_times(group_duties, qod_limit) {
    for (person in group_duties) {
        if ({}.hasOwnProperty.call(group_duties, person)) {
            var qod_times = group_duties[person].intervals.multiIndexOf(2).length;
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
function has_continuous_duties(group_duties) {
    for (person in group_duties) {
        if ({}.hasOwnProperty.call(group_duties, person)) {
            var qd_times = group_duties[person].intervals.multiIndexOf(1).length;
            if (qd_times > 0) {
                // console.log("qd_times: " + qd_times + ", intervals: " + group_duties[person].intervals.toString());
                return true;
            }
        }
    }
    return false;
}
