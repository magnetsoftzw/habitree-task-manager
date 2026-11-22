import { useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import './Menu.css';

const Menu = ({ label, items, trigger }) => {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    const itemRefs = useRef([]);
    const menuId = useId();

    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => {
            if (!wrapRef.current?.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        itemRefs.current[0]?.focus();
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    const visible = items.filter(Boolean);

    const onKeyDown = (e, index) => {
        if (e.key === 'Escape') {
            setOpen(false);
            wrapRef.current?.querySelector('button')?.focus();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const next = (index + (e.key === 'ArrowDown' ? 1 : -1) + visible.length) % visible.length;
            itemRefs.current[next]?.focus();
        }
    };

    return (
        <div className="menu" ref={wrapRef}>
            <button
                type="button"
                className="menu-trigger"
                aria-label={label}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                onClick={() => setOpen((v) => !v)}
            >
                {trigger || <MoreHorizontal size={18} />}
            </button>
            {open && (
                <div className="menu-list" role="menu" id={menuId}>
                    {visible.map((item, i) => (
                        <button
                            key={item.label}
                            ref={(el) => { itemRefs.current[i] = el; }}
                            type="button"
                            role="menuitem"
                            className={`menu-item ${item.danger ? 'is-danger' : ''}`}
                            disabled={item.disabled}
                            onKeyDown={(e) => onKeyDown(e, i)}
                            onClick={() => {
                                setOpen(false);
                                item.onSelect?.();
                            }}
                        >
                            {item.icon}
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Menu;
