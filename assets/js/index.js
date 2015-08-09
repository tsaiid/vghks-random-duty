$(function() {
    //
    // flags
    //
    var ENABLE_CONDITIONING = true;
    var ENABLE_PATTERN_CONDITIONING = true;

    //
    // global vars
    //
    var is_cal1_loaded = false;
    var is_cal2_loaded = false; // may only be used in 2-month mode
    var is_cal1_all_rendered = false;
    var is_cal2_all_rendered = false;
    var deleted_holidays = []; // cache deleted gcal-holiday that will not be rendered again.
    var is_already_random_duty = false; // bool: record if random_duty executed.

    $('#vghks_mode_switch').bootstrapSwitch({
        onText: "先假日",
        offText: "一般",
        offColor: 'info',
        onSwitchChange: function(event, state) {
            Cookies.set('vghks_mode_switch', state);
        }
    });

    $('#mode_switch').bootstrapSwitch({
        onText: "2 月",
        offText: "1 月",
        offColor: 'info',
        onSwitchChange: function(event, state) {
            //console.log(state); // true | false
            Cookies.set('mode_switch', state);
            if (state) { // 2-month mode
                is_cal2_all_rendered = false;
                $('.first_cal').toggleClass('col-sm-6', state, 600).promise().done(function() {
                    $('.second_cal').show();
                    if (!is_cal2_loaded) {
                        $('#cal2').fullCalendar('render'); // force render the cal, needed for from hidden div
                    } else {
                        $('#cal2').fullCalendar('render'); // force render the cal, needed for from hidden div
                        $('#cal2').fullCalendar('rerenderEvents'); // force re-render cal2, to update suggested patterns
                    }
                });
            } else { // 1-month mode
                is_cal1_all_rendered = false;
                $('.second_cal').hide();
                $('.first_cal').toggleClass('col-sm-6', state, 600).promise().done(function() {
                    $('#cal1').fullCalendar('rerenderEvents'); // force re-render cal1, to update suggested patterns
                });
            }
            wait_and_update_suggested_patterns();
        }
    });

    $('#inputQodLimitSlider').slider({
        max: 4,
        min: 0,
        value: 1,
        change: function(event, ui) {
            Cookies.set('inputQodLimitSlider', ui.value);
        }
    }).slider("pips", {
        rest: "label"
    });

    $('#inputStdDevSlider').slider({
        max: 2,
        min: 1,
        step: 0.1,
        value: 1.8,
        change: function(event, ui) {
            Cookies.set('inputStdDevSlider', ui.value);
        }
    }).slider("pips", {
        rest: "label",
        step: 2
    });

    $('#inputPeopleSlider').slider({
        max: 9,
        min: 3,
        value: 4,
        create: update_dialog_title_type,
        change: function(event, ui) {
            update_patterns();
            update_dialog_title_type();
            Cookies.set('inputPeopleSlider', ui.value);
        },
    }).slider("pips", {
        rest: "label"
    });

    //
    // Update Cookie Preferences
    //
    $('#use_qod_limit, #use_std_dev_level').change(function() {
        Cookies.set($(this).attr('id'), $(this).is(':checked'));
    });

    $.blockUI.defaults.growlCSS.top = '60px'; // show below the nav bar.
    $.blockUI.defaults.growlCSS.opacity = 0.8;

    function myGrowlUI(status, msg) {
        var className = "growlUI " + status.toLowerCase();
        $.growlUI(status, msg);
        $('div.growlUI').attr('class', className); // use class to control background image
    }

    function get_calendar_height() {
        return $(window).height() - 300;
    }

    function check_if_has_same_non_duty(preset_non_duties, date, person) {
        var len = preset_non_duties.length;
        for (var i = 0; i < len; i++) {
            var non_duty_date_str = preset_non_duties[i][0];
            var non_duty_person = preset_non_duties[i][1];
            if (non_duty_date_str == date && non_duty_person == person) {
                return true;
            }
        }
        return false;
    }

    //
    // Dialog related
    //
    // Dialog for insert new event
    function get_duty_conflict_status(title, orig_title, is_edit_dialog, duty_type, prev_set_duty, prev_set_non_duties, already_had_duty) {
        var status;
        if (is_edit_dialog) {
            if (duty_type == "eventPropNonduty") {
                if ($.inArray(parseInt(title), prev_set_non_duties) > -1) {
                    status = "重覆設定不值班人員";
                } else if (prev_set_duty == title && title != orig_title) {
                    status = "人員 " + title + " 本日已設為值班，不可再設為不值！";
                }
            } else if (duty_type == "eventPropDuty") {
                if (already_had_duty) {
                    if (title == prev_set_duty && title != orig_title) {
                        status = "本日已有人值班";
                    } else if (title != prev_set_duty && title == orig_title) {
                        status = "本日已有人值班";
                    } else if ($.inArray(parseInt(title), prev_set_non_duties) > -1) {
                        status = "人員 " + title + " 本日已設為不可值班！";
                    }
                } else {
                    if ($.inArray(parseInt(title), prev_set_non_duties) > -1) {
                        if (title != orig_title) {
                            status = "人員 " + title + " 本日已設為不可值班！";
                        }
                    }
                }
            }
        } else {
            if (duty_type == "eventPropNonduty") {
                if ($.inArray(parseInt(title), prev_set_non_duties) > -1) {
                    status = "重覆設定不值班人員";
                }
                if (prev_set_duty == title) {
                    status = "人員 " + title + " 本日已設為值班，不可再設為不值！";
                }
            } else if (duty_type == "eventPropDuty") {
                if (already_had_duty) {
                    status = "本日已有人值班";
                } else if ($.inArray(parseInt(title), prev_set_non_duties) > -1) {
                    status = "人員 " + title + " 本日已設為不可值班！";
                }
            }
        }

        return status;
    }

    function save_or_update_event(is_edit_dialog) {
        var title = $('#eventTitle').val();
        var orig_title = $('#eventOrigTitle').val();
        var date = $('#eventStart').val();

        if ($('#eventTitle').val() !== '') {
            var preset_duties = get_preset_duties();
            var preset_non_duties = get_preset_non_duties();
            var duty_type = $('input[name=eventProp]:checked').val();
            var prev_set_duty = get_preset_duty(preset_duties, date);
            var prev_set_non_duties = get_preset_non_duties_by_date(preset_non_duties, date);
            var already_had_duty = (prev_set_duty !== undefined);
            var has_same_non_duty = check_if_has_same_non_duty(preset_non_duties, date, title);

            var duty_conflict_status = get_duty_conflict_status(title, orig_title, is_edit_dialog, duty_type, prev_set_duty, prev_set_non_duties, already_had_duty);
            if (!duty_conflict_status) {
                if (is_edit_dialog) {
                    // have to remove old and add new
                    $("#cal1").fullCalendar('removeEvents', $('#eventId').val());
                    $("#cal2").fullCalendar('removeEvents', $('#eventId').val());
                }

                var className, color, eventTitle;
                switch (duty_type) {
                    case "eventPropDuty":
                        className = 'preset-duty-event';
                        color = duty_colors[title];
                        eventTitle = title;
                        break;
                    case "eventPropNonduty":
                        className = 'preset-non-duty-event';
                        color = non_duty_color;
                        eventTitle = ' ' + title + ' 不值'; // add a space for sort first
                        break;
                    default: // eventPropHoliday
                        className = 'gcal-holiday';
                        color = "";
                        eventTitle = '  假日 ' + title; // add two spaces for sort first
                }
                // remove event.id already in the cache
                var event_md5_id = CryptoJS.MD5(date + eventTitle).toString();
                deleted_holidays = deleted_holidays.filter(function(e) {
                    return e != event_md5_id
                });
                var event = {
                    id: event_md5_id,
                    title: eventTitle,
                    start: date,
                    allDay: true,
                    className: className,
                    color: color,
                };
                $("#cal1").fullCalendar('renderEvent', event, true);
                $("#cal2").fullCalendar('renderEvent', event, true);

                // Holiday should add a background event
                if (duty_type == "eventPropHoliday") {
                    var event = {
                        id: event_md5_id,
                        start: date,
                        backgroundColor: holiday_bg_color,
                        rendering: 'background',
                        className: 'gcal-holiday-background'
                    };
                    $("#cal1").fullCalendar('renderEvent', event, true);
                    $("#cal2").fullCalendar('renderEvent', event, true);

                    // update suggested patterns
                    calculate_suggested_patterns();
                }
            } else {
                myGrowlUI("Warning", duty_conflict_status);
            }
        }
        $("#cal1").fullCalendar('unselect');
        $("#cal2").fullCalendar('unselect');
    }

    // default set dialog select options by people number
    // or set to input text for Holiday event
    function update_dialog_title_type(duty_type) {
        var title_html;
        if (duty_type == 'eventPropHoliday') {
            title_html = '<input type="text" class="form-control" id="eventTitle" />';
        } else {
            var people = parseInt($('#inputPeopleSlider').slider("option", "value"));
            title_html = '<select type="text" class="form-control" name="eventTitle" id="eventTitle">';
            for (var i = 1; i <= people; i++) {
                title_html += '<option>' + i + '</option>';
            }
            title_html += '</select>';
        }
        $('#eventTitle').replaceWith(title_html);
    }

    $('#calEventDialog').dialog({
        resizable: false,
        autoOpen: false,
        width: 400,
        modal: true,
    });

    $('input[name=eventProp]').change(function() {
        var duty_type = $(this).val();
        if (duty_type != 'eventPropHoliday') {
            var orig_duty_val = parseInt($('#eventTitle').val()) || parseInt($('#eventOrigTitle').val()) || 1;
        }
        update_dialog_title_type(duty_type);
        if (duty_type != 'eventPropHoliday') {
            $('#eventTitle').val(orig_duty_val);
        }
    });

    function WarningDialog(msg) {
        BootstrapDialog.show({
            type: BootstrapDialog.TYPE_WARNING,
            title: 'Warning',
            message: msg,
            buttons: [{
                label: 'Close',
                action: function(dialogItself) {
                    dialogItself.close();
                }
            }],
        });
    }

    //
    // FullCalendar related
    //
    // common calendar options and callback functions
    var currMonth = moment();
    var nextMonth = moment().add(1, 'months');
    var nextTwoMonth = moment().add(2, 'months');
    var calGoogleCalendarApiKey = 'AIzaSyCutCianVgUaWaCHeTDMk2VzyZ8bcNUdOY';
    var calEventSources = [{
        googleCalendarId: 'taiwan__zh-TW@holiday.calendar.google.com',
        backgroundColor: "#f5dfe2",
        rendering: 'background',
        className: 'gcal-holiday-background'
    }, {
        googleCalendarId: 'taiwan__zh-TW@holiday.calendar.google.com',
        className: 'gcal-holiday',
        editable: true,
        eventDataTransform: function(rawEventData) { // drop url from google cal
            return {
                id: rawEventData.id,
                title: '  假日 ' + rawEventData.title, // prepend two spaces to be sort first.
                start: rawEventData.start,
                end: rawEventData.end,
                className: 'gcal-holiday'
            };
        }
    }];
    var calDayClick = function(date, jsEvent, view) {
        $('#eventStart').val(date.format("YYYY-MM-DD"));

        // set ui dialog
        $("#calEventDialog").dialog("option", "title", "Add Duty");
        $("#calEventDialog").dialog("option", "buttons", {
            '新增': function() {
                save_or_update_event(false);
                $(this).dialog('close');
            },
            '取消': function() {
                $(this).dialog('close');
            }
        });
        $('#calEventDialog').dialog('open');
    };
    var calEventClick = function(calEvent, jsEvent, view) {
        $('#eventStart').val(calEvent.start.format("YYYY-MM-DD"));
        $('#eventId').val(calEvent.id);
        var title, duty_type;
        if (calEvent.title.indexOf("  假日 ") > -1) {
            $('#eventPropHoliday').prop("checked", true);
            title = calEvent.title.split("  假日 ")[1]; // trim for a space prepend to non-duty
            duty_type = 'eventPropHoliday';
        } else if (calEvent.title.indexOf(" 不值") > -1) {
            $('#eventPropNonduty').prop("checked", true);
            title = calEvent.title.trim().split(" 不值")[0]; // trim for a space prepend to non-duty
            duty_type = 'eventPropNonduty';
        } else {
            $('#eventPropDuty').prop("checked", true);
            title = calEvent.title;
            duty_type = 'eventPropDuty';
        }
        update_dialog_title_type(duty_type);
        $('#eventTitle').val(title);
        $('#eventOrigTitle').val(title);

        // set ui dialog
        $("#calEventDialog").dialog("option", "title", "Edit Duty");
        $("#calEventDialog").dialog("option", "buttons", {
            '更新': function() {
                save_or_update_event(true);
                $(this).dialog("close");
            },
            '刪除': function() {
                $("#cal1").fullCalendar('removeEvents', $('#eventId').val());
                $("#cal2").fullCalendar('removeEvents', $('#eventId').val());
                if (duty_type == 'eventPropHoliday') {
                    calculate_suggested_patterns();
                    deleted_holidays.push($('#eventId').val());
                }
                $(this).dialog("close");
            },
            '取消': function() {
                $(this).dialog('close');
            }
        });
        $("#calEventDialog").dialog('open');
    };
    var calEventDrop = function(event, delta, revertFunc, jsEvent, ui, view) {
        // holiday can not be dragged and dropped. only can be deleted or created.
        if ($.inArray('gcal-holiday', event.className) > -1) {
            myGrowlUI('Error', '不可移動假日，請使用刪除功能');
            revertFunc();
        }

        // both calendars should sync
        var other_cal = (view == $('#cal1').fullCalendar('getView')) ? $('#cal2') : $('#cal1');
        other_cal.fullCalendar('removeEvents', event.id); // id only suitable for preset-duty-event

        var other_event = {
            id: event.id,
            title: event.title,
            start: event.start,
            allDay: true,
            className: event.className,
            color: event.color,
        };

        other_cal.fullCalendar('renderEvent', other_event, true);
    };
    var myEventRender = function(event, element, view) {
        // show events only in visible areas.
        if (event.start.month() != view.intervalStart.month()) {
            return false;
        }
        // discard deleted gcal-holidays
        if ($.inArray(event.id, deleted_holidays) > -1) {
            return false;
        }
    };
    var duty_colors = [
        "#000000",
        "#2D6100",
        "#705A00",
        "#943700",
        "#6E043A",
        "#20006E",
        "#20006E",
    ];
    var non_duty_color = "#000000";
    var holiday_bg_color = "#f5dfe2";

    // init cal1 and cal2
    $("#cal2").fullCalendar({
        defaultDate: nextTwoMonth,
        header: {
            left: '',
            center: '',
            right: 'title'
        },
        height: 580,
        firstDay: 1,
        theme: true,
        eventLimit: true, // strang bug, without this, bottom border disappears in firefox
        googleCalendarApiKey: calGoogleCalendarApiKey,
        eventSources: calEventSources,
        selectable: true,
        dayClick: calDayClick,
        editable: true,
        eventDrop: calEventDrop,
        eventClick: calEventClick,
        eventRender: myEventRender,
        eventAfterAllRender: function() {
            //console.log('cal2 eventAfterAllRender');
            is_cal2_all_rendered = true;

            if (!is_cal2_loaded) {
                is_cal2_loaded = true;
            }
        }
    });

    $("#cal1").fullCalendar({
        defaultDate: nextMonth,
        header: {
            left: 'title',
            center: '',
            right: ''
        },
        height: 580,
        firstDay: 1,
        theme: true,
        eventLimit: true, // strang bug, without this, bottom border disappears in firefox
        googleCalendarApiKey: calGoogleCalendarApiKey,
        eventSources: calEventSources,
        selectable: true,
        dayClick: calDayClick,
        editable: true,
        eventDrop: calEventDrop,
        eventClick: calEventClick,
        eventRender: myEventRender,
        eventAfterAllRender: function() {
            //console.log("eventAfterAllRender");
            is_cal1_all_rendered = true;

            update_current_duty_status();
            var groups = calculate_group_duties(get_all_duties());
            update_summary_duties(groups);

            if (!is_cal1_loaded) {
                is_cal1_loaded = true;
            }
        }
    });

    function wait_and_update_suggested_patterns() {
        var month_span = $('#mode_switch').bootstrapSwitch('state') ? 2 : 1;
        var check_cal_all_rendered = setInterval(function() {
            //console.log("200ms passed.");
            if (month_span == 1 && is_cal1_all_rendered) {
                //console.log("detect cal1 all rendered.");
                update_patterns();
                clearInterval(check_cal_all_rendered);
            } else if (month_span == 2 && is_cal1_all_rendered && is_cal2_all_rendered) {
                //console.log("detect cal1 and cal2 all rendered.");
                update_patterns();
                clearInterval(check_cal_all_rendered);
            }
        }, 200);
    }

    // navigator for next and prev months
    $('#next_month').click(function() {
        is_cal1_all_rendered = false;
        is_cal2_all_rendered = false;
        $('#cal1').fullCalendar('next');
        $('#cal2').fullCalendar('next');
        wait_and_update_suggested_patterns();
    });

    $('#prev_month').click(function() {
        is_cal1_all_rendered = false;
        is_cal2_all_rendered = false;
        $('#cal1').fullCalendar('prev');
        $('#cal2').fullCalendar('prev');
        wait_and_update_suggested_patterns();
    });

    //
    // Basic Algorithm Related
    //
    function get_presets() {
        var presets = {};
        presets.holidays = get_preset_holidays();
        presets.duties = get_preset_duties();
        presets.non_duties = get_preset_non_duties();
        return presets;
    }

    function get_preset_non_duties() {
        // consider month mode
        var month_span = $('#mode_switch').bootstrapSwitch('state') ? 2 : 1;
        var start_date = $('#cal1').fullCalendar('getDate').startOf('month');
        var end_date = start_date.clone().add(month_span, 'months');
        var preset_non_duty_events = $('#cal1').fullCalendar('clientEvents', function(event) {
            return (event.start >= start_date && event.start < end_date && $.inArray('preset-non-duty-event', event.className) > -1);
        });

        var preset_non_duties = [];
        $.each(preset_non_duty_events, function(i, event) {
            var date = event.start.format("YYYY-MM-DD");
            preset_non_duties.push([date, parseInt(event.title)]); // parseInt("1 不值") == 1
        });

        return preset_non_duties;
    }

    function get_preset_duties() {
        // consider month mode
        var month_span = $('#mode_switch').bootstrapSwitch('state') ? 2 : 1;
        var start_date = $('#cal1').fullCalendar('getDate').startOf('month');
        var end_date = start_date.clone().add(month_span, 'months');
        var preset_duty_events = $('#cal1').fullCalendar('clientEvents', function(event) {
            return (event.start >= start_date && event.start < end_date && $.inArray('preset-duty-event', event.className) > -1);
        });

        var preset_duties = [];
        $.each(preset_duty_events, function(i, event) {
            var date = event.start.format("YYYY-MM-DD");
            preset_duties.push([date, parseInt(event.title)]);
        });

        return preset_duties;
    }

    function get_current_date_range() {
        // consider month mode
        var range = {};
        var month_span = $('#mode_switch').bootstrapSwitch('state') ? 2 : 1;
        range.start_date = $('#cal1').fullCalendar('getView').intervalStart;
        range.end_date = range.start_date.clone().add(month_span, 'months');
        return range;
    }

    function get_all_duties() {
        var range = get_current_date_range();
        var all_duty_events = $('#cal1').fullCalendar('clientEvents', function(event) {
            if ($.inArray('preset-duty-event', event.className) > -1 || $.inArray('duty-event', event.className) > -1) {
                return (event.start >= range.start_date && event.start < range.end_date);
            } else {
                return false;
            }
        });

        var all_duties = [];
        $.each(all_duty_events, function(i, event) {
            var date = event.start.format("YYYY-MM-DD");
            all_duties.push([date, parseInt(event.title)]);
        });

        return all_duties;
    }

    function get_preset_holidays() {
        var preset_holidays1 = $('#cal1').fullCalendar('clientEvents', function(event) {
            if ($.inArray('gcal-holiday', event.className) > -1) {
                return true;
            } else {
                return false;
            }
        });

        var preset_holidays2 = $('#cal2').fullCalendar('clientEvents', function(event) {
            if ($.inArray('gcal-holiday', event.className) > -1) {
                return true;
            } else {
                return false;
            }
        });

        var preset_holidays = $.map(preset_holidays1.concat(preset_holidays2), function(event) {
            return event.start.format("YYYY-MM-DD");
        });

        return preset_holidays;
    }

    function random_pattern(people, ordinary_count, friday_count, holiday_count) {
        var ordinary_duties = [];
        var friday_duties = [];
        var holiday_duties = [];
        while (friday_duties.length < friday_count) {
            friday_duties.push(randomIntFromInterval(1, people));
        }
        while (holiday_duties.length < holiday_count) {
            holiday_duties.push(randomIntFromInterval(1, people));
        }

        var patterns = [];
        for (i = 1; i <= people; i++) {
            var o_count;
            var f_count = friday_duties.multiIndexOf(i).length;
            var h_count = holiday_duties.multiIndexOf(i).length;

            if (ENABLE_PATTERN_CONDITIONING) {
                var total_points = 2 * holiday_count + 1 * friday_count;
                var points = 2 * h_count + 1 * f_count;
                var ratio = total_points / people;
                var threshold = {};
                if (total_points / people < 4) { // in extreme condition (too many people), use loose threshold
                    threshold.lower = parseInt(total_points / people) - 1;
                    threshold.upper = parseInt(total_points / people) + 2;
                } else {
                    threshold.lower = total_points / people - 1;
                    threshold.upper = total_points / people + 1;
                }
                if (points < threshold.lower || points > threshold.upper) {
                    return false;
                }

                o_count = parseInt(ordinary_count / people);
            }

            patterns.push([o_count, f_count, h_count]);
        }

        var residual_ordinary_count = ordinary_count % people;
        if (residual_ordinary_count != 0) {
            patterns = patterns.sort(function(a, b) {
                return (a[2] * 2 + a[1]) - (b[2] * 2 + b[1])
            });
            for (i = 0; i < residual_ordinary_count; i++) {
                patterns[i][0]++;
            }
        }

        return patterns;
    }

    function get_suggested_patterns(start_date, month_span, people) {
        var end_date = start_date.clone().add(month_span, 'months');
        var preset_holidays = get_preset_holidays();

        var holiday_count = 0;
        var friday_count = 0;
        var ordinary_count = 0;
        var the_day = start_date;
        while (the_day.format() != end_date.format()) {
            var the_day_str = the_day.format("YYYY-MM-DD");
            if (is_weekend(the_day_str) || is_holiday(preset_holidays, the_day_str)) {
                holiday_count++;
            } else if (is_friday(preset_holidays, the_day_str)) {
                friday_count++;
            } else {
                ordinary_count++;
            }
            the_day.add(1, 'days');
        }

        var c = 0;
        var patterns;
        while (!(patterns = random_pattern(people, ordinary_count, friday_count, holiday_count))) {
            c++;
            if (!(c % 100000)) {
                console.log("run time: " + c + ". Still running.");
            }
            if (c > 999999) {
                console.log("run time: " + c + ". More than 1000000.");
                return;
            }
        }
        console.log('rander pattern run time: ' + c);
        //console.log(patterns.toString());
        return patterns;
    }

    //
    // Debug UI Buttons
    //
    $('#func_clear_calendar').click(function() {
        is_already_random_duty = false; // reset global var
        clear_random_duties();
    });

    function update_current_duty_status() {
        // check if suggested pattern exists
        var patterns = $('#suggested_pattern').data("patterns");
        if (patterns === undefined) {
            calculate_suggested_patterns();
        }

        var preset_holidays = get_preset_holidays();
        var all_duties = get_all_duties();
        var groups = calculate_group_duties(all_duties);
        calculate_group_duties_status(groups, preset_holidays);
        //        console.log(groups);
        if ($.isEmptyObject(groups)) {  // clear the table
            $("#suggested_pattern .current_status").html('');
        } else {
            for (var person in groups) {
                var person_id = '#person_' + person;
                if ($(person_id).length == 1) {
                    var o_span = $(person_id + " .ordinary_count .current_status");
                    var f_span = $(person_id + " .friday_count .current_status");
                    var h_span = $(person_id + " .holiday_count .current_status");
                    var o_count = groups[person].ordinary_count;
                    var f_count = groups[person].friday_count;
                    var h_count = groups[person].holiday_count;

                    o_span.html("(" + o_count + ")");
                    f_span.html("(" + f_count + ")");
                    h_span.html("(" + h_count + ")");

                    // show background if not fit pattern
                    o_span.toggleClass('bg-danger', (o_count != patterns[person - 1][0]), 800);
                    f_span.toggleClass('bg-danger', (f_count != patterns[person - 1][1]), 800);
                    h_span.toggleClass('bg-danger', (h_count != patterns[person - 1][2]), 800);
                } else {
                    console.log("no such person: " + person);
                }
            }
        }
    }

    function update_duty_patterns(patterns) {
        if (patterns !== undefined) {
            $('#suggested_pattern table').remove();
            var pattern_html = '<table class="table table-striped"><tr><th>No.</th><th>平</th><th>五</th><th>假</th><th>P</th></tr>';
            var o_count = 0,
                f_count = 0,
                h_count = 0;
            $.each(patterns, function(index, pattern) {
                var point = parseInt(pattern[1]) + parseInt(pattern[2]) * 2;
                pattern_html += '<tr id="person_' + (index + 1) + '"><td>' + (index + 1) + '</td><td class="ordinary_count">' + pattern[0] + ' <span class="current_status"></span></td><td class="friday_count">' + pattern[1] + ' <span class="current_status"></span></td><td class="holiday_count">' + pattern[2] + ' <span class="current_status"></span></td><td>' + point + '</td></tr>';
                o_count += pattern[0];
                f_count += pattern[1];
                h_count += pattern[2];
            });
            var t_count = o_count + f_count + h_count;
            pattern_html += '<tr><th>共</th><th>' + o_count + '</th><th>' + f_count + '</th><th>' + h_count + '</th><th>' + t_count + '</th></tr></table>';
            $('#suggested_pattern').append(pattern_html);
        }
    }

    function calculate_suggested_patterns() {
        // clear previous data first
        $('#suggested_pattern').removeData("patterns");

        var start_date = $('#cal1').fullCalendar('getDate').startOf('month');
        var people = parseInt($('#inputPeopleSlider').slider("option", "value"));
        var month_span = $('#mode_switch').bootstrapSwitch('state') ? 2 : 1;

        var suggested_patterns = get_suggested_patterns(start_date, month_span, people);
        $('#suggested_pattern').data("patterns", suggested_patterns); // save object for random duty to match
        update_duty_patterns(suggested_patterns);
    }

    function update_patterns() {
        calculate_suggested_patterns();
        update_current_duty_status();
    }

    $('#func_get_holiday_condition').click(function() {
        update_patterns();
    });

    $('#func_edit_duty_patterns').click(function() {
        var patterns = $('#suggested_pattern').data("patterns");
        if (patterns === undefined) {
            WarningDialog('Patterns are undefinde!');
            return;
        }

        var o_count = 0,
            f_count = 0,
            h_count = 0;
        var table_html = '<table id="edit_patterns_table" class="table"><tr><th>No.</th><th>平</th><th>五</th><th>假</th><th>P</th></tr>';
        $.each(patterns, function(i, p) {
            o_count += p[0];
            f_count += p[1];
            h_count += p[2];
            var pt = p[1] + p[2] * 2;
            table_html += '<tr><td>' + (i + 1) + '</td><td class="duty_data" contentEditable>' + p[0] + '</td><td class="duty_data" contentEditable>' + p[1] + '</td><td class="duty_data" contentEditable>' + p[2] + '</td><td class="total_points">' + pt + '</td></tr>';
        });
        var t_count = o_count + f_count + h_count;
        table_html += '<tr><th>共</th><th>' + o_count + ' <span class="o_count bg-danger"></span></th><th>' + f_count + ' <span class="f_count bg-danger"></span></th><th>' + h_count + ' <span class="h_count bg-danger"></span></th><th>' + t_count + '</th></tr></table>';

        function getPatternTableData(table) {
            var data = [];
            table.find('tr:has(td)').each(function(rowIndex, r) {
                var cols = [];
                $(this).find('td.duty_data').each(function(colIndex, c) {
                    cols.push(parseInt(c.textContent));
                });
                data.push(cols);
            });
            return data;
        }

        BootstrapDialog.show({
            title: '修改排班樣式',
            message: table_html,
            cssClass: 'login-dialog',
            buttons: [{
                label: 'Update',
                cssClass: 'btn-primary',
                action: function(dialog) {
                    // check if pattern matches
                    var table_data = getPatternTableData($('#edit_patterns_table'));
                    var tb_o_count = 0,
                        tb_f_count = 0,
                        tb_h_count = 0;
                    $.each(table_data, function(i, p) {
                        tb_o_count += parseInt(p[0]);
                        tb_f_count += parseInt(p[1]);
                        tb_h_count += parseInt(p[2]);
                    });
                    if (tb_o_count != o_count || tb_f_count != f_count || tb_h_count != h_count) {
                        WarningDialog('總班數錯誤，請再檢查');
                        console.log(table_data);
                        return;
                    }

                    // update jquery data
                    $('#suggested_pattern').data("patterns", table_data);
                    dialog.close();
                    update_duty_patterns(table_data);
                }
            }],
            onshown: function(dialogRef) {
                $('#edit_patterns_table').contentEditable().change(function(e) {
                    //console.log(e.action);
                    //console.log(e.changed);
                    //console.log(e.changedField);

                    if (e.action == "save") {
                        var table_data = getPatternTableData($('#edit_patterns_table'));
                        // update point
                        var tb_o_count = 0,
                            tb_f_count = 0,
                            tb_h_count = 0;
                        $.each(table_data, function(i, p) {
                            tb_o_count += parseInt(p[0]);
                            tb_f_count += parseInt(p[1]);
                            tb_h_count += parseInt(p[2]);
                            var points = parseInt(p[1]) + parseInt(p[2]) * 2;
                            $('#edit_patterns_table td.total_points').eq(i).html(points);
                        });

                        // update total if not match
                        $('#edit_patterns_table th .o_count').html(tb_o_count != o_count ? "(" + tb_o_count + ")" : "");
                        $('#edit_patterns_table th .f_count').html(tb_f_count != f_count ? "(" + tb_f_count + ")" : "");
                        $('#edit_patterns_table th .h_count').html(tb_h_count != h_count ? "(" + tb_h_count + ")" : "");
                    }
                });

            }
        });
    });

    function update_summary_duties(groups_duties) {
        if (!$.isEmptyObject(groups_duties)) {
            var summary_duties_html = '<table class="table table-striped"><tr><th>No.</th><th>Dates</th><th>Intervals</th><th>QOD</th><th>Std Dev</th></tr>';
            var preset_holidays = get_preset_holidays();
            for (var p in groups_duties) {
                var dates = $.map(groups_duties[p].dates.sort(), function(d) {
                    var date_html = '<span class="';
                    // colorize if friday or holiday
                    if (is_holiday(preset_holidays, d) || is_weekend(d)) {
                        date_html += 'bg-danger';
                    } else if (is_friday(preset_holidays, d)) {
                        date_html += 'bg-success';
                    }
                    date_html += '">' + moment(d, "YYYY-MM-DD").format("M/D") + '</span>';
                    return date_html;
                }).join(', ');
                var qod_count = 0;
                var intervals = $.map(groups_duties[p].intervals, function(i) {
                    var interval_html = '<span class="';
                    // colerize if qod
                    if (i == 2) {
                        interval_html += 'bg-danger';
                        qod_count++;
                    }
                    interval_html += '">' + i + '</span>';
                    return interval_html;
                });
                var std_dev = groups_duties[p].std_dev;
                summary_duties_html += '<tr><th>' + p + '</th><th>' + dates + '</th><th>' + intervals + '</th><th>' + qod_count + '</th><th>' + std_dev + '</th></tr>';
            }
            summary_duties_html += '</table>';
            $('#summary_duties').html(summary_duties_html);
        } else { // if clear, groups_duties is empty
            $('#summary_duties').html("");
        }
    }

    function is_preset_duties_fit_pattern(presets, patterns) {
        var groups = calculate_group_duties(presets.duties);
        //console.log(groups);
        if (Object.keys(groups).length != patterns.length) {
            console.log("length not equal. groups: " + Object.keys(groups).length + ", patterns: " + patterns.length);
            return false;
        }

        for (var i = 0; i < patterns.length; i++) {
            var person = i + 1;
            if (groups[person] === undefined) {
                return false;
            }
            var dates = groups[person].dates;
            var counted_pattern = count_duty_pattern(dates, presets.holidays);
            // compare only friday and holiday now
            if (patterns[i][1] != counted_pattern[1] || patterns[i][2] != counted_pattern[2]) {
                console.log("person: " + person + ", pattern not fit: " + counted_pattern.join(", "));
                return false;
            }
        }

        return true;
    }

    function generate_duties_datatable(duties) {
        var month_span = $('#mode_switch').bootstrapSwitch('state') ? 2 : 1;
        var table_html = '<table id="duties_datatable" class="table">';
        var duties_map = {};
        $.map(duties, function(x) {
            return duties_map[x[0]] = x[1]
        });

        for (var i = 1; i <= month_span; i++) {
            var cal = $('#cal' + i);
            var start_date = cal.fullCalendar('getView').start;
            var end_date = cal.fullCalendar('getView').end;
            var month_first_date = cal.fullCalendar('getView').intervalStart;
            var the_date = start_date.clone();
            var the_cal_date = start_date.clone();

            if (i > 1) {
                table_html += '<tr></tr>';
            }
            table_html += '<tr><td colspan="7">' + month_first_date.format("YYYY/MM") + '</td></tr>';

            while (the_date < end_date) {
                table_html += '<tr>';
                for (var j = 0; j < 7; j++, the_cal_date.add(1, 'day')) {
                    var date_str = the_cal_date.format("MM/DD");
                    table_html += '<th>' + date_str + '</th>';
                }
                table_html += '</tr><tr>';
                for (var j = 0; j < 7; j++, the_date.add(1, 'day')) {
                    var date_str = the_date.format("YYYY-MM-DD");
                    var duty = duties_map[date_str];
                    if (duty === undefined) {
                        duty = "";
                    }
                    table_html += '<td>' + duty + '</td>';
                }
                table_html += '</tr>';
            }
        }

        table_html += '</table>';
        $('#duties_datatable_div').html(table_html);
    }

    function clear_random_duties() {
        // clear fullCalendar
        $('#cal1').fullCalendar('removeEvents', function(event) {
            if ($.inArray('duty-event', event.className) > -1) {
                return true;
            } else {
                return false;
            }
        });
        $('#cal2').fullCalendar('removeEvents', function(event) {
            if ($.inArray('duty-event', event.className) > -1) {
                return true;
            } else {
                return false;
            }
        });

        // update summary
        var groups = calculate_group_duties(get_all_duties());
        update_summary_duties(groups);
        update_current_duty_status();
    }

    var random_duty_worker;

    function do_random_duty() {
        var patterns = $('#suggested_pattern').data("patterns");
        var use_qod_limit = $('#use_qod_limit').is(':checked');
        var qod_limit = parseInt($('#inputQodLimitSlider').slider('option', 'value'));
        var presets = get_presets();
        var start_date = $('#cal1').fullCalendar('getDate').startOf('month');
        var month_span = $('#mode_switch').bootstrapSwitch('state') ? 2 : 1;
        var end_date = start_date.clone().add(month_span, 'months');
        var total_days = end_date.diff(start_date, 'days');
        var filters = {
            "patterns": patterns,
            "use_std_dev_level": $('#use_std_dev_level').is(':checked'),
            "std_dev_level": parseFloat($('#inputStdDevSlider').slider('option', 'value')),
            "use_qod_limit": use_qod_limit,
            "qod_limit": qod_limit,
        };

        clear_random_duties(); // always clean previous random duties
        is_already_random_duty = false; // reset global var

        // block ui
        $('#block_ui_message').html("Please wait...");
        $.blockUI({
            theme: true,
            title: 'Generating Duties',
            message: $('#block_ui_box')
        });

        random_duty_worker = new Worker("assets/js/random_duty_worker.js");
        random_duty_worker.postMessage({
            "presets": presets,
            "since_date_str": start_date.format("YYYY-MM-DD"),
            "total_days": total_days,
            "filters": filters,
        });
        random_duty_worker.onmessage = function(e) {
            switch (e.data.status) {
                case "success":
                    var duties = e.data["duties"];
                    var groups = e.data["groups"];
                    //console.log(duties.toString());

                    $.each(duties, function(i, duty) {
                        var date = moment(duty[0], "YYYY-MM-DD");
                        if (get_preset_duty(presets.duties, duty[0]) === undefined) {
                            var eventTitle = duty[1].toString();
                            var event = {
                                id: CryptoJS.MD5(date + eventTitle).toString(),
                                title: eventTitle,
                                start: date,
                                allDay: true,
                                color: duty_colors[duty[1]],
                                className: "duty-event"
                            };
                            $('#cal1').fullCalendar('renderEvent', event, true);
                            $('#cal2').fullCalendar('renderEvent', event, true);
                            //console.log(duty[0] + ": " + duty[1]);
                        }
                    });

                    // outline the result and std_dev
                    update_summary_duties(groups);

                    // record is_already_random_duty
                    is_already_random_duty = true;

                    // unblock ui
                    $.unblockUI({
                        onUnblock: function() {
                            myGrowlUI('Success', '自動排班已完成');
                        }
                    });
                    break;
                case "running":
                    $('#block_ui_message').html(e.data.msg);
                    break;
                case "fail":
                    $('#block_ui_dialog_message').html(e.data.msg);
                    $.blockUI({
                        theme: true,
                        title: 'Generating Failed',
                        message: $('#block_ui_dialog'),
                    });
                    break;
                default:
                    console.log(e.data["msg"]);
                    console.log(e.data["duties"]);
                    console.log(e.data["groups"]);
            }
        }
    }

    $('#func_random_duty').click(function() {
        // check if calculated patterns.
        var patterns = $('#suggested_pattern').data("patterns");
        if (patterns === undefined) {
            WarningDialog('請先更新排班樣式');
            return;
        }

        // check if preset duties exceed qod limit
        var use_qod_limit = $('#use_qod_limit').is(':checked');
        var qod_limit = parseInt($('#inputQodLimitSlider').slider('option', 'value'));
        var presets = get_presets();
        var groups = calculate_group_duties(presets.duties);
        if (use_qod_limit) {
            if (!less_than_qod_times(groups, qod_limit)) {
                WarningDialog('目前排班已超過 QOD 設定上限，請調整');
                return;
            }
        }

        // check if preset duties has qd duty
        if (has_continuous_duties(groups)) {
            WarningDialog('目前排班出現連值狀況，請調整');
            return;
        }

        // VGHKS vs General mode
        var vghks_mode = $('#vghks_mode_switch').bootstrapSwitch('state');
        if (vghks_mode) {
            // check if friday, weekend, holiday duties are set and fit pattern.
            if (!is_preset_duties_fit_pattern(presets, patterns)) {
                WarningDialog('已排班表不符合樣式，請調整');
                return;
            }
        }

        // check if already random duty and show a confirm dialog
        if (is_already_random_duty) {
            BootstrapDialog.confirm({
                title: 'Warning',
                message: '已有排定班表，確定清除並重排？',
                type: BootstrapDialog.TYPE_WARNING,
                closable: true,
                btnCancelLabel: '取消',
                btnOKLabel: '重新排班',
                callback: function(result) {
                    if (result) {
                        do_random_duty();
                    }
                }
            });
        } else {
            do_random_duty();
        }
    });

    $('.btn_stop_random_duty_worker').click(function() {
        if (random_duty_worker !== undefined) {
            random_duty_worker.terminate();
            random_duty_worker = undefined;
        }
        $.unblockUI();
    });

    $('#func_deploy_test_data').click(function() {
        var people = parseInt($('#inputPeopleSlider').slider('option', 'value'));
        var month_span = $('#mode_switch').bootstrapSwitch('state') ? 2 : 1;
        var test_data;
        switch (people) {
            case 4:
                test_data = [
                    [1, "2015-08-08"],
                    [1, "2015-08-16"],
                    [1, "2015-08-21"],
                    [1, "2015-08-28"],
                    [2, "2015-08-02"],
                    [2, "2015-08-15"],
                    [2, "2015-08-30"],
                    [3, "2015-08-09"],
                    [3, "2015-08-14"],
                    [3, "2015-08-23"],
                    [3, "2015-08-29"],
                    [4, "2015-08-01"],
                    [4, "2015-08-07"],
                    [4, "2015-08-22"],
                    [4, "2015-08-27"],
                ];

                if (month_span > 1) {
                    test_data = test_data.concat([
                        [1, "2015-09-04"],
                        [1, "2015-09-06"],
                        [1, "2015-09-19"],
                        [2, "2015-09-02"],
                        [2, "2015-09-11"],
                        [2, "2015-09-13"],
                        [2, "2015-09-25"],
                        [2, "2015-09-28"],
                        [3, "2015-09-05"],
                        [3, "2015-09-20"],
                        [3, "2015-09-27"],
                        [4, "2015-09-03"],
                        [4, "2015-09-12"],
                        [4, "2015-09-18"],
                        [4, "2015-09-26"],
                    ]);
                }
                break;
            case 5:
                test_data = [
                    [1, "2015-08-16"],
                    [1, "2015-08-21"],
                    [1, "2015-08-28"],
                    [2, "2015-08-02"],
                    [2, "2015-08-15"],
                    [2, "2015-08-27"],
                    [3, "2015-08-09"],
                    [3, "2015-08-14"],
                    [3, "2015-08-29"],
                    [4, "2015-08-01"],
                    [4, "2015-08-07"],
                    [4, "2015-08-22"],
                    [5, "2015-08-08"],
                    [5, "2015-08-23"],
                    [5, "2015-08-30"],
                ];
                break;
            default:
                alert("Please set deploy data for " + people + ".");
                return;
        }

        $.each(test_data, function(i, data) {
            var eventTitle = data[0].toString();
            var event = {
                id: CryptoJS.MD5(data[1] + eventTitle).toString(),
                title: eventTitle,
                start: data[1],
                allDay: true,
                className: "preset-duty-event",
                color: duty_colors[data[0]]
            };
            $("#cal1").fullCalendar('renderEvent', event, true);
            $("#cal2").fullCalendar('renderEvent', event, true);
        });
    });

    $('#func_deploy_test_data_ordinary').click(function() {
        var people = parseInt($('#inputPeopleSlider').slider('option', 'value'));
        var month_span = $('#mode_switch').bootstrapSwitch('state') ? 2 : 1;
        var test_data;
        switch (people) {
            case 4:
                test_data = [
                    [1, "2015-08-03"],
                    [1, "2015-08-13"],
                    [1, "2015-08-19"],
                    [1, "2015-08-24"],
                    [2, "2015-08-06"],
                    [2, "2015-08-11"],
                    [2, "2015-08-20"],
                    [2, "2015-08-25"],
                    [3, "2015-08-05"],
                    [3, "2015-08-18"],
                    [3, "2015-08-26"],
                    [3, "2015-08-31"],
                    [4, "2015-08-04"],
                    [4, "2015-08-10"],
                    [4, "2015-08-12"],
                    [4, "2015-08-17"],
                ];

                break;
            case 5:
                break;
            default:
                alert("Please set deploy data for " + people + ".");
                return;
        }

        $.each(test_data, function(i, data) {
            var event = {
                id: CryptoJS.MD5(data[1] + eventTitle).toString(),
                title: eventTitle,
                start: data[1],
                allDay: true,
                className: "duty-event",
                color: duty_colors[data[0]]
            };
            $("#cal1").fullCalendar('renderEvent', event, true);
            $("#cal2").fullCalendar('renderEvent', event, true);
        });
    });

    function is_each_day_has_a_duty(start_date, month_span, duties) {
        var _is_each_day_has_a_duty = true;
        var end_date = start_date.clone().add(month_span, 'months');
        var total_days = end_date.diff(start_date, 'days');
        if (total_days != duties.length) {
            _is_each_day_has_a_duty = false;
            console.log(total_days + ' unequal: ' + duties.length);
        } else {
            var sorted_duties = duties.sort(function(a, b) {
                return a[0].localeCompare(b[0])
            });
            for (the_date = start_date.clone(), i = 0; the_date < end_date; i++, the_date.add(1, 'day')) {
                if (sorted_duties[i][0] != the_date.format('YYYY-MM-DD')) {
                    _is_each_day_has_a_duty = false;
                    console.log(sorted_duties[i][0] + ' diff: ' + the_date.format());
                    break;
                }
            }
        }

        return _is_each_day_has_a_duty;
    }

    $('#func_download_excel').click(function(event) {
        // set duration as file name.
        var start_date = $('#cal1').fullCalendar('getDate').startOf('month');
        var start_month = start_date.format("YYYY-MM");
        var month_span = $('#mode_switch').bootstrapSwitch('state') ? 2 : 1;
        var end_month = start_date.clone().add(month_span, 'months').subtract(1, 'day').format("YYYY-MM");
        var duration_str = start_month;
        if (start_month != end_month) {
            duration_str += '-' + end_month;
        }
        var excel_path = duration_str + '_duties.xls';

        var duties = get_all_duties();

        function export_excel() {
            // write table for downloading
            generate_duties_datatable(duties);
            a = document.createElement("a");
            a.download = excel_path;
            ExcellentExport.excel(a, 'duties_datatable', duration_str);
            a.click();
        }
        // check if every date has a duty
        if (is_each_day_has_a_duty(start_date, month_span, duties)) {
            export_excel();
        } else {
            BootstrapDialog.confirm({
                title: 'Warning',
                message: '班表尚未完全設定，確定下載 Excel 檔？',
                type: BootstrapDialog.TYPE_WARNING,
                closable: true,
                btnCancelLabel: '取消',
                btnOKLabel: '下載',
                callback: function(result) {
                    if (result) {
                        export_excel();
                    }
                }
            });
        }
    });

    //
    // Must be done at first time
    //
    // unblock UI after cal1 is fully loaded.
    var check_cal_loaded = setInterval(function() {
        if (is_cal1_loaded) {
            $.unblockUI();

            // check if browser supports web workers.
            if (typeof window.Worker === "undefined") {
                $.blockUI({
                    theme: true,
                    title: 'Error',
                    message: '<h4><i class="fa fa-exclamation-circle"></i> 此瀏覽器不支援 Web Worker 技術</h4><p>請使用下列版本以上的瀏覽器：</p><div class="row"><div class="col-sm-4 text-center"><img src="https://raw.githubusercontent.com/alrra/browser-logos/master/chrome/chrome_64x64.png"><br>Chrome<br>&ge; 4.0</div><div class="col-sm-4 text-center"><img src="https://raw.githubusercontent.com/alrra/browser-logos/master/firefox/firefox_64x64.png"><br>Firefox<br>&ge; 3.5</div><div class="col-sm-4 text-center"><img src="https://raw.githubusercontent.com/alrra/browser-logos/master/internet-explorer/internet-explorer_64x64.png"><br>Internet Explorer<br>&ge; 10.0</div></div>'
                });
            }

            //
            // Load Preferences From Cookie
            //
            var pref = Cookies.get();
            $.each(pref, function(key, value) {
                if (value == "true" || value == "false") {
                    pref[key] = (value === "true");
                }
            });
            if (pref.mode_switch !== undefined) {
                $('#mode_switch').bootstrapSwitch('state', pref.mode_switch);
            }
            $('#use_qod_limit').prop("checked", pref.use_qod_limit);
            if (pref.inputQodLimitSlider !== undefined)
                $('#inputQodLimitSlider').slider("option", "value", pref.inputQodLimitSlider);
            $('#use_std_dev_level').prop("checked", pref.use_std_dev_level);
            if (pref.inputStdDevSlider !== undefined)
                $('#inputStdDevSlider').slider("option", "value", pref.inputStdDevSlider);
            if (pref.inputPeopleSlider !== undefined)
                $('#inputPeopleSlider').slider("option", "value", pref.inputPeopleSlider);

            clearInterval(check_cal_loaded);
        }
    }, 200);

    // update version text
    $.getJSON('../../bower.json', function(data) {
        $('#appVersion').html('v' + data.version);
    });
});
