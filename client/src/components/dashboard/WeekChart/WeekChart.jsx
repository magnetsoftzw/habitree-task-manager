import { formatDuration, shiftDateKey, toDateKey } from '../../../utils/Format';
import './WeekChart.css';

const LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const mondayKey = (date = new Date()) => {
    const offset = (date.getDay() + 6) % 7;
    return shiftDateKey(toDateKey(date), -offset);
};

const WeekChart = ({ stats = [] }) => {
    const byDay = Object.fromEntries(stats.map((s) => [s._id, s.totalMinutes || 0]));
    const today = toDateKey();
    const start = mondayKey();

    const days = LABELS.map((label, i) => {
        const key = shiftDateKey(start, i);
        return { label, key, minutes: byDay[key] || 0, isToday: key === today, isFuture: key > today };
    });

    const total = days.reduce((sum, d) => sum + d.minutes, 0);
    const max = Math.max(240, ...days.map((d) => d.minutes));

    return (
        <section className="card" aria-labelledby="week-h">
            <div className="week-chart-head">
                <h2 id="week-h" className="card-title sm">This week</h2>
                <span className="muted week-chart-total">{formatDuration(total)} focused</span>
            </div>
            <div
                className="week-chart-bars"
                role="img"
                aria-label={`Focus minutes per day this week, ${formatDuration(total)} total`}
            >
                {days.map((d) => {
                    const tone = d.isToday ? 'is-today' : d.isFuture || d.minutes === 0 ? 'is-empty' : 'is-past';
                    const height = d.minutes === 0 ? 4 : Math.max(6, Math.round((d.minutes / max) * 100));
                    return (
                        <div key={d.key} className="week-chart-col">
                            <div className={`week-chart-bar ${tone}`} style={{ height: `${height}%` }} title={`${d.label}: ${formatDuration(d.minutes)}`} />
                        </div>
                    );
                })}
            </div>
            <div className="week-chart-labels" aria-hidden="true">
                {days.map((d) => (
                    <span key={d.key} className={d.isToday ? 'is-today' : ''}>{d.label}</span>
                ))}
            </div>
            {total === 0 && <p className="week-chart-empty">No focus time logged this week yet. Start a session to fill this in.</p>}
        </section>
    );
};

export default WeekChart;
