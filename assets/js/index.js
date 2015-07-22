$(function() {
    //
    // flags
    //
    var ENABLE_CONDITIONING = true;
    var ENABLE_PATTERN_CONDITIONING = true;

    //
    // global vars
    //
    var is_cal1_finished = false;
    var is_cal2_finished = false;

    $('#mode_switch').bootstrapSwitch({
        onText: "2 月",
        offText: "1 月",
        offColor: 'info',
        onSwitchChange: function(event, state) {
            //console.log(state); // true | false
            if (state) { // 2-month mode
                $('.first_cal').toggleClass('col-sm-6', state, 600).promise().done(function() {
                    $('.second_cal').show();
                });
            } else { // 1-month mode
                $('.second_cal').hide();
                $('.first_cal').toggleClass('col-sm-6', state, 600);
            }
        }
    });

    $('#inputQodLimitSlider').slider({
        max: 4,
        min: 0,
        value: 1
    }).slider("pips", {
        rest: "label"
    });

    $('#inputStdDevSlider').slider({
        max: 2,
        min: 1,
        step: 0.1,
        value: 1.8
    }).slider("pips", {
        rest: "label",
        step: 2
    });

    $('#inputPeopleSlider').slider({
        max: 9,
        min: 3,
        value: 4,
        create: update_dialog_select_options,
        change: function() {
            calculate_suggested_patterns();
            update_current_duty_status();
            update_dialog_select_options();
        },
    }).slider("pips", {
        rest: "label"
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
    function get_duty_conflict_status(title, orig_title, is_edit_dialog, is_non_duty, prev_set_duty, prev_set_non_duties, already_had_duty) {
        var status;
        if (is_edit_dialog) {
            if (is_non_duty) {
                if ($.inArray(parseInt(title), prev_set_non_duties) > -1) {
                    status = "Already set the same non-duty!";
                } else if (prev_set_duty == title && title != orig_title) {
                    status = "Conflict! The staff (" + title + ") is already on duty!";
                }
            } else {
                if (already_had_duty) {
                    if (title == prev_set_duty && title != orig_title) {
                        status = "Already had a duty!";
                    } else if (title != prev_set_duty && title == orig_title) {
                        status = "Already had a duty!";
                    } else if ($.inArray(parseInt(title), prev_set_non_duties) > -1) {
                        status = "Conflict! The staff (" + title + ") should not be on duty!";
                    }
                } else {
                    if ($.inArray(parseInt(title), prev_set_non_duties) > -1) {
                        if (title != orig_title) {
                            status = "Conflict! The staff (" + title + ") should not be on duty!";
                        }
                    }
                }
            }
        } else {
            if (is_non_duty) {
                if ($.inArray(parseInt(title), prev_set_non_duties) > -1) {
                    status = "Already had a same non-duty!";
                }
                if (prev_set_duty == title) {
                    status = "Conflict! The staff (" + title + ") should be on duty!";
                }
            } else {
                if (already_had_duty) {
                    status = "Already had a duty!";
                } else if ($.inArray(parseInt(title), prev_set_non_duties) > -1) {
                    status = "Conflict! The staff (" + title + ") should not be on duty!";
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
            var is_non_duty = $('#eventPropNonduty').is(":checked");
            var prev_set_duty = get_preset_duty(preset_duties, date);
            var prev_set_non_duties = get_preset_non_duties_by_date(preset_non_duties, date);
            var already_had_duty = (prev_set_duty !== undefined);
            var has_same_non_duty = check_if_has_same_non_duty(preset_non_duties, date, title);

            var duty_conflict_status = get_duty_conflict_status(title, orig_title, is_edit_dialog, is_non_duty, prev_set_duty, prev_set_non_duties, already_had_duty);
            if (!duty_conflict_status) {
                if (is_edit_dialog) {
                    // have to remove old and add new
                    $("#cal1").fullCalendar('removeEvents', $('#eventId').val());
                    $("#cal2").fullCalendar('removeEvents', $('#eventId').val());
                }

                var className = (is_non_duty ? 'preset-non-duty-event' : 'preset-duty-event');
                var color = (is_non_duty ? non_duty_color : duty_colors[title]);
                var eventTitle = (is_non_duty ? ' ' + title + ' 不值' : title); // add a space for sort first
                var event = {
                    id: CryptoJS.MD5(date + eventTitle).toString(),
                    title: eventTitle,
                    start: date,
                    allDay: true,
                    className: className,
                    color: color,
                };
                $("#cal1").fullCalendar('renderEvent', event, true);
                $("#cal2").fullCalendar('renderEvent', event, true);
            } else {
                myGrowlUI("Warning", duty_conflict_status);
            }
        }
        $("#cal1").fullCalendar('unselect');
        $("#cal2").fullCalendar('unselect');
    }

    // set dialog select options by people number
    function update_dialog_select_options() {
        var people = parseInt($('#inputPeopleSlider').slider("option", "value"));
        $('#eventTitle').empty();
        for (var i = 1; i <= people; i++) {
            var option_html = '<option>' + i + '</option>';
            $('#eventTitle').append(option_html);
        }
    }

    $('#calEventDialog').dialog({
        resizable: false,
        autoOpen: false,
        width: 400,
    });

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
        backgroundColor: '#f5dfe2',
        rendering: 'background',
        className: 'gcal-holiday-background'
    }, {
        googleCalendarId: 'taiwan__zh-TW@holiday.calendar.google.com',
        className: 'gcal-holiday',
        editable: true,
        eventDataTransform: function(rawEventData) { // drop url from google cal
            return {
                id: rawEventData.id,
                title: '  ' + rawEventData.title, // prepend two spaces to be sort first.
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
            Save: function() {
                save_or_update_event(false);
                $(this).dialog('close');
            },
            Cancel: function() {
                $(this).dialog('close');
            }
        });
        $('#calEventDialog').dialog('open');
    };
    var calEventClick = function(calEvent, jsEvent, view) {
        $('#eventStart').val(calEvent.start.format("YYYY-MM-DD"));
        $('#eventId').val(calEvent.id);
        var title = calEvent.title.trim().split(" 不值")[0]; // trim for a space prepend to non-duty
        var is_non_duty = (calEvent.title.indexOf(" 不值") > -1);
        $('#calEventDialog #eventPropNonduty').prop("checked", is_non_duty);
        $('#calEventDialog #eventTitle').val(title);
        $('#calEventDialog #eventOrigTitle').val(title);

        // set ui dialog
        $("#calEventDialog").dialog("option", "title", "Edit Duty");
        $("#calEventDialog").dialog("option", "buttons", {
            Update: function() {
                save_or_update_event(true);
                $(this).dialog("close");
            },
            Delete: function() {
                $("#cal1").fullCalendar('removeEvents', $('#eventId').val());
                $("#cal2").fullCalendar('removeEvents', $('#eventId').val());
                $(this).dialog("close");
            },
            Cancel: function() {
                $(this).dialog('close');
            }
        });
        $("#calEventDialog").dialog('open');
    };
    var calEventDrop = function(event, delta, revertFunc, jsEvent, ui, view) {
        // holiday can not be dragged and dropped. only can be deleted or created.
        if ($.inArray('gcal-holiday', event.className) > -1) {
            myGrowlUI('Error', 'Holiday cannot be moved!');
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
    var onlyTheMonthEventRender = function(event, element, view) {
        if (event.start.month() != view.intervalStart.month()) {
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

    // init cal1 and cal2
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
        googleCalendarApiKey: calGoogleCalendarApiKey,
        eventSources: calEventSources,
        selectable: true,
        dayClick: calDayClick,
        editable: true,
        eventDrop: calEventDrop,
        eventClick: calEventClick,
        eventRender: onlyTheMonthEventRender,
        eventAfterAllRender: function() {
            update_current_duty_status();
            is_cal1_finished = true;
        }
    });

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
        googleCalendarApiKey: calGoogleCalendarApiKey,
        eventSources: calEventSources,
        selectable: true,
        dayClick: calDayClick,
        editable: true,
        eventDrop: calEventDrop,
        eventClick: calEventClick,
        eventRender: onlyTheMonthEventRender,
        eventAfterAllRender: function() {
            is_cal2_finished = true;
        }
    });

    // navigator for next and prev months
    $('#next_month').click(function() {
        //console.log('prev is clicked, do something');
        is_cal1_finished = false;
        is_cal2_finished = false;
        $('#cal1').fullCalendar('next');
        $('#cal2').fullCalendar('next');
    });

    $('#prev_month').click(function() {
        //console.log('next is clicked, do something');
        is_cal1_finished = false;
        is_cal2_finished = false;
        $('#cal1').fullCalendar('prev');
        $('#cal2').fullCalendar('prev');
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
        preset_non_duty_events.forEach(function(event) {
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
        preset_duty_events.forEach(function(event) {
            var date = event.start.format("YYYY-MM-DD");
            preset_duties.push([date, parseInt(event.title)]);
        });

        return preset_duties;
    }

    function get_all_duties() {
        var all_duty_events = $('#cal1').fullCalendar('clientEvents', function(event) {
            if ($.inArray('preset-duty-event', event.className) > -1 || $.inArray('duty-event', event.className) > -1) {
                return true;
            } else {
                return false;
            }
        });

        var all_duties = [];
        all_duty_events.forEach(function(event) {
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

        var preset_holidays = preset_holidays1.concat(preset_holidays2).map(function(event) {
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
                if (points < total_points / people - 1 || points > total_points / people + 1) {
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
        //console.log(ordinary_count);
        //console.log(friday_count);
        //console.log(holiday_count);

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
                o_span.toggleClass('bg-danger', (o_count != patterns[person-1][0]), 800);
                f_span.toggleClass('bg-danger', (f_count != patterns[person-1][1]), 800);
                h_span.toggleClass('bg-danger', (h_count != patterns[person-1][2]), 800);
            } else {
                console.log("no such person: " + person);
            }
        }
    }

    function calculate_suggested_patterns() {
        // clear previous data first
        $('#suggested_pattern').removeData("patterns");
        $('#suggested_pattern table').remove();

        var start_date = $('#cal1').fullCalendar('getDate').startOf('month');
        var people = parseInt($('#inputPeopleSlider').slider("option", "value"));
        var month_span = $('#mode_switch').bootstrapSwitch('state') ? 2 : 1;

        var suggested_patterns = get_suggested_patterns(start_date, month_span, people);
        if (suggested_patterns !== undefined) {
            var suggested_pattern_html = '<table class="table table-striped"><tr><th>No.</th><th>平</th><th>五</th><th>假</th><th>P</th></tr>';
            var o_count = 0,
                f_count = 0,
                h_count = 0;
            suggested_patterns.forEach(function(pattern, index) {
                var point = parseInt(pattern[1]) + parseInt(pattern[2]) * 2;
                suggested_pattern_html += '<tr id="person_' + (index + 1) + '"><td>' + (index + 1) + '</td><td class="ordinary_count">' + pattern[0] + ' <span class="current_status"></span></td><td class="friday_count">' + pattern[1] + ' <span class="current_status"></span></td><td class="holiday_count">' + pattern[2] + ' <span class="current_status"></span></td><td>' + point + '</td></tr>';
                o_count += pattern[0];
                f_count += pattern[1];
                h_count += pattern[2];
            });
            var t_count = o_count + f_count + h_count;
            suggested_pattern_html += '<tr><th>共</th><th>' + o_count + '</th><th>' + f_count + '</th><th>' + h_count + '</th><th>' + t_count + '</th></tr></table>';
            $('#suggested_pattern').append(suggested_pattern_html);
            $('#suggested_pattern').data("patterns", suggested_patterns); // save object for random duty to match
        }
    }

    $('#func_get_holiday_condition').click(function() {
        calculate_suggested_patterns();
        update_current_duty_status();
    });

    function update_summary_duties(groups_duties) {
        var summary_duties_html = '<table class="table table-striped"><tr><th>No.</th><th>Dates</th><th>Intervals</th><th>Std Dev</th></tr>';
        var preset_holidays = get_preset_holidays();
        for (var p in groups_duties) {
            var dates = groups_duties[p].dates.sort().map(function(d) {
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
            var intervals = groups_duties[p].intervals.join(', ');
            var std_dev = groups_duties[p].std_dev;
            summary_duties_html += '<tr><th>' + p + '</th><th>' + dates + '</th><th>' + intervals + '</th><th>' + std_dev + '</th></tr>';
        }
        summary_duties_html += '</table>';
        $('#summary_duties').html(summary_duties_html);
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

    var random_duty_worker;
    $('#func_random_duty').click(function() {
        // check if calculated patterns.
        var patterns = $('#suggested_pattern').data("patterns");
        if (patterns === undefined) {
            alert("Please calculate duty patterns first.");
            return;
        }

        // check if friday, weekend, holiday duties are set and fit pattern.
        var presets = get_presets();
        if (!is_preset_duties_fit_pattern(presets, patterns)) {
            alert("The preset duties do not fit the patterns. Please adjust them.");
            return;
        }

        // block ui
        $('#block_ui_message').html("Please wait...");
        $.blockUI({
            theme: true,
            title: 'Generating Duties',
            message: $('#block_ui_box')
        });

        var start_date = $('#cal1').fullCalendar('getDate').startOf('month');
        var month_span = $('#mode_switch').bootstrapSwitch('state') ? 2 : 1;
        var end_date = start_date.clone().add(month_span, 'months');
        var total_days = end_date.diff(start_date, 'days');
        var filters = {
            "patterns": patterns,
            "use_std_dev_level": $('#use_std_dev_level').is(':checked'),
            "std_dev_level": parseFloat($('#inputStdDevSlider').slider('option', 'value')),
            "use_qod_limit": $('#use_qod_limit').is(':checked'),
            "qod_limit": parseInt($('#inputQodLimitSlider').slider('option', 'value')),
        };

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
                    //console.log(groups);

                    duties.forEach(function(duty) {
                        var date = moment(duty[0], "YYYY-MM-DD");
                        if (get_preset_duty(presets.duties, duty[0]) === undefined) {
                            var event = {
                                title: duty[1].toString(),
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

                    // unblock ui
                    $.unblockUI({
                        onUnblock: function() {
                            myGrowlUI('Random Duty Completed', 'Have a nice day!');
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
            }
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

        test_data.forEach(function(data) {
            var event = {
                title: data[0].toString(),
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

        test_data.forEach(function(data) {
            var event = {
                title: data[0].toString(),
                start: data[1],
                allDay: true,
                className: "duty-event",
                color: duty_colors[data[0]]
            };
            $("#cal1").fullCalendar('renderEvent', event, true);
            $("#cal2").fullCalendar('renderEvent', event, true);
        });
    });

    //
    // Must be done at first time
    //
});
