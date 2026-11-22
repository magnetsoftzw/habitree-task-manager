import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Check, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/Tokens';
import AppText from '../ui/AppText';
import { Button } from '../ui/Controls';
import { TextField, TimeField } from '../ui/Fields';
import Sheet from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import { fetchTemplate, previewTemplateSegment, updateTemplateSegment } from '../../store/slices/ScheduleSlice';
import { minutesToTime, timeToMinutes } from '../../utils/Format';
import { DAY, clock12, formatRange } from '../../utils/Schedule';

const DAY_START = 240;
const toDayMinutes = (time) => {
  const m = Math.round(timeToMinutes(time) / 5) * 5;
  return m < DAY_START ? m + DAY : m;
};

const SWATCHES = ['#0F7A5C', '#2563EB', '#B45309', '#7C3AED', '#DB2777', '#0E7C7B', '#C2410C', '#1F5FAD', '#6B5BD2', '#C2185B'];

export default function TemplateSheet({ visible, onClose }) {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const { show } = useToast();
  const template = useSelector((s) => s.schedule.template);
  const [editing, setEditing] = useState(null);
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [preview, setPreview] = useState(null);
  const [timeError, setTimeError] = useState(null);

  useEffect(() => { if (visible) { dispatch(fetchTemplate()); setEditing(null); } }, [visible, dispatch]);

  const open = (s) => {
    setEditing(s); setLabel(s.label); setColor(s.color); setError(null);
    setStart(s.start); setEnd(s.end); setPreview(null); setTimeError(null);
  };

  const index = template?.segments.findIndex((s) => s.key === editing?.key) ?? -1;
  const canStart = index > 0;
  const canEnd = index > -1 && index < (template?.segments.length || 0) - 1;
  const timesChanged = !!editing && (start !== editing.start || end !== editing.end);
  const timeChanges = () => ({ ...(start !== editing.start && { start }), ...(end !== editing.end && { end }) });

  useEffect(() => {
    if (!editing || !timesChanged) { setPreview(null); setTimeError(null); return undefined; }
    let live = true;
    const t = setTimeout(async () => {
      const r = await dispatch(previewTemplateSegment({ key: editing.key, ...timeChanges() }));
      if (!live) return;
      if (r.error) { setPreview(null); setTimeError(r.payload); } else { setPreview(r.payload); setTimeError(null); }
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [editing, start, end]);

  const others = preview && template ? preview.segments.filter((p) => {
    const before = template.segments.find((s) => s.key === p.key);
    return p.key !== editing.key && before && (before.start !== p.start || before.end !== p.end);
  }) : [];

  const save = async () => {
    setBusy(true);
    const changes = { key: editing.key, label, ...(timesChanged && timeChanges()) };
    if (editing.kind === 'work') changes.color = color;
    const r = await dispatch(updateTemplateSegment(changes));
    setBusy(false);
    if (r.error) return timesChanged ? setTimeError(r.payload) : setError(r.payload);
    const { affected } = r.payload;
    show(affected ? `${label.trim()} saved · ${affected} planned block${affected === 1 ? '' : 's'} now outside work periods` : `${label.trim()} saved`);
    return setEditing(null);
  };

  if (editing) {
    return (
      <Sheet
        visible={visible}
        onClose={() => setEditing(null)}
        title={editing.kind === 'work' ? 'Work period' : 'Personal time'}
        subtitle={`${formatRange(start ?? editing.start, end ?? editing.end)} · days you haven't adjusted`}
        footer={(
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="Back" variant="secondary" onPress={() => setEditing(null)} style={{ flex: 1 }} />
            <Button label="Save" onPress={save} loading={busy} disabled={!label.trim() || !!timeError} style={{ flex: 2 }} />
          </View>
        )}
      >
        <TextField label="Name" value={label} onChangeText={setLabel} maxLength={40} error={error} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {canStart ? <TimeField label="Starts" value={minutesToTime(start)} onChange={(t) => setStart(toDayMinutes(t))} /> : (
            <View style={{ flex: 1, gap: 8 }}>
              <AppText variant="label">Starts</AppText>
              <AppText variant="meta" tone="muted">{clock12(editing.start)} · fixed, the day begins here</AppText>
            </View>
          )}
          {canEnd ? <TimeField label="Ends" value={minutesToTime(end)} onChange={(t) => setEnd(toDayMinutes(t))} /> : (
            <View style={{ flex: 1, gap: 8 }}>
              <AppText variant="label">Ends</AppText>
              <AppText variant="meta" tone="muted">4:00 AM · fixed, the day begins here</AppText>
            </View>
          )}
        </View>
        {timeError && <AppText variant="meta" tone="danger" accessibilityLiveRegion="polite">{timeError}</AppText>}
        {!timeError && others.length > 0 && (
          <AppText variant="meta" tone="muted" accessibilityLiveRegion="polite">
            Also changes {others.map((o) => `${o.label} to ${formatRange(o.start, o.end)}`).join(' and ')}.
          </AppText>
        )}
        {!timeError && preview?.affected > 0 && (
          <AppText variant="meta" tone="danger" accessibilityLiveRegion="polite">
            {preview.affected} planned block{preview.affected === 1 ? '' : 's'} from today on would sit outside your work periods. They stay planned; change their times afterwards.
          </AppText>
        )}
        {timesChanged && !timeError && (
          <AppText variant="caption" tone="muted">Past days with plans keep their current times. Days you've adjusted on Today aren't changed.</AppText>
        )}
        {editing.kind === 'work' && (
          <View style={{ gap: 8 }}>
            <AppText variant="label">Colour</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }} accessibilityRole="radiogroup">
              {SWATCHES.map((c) => (
                <Pressable
                  key={c}
                  accessibilityRole="radio"
                  accessibilityLabel={`Colour ${c}`}
                  accessibilityState={{ checked: color === c }}
                  onPress={() => setColor(c)}
                  style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c, alignItems: 'center', justifyContent: 'center', borderWidth: color === c ? 3 : 0, borderColor: colors.text }}
                >
                  {color === c && <Check size={18} color="#FFFFFF" strokeWidth={3} />}
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </Sheet>
    );
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Default day schedule" subtitle="Names, times and colours for every day. Adjust a single day from Today.">
      {!template && <AppText variant="meta" tone="muted">Loading…</AppText>}
      {template?.segments.map((s) => (
        <Pressable
          key={s.key}
          accessibilityRole="button"
          accessibilityLabel={`${s.label}, ${s.kind === 'work' ? 'work period' : 'personal time'}, ${formatRange(s.start, s.end)}. Edit`}
          onPress={() => open(s)}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 4, borderRadius: radius.md, backgroundColor: pressed ? colors.surfaceSubtle : 'transparent' })}
        >
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: s.kind === 'work' ? s.color : 'transparent', borderWidth: s.kind === 'work' ? 0 : 1.5, borderColor: colors.borderStrong }} />
          <View style={{ flex: 1 }}>
            <AppText variant="title">{s.label}</AppText>
            <AppText variant="caption" tone="muted">{s.kind === 'work' ? 'Work' : 'Personal'} · {formatRange(s.start, s.end)}</AppText>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </Pressable>
      ))}
    </Sheet>
  );
}
