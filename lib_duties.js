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
