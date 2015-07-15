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

function calculate_group_duties(duties) {
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

        groups[person].positions.push(index);
        groups[person].dates.push(duty[0]);
        var pos_len = groups[person].positions.length;
        if (pos_len > 1) {
            var interval = index - groups[person].positions[pos_len - 2];
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
