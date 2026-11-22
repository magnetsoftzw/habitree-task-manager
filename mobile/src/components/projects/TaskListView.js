import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import {
  ArchiveRestore, ArrowDown, ArrowUp, ArrowUpToLine, CalendarDays, CalendarPlus, ChevronRight, Ellipsis, FolderInput, Pencil, Play, Plus, Trash2,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, radius } from '../../theme/Tokens';
import AppText from '../ui/AppText';
import { Button, Checkbox, Chip, DashedButton, EmptyState, IconButton, SegmentedControl } from '../ui/Controls';
import { DateField, TextField } from '../ui/Fields';
import { Fab, PromptSheet, ScrollBody } from '../ui/Layout';
import Sheet, { OptionSheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import PlanSheet from '../plan/PlanSheet';
import { useStartFocus } from '../focus/FocusActions';
import {
  addSubtask, createProjectTask, createTaskGroup, deleteProjectTask, deleteSubtask, deleteTaskGroup, fetchProjectTasks,
  renameTaskGroup, reorderProjectTasks, reorderSubtasks, updateProjectTask, updateSubtask,
} from '../../store/slices/ProjectTasksSlice';
import { fetchPlannerRange } from '../../store/slices/PlannerSlice';
import { refForListTask, refForSubtask } from '../../store/TaskThunks';
import { addDays, isOverdue, shortDate, toDateKey, todayKey } from '../../utils/Format';
import { LIST_STATUS_LABELS } from '../../utils/Status';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Hide done' },
  { key: 'not_started', label: 'Not started' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'done', label: 'Done' },
  { key: 'shelved', label: 'Shelved' },
];

const move = (list, from, to) => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

function AddSubtaskRow({ onAdd }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  const submit = async () => {
    const title = value.trim();
    if (!title) return setOpen(false);
    setValue('');
    await onAdd(title);
  };

  if (!open) {
    return (
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Plus size={16} color={colors.accent} strokeWidth={2.4} />
        <AppText variant="bodyStrong" tone="accent">Add subtask</AppText>
      </Pressable>
    );
  }
  return (
    <TextInput
      autoFocus
      accessibilityLabel="New subtask title"
      placeholder="Subtask title, then press Enter"
      placeholderTextColor={colors.textMuted}
      value={value}
      onChangeText={setValue}
      maxLength={200}
      returnKeyType="done"
      blurOnSubmit={false}
      onSubmitEditing={submit}
      onBlur={() => { if (!value.trim()) setOpen(false); }}
      style={{ minHeight: 44, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: 12, fontSize: 16, fontFamily: fonts.regular, color: colors.text, backgroundColor: colors.surface }}
    />
  );
}

