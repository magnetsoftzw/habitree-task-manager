import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { CalendarPlus, Play, Plus, Trash2, Youtube } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/Tokens';
import AppText from '../../components/ui/AppText';
import { Button, Card, Checkbox, Chip, EmptyState, IconButton, ProgressBar } from '../../components/ui/Controls';
import { BackHeader, PromptSheet, Screen, ScrollBody } from '../../components/ui/Layout';
import { DateField, TextField } from '../../components/ui/Fields';
import Sheet from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import PlanSheet from '../../components/plan/PlanSheet';
import { useStartFocus } from '../../components/focus/FocusActions';
import { clearCurrent, deleteTask, fetchGroups, fetchTask, importPlaylist, setTaskStatus, updateTask } from '../../store/slices/TasksSlice';
import { refForSubtask, refForTask } from '../../store/TaskThunks';
import { longDate } from '../../utils/Format';
import { CATEGORIES, TASK_STATUSES, TASK_STATUS_LABELS } from '../../utils/Status';

export default function TaskDetailsScreen({ route, navigation }) {
  const { taskId } = route.params;
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const { show } = useToast();
  const startFocusOn = useStartFocus();
  const task = useSelector((s) => (s.tasks.current?._id === taskId ? s.tasks.current : null));
  const groups = useSelector((s) => s.tasks.groups);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [planning, setPlanning] = useState(null);
  const [importing, setImporting] = useState(false);
  const [renaming, setRenaming] = useState(null);

  useFocusEffect(useCallback(() => {
    dispatch(fetchTask(taskId)).then((r) => { if (r.error) setError(r.payload); });
    dispatch(fetchGroups());
  }, [dispatch, taskId]));

  useEffect(() => () => { dispatch(clearCurrent()); }, [dispatch]);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setNotes(task.description || '');
    }
  }, [task?._id]);

  const save = async (updates) => {
    const r = await dispatch(updateTask({ id: taskId, updates }));
    if (r.error) show(r.payload);
    return r;
  };

  const saveSubtasks = (subtasks) => save({ subtasks });

  if (!task) {
    return (
      <Screen>
        <BackHeader title="Task" onBack={() => navigation.goBack()} />
        <View style={{ padding: 20 }}>
          {error ? <EmptyState title="Couldn't open this task" body={error} action="Go back" onAction={() => navigation.goBack()} /> : <ActivityIndicator color={colors.accent} />}
        </View>
      </Screen>
    );
  }

  const subtasks = task.subtasks || [];
  const doneSubs = subtasks.filter((s) => s.isCompleted).length;
  const progress = subtasks.length ? Math.round((doneSubs / subtasks.length) * 100) : task.status === 'Completed' ? 100 : 0;

  const changeStatus = async (status) => {
    const r = await dispatch(setTaskStatus({ id: taskId, status, previous: task.status }));
    if (r.error) show(r.payload);
  };

  const remove = () => {
    Alert.alert('Delete task?', `"${task.title}" and its ${subtasks.length} subtask${subtasks.length === 1 ? '' : 's'} will be removed from your plan and roadmaps.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const r = await dispatch(deleteTask(taskId));
          if (r.error) return show(r.payload);
          show('Task deleted');
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <Screen>
      <BackHeader title="Task" onBack={() => navigation.goBack()}>
        <IconButton icon={Trash2} label="Delete task" onPress={remove} />
      </BackHeader>

      <ScrollBody>
        <TextField
          label="Title"
          value={title}
          onChangeText={setTitle}
          maxLength={200}
          onBlur={() => { if (title.trim() && title.trim() !== task.title) save({ title: title.trim() }); else setTitle(task.title); }}
          returnKeyType="done"
        />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="Start focus" icon={Play} style={{ flex: 1 }} onPress={() => startFocusOn(refForTask(task))} disabled={task.status === 'Completed'} />
          <Button label="Add to plan" icon={CalendarPlus} variant="secondary" style={{ flex: 1 }} onPress={() => setPlanning(refForTask(task))} />
        </View>

        <View style={{ gap: 8 }}>
          <AppText variant="label">Status</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {TASK_STATUSES.map((s) => <Chip key={s} label={TASK_STATUS_LABELS[s]} selected={task.status === s} onPress={() => changeStatus(s)} />)}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <AppText variant="label">Group</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Chip label="Uncategorized" selected={!task.groupId} onPress={() => save({ groupId: null })} />
            {groups.map((g) => (
              <Chip key={g._id} label={g.name} dot={g.color} selected={(task.groupId?._id || task.groupId) === g._id} onPress={() => save({ groupId: g._id })} />
            ))}
          </ScrollView>
        </View>

        <View style={{ gap: 8 }}>
          <AppText variant="label">Kind</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[...CATEGORIES, ...(task.category === 'Project' ? ['Project'] : [])].map((c) => (
              <Chip key={c} label={c} selected={task.category === c} onPress={() => save({ category: c })} />
            ))}
          </View>
        </View>

        <DateField label="Due date" value={task.scheduledDate} onChange={(d) => save({ scheduledDate: d ? d.toISOString() : null })} />

        <TextField
          label="Notes"
          placeholder="Add notes"
          value={notes}
          onChangeText={setNotes}
          multiline
          maxLength={5000}
          onBlur={() => { if (notes !== (task.description || '')) save({ description: notes }); }}
        />

        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText variant="h4" accessibilityRole="header">Subtasks</AppText>
            <AppText variant="meta" tone="muted">{doneSubs} / {subtasks.length} · {progress}%</AppText>
          </View>
          {subtasks.length > 0 && <ProgressBar value={progress} height={6} />}
          {subtasks.map((s, i) => (
            <View key={s._id || i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
              <Checkbox
                size={24}
                checked={s.isCompleted}
                label={s.isCompleted ? `Mark ${s.title} not done` : `Mark ${s.title} done`}
                onPress={() => saveSubtasks(subtasks.map((x, j) => (j === i ? { ...x, isCompleted: !x.isCompleted, status: !x.isCompleted ? 'Completed' : 'Not Started' } : x)))}
              />
              <Pressable accessibilityRole="button" accessibilityLabel={`Rename ${s.title}`} onPress={() => setRenaming({ index: i, title: s.title })} style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}>
                <AppText variant="body" color={s.isCompleted ? colors.textMuted : colors.text} style={s.isCompleted && { textDecorationLine: 'line-through' }}>{s.title}</AppText>
              </Pressable>
              {s._id && !s.isCompleted && (
                <IconButton icon={CalendarPlus} label={`Add ${s.title} to plan`} variant="ghost" iconSize={16} onPress={() => setPlanning(refForSubtask(task, s))} />
              )}
              <IconButton icon={Trash2} label={`Delete ${s.title}`} variant="ghost" iconSize={16} onPress={() => saveSubtasks(subtasks.filter((_, j) => j !== i))} />
            </View>
          ))}
          {subtasks.length === 0 && <AppText variant="body" tone="muted">Break the task into steps to track progress.</AppText>}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="Add subtask" icon={Plus} variant="secondary" style={{ flex: 1 }} onPress={() => setAdding(true)} />
            <Button label="From YouTube" icon={Youtube} variant="secondary" style={{ flex: 1 }} onPress={() => setImporting(true)} />
          </View>
        </Card>
        {task.createdAt && (
          <AppText variant="caption" tone="muted" style={{ textAlign: 'center' }}>
            Created {longDate(task.createdAt)}{task.updatedAt ? ` · Last updated ${longDate(task.updatedAt)}` : ''}
          </AppText>
        )}
      </ScrollBody>

      <PromptSheet
        visible={adding}
        onClose={() => setAdding(false)}
        title="Add subtask"
        label="Subtask"
        placeholder="e.g. Chapter 1"
        submitLabel="Add"
        onSubmit={async (value) => {
          const r = await saveSubtasks([...subtasks, { title: value, isCompleted: false, status: 'Not Started' }]);
          if (r.error) throw r.payload;
        }}
      />
      <PromptSheet
        visible={!!renaming}
        onClose={() => setRenaming(null)}
        title="Rename subtask"
        label="Subtask"
        initialValue={renaming?.title || ''}
        onSubmit={async (value) => {
          const r = await saveSubtasks(subtasks.map((x, j) => (j === renaming.index ? { ...x, title: value } : x)));
          if (r.error) throw r.payload;
        }}
      />
      <PlaylistSheet visible={importing} onClose={() => setImporting(false)} onImport={(titles) => saveSubtasks([...subtasks, ...titles.map((t) => ({ title: t, isCompleted: false, status: 'Not Started' }))])} />
      <PlanSheet visible={!!planning} onClose={() => setPlanning(null)} preset={planning} />
    </Screen>
  );
}

function PlaylistSheet({ visible, onClose, onImport }) {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const { show } = useToast();
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible) {
      setUrl('');
      setPreview(null);
      setError(null);
    }
  }, [visible]);

  const load = async () => {
    if (!url.trim()) return setError('Paste a playlist link');
    setBusy(true);
    const r = await dispatch(importPlaylist(url.trim()));
    setBusy(false);
    if (r.error) return setError(r.payload);
    setPreview(r.payload);
  };

  const confirm = async () => {
    setBusy(true);
    const r = await onImport(preview.titles);
    setBusy(false);
    if (!r?.error) {
      show(`Added ${preview.count} subtasks`);
      onClose();
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Import a YouTube playlist"
      subtitle="Each video becomes a numbered subtask, in playlist order"
      footer={preview
        ? <Button label={`Add ${preview.count} subtasks`} onPress={confirm} loading={busy} />
        : <Button label="Preview playlist" onPress={load} loading={busy} />}
    >
      <TextField
        label="Playlist link"
        placeholder="https://www.youtube.com/playlist?list=…"
        value={url}
        onChangeText={(t) => { setUrl(t); setPreview(null); setError(null); }}
        autoCapitalize="none"
        keyboardType="url"
        error={error}
      />
      {preview && (
        <View style={{ gap: 6 }}>
          <AppText variant="label">{preview.playlistTitle}</AppText>
          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 12, gap: 6 }}>
            {preview.titles.slice(0, 8).map((t) => <AppText key={t} variant="meta" numberOfLines={1}>{t}</AppText>)}
            {preview.count > 8 && <AppText variant="meta" tone="muted">and {preview.count - 8} more</AppText>}
          </View>
        </View>
      )}
    </Sheet>
  );
}
