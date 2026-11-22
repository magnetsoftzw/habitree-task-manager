import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronRight, Plus, Search, X } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/Tokens';
import AppText from '../../components/ui/AppText';
import { Badge, Button, Card, EmptyState, IconButton, ProgressBar } from '../../components/ui/Controls';
import { PageHeader, Screen, ScrollBody } from '../../components/ui/Layout';
import Sheet from '../../components/ui/Sheet';
import { TextField } from '../../components/ui/Fields';
import { useToast } from '../../components/ui/Toast';
import { createProject, fetchProjects, updateProject } from '../../store/slices/ProjectsSlice';
import { initials, longDate } from '../../utils/Format';
import { PROJECT_COLORS, projectColor } from '../../utils/Status';

function CountTile({ label, value, onPress, accessibilityLabel }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, minHeight: 48, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, justifyContent: 'center', backgroundColor: pressed ? colors.surfaceSubtle : colors.surface })}
    >
      <AppText variant="caption" tone="muted">{label}</AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </Pressable>
  );
}

export default function ProjectsScreen({ navigation }) {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const { items, loading, loaded, error } = useSelector((s) => s.projects);
  const lastViews = useSelector((s) => s.prefs.projectViews);
  const [editing, setEditing] = useState(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const visible = items.filter((p) => !q || p.name.toLowerCase().includes(q)
    || (p.description || '').toLowerCase().includes(q) || (p.techStack || []).some((t) => t.toLowerCase().includes(q)));

  const load = useCallback(() => { dispatch(fetchProjects()); }, [dispatch]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = (project, view) => navigation.navigate('ProjectDetail', { projectId: project._id, view: view || lastViews[project._id] || 'board' });

  return (
    <Screen>
      <PageHeader overline={`${items.length} project${items.length === 1 ? '' : 's'}`} title="Projects">
        {items.length > 0 && <IconButton icon={searching ? X : Search} label={searching ? 'Close search' : 'Search projects'} onPress={() => { setSearching(!searching); setQuery(''); }} />}
        <IconButton icon={Plus} label="New project" variant="accent" onPress={() => setEditing({})} />
      </PageHeader>
      {searching && (
        <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
          <TextField placeholder="Search projects" value={query} onChangeText={setQuery} autoFocus returnKeyType="search" height={48} />
        </View>
      )}
      <ScrollBody refreshing={loading && loaded} onRefresh={load}>
        {error && !loaded && <EmptyState title="Couldn't load your projects" body={error} action="Try again" onAction={load} />}
        {loaded && items.length === 0 && (
          <EmptyState title="No projects yet" body="A project gives you a Kanban board for cards and a task list for everything else." action="New project" onAction={() => setEditing({})} />
        )}
        {loaded && items.length > 0 && visible.length === 0 && (
          <EmptyState title={`No projects match "${query.trim()}"`} body="Try a different name or tech." action="Clear search" actionVariant="secondary" onAction={() => setQuery('')} />
        )}
        {visible.map((p) => {
          const color = projectColor(p);
          return (
            <Card key={p._id} padded={false} style={{ padding: 18, gap: 14 }}>
              <Pressable accessibilityRole="link" accessibilityLabel={`Open ${p.name}`} onPress={() => open(p)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Badge label={initials(p.name)} color={color} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <AppText variant="h3" numberOfLines={2}>{p.name}</AppText>
                  <AppText variant="caption" tone="muted">Created {longDate(p.createdAt)}</AppText>
                </View>
                <ChevronRight size={20} color={colors.textMuted} />
              </Pressable>
              {p.description && p.description !== 'No Description' ? (
                <AppText variant="body" tone="secondary" numberOfLines={2}>{p.description}</AppText>
              ) : null}
              {p.techStack?.length > 0 && (
                <View accessibilityLabel={`Tech stack: ${p.techStack.join(', ')}`} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {p.techStack.map((t) => (
                    <View key={t} style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border }}>
                      <AppText variant="captionStrong" tone="secondary">{t}</AppText>
                    </View>
                  ))}
                </View>
              )}
              <View accessibilityLabel={`${p.progress || 0} percent complete`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1 }}><ProgressBar value={p.progress || 0} height={6} color={color} /></View>
                <AppText variant="metaStrong" numeric>{p.progress || 0}%</AppText>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <CountTile
                  label="Board"
                  value={`${p.boardCardCount || 0} card${p.boardCardCount === 1 ? '' : 's'}`}
                  accessibilityLabel={`Open board, ${p.boardCardCount || 0} cards`}
                  onPress={() => open(p, 'board')}
                />
                <CountTile
                  label="Task list"
                  value={`${p.openTaskCount || 0} open task${p.openTaskCount === 1 ? '' : 's'}`}
                  accessibilityLabel={`Open task list, ${p.openTaskCount || 0} open tasks`}
                  onPress={() => open(p, 'list')}
                />
              </View>
            </Card>
          );
        })}
      </ScrollBody>
      <ProjectFormSheet project={editing} onClose={() => setEditing(null)} onCreated={(p) => open(p, 'board')} />
    </Screen>
  );
}

export function ProjectFormSheet({ project, onClose, onCreated }) {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const { show } = useToast();
  const isEdit = !!project?._id;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [stack, setStack] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (project) {
      setName(project.name || '');
      setDescription(project.description && project.description !== 'No Description' ? project.description : '');
      setColor(project._id ? projectColor(project) : PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]);
      setStack((project.techStack || []).join(', '));
      setError(null);
    }
  }, [project]);

  const submit = async () => {
    if (!name.trim()) return setError('Give the project a name');
    setBusy(true);
    const body = { name: name.trim(), description: description.trim(), color, techStack: stack.split(',').map((t) => t.trim()).filter(Boolean) };
    const r = await dispatch(isEdit ? updateProject({ id: project._id, updates: body }) : createProject(body));
    setBusy(false);
    if (r.error) return setError(r.payload);
    show(isEdit ? 'Project saved' : 'Project created');
    onClose();
    if (!isEdit) onCreated?.(r.payload);
  };

  return (
    <Sheet
      visible={!!project}
      onClose={onClose}
      title={isEdit ? 'Edit project' : 'New project'}
      footer={<Button label={isEdit ? 'Save' : 'Create project'} onPress={submit} loading={busy} height={52} />}
    >
      <TextField label="Name" placeholder="e.g. Habitree Task Manager" value={name} onChangeText={(t) => { setName(t); setError(null); }} maxLength={120} error={error} autoFocus={!isEdit} />
      <TextField label="Description" placeholder="What is this project for?" value={description} onChangeText={setDescription} multiline maxLength={1000} />
      <TextField label="Tech stack (comma separated)" placeholder="React, Node, MongoDB" value={stack} onChangeText={setStack} autoCapitalize="none" maxLength={300} />
      <View style={{ gap: 8 }}>
        <AppText variant="label">Colour</AppText>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {PROJECT_COLORS.map((c) => (
            <Pressable
              key={c}
              accessibilityRole="radio"
              accessibilityState={{ checked: color === c }}
              accessibilityLabel={`Colour ${c}`}
              onPress={() => setColor(c)}
              style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: c, borderWidth: 3, borderColor: color === c ? colors.text : 'transparent' }}
            />
          ))}
        </View>
      </View>
    </Sheet>
  );
}
