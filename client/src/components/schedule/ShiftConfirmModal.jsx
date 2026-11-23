import { AlertTriangle } from 'lucide-react';
import Modal from '../ui/Modal';
import { clockLabel, durationLabel, rangeLabel } from '../../utils/Schedule';

const ShiftConfirmModal = ({ pending, onCancel, onConfirm, busy }) => {
    if (!pending) return null;
    const { segment, offset, edge, preview = {} } = pending;
    const growth = edge === 'start' ? -offset : offset;
    const removed = preview.removed || [];
    const shelving = removed.filter((r) => r.taskType !== 'projectTaskGroup').length;
    const restLost = preview.restLostMinutes || 0;
    const workLost = preview.workLostMinutes || 0;
    const last = (preview.segments || []).filter((s) => s.kind === 'work').pop();
    const direction = offset > 0 ? 'later' : 'earlier';

    return (
        <Modal
            isOpen
            onClose={onCancel}
            title={edge
                ? `Make ${segment.label} ${durationLabel(Math.abs(offset))} ${growth > 0 ? 'longer' : 'shorter'}?`
                : `Move ${segment.label} ${durationLabel(Math.abs(offset))} ${direction}?`}
            subtitle="This only changes this day. Your daily template stays the same."
            width={480}
            footer={(
                <>
                    <button type="button" className="btn" onClick={onCancel}>Cancel</button>
                    <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
                        {busy ? 'Saving…' : shelving ? `${edge ? 'Resize' : 'Move'} and shelve ${shelving}` : `${edge ? 'Resize' : 'Move'} anyway`}
                    </button>
                </>
            )}
        >
            <div className="sc-confirm">
                {restLost > 0 && (
                    <div className="sc-warn">
                        <AlertTriangle size={18} aria-hidden="true" />
                        <p>
                            You'll lose <strong>{durationLabel(restLost)}</strong> of rest. Rest will be
                            {' '}<strong>{rangeLabel(preview.rest?.start, preview.rest?.end)}</strong>.
                        </p>
                    </div>
                )}
                {workLost > 0 && (
                    <div className="sc-warn">
                        <AlertTriangle size={18} aria-hidden="true" />
                        <p>
                            Your last work period gets <strong>{durationLabel(workLost)}</strong> shorter
                            {last ? <>, ending at <strong>{clockLabel(last.end)}</strong></> : null}, so the day still ends on time.
                        </p>
                    </div>
                )}
                {removed.length > 0 && (
                    <>
                        <div className="sc-warn">
                            <AlertTriangle size={18} aria-hidden="true" />
                            <p>
                                {removed.length === 1
                                    ? <>This item no longer fits and will be removed from this day's plan. It's marked <strong>Shelved</strong> and stays in your tasks or project. Nothing is deleted.</>
                                    : <>These {removed.length} items no longer fit and will be removed from this day's plan. Each is marked <strong>Shelved</strong> and stays in your tasks or project. Nothing is deleted.</>}
                            </p>
                        </div>
                        <ul className="sc-removed">
                            {removed.map((r) => (
                                <li key={r.entryId}>
                                    <span className="sc-removed-title">
                                        {r.title || 'Task'}
                                        {r.parentTitle && <span className="sc-removed-parent"> · {r.parentTitle}</span>}
                                        {r.taskType === 'projectTaskGroup' && <span className="sc-removed-parent"> · Group, only removed from the plan</span>}
                                    </span>
                                    <span className="sc-removed-meta tabular">{r.time ? clockLabel(Number(r.time.slice(0, 2)) * 60 + Number(r.time.slice(3))) : ''} · {durationLabel(r.duration || 30)}</span>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </div>
        </Modal>
    );
};

export default ShiftConfirmModal;
