import { useState } from 'react';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import Modal from '../../ui/Modal';
import SegmentedControl from '../../ui/SegmentedControl';
import { assignTaskToDate } from '../../../store/slices/plannerSlice';
import { formatLongDate, fromDateKey, nextHourTime, shiftDateKey, toDateKey } from '../../../utils/Format';
import './ProjectModals.css';

const DURATIONS = [15, 30, 45, 60, 90, 120];

const AddToPlanModal = (props) => (props.isOpen ? <AddToPlanDialog {...props} /> : null);

const AddToPlanDialog = ({ onClose, task, projectId, taskType = 'projectTask', subtask = null }) => {
    const dispatch = useDispatch();
    const today = toDateKey();
    const [when, setWhen] = useState('today');
    const [date, setDate] = useState(shiftDateKey(today, 2));
    const [time, setTime] = useState(nextHourTime());
    const [duration, setDuration] = useState(30);
    const [saving, setSaving] = useState(false);

    const target = when === 'today' ? today : when === 'tomorrow' ? shiftDateKey(today, 1) : date;

    const submit = async (e) => {
        e.preventDefault();
        if (!target) return;
        setSaving(true);
        try {
            await dispatch(assignTaskToDate({
                date: target,
                taskType,
                taskId: task._id,
                projectId: taskType === 'projectTask' ? projectId : undefined,
                subtaskId: subtask?._id || null,
                time: time || undefined,
                duration,
                comments: '',
            })).unwrap();
            toast.success(`Planned for ${when === 'today' ? 'today' : when === 'tomorrow' ? 'tomorrow' : formatLongDate(fromDateKey(target))}`);
            onClose();
        } catch (err) {
            toast.error(err?.message || 'Could not add that to your plan');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen
            onClose={onClose}
            title="Add to plan"
            subtitle={subtask ? `${subtask.title} · ${task.title}` : task.title}
            width={460}
            footer={(
                <>
                    <button type="button" className="btn" onClick={onClose}>Cancel</button>
                    <button type="submit" form="add-to-plan-form" className="btn btn-primary" disabled={saving}>
                        {saving ? 'Adding…' : 'Add to plan'}
                    </button>
                </>
            )}
        >
            <form id="add-to-plan-form" className="pm-form" onSubmit={submit}>
                <div className="field">
                    <span className="field-label" aria-hidden="true">Day</span>
                    <SegmentedControl
                        label="Day"
                        value={when}
                        onChange={setWhen}
                        options={[
                            { value: 'today', label: 'Today' },
                            { value: 'tomorrow', label: 'Tomorrow' },
                            { value: 'date', label: 'Pick a date' },
                        ]}
                    />
                </div>
                {when === 'date' && (
                    <label className="field">
                        <span className="field-label">Date</span>
                        <input type="date" className="input" value={date} min={today} required onChange={(e) => setDate(e.target.value)} />
                    </label>
                )}
                <div className="pm-row">
                    <label className="field">
                        <span className="field-label">Start time <span className="muted">(optional)</span></span>
                        <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
                    </label>
                    <label className="field">
                        <span className="field-label">Duration</span>
                        <select className="input" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                            {DURATIONS.map((d) => (
                                <option key={d} value={d}>{d < 60 ? `${d} min` : `${d / 60} h${d % 60 ? ` ${d % 60} min` : ''}`}</option>
                            ))}
                        </select>
                    </label>
                </div>
            </form>
        </Modal>
    );
};

export default AddToPlanModal;