function ListTask({ task, index, count, expanded, plannedOn, onToggleOpen, onMenu, onSubMenu, actions }) {
  const { colors } = useTheme();
  const done = task.status === 'done';
  const subs = task.subtasks || [];
  const doneSubs = subs.filter((s) => s.done).length;
  const overdue = isOverdue(task.dueDate, done);
  const allSubsDone = subs.length > 0 && doneSubs === subs.length && !done;

  const accessibilityActions = [
    { name: 'activate', label: expanded ? 'Collapse' : 'Expand' },
    { name: 'menu', label: 'More options' },
    index > 0 && { name: 'moveUp', label: 'Move up' },
    index < count - 1 && { name: 'moveDown', label: 'Move down' },
  ].filter(Boolean);

  return (
    <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
        <Checkbox checked={done} onPress={() => actions.setStatus(done ? 'not_started' : 'done')} label={done ? `Mark ${task.title} not done` : `Mark ${task.title} done`} />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityHint="Long press for more options"
          accessibilityActions={accessibilityActions}
          onAccessibilityAction={(e) => {
            const name = e.nativeEvent.actionName;
            if (name === 'activate') onToggleOpen();
            if (name === 'menu') onMenu();
            if (name === 'moveUp') actions.moveTo(index - 1);
            if (name === 'moveDown') actions.moveTo(index + 1);
          }}
          onPress={onToggleOpen}
          onLongPress={onMenu}
          style={{ flex: 1, minWidth: 0, gap: 5 }}
        >
          <AppText variant="title" color={done ? colors.textMuted : colors.text} style={done && { textDecorationLine: 'line-through' }}>{task.title}</AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {subs.length > 0 && (
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.divider, overflow: 'hidden' }}>
                <View style={{ height: 4, width: `${Math.round((doneSubs / subs.length) * 100)}%`, backgroundColor: colors.accent }} />
              </View>
            )}
            <AppText variant="caption" tone="muted">
              {subs.length ? `${doneSubs} / ${subs.length} subtasks` : 'No subtasks'}
              {task.dueDate && !overdue ? ` · Due ${shortDate(task.dueDate)}` : ''}
              {task.status === 'in_progress' ? ' · In progress' : ''}
              {task.status === 'shelved' ? ' · Shelved' : ''}
            </AppText>
            {overdue && <AppText variant="caption" color={colors.dangerText} style={{ fontFamily: fonts.medium }}>Overdue · {shortDate(task.dueDate)}</AppText>}
            {plannedOn && (
              <View accessibilityLabel={`Planned for ${shortDate(plannedOn)}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: colors.accentSoft }}>
                <CalendarDays size={11} color={colors.onAccentSoft} />
                <AppText variant="tinyStrong" color={colors.onAccentSoft}>{plannedOn === todayKey() ? 'Today' : shortDate(plannedOn)}</AppText>
              </View>
            )}
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={expanded ? `Collapse ${task.title}` : `Expand ${task.title}`} onPress={onToggleOpen} style={{ width: 32, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <ChevronRight size={18} color={colors.textMuted} style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }} />
        </Pressable>
      </View>

      {allSubsDone && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 14, marginBottom: 12, padding: 10, borderRadius: radius.md, backgroundColor: colors.accentSoft }}>
          <AppText variant="meta" color={colors.onAccentSoft} style={{ flex: 1 }}>All subtasks done — mark task done?</AppText>
          <Pressable accessibilityRole="button" onPress={() => actions.setStatus('done')} style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.accent, justifyContent: 'center' }}>
            <AppText variant="metaStrong" color={colors.onAccent}>Mark done</AppText>
          </Pressable>
        </View>
      )}

      {expanded && (
        <View style={{ paddingTop: 4, paddingRight: 14, paddingBottom: 10, paddingLeft: 50, backgroundColor: colors.surfaceSubtle, borderTopWidth: 1, borderTopColor: colors.divider }}>
          {subs.map((s, i) => (
            <View key={s._id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
              <Checkbox size={24} checked={s.done} onPress={() => actions.toggleSub(s)} label={s.done ? `Mark ${s.title} not done` : `Mark ${s.title} done`} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${s.title}. Subtask options`}
                onPress={() => onSubMenu(s, i)}
                style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}
              >
                <AppText variant="body" color={s.done ? colors.textMuted : colors.text} style={s.done && { textDecorationLine: 'line-through' }}>{s.title}</AppText>
                {s.shelved && !s.done && <AppText variant="tiny" tone="muted">Shelved</AppText>}
              </Pressable>
            </View>
          ))}
          <AddSubtaskRow onAdd={actions.addSub} />
          <View style={{ flexDirection: 'row', gap: 8, paddingTop: 6 }}>
            <Button label="Add to plan" variant="secondary" height={40} style={{ flex: 1 }} textStyle={{ fontSize: 13 }} onPress={actions.plan} />
            <Button label="Focus" icon={Play} height={40} style={{ flex: 1 }} textStyle={{ fontSize: 13 }} onPress={actions.focus} disabled={done} />
          </View>
        </View>
      )}
    </View>
  );
}

