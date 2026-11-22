import { useEffect, useRef, useState } from 'react';

const TopScrollbar = ({ targetRef, className = '' }) => {
    const barRef = useRef(null);
    const [width, setWidth] = useState(0);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const target = targetRef.current;
        const bar = barRef.current;
        if (!target || !bar) return undefined;
        let syncing = false;
        const mirror = (from, to) => () => {
            if (syncing) { syncing = false; return; }
            syncing = true;
            to.scrollLeft = from.scrollLeft;
        };
        const onTarget = mirror(target, bar);
        const onBar = mirror(bar, target);
        const measure = () => {
            setWidth(target.scrollWidth);
            setVisible(target.scrollWidth > target.clientWidth + 1);
        };
        target.addEventListener('scroll', onTarget, { passive: true });
        bar.addEventListener('scroll', onBar, { passive: true });
        const observer = new ResizeObserver(measure);
        observer.observe(target);
        if (target.firstElementChild) observer.observe(target.firstElementChild);
        measure();
        return () => {
            target.removeEventListener('scroll', onTarget);
            bar.removeEventListener('scroll', onBar);
            observer.disconnect();
        };
    }, [targetRef]);

    return (
        <div ref={barRef} className={`top-scrollbar ${className}`} hidden={!visible} aria-hidden="true">
            <div style={{ width, height: 1 }} />
        </div>
    );
};

export default TopScrollbar;
