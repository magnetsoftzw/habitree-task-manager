import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useDispatch, useSelector } from 'react-redux';
import AppText from '../ui/AppText';
import Sheet from '../ui/Sheet';
import { Button, Chip } from '../ui/Controls';
import { DateField, TextField } from '../ui/Fields';
import { useToast } from '../ui/Toast';
import { createGroup, createTask, fetchInventory } from '../../store/slices/TasksSlice';
import { CATEGORIES, GROUP_COLORS } from '../../utils/Status';

export default function NewTaskSheet({ visible, onClose }) {
  const dispatch = useDispatch();
  const { show } = useToast();
  const groups = useSelector((s) => s.tasks.groups);
  const [title, setTitle] = useState('');
  const [groupId, setGroupId] = useState(null);
  const [category, setCategory] = useState('General');
  const [due, setDue] = useState(null);
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [newGroup, setNewGroup] = useState(false);
  const [subtasks, setSubtasks] = useState([]);
  const [subDraft, setSubDraft] = useState('');

  useEffect(() => {
    if (visible) {
      setTitle('');
      setGroupId(null);
      setCategory('General');
      setDue(null);
      setDescription('');
      setSubtasks([]);
      setSubDraft('');
      setError(null);
    }
  }, [visible]);

  const addSub = () => {
    const t = subDraft.trim();
    if (t) setSubtasks((list) => [...list, t]);
    setSubDraft('');
  };

  const submit = async () => {
    if (!title.trim()) return setError('Give the task a title');
    setBusy(true);
    const r = await dispatch(createTask({
      title: title.trim(),
      groupId,
      category,
      description: description.trim(),
      scheduledDate: due ? due.toISOString() : null,
      subtasks: [...subtasks, ...(subDraft.trim() ? [subDraft.trim()] : [])].map((t) => ({ title: t, isCompleted: false, status: 'Not Started' })),
    }));
    setBusy(false);
    if (r.error) return setError(r.payload);
    dispatch(fetchInventory());
    show('Task created');
    onClose();
  };

  return (
    <>
      <Sheet visible={visible && !newGroup} onClose={onClose} title="New task" footer={<Button label="Create task" onPress={submit} loading={busy} height={52} />}>
        <TextField label="Title" placeholder="e.g. Watch React Native tutorials" value={title} onChangeText={(t) => { setTitle(t); setError(null); }} maxLength={200} error={error} autoFocus />
        <View style={{ gap: 8 }}>
          <AppText variant="label">Group</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Chip label="Uncategorized" selected={!groupId} onPress={() => setGroupId(null)} />
            {groups.map((g) => <Chip key={g._id} label={g.name} dot={g.color} selected={groupId === g._id} onPress={() => setGroupId(g._id)} />)}
            <Chip label="New group" onPress={() => setNewGroup(true)} dot={undefined} />
          </ScrollView>
        </View>
        <View style={{ gap: 8 }}>
          <AppText variant="label">Kind</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map((c) => <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />)}
          </View>
        </View>
        <DateField label="Due date" value={due} onChange={setDue} />
        <View style={{ gap: 8 }}>
          <AppText variant="label">Subtasks{subtasks.length ? ` · ${subtasks.length}` : ''}</AppText>
          {subtasks.map((t, i) => (
            <View key={`${t}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 }}>
              <AppText variant="body" style={{ flex: 1 }}>{i + 1}. {t}</AppText>
              <SubRemove label={`Remove ${t}`} onPress={() => setSubtasks((list) => list.filter((_, j) => j !== i))} />
            </View>
          ))}
          <TextField placeholder="Add a step and press Enter" value={subDraft} onChangeText={setSubDraft} onSubmitEditing={addSub} blurOnSubmit={false} returnKeyType="done" maxLength={200} />
        </View>
        <TextField label="Notes" placeholder="Optional" value={description} onChangeText={setDescription} multiline maxLength={2000} />
      </Sheet>
      <NewGroupSheet
        visible={newGroup}
        defaultColor={GROUP_COLORS[groups.length % GROUP_COLORS.length]}
        onClose={() => setNewGroup(false)}
        onCreate={async (body) => {
          const r = await dispatch(createGroup(body));
          if (r.error) throw r.payload;
          setGroupId(r.payload._id);
        }}
      />
    </>
  );
}

function SubRemove({ label, onPress }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
      <X size={16} color={colors.textMuted} />
    </Pressable>
  );
}

export function NewGroupSheet({ visible, onClose, onCreate, defaultColor }) {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [color, setColor] = useState(defaultColor);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) { setName(''); setColor(defaultColor); setError(null); }
  }, [visible, defaultColor]);

  const submit = async () => {
    if (!name.trim()) return setError('Name the group');
    setBusy(true);
    try {
      await onCreate({ name: name.trim(), color });
      onClose();
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Could not create the group');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="New group" footer={<Button label="Create group" onPress={submit} loading={busy} height={52} />}>
      <TextField label="Group name" placeholder="e.g. React Native" value={name} onChangeText={(t) => { setName(t); setError(null); }} maxLength={60} error={error} autoFocus />
      <View style={{ gap: 8 }}>
        <AppText variant="label">Colour</AppText>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {GROUP_COLORS.map((c) => (
            <Pressable
              key={c}
              accessibilityRole="radio"
              accessibilityState={{ checked: color === c }}
              accessibilityLabel={`Colour ${c}`}
              onPress={() => setColor(c)}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c, alignItems: 'center', justifyContent: 'center', borderWidth: color === c ? 3 : 0, borderColor: colors.surface }}
            >
              {color === c && <Check size={18} color="#FFFFFF" strokeWidth={3} />}
            </Pressable>
          ))}
        </View>
      </View>
    </Sheet>
  );
}
