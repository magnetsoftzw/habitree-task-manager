import { useRef, useState } from 'react';
import { HALF, SNAP, clipToHalf, clockLabel, entryInterval, rangeLabel } from '../../utils/Schedule';

const SIZE = 340;
const C = SIZE / 2;
const R = 136;

const angleOf = (minute, from) => ((minute - from) / HALF) * 360 - 90;
const point = (deg, r) => {
    const rad = (deg * Math.PI) / 180;
    return [C + r * Math.cos(rad), C + r * Math.sin(rad)];
};

const ring = (a0, a1, r0, r1) => {
    const sweep = a1 - a0;
    if (sweep >= 359.99) {
        const outer = `M ${C - r1} ${C} A ${r1} ${r1} 0 1 1 ${C + r1} ${C} A ${r1} ${r1} 0 1 1 ${C - r1} ${C} Z`;
        return r0 ? `${outer} M ${C - r0} ${C} A ${r0} ${r0} 0 1 0 ${C + r0} ${C} A ${r0} ${r0} 0 1 0 ${C - r0} ${C} Z` : outer;
    }
    const large = sweep > 180 ? 1 : 0;
    const [x1, y1] = point(a0, r1);
    const [x2, y2] = point(a1, r1);
    if (!r0) return `M ${C} ${C} L ${x1} ${y1} A ${r1} ${r1} 0 ${large} 1 ${x2} ${y2} Z`;
    const [x3, y3] = point(a1, r0);
    const [x4, y4] = point(a0, r0);
    return `M ${x1} ${y1} A ${r1} ${r1} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r0} ${r0} 0 ${large} 0 ${x4} ${y4} Z`;
};

const pointerAngle = (svg, e) => {
    const box = svg.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * SIZE - C;
    const y = ((e.clientY - box.top) / box.height) * SIZE - C;
    return (Math.atan2(y, x) * 180) / Math.PI;
};

const wrap = (deg) => (deg > 180 ? deg - 360 : deg < -180 ? deg + 360 : deg);