function TaskFormSheet({ task, groups, onClose, onSubmit }) {
  const isEdit = !!task?._id;
  const [groupId, setGroupId] = useState(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [due, setDue] = useState(null);
  const [status, setStatus] = useState('not_started');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setNotes(task.notes || '');
      setDue(task.dueDate ? new Date(task.dueDate) : null);
      setStatus(task.status || 'not_started');
      setGroupId(task.groupId || null);
      setError(null);
    }
  }, [task]);

  const submit = async () => {
    if (!title.trim()) return setError('Give the task a title');
    setBusy(true);
    try {
      await onSubmit({ title: title.trim(), notes, dueDate: due ? due.toISOString() : null, status, ...(groups && { groupId }) });
      onClose();
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={!!task} onClose={onClose} title={isEdit ? 'Edit details' : 'Add task'} footer={<Button label={isEdit ? 'Save' : 'Add task'} onPress={submit} loading={busy} height={52} />}>
      <TextField label="Title" placeholder="e.g. Prepare the Android APK release" value={title} onChangeText={(t) => { setTitle(t); setError(null); }} maxLength={200} error={error} autoFocus={!isEdit} />
      <View style={{ gap: 8 }}>
        <AppText variant="label">Status</AppText>
        <SegmentedControl
          role="group"
          label="Status"
          value={status}
          onChange={setStatus}
          options={Object.entries(LIST_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </View>
      {groups && groups.length > 0 && (
        <View style={{ gap: 8 }}>
          <AppText variant="label">Group</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Chip label="No group" selected={!groupId} onPress={() => setGroupId(null)} />
            {groups.map((g) => <Chip key={g._id} label={g.name} selected={groupId === g._id} onPress={() => setGroupId(g._id)} />)}
          </ScrollView>
        </View>
      )}
      <DateField label="Due date" value={due} onChange={setDue} />
      <TextField label="Notes" placeholder="Optional" value={notes} onChangeText={setNotes} multiline maxLength={5000} />
    </Sheet>
  );
}

export default function TaskListView({ projectId }) {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const { show } = useToast();
  const startFocusOn = useStartFocus();
  const bucket = useSelector((s) => s.projectTasks.byProject[projectId]);
  const planned = useSelector((s) => s.planner.range);
  const [open, setOpen] = useState({});
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sticky, setSticky] = useState({});
  const [hidden, setHidden] = useState({});
  const [menuTask, setMenuTask] = useState(null);
  const [subMenu, setSubMenu] = useState(null);
  const [renamingSub, setRenamingSub] = useState(null);
  const [form, setForm] = useState(null);
  const [planning, setPlanning] = useState(null);
  const [groupMenu, setGroupMenu] = useState(null);
  const [groupPrompt, setGroupPrompt] = useState(null);
  const [movingTask, setMovingTask] = useState(null);

  useEffect(() => {
    dispatch(fetchPlannerRange({ from: todayKey(), to: toDateKey(addDays(new Date(), 60)) }));
  }, [dispatch]);

  const all = useMemo(() => (bucket?.tasks || []).filter((t) => !hidden[t._id]), [bucket, hidden]);
  const q = query.trim().toLowerCase();
  const tasks = useMemo(() => all.filter((t) => {
    if (q && !t.title.toLowerCase().includes(q) && !(t.subtasks || []).some((s) => s.title.toLowerCase().includes(q))) return false;
    if (filter === 'open') return (t.status !== 'done' && t.status !== 'shelved') || sticky[t._id];
    if (filter !== 'all') return t.status === filter;
    return true;
  }), [all, filter, q, sticky]);

  const groupsOn = bucket?.groupsSupported !== false;
  const groups = useMemo(() => (groupsOn ? bucket?.groups || [] : []), [bucket, groupsOn]);
  const filtering = filter !== 'all' || !!q;
  const groupKey = (t) => (t.groupId && groups.some((g) => g._id === t.groupId) ? t.groupId : null);
  const sections = useMemo(() => {
    if (!groups.length) return [{ key: 'all', group: null, tasks }];
    const ungrouped = tasks.filter((t) => !groupKey(t));
    return [
      ...(ungrouped.length ? [{ key: 'none', group: null, tasks: ungrouped }] : []),
      ...groups.map((g) => ({ key: g._id, group: g, tasks: tasks.filter((t) => t.groupId === g._id) }))
        .filter((s) => s.tasks.length || !filtering),
    ];
  }, [groups, tasks, filtering]);
  const siblingsOf = (task) => (bucket?.tasks || []).filter((t) => !hidden[t._id] && groupKey(t) === groupKey(task));

  const plannedDates = useMemo(() => {
    const map = {};
    Object.keys(planned).sort().forEach((date) => {
      if (date < todayKey()) return;
      planned[date].forEach((e) => { if (e.taskType === 'projectTask' && !map[e.taskId]) map[e.taskId] = date; });
    });
    return map;
  }, [planned]);

  const run = async (action, success) => {
    const r = await dispatch(action);
    if (r.error) show(r.payload);
    else if (success) show(success);
    return r;
  };

  const reorderTo = (task, to) => {
    const ids = (bucket?.tasks || []).map((t) => t._id);
    const from = ids.indexOf(task._id);
    if (to < 0 || to >= ids.length || from === to) return;
    run(reorderProjectTasks({ projectId, taskIds: move(ids, from, to) }));
  };

  const confirmDelete = (task) => {
    const doDelete = () => {
      setHidden((h) => ({ ...h, [task._id]: true }));
      let undone = false;
      show(`Deleted "${task.title}"`, {
        action: { label: 'Undo', onPress: () => { undone = true; setHidden((h) => ({ ...h, [task._id]: false })); } },
        onExpire: async () => {
          if (undone) return;
          const r = await dispatch(deleteProjectTask({ projectId, taskId: task._id }));
          if (r.error) {
            setHidden((h) => ({ ...h, [task._id]: false }));
            show(r.payload);
          }
        },
      });
    };
    const n = task.subtasks?.length || 0;
    if (!n) return doDelete();
    Alert.alert(`Delete task and its ${n} subtask${n === 1 ? '' : 's'}?`, task.title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  };

  const moveWithin = (task, siblings, to) => {
    const target = siblings[to];
    if (target) reorderTo(task, (bucket?.tasks || []).findIndex((t) => t._id === target._id));
  };

  const removeGroup = (group) => {
    const n = (bucket?.tasks || []).filter((t) => t.groupId === group._id).length;
    Alert.alert(`Delete "${group.name}"?`, n ? `Its ${n} task${n === 1 ? '' : 's'} will move to No group.` : 'This group has no tasks.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete group', style: 'destructive', onPress: () => run(deleteTaskGroup({ projectId, groupId: group._id }), 'Group deleted') },
    ]);
  };

  const actionsFor = (task, index, siblings) => ({
    setStatus: (status) => {
      if (status === 'done') setSticky((m) => ({ ...m, [task._id]: true }));
      return run(updateProjectTask({ projectId, taskId: task._id, updates: { status } }));
    },
    toggleSub: (s) => run(updateSubtask({ projectId, taskId: task._id, subtaskId: s._id, updates: { done: !s.done } })),
    addSub: (title) => run(addSubtask({ projectId, taskId: task._id, title })),
    moveTo: (to) => moveWithin(task, siblings, to),
    plan: () => setPlanning(refForListTask(task, projectId)),
    focus: () => startFocusOn(refForListTask(task, projectId)),
    index,
  });

  if (!bucket || (!bucket.loaded && bucket.loading)) return <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />;

  const menuSiblings = menuTask ? siblingsOf(menuTask) : [];
  const menuIndex = menuTask ? menuSiblings.findIndex((t) => t._id === menuTask._id) : -1;
  const subTask = subMenu ? bucket.tasks.find((t) => t._id === subMenu.taskId) : null;

  return (
    <View style={{ flex: 1 }}>
      {all.length > 0 && (
        <View style={{ gap: 10, paddingBottom: 10 }}>
          {all.length > 5 && (
            <View style={{ paddingHorizontal: 20 }}>
              <TextInput
                accessibilityLabel="Search tasks in this list"
                placeholder="Search tasks and subtasks"
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
                style={{ height: 44, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: 12, fontSize: 15, fontFamily: fonts.regular, color: colors.text, backgroundColor: colors.surface }}
              />
            </View>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Filter tasks" contentContainerStyle={{ gap: 6, paddingHorizontal: 20 }}>
            {FILTERS.map((f) => (
              <Chip
                key={f.key}
                label={f.label}
                count={['all', 'open'].includes(f.key) ? undefined : all.filter((t) => t.status === f.key).length}
                selected={filter === f.key}
                onPress={() => { setFilter(f.key); setSticky({}); }}
              />
            ))}
          </ScrollView>
        </View>
      )}
      <ScrollBody bottomPad={100} gap={10} refreshing={bucket.loading} onRefresh={() => dispatch(fetchProjectTasks(projectId))}>
        {bucket.error && !bucket.loaded && <EmptyState title="Couldn't load the task list" body={bucket.error} action="Try again" onAction={() => dispatch(fetchProjectTasks(projectId))} />}
        {bucket.loaded && all.length > 0 && tasks.length === 0 && (
          <EmptyState title="No tasks match" body={q ? 'Try a different search.' : 'Try another filter.'} action="Show all" actionVariant="secondary" onAction={() => { setFilter('all'); setQuery(''); }} />
        )}
        {bucket.loaded && all.length === 0 && groups.length === 0 && (
          <EmptyState
            title="No tasks in this list yet"
            body="Use the task list for work that doesn't need board columns, like releases, docs and admin."
            action="Add task"
            onAction={() => setForm({})}
          />
        )}
        {(all.length > 0 || groups.length > 0) && sections.map((section) => (
          <View key={section.key} style={{ gap: 10 }}>
            {groups.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4, marginTop: 4 }}>
                <AppText variant="h4" accessibilityRole="header" style={{ flex: 1 }} numberOfLines={1}>{section.group?.name || 'No group'}</AppText>
                <AppText variant="caption" tone="muted">
                  {section.tasks.filter((t) => t.status === 'done').length} / {section.tasks.length}
                </AppText>
                {section.group ? (
                  <IconButton icon={Ellipsis} label={`${section.group.name} group options`} variant="ghost" iconSize={18} onPress={() => setGroupMenu(section.group)} />
                ) : <View style={{ width: 44, height: 44 }} />}
              </View>
            )}
            {section.tasks.map((t, i) => (
              <ListTask
                key={t._id}
                task={t}
                index={i}
                count={section.tasks.length}
                expanded={!!open[t._id]}
                plannedOn={plannedDates[t._id]}
                onToggleOpen={() => setOpen((o) => ({ ...o, [t._id]: !o[t._id] }))}
                onMenu={() => setMenuTask(t)}
                onSubMenu={(s, si) => setSubMenu({ taskId: t._id, subtask: s, index: si })}
                actions={actionsFor(t, i, section.tasks)}
              />
            ))}
            {section.group && section.tasks.length === 0 && (
              <DashedButton label={`Add a task to ${section.group.name}`} icon={Plus} onPress={() => setForm({ groupId: section.group._id })} />
            )}
          </View>
        ))}
        {bucket.loaded && groupsOn && !filtering && (
          <DashedButton label="New group" sublabel={groups.length ? undefined : 'Group tasks under headings like Release or Docs'} icon={Plus} onPress={() => setGroupPrompt({})} />
        )}
        {tasks.length > 0 && (
          <AppText variant="caption" tone="muted" style={{ textAlign: 'center', paddingTop: 4 }}>Long press a task to edit, reorder or delete it.</AppText>
        )}
      </ScrollBody>

      <Fab label="Add task" onPress={() => setForm({})} />

      <TaskFormSheet
        task={form}
        groups={groupsOn ? groups : null}
        onClose={() => setForm(null)}
        onSubmit={async (body) => {
          const r = form?._id
            ? await dispatch(updateProjectTask({ projectId, taskId: form._id, updates: body }))
            : await dispatch(createProjectTask({ projectId, ...body }));
          if (r.error) throw r.payload;
          if (!form?._id) setOpen((o) => ({ ...o, [r.payload._id]: true }));
        }}
      />

      <OptionSheet
        visible={!!menuTask}
        onClose={() => setMenuTask(null)}
        title={menuTask?.title}
        subtitle={menuTask ? LIST_STATUS_LABELS[menuTask.status] : ''}
        options={menuTask ? [
          { label: 'Add to plan', icon: CalendarPlus, onPress: () => setPlanning(refForListTask(menuTask, projectId)) },
          { label: 'Edit details', icon: Pencil, hint: 'Notes, due date, status and group', onPress: () => setForm(menuTask) },
          groups.length > 0 && { label: 'Add to group', icon: FolderInput, onPress: () => setMovingTask(menuTask) },
          menuIndex > 0 && { label: 'Move to top', icon: ArrowUpToLine, onPress: () => moveWithin(menuTask, menuSiblings, 0) },
          menuIndex > 0 && { label: 'Move up', icon: ArrowUp, onPress: () => moveWithin(menuTask, menuSiblings, menuIndex - 1) },
          menuIndex >= 0 && menuIndex < menuSiblings.length - 1 && { label: 'Move down', icon: ArrowDown, onPress: () => moveWithin(menuTask, menuSiblings, menuIndex + 1) },
          { label: 'Delete', icon: Trash2, danger: true, onPress: () => confirmDelete(menuTask) },
        ] : []}
      />

      <OptionSheet
        visible={!!subMenu}
        onClose={() => setSubMenu(null)}
        title={subMenu?.subtask.title}
        subtitle={subTask?.title}
        options={subMenu && subTask ? [
          !subMenu.subtask.done && { label: 'Add to plan', icon: CalendarPlus, onPress: () => setPlanning(refForSubtask(subTask, subMenu.subtask, projectId)) },
          subMenu.subtask.shelved && !subMenu.subtask.done && { label: 'Unshelve', icon: ArchiveRestore, onPress: () => run(updateSubtask({ projectId, taskId: subTask._id, subtaskId: subMenu.subtask._id, updates: { shelved: false } })) },
          { label: 'Rename', icon: Pencil, onPress: () => setRenamingSub(subMenu) },
          subMenu.index > 0 && {
            label: 'Move up',
            icon: ArrowUp,
            onPress: () => run(reorderSubtasks({ projectId, taskId: subTask._id, subtaskIds: move(subTask.subtasks.map((s) => s._id), subMenu.index, subMenu.index - 1) })),
          },
          subMenu.index < subTask.subtasks.length - 1 && {
            label: 'Move down',
            icon: ArrowDown,
            onPress: () => run(reorderSubtasks({ projectId, taskId: subTask._id, subtaskIds: move(subTask.subtasks.map((s) => s._id), subMenu.index, subMenu.index + 1) })),
          },
          { label: 'Delete subtask', icon: Trash2, danger: true, onPress: () => run(deleteSubtask({ projectId, taskId: subTask._id, subtaskId: subMenu.subtask._id })) },
        ] : []}
      />

      <PromptSheet
        visible={!!renamingSub}
        onClose={() => setRenamingSub(null)}
        title="Rename subtask"
        label="Subtask"
        initialValue={renamingSub?.subtask.title || ''}
        onSubmit={async (title) => {
          const r = await dispatch(updateSubtask({ projectId, taskId: renamingSub.taskId, subtaskId: renamingSub.subtask._id, updates: { title } }));
          if (r.error) throw r.payload;
        }}
      />

      <OptionSheet
        visible={!!groupMenu}
        onClose={() => setGroupMenu(null)}
        title={groupMenu?.name}
        options={groupMenu ? [
          { label: 'Add task to this group', icon: Plus, onPress: () => setForm({ groupId: groupMenu._id }) },
          { label: 'Rename group', icon: Pencil, onPress: () => setGroupPrompt(groupMenu) },
          { label: 'Delete group', icon: Trash2, danger: true, hint: 'Its tasks move to No group', onPress: () => removeGroup(groupMenu) },
        ] : []}
      />

      <OptionSheet
        visible={!!movingTask}
        onClose={() => setMovingTask(null)}
        title="Add to group"
        subtitle={movingTask?.title}
        options={movingTask ? [
          { label: 'No group', selected: !groupKey(movingTask), disabled: !groupKey(movingTask), hint: !groupKey(movingTask) ? 'Current' : undefined, onPress: () => run(updateProjectTask({ projectId, taskId: movingTask._id, updates: { groupId: null } }), 'Moved to No group') },
          ...groups.map((g) => ({
            label: g.name,
            selected: groupKey(movingTask) === g._id,
            disabled: groupKey(movingTask) === g._id,
            hint: groupKey(movingTask) === g._id ? 'Current' : undefined,
            onPress: () => run(updateProjectTask({ projectId, taskId: movingTask._id, updates: { groupId: g._id } }), `Moved to ${g.name}`),
          })),
        ] : []}
      />

      <PromptSheet
        visible={!!groupPrompt}
        onClose={() => setGroupPrompt(null)}
        title={groupPrompt?._id ? 'Rename group' : 'New group'}
        label="Group name"
        placeholder="e.g. Release"
        submitLabel={groupPrompt?._id ? 'Save' : 'Create group'}
        initialValue={groupPrompt?.name || ''}
        maxLength={60}
        onSubmit={async (name) => {
          const r = await dispatch(groupPrompt?._id
            ? renameTaskGroup({ projectId, groupId: groupPrompt._id, name })
            : createTaskGroup({ projectId, name }));
          if (r.error) throw r.payload;
        }}
      />

      <PlanSheet visible={!!planning} onClose={() => setPlanning(null)} preset={planning} />
    </View>
  );
}
