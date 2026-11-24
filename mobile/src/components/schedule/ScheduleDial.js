import React, { useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts } from '../../theme/Tokens';
import AppText from '../ui/AppText';
import { HALF, clock12, formatLength, piecesForHalf } from '../../utils/Schedule';

const polar = (cx, cy, r, angle) => [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
const angleOf = (minutes, from) => ((minutes - from) / HALF) * Math.PI * 2 - Math.PI / 2;

const wedge = (cx, cy, outer, inner, a0, a1) => {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = polar(cx, cy, outer, a0);
  const [x1, y1] = polar(cx, cy, outer, a1);
  const [x2, y2] = polar(cx, cy, inner, a1);
  const [x3, y3] = polar(cx, cy, inner, a0);
  return `M${x0} ${y0} A${outer} ${outer} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${inner} ${inner} 0 ${large} 0 ${x3} ${y3} Z`;
};

const HANDLE = 44;

function Handle({ x, y, onGrab, onMove, onDrop }) {
  const latest = useRef({});
  latest.current = { onGrab, onMove, onDrop };
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => latest.current.onGrab(),
    onPanResponderMove: (_, g) => latest.current.onMove(g.dx, g.dy),
    onPanResponderRelease: () => latest.current.onDrop(),
    onPanResponderTerminate: () => latest.current.onDrop(),
  })).current;
  return <View {...responder.panHandlers} style={{ position: 'absolute', left: x - HANDLE / 2, top: y - HANDLE / 2, width: HANDLE, height: HANDLE }} />;
}

function RingTouch({ size, hitTest, onTap, onGrab, onMove, onDrop }) {
  const latest = useRef({});
  latest.current = { hitTest, onTap, onGrab, onMove, onDrop };
  const touch = useRef(null);
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: (e) => !!latest.current.hitTest(e.nativeEvent.locationX, e.nativeEvent.locationY),
    onMoveShouldSetPanResponder: () => false,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      const { locationX: x, locationY: y } = e.nativeEvent;
      touch.current = { x, y, segment: latest.current.hitTest(x, y), moved: false };
    },
    onPanResponderMove: (_, g) => {
      const t = touch.current;
      if (!t) return;
      if (!t.moved) {
        if (Math.abs(g.dx) + Math.abs(g.dy) < 8 || t.segment.kind !== 'work') return;
        t.moved = true;
        latest.current.onGrab(t.segment, t.x, t.y);
      }
      latest.current.onMove(g.dx, g.dy);
    },
    onPanResponderRelease: () => {
      const t = touch.current;
      touch.current = null;
      if (!t) return;
      if (t.moved) latest.current.onDrop();
      else latest.current.onTap(t.segment);
    },
    onPanResponderTerminate: () => {
      const t = touch.current;
      touch.current = null;
      if (t?.moved) latest.current.onDrop(true);
    },
  })).current;
  return <View {...responder.panHandlers} style={{ position: 'absolute', left: 0, top: 0, width: size, height: size }} />;
}

