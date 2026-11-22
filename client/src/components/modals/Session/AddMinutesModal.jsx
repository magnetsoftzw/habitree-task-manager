import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import Modal from '../../ui/Modal';
import { formatLongDate, fromDateKey, toDateKey } from '../../../utils/Format';
import '../Project/ProjectModals.css';
import './Session.css';

const QUICK_PICKS = [15, 25, 45, 60, 90];
const MAX = 720;

const nowTime = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const AddMinutesModal = (props) => (props.isOpen ? <LogTimeDialog {...props} /> : null);

const LogTimeDialog = ({ onClose, onAdd, loading, activeDate }) => {
    const today = toDateKey();
    const day = activeDate || today;
    const isToday = day === today;
    const [minutes, setMinutes] = useState(25);
    const [endTime, setEndTime] = useState(isToday ? nowTime() : '17:00');
    const [error, setError] = useState('');
    const clamp = (v) => Math.max(1, Math.min(MAX, Math.round(v) || 1));

    const submit = (e) => {
        e.preventDefault();
        const [h, m] = endTime.split(':').map(Number);
        const end = fromDateKey(day);
        end.setHours(h || 0, m || 0, 0, 0);
        if (end - new Date() > 60000) return setError("That's in the future. Pick a time that has already passed.");
        const start = new Date(end.getTime() - minutes * 60000);
        onAdd({ minutes, startTime: start.toISOString(), endTime: end.toISOString() });
    };

    return (
        <Modal
            isOpen
            onClose={onClose}
            title="Log focus time"
            subtitle={`Add time you worked away from the timer${isToday ? ' today' : ` on ${formatLongDate(fromDateKey(day))}`}.`}
            width={460}
            footer={(
                <>
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" form="log-time-form" className="btn btn-primary" disabled={loading}>
                        {loading ? 'Saving…' : `Log ${minutes} min`}
                    </button>
                </>
            )}
        >
            <form id="log-time-form" className="pm-form" onSubmit={submit}>
                <div className="ss-body">
                    <div className="ss-dial">
                        <button type="button" className="icon-btn" aria-label="Five minutes less" onClick={() => setMinutes((v) => clamp(v - 5))} disabled={minutes <= 1}>
                            <Minus size={18} />
                        </button>
                        <label className="ss-value">
                            <input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={MAX}
                                value={minutes}
                                aria-label="Minutes worked"
                                onChange={(e) => setMinutes(clamp(Number(e.target.value)))}
                            />
                            <span>minutes</span>
                        </label>
                        <button type="button" className="icon-btn" aria-label="Five minutes more" onClick={() => setMinutes((v) => clamp(v + 5))} disabled={minutes >= MAX}>
                            <Plus size={18} />
                        </button>
                    </div>
                    <div role="group" aria-label="Quick picks" className="ss-presets">
                        {QUICK_PICKS.map((p) => (
                            <button key={p} type="button" className="ss-preset" aria-pressed={minutes === p} onClick={() => setMinutes(p)}>{p} min</button>
                        ))}
                    </div>
                </div>
                <label className="field">
                    <span className="field-label">Finished at</span>
                    <input type="time" className="input" value={endTime} required onChange={(e) => { setEndTime(e.target.value); setError(''); }} />
                </label>
                {error && <p className="pm-error" role="alert">{error}</p>}
            </form>
        </Modal>
    );
};

export default AddMinutesModal;
