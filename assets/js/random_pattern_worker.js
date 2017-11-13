importScripts(
    '../../vendor/js/moment.min.js',
    'lib_holidays.js'
);

onmessage = function(oEvent) {
    var start_date = oEvent.data['start_date'];
    var month_span = oEvent.data['month_span'];
    var people = oEvent.data['people'];
    var preset_holidays = oEvent.data['preset_holidays'];

    var result = get_suggested_patterns(start_date, month_span, people, preset_holidays);

    postMessage({
        'status': result.status,
        'msg': result.msg,
        'patterns': result.patterns,
    });
};

/**
 * Get suggested patterns
 * @param {Object} start_date The moment.js object of start date.
 * @param {number} month_span One or two months.
 * @param {number} people How many people are involved in the pattern.
 * @param {Array} preset_holidays The array of preset holidays.
 * @return {Array} The 2x2 array of random pattern generated.
 */
function get_suggested_patterns(start_date, month_span, people, preset_holidays) {
    var end_date = start_date.clone().add(month_span, 'months');

    var holiday_count = 0;
    var friday_count = 0;
    var ordinary_count = 0;
    var the_day = start_date;
    while (the_day.format() != end_date.format()) {
        var the_day_str = the_day.format('YYYY-MM-DD');
        if (is_weekend(the_day_str) || is_holiday(preset_holidays, the_day_str)) {
            holiday_count++;
        } else if (is_friday(preset_holidays, the_day_str)) {
            friday_count++;
        } else {
            ordinary_count++;
        }
        the_day.add(1, 'days');
    }
    // console.log(ordinary_count);
    // console.log(friday_count);
    // console.log(holiday_count);

    var c = 0;
    var status = 'success';
    var msg = '';
    var patterns;
    while (!(patterns = random_pattern(people, ordinary_count, friday_count, holiday_count))) {
        c++;
        if (!(c % 1000)) {
            console.log('run time: ' + c + '. Still running.');
        }
        if (c > 999999) {
            console.log('run time: ' + c + '. More than 1000000.');
            status = 'fail';
            msg = 'run time: ' + c + '. More than 1000000.';
            break;
        }
    }
    console.log('rander pattern run time: ' + c);
    // console.log(patterns.toString());
    return {
        status: status,
        msg: msg,
        patterns: patterns,
    };
}

/**
 * Do random pattern
 * @param {number} people The number of people to be random.
 * @param {number} ordinary_count How many ordinary days.
 * @param {number} friday_count How many fridays.
 * @param {number} holiday_count How many holidays.
 * @return {Array} The 2x2 array of random pattern generated.
 */
function random_pattern(people, ordinary_count, friday_count, holiday_count) {
    var friday_duties = [];
    var holiday_duties = [];
    while (friday_duties.length < friday_count) {
        friday_duties.push(randomIntFromInterval(1, people));
    }
    while (holiday_duties.length < holiday_count) {
        holiday_duties.push(randomIntFromInterval(1, people));
    }

    var patterns = [];
    for (i = 1; i <= people; i++) {
        var o_count;
        var f_count = friday_duties.multiIndexOf(i).length;
        var h_count = holiday_duties.multiIndexOf(i).length;

        if (ENABLE_PATTERN_CONDITIONING) {
            var total_points = 2 * holiday_count + 1 * friday_count;
            var points = 2 * h_count + 1 * f_count;
            if (points < total_points / people - 1 || points > total_points / people + 1) {
                return false;
            }

            o_count = parseInt(ordinary_count / people);
        }

        patterns.push([o_count, f_count, h_count]);
    }

    var residual_ordinary_count = ordinary_count % people;
    if (residual_ordinary_count != 0) {
        patterns = patterns.sort(function(a, b) {
            return (a[2] * 2 + a[1]) - (b[2] * 2 + b[1]);
        });
        for (i = 0; i < residual_ordinary_count; i++) {
            patterns[i][0]++;
        }
    }

    return patterns;
}
