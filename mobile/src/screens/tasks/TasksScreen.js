import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { Play, Plus, Search, TriangleAlert, X } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/Tokens';
import AppText from '../../components/ui/AppText';
import { Button, Checkbox, Chip, EmptyState, IconButton, SegmentedControl, StatusPill } from '../../components/ui/Controls';
import { PageHeader, Screen, ScrollBody } from '../../components/ui/Layout';
import { TextField } from '../../components/ui/Fields';
import { useToast } from '../../components/ui/Toast';
import NewTaskSheet from '../../components/tasks/NewTaskSheet';
import { useStartFocus } from '../../components/focus/FocusActions';
import { fetchGroups, fetchInventory, rescheduleOverdue, setTaskStatus } from '../../store/slices/TasksSlice';
import { markEntryTask } from '../../store/slices/PlannerSlice';
import { refForTask } from '../../store/TaskThunks';
import { isOverdue, shortDate } from '../../utils/Format';
import { CATEGORIES, TASK_STATUS_LABELS } from '../../utils/Status';

const FILTERS = [
  { key: 'All', label: 'All' },
  { key: 'Not Started', label: 'Not started' },
  { key: 'On-Hold', label: 'On hold' },
  { key: 'Shelved', label: 'Shelved' },
  { key: 'On-Going', label: 'In progress' },
  { key: 'Completed', label: 'Done' },
];

function TaskRow({ task, last, onToggle, onOpen, onFocus }) {
  const { colors } = useTheme();
  const done = task.status === 'Completed';
  const overdue = isOverdue(task.scheduledDate, done);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.divider }}>
      <Checkbox checked={done} onPress={onToggle} size={22} label={done ? `Mark ${task.title} not done` : `Mark ${task.title} done`} />
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${task.title}`} onPress={onOpen} style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <AppText variant="title" color={done ? colors.textMuted : colors.text} style={done && { textDecorationLine: 'line-through' }}>{task.title}</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <StatusPill status={task.status} />
          <AppText variant="caption" tone="muted">
            {task.category || 'General'}
            {task.scheduledDate ? ' · ' : ''}
          </AppText>
          {task.scheduledDate ? (
            <AppText variant="caption" color={overdue ? colors.dangerText : colors.textMuted} style={overdue && { fontFamily: 'Inter_500Medium' }}>
              {overdue ? `Overdue · ${shortDate(task.scheduledDate)}` : shortDate(task.scheduledDate)}
            </AppText>
          ) : null}
        </View>
      </Pressable>
      {!done && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Start session for ${task.title}`}
          onPress={onFocus}
          style={{ width: 44, height: 44, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}
        >
          <Play size={14} color={colors.accent} fill={colors.accent} />
        </Pressable>
      )}
    </View>
  );
}

const idTime = (doc) => (doc?._id && /^[a-f0-9]{24}$/i.test(doc._id) ? parseInt(doc._id.slice(0, 8), 16) * 1000 : 0);
const modifiedAt = (doc) => Date.parse(doc?.updatedAt || doc?.createdAt || '') || idTime(doc);

