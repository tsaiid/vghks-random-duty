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
        if (get_preset_duty(presets.duties, the_date) === undefined) {
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
    var use_std_dev_level = filters.use_std_dev_level;
    var std_dev_level = filters.std_dev_level;

    if (has_continuous_duties(group_duties)) {
        return false;
    }

    if (use_qod_limit && !less_than_qod_times(group_duties, qod_limit)) {
        return false;
    }

    if (use_std_dev_level && !less_than_std_dev_level(group_duties, std_dev_level)) {
        return false;
    }

    return true;
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
        //        console.log(non_preset_duties.toString());
        var merged_duties = non_preset_duties.concat(presets.duties);
        //        console.log(has_continuous_duties(merged_duties));
        var group_duties = calculate_group_duties(merged_duties, true);
        if (is_match_non_duties(merged_duties, presets.non_duties) && is_match_filters(merged_duties, group_duties, filters)) {
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
