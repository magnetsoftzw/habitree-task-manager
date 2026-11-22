import { List, Play } from 'lucide-react';
import useFocusLength from '../../../hooks/UseFocusLength';
import './FocusCard.css';

const clock = (minutes) => (minutes >= 60
    ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:00`
    : `${String(minutes).padStart(2, '0')}:00`);

const FocusCard = ({ taskTitle, onStart, onChooseTask }) => {
    const minutes = useFocusLength();
    return (
    <section className="focus-card" aria-labelledby="focus-h">
        <div className="focus-card-head">
            <h2 id="focus-h" className="focus-card-title">Focus session</h2>
            <span className="focus-card-meta">{minutes} min</span>
        </div>
        <div className="focus-card-body">
            <span className="focus-card-timer tabular">{clock(minutes)}</span>
            <span className="focus-card-task">{taskTitle || 'No task selected'}</span>
        </div>
        <div className="focus-card-actions">
            <button type="button" className="focus-card-cta" onClick={onStart}>
                <Play size={14} fill="currentColor" />
                Start focus
            </button>
            <button type="button" className="focus-card-pick" aria-label="Choose task for this session" onClick={onChooseTask}>
                <List size={18} />
            </button>
        </div>
    </section>
    );
};

export default FocusCard;
