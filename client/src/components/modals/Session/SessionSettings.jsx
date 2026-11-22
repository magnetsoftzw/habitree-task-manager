import { useState } from 'react';
import { Minus, Play, Plus } from 'lucide-react';
import Modal from '../../ui/Modal';
import { getFocusLength, saveFocusLength } from '../../../hooks/UseFocusLength';
import './Session.css';

const PRESETS = [20, 30, 40, 50, 60];
const MIN = 1;
const MAX = 180;

const SessionSettings = (props) => (props.isOpen ? <SessionSettingsDialog {...props} /> : null);

const SessionSettingsDialog = ({ onClose, onStart, taskTitle }) => {
    const [minutes, setMinutes] = useState(getFocusLength);
    const clamp = (v) => Math.max(MIN, Math.min(MAX, Math.round(v) || MIN));

    return (
        <Modal
            isOpen
            onClose={onClose}
            title="Start a focus session"
            subtitle={taskTitle ? `Working on ${taskTitle}` : 'No task selected — the time still counts toward your daily goal.'}
            width={460}
            footer={(
                <>
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="button" className="btn btn-primary" onClick={() => { saveFocusLength(minutes); onStart(minutes * 60); }}>
                        <Play size={14} fill="currentColor" aria-hidden="true" /> Start {minutes} min
                    </button>
                </>
            )}
        >
            <div className="ss-body">
                <div className="ss-dial">
                    <button type="button" className="icon-btn" aria-label="Five minutes less" onClick={() => setMinutes((m) => clamp(m - 5))} disabled={minutes <= MIN}>
                        <Minus size={18} />
                    </button>
                    <label className="ss-value">
                        <input
                            type="number"
                            inputMode="numeric"
                            min={MIN}
                            max={MAX}
                            value={minutes}
                            aria-label="Session length in minutes"
                            onChange={(e) => setMinutes(clamp(Number(e.target.value)))}
                        />
                        <span>minutes</span>
                    </label>
                    <button type="button" className="icon-btn" aria-label="Five minutes more" onClick={() => setMinutes((m) => clamp(m + 5))} disabled={minutes >= MAX}>
                        <Plus size={18} />
                    </button>
                </div>
                <div role="group" aria-label="Presets" className="ss-presets">
                    {PRESETS.map((p) => (
                        <button key={p} type="button" className="ss-preset" aria-pressed={minutes === p} onClick={() => setMinutes(p)}>
                            {p} min
                        </button>
                    ))}
                </div>
                <p className="ss-help">The timer starts right away. Stop it any time to save the minutes you've done.</p>
            </div>
        </Modal>
    );
};

export default SessionSettings;