export default function ScheduleDial({ segments, half, selectedKey, onSelect, onResize, onShift, nowMinutes, size = 260, children }) {
  const { colors } = useTheme();
  const from = half * HALF;
  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2 - 22;
  const inner = outer - 38;
  const [draft, setDraft] = useState(null);
  const [moving, setMoving] = useState(null);
  const grab = useRef(null);
  const shiftGrab = useRef(null);
  const index = segments.findIndex((s) => s.key === selectedKey);
  const selected = segments[index] || null;
  const drawn = draft && selected ? segments.map((s) => (s.key === selected.key ? { ...s, [draft.edge]: draft.minute } : s))
    : moving ? segments.map((s) => (s.key === moving.key ? { ...s, start: s.start + moving.offset, end: s.end + moving.offset } : s))
      : segments;
  const pieces = piecesForHalf(drawn, half).sort((a, b) => (a.segment.key === selectedKey) - (b.segment.key === selectedKey));
  const mid = (outer + inner) / 2;

  const edges = !selected || !onResize ? [] : [
    index > 0 && selected.start >= from && selected.start < from + HALF && 'start',
    index < segments.length - 1 && selected.end > from && selected.end <= from + HALF && 'end',
  ].filter(Boolean);

  const minuteAt = (x, y) => {
    const a = (((Math.atan2(y - cy, x - cx) + Math.PI / 2) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    return from + (a / (Math.PI * 2)) * HALF;
  };

  const dragTo = (edge, dx, dy) => {
    const g = grab.current;
    if (!g) return;
    let delta = minuteAt(g.x + dx, g.y + dy) - g.origin;
    while (delta > HALF / 2) delta -= HALF;
    while (delta < -HALF / 2) delta += HALF;
    let minute = g.origin + Math.round(delta / 5) * 5;
    if (edge === 'start') minute = Math.min(Math.max(minute, segments[index - 1].start + 5, from), selected.end - 5);
    else minute = Math.min(Math.max(minute, selected.start + 5), from + HALF);
    setDraft({ edge, minute });
  };

  const drop = async () => {
    const g = grab.current;
    grab.current = null;
    if (!g || !draft || draft.minute === g.origin) return setDraft(null);
    await onResize(draft.edge, draft.minute - g.origin);
    return setDraft(null);
  };
  const hitTest = (x, y) => {
    const r = Math.hypot(x - cx, y - cy);
    if (r < inner - 8 || r > outer + 12) return null;
    const minute = minuteAt(x, y);
    const piece = piecesForHalf(segments, half).find((p) => minute >= p.start && minute < p.end);
    return piece?.segment || null;
  };

  const shiftGrabbed = (segment, x, y) => {
    onSelect(segment.key);
    shiftGrab.current = { key: segment.key, x, y, last: minuteAt(x, y), turned: 0 };
    setMoving({ key: segment.key, offset: 0 });
  };

  const shiftTo = (dx, dy) => {
    const g = shiftGrab.current;
    if (!g) return;
    const minute = minuteAt(g.x + dx, g.y + dy);
    let step = minute - g.last;
    while (step > HALF / 2) step -= HALF;
    while (step < -HALF / 2) step += HALF;
    g.last = minute;
    g.turned += step;
    const offset = Math.round(g.turned / 5) * 5;
    setMoving((m) => (m && m.offset === offset ? m : { key: g.key, offset }));
  };

  const shiftDrop = async (cancelled) => {
    const g = shiftGrab.current;
    shiftGrab.current = null;
    const offset = g ? Math.round(g.turned / 5) * 5 : 0;
    if (cancelled || !g || !offset || !onShift) return setMoving(null);
    const segment = segments.find((s) => s.key === g.key);
    await onShift(segment, offset);
    return setMoving(null);
  };

  const hours = [0, 3, 6, 9].map((h) => ({ h, label: String(h === 0 ? 12 : h), angle: angleOf(from + h * 60, from) }));
  const nowVisible = nowMinutes != null && nowMinutes >= from && nowMinutes < from + HALF;

  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={(outer + inner) / 2} stroke={colors.surfaceSubtle} strokeWidth={outer - inner} fill="none" />
        <Circle cx={cx} cy={cy} r={outer} stroke={colors.borderStrong} strokeWidth={1} fill="none" />
        <Circle cx={cx} cy={cy} r={inner} stroke={colors.borderStrong} strokeWidth={1} fill="none" />
        {pieces.map((p) => {
          const work = p.segment.kind === 'work';
          const selected = p.segment.key === selectedKey;
          const grow = selected ? 6 : 0;
          const parts = p.end - p.start > HALF / 2 ? [[p.start, (p.start + p.end) / 2], [(p.start + p.end) / 2, p.end]] : [[p.start, p.end]];
          return (
            <G key={`${p.segment.key}-${p.start}`}>
              {parts.map(([a, b]) => (
                <Path
                  key={a}
                  d={wedge(cx, cy, outer + grow, inner - grow / 2, angleOf(a, from), angleOf(b, from))}
                  fill={work ? p.segment.color : colors.surfaceSubtle}
                  opacity={work && selectedKey && !selected ? 0.55 : 1}
                  stroke={selected ? colors.text : colors.surface}
                  strokeWidth={selected ? 2 : 0}
                />
              ))}
            </G>
          );
        })}
        {pieces.map((p) => {
          const [x0, y0] = polar(cx, cy, inner - 2, angleOf(p.start, from));
          const [x1, y1] = polar(cx, cy, outer + 2, angleOf(p.start, from));
          return <Line key={`b-${p.segment.key}-${p.start}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke={colors.borderStrong} strokeWidth={1.5} />;
        })}
        {hours.map(({ h, label, angle }) => {
          const [x, y] = polar(cx, cy, outer + 13, angle);
          return (
            <SvgText key={h} x={x} y={y + 4} fill={colors.textMuted} fontSize={11} fontFamily={fonts.semibold} textAnchor="middle">{label}</SvgText>
          );
        })}
        {nowVisible && (() => {
          const a = angleOf(nowMinutes, from);
          const [x0, y0] = polar(cx, cy, inner - 8, a);
          const [x1, y1] = polar(cx, cy, outer + 4, a);
          return <Line x1={x0} y1={y0} x2={x1} y2={y1} stroke={colors.nowBorder} strokeWidth={3} strokeLinecap="round" />;
        })()}
        {!moving && edges.map((edge) => {
          const [x, y] = polar(cx, cy, mid, angleOf(draft?.edge === edge ? draft.minute : selected[edge], from));
          return <Circle key={edge} cx={x} cy={y} r={draft?.edge === edge ? 13 : 11} fill={colors.surface} stroke={colors.text} strokeWidth={2.5} />;
        })}
      </Svg>
      <RingTouch
        size={size}
        hitTest={hitTest}
        onTap={(segment) => onSelect(segment.key)}
        onGrab={shiftGrabbed}
        onMove={shiftTo}
        onDrop={shiftDrop}
      />
      {!moving && edges.map((edge) => {
        const [x, y] = polar(cx, cy, mid, angleOf(selected[edge], from));
        return (
          <Handle
            key={`${selected.key}-${edge}-${selected[edge]}`}
            x={x}
            y={y}
            onGrab={() => { grab.current = { x, y, origin: selected[edge] }; setDraft({ edge, minute: selected[edge] }); }}
            onMove={(dx, dy) => dragTo(edge, dx, dy)}
            onDrop={drop}
          />
        );
      })}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: cy - inner + 12, left: cx - inner + 12, width: (inner - 12) * 2, height: (inner - 12) * 2, alignItems: 'center', justifyContent: 'center' }}>
        {moving ? (() => {
          const seg = segments.find((s) => s.key === moving.key);
          return (
            <>
              <AppText variant="captionStrong" tone="muted" numberOfLines={1}>Move {seg?.label}</AppText>
              <AppText variant="h4" numeric>{moving.offset === 0 ? 'No change' : `${moving.offset > 0 ? '+' : '−'}${formatLength(Math.abs(moving.offset))}`}</AppText>
              {seg && <AppText variant="caption" tone="muted" numeric>{clock12(seg.start + moving.offset)} – {clock12(seg.end + moving.offset)}</AppText>}
            </>
          );
        })() : draft && selected ? (
          <>
            <AppText variant="captionStrong" tone="muted">{draft.edge === 'start' ? 'Starts' : 'Ends'}</AppText>
            <AppText variant="h4" numeric>{clock12(draft.minute)}</AppText>
            <AppText variant="caption" tone="muted" numeric>
              {draft.minute === selected[draft.edge] ? 'No change' : `${draft.minute > selected[draft.edge] ? '+' : '−'}${formatLength(Math.abs(draft.minute - selected[draft.edge]))}`}
            </AppText>
          </>
        ) : children}
      </View>
    </View>
  );
}
