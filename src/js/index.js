import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import * as bootstrap from 'bootstrap';
import dayjs from './setup-dayjs.js';
import {
    loadPreferences,
    savePreferences,
    loadDraft,
    saveDraft,
    clearAllStorage,
} from './lib_storage.js';
import {
    is_holiday,
    is_friday,
    is_weekend,
} from './lib_holidays.js';
import {
    calculate_group_duties,
    calculate_group_duties_status,
    get_drop_conflict_status,
    get_duty_color,
    random_pattern,
    calculate_pattern_points,
} from './lib_duties.js';
import {
    less_than_qod_times,
    has_continuous_duties,
    less_than_max_week_hours,
} from './lib_filters.js';

// Application State
const state = {
    cal1: null,
    cal2: null,
    currentMonth: dayjs().add(1, 'month').startOf('month'),
    monthSpan: 1, // 1 or 2
    people: 4,
    useQodLimit: true,
    qodLimit: 1,
    useWeekHoursLimit: true,
    weekHoursLimit: 80,
    autoSaveDraft: true,
    deletedHolidays: new Set(),
    customHolidays: [], // [{ id, date, title }]
    customPatterns: null, // manual duty patterns
    isAlreadyRandomDuty: false,
    worker: null,
    isCal1Loaded: false,
    isCal2Loaded: false,
    cachedOfficialHolidays: new Map(), // id -> { id, date }
};

// Modals & UI Component Instances
let calEventModal = null;
let editPatternModal = null;
let dialogModal = null;

/**
 * Generate unique deterministic event ID.
 * @param {string} type Event type ('duty', 'nonduty', 'custom_holiday')
 * @param {string} date Date string (YYYY-MM-DD)
 * @param {string|number} title Person number or title
 * @return {string} Unique event ID
 */
function generateEventId(type, date, title) {
    return `${type}_${date}_${encodeURIComponent(title)}`;
}

/**
 * Display a modern Toast notification in the top right container.
 * @param {'success'|'warning'|'error'|'info'} type Notification type
 * @param {string} title Toast title
 * @param {string} message Toast content message
 */
function showToast(type, title, message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    let iconClass = 'bi-info-circle-fill text-primary';
    if (type === 'success') iconClass = 'bi-check-circle-fill text-success';
    if (type === 'warning') iconClass = 'bi-exclamation-triangle-fill text-warning';
    if (type === 'error') iconClass = 'bi-x-circle-fill text-danger';

    const toastEl = document.createElement('div');
    toastEl.className = 'toast show border-0 shadow mb-2';
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');

    toastEl.innerHTML = `
        <div class="toast-header bg-white border-bottom-0">
            <i class="bi ${iconClass} me-2 fs-6"></i>
            <strong class="me-auto">${title}</strong>
            <small class="text-muted">剛剛</small>
            <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body py-2 px-3 text-secondary small">
            ${message}
        </div>
    `;

    container.appendChild(toastEl);
    const bsToast = new bootstrap.Toast(toastEl, { delay: 4000 });
    bsToast.show();

    toastEl.addEventListener('hidden.bs.toast', () => {
        toastEl.remove();
    });
}

/**
 * Show a warning dialog.
 * @param {string} message Warning message
 * @param {string} [title='注意事項'] Dialog title
 */
function showWarningModal(message, title = '注意事項') {
    const titleEl = document.getElementById('dialogModalTitle');
    const bodyEl = document.getElementById('dialogModalBody');
    const cancelBtn = document.getElementById('dialogModalCancel');
    const confirmBtn = document.getElementById('dialogModalConfirm');

    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = `<div class="d-flex align-items-center text-secondary"><i class="bi bi-exclamation-circle text-warning fs-3 me-3"></i><div>${message}</div></div>`;
    if (cancelBtn) cancelBtn.classList.add('d-none');
    if (confirmBtn) {
        confirmBtn.className = 'btn btn-primary btn-sm px-4';
        confirmBtn.textContent = '確定';
        confirmBtn.onclick = () => dialogModal.hide();
    }

    dialogModal.show();
}

/**
 * Show a confirmation modal dialog.
 * @param {Object} options Configuration options
 */
function showConfirmModal({ title = '確認操作', message, confirmText = '確定', confirmClass = 'btn-danger', onConfirm }) {
    const titleEl = document.getElementById('dialogModalTitle');
    const bodyEl = document.getElementById('dialogModalBody');
    const cancelBtn = document.getElementById('dialogModalCancel');
    const confirmBtn = document.getElementById('dialogModalConfirm');

    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = `<div class="text-secondary leading-relaxed">${message}</div>`;
    if (cancelBtn) cancelBtn.classList.remove('d-none');
    if (confirmBtn) {
        confirmBtn.className = `btn ${confirmClass} btn-sm px-4`;
        confirmBtn.textContent = confirmText;
        confirmBtn.onclick = () => {
            dialogModal.hide();
            if (typeof onConfirm === 'function') onConfirm();
        };
    }

    dialogModal.show();
}

/**
 * Calculate the currently selected date range across 1 or 2 months.
 * @return {Object} Object with start_date and end_date as dayjs objects.
 */
function getCurrentDateRange() {
    const start_date = state.currentMonth.clone().startOf('month');
    const end_date = start_date.clone().add(state.monthSpan, 'month');
    return {
        start_date: start_date,
        end_date: end_date,
        month_str: state.monthSpan === 1
            ? start_date.format('YYYY-MM')
            : `${start_date.format('YYYY-MM')}_${start_date.clone().add(1, 'month').format('YYYY-MM')}`,
    };
}

/**
 * Get all preset official + custom holiday date strings in the current range.
 * @return {string[]} Array of date strings (YYYY-MM-DD).
 */
function getPresetHolidays() {
    const holidays = new Set();
    const range = getCurrentDateRange();

    // Custom holidays
    state.customHolidays.forEach(h => {
        if (h.date >= range.start_date.format('YYYY-MM-DD') && h.date < range.end_date.format('YYYY-MM-DD')) {
            holidays.add(h.date);
        }
    });

    // Cached official holidays
    state.cachedOfficialHolidays.forEach((val, id) => {
        if (!state.deletedHolidays.has(id)) {
            if (val.date >= range.start_date.format('YYYY-MM-DD') && val.date < range.end_date.format('YYYY-MM-DD')) {
                holidays.add(val.date);
            }
        }
    });

    // Official calendar holidays in cal1 & cal2 (as fallback)
    const cals = [state.cal1, state.cal2].filter(Boolean);
    cals.forEach(cal => {
        const events = cal.getEvents();
        events.forEach(evt => {
            if (evt.classNames.includes('gcal-holiday')) {
                const dateStr = dayjs(evt.start).format('YYYY-MM-DD');
                if (!state.deletedHolidays.has(evt.id)) {
                    holidays.add(dateStr);
                }
            }
        });
    });

    return Array.from(holidays).sort();
}

/**
 * Get all preset duties in current calendars.
 * @return {Array<[string, number]>} Array of [dateStr, personNo].
 */
function getPresetDuties() {
    const duties = [];
    const cals = [state.cal1, state.cal2].filter(Boolean);
    cals.forEach(cal => {
        const events = cal.getEvents();
        events.forEach(evt => {
            if (evt.classNames.includes('preset-duty-event')) {
                duties.push([dayjs(evt.start).format('YYYY-MM-DD'), parseInt(evt.title, 10)]);
            }
        });
    });
    return duties;
}

/**
 * Get all preset non-duties in current calendars.
 * @return {Array<[string, number]>} Array of [dateStr, personNo].
 */
function getPresetNonDuties() {
    const nonDuties = [];
    const cals = [state.cal1, state.cal2].filter(Boolean);
    cals.forEach(cal => {
        const events = cal.getEvents();
        events.forEach(evt => {
            if (evt.classNames.includes('preset-non-duty-event')) {
                nonDuties.push([dayjs(evt.start).format('YYYY-MM-DD'), parseInt(evt.title, 10)]);
            }
        });
    });
    return nonDuties;
}

