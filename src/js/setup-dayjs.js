import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import duration from 'dayjs/plugin/duration';

dayjs.extend(isoWeek);
dayjs.extend(duration);

export default dayjs;
