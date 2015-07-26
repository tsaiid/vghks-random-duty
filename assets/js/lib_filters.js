function less_than_qod_times(group_duties, qod_limit) {
    for (var person in group_duties) {
        var qod_times = group_duties[person].intervals.multiIndexOf(2).length;
        if (qod_times > parseInt(qod_limit)) {
            // console.log("qod_times: " + qod_times + ", intervals: " + group_duties[person].intervals.toString());
            return false;
        }
    }

    return true;
}

function has_continuous_duties(group_duties) {
    for (var person in group_duties) {
        var qd_times = group_duties[person].intervals.multiIndexOf(1).length;
        if (qd_times > 0) {
            //console.log("qd_times: " + qd_times + ", intervals: " + group_duties[person].intervals.toString());
            return true;
        }
    }
    return false;
}