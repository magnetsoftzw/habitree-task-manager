import { Check, Play } from 'lucide-react';
import { resolveEntry } from '../../../utils/Planner';
import { addMinutesToTime } from '../../../utils/Format';
import './PlanBlock.css';

const PlanBlock = ({ entry, upNext = false, onOpen, onStart }) => {
    const info = resolveEntry(entry);

    if (!info) {
        return (
            <li className="plan-block">
                <div className="plan-block-time tabular">{entry.time}</div>
                <span className="plan-block-bar" style={{ background: 'var(--border-strong)' }} />
                <div className="plan-block-main">
                    <span className="plan-block-title muted">This task was deleted</span>
                </div>
            </li>
        );
    }

    const { state, title } = info;
    const statusLabel = state === 'done' ? 'Done' : state === 'now' ? 'In progress' : upNext ? 'Up next' : 'Planned';
    const pillTone = state === 'done' ? 'done' : state === 'now' ? 'on-hold' : 'not-started';

    return (
        <li className={`plan-block is-${state}`}>
            <div className="plan-block-time">
                <span className="plan-block-start tabular">{entry.time || '—'}</span>
                <span className="plan-block-end tabular">
                    {entry.time ? `to ${addMinutesToTime(entry.time, entry.duration || 30)}` : `${entry.duration || 30} min`}
                </span>
            </div>
            <span className="plan-block-bar" style={{ background: info.color }} />
            <button type="button" className="plan-block-main" onClick={() => onOpen?.(entry)}>
                <span className="plan-block-title">{title}</span>
                <span className="plan-block-meta">
                    <span className="plan-block-group">
                        <span className="plan-block-dot" style={{ background: info.color }} />
                        {info.group}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{info.kind}</span>
                    {info.subtask && (
                        <>
                            <span aria-hidden="true">·</span>
                            <span>Subtask of {info.task.title}</span>
                        </>
                    )}
                </span>
            </button>
            <span className={`pill pill-${pillTone}`}>{statusLabel}</span>
            {state === 'done' ? (
                <span className="plan-block-action is-done" role="img" aria-label="Completed">
                    <Check size={16} strokeWidth={2.4} />
                </span>
            ) : (
                <button
                    type="button"
                    className="plan-block-action"
                    aria-label={`Start session for ${title}`}
                    onClick={() => onStart?.(entry)}
                >
                    <Play size={14} fill="currentColor" />
                </button>
            )}
        </li>
    );
};

export default PlanBlock;
