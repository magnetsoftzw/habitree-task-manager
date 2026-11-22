import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Pause, Play, RotateCcw, Square } from 'lucide-react';
import Modal from '../../ui/Modal';
import Logo from '../../../assets/logo.png';
import './Session.css';

const BELL_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
const RING = 2 * Math.PI * 96;

const pad = (n) => String(n).padStart(2, '0');
const clock = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
};

const SessionDialog = ({ initialSeconds, onClose, onFinish, taskTitle }) => {
    const saving = useSelector((state) => state.session.saving);
    const reminders = useSelector((state) => state.user.profile?.settings?.sessionReminders !== false);
    const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
    const [running, setRunning] = useState(true);
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    const [startedAt] = useState(() => Date.now());
    const endRef = useRef(startedAt + initialSeconds * 1000);
    const remindersRef = useRef(reminders);
    const bellRef = useRef(null);

    useEffect(() => {
        remindersRef.current = reminders;
    }, [reminders]);

    useEffect(() => {
        if (remindersRef.current && typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    useEffect(() => {
        if (!running || secondsLeft <= 0) return undefined;
        const interval = setInterval(() => {
            const remaining = Math.max(0, Math.ceil((endRef.current - Date.now()) / 1000));
            setSecondsLeft(remaining);
            if (remaining > 0) return;
            clearInterval(interval);
            setRunning(false);
            if (!remindersRef.current) return;
            bellRef.current = bellRef.current || new Audio(BELL_URL);
            bellRef.current.play().catch(() => {});
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                new Notification('Habitree: session complete', { body: 'Time for a break, or start the next task.', icon: Logo });
            }
        }, 500);
        return () => clearInterval(interval);
    }, [running, secondsLeft]);

    const elapsed = initialSeconds - secondsLeft;
    const finished = secondsLeft === 0;

    const toggle = () => {
        if (!running) endRef.current = Date.now() + secondsLeft * 1000;
        setRunning((r) => !r);
    };

    const reset = () => {
        endRef.current = Date.now() + initialSeconds * 1000;
        setSecondsLeft(initialSeconds);
        setRunning(true);
    };

    const finish = () => {
        const end = new Date();
        onFinish({
            startTime: new Date(end.getTime() - elapsed * 1000).toISOString(),
            endTime: end.toISOString(),
            durationMinutes: Math.floor(elapsed / 60),
        });
    };

    const requestClose = () => {
        if (saving) return;
        if (elapsed >= 60 && !confirmDiscard) setConfirmDiscard(true);
        else onClose();
    };

    const status = saving ? 'Saving…' : finished ? 'Session complete' : running ? 'Focusing' : 'Paused';

    return (
        <Modal
            isOpen
            onClose={requestClose}
            title={taskTitle || 'Focus session'}
            subtitle={status}
            width={440}
            footer={confirmDiscard ? (
                <>
                    <span className="sm-discard-text">Discard {Math.floor(elapsed / 60)} min of focus?</span>
                    <button type="button" className="btn btn-ghost" onClick={() => setConfirmDiscard(false)}>Keep going</button>
                    <button type="button" className="btn btn-danger" onClick={onClose}>Discard</button>
                </>
            ) : (
                <>
                    <button type="button" className="btn btn-ghost" onClick={requestClose} disabled={saving}>Discard</button>
                    <button type="button" className="btn btn-primary" onClick={finish} disabled={saving || elapsed < 60}>
                        <Square size={13} fill="currentColor" aria-hidden="true" /> {saving ? 'Saving…' : 'Finish & save'}
                    </button>
                </>
            )}
        >
            <div className="sm-body">
                <div className="sm-ring">
                    <svg viewBox="0 0 220 220" aria-hidden="true">
                        <circle cx="110" cy="110" r="96" fill="none" strokeWidth="12" className="sm-ring-track" />
                        <circle
                            cx="110" cy="110" r="96" fill="none" strokeWidth="12" strokeLinecap="round" className="sm-ring-fill"
                            strokeDasharray={RING} strokeDashoffset={RING * (secondsLeft / initialSeconds)} transform="rotate(-90 110 110)"
                        />
                    </svg>
                    <div className="sm-time">
                        <span className="sm-clock tabular" role="timer" aria-live="off">{clock(secondsLeft)}</span>
                        <span className="sm-sub">{clock(elapsed)} focused</span>
                    </div>
                </div>
                <div className="sm-controls">
                    <button type="button" className="btn" onClick={toggle} disabled={finished || saving}>
                        {running ? <Pause size={15} fill="currentColor" aria-hidden="true" /> : <Play size={15} fill="currentColor" aria-hidden="true" />}
                        {running ? 'Pause' : 'Resume'}
                    </button>
                    <button type="button" className="btn" onClick={reset} disabled={saving}>
                        <RotateCcw size={15} aria-hidden="true" /> Restart
                    </button>
                </div>
                {elapsed < 60 && <p className="sm-help">You can save once you've focused for a minute.</p>}
            </div>
        </Modal>
    );
};

const SessionModal = ({ isOpen, ...props }) => (isOpen ? <SessionDialog key={props.initialSeconds} {...props} /> : null);

export default SessionModal;
