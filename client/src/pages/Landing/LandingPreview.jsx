import BrandMark from '../../components/ui/BrandMark';

const NAV = ['Dashboard', 'Tasks', 'Projects', 'Roadmaps', 'Calendar', 'Analytics'];
const STATS = [
    { label: 'Daily goal', value: '2h 05m', note: 'of 8h focus target' },
    { label: 'Focus sessions', value: '3', note: '75 min average' },
    { label: 'Tasks completed', value: '1 / 23', note: '4% of all tasks' },
    { label: 'Planned today', value: '4', note: '1 done · 3 to go' },
];
const PLAN = [
    { time: '08:00', title: 'Watch Smart Money Concepts', group: 'Forex', color: '#1F5FAD', state: 'Done' },
    { time: '10:00', title: 'React Native Practice', group: 'React Native', color: '#C2185B', state: 'In progress' },
    { time: '13:00', title: 'Watch Tailwind CSS Tutorials', group: 'Uncategorized', color: '#6B7280', state: 'Up next' },
    { time: '15:30', title: 'Demo Task', group: 'Demo', color: '#6B5BD2', state: 'Planned' },
];
const WEEK = [95, 140, 60, 180, 125, 0, 0];

const LandingPreview = () => (
    <div className="lp" aria-hidden="true">
        <div className="lp-chrome">
            <span /><span /><span />
            <em>habitree.vercel.app/dashboard</em>
        </div>
        <div className="lp-app">
            <aside className="lp-side">
                <div className="lp-brand"><span><BrandMark size={14} /></span>Habitree</div>
                {NAV.map((n, i) => <div key={n} className={`lp-nav ${i === 0 ? 'is-active' : ''}`}>{n}</div>)}
            </aside>
            <div className="lp-main">
                <div className="lp-date">Friday 20 November</div>
                <div className="lp-hello">Good morning, demoUser</div>
                <div className="lp-stats">
                    {STATS.map((s) => (
                        <div key={s.label} className="lp-stat">
                            <span>{s.label}</span>
                            <strong>{s.value}</strong>
                            <small>{s.note}</small>
                        </div>
                    ))}
                </div>
                <div className="lp-row">
                    <div className="lp-card lp-plan">
                        <div className="lp-card-title">Today's plan</div>
                        {PLAN.map((p) => (
                            <div key={p.time} className={`lp-block ${p.state === 'In progress' ? 'is-now' : ''}`}>
                                <span className="lp-time">{p.time}</span>
                                <span className="lp-bar" style={{ background: p.color }} />
                                <span className="lp-block-text">
                                    <b>{p.title}</b>
                                    <small>{p.group}</small>
                                </span>
                                <span className="lp-state">{p.state}</span>
                            </div>
                        ))}
                    </div>
                    <div className="lp-col">
                        <div className="lp-focus">
                            <span>Focus session</span>
                            <strong>25:00</strong>
                            <small>React Native Practice</small>
                            <div className="lp-focus-btn">Start focus</div>
                        </div>
                        <div className="lp-card">
                            <div className="lp-card-title">This week</div>
                            <div className="lp-week">
                                {WEEK.map((m, i) => (
                                    <span key={i} className={i === 4 ? 'is-today' : m ? '' : 'is-empty'} style={{ height: `${Math.max(4, (m / 180) * 100)}%` }} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

export default LandingPreview;
