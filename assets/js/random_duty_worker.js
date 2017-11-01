importScripts(
    '../../vendor/js/moment.min.js',
    'private_functions.js',
    'lib_duties.js',
    'lib_holidays.js',
    'lib_filters.js'
);

var ENABLE_CONDITIONING = true;
var TEST_CONDITIONING_FUNCTION = false;

onmessage = function(oEvent) {
    var presets = oEvent.data["presets"];
    var since_date_str = oEvent.data["since_date_str"];
    var total_days = oEvent.data["total_days"];
    var filters = oEvent.data["filters"];

    var result = random_duty(total_days, since_date_str, presets, filters);

    postMessage({
        "status": result.status,
        "msg": result.msg,
        "duties": result.duties,
        "groups": result.groups
    });
};

function generate_non_preset_duty_match_patterns(total_days, since_date_str, presets, patterns) {
    var non_preset_duties = {
        ordinary: [],
        friday: [],
        holiday: []
    };

    //console.log(preset_duties.toString());

    var tmp_duties_ordinary = [],
        tmp_duties_friday = [],
        tmp_duties_holiday = [];
    var groups = calculate_group_duties_status(calculate_group_duties(presets.duties, false), presets.holidays);
    patterns.forEach(function(pattern, index) {
        var person_no = index + 1;
        var residual_count = 0;
        residual_count = (groups[person_no] !== undefined && groups[person_no].ordinary_count !== undefined ? pattern[0] - groups[person_no].ordinary_count : pattern[0]);
        for (var i = 0; i < residual_count; i++) {
            tmp_duties_ordinary.push(person_no);
        }
        residual_count = (groups[person_no] !== undefined && groups[person_no].friday_count !== undefined ? pattern[1] - groups[person_no].friday_count : pattern[1]);
        for (var i = 0; i < residual_count; i++) {
            tmp_duties_friday.push(person_no);
        }
        residual_count = (groups[person_no] !== undefined && groups[person_no].holiday_count !== undefined ? pattern[2] - groups[person_no].holiday_count : pattern[2]);
        for (var i = 0; i < residual_count; i++) {
            tmp_duties_holiday.push(person_no);
        }
    });

    var since_date = moment(since_date_str, "YYYY-MM-DD");
    for (i = 0; i < total_days; i++) {
        var the_date = since_date.format("YYYY-MM-DD");
        if (get_preset_duty(presets.duties, the_date) === undefined) {
            if (is_holiday(presets.holidays, the_date) || is_weekend(the_date)) {
                duty = tmp_duties_holiday.pop();
                non_preset_duties.holiday.push([the_date, duty]);
            } else if (is_friday(presets.holidays, the_date)) {
                duty = tmp_duties_friday.pop();
                non_preset_duties.friday.push([the_date, duty]);
            } else {
                duty = tmp_duties_ordinary.pop();
                non_preset_duties.ordinary.push([the_date, duty]);
            }
        }
        since_date.add(1, 'days');
    }

    if (tmp_duties_ordinary.length > 0 || tmp_duties_friday.length > 0 || tmp_duties_holiday.length > 0) {
        console.log("tmp_duties should not more than zero.");
    }

    //console.log(non_preset_duties.toString());

    return non_preset_duties;
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
    for (date_type in date_duties) {
        var duties = date_duties[date_type].map(function(d) {
            return d[1]
        });
        shuffle(duties);
        date_duties[date_type].forEach(function(d, i) {
            d[1] = duties[i];
        });
    }
    return date_duties;
}

function is_match_non_duties(merged_duties, preset_non_duties) {
    var len = preset_non_duties.length;
    for (var i = 0; i < len; i++) {
        var non_duty_date_str = preset_non_duties[i][0];
        var non_duty_person = preset_non_duties[i][1];
        if (get_preset_duty(merged_duties, non_duty_date_str) == non_duty_person) {
            //console.log(non_duty_person + "can not be duty on: " + non_duty_date_str);
            return false;
        }
    }
    return true;
}

function is_match_filters(merged_duties, group_duties, filters) {
    var use_qod_limit = filters.use_qod_limit;
    var qod_limit = filters.qod_limit;

    if (has_continuous_duties(group_duties)) {
        return false;
    }

    if (use_qod_limit && !less_than_qod_times(group_duties, qod_limit)) {
        return false;
    }

    return true;
}

function merge_preset_non_preset_duties(preset_duties, non_preset_duties) {
    var merged_duties = preset_duties;
    for (date_type in non_preset_duties) {
        merged_duties = merged_duties.concat(non_preset_duties[date_type]);
    }
    return merged_duties;
}

function random_duty(total_days, since_date_str, presets, filters) {
    var patterns = filters.patterns;

    var status = "success",
        msg = "",
        duties = [],
        groups = {};
    var non_preset_duties = generate_non_preset_duty_match_patterns(total_days, since_date_str, presets, patterns);
    var c = 0;
    while (1) {
        shuffle_duties(non_preset_duties);
        //console.log(non_preset_duties.toString());
        var merged_duties = merge_preset_non_preset_duties(presets.duties, non_preset_duties);
        //console.log(has_continuous_duties(merged_duties));
        var group_duties = calculate_group_duties(merged_duties, true);
        if (is_match_non_duties(merged_duties, presets.non_duties) && is_match_filters(merged_duties, group_duties, filters)) {
            duties = merged_duties;
            groups = group_duties;
            break;
        }

        if (TEST_CONDITIONING_FUNCTION) {
            msg = "test conditioning function. run only once. ";
            //status = "test";
            duties = merged_duties;
            groups = group_duties;
            //console.log(merged_duties.toString());
            //console.log(group_duties);
            //console.log(patterns.toString());
            break;
        }

        c++;
        if (!(c % 1000)) {
            var block_ui_message = "Randomizing time: " + c + ". Still running.";
            //console.log(block_ui_message);
            postMessage({
                "status": "running",
                "msg": block_ui_message,
            });
        }

        if (c > 999999) {
            status = "fail";
            msg = "Run time more than 1000000. May be no suitable resolutions.";
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
