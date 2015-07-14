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
