import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek.js';
import duration from 'dayjs/plugin/duration.js';

dayjs.extend(isoWeek);
dayjs.extend(duration);

export default dayjs;
