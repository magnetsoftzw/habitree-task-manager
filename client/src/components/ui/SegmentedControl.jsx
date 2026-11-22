import { useRef } from 'react';

const SegmentedControl = ({ options, value, onChange, label, role = 'radiogroup' }) => {
    const refs = useRef([]);
    const isTabs = role === 'tablist';

    const onKeyDown = (e, index) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const step = e.key === 'ArrowRight' ? 1 : -1;
        const next = (index + step + options.length) % options.length;
        onChange(options[next].value);
        refs.current[next]?.focus();
    };

    return (
        <div className="segmented" role={role} aria-label={label}>
            {options.map((opt, i) => {
                const selected = opt.value === value;
                return (
                    <button
                        key={opt.value}
                        ref={(el) => { refs.current[i] = el; }}
                        type="button"
                        className="segmented-option"
                        role={isTabs ? 'tab' : 'radio'}
                        {...(isTabs ? { 'aria-selected': selected } : { 'aria-checked': selected })}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onChange(opt.value)}
                        onKeyDown={(e) => onKeyDown(e, i)}
                    >
                        {opt.label}
                        {opt.count !== undefined && <span className="muted">{opt.count}</span>}
                    </button>
                );
            })}
        </div>
    );
};

export default SegmentedControl;
