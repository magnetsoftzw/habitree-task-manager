import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, Ellipsis, Pencil, Trash2 } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import AppText from '../../components/ui/AppText';
import { Badge, EmptyState, IconButton, SegmentedControl } from '../../components/ui/Controls';
import { Screen } from '../../components/ui/Layout';
import { OptionSheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import BoardView from '../../components/projects/BoardView';
import TaskListView from '../../components/projects/TaskListView';
import { ProjectFormSheet } from './ProjectsScreen';
import { deleteProject, fetchProject } from '../../store/slices/ProjectsSlice';
import { fetchProjectTasks } from '../../store/slices/ProjectTasksSlice';
import { setProjectView } from '../../store/slices/PrefsSlice';
import { useProjectRoom } from '../../api/Socket';
import { initials } from '../../utils/Format';
import { projectColor } from '../../utils/Status';

export default function ProjectDetailScreen({ route, navigation }) {
  const { projectId } = route.params;
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const { show } = useToast();
  const project = useSelector((s) => (s.projects.current?._id === projectId ? s.projects.current : null));
  const summary = useSelector((s) => s.projects.items.find((p) => p._id === projectId));
  const savedView = useSelector((s) => s.prefs.projectViews[projectId]);
  const listTasks = useSelector((s) => s.projectTasks.byProject[projectId]?.tasks);
  const [view, setView] = useState(route.params.view || savedView || 'board');
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);

  useProjectRoom(projectId);

  useEffect(() => {
    if (route.params.view && route.params.view !== view) setView(route.params.view);
  }, [route.params.view]);

  const load = useCallback(() => {
    dispatch(fetchProject(projectId)).then((r) => setError(r.error ? r.payload : null));
    dispatch(fetchProjectTasks(projectId));
  }, [dispatch, projectId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const switchView = (v) => {
    setView(v);
    dispatch(setProjectView({ projectId, view: v }));
    navigation.setParams({ view: v });
  };

  const info = project || summary;
  const color = projectColor(info || { _id: projectId });
  const cardCount = project?.boardCardCount ?? summary?.boardCardCount ?? 0;
  const openCount = listTasks ? listTasks.filter((t) => t.status !== 'done').length : summary?.openTaskCount ?? 0;

  const remove = () => {
    Alert.alert('Delete project?', `${info?.name} will be deleted with all of its board cards and list tasks. This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete project',
        style: 'destructive',
        onPress: async () => {
          const r = await dispatch(deleteProject(projectId));
          if (r.error) return show(r.payload);
          show('Project deleted');
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to projects" onPress={() => navigation.goBack()} style={{ width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={22} color={colors.text} />
          </Pressable>
          <Badge label={initials(info?.name || '')} color={color} size={32} fontSize={13} radiusSize={9} />
          <AppText variant="h2" accessibilityRole="header" numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 20 }}>{info?.name || 'Project'}</AppText>
          <IconButton icon={Ellipsis} label="Project options" onPress={() => setMenu(true)} disabled={!project} />
        </View>
        <SegmentedControl
          label="Project view"
          value={view}
          onChange={switchView}
          options={[
            { value: 'board', label: `Board · ${cardCount}` },
            { value: 'list', label: `Task list · ${openCount}` },
          ]}
        />
      </View>

      {error && !project ? (
        <View style={{ paddingHorizontal: 20 }}>
          <EmptyState title="Couldn't open this project" body={error} action="Try again" onAction={load} />
        </View>
      ) : !project ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : view === 'board' ? (
        <BoardView project={project} navigation={navigation} />
      ) : (
        <TaskListView projectId={projectId} navigation={navigation} />
      )}

      <OptionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={info?.name}
        subtitle="Board cards and list tasks are kept separate — both belong to this project."
        options={[
          { label: 'Edit project', icon: Pencil, onPress: () => setEditing(project) },
          { label: 'Delete project', icon: Trash2, danger: true, onPress: remove },
        ]}
      />
      <ProjectFormSheet project={editing} onClose={() => setEditing(null)} />
    </Screen>
  );
}
