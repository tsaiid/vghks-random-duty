function is_holiday(preset_holidays, date_str) {
    var _is_holiday = preset_holidays.some(function(holiday) {
        if (holiday === date_str) {
            return true;
        }
    });
    return _is_holiday;
}
