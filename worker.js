importScripts('https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.10.3/moment.min.js', 'private_functions.js');

onmessage = function(oEvent) {
    //console.log("patterns: " + oEvent.data["patterns"]);
    //console.log("holidays: " + oEvent.data["holidays"]);
    //console.log("preset_duties: " + oEvent.data["preset_duties"][2015][7][15]);
    var patterns = oEvent.data["patterns"];
    var preset_holidays = oEvent.data["preset_holidays"];
    var preset_duties = oEvent.data["preset_duties"];
    var since_date_str = oEvent.data["since_date_str"];
    var total_days = oEvent.data["total_days"];
    var duties = random_duty(total_days, since_date_str, preset_duties, patterns);
    postMessage(duties);
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
    }
    return duties;
};
