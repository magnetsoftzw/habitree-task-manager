import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { fetchScheduleTemplate, updateTemplateSegment } from '../../store/slices/scheduleSlice';
import { DAY, clockLabel, rangeLabel, toHHMM, toMinutes } from '../../utils/Schedule';

const PERIOD_COLORS = ['#0F7A5C', '#2563EB', '#B45309', '#7C3AED', '#DB2777', '#0E7C7B', '#C2410C', '#4D7C0F'];

const LabelInput = ({ segment, onSave }) => {
    const [value, setValue] = useState(segment.label);
    const commit = () => {
        const v = value.trim();
        if (!v) {
            setValue(segment.label);
            return;
        }
        if (v !== segment.label) onSave({ label: v });
    };
    return (
        <input
            className="input st-sched-input"
            value={value}
            maxLength={40}
            aria-label={`Name for ${rangeLabel(segment.start, segment.end)}`}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') {
                    setValue(segment.label);
                    e.currentTarget.blur();
                }
            }}
        />
    );
};

const DAY_START = 240;

const fromInput = (value) => {
    const m = toMinutes(value);
    return m < DAY_START ? m + DAY : m;
};

const TimeInput = ({ segment, field, onSave }) => {
    const initial = toHHMM(segment[field] % DAY);
    const [value, setValue] = useState(initial);
    const commit = () => {
        if (!value) {
            setValue(initial);
            return;
        }
        const next = fromInput(value);
        if (next !== segment[field]) onSave({ [field]: next });
    };
    return (
        <input
            type="time"
            step={300}
            className="input st-sched-clock"
            value={value}
            aria-label={`${field === 'start' ? 'Start' : 'End'} time for ${segment.label}`}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') {
                    setValue(initial);
                    e.currentTarget.blur();
                }
            }}
        />
    );
};

const ScheduleTemplate = () => {
    const dispatch = useDispatch();
    const template = useSelector((s) => s.schedule.template);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        dispatch(fetchScheduleTemplate()).unwrap().catch(() => setFailed(true));
    }, [dispatch]);

    const save = (key, changes) => {
        dispatch(updateTemplateSegment({ key, changes }))
            .unwrap()
            .then(({ affected }) => {
                toast.success('Daily template updated');
                if (affected) toast(`${affected} planned ${affected === 1 ? 'item now falls' : 'items now fall'} outside your work periods. Check the dashboard to move ${affected === 1 ? 'it' : 'them'}.`, { icon: '⚠️', duration: 6000 });
            })
            .catch((err) => {
                toast.error(err?.message || "Couldn't save that change.");
                dispatch(fetchScheduleTemplate());
            });
    };

    return (
        <section id="schedule" className="st-card st-prefs" aria-labelledby="st-sched-h">
            <h2 id="st-sched-h" className="st-section-title">Daily schedule</h2>
            <p className="st-pref-help st-sched-intro">
                Your recurring day. Set when each segment starts, name and colour your work periods, and rename your personal time.
                {' '}Changing a time also moves the neighbouring segment's edge. Work periods end by midnight, and the day runs 4:00 AM to 4:00 AM.
                {' '}Days you've adjusted, and past days with plans, keep their times.
                {' '}To change a single day, adjust it on the dashboard. That never changes this template.
            </p>
            {!template ? (
                <p className="st-pref-help st-sched-intro">{failed ? "Couldn't load your template. Refresh to try again." : 'Loading…'}</p>
            ) : (
                <ul className="st-sched">
                    {template.segments.map((s, i) => (
                        <li key={`${s.key}:${s.label}:${s.start}:${s.end}`} className={`st-sched-row ${s.kind === 'work' ? 'is-work' : ''}`}>
                            <div className="st-sched-time tabular">
                                {i === 0
                                    ? <span className="st-sched-fixed" title="The day always starts at 4:00 AM">{clockLabel(s.start)}</span>
                                    : <TimeInput segment={s} field="start" onSave={(changes) => save(s.key, changes)} />}
                                <span className="st-sched-to" aria-hidden="true">–</span>
                                {i === template.segments.length - 1
                                    ? <span className="st-sched-fixed" title="The day always ends at 4:00 AM">{clockLabel(s.end % DAY)}</span>
                                    : <TimeInput segment={s} field="end" onSave={(changes) => save(s.key, changes)} />}
                            </div>
                            <LabelInput segment={s} onSave={(changes) => save(s.key, changes)} />
                            {s.kind === 'work' ? (
                                <div className="st-sched-colors" role="radiogroup" aria-label={`Colour for ${s.label}`}>
                                    {PERIOD_COLORS.map((c) => (
                                        <button
                                            key={c}
                                            type="button"
                                            role="radio"
                                            aria-checked={s.color?.toLowerCase() === c.toLowerCase()}
                                            aria-label={c}
                                            className="st-sched-swatch"
                                            style={{ background: c }}
                                            onClick={() => save(s.key, { color: c })}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <span className="st-sched-kind">Personal time</span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
};

export default ScheduleTemplate;
