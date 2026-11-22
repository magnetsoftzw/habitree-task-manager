import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { AlertTriangle, Minus, Plus } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/Tokens';
import AppText from '../ui/AppText';
import { Button, Chip, IconButton, SegmentedControl } from '../ui/Controls';
import Sheet from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import { applyResize, applyShift, previewResize, previewShift } from '../../store/slices/ScheduleSlice';
import { fetchInventory } from '../../store/slices/TasksSlice';
import { formatDuration } from '../../utils/Format';
import { formatLength, formatRange } from '../../utils/Schedule';

const QUICK = [-60, -30, -15, 15, 30, 60];
const signed = (m) => `${m > 0 ? '+' : '−'}${formatLength(Math.abs(m))}`;

function Warning({ children }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.lg, backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.dangerBorder }}>
      <AlertTriangle size={18} color={colors.dangerText} />
      <View style={{ flex: 1, gap: 6 }}>{children}</View>
    </View>
  );
}

export default function ShiftSheet({ visible, onClose, date, segment, mode = 'shift', edges = ['start', 'end'], initialEdge, initialOffset }) {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const { show } = useToast();
  const resize = mode === 'resize';
  const [offset, setOffset] = useState(15);
  const [edge, setEdge] = useState('end');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) { setOffset(initialOffset || 15); setEdge(initialEdge || edges[edges.length - 1]); setPreview(null); setError(null); }
  }, [visible, segment?.key, initialOffset, initialEdge]);

  useEffect(() => {
    if (!visible || !segment) return undefined;
    let live = true;
    setChecking(true);
    const t = setTimeout(async () => {
      const body = { date, segmentKey: segment.key, offsetMinutes: offset };
      const r = await dispatch(resize ? previewResize({ ...body, edge }) : previewShift(body));
      if (!live) return;
      setChecking(false);
      if (r.error) { setPreview(null); setError(r.payload); } else { setPreview(r.payload); setError(null); }
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [visible, segment, offset, edge, resize, date, dispatch]);

  const next = preview?.segments.find((s) => s.key === segment?.key);
  const removed = preview?.removed || [];
  const needsConfirm = !!preview?.requiresConfirmation;

  const apply = async () => {
    setBusy(true);
    const body = { date, segmentKey: segment.key, offsetMinutes: offset };
    const r = await dispatch(resize ? applyResize({ ...body, edge }) : applyShift(body));
    setBusy(false);
    if (r.error) return setError(r.payload);
    if (removed.length) dispatch(fetchInventory());
    const verb = resize ? 'resized' : 'moved';
    show(removed.length ? `${segment.label} ${verb} · ${removed.length} shelved` : resize ? `${segment.label} now ${formatRange(next.start, next.end)}` : `${segment.label} moved ${signed(offset)}`);
    return onClose();
  };

  const label = !needsConfirm ? `${resize ? 'Resize' : 'Move'} ${signed(offset)}`
    : removed.length ? `${resize ? 'Resize' : 'Move'} and shelve ${removed.length} task${removed.length === 1 ? '' : 's'}`
      : `${resize ? 'Resize' : 'Move'} anyway`;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={segment ? `${resize ? 'Resize' : 'Move'} ${segment.label}` : 'Move work period'}
      subtitle={segment ? `Now ${formatRange(segment.start, segment.end)} · only this day changes` : ''}
      footer={(
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button
            label={label}
            variant={needsConfirm ? 'danger' : 'primary'}
            onPress={apply}
            loading={busy}
            disabled={!preview || checking || !!error}
            style={{ flex: 2 }}
          />
        </View>
      )}
    >
      {resize && edges.length > 1 && (
        <SegmentedControl
          label="Edge to change"
          options={[{ value: 'start', label: 'Start' }, { value: 'end', label: 'End' }].filter((o) => edges.includes(o.value))}
          value={edge}
          onChange={setEdge}
        />
      )}
      {resize && (
        <AppText variant="meta" tone="muted">
          {edge === 'end'
            ? 'Later adds time and pushes the segments after it along. Earlier gives the time to the next segment only.'
            : 'Earlier takes time from the segment before. Later gives time back to it.'}
        </AppText>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <IconButton icon={Minus} label="5 minutes earlier" onPress={() => setOffset((o) => (o - 5 === 0 ? -5 : o - 5))} />
        <View style={{ minWidth: 120, alignItems: 'center' }} accessibilityLiveRegion="polite">
          <AppText variant="statLarge" numeric>{signed(offset)}</AppText>
          <AppText variant="caption" tone="muted">{resize ? `${edge === 'start' ? 'start' : 'end'} ${offset > 0 ? 'later' : 'earlier'}` : offset > 0 ? 'later' : 'earlier'}</AppText>
        </View>
        <IconButton icon={Plus} label="5 minutes later" onPress={() => setOffset((o) => (o + 5 === 0 ? 5 : o + 5))} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {QUICK.map((q) => <Chip key={q} label={signed(q)} selected={offset === q} onPress={() => setOffset(q)} />)}
      </ScrollView>

      {error && <AppText variant="meta" tone="danger" accessibilityLiveRegion="polite">{error}</AppText>}

      {next && !error && (
        <View style={{ gap: 10 }} accessibilityLiveRegion="polite">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: segment.kind === 'work' ? segment.color : 'transparent', borderWidth: segment.kind === 'work' ? 0 : 1.5, borderColor: colors.borderStrong }} />
            <AppText variant="bodyStrong" style={{ flex: 1 }}>{segment.label}: {formatRange(next.start, next.end)}</AppText>
          </View>
          {preview.moved > 0 && (
            <AppText variant="meta" tone="muted">{preview.moved} planned block{preview.moved === 1 ? '' : 's'} move with it, keeping their length and order.</AppText>
          )}
          {preview.restLostMinutes > 0 && (
            <Warning>
              <AppText variant="bodyStrong" color={colors.dangerInk}>Rest gets {formatLength(preview.restLostMinutes)} shorter</AppText>
              <AppText variant="meta" color={colors.dangerInk}>Rest becomes {formatRange(preview.rest.start, preview.rest.end)}.</AppText>
            </Warning>
          )}
          {preview.workLostMinutes > 0 && (
            <Warning>
              <AppText variant="bodyStrong" color={colors.dangerInk}>{formatLength(preview.workLostMinutes)} of work time no longer fits</AppText>
              <AppText variant="meta" color={colors.dangerInk}>Later periods move too, and the last work period is cut short at the start of Rest.</AppText>
            </Warning>
          )}
          {removed.length > 0 && (
            <Warning>
              <AppText variant="bodyStrong" color={colors.dangerInk}>{removed.length} planned block{removed.length === 1 ? '' : 's'} will be removed</AppText>
              <AppText variant="meta" color={colors.dangerInk}>They're taken off this day's plan and marked Shelved. The tasks stay in your lists, and other subtasks aren't affected.</AppText>
              {removed.map((r) => (
                <AppText key={r.entryId} variant="meta" color={colors.dangerInk} numberOfLines={2}>
                  • {r.time} · {formatDuration(r.duration)} · {r.title}{r.parentTitle ? ` (subtask of ${r.parentTitle})` : ''}
                </AppText>
              ))}
            </Warning>
          )}
        </View>
      )}
    </Sheet>
  );
}
