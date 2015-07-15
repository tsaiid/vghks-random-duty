importScripts(
    'https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.10.3/moment.min.js',
    'private_functions.js',
    'lib_duties.js',
    'lib_holidays.js'
);

var ENABLE_CONDITIONING = true;
var TEST_CONDITIONING_FUNCTION = false;

onmessage = function(oEvent) {
    //console.log("patterns: " + oEvent.data["patterns"]);
    //console.log("holidays: " + oEvent.data["holidays"]);
    //console.log("preset_duties: " + oEvent.data["preset_duties"][2015][7][15]);
    var patterns = oEvent.data["patterns"];
    var preset_holidays = oEvent.data["preset_holidays"];
    var preset_duties = oEvent.data["preset_duties"];
    var since_date_str = oEvent.data["since_date_str"];
    var total_days = oEvent.data["total_days"];

    var result = random_duty(total_days, since_date_str, preset_duties, preset_holidays, patterns);

    postMessage({
        "status": result.status,
        "msg": result.msg,
        "duties": result.duties,
        "groups": result.groups
    });
};

function count_duty_pattern(duty_dates, preset_holidays) {
    var since_date = moment(since_date_str, "YYYY-MM-DD");
    var year = since_date.year();
    var month = since_date.month();
    var ordinary_count = 0,
        friday_count = 0,
        holiday_count = 0;

    duty_days.forEach(function(day) {
        var the_day_str = moment([year, month, day]).format("YYYY-MM-DD");
        if (is_weekend(the_day_str) || is_holiday(preset_holidays, the_day_str)) {
            holiday_count++;
        } else if (is_friday(preset_holidays, the_day_str)) {
            friday_count++;
        } else {
            ordinary_count++;
        }
    });

    return [ordinary_count, friday_count, holiday_count];
}

function is_duties_match_counts(duties, counts, people) {
    for (i = 1; i <= people; i++) {
        var random_ordinary_count = duties.filter(function(d) {
            return d[1] == i
        }).length;
        if (random_ordinary_count != counts[i - 1]) {
            //console.log(duties.toString());
            //console.log(i + ": " + random_ordinary_count);
            //console.log(counts[i - 1]);
            //console.log(duties.toString());
            return false;
        }
    }
    return true;
}

function generate_non_preset_duty_match_patterns(total_days, since_date_str, preset_duties, preset_holidays, patterns) {
    var people = 4;
    var non_preset_duties = [];

    //console.log(preset_duties.toString());

    var tmp_duties = [];
    patterns.forEach(function(pattern, person_no) {
        for (var i = 0; i < pattern[0]; i++) {
            tmp_duties.push(person_no + 1);
        }
    });

    var since_date = moment(since_date_str, "YYYY-MM-DD");
    for (i = 0; i < total_days; i++) {
        var the_date = since_date.format("YYYY-MM-DD");
        if (get_preset_duty(preset_duties, the_date) === undefined) {
            duty = tmp_duties.pop();
            non_preset_duties.push([the_date, duty]);
        }
        since_date.add(1, 'days');
    }

    if (tmp_duties.length > 0) {
        console.log("tmp_duties should not more than zero.");
    }

    //console.log(non_preset_duties.toString());

    return non_preset_duties;
}

function has_continuous_duties(duties) {
    var sorted_duties = duties.sort(function(a, b) {
        //return moment(a[0], "YYYY-MM-DD") - moment(b[0], "YYYY-MM-DD")
        return a[0].localeCompare(b[0])
    }); // sort by date
    var len = sorted_duties.length;
    for (var i = 0; i < len; i++) {
        if (sorted_duties[i + 1] !== undefined && sorted_duties[i][1] == sorted_duties[i + 1][1]) {
            return true;
        }
    }
    return false;
}

function less_than_std_dev_level(group_duties, std_dev_level) {
    for (var person in group_duties) {
        if (group_duties[person].std_dev > std_dev_level) {
            return false;
        }
    }

    return true;
}

function shuffle(array) {
    var counter = array.length,
        temp, index;

    // While there are elements in the array
    while (counter > 0) {
        // Pick a random index
        index = Math.floor(Math.random() * counter);

        // Decrease counter by 1
        counter--;

        // And swap the last element with it
        temp = array[counter];
        array[counter] = array[index];
        array[index] = temp;
    }

    return array;
}

function shuffle_duties(date_duties) {
    var duties = date_duties.map(function(d) {
        return d[1]
    });
    shuffle(duties);
    date_duties.forEach(function(d, i) {
        d[1] = duties[i];
    });
    return date_duties;
}

function random_duty(total_days, since_date_str, preset_duties, preset_holidays, patterns) {
    var std_dev_level = 2;
    var since_date = moment(since_date_str, "YYYY-MM-DD");

    var status = "success",
        msg = "",
        duties = [],
        groups = {};
    var non_preset_duties = generate_non_preset_duty_match_patterns(total_days, since_date_str, preset_duties, preset_holidays, patterns);
    var c = 0;
    while (1) {
        shuffle_duties(non_preset_duties);
//        console.log(non_preset_duties.toString());
        var merged_duties = non_preset_duties.concat(preset_duties);
//        console.log(has_continuous_duties(merged_duties));
        var group_duties = calculate_group_duties(merged_duties);
        if (!has_continuous_duties(merged_duties) && less_than_std_dev_level(group_duties, std_dev_level)) {
            duties = merged_duties;
            groups = group_duties;
            break;
        }

        if (TEST_CONDITIONING_FUNCTION) {
            msg = "test conditioning function. run only once. ";
            status = "test";
//            console.log(merged_duties.toString());
//            console.log(group_duties);
//            console.log(patterns.toString());
            break;
        }

        c++;
        if (!(c % 100)) {
            console.log("run time: " + c + ". Still running.");
        }

        if (c > 999999) {
            status = "fail";
            msg = "has_continuous_duties, less_than_std_dev_level run time: " + c + ". More than 1000000.";
            break;
        }
    }

    return {
        status: status,
        msg: msg,
        duties: duties,
        groups: groups
    };
};
