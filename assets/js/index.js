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
        value: 4
    }).slider("pips", {
        rest: "label"
    });

    $.blockUI.defaults.growlCSS.top = '60px'; // show below the nav bar.
    $.blockUI.defaults.growlCSS.opacity = 0.8;

    function get_calendar_height() {
        return $(window).height() - 300;
    }

    //
    // Dialog related
    //
    var title = $('#eventTitle');
    var start = $('#eventStart');
    var eventClass, color;

    // Dialog for insert new event
    $('#calEventDialog').dialog({
        resizable: false,
        autoOpen: false,
        title: 'Set Duty',
        width: 400,
        buttons: {
            Save: function() {
                if (title.val() !== '') {
                    var event = {
                        id: CryptoJS.MD5(start.val() + title).toString(),
                        title: title.val(),
                        start: start.val(),
                        allDay: true,
                        className: "preset-duty-event",
                        color: duty_colors[title.val()]
                    };
                    $("#cal1").fullCalendar('renderEvent', event, true);
                    $("#cal2").fullCalendar('renderEvent', event, true);
                }
                $("#cal1").fullCalendar('unselect');
                $("#cal2").fullCalendar('unselect');
                $(this).dialog('close');
            },
            Cancel: function() {
                $(this).dialog('close');
            }
        }
    });

    // Dialog for update or delete event
    $('#calEventEditDialog').dialog({
        resizable: false,
        autoOpen: false,
        title: 'Edit Duty',
        width: 400,
        buttons: {
            Update: function() {
                if ($('#eventEditTitle').val() !== '') {
                    // have to remove old and add new
                    $("#cal1").fullCalendar('removeEvents', $('#eventEditId').val());
                    $("#cal2").fullCalendar('removeEvents', $('#eventEditId').val());

                    var event = {
                        title: $('#eventEditTitle').val(),
                        start: $('#eventEditStart').val(),
                        allDay: true,
                        className: "preset-duty-event",
                        color: duty_colors[$('#eventEditTitle').val()]
                    };
                    $("#cal1").fullCalendar('renderEvent', event, true);
                    $("#cal2").fullCalendar('renderEvent', event, true);
                }
                $("#cal1").fullCalendar('unselect');
                $("#cal2").fullCalendar('unselect');
                $(this).dialog('close');
            },
            Delete: function() {
                $("#cal1").fullCalendar('removeEvents', $('#eventEditId').val());
                $("#cal2").fullCalendar('removeEvents', $('#eventEditId').val());
                //console.log(calEvent._id);
                $(this).dialog("close");
            },
            Cancel: function() {
                $(this).dialog('close');
            }
        }
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
                title: rawEventData.title,
                start: rawEventData.start,
                end: rawEventData.end,
                className: 'gcal-holiday'
            };
        }
    }];
    var calDayClick = function(date, jsEvent, view) {
        $('#eventStart').val(date.format("YYYY-MM-DD"));
        //console.log(date.format("YYYY-MM-DD"));
        $('#calEventDialog').dialog('open');
    };
    var calEventClick = function(calEvent, jsEvent, view) {
        $('#eventEditStart').val(calEvent.start.format("YYYY-MM-DD"));
        $('#eventEditId').val(calEvent._id);
        $('#calEventEditDialog #eventEditTitle').val(calEvent.title);
        $("#calEventEditDialog").dialog('open');
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

    // init cal1 and cal2
    $("#cal1").fullCalendar({
        defaultDate: nextMonth,
        header: {
            left: 'title',
            center: '',
            right: ''
        },
        firstDay: 1,
        theme: true,
        googleCalendarApiKey: calGoogleCalendarApiKey,
        eventSources: calEventSources,
        selectable: true,
        dayClick: calDayClick,
        editable: true,
        eventClick: calEventClick,
        eventRender: onlyTheMonthEventRender,
        eventAfterAllRender: function() {
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
        firstDay: 1,
        theme: true,
        googleCalendarApiKey: calGoogleCalendarApiKey,
        eventSources: calEventSources,
        selectable: true,
        dayClick: calDayClick,
        editable: true,
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
    function get_preset_duties() {
        var preset_duty_events = $('#cal1').fullCalendar('clientEvents', function(event) {
            if ($.inArray('preset-duty-event', event.className) > -1) {
                return true;
            } else {
                return false;
            }
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

    $('#func_get_preset_duty_events').click(function() {
        var preset_duties = get_preset_duties();

        console.log(preset_duties);
    });

    function update_current_duty_status() {
        // check if suggested pattern exists
        if ($('#suggested_pattern').data("patterns") === undefined) {
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
                $(person_id + " .ordinary_count .current_status").html("(" + groups[person].ordinary_count + ")");
                $(person_id + " .friday_count .current_status").html("(" + groups[person].friday_count + ")");
                $(person_id + " .holiday_count .current_status").html("(" + groups[person].holiday_count + ")");
            } else {
                console.log("no such person: " + person);
            }
        }
    }

    $('#func_update_current_duty_status').click(function() {
        update_current_duty_status();
    });

    function calculate_suggested_patterns() {
        // clear previous data first
        $('#suggested_pattern').removeData("patterns");
        $('#suggested_pattern').html("");

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
            $('#suggested_pattern').html(suggested_pattern_html);
            $('#suggested_pattern').data("patterns", suggested_patterns); // save object for random duty to match
        }
    }

    $('#func_get_holiday_condition').click(function() {
        calculate_suggested_patterns();
        update_current_duty_status();
    });

    function update_summary_duties(groups_duties) {
        var summary_duties_html = '<table class="table table-striped"><tr><th>No.</th><th>Dates</th><th>Intervals</th><th>Std Dev</th></tr>';
        for (var p in groups_duties) {
            var dates = groups_duties[p].dates.sort().map(function(d) {
                return moment(d, "YYYY-MM-DD").format("M/D")
            }).join(', ');
            var intervals = groups_duties[p].intervals.join(', ');
            var std_dev = groups_duties[p].std_dev;
            summary_duties_html += '<tr><th>' + p + '</th><th>' + dates + '</th><th>' + intervals + '</th><th>' + std_dev + '</th></tr>';
        }
        summary_duties_html += '</table>';
        $('#summary_duties').html(summary_duties_html);
    }

    function is_preset_duties_fit_pattern(preset_duties, preset_holidays, patterns) {
        var groups = calculate_group_duties(preset_duties);
        console.log(groups);
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
            var counted_pattern = count_duty_pattern(dates, preset_holidays);
            // compare only friday and holiday now
            if (patterns[i][1] != counted_pattern[1] || patterns[i][2] != counted_pattern[2]) {
                console.log("person: " + person + ", pattern not fit: " + counted_pattern.join(", "));
                return false;
            }
        }

        return true;
    }

    var random_duty_worker;
    $('#func_test_worker').click(function() {
        // check if calculated patterns.
        var patterns = $('#suggested_pattern').data("patterns");
        if (patterns === undefined) {
            alert("Please calculate duty patterns first.");
            return;
        }

        // check if friday, weekend, holiday duties are set and fit pattern.
        var preset_holidays = get_preset_holidays();
        var preset_duties = get_preset_duties();
        if (!is_preset_duties_fit_pattern(preset_duties, preset_holidays, patterns)) {
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
            "std_dev_level": parseFloat($('#inputStdDevSlider').slider('option', 'value')),
            "qod_limit": parseInt($('#inputQodLimitSlider').slider('option', 'value')),
        };

        random_duty_worker = new Worker("assets/js/random_duty_worker.js");
        random_duty_worker.postMessage({
            "preset_holidays": preset_holidays,
            "preset_duties": preset_duties,
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
                        if (get_preset_duty(preset_duties, duty[0]) === undefined) {
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
                            $.growlUI('Random Duty Completed', 'Have a nice day!');
                        }
                    });
                    break;
                case "running":
                    $('#block_ui_message').html(e.data.msg);
                    break;
                default:
                    console.log(e.data["msg"]);
            }
        }
    });

    $('#btn_stop_random_duty_worker').click(function() {
        if (random_duty_worker !== undefined) {
            random_duty_worker.terminate();
            random_duty_worker = undefined;
        }
        $.unblockUI();
    });

    $('#func_test_stop_worker').click(function() {
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
