import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { ChevronRight, Search } from 'lucide-react-native';
import API from '../../api/Client';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/Tokens';
import AppText from '../ui/AppText';
import Sheet from '../ui/Sheet';
import { Button, Chip } from '../ui/Controls';
import { DateField, TextField, TimeField } from '../ui/Fields';
import { useToast } from '../ui/Toast';
import { addToPlanner, fetchPlannerRange } from '../../store/slices/PlannerSlice';
import { fetchInventory } from '../../store/slices/TasksSlice';
import { addDays, formatDuration, fromDateKey, longDate, nextHalfHour, toDateKey, todayKey } from '../../utils/Format';
import { projectColor } from '../../utils/Status';

const DURATIONS = [15, 30, 45, 60, 90, 120];

function PickRow({ title, meta, color, onPress }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Plan ${title}`}
      onPress={onPress}
      style={({ pressed }) => ({ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: pressed ? colors.surfaceSubtle : colors.surface })}
    >
      <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: color }} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText variant="title" numberOfLines={1}>{title}</AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>{meta}</AppText>
      </View>
      <ChevronRight size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function Group({ title, children }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <AppText variant="overline" tone="muted">{title}</AppText>
      <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, overflow: 'hidden' }}>
        {React.Children.toArray(children).map((child, i) => (
          <View key={i} style={i > 0 ? { borderTopWidth: 1, borderTopColor: colors.divider } : null}>{child}</View>
        ))}
      </View>
    </View>
  );
}

export default function PlanSheet({ visible, onClose, date: presetDate, preset, onPick, title }) {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const { show } = useToast();
  const inventory = useSelector((s) => s.tasks.inventory);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [projectLists, setProjectLists] = useState(null);
  const [date, setDate] = useState(presetDate || todayKey());
  const [time, setTime] = useState(nextHalfHour());
  const [duration, setDuration] = useState(30);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setSelected(preset || null);
    const d = presetDate || todayKey();
    setDate(d);
    setTime(d === todayKey() ? nextHalfHour() : '09:00');
    setDuration(30);
    if (!preset) {
      dispatch(fetchInventory());
      setProjectLists(null);
      (async () => {
        try {
          const { data } = await API.get('/projects');
          const lists = await Promise.all(data.projects.map(async (p) => {
            const res = await API.get(`/projects/${p._id}/tasks`, { params: { status: 'open' } });
            return { project: p, tasks: res.data.tasks };
          }));
          setProjectLists(lists.filter((l) => l.tasks.length));
        } catch {
          setProjectLists([]);
        }
      })();
    }
  }, [visible, preset, presetDate, dispatch]);

  const q = query.trim().toLowerCase();
  const myTasks = useMemo(() => Object.entries(inventory).flatMap(([group, tasks]) =>
    tasks.filter((t) => t.status !== 'Completed').map((t) => ({ ...t, groupName: group }))), [inventory]);
  const matches = (title) => !q || title.toLowerCase().includes(q);

  const submit = async () => {
    setBusy(true);
    const result = await dispatch(addToPlanner({ date, taskType: selected.taskType, taskId: selected.taskId, projectId: selected.projectId, subtaskId: selected.subtaskId || null, time, duration }));
    setBusy(false);
    if (result.error) return show(result.payload);
    dispatch(fetchPlannerRange({ from: todayKey(), to: toDateKey(addDays(new Date(), 60)) }));
    show(`Added to ${date === todayKey() ? 'today' : longDate(fromDateKey(date))} at ${time}`);
    onClose();
  };

  const dateChoices = [
    { label: 'Today', value: todayKey() },
    { label: 'Tomorrow', value: toDateKey(addDays(new Date(), 1)) },
  ];

  const choose = (ref) => {
    if (!onPick) return setSelected(ref);
    onPick(ref);
    onClose();
  };

  if (!selected) {
    return (
      <Sheet
        visible={visible}
        onClose={onClose}
        title={title || (presetDate && presetDate !== todayKey() ? `Plan ${longDate(fromDateKey(presetDate))}` : 'Add to today')}
        subtitle={onPick ? 'Pick the task this session is for' : 'Pick a task to schedule a block for it'}
      >
        <TextField
          placeholder="Search tasks"
          value={query}
          onChangeText={setQuery}
          right={<View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Search size={18} color={colors.textMuted} /></View>}
        />
        {myTasks.filter((t) => matches(t.title)).length > 0 && (
          <Group title="Your tasks">
            {myTasks.filter((t) => matches(t.title)).map((t) => (
              <PickRow
                key={t._id}
                title={t.title}
                meta={`${t.groupName} · ${t.category || 'General'}`}
                color={t.groupId?.color || colors.textMuted}
                onPress={() => choose({ taskType: 'task', taskId: t._id, projectId: null, title: t.title })}
              />
            ))}
          </Group>
        )}
        {projectLists === null ? <ActivityIndicator /> : projectLists.map(({ project, tasks }) => {
          const visibleTasks = tasks.filter((t) => matches(t.title) || t.subtasks.some((s) => matches(s.title)));
          if (!visibleTasks.length) return null;
          return (
            <Group key={project._id} title={`Project tasks · ${project.name}`}>
              {visibleTasks.map((t) => (
                <PickRow
                  key={t._id}
                  title={t.title}
                  meta={project.name}
                  color={projectColor(project)}
                  onPress={() => choose({ taskType: 'projectTask', taskId: t._id, projectId: project._id, title: t.title })}
                />
              ))}
            </Group>
          );
        })}
        {projectLists !== null && myTasks.filter((t) => matches(t.title)).length === 0
          && !projectLists.some((l) => l.tasks.some((t) => matches(t.title))) && (
          <AppText variant="body" tone="muted" style={{ textAlign: 'center', paddingVertical: 16 }}>
            {q ? 'No open tasks match your search.' : 'No open tasks yet. Create a task first, then plan it here.'}
          </AppText>
        )}
      </Sheet>
    );
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Add to plan"
      subtitle={selected.parentTitle ? `${selected.title} · subtask of ${selected.parentTitle}` : selected.title}
      footer={<Button label="Add block" onPress={submit} loading={busy} height={52} />}
    >
      {!presetDate && (
        <View style={{ gap: 8 }}>
          <AppText variant="label">Day</AppText>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {dateChoices.map((c) => (
              <Chip key={c.label} label={c.label} selected={date === c.value} onPress={() => setDate(c.value)} />
            ))}
          </View>
          <DateField
            value={fromDateKey(date)}
            clearable={false}
            minimumDate={new Date()}
            onChange={(d) => d && setDate(toDateKey(d))}
          />
        </View>
      )}
      <TimeField label="Start time" value={time} onChange={setTime} />
      <View style={{ gap: 8 }}>
        <AppText variant="label">Duration</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {DURATIONS.map((d) => (
            <Chip key={d} label={formatDuration(d)} selected={duration === d} onPress={() => setDuration(d)} />
          ))}
        </ScrollView>
      </View>
      {!preset && <Button variant="secondary" label="Pick a different task" onPress={() => setSelected(null)} />}
    </Sheet>
  );
}