/**
 * Get all duty events (both preset and auto-generated).
 * @return {Array<[string, number]>} Array of [dateStr, personNo].
 */
function getAllDuties() {
    const duties = [];
    const seen = new Set();
    const cals = [state.cal1, state.cal2].filter(Boolean);

    cals.forEach(cal => {
        const events = cal.getEvents();
        events.forEach(evt => {
            if (evt.classNames.includes('duty-event') || evt.classNames.includes('preset-duty-event')) {
                const dateStr = dayjs(evt.start).format('YYYY-MM-DD');
                const person = parseInt(evt.title, 10);
                const key = `${dateStr}_${person}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    duties.push([dateStr, person]);
                }
            }
        });
    });

    return duties.sort((a, b) => a[0].localeCompare(b[0]));
}

/**
 * Trigger auto-save draft if autoSaveDraft preference is enabled.
 */
function triggerAutoSaveDraft() {
    if (!state.autoSaveDraft) return;

    const generatedDuties = [];
    const cals = [state.cal1, state.cal2].filter(Boolean);
    cals.forEach(cal => {
        cal.getEvents().forEach(evt => {
            if (evt.classNames.includes('duty-event') && !evt.classNames.includes('preset-duty-event')) {
                generatedDuties.push([dayjs(evt.start).format('YYYY-MM-DD'), parseInt(evt.title, 10)]);
            }
        });
    });

    const draftData = {
        currentMonth: state.currentMonth.format('YYYY-MM-01'),
        deletedHolidays: Array.from(state.deletedHolidays),
        customHolidays: state.customHolidays,
        presetDuties: getPresetDuties(),
        presetNonDuties: getPresetNonDuties(),
        generatedDuties: generatedDuties,
        customPatterns: state.customPatterns || {},
    };

    saveDraft(draftData);
}

/**
 * Fetch official Taiwan holidays from API Gateway.
 * @param {Object} fetchInfo FullCalendar fetchInfo { start, end }
 * @param {Function} successCallback FullCalendar callback
 * @param {Function} failureCallback FullCalendar failure
 */
async function fetchTaiwanHolidays(fetchInfo, successCallback, failureCallback) {
    const timeMin = dayjs(fetchInfo.start).format('YYYY-MM-DD[T]00:00:00[Z]');
    const timeMax = dayjs(fetchInfo.end).format('YYYY-MM-DD[T]23:59:59[Z]');
    const url = `https://api.tsai.it/api/calendar/taiwan-holidays?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        const events = [];

        if (data && data.items) {
            data.items.forEach(item => {
                // Filter out non-holiday commemorative days
                if (item.description && item.description.includes('假日節慶')) {
                    return;
                }

                // Check if user previously marked this holiday as deleted
                if (state.deletedHolidays.has(item.id)) {
                    return;
                }

                const startDate = item.start.date || item.start.dateTime;
                const endDate = item.end.date || item.end.dateTime;

                // Cache official holiday info
                state.cachedOfficialHolidays.set(item.id, { id: item.id, date: startDate });

                // Background Event (soft pink)
                events.push({
                    id: `${item.id}_bg`,
                    start: startDate,
                    end: endDate,
                    display: 'background',
                    classNames: ['holiday-bg-event'],
                    allDay: true,
                });

                // Foreground Event (badge)
                events.push({
                    id: item.id,
                    title: `假日 ${item.summary || ''}`,
                    start: startDate,
                    end: endDate,
                    classNames: ['gcal-holiday', 'holiday-event'],
                    allDay: true,
                    editable: false,
                });
            });
        }

        successCallback(events);

        // Refresh suggested patterns and summary once holidays are loaded
        setTimeout(() => {
            updateSuggestedPatterns();
            updateSummaryDuties(calculate_group_duties(getAllDuties()));
        }, 100);
    } catch (err) {
        console.error('Failed to load Taiwan holidays:', err);
        showToast('error', '假日資料載入失敗', '無法自國定假日服務同步假日資訊，請檢查網路連線。');
        if (typeof failureCallback === 'function') failureCallback(err);
    }
}

/**
 * Update the navigation toolbar text & title.
 */
function updateCalendarToolbar() {
    const titleEl = document.getElementById('calendar_range_title');
    if (!titleEl) return;

    if (state.monthSpan === 1) {
        titleEl.textContent = state.currentMonth.format('YYYY 年 M 月');
    } else {
        const nextMonth = state.currentMonth.clone().add(1, 'month');
        titleEl.textContent = `${state.currentMonth.format('YYYY 年 M 月')} – ${nextMonth.format('M 月')}`;
    }
}

/**
 * Calculate and render summary statistics table.
 * @param {Object} groups Duties grouped by person.
 */
function updateSummaryDuties(groups) {
    const summaryContainer = document.getElementById('summary_duties');
    if (!summaryContainer) return;

    if (!groups || Object.keys(groups).length === 0) {
        summaryContainer.innerHTML = '<div class="text-center text-muted py-4"><i class="bi bi-calendar-check fs-2 d-block mb-2 text-secondary opacity-50"></i>目前尚無排班資料，請點擊「自動排班」或於日曆上手動填入預排。</div>';
        return;
    }

    const presetHolidays = getPresetHolidays();
    const dateRange = getCurrentDateRange();
    const viewStartDate = state.cal1.view.activeStart ? dayjs(state.cal1.view.activeStart) : dateRange.start_date.startOf('isoWeek');

    // Build Table Header
    let html = `
        <div class="table-responsive">
            <table class="table table-hover table-striped align-middle table-summary mb-0">
                <thead>
                    <tr>
                        <th class="text-center" style="width: 70px;">人員</th>
                        <th>值班日清單</th>
                        <th class="text-center" style="width: 120px;">班距</th>
                        <th class="text-center" style="width: 120px;">週工時</th>
                        <th class="text-center" style="width: 130px;">週工時 (PM Off)</th>
                        <th class="text-center" style="width: 110px;">最長連上日</th>
                        <th class="text-center" style="width: 80px;">QOD</th>
                        <th class="text-center" style="width: 90px;">班距標準差</th>
                    </tr>
                </thead>
                <tbody>
    `;

    // Calculate offs & continuous workdays
    const groupsOffs = {};
    for (const p in groups) {
        if ({}.hasOwnProperty.call(groups, p)) {
            groupsOffs[p] = { intervals: [], dates: [] };
            for (let cur = dateRange.start_date.clone(); cur.isBefore(dateRange.end_date); cur = cur.add(1, 'day')) {
                const dateStr = cur.format('YYYY-MM-DD');
                if ((is_holiday(presetHolidays, dateStr) || is_weekend(dateStr)) && !groups[p].dates.includes(dateStr)) {
                    groupsOffs[p].dates.push(dateStr);
                }
            }
            const len = groupsOffs[p].dates.length;
            for (let i = 0; i < len - 1; i++) {
                const diff = dayjs(groupsOffs[p].dates[i + 1]).diff(dayjs(groupsOffs[p].dates[i]), 'day');
                groupsOffs[p].intervals.push(diff);
            }
        }
    }

    for (const p in groups) {
        if ({}.hasOwnProperty.call(groups, p)) {
            const person = groups[p];
            const totalWeeks = Math.floor(dateRange.end_date.diff(viewStartDate, 'day') / 7);
            const weekHours = new Array(totalWeeks + 1).fill(0);
            const weekHoursPmOff = new Array(totalWeeks + 1).fill(0);

            // Baseline hours (8h for working days)
            for (let cur = dateRange.start_date.clone(); cur.isBefore(dateRange.end_date); cur = cur.add(1, 'day')) {
                const dateStr = cur.format('YYYY-MM-DD');
                const weekNo = Math.floor(cur.diff(viewStartDate, 'day') / 7);
                if (!is_holiday(presetHolidays, dateStr) && !is_weekend(dateStr)) {
                    weekHours[weekNo] += 8;
                    weekHoursPmOff[weekNo] += 8;
                }
            }

            // Duty Dates & Hours computation
            const sortedDates = person.dates.slice().sort();
            const dateBadges = sortedDates.map(d => {
                const cur = dayjs(d);
                const nextStr = cur.add(1, 'day').format('YYYY-MM-DD');
                const weekNo = Math.floor(cur.diff(viewStartDate, 'day') / 7);

                let badgeClass = 'badge-ordinary';
                if (is_holiday(presetHolidays, d) || is_weekend(d)) {
                    badgeClass = 'badge-holiday';
                    weekHours[weekNo] += 24;
                    weekHoursPmOff[weekNo] += 24;
                } else if (is_friday(presetHolidays, d)) {
                    badgeClass = 'badge-friday';
                    weekHours[weekNo] += 16;
                    weekHoursPmOff[weekNo] += 16;
                } else {
                    weekHours[weekNo] += 16;
                    weekHoursPmOff[weekNo] += 16;
                }

                // PM Off deduction
                if (!is_holiday(presetHolidays, nextStr) && !is_weekend(nextStr)) {
                    weekHoursPmOff[weekNo] -= 4;
                }

                const label = state.monthSpan === 1 ? cur.format('D') : cur.format('M/D');
                return `<span class="badge ${badgeClass} me-1 mb-1 font-monospace">${label}</span>`;
            }).join('');

            // Intervals & QOD count
            let qodCount = 0;
            const intervalBadges = person.intervals.map(i => {
                let badgeClass = 'bg-light text-secondary border';
                if (i === 2) {
                    badgeClass = 'badge-danger-soft';
                    qodCount++;
                }
                return `<span class="badge ${badgeClass} me-1 font-monospace">${i}</span>`;
            }).join('');

            // Week hours badge string
            const renderHoursBadges = (hoursArr) => hoursArr.map(h => {
                let badgeClass = 'bg-light text-secondary border';
                if (h > 88) badgeClass = 'badge-danger-soft';
                else if (h >= 80) badgeClass = 'badge-warning-soft';
                return `<span class="badge ${badgeClass} me-1 font-monospace">${h}</span>`;
            }).join('');

            const maxContinuous = groupsOffs[p].intervals.length > 0
                ? Math.max(...groupsOffs[p].intervals) - 1
                : 0;
            const maxContinuousBadge = maxContinuous > 12
                ? `<span class="badge badge-danger-soft font-monospace">${maxContinuous} 天</span>`
                : `<span class="text-muted font-monospace">${maxContinuous} 天</span>`;

            const stdDev = person.std_dev ? person.std_dev.toFixed(2) : '0.00';

            html += `
                <tr>
                    <td class="text-center fw-bold">
                        <span class="color-dot" style="background-color: ${get_duty_color(p)};"></span>${p}
                    </td>
                    <td>${dateBadges}</td>
                    <td class="text-center">${intervalBadges || '<span class="text-muted">-</span>'}</td>
                    <td class="text-center">${renderHoursBadges(weekHours)}</td>
                    <td class="text-center">${renderHoursBadges(weekHoursPmOff)}</td>
                    <td class="text-center">${maxContinuousBadge}</td>
                    <td class="text-center"><span class="badge ${qodCount > 0 ? 'badge-danger-soft' : 'bg-light text-muted border'}">${qodCount}</span></td>
                    <td class="text-center font-monospace text-muted">${stdDev}</td>
                </tr>
            `;
        }
    }

    html += `
                </tbody>
            </table>
        </div>
    `;

    summaryContainer.innerHTML = html;
}

/**
 * Generate and render suggested duty patterns.
 */
function updateSuggestedPatterns() {
    const range = getCurrentDateRange();
    const presetHolidays = getPresetHolidays();

    let ordinaryCount = 0;
    let fridayCount = 0;
    let holidayCount = 0;

    for (let cur = range.start_date.clone(); cur.isBefore(range.end_date); cur = cur.add(1, 'day')) {
        const dateStr = cur.format('YYYY-MM-DD');
        if (is_holiday(presetHolidays, dateStr) || is_weekend(dateStr)) {
            holidayCount++;
        } else if (is_friday(presetHolidays, dateStr)) {
            fridayCount++;
        } else {
            ordinaryCount++;
        }
    }

    const patternKey = `${range.month_str}_${state.monthSpan}_${state.people}`;
    let patterns = null;

    if (state.customPatterns && state.customPatterns[patternKey]) {
        patterns = state.customPatterns[patternKey];
    } else {
        let attempts = 0;
        while (!patterns && attempts < 100000) {
            patterns = random_pattern(state.people, ordinaryCount, fridayCount, holidayCount, true);
            attempts++;
        }
        if (!patterns) {
            patterns = random_pattern(state.people, ordinaryCount, fridayCount, holidayCount, false);
        }
    }

    const container = document.getElementById('suggested_pattern_body');
    if (!container) return;

    if (!patterns) {
        container.innerHTML = '<div class="alert alert-warning py-2 px-3 small mb-0"><i class="bi bi-exclamation-triangle-fill me-1"></i>無符合平衡條件的排班樣式，請嘗試調整人數或點擊「更新」。</div>';
        return;
    }

    // Cache generated pattern on container dataset
    container.dataset.patterns = JSON.stringify(patterns);
    container.dataset.patternKey = patternKey;

    // Render Table
    let tableHtml = `
        <div class="table-responsive">
            <table class="table table-sm table-borderless align-middle mb-0 small text-center">
                <thead>
                    <tr class="text-muted border-bottom">
                        <th class="text-start">人員</th>
                        <th>平</th>
                        <th>五</th>
                        <th>假</th>
                        <th>積點 (P)</th>
                        <th>已排班數</th>
                    </tr>
                </thead>
                <tbody>
    `;

    // Count currently assigned duties per person
    const currentDuties = getAllDuties();
    const currentGroupStatus = calculate_group_duties_status(
        calculate_group_duties(currentDuties),
        presetHolidays
    );

    patterns.forEach((pat, idx) => {
        const personNo = idx + 1;
        const pts = calculate_pattern_points(pat);
        const personStatus = currentGroupStatus[personNo] || { ordinary_count: 0, friday_count: 0, holiday_count: 0 };
        const isMatched = (personStatus.ordinary_count === pat[0]) &&
                          (personStatus.friday_count === pat[1]) &&
                          (personStatus.holiday_count === pat[2]);

        const statusBadge = isMatched
            ? `<span class="badge bg-success-subtle text-success-emphasis font-monospace">${personStatus.ordinary_count}/${personStatus.friday_count}/${personStatus.holiday_count}</span>`
            : `<span class="badge badge-mismatch font-monospace">${personStatus.ordinary_count}/${personStatus.friday_count}/${personStatus.holiday_count}</span>`;

        tableHtml += `
            <tr class="border-bottom border-light">
                <td class="text-start fw-bold">
                    <span class="color-dot" style="background-color: ${get_duty_color(personNo)};"></span>${personNo}
                </td>
                <td class="font-monospace text-secondary">${pat[0]}</td>
                <td class="font-monospace text-secondary">${pat[1]}</td>
                <td class="font-monospace text-secondary">${pat[2]}</td>
                <td class="font-monospace fw-semibold text-primary">${pts}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
    });

    tableHtml += `
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = tableHtml;
}

/**
 * Open the Event creation/editing Modal.
 * @param {Object} options Modal configuration options
 */
function openEventModal({ dateStr, event = null }) {
    const modalTitle = document.getElementById('calEventModalLabel');
    const deleteBtn = document.getElementById('btn_delete_cal_event');
    const form = document.getElementById('calEventDialogForm');
    const personSelect = document.getElementById('eventTitleSelect');
    const personGroup = document.getElementById('person_select_group');
    const holidayInput = document.getElementById('eventTitleInput');
    const holidayGroup = document.getElementById('holiday_input_group');
    const eventOrigTitle = document.getElementById('eventOrigTitle');
    const eventStart = document.getElementById('eventStart');
    const eventId = document.getElementById('eventId');

    form.reset();
    eventStart.value = dateStr;

    // Populate person select options (1 ~ state.people)
    personSelect.innerHTML = '';
    for (let i = 1; i <= state.people; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `人員 ${i}`;
        personSelect.appendChild(opt);
    }

    if (event) {
        modalTitle.textContent = '編輯班表事件';
        deleteBtn.classList.remove('d-none');
        eventOrigTitle.value = event.title;
        eventId.value = event.id;

        if (event.classNames.includes('preset-duty-event') || event.classNames.includes('duty-event')) {
            document.getElementById('eventPropDuty').checked = true;
            personSelect.value = event.title;
            personGroup.classList.remove('d-none');
            holidayGroup.classList.add('d-none');
        } else if (event.classNames.includes('preset-non-duty-event')) {
            document.getElementById('eventPropNonduty').checked = true;
            personSelect.value = event.title;
            personGroup.classList.remove('d-none');
            holidayGroup.classList.add('d-none');
        } else if (event.classNames.includes('holiday-event')) {
            document.getElementById('eventPropHoliday').checked = true;
            holidayInput.value = event.title.replace(/^假日\s*/, '');
            personGroup.classList.add('d-none');
            holidayGroup.classList.remove('d-none');
        }
    } else {
        modalTitle.textContent = `新增班表事件 (${dateStr})`;
        deleteBtn.classList.add('d-none');
        eventOrigTitle.value = '';
        eventId.value = '';
        document.getElementById('eventPropDuty').checked = true;
        personGroup.classList.remove('d-none');
        holidayGroup.classList.add('d-none');
    }

    calEventModal.show();
}

/**
 * Handle saving event from Event Modal.
 */
function handleSaveCalEvent() {
    const eventType = document.querySelector('input[name="eventProp"]:checked').value;
    const dateStr = document.getElementById('eventStart').value;
    const existingId = document.getElementById('eventId').value;

    const cals = [state.cal1, state.cal2].filter(Boolean);

    // Remove existing event if in editing mode
    if (existingId) {
        cals.forEach(cal => {
            const evt = cal.getEventById(existingId);
            if (evt) evt.remove();
        });
    }

    if (eventType === 'eventPropDuty') {
        const person = parseInt(document.getElementById('eventTitleSelect').value, 10);
        const newId = generateEventId('preset_duty', dateStr, person);

        // Check conflicts
        const sameDayEvents = getAllDuties().filter(d => d[0] === dateStr);
        if (sameDayEvents.length > 0 && !existingId) {
            showWarningModal(`該日期 (${dateStr}) 已有人員 ${sameDayEvents[0][1]} 值班！`);
            return;
        }

        const newEvent = {
            id: newId,
            title: String(person),
            start: dateStr,
            allDay: true,
            classNames: ['preset-duty-event'],
            backgroundColor: get_duty_color(person),
            borderColor: get_duty_color(person),
            editable: true,
        };

        state.cal1.addEvent(newEvent);
        if (state.cal2) state.cal2.addEvent(newEvent);
    } else if (eventType === 'eventPropNonduty') {
        const person = parseInt(document.getElementById('eventTitleSelect').value, 10);
        const newId = generateEventId('preset_non_duty', dateStr, person);

        const newEvent = {
            id: newId,
            title: String(person),
            start: dateStr,
            allDay: true,
            classNames: ['preset-non-duty-event'],
            editable: true,
        };

        state.cal1.addEvent(newEvent);
        if (state.cal2) state.cal2.addEvent(newEvent);
    } else if (eventType === 'eventPropHoliday') {
        const titleText = document.getElementById('eventTitleInput').value.trim() || '自訂';
        const newId = generateEventId('custom_holiday', dateStr, titleText);

        state.customHolidays.push({ id: newId, date: dateStr, title: `假日 ${titleText}` });

        // Add background and foreground events
        const bgEvent = {
            id: `${newId}_bg`,
            start: dateStr,
            display: 'background',
            classNames: ['holiday-bg-event'],
            allDay: true,
        };
        const fgEvent = {
            id: newId,
            title: `假日 ${titleText}`,
            start: dateStr,
            classNames: ['holiday-event'],
            allDay: true,
            editable: false,
        };

        state.cal1.addEvent(bgEvent);
        state.cal1.addEvent(fgEvent);
        if (state.cal2) {
            state.cal2.addEvent(bgEvent);
            state.cal2.addEvent(fgEvent);
        }
    }

    calEventModal.hide();
    updateSuggestedPatterns();
    updateSummaryDuties(calculate_group_duties(getAllDuties()));
    triggerAutoSaveDraft();
}

/**
 * Handle deleting event from Event Modal.
 */
function handleDeleteCalEvent() {
    const existingId = document.getElementById('eventId').value;
    if (!existingId) return;

    const cals = [state.cal1, state.cal2].filter(Boolean);

    cals.forEach(cal => {
        const evt = cal.getEventById(existingId);
        if (evt) {
            // If it's a holiday, also remove its paired background event
            const bgEvt = cal.getEventById(`${existingId}_bg`);
            if (bgEvt) bgEvt.remove();
            evt.remove();
        }
    });

    // If it's a custom holiday, remove from customHolidays
    state.customHolidays = state.customHolidays.filter(h => h.id !== existingId);
    // If it's an official holiday, add to deletedHolidays
    state.deletedHolidays.add(existingId);

    calEventModal.hide();
    updateSuggestedPatterns();
    updateSummaryDuties(calculate_group_duties(getAllDuties()));
    triggerAutoSaveDraft();
}

/**
 * Initialize FullCalendar v6 instances.
 */
function initCalendars() {
    const cal1El = document.getElementById('cal1');
    const cal2El = document.getElementById('cal2');

    const commonOptions = {
        plugins: [dayGridPlugin, interactionPlugin],
        initialView: 'dayGridMonth',
        headerToolbar: false,
        editable: true,
        droppable: true,
        firstDay: 1, // Start on Monday
        height: 'auto',
        events: fetchTaiwanHolidays,
        dateClick(info) {
            openEventModal({ dateStr: info.dateStr });
        },
        eventClick(info) {
            const evt = info.event;
            if (evt.classNames.includes('gcal-holiday')) {
                showConfirmModal({
                    title: '刪除國定假日',
                    message: `確定要刪除「${evt.title}」嗎？刪除後該日將視為平日運算。`,
                    confirmText: '刪除假日',
                    onConfirm: () => {
                        state.deletedHolidays.add(evt.id);
                        const cals = [state.cal1, state.cal2].filter(Boolean);
                        cals.forEach(cal => {
                            const e = cal.getEventById(evt.id);
                            if (e) e.remove();
                            const bg = cal.getEventById(`${evt.id}_bg`);
                            if (bg) bg.remove();
                        });
                        updateSuggestedPatterns();
                        updateSummaryDuties(calculate_group_duties(getAllDuties()));
                        triggerAutoSaveDraft();
                    },
                });
            } else {
                openEventModal({ dateStr: dayjs(evt.start).format('YYYY-MM-DD'), event: evt });
            }
        },
        eventDrop(info) {
            const evt = info.event;
            const targetDateStr = dayjs(evt.start).format('YYYY-MM-DD');
            const targetDayDuties = getAllDuties().filter(d => d[0] === targetDateStr);

            // Reconstruct pseudo event object for conflict testing
            const pseudoEvent = {
                title: evt.title,
                className: evt.classNames,
            };
            const pseudoSameDay = targetDayDuties.map(d => ({
                title: String(d[1]),
                className: ['duty-event'],
            }));

            const conflict = get_drop_conflict_status(pseudoEvent, pseudoSameDay);
            if (conflict) {
                showToast('warning', '班表衝突', conflict);
                info.revert();
                return;
            }

            // Sync drop change to other calendar if 2-month mode
            const otherCal = info.view.calendar === state.cal1 ? state.cal2 : state.cal1;
            if (otherCal) {
                const otherEvt = otherCal.getEventById(evt.id);
                if (otherEvt) otherEvt.setStart(evt.start);
            }

            updateSuggestedPatterns();
            updateSummaryDuties(calculate_group_duties(getAllDuties()));
            triggerAutoSaveDraft();
        },
    };

    state.cal1 = new Calendar(cal1El, {
        ...commonOptions,
        initialDate: state.currentMonth.format('YYYY-MM-01'),
    });
    state.cal1.render();

    state.cal2 = new Calendar(cal2El, {
        ...commonOptions,
        initialDate: state.currentMonth.clone().add(1, 'month').format('YYYY-MM-01'),
    });
    state.cal2.render();

    updateCalendarToolbar();
}

/**
 * Switch month span (1 month vs 2 months).
 * @param {number} span 1 or 2
 */
function setMonthSpan(span) {
    state.monthSpan = span;
    const mode1m = document.getElementById('mode_1m');
    const mode2m = document.getElementById('mode_2m');
    const firstCalCol = document.querySelector('.first_cal');
    const secondCalCol = document.querySelector('.second_cal');

    if (span === 2) {
        if (mode2m) mode2m.checked = true;
        if (firstCalCol) firstCalCol.className = 'col-12 col-xxl-6 first_cal';
        if (secondCalCol) secondCalCol.classList.remove('d-none');
        if (state.cal2) {
            state.cal2.gotoDate(state.currentMonth.clone().add(1, 'month').format('YYYY-MM-01'));
            state.cal2.updateSize();
        }
    } else {
        if (mode1m) mode1m.checked = true;
        if (firstCalCol) firstCalCol.className = 'col-12 first_cal';
        if (secondCalCol) secondCalCol.classList.add('d-none');
    }

    if (state.cal1) state.cal1.updateSize();
    updateCalendarToolbar();
    updateSuggestedPatterns();
    updateSummaryDuties(calculate_group_duties(getAllDuties()));
    savePreferences({ mode_switch: span === 2 });
}

/**
 * Navigate calendar month.
 * @param {number} delta Month offset (-1 or +1)
 */
function navigateMonth(delta) {
    state.currentMonth = state.currentMonth.add(delta, 'month');
    state.cal1.gotoDate(state.currentMonth.format('YYYY-MM-01'));
    if (state.cal2) {
        state.cal2.gotoDate(state.currentMonth.clone().add(1, 'month').format('YYYY-MM-01'));
    }
    updateCalendarToolbar();
    updateSuggestedPatterns();
    updateSummaryDuties(calculate_group_duties(getAllDuties()));
    triggerAutoSaveDraft();
}

/**
 * Reset calendars to default month (Next Month).
 */
function resetToDefaultMonth() {
    state.currentMonth = dayjs().add(1, 'month').startOf('month');
    state.cal1.gotoDate(state.currentMonth.format('YYYY-MM-01'));
    if (state.cal2) {
        state.cal2.gotoDate(state.currentMonth.clone().add(1, 'month').format('YYYY-MM-01'));
    }
    updateCalendarToolbar();
    updateSuggestedPatterns();
    updateSummaryDuties(calculate_group_duties(getAllDuties()));
    triggerAutoSaveDraft();
}

/**
 * Execute Web Worker background random duty solver.
 */
function executeRandomDuty() {
    const patternsData = document.getElementById('suggested_pattern_body')?.dataset?.patterns;
    if (!patternsData) {
        showWarningModal('請先產生建議排班樣式！');
        return;
    }

    const patterns = JSON.parse(patternsData);
    const range = getCurrentDateRange();
    const totalDays = range.end_date.diff(range.start_date, 'day');
    const presetHolidays = getPresetHolidays();
    const presetDuties = getPresetDuties();
    const presetNonDuties = getPresetNonDuties();

    // Verify preset constraints
    const groups = calculate_group_duties(presetDuties);
    if (has_continuous_duties(groups)) {
        showWarningModal('目前已設定之預排班中出現連續值班狀況，請先調整後再執行自動排班！');
        return;
    }
    if (state.useQodLimit && !less_than_qod_times(groups, state.qodLimit)) {
        showWarningModal(`目前預排班已超過 QOD 設定上限 (${state.qodLimit} 次)，請先調整！`);
        return;
    }
    if (state.useWeekHoursLimit) {
        const weekOpts = {
            preset_holidays: presetHolidays,
            since_date_str: range.start_date.format('YYYY-MM-DD'),
            total_days: totalDays,
            use_pm_off: true,
        };
        if (!less_than_max_week_hours(groups, state.weekHoursLimit, weekOpts)) {
            showWarningModal(`目前預排班已超過週工時上限 (${state.weekHoursLimit} 小時)，請先調整！`);
            return;
        }
    }

    // Show loading overlay
    const overlay = document.getElementById('loadingOverlay');
    const msgEl = document.getElementById('block_ui_message');
    if (overlay) overlay.classList.remove('d-none');
    if (msgEl) msgEl.textContent = '初始化亂數排班引擎...';

    // Start Web Worker
    if (state.worker) state.worker.terminate();
    state.worker = new Worker(new URL('./random_duty_worker.js', import.meta.url), { type: 'module' });

    state.worker.postMessage({
        presets: {
            duties: presetDuties,
            non_duties: presetNonDuties,
            holidays: presetHolidays,
        },
        since_date_str: range.start_date.format('YYYY-MM-DD'),
        total_days: totalDays,
        filters: {
            patterns: patterns,
            use_qod_limit: state.useQodLimit,
            qod_limit: state.qodLimit,
            use_week_hours_limit: state.useWeekHoursLimit,
            max_week_hours: state.weekHoursLimit,
        },
    });

    state.worker.onmessage = (e) => {
        const { status, msg, duties, groups: resultGroups } = e.data;

        if (status === 'running') {
            if (msgEl) msgEl.textContent = msg;
        } else if (status === 'success') {
            if (overlay) overlay.classList.add('d-none');
            state.worker.terminate();
            state.worker = null;

            // Clear previous non-preset duties
            const cals = [state.cal1, state.cal2].filter(Boolean);
            cals.forEach(cal => {
                cal.getEvents().forEach(evt => {
                    if (evt.classNames.includes('duty-event') && !evt.classNames.includes('preset-duty-event')) {
                        evt.remove();
                    }
                });
            });

            // Add new duties
            duties.forEach(([dStr, pNo]) => {
                const isPreset = presetDuties.some(pd => pd[0] === dStr && pd[1] === pNo);
                if (!isPreset) {
                    const evtId = generateEventId('duty', dStr, pNo);
                    const newEvt = {
                        id: evtId,
                        title: String(pNo),
                        start: dStr,
                        allDay: true,
                        classNames: ['duty-event'],
                        backgroundColor: get_duty_color(pNo),
                        borderColor: get_duty_color(pNo),
                        editable: true,
                    };
                    state.cal1.addEvent(newEvt);
                    if (state.cal2) state.cal2.addEvent(newEvt);
                }
            });

            state.isAlreadyRandomDuty = true;
            updateSuggestedPatterns();
            updateSummaryDuties(resultGroups || calculate_group_duties(getAllDuties()));
            triggerAutoSaveDraft();
            showToast('success', '自動排班完成', '已成功依設定條件產生公平排班表！');
        } else if (status === 'fail') {
            if (overlay) overlay.classList.add('d-none');
            state.worker.terminate();
            state.worker = null;
            showWarningModal(msg || '運算已達上限次數，可能無符合之解答，建議調寬 QOD 或放寬週工時條件。');
        }
    };
}

/**
 * Clear generated duties from calendar.
 */
function clearGeneratedDuties() {
    showConfirmModal({
        title: '清除排班',
        message: '確定要清除所有自動產生之值班表嗎？（預先指定之值班、不值與自訂假日將完整保留）',
        confirmText: '清除班表',
        onConfirm: () => {
            const cals = [state.cal1, state.cal2].filter(Boolean);
            cals.forEach(cal => {
                cal.getEvents().forEach(evt => {
                    if (evt.classNames.includes('duty-event') && !evt.classNames.includes('preset-duty-event')) {
                        evt.remove();
                    }
                });
            });
            state.isAlreadyRandomDuty = false;
            updateSuggestedPatterns();
            updateSummaryDuties(calculate_group_duties(getAllDuties()));
            triggerAutoSaveDraft();
            showToast('info', '班表已清除', '已清除自動排班紀錄。');
        },
    });
}

/**
 * Open Pattern Editor Modal.
 */
function openPatternEditor() {
    const patternsData = document.getElementById('suggested_pattern_body')?.dataset?.patterns;
    if (!patternsData) return;

    const patterns = JSON.parse(patternsData);
    const container = document.getElementById('edit_patterns_table_container');
    const range = getCurrentDateRange();
    const presetHolidays = getPresetHolidays();

    let ordinaryCount = 0;
    let fridayCount = 0;
    let holidayCount = 0;

    for (let cur = range.start_date.clone(); cur.isBefore(range.end_date); cur = cur.add(1, 'day')) {
        const dateStr = cur.format('YYYY-MM-DD');
        if (is_holiday(presetHolidays, dateStr) || is_weekend(dateStr)) holidayCount++;
        else if (is_friday(presetHolidays, dateStr)) fridayCount++;
        else ordinaryCount++;
    }

    let html = `
        <table class="table table-bordered align-middle text-center" id="edit_patterns_table">
            <thead class="table-light">
                <tr>
                    <th style="width: 25%;">人員</th>
                    <th style="width: 20%;">平</th>
                    <th style="width: 20%;">五</th>
                    <th style="width: 20%;">假</th>
                    <th style="width: 15%;">積點</th>
                </tr>
            </thead>
            <tbody>
    `;

    patterns.forEach((pat, idx) => {
        const personNo = idx + 1;
        const pts = calculate_pattern_points(pat);
        html += `
            <tr data-person="${personNo}">
                <td class="fw-bold">
                    <span class="color-dot" style="background-color: ${get_duty_color(personNo)};"></span>人員 ${personNo}
                </td>
                <td><input type="number" min="0" class="form-control form-control-sm text-center duty_input input_o" value="${pat[0]}"></td>
                <td><input type="number" min="0" class="form-control form-control-sm text-center duty_input input_f" value="${pat[1]}"></td>
                <td><input type="number" min="0" class="form-control form-control-sm text-center duty_input input_h" value="${pat[2]}"></td>
                <td class="fw-bold text-primary points_cell font-monospace">${pts}</td>
            </tr>
        `;
    });

    html += `
            <tr class="table-light fw-bold" id="pattern_total_row">
                <td>加總 (應為 ${ordinaryCount}/${fridayCount}/${holidayCount})</td>
                <td id="total_o" class="font-monospace">0</td>
                <td id="total_f" class="font-monospace">0</td>
                <td id="total_h" class="font-monospace">0</td>
                <td id="total_pts" class="font-monospace text-primary">0</td>
            </tr>
        </tbody>
    </table>
    `;

    container.innerHTML = html;

    // Recalculate totals and attach live input events
    function updateTotals() {
        let sumO = 0;
        let sumF = 0;
        let sumH = 0;
        let sumPts = 0;

        const rows = container.querySelectorAll('tbody tr[data-person]');
        rows.forEach(row => {
            const o = parseInt(row.querySelector('.input_o').value, 10) || 0;
            const f = parseInt(row.querySelector('.input_f').value, 10) || 0;
            const h = parseInt(row.querySelector('.input_h').value, 10) || 0;
            const rowPts = calculate_pattern_points([o, f, h]);

            row.querySelector('.points_cell').textContent = rowPts;
            sumO += o;
            sumF += f;
            sumH += h;
            sumPts += rowPts;
        });

        const totalO = document.getElementById('total_o');
        const totalF = document.getElementById('total_f');
        const totalH = document.getElementById('total_h');
        const totalPts = document.getElementById('total_pts');
        const statusBadge = document.getElementById('pattern_status_badge');

        totalO.textContent = sumO;
        totalF.textContent = sumF;
        totalH.textContent = sumH;
        totalPts.textContent = sumPts;

        const isMatch = (sumO === ordinaryCount) && (sumF === fridayCount) && (sumH === holidayCount);
        if (isMatch) {
            statusBadge.className = 'badge bg-success-subtle text-success-emphasis px-3 py-2';
            statusBadge.textContent = '總班數與當月天數完全符合';
        } else {
            statusBadge.className = 'badge bg-danger-subtle text-danger-emphasis px-3 py-2';
            statusBadge.textContent = `差額：平 (${sumO - ordinaryCount}), 五 (${sumF - fridayCount}), 假 (${sumH - holidayCount})`;
        }
    }

    container.querySelectorAll('.duty_input').forEach(input => {
        input.addEventListener('input', updateTotals);
    });

    updateTotals();
    editPatternModal.show();
}

/**
 * Save manual changes from Pattern Editor Modal.
 */
function handleSavePattern() {
    const container = document.getElementById('edit_patterns_table_container');
    const range = getCurrentDateRange();
    const presetHolidays = getPresetHolidays();

    let ordinaryCount = 0;
    let fridayCount = 0;
    let holidayCount = 0;

    for (let cur = range.start_date.clone(); cur.isBefore(range.end_date); cur = cur.add(1, 'day')) {
        const dateStr = cur.format('YYYY-MM-DD');
        if (is_holiday(presetHolidays, dateStr) || is_weekend(dateStr)) holidayCount++;
        else if (is_friday(presetHolidays, dateStr)) fridayCount++;
        else ordinaryCount++;
    }

    const rows = container.querySelectorAll('tbody tr[data-person]');
    const newPatterns = [];
    let sumO = 0, sumF = 0, sumH = 0;

    rows.forEach(row => {
        const o = parseInt(row.querySelector('.input_o').value, 10) || 0;
        const f = parseInt(row.querySelector('.input_f').value, 10) || 0;
        const h = parseInt(row.querySelector('.input_h').value, 10) || 0;
        sumO += o;
        sumF += f;
        sumH += h;
        newPatterns.push([o, f, h]);
    });

    if (sumO !== ordinaryCount || sumF !== fridayCount || sumH !== holidayCount) {
        showWarningModal(`總班數加總與當月天數不符合！\n目前輸入：平日 ${sumO} (應為 ${ordinaryCount})、週五 ${sumF} (應為 ${fridayCount})、假日 ${sumH} (應為 ${holidayCount})`);
        return;
    }

    const patternKey = document.getElementById('suggested_pattern_body')?.dataset?.patternKey;
    if (patternKey) {
        state.customPatterns = state.customPatterns || {};
        state.customPatterns[patternKey] = newPatterns;
    }

    editPatternModal.hide();
    updateSuggestedPatterns();
    triggerAutoSaveDraft();
    showToast('success', '排班樣式已更新', '自訂排班樣式已儲存，自動排班將依照此分配進行運算。');
}

/**
 * Download high-resolution screenshot via html-to-image.
 */
async function handleDownloadScreenshot() {
    try {
        const { toPng } = await import('html-to-image');
        const node = document.getElementById('app-content');
        if (!node) return;

        const dataUrl = await toPng(node, {
            pixelRatio: 2, // 2x Retina
            backgroundColor: '#f8fafc',
        });

        const range = getCurrentDateRange();
        const filename = `random_duty_${range.month_str}.png`;
        const link = document.getElementById('screenshot_download_link');
        link.href = dataUrl;
        link.download = filename;
        link.click();
        showToast('success', '截圖成功', `已輸出高畫質圖檔：${filename}`);
    } catch (err) {
        console.error('Screenshot failed:', err);
        showToast('error', '輸出失敗', '截圖過程發生錯誤，請稍後重試。');
    }
}

/**
 * Download Excel file via ExcellentExport.
 */
async function handleDownloadExcel() {
    const range = getCurrentDateRange();
    const duties = getAllDuties();
    const totalDays = range.end_date.diff(range.start_date, 'day');

    if (duties.length < totalDays) {
        showConfirmModal({
            title: '班表未排滿',
            message: `目前排定天數 (${duties.length} 天) 少於該區間總天數 (${totalDays} 天)，確定仍要下載 Excel 嗎？`,
            confirmText: '仍要下載',
            confirmClass: 'btn-warning',
            onConfirm: () => doExportExcel(),
        });
    } else {
        doExportExcel();
    }

    async function doExportExcel() {
        try {
            // Build temporary HTML Table for ExcellentExport
            const dutiesMap = {};
            duties.forEach(([d, p]) => { dutiesMap[d] = p; });

            let tableHtml = '<table id="duties_datatable" class="d-none">';
            for (let i = 0; i < state.monthSpan; i++) {
                const monthStart = state.currentMonth.clone().add(i, 'month').startOf('month');
                const monthEnd = monthStart.clone().endOf('month').startOf('day');
                const viewStart = monthStart.startOf('isoWeek');
                const viewEnd = monthEnd.endOf('isoWeek').startOf('day');

                tableHtml += `<tr><td colspan="7"><b>${monthStart.format('YYYY / MM')}</b></td></tr>`;

                for (let cur = viewStart.clone(); cur.isBefore(viewEnd) || cur.isSame(viewEnd, 'day'); cur = cur.add(7, 'day')) {
                    // Header row (dates)
                    tableHtml += '<tr>';
                    for (let day = 0; day < 7; day++) {
                        const d = cur.add(day, 'day');
                        tableHtml += `<th>${d.format('MM/DD')}</th>`;
                    }
                    tableHtml += '</tr><tr>';
                    // Content row (duties)
                    for (let day = 0; day < 7; day++) {
                        const dStr = cur.add(day, 'day').format('YYYY-MM-DD');
                        const person = dutiesMap[dStr] || '';
                        tableHtml += `<td>${person}</td>`;
                    }
                    tableHtml += '</tr>';
                }
                tableHtml += '<tr><td colspan="7"></td></tr>';
            }
            tableHtml += '</table>';

            const container = document.getElementById('duties_datatable_div');
            container.innerHTML = tableHtml;

            const { default: ExcellentExport } = await import('excellentexport');
            const filename = `random_duty_${range.month_str}`;
            ExcellentExport.convert(
                { openAsDownload: true, filename: filename, format: 'xlsx' },
                [{ name: '值班表', from: { table: 'duties_datatable' } }]
            );
            showToast('success', '匯出成功', `已下載 Excel 值班表：${filename}.xlsx`);
        } catch (err) {
            console.error('Excel export failed:', err);
            showToast('error', '匯出失敗', '無法產生 Excel 檔案。');
        }
    }
}

/**
 * Clear all local storage preferences and drafts.
 */
function handleClearAllStorage() {
    showConfirmModal({
        title: '清除本機紀錄',
        message: '確定要清除所有本機儲存的偏好設定與排班草稿嗎？這將會重置所有參數並清空畫面上的排班資料。',
        confirmText: '清除並重置',
        confirmClass: 'btn-danger',
        onConfirm: () => {
            clearAllStorage();

            // Reset state
            state.people = 4;
            state.monthSpan = 1;
            state.useQodLimit = true;
            state.qodLimit = 1;
            state.useWeekHoursLimit = true;
            state.weekHoursLimit = 80;
            state.autoSaveDraft = true;
            state.deletedHolidays.clear();
            state.customHolidays = [];
            state.customPatterns = null;
            state.isAlreadyRandomDuty = false;
            state.currentMonth = dayjs().add(1, 'month').startOf('month');

            // Reset UI form elements
            document.getElementById('inputPeopleSlider').value = 4;
            document.getElementById('people_val_badge').textContent = '4 人';
            document.getElementById('inputQodLimitSlider').value = 1;
            document.getElementById('qod_val_badge').textContent = '1 次';
            document.getElementById('use_qod_limit').checked = true;
            document.getElementById('inputQodLimitSlider').disabled = false;
            document.getElementById('inputWeekHoursLimitSlider').value = 80;
            document.getElementById('week_hours_val_badge').textContent = '80 小時';
            document.getElementById('use_week_hours_limit').checked = true;
            document.getElementById('inputWeekHoursLimitSlider').disabled = false;
            document.getElementById('auto_save_draft_switch').checked = true;

            setMonthSpan(1);
            resetToDefaultMonth();

            // Clear events on calendars
            const cals = [state.cal1, state.cal2].filter(Boolean);
            cals.forEach(cal => cal.removeAllEvents());
            state.cal1.refetchEvents();
            if (state.cal2) state.cal2.refetchEvents();

            showToast('success', '已重置', '已清除所有本機儲存紀錄並恢復預設值。');
        },
    });
}

/**
 * Restore draft data if present in localStorage.
 */
function restoreDraftIfAvailable() {
    const draft = loadDraft();
    if (!draft) return;

    if (draft.currentMonth) {
        state.currentMonth = dayjs(draft.currentMonth);
        state.cal1.gotoDate(draft.currentMonth);
        if (state.cal2) {
            state.cal2.gotoDate(state.currentMonth.clone().add(1, 'month').format('YYYY-MM-01'));
        }
        updateCalendarToolbar();
    }

    if (Array.isArray(draft.deletedHolidays)) {
        state.deletedHolidays = new Set(draft.deletedHolidays);
    }

    if (Array.isArray(draft.customHolidays)) {
        state.customHolidays = draft.customHolidays;
        draft.customHolidays.forEach(h => {
            const bgEvent = {
                id: `${h.id}_bg`,
                start: h.date,
                display: 'background',
                classNames: ['holiday-bg-event'],
                allDay: true,
            };
            const fgEvent = {
                id: h.id,
                title: h.title,
                start: h.date,
                classNames: ['holiday-event'],
                allDay: true,
                editable: false,
            };
            state.cal1.addEvent(bgEvent);
            state.cal1.addEvent(fgEvent);
            if (state.cal2) {
                state.cal2.addEvent(bgEvent);
                state.cal2.addEvent(fgEvent);
            }
        });
    }

    if (draft.customPatterns) {
        state.customPatterns = draft.customPatterns;
    }

    if (Array.isArray(draft.presetDuties)) {
        draft.presetDuties.forEach(([dStr, pNo]) => {
            const newEvt = {
                id: generateEventId('preset_duty', dStr, pNo),
                title: String(pNo),
                start: dStr,
                allDay: true,
                classNames: ['preset-duty-event'],
                backgroundColor: get_duty_color(pNo),
                borderColor: get_duty_color(pNo),
                editable: true,
            };
            state.cal1.addEvent(newEvt);
            if (state.cal2) state.cal2.addEvent(newEvt);
        });
    }

    if (Array.isArray(draft.presetNonDuties)) {
        draft.presetNonDuties.forEach(([dStr, pNo]) => {
            const newEvt = {
                id: generateEventId('preset_non_duty', dStr, pNo),
                title: String(pNo),
                start: dStr,
                allDay: true,
                classNames: ['preset-non-duty-event'],
                editable: true,
            };
            state.cal1.addEvent(newEvt);
            if (state.cal2) state.cal2.addEvent(newEvt);
        });
    }

    if (Array.isArray(draft.generatedDuties) && draft.generatedDuties.length > 0) {
        draft.generatedDuties.forEach(([dStr, pNo]) => {
            const newEvt = {
                id: generateEventId('duty', dStr, pNo),
                title: String(pNo),
                start: dStr,
                allDay: true,
                classNames: ['duty-event'],
                backgroundColor: get_duty_color(pNo),
                borderColor: get_duty_color(pNo),
                editable: true,
            };
            state.cal1.addEvent(newEvt);
            if (state.cal2) state.cal2.addEvent(newEvt);
        });
        state.isAlreadyRandomDuty = true;
    }

    updateSuggestedPatterns();
    updateSummaryDuties(calculate_group_duties(getAllDuties()));
    showToast('info', '草稿已還原', '已還原上次暫存之排班草稿。');
}

/**
 * Initialize DOM listeners and load saved preferences.
 */
function initApp() {
    // App Version badge
    const versionEl = document.getElementById('appVersion');
    if (versionEl) {
        /* global __APP_VERSION__ */
        versionEl.textContent = `v${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.2.0'}`;
    }

    // Initialize Bootstrap Modals
    calEventModal = new bootstrap.Modal(document.getElementById('calEventModal'));
    editPatternModal = new bootstrap.Modal(document.getElementById('editPatternModal'));
    dialogModal = new bootstrap.Modal(document.getElementById('dialogModal'));

    // Load saved preferences
    const prefs = loadPreferences();
    state.monthSpan = prefs.mode_switch ? 2 : 1;
    state.people = prefs.inputPeopleSlider || 4;
    state.useQodLimit = prefs.use_qod_limit !== false;
    state.qodLimit = prefs.inputQodLimitSlider ?? 1;
    state.useWeekHoursLimit = prefs.use_week_hours_limit !== false;
    state.weekHoursLimit = prefs.inputWeekHoursLimitSlider || 80;
    state.autoSaveDraft = prefs.auto_save_draft !== false;

    // Apply preferences to UI controls
    document.getElementById('inputPeopleSlider').value = state.people;
    document.getElementById('people_val_badge').textContent = `${state.people} 人`;

    document.getElementById('use_qod_limit').checked = state.useQodLimit;
    document.getElementById('inputQodLimitSlider').value = state.qodLimit;
    document.getElementById('inputQodLimitSlider').disabled = !state.useQodLimit;
    document.getElementById('qod_val_badge').textContent = `${state.qodLimit} 次`;

    document.getElementById('use_week_hours_limit').checked = state.useWeekHoursLimit;
    document.getElementById('inputWeekHoursLimitSlider').value = state.weekHoursLimit;
    document.getElementById('inputWeekHoursLimitSlider').disabled = !state.useWeekHoursLimit;
    document.getElementById('week_hours_val_badge').textContent = `${state.weekHoursLimit} 小時`;

    document.getElementById('auto_save_draft_switch').checked = state.autoSaveDraft;

    // Setup Segmented Control for Month Span
    document.getElementById('mode_1m').addEventListener('change', () => setMonthSpan(1));
    document.getElementById('mode_2m').addEventListener('change', () => setMonthSpan(2));

    // Setup Slider & Switch Listeners
    document.getElementById('inputPeopleSlider').addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        state.people = val;
        document.getElementById('people_val_badge').textContent = `${val} 人`;
        savePreferences({ inputPeopleSlider: val });
        updateSuggestedPatterns();
    });

    document.getElementById('use_qod_limit').addEventListener('change', (e) => {
        state.useQodLimit = e.target.checked;
        document.getElementById('inputQodLimitSlider').disabled = !state.useQodLimit;
        savePreferences({ use_qod_limit: state.useQodLimit });
    });

    document.getElementById('inputQodLimitSlider').addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        state.qodLimit = val;
        document.getElementById('qod_val_badge').textContent = `${val} 次`;
        savePreferences({ inputQodLimitSlider: val });
    });

    document.getElementById('use_week_hours_limit').addEventListener('change', (e) => {
        state.useWeekHoursLimit = e.target.checked;
        document.getElementById('inputWeekHoursLimitSlider').disabled = !state.useWeekHoursLimit;
        savePreferences({ use_week_hours_limit: state.useWeekHoursLimit });
    });

    document.getElementById('inputWeekHoursLimitSlider').addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        state.weekHoursLimit = val;
        document.getElementById('week_hours_val_badge').textContent = `${val} 小時`;
        savePreferences({ inputWeekHoursLimitSlider: val });
    });

    document.getElementById('auto_save_draft_switch').addEventListener('change', (e) => {
        state.autoSaveDraft = e.target.checked;
        savePreferences({ auto_save_draft: state.autoSaveDraft });
        if (state.autoSaveDraft) {
            triggerAutoSaveDraft();
            showToast('info', '草稿自動暫存已啟用', '排班進度異動將即時儲存於本機。');
        } else {
            showToast('warning', '草稿自動暫存已關閉', '本機排班草稿已清除，重整將不會保留排班進度。');
        }
    });

    // Calendar Navigation Listeners
    document.getElementById('prev_month').addEventListener('click', () => navigateMonth(-1));
    document.getElementById('next_month').addEventListener('click', () => navigateMonth(1));
    document.getElementById('today_next_month').addEventListener('click', resetToDefaultMonth);

    // Event Modal Radio category toggle
    document.querySelectorAll('input[name="eventProp"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const isHoliday = e.target.value === 'eventPropHoliday';
            document.getElementById('person_select_group').classList.toggle('d-none', isHoliday);
            document.getElementById('holiday_input_group').classList.toggle('d-none', !isHoliday);
        });
    });

    // Event Modal buttons
    document.getElementById('btn_save_cal_event').addEventListener('click', handleSaveCalEvent);
    document.getElementById('btn_delete_cal_event').addEventListener('click', handleDeleteCalEvent);

    // Pattern buttons
    document.getElementById('func_get_holiday_condition').addEventListener('click', () => {
        state.customPatterns = null; // reset custom
        updateSuggestedPatterns();
        triggerAutoSaveDraft();
        showToast('info', '排班樣式已更新', '已重新隨機生成排班樣式。');
    });
    document.getElementById('func_edit_duty_patterns').addEventListener('click', openPatternEditor);
    document.getElementById('btn_save_pattern').addEventListener('click', handleSavePattern);

    // Random Duty & Clear buttons
    document.getElementById('func_random_duty').addEventListener('click', executeRandomDuty);
    document.getElementById('func_clear_calendar').addEventListener('click', clearGeneratedDuties);
    document.querySelectorAll('.btn_stop_random_duty_worker').forEach(btn => {
        btn.addEventListener('click', () => {
            if (state.worker) {
                state.worker.terminate();
                state.worker = null;
            }
            document.getElementById('loadingOverlay').classList.add('d-none');
            showToast('info', '運算已取消', '已終止排班背景運算。');
        });
    });

    // Download buttons
    document.getElementById('func_download_screenshot').addEventListener('click', handleDownloadScreenshot);
    document.getElementById('func_download_excel').addEventListener('click', handleDownloadExcel);

    // Clear all storage button
    document.getElementById('func_clear_local_storage').addEventListener('click', handleClearAllStorage);

    // Initialize Calendars
    initCalendars();
    setMonthSpan(state.monthSpan);

    // Restore draft if present
    setTimeout(() => {
        restoreDraftIfAvailable();
        updateSuggestedPatterns();
    }, 300);
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
