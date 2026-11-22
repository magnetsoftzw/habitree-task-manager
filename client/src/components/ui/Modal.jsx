import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './Modal.css';

const Modal = ({ isOpen, onClose, title, subtitle, children, footer, width = 520 }) => {
    const dialogRef = useRef(null);
    const closeRef = useRef(onClose);
    const titleId = useId();

    useEffect(() => {
        closeRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const previous = document.activeElement;
        const onKey = (e) => {
            if (e.key === 'Escape') closeRef.current?.();
        };
        document.addEventListener('keydown', onKey);
        const firstField = dialogRef.current?.querySelector('input, select, textarea, button:not(.modal-close)');
        firstField?.focus();
        return () => {
            document.removeEventListener('keydown', onKey);
            previous?.focus?.();
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
            <div
                ref={dialogRef}
                className="modal-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                style={{ maxWidth: width }}
            >
                <header className="modal-head">
                    <div className="modal-head-text">
                        <h2 id={titleId} className="modal-title">{title}</h2>
                        {subtitle && <p className="modal-subtitle">{subtitle}</p>}
                    </div>
                    <button type="button" className="icon-btn modal-close" aria-label="Close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </header>
                <div className="modal-body">{children}</div>
                {footer && <footer className="modal-foot">{footer}</footer>}
            </div>
        </div>,
        document.body
    );
};

export default Modal;
