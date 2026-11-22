import { useEffect, useId, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import './FilterPopover.css';

const FilterPopover = ({ title, options, selected, onChange }) => {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    const panelId = useId();

    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => {
            if (!wrapRef.current?.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => {
            if (e.key === 'Escape') {
                setOpen(false);
                wrapRef.current?.querySelector('button')?.focus();
            }
        };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const toggle = (value) => {
        const next = new Set(selected);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        onChange(next);
    };

    return (
        <div className="filter-pop" ref={wrapRef}>
            <button
                type="button"
                className="btn"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                onClick={() => setOpen((v) => !v)}
            >
                <SlidersHorizontal size={16} aria-hidden="true" />
                Filters
                {selected.size > 0 && <span className="filter-pop-count">{selected.size}</span>}
            </button>
            {open && (
                <div className="filter-pop-panel" id={panelId} role="group" aria-label={title}>
                    <span className="filter-pop-title">{title}</span>
                    <div className="chip-row">
                        {options.map((o) => (
                            <button
                                key={o.value}
                                type="button"
                                className={`chip ${selected.has(o.value) ? 'is-on' : ''}`}
                                aria-pressed={selected.has(o.value)}
                                onClick={() => toggle(o.value)}
                            >
                                {o.label}
                            </button>
                        ))}
                    </div>
                    {selected.size > 0 && (
                        <button type="button" className="filter-pop-clear" onClick={() => onChange(new Set())}>Clear filters</button>
                    )}
                </div>
            )}
        </div>
    );
};

export default FilterPopover;
