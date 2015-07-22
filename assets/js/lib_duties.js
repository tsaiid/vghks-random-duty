function get_preset_duty(preset_duties, date_str) {
    var duty;
    preset_duties.some(function(d) {
        if (d[0] == date_str) {
            duty = parseInt(d[1]);
            return true;
        }
    });
    return duty;
}

function get_preset_non_duties_by_date(preset_non_duties, date_str) {
    var duties = [];
    preset_non_duties.forEach(function(d) {
        if (d[0] == date_str) {
            duties.push(parseInt(d[1]));
        }
    });
    return duties;
}

function count_duty_pattern(dates, preset_holidays) {
    var o_count = 0,
        f_count = 0,
        h_count = 0;
    dates.forEach(function(date) {
        if (is_weekend(date) || is_holiday(preset_holidays, date)) {
            h_count++;
        } else if (is_friday(preset_holidays, date)) {
            f_count++;
        } else {
            o_count++;
        }
    });
    //console.log("dates: " + dates);
    //console.log("pattern: " + [o_count, f_count, h_count].toString());
    return [o_count, f_count, h_count];
}

function calculate_group_duties_status(groups, preset_holidays) {
    for (var person in groups) {
        var duty_pattern = count_duty_pattern(groups[person].dates, preset_holidays);
        groups[person].ordinary_count = duty_pattern[0];
        groups[person].friday_count = duty_pattern[1];
        groups[person].holiday_count = duty_pattern[2];
    }
    return groups;
}

function calculate_group_duties(duties, is_continuous_duties) {
    // is_continuous_duties is used in worker, reduce moment.js obj to enhance efficiency.
    is_continuous_duties = typeof is_continuous_duties !== 'undefined' ? is_continuous_duties : false;

    var sorted_duties = duties.sort(function(a, b) {
        //return moment(a[0], "YYYY-MM-DD") - moment(b[0], "YYYY-MM-DD")
        return a[0].localeCompare(b[0])
    }); // sort by date
    var duties_simple_array = sorted_duties.map(function(d) {
        return d[1]
    });

    var groups = {};
    var total_people = 0;
    sorted_duties.forEach(function(duty, index) {
        var person = duty[1];
        if (groups[person] === undefined) {
            groups[person] = {
                positions: [],
                intervals: [],
                dates: []
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
                var interval = moment(duty[0], "YYYY-MM-DD").diff(moment(groups[person].dates[len - 2]), 'days');
            }
            groups[person].intervals.push(interval);
        }
    });

    // calculate standard deviations
    for (var person in groups) {
        //console.log(groups[person].intervals);
        var std_dev = standardDeviation(groups[person].intervals);
        groups[person].std_dev = std_dev;
        //console.log(person + ": " + std_dev);
    }
    return groups;
}
