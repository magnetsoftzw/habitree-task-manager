import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw } from 'lucide-react';
import ScheduleClock from './ScheduleClock';
import ShiftConfirmModal from './ShiftConfirmModal';
import { resolveEntry } from '../../utils/Planner';
import { toDateKey } from '../../utils/Format';
import {
    DAY, HALF, clockLabel, durationLabel, entriesInPeriod, periodOfEntry, rangeLabel, toMinutes, workPeriods,
} from '../../utils/Schedule';
import { fetchSchedule, resetSchedule, resizeSchedule, shiftSchedule } from '../../store/slices/scheduleSlice';
import './Schedule.css';

const STEP = 15;
const EMPTY = [];

const nowMinutes = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
};

const DaySchedule = ({ date, entries = EMPTY, onChanged, onAddInPeriod, compact = false }) => {
    const dispatch = useDispatch();
    const day = useSelector((s) => s.schedule.byDate[date]);
    const error = useSelector((s) => s.schedule.errors[date]);
    const isToday = date === toDateKey();
    const [now] = useState(nowMinutes);
    const [half, setHalf] = useState(() => (isToday && now >= HALF ? 1 : 0));
    const [selectedKey, setSelectedKey] = useState(null);
    const [pending, setPending] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        dispatch(fetchSchedule(date));
    }, [dispatch, date]);

    const segments = day?.segments || EMPTY;
    const planned = useMemo(() => entries.filter((e) => e.taskId), [entries]);
    const outside = planned.filter((e) => e.time && !periodOfEntry(segments, e));

    const fallbackKey = useMemo(() => {
        if (!segments.length) return null;
        if (isToday) {
            const hit = segments.find((s) => now >= s.start && now < s.end);
            if (hit) return hit.key;
        }
        return workPeriods(segments)[0]?.key || segments[0].key;
    }, [segments, isToday, now]);

    const activeKey = segments.some((s) => s.key === selectedKey) ? selectedKey : fallbackKey;
    const selected = segments.find((s) => s.key === activeKey) || null;

    const select = (key, reveal = false) => {
        setSelectedKey(key);
        const seg = segments.find((s) => s.key === key);
        if (reveal && seg && !(seg.start < (half + 1) * HALF && seg.end > half * HALF)) setHalf(seg.start >= HALF && seg.start < DAY ? 1 : 0);
    };

    const run = async (change, confirm = false) => {
        const { segment, offset, edge } = change;
        setBusy(true);
        try {
            const thunk = edge
                ? resizeSchedule({ date, segmentKey: segment.key, edge, offsetMinutes: offset, confirm })
                : shiftSchedule({ date, segmentKey: segment.key, offsetMinutes: offset, confirm });
            const result = await dispatch(thunk).unwrap();
            setPending(null);
            const shelved = result.preview?.removed?.length || 0;
            const growth = edge === 'start' ? -offset : offset;
            const what = edge
                ? `${segment.label} is ${durationLabel(Math.abs(offset))} ${growth > 0 ? 'longer' : 'shorter'}`
                : `${segment.label} moved ${durationLabel(Math.abs(offset))} ${offset > 0 ? 'later' : 'earlier'}`;
            toast.success(`${what}${shelved ? ` · ${shelved} shelved` : ''}`);
            onChanged?.();
        } catch (err) {
            if (err?.requiresConfirmation) setPending({ ...change, preview: err.preview });
            else if (err?.status === 400 && err.message) toast.error(`${segment.label}: ${err.message.charAt(0).toLowerCase()}${err.message.slice(1)}`);
            else toast.error(err?.message || (edge ? "Couldn't resize that segment." : "Couldn't move that work period."));
        } finally {
            setBusy(false);
        }
    };

    const runShift = (segment, offset) => run({ segment, offset });
    const runResize = (segment, edge, offset) => run({ segment, edge, offset });
    const isFinal = selected && segments[segments.length - 1]?.key === selected.key;

    const reset = () => {
        dispatch(resetSchedule(date)).unwrap()
            .then(() => { toast.success('Back to your daily template'); onChanged?.(); })
            .catch((err) => toast.error(err?.status === 409
                ? `Can't reset: ${err.entries?.length || 'some'} planned ${err.entries?.length === 1 ? 'item' : 'items'} would sit outside the template's work periods. Move or remove ${err.entries?.length === 1 ? 'it' : 'them'} first.`
                : err?.message || "Couldn't reset this day."));
    };

    if (!day) {
        return (
            <div className="sc-status">
                {error ? (
                    <>
                        <span>{error}</span>
                        <button type="button" className="btn btn-sm" onClick={() => dispatch(fetchSchedule(date))}>Try again</button>
                    </>
                ) : 'Loading schedule…'}
            </div>
        );
    }

    const periodTasks = selected?.kind === 'work' ? entriesInPeriod(selected, planned) : EMPTY;
    const periods = workPeriods(segments);
    const isLast = selected && periods[periods.length - 1]?.key === selected.key;

    return (
        <div className={`sc ${compact ? 'is-compact' : ''}`}>
            <div className="sc-top">
                <div role="group" aria-label="Half of the day" className="segmented sc-toggle">
                    <button type="button" className="segmented-option" aria-pressed={half === 0} onClick={() => setHalf(0)}>12 AM–12 PM</button>
                    <button type="button" className="segmented-option" aria-pressed={half === 1} onClick={() => setHalf(1)}>12 PM–12 AM</button>
                </div>
                {day.isOverride && (
                    <button type="button" className="sc-reset" onClick={reset} title="Use the daily template for this day">
                        <RotateCcw size={14} aria-hidden="true" /> Adjusted · Reset
                    </button>
                )}
            </div>

            <div className="sc-body">
                <div className="sc-chart">
                    <ScheduleClock
                        segments={segments}
                        entries={planned}
                        half={half}
                        selectedKey={activeKey}
                        onSelect={select}
                        onDragShift={(seg, offset) => runShift(segments.find((s) => s.key === seg.key) || seg, offset)}
                        onResize={(seg, edge, offset) => runResize(segments.find((s) => s.key === seg.key) || seg, edge, offset)}
                        nowMinute={isToday ? now : null}
                    />
                    <p className="sc-hint">Select a segment for details. Drag a coloured work period to move it, or drag the circles at its ends to make it longer or shorter.</p>
                </div>

                {selected && (
                    <section className="sc-detail" aria-live="polite" aria-label="Selected segment">
                        <div className="sc-detail-head">
                            <span
                                className={`sc-swatch ${selected.kind === 'work' ? '' : 'is-blank'}`}
                                style={selected.kind === 'work' ? { background: selected.color } : undefined}
                                aria-hidden="true"
                            />
                            <div className="sc-detail-text">
                                <h3>{selected.label}</h3>
                                <span className="sc-detail-time tabular">
                                    {rangeLabel(selected.start, selected.end)} · {durationLabel(selected.end - selected.start)}
                                </span>
                            </div>
                        </div>

                        {selected.kind === 'personal' ? (
                            <p className="sc-detail-note">Personal time. Work tasks can't be scheduled here.</p>
                        ) : (
                            <>
                                {periodTasks.length ? (
                                    <ol className="sc-tasks">
                                        {periodTasks.map((e) => {
                                            const r = resolveEntry(e);
                                            return (
                                                <li key={e._id}>
                                                    <span className="sc-task-time tabular">{clockLabel(toMinutes(e.time))}</span>
                                                    <span className="sc-task-title">{r?.title || 'Task'}</span>
                                                    <span className="sc-task-dur tabular">{durationLabel(e.duration || 30)}</span>
                                                </li>
                                            );
                                        })}
                                    </ol>
                                ) : (
                                    <p className="sc-detail-note">No tasks scheduled in this period.</p>
                                )}
                                {onAddInPeriod && (
                                    <div className="sc-actions">
                                        <button type="button" className="btn btn-sm" onClick={() => onAddInPeriod(selected)}>
                                            <Plus size={14} aria-hidden="true" /> Add task
                                        </button>
                                    </div>
                                )}
                            </>
                        )}

                        <div className="sc-controls">
                            {!isFinal && (
                                <div className="sc-ctl" role="group" aria-label={`Length of ${selected.label}`}>
                                    <span className="sc-ctl-label">Length</span>
                                    <button type="button" className="btn btn-sm" disabled={busy} aria-label={`Make ${selected.label} ${STEP} minutes shorter`} onClick={() => runResize(selected, 'end', -STEP)}>
                                        <Minus size={14} aria-hidden="true" /> {STEP} min
                                    </button>
                                    <button type="button" className="btn btn-sm" disabled={busy} aria-label={`Make ${selected.label} ${STEP} minutes longer`} onClick={() => runResize(selected, 'end', STEP)}>
                                        <Plus size={14} aria-hidden="true" /> {STEP} min
                                    </button>
                                </div>
                            )}
                            {selected.kind === 'work' && (
                                <div className="sc-ctl" role="group" aria-label={`Move ${selected.label}`}>
                                    <span className="sc-ctl-label">Move</span>
                                    <button type="button" className="btn btn-sm" aria-label={`Move ${STEP} minutes earlier`} disabled={busy} onClick={() => runShift(selected, -STEP)}>
                                        <ChevronLeft size={14} aria-hidden="true" /> Earlier
                                    </button>
                                    <button type="button" className="btn btn-sm" aria-label={`Move ${STEP} minutes later`} disabled={busy} onClick={() => runShift(selected, STEP)}>
                                        Later <ChevronRight size={14} aria-hidden="true" />
                                    </button>
                                </div>
                            )}
                            <p className="sc-detail-foot">
                                {isFinal
                                    ? 'Drag the circle at its start to change when it begins. It always ends at 4:00 AM.'
                                    : `Longer pushes everything after it later. Shorter gives the time to ${segments[segments.findIndex((x) => x.key === selected.key) + 1]?.label || 'the next segment'}.${selected.kind === 'work' ? (isLast ? ' Moving this period later shortens Rest.' : ' Moving it takes the later periods along.') : ''} You're asked first if anything would be lost.`}
                            </p>
                        </div>
                    </section>
                )}
            </div>

            <ul className="sc-legend" aria-label="Day at a glance">
                {segments.map((s) => (
                    <li key={s.key}>
                        <button type="button" className={`sc-legend-item ${s.key === activeKey ? 'is-on' : ''}`} aria-pressed={s.key === activeKey} onClick={() => select(s.key, true)}>
                            <span className={`sc-swatch sm ${s.kind === 'work' ? '' : 'is-blank'}`} style={s.kind === 'work' ? { background: s.color } : undefined} aria-hidden="true" />
                            <span className="sc-legend-label">{s.label}</span>
                            <span className="sc-legend-time tabular">{clockLabel(s.start)}</span>
                        </button>
                    </li>
                ))}
            </ul>

            {outside.length > 0 && (
                <p className="sc-outside" role="note">
                    {outside.length} planned {outside.length === 1 ? 'item sits' : 'items sit'} outside the work periods. Move {outside.length === 1 ? 'it' : 'them'} into a work period.
                </p>
            )}

            <ShiftConfirmModal
                pending={pending}
                busy={busy}
                onCancel={() => setPending(null)}
                onConfirm={() => run(pending, true)}
            />
        </div>
    );
};

export default DaySchedule;
