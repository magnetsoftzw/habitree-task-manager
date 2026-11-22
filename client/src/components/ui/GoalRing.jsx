const GoalRing = ({ percent = 0, size = 76, stroke = 8, label }) => {
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    const r = 40 - stroke / 2 - 2;
    const circumference = 2 * Math.PI * r;
    const offset = circumference * (1 - clamped / 100);

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 80 80"
            role="img"
            aria-label={label || `${clamped} percent of daily goal`}
            style={{ flexShrink: 0 }}
        >
            <circle className="goal-ring-track" cx="40" cy="40" r={r} fill="none" strokeWidth={stroke} />
            <circle
                className="goal-ring-value"
                cx="40"
                cy="40"
                r={r}
                fill="none"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circumference.toFixed(1)}
                strokeDashoffset={offset.toFixed(1)}
                transform="rotate(-90 40 40)"
            />
            <text className="goal-ring-text" x="40" y="45" textAnchor="middle" fontSize="17">
                {clamped}%
            </text>
        </svg>
    );
};

export default GoalRing;