const ScheduleClock = ({
    segments, entries = [], half, selectedKey, onSelect, onDragShift, onResize, nowMinute = null, canDrag = true,
}) => {
    const svgRef = useRef(null);
    const drag = useRef(null);
    const [dragView, setDragView] = useState(null);
    const from = half * HALF;
    const visible = clipToHalf(segments, half);

    const start = (e, seg, edge = null) => {
        const angle = pointerAngle(svgRef.current, e);
        drag.current = { key: seg.key, edge, last: angle, turned: 0, offset: 0, moved: false };
        e.currentTarget.setPointerCapture?.(e.pointerId);
    };

    const begin = (e, seg) => {
        if (!canDrag || seg.kind !== 'work' || e.button > 0) return;
        start(e, seg);
    };

    const beginResize = (e, seg, edge) => {
        if (e.button > 0) return;
        e.stopPropagation();
        start(e, seg, edge);
    };

    const move = (e) => {
        const d = drag.current;
        if (!d) return;
        const angle = pointerAngle(svgRef.current, e);
        d.turned += wrap(angle - d.last);
        d.last = angle;
        const offset = Math.round((d.turned * (HALF / 360)) / SNAP) * SNAP;
        if (Math.abs(d.turned) > 3) d.moved = true;
        if (offset !== d.offset) {
            d.offset = offset;
            setDragView({ key: d.key, edge: d.edge, offset });
        }
    };

    const end = (seg) => {
        const d = drag.current;
        drag.current = null;
        setDragView(null);
        if (!d || !d.moved) {
            if (!d?.edge) onSelect(seg.carried ? 'rest' : seg.key);
            return;
        }
        if (!d.offset) return;
        if (d.edge) onResize?.(seg, d.edge, d.offset);
        else onDragShift?.(seg, d.offset);
    };

    const cancel = () => {
        drag.current = null;
        setDragView(null);
    };

    const marks = entries
        .map(entryInterval)
        .filter(Boolean)
        .map((iv) => ({ from: Math.max(iv.start, from), to: Math.min(iv.end, from + HALF) }))
        .filter((iv) => iv.to > iv.from);

    const ticks = Array.from({ length: 12 }, (_, i) => {
        const minute = from + i * 60;
        const [x, y] = point(angleOf(minute, from), R + 17);
        const [tx1, ty1] = point(angleOf(minute, from), R + 2);
        const [tx2, ty2] = point(angleOf(minute, from), R + 7);
        const hour = i === 0 ? 12 : i;
        return { minute, x, y, tx1, ty1, tx2, ty2, text: i === 0 ? (half ? '12 PM' : '12 AM') : String(hour) };
    });

    const dragged = dragView && segments.find((s) => s.key === dragView.key);
    const ghost = dragged && (() => {
        const off = dragView.offset;
        const gs = dragView.edge === 'end' ? dragged.start : dragged.start + off;
        const ge = dragView.edge === 'start' ? dragged.end : dragged.end + off;
        const gFrom = Math.max(gs, from);
        const gTo = Math.min(ge, from + HALF);
        return gTo > gFrom ? { ...dragged, from: gFrom, to: gTo } : null;
    })();
    const selectedSeg = segments.find((s) => s.key === selectedKey);
    const firstKey = segments[0]?.key;
    const lastKey = segments[segments.length - 1]?.key;
    const handles = onResize && selectedSeg
        ? ['start', 'end']
            .filter((edge) => !(edge === 'start' && selectedSeg.key === firstKey) && !(edge === 'end' && selectedSeg.key === lastKey))
            .map((edge) => ({ edge, minute: edge === 'start' ? selectedSeg.start : selectedSeg.end }))
            .filter((h) => h.minute >= from && h.minute <= from + HALF)
        : [];
    const showNow = nowMinute !== null && nowMinute >= from && nowMinute < from + HALF;

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="sc-clock"
            role="group"
            aria-label={`Schedule from ${half ? '12 PM to 12 AM' : '12 AM to 12 PM'}`}
            onPointerMove={move}
        >
            <circle cx={C} cy={C} r={R} className="sc-face" />
            {visible.map((seg) => {
                const a0 = angleOf(seg.from, from);
                const a1 = angleOf(seg.to, from);
                const selected = seg.key === selectedKey || (seg.carried && selectedKey === 'rest');
                const work = seg.kind === 'work';
                return (
                    <path
                        key={`${seg.key}-${seg.from}`}
                        d={ring(a0, a1, 0, R)}
                        className={`sc-seg ${work ? 'is-work' : 'is-personal'} ${selected ? 'is-selected' : ''} ${dragView?.key === seg.key ? 'is-dragging' : ''}`}
                        style={work ? { fill: seg.color } : undefined}
                        tabIndex={0}
                        role="button"
                        aria-pressed={selected}
                        aria-label={`${seg.label}, ${rangeLabel(seg.start, seg.end)}${work ? ', work period' : ', personal time'}`}
                        onPointerDown={(e) => begin(e, seg)}
                        onPointerUp={() => end(seg)}
                        onPointerCancel={cancel}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onSelect(seg.carried ? 'rest' : seg.key);
                            }
                        }}
                    />
                );
            })}
            {marks.map((m, i) => (
                <path key={i} d={ring(angleOf(m.from, from), angleOf(m.to, from), R * 0.72, R * 0.86)} className="sc-mark" aria-hidden="true" />
            ))}
            {ghost && (
                <path
                    d={ring(angleOf(ghost.from, from), angleOf(ghost.to, from), 0, R)}
                    className="sc-ghost"
                    style={{ stroke: ghost.color || 'var(--text)' }}
                    aria-hidden="true"
                />
            )}
            {showNow && (() => {
                const [x, y] = point(angleOf(nowMinute, from), R - 4);
                return (
                    <g className="sc-now" aria-hidden="true">
                        <line x1={C} y1={C} x2={x} y2={y} />
                        <circle cx={x} cy={y} r={4} />
                    </g>
                );
            })()}
            <circle cx={C} cy={C} r={5} className="sc-hub" aria-hidden="true" />
            {handles.map((h) => {
                const moving = dragView?.edge === h.edge && dragView.key === selectedSeg.key;
                const minute = h.minute + (moving ? dragView.offset : 0);
                const [x, y] = point(angleOf(minute, from), R);
                const label = `${h.edge === 'start' ? 'Start' : 'End'} of ${selectedSeg.label}`;
                return (
                    <g
                        key={h.edge}
                        className={`sc-handle ${moving ? 'is-moving' : ''}`}
                        role="slider"
                        tabIndex={0}
                        aria-label={label}
                        aria-valuemin={0}
                        aria-valuemax={1680}
                        aria-valuenow={minute}
                        aria-valuetext={clockLabel(minute)}
                        onPointerDown={(e) => beginResize(e, selectedSeg, h.edge)}
                        onPointerUp={() => end(selectedSeg)}
                        onPointerCancel={cancel}
                        onKeyDown={(e) => {
                            const later = e.key === 'ArrowRight' || e.key === 'ArrowUp';
                            const earlier = e.key === 'ArrowLeft' || e.key === 'ArrowDown';
                            if (!later && !earlier) return;
                            e.preventDefault();
                            onResize(selectedSeg, h.edge, later ? SNAP : -SNAP);
                        }}
                    >
                        <circle cx={x} cy={y} r={16} className="sc-handle-hit" />
                        <circle
                            cx={x}
                            cy={y}
                            r={8}
                            className="sc-handle-dot"
                            style={selectedSeg.kind === 'work' ? { stroke: selectedSeg.color } : undefined}
                        />
                    </g>
                );
            })}
            {ticks.map((t) => (
                <g key={t.minute} aria-hidden="true">
                    <line x1={t.tx1} y1={t.ty1} x2={t.tx2} y2={t.ty2} className="sc-tick" />
                    <text x={t.x} y={t.y} className={`sc-hour ${t.text.length > 2 ? 'is-noon' : ''}`} textAnchor="middle" dominantBaseline="central">{t.text}</text>
                </g>
            ))}
            {dragged && dragView.offset !== 0 && (
                <text x={C} y={SIZE - 4} className="sc-drag-label" textAnchor="middle" aria-live="polite">
                    {dragView.edge
                        ? `${dragView.edge === 'start' ? 'Starts' : 'Ends'} ${clockLabel((dragView.edge === 'start' ? dragged.start : dragged.end) + dragView.offset)}`
                        : `${dragView.offset > 0 ? '+' : '−'}${Math.abs(dragView.offset)} min`}
                </text>
            )}
        </svg>
    );
};

export default ScheduleClock;