export default function TasksScreen({ navigation }) {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const { show } = useToast();
  const startFocusOn = useStartFocus();
  const { inventory, groups, loading, loaded, error } = useSelector((s) => s.tasks);
  const [filter, setFilter] = useState('All');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [groupBy, setGroupBy] = useState('group');

  const load = useCallback(() => {
    dispatch(fetchInventory());
    dispatch(fetchGroups());
  }, [dispatch]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const colorFor = (name, list) => list[0]?.groupId?.color || groups.find((g) => g.name === name)?.color || colors.textMuted;
  const all = useMemo(() => Object.values(inventory).flat(), [inventory]);
  const overdue = all.filter((t) => isOverdue(t.scheduledDate, t.status === 'Completed'));
  const q = query.trim().toLowerCase();

  const byCategory = () => {
    const out = {};
    all.forEach((t) => { const c = t.category || 'General'; (out[c] = out[c] || []).push(t); });
    return Object.entries(out).sort(([a], [b]) => {
      const ia = CATEGORIES.indexOf(a);
      const ib = CATEGORIES.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  };
  const groupTime = (name) => idTime(groups.find((g) => g.name === name));
  const sections = (groupBy === 'group' ? Object.entries(inventory) : byCategory())
    .map(([name, list]) => {
      const rows = list
        .filter((t) => (filter === 'All' || t.status === filter) && (!q || t.title.toLowerCase().includes(q)))
        .sort((x, y) => modifiedAt(y) - modifiedAt(x));
      return {
        name,
        color: groupBy === 'group' ? colorFor(name, list) : colors.textMuted,
        rows,
        total: list.length,
        modified: Math.max(groupBy === 'group' ? groupTime(name) : 0, ...list.map(modifiedAt)),
      };
    })
    .filter((g) => g.rows.length > 0)
    .sort((a, b) => b.modified - a.modified);

  const groupCount = Object.entries(inventory).filter(([name, list]) => list.length || name !== 'Uncategorized').length;

  const toggle = async (task) => {
    const done = task.status === 'Completed';
    const status = done ? 'Not Started' : 'Completed';
    dispatch(markEntryTask({ taskId: task._id, status }));
    const r = await dispatch(setTaskStatus({ id: task._id, status, previous: task.status }));
    if (r.error) {
      dispatch(markEntryTask({ taskId: task._id, status: task.status }));
      show(r.payload);
    }
  };

  const reschedule = () => {
    Alert.alert(
      'Reschedule overdue tasks?',
      `${overdue.length} task${overdue.length === 1 ? '' : 's'} will move to today.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move to today',
          onPress: async () => {
            const r = await dispatch(rescheduleOverdue(overdue.map((t) => t._id)));
            show(r.error ? r.payload : 'Overdue tasks moved to today');
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <PageHeader overline={`${all.length} task${all.length === 1 ? '' : 's'} · ${groupCount} group${groupCount === 1 ? '' : 's'}`} title="Tasks">
        <IconButton icon={searching ? X : Search} label={searching ? 'Close search' : 'Search tasks'} onPress={() => { setSearching(!searching); setQuery(''); }} />
        <IconButton icon={Plus} label="New task" variant="accent" onPress={() => setCreating(true)} />
      </PageHeader>

      {searching && (
        <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
          <TextField placeholder="Search tasks" value={query} onChangeText={setQuery} autoFocus returnKeyType="search" height={48} />
        </View>
      )}

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityLabel="Filter by status"
          contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingBottom: 12 }}
        >
          {FILTERS.map((f) => (
            <Chip
              key={f.key}
              label={f.label}
              count={f.key === 'All' ? all.length : all.filter((t) => t.status === f.key).length}
              selected={filter === f.key}
              onPress={() => setFilter(f.key)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollBody refreshing={loading && loaded} onRefresh={load}>
        {all.length > 0 && (
          <SegmentedControl
            role="group"
            label="Group by"
            value={groupBy}
            onChange={setGroupBy}
            options={[{ value: 'group', label: 'By group' }, { value: 'category', label: 'By kind' }]}
          />
        )}
        {overdue.length > 0 && (
          <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.dangerBorder, borderRadius: radius.xl }}>
            <TriangleAlert size={18} color={colors.dangerInk} />
            <AppText variant="metaStrong" color={colors.dangerInk} style={{ flex: 1 }}>
              {overdue.length} task{overdue.length === 1 ? ' is' : 's are'} overdue.
            </AppText>
            <Pressable accessibilityRole="button" onPress={reschedule} style={{ height: 36, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.dangerBorder, backgroundColor: colors.surface, borderRadius: radius.md, justifyContent: 'center' }}>
              <AppText variant="metaStrong" color={colors.dangerInk}>Reschedule</AppText>
            </Pressable>
          </View>
        )}

        {error && !loaded && <EmptyState title="Couldn't load your tasks" body={error} action="Try again" onAction={load} />}

        {loaded && all.length === 0 && (
          <EmptyState title="No tasks yet" body="Add the things you want to watch, read or practise, then plan them into your day." action="New task" onAction={() => setCreating(true)} />
        )}

        {sections.map((g) => (
          <View key={g.name} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: g.color }} />
              <AppText variant="h4" accessibilityRole="header" style={{ flex: 1 }}>{g.name}</AppText>
              <AppText variant="caption" tone="muted">{g.rows.length}</AppText>
            </View>
            <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, overflow: 'hidden' }}>
              {g.rows.map((t, i) => (
                <TaskRow
                  key={t._id}
                  task={t}
                  last={i === g.rows.length - 1}
                  onToggle={() => toggle(t)}
                  onOpen={() => navigation.navigate('TaskDetails', { taskId: t._id })}
                  onFocus={() => startFocusOn(refForTask(t))}
                />
              ))}
            </View>
          </View>
        ))}

        {loaded && all.length > 0 && sections.length === 0 && (
          <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, padding: 28, alignItems: 'center', gap: 10 }}>
            <AppText variant="body" tone="muted">{q ? 'No tasks match your search.' : `No tasks with the status ${TASK_STATUS_LABELS[filter] || filter}.`}</AppText>
            <Button variant="secondary" label="Show all tasks" onPress={() => { setFilter('All'); setQuery(''); }} />
          </View>
        )}
      </ScrollBody>

      <NewTaskSheet visible={creating} onClose={() => setCreating(false)} />
    </Screen>
  );
}
