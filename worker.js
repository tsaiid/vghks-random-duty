importScripts('https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.10.3/moment.min.js', 'private_functions.js');

var ENABLE_CONDITIONING = true;

onmessage = function(oEvent) {
    //console.log("patterns: " + oEvent.data["patterns"]);
    //console.log("holidays: " + oEvent.data["holidays"]);
    //console.log("preset_duties: " + oEvent.data["preset_duties"][2015][7][15]);
    var patterns = oEvent.data["patterns"];
    var preset_holidays = oEvent.data["preset_holidays"];
    var preset_duties = oEvent.data["preset_duties"];
    var since_date_str = oEvent.data["since_date_str"];
    var total_days = oEvent.data["total_days"];
    var duties;
    var c = 0;

    var status = "success";
    var msg;
    while (!(duties = random_duty(total_days, since_date_str, preset_duties, patterns))) {
        c++;
        if (!(c % 10000)) {
            console.log("run time: " + c + ". Still running.");
        }

        if (c > 999999) {
            msg = "run time: " + c + ". More than 1000000.";
            status = "fail";
            break;
        }
    }

    postMessage({ "status": status, "msg": msg, "duties": duties});
};

function get_preset_duty(preset_duties, y, m, d) {
    var date = moment([y, m, d]);
    var year = date.year();
    var month = date.month();
    var day = date.date();
    if (preset_duties[year] !== undefined && preset_duties[year][month] !== undefined && preset_duties[year][month][day] !== undefined) {
        //console.log([year, month, day, preset_duties[year][month][day]].join(', '));
        return parseInt(preset_duties[year][month][day]);
    }
    return undefined;
}

function random_duty(total_days, since_date_str, preset_duties, patterns) {
    var duties = [];
    var since_date = moment(since_date_str);
    var year = since_date.year();
    var month = since_date.month();
    for (i = 0; i < total_days; i++) {
        var duty = get_preset_duty(preset_duties, year, month, i + 1);
        if (duty === undefined) {
            duty = randomIntFromInterval(1, 4);
        }
        duties.push(duty);
    }

    var positions = {};
    for (i = 1; i <= 4; i++) {
        positions[i] = duties.multiIndexOf(i);

        // check if fit duty counts.
        if (ENABLE_CONDITIONING) {
            var pattern_t_count = patterns[i - 1][0] + patterns[i - 1][1] + patterns[i - 1][2];
            if (positions[i].length != pattern_t_count) {
                return false;
            }
        }
    }

    var intervals = {};
    var max = duties.length - 1;
    for (i = 1; i <= 4; i++) {
        intervals[i] = [];
        for (j = 0, pos = -1; j < positions[i].length; j++) {
            if (pos > -1)
                intervals[i].push(positions[i][j] - pos);
            pos = positions[i][j];
        }
        if (ENABLE_CONDITIONING) {
            if (intervals[i].indexOf(1) >= 0)
                return false; // 不可連值
        }
    }
    //$('#intervals').html(interval1.join(', '));
    //console.log(intervals);

    std_devs = {};
    for (i = 1; i <= 4; i++) {
        std_devs[i] = standardDeviation(intervals[i]);
    }
    for (i = 1; i <= 4; i++) {
        if (ENABLE_CONDITIONING) {
            // set level of standard deviation.
            if (std_devs[i] > 1.8)
                return false;
        }
    }
    //$('#std_dev').html(std_dev);
    //console.log(std_devs);

    //    var ent1 = shannon.entropy(interval1.join());
    //var ent1 = entropy(interval1);
    //$('#entropy').html();

    console.log(positions);
    console.log(intervals);
    console.log(std_devs);

    return duties;
};
