import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';
import { ExternalLink, Ellipsis, Pencil, Play, Plus, Trash2, X } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/Tokens';
import AppText from '../../components/ui/AppText';
import { Button, EmptyState, IconButton, StatusPill } from '../../components/ui/Controls';
import { BackHeader, PromptSheet, Screen } from '../../components/ui/Layout';
import { OptionSheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import DotGrid from '../../components/roadmaps/DotGrid';
import { useStartFocus } from '../../components/focus/FocusActions';
import { deleteRoadmap, editCurrent, fetchRoadmap, saveRoadmap, toPayloadEdges, toPayloadNodes, updateNodeData } from '../../store/slices/RoadmapsSlice';
import { fetchInventory, setTaskStatus } from '../../store/slices/TasksSlice';
import { isOverdue, longDate } from '../../utils/Format';
import { TASK_STATUSES, TASK_STATUS_LABELS } from '../../utils/Status';

const NODE_WIDTH = 260;
const GAP = 58;

const topoOrder = (nodes, edges) => {
  const indeg = new Map(nodes.map((n) => [n.id, 0]));
  edges.forEach((e) => indeg.has(e.target) && indeg.set(e.target, indeg.get(e.target) + 1));
  const byY = [...nodes].sort((a, b) => (a.position?.y || 0) - (b.position?.y || 0));
  const out = [];
  const done = new Set();
  while (out.length < nodes.length) {
    const next = byY.find((n) => !done.has(n.id) && indeg.get(n.id) === 0) || byY.find((n) => !done.has(n.id));
    done.add(next.id);
    out.push(next);
    edges.filter((e) => e.source === next.id).forEach((e) => indeg.has(e.target) && indeg.set(e.target, indeg.get(e.target) - 1));
  }
  return out;
};

const reaches = (edges, from, to) => {
  const stack = [from];
  const seen = new Set();
  while (stack.length) {
    const id = stack.pop();
    if (id === to) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    edges.filter((e) => e.source === id).forEach((e) => stack.push(e.target));
  }
  return false;
};

function Connector({ linked, hint }) {
  const { colors } = useTheme();
  return (
    <View style={{ height: GAP, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={2} height={GAP} style={{ position: 'absolute' }}>
        <Line x1={1} y1={0} x2={1} y2={GAP} stroke={linked ? colors.accent : colors.textFaint} strokeWidth={2} strokeDasharray={linked ? undefined : '4 4'} />
      </Svg>
      {!linked && hint && <AppText variant="caption" tone="muted" style={{ position: 'absolute', left: '50%', marginLeft: 12 }}>{hint}</AppText>}
    </View>
  );
}

export default function RoadmapEditorScreen({ route, navigation }) {
  const { roadmapId } = route.params;
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const startFocusOn = useStartFocus();
  const roadmap = useSelector((s) => (s.roadmaps.current?._id === roadmapId ? s.roadmaps.current : null));
  const saving = useSelector((s) => s.roadmaps.saving);
  const inventory = useSelector((s) => s.tasks.inventory);
  const [selectedId, setSelectedId] = useState(null);
  const [linkFrom, setLinkFrom] = useState(null);
  const [adding, setAdding] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    dispatch(fetchRoadmap(roadmapId)).then((r) => setError(r.error ? r.payload : null));
    dispatch(fetchInventory());
  }, [dispatch, roadmapId]);

  const nodes = roadmap?.nodes || [];
  const edges = roadmap?.edges || [];
  const ordered = useMemo(() => topoOrder(nodes, edges), [nodes, edges]);
  const selected = nodes.find((n) => n.id === selectedId) || ordered[0];
  const titleOf = (id) => nodes.find((n) => n.id === id)?.data?.label || 'a task';

  const persist = useCallback(async (nextNodes, nextEdges) => {
    const positioned = topoOrder(nextNodes, nextEdges).map((n, i) => ({ ...n, position: { x: 0, y: i * 160 } }));
    dispatch(editCurrent({ nodes: positioned, edges: nextEdges }));
    const r = await dispatch(saveRoadmap({ id: roadmapId, nodes: toPayloadNodes(positioned), edges: toPayloadEdges(nextEdges) }));
    if (r.error) {
      show(r.payload);
      dispatch(fetchRoadmap(roadmapId));
    }
  }, [dispatch, roadmapId, show]);

  const onNodePress = (node) => {
    if (!linkFrom) return setSelectedId(node.id);
    if (node.id === linkFrom) return setLinkFrom(null);
    if (edges.some((e) => e.source === linkFrom && e.target === node.id)) {
      setLinkFrom(null);
      return show('Those tasks are already linked');
    }
    if (reaches(edges, node.id, linkFrom)) {
      setLinkFrom(null);
      return show("That link would make a loop, so it wasn't added");
    }
    persist(nodes, [...edges, { id: `e-${linkFrom}-${node.id}`, source: linkFrom, target: node.id, animated: false, label: '' }]);
    setLinkFrom(null);
    setSelectedId(node.id);
  };

  const available = Object.entries(inventory).flatMap(([group, list]) => list.map((t) => ({ ...t, groupName: group })))
    .filter((t) => !nodes.some((n) => n.id === t._id));

  const addNode = (task) => {
    const node = {
      id: task._id,
      type: 'taskNode',
      position: { x: 0, y: nodes.length * 160 },
      data: {
        label: task.title,
        status: task.status,
        progress: task.subtasks?.length ? Math.round((task.subtasks.filter((s) => s.isCompleted).length / task.subtasks.length) * 100) : task.status === 'Completed' ? 100 : 0,
        category: task.category,
        dueDate: task.scheduledDate,
        group: task.groupId ? { name: task.groupId.name, color: task.groupId.color } : null,
      },
    };
    persist([...nodes, node], edges);
    setSelectedId(node.id);
  };

  const changeStatus = async (status) => {
    const prev = selected.data.status;
    dispatch(updateNodeData({ id: selected.id, data: { status, progress: status === 'Completed' ? 100 : selected.data.progress } }));
    const r = await dispatch(setTaskStatus({ id: selected.id, status, previous: prev }));
    if (r.error) {
      dispatch(updateNodeData({ id: selected.id, data: { status: prev } }));
      show(r.payload);
    }
  };

  if (!roadmap) {
    return (
      <Screen background={colors.surface}>
        <BackHeader title="Roadmap" onBack={() => navigation.goBack()} backLabel="Back to roadmaps" bordered />
        <View style={{ padding: 20 }}>
          {error ? <EmptyState title="Couldn't open this roadmap" body={error} action="Go back" onAction={() => navigation.goBack()} /> : <ActivityIndicator color={colors.accent} />}
        </View>
      </Screen>
    );
  }

  const prereqs = selected ? edges.filter((e) => e.target === selected.id) : [];
  const followers = selected ? edges.filter((e) => e.source === selected.id) : [];

  return (
    <Screen background={colors.surface} edges={['top']}>
      <BackHeader
        title={roadmap.skillName}
        subtitle={`${saving ? 'Saving…' : 'Saved'} · ${nodes.length} task${nodes.length === 1 ? '' : 's'} · ${edges.length} link${edges.length === 1 ? '' : 's'}`}
        onBack={() => navigation.goBack()}
        backLabel="Back to roadmaps"
        bordered
      >
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton icon={Ellipsis} label="Roadmap options" onPress={() => setOptionsOpen(true)} />
          <IconButton icon={Plus} label="Add task" variant="accent" onPress={() => setAdding(true)} />
        </View>
      </BackHeader>

      {linkFrom && (
        <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingLeft: 16, paddingRight: 8, backgroundColor: colors.accentSoft }}>
          <AppText variant="meta" color={colors.onAccentSoft} style={{ flex: 1 }}>Tap the task that comes after {titleOf(linkFrom)}</AppText>
          <Button label="Cancel" variant="ghost" height={40} onPress={() => setLinkFrom(null)} />
        </View>
      )}

      <View style={{ flex: 1 }}>
        <DotGrid />
        <ScrollView contentContainerStyle={{ alignItems: 'center', paddingTop: 48, paddingBottom: 32, paddingHorizontal: 20 }}>
          {ordered.length === 0 && (
            <EmptyState style={{ alignSelf: 'stretch' }} title="No tasks on this roadmap" body="Add the tasks that make up this skill, then link them in the order you'll learn them." action="Add task" onAction={() => setAdding(true)} />
          )}
          {ordered.map((node, i) => {
            const isSel = selected?.id === node.id;
            const next = ordered[i + 1];
            const linkedToNext = next && edges.some((e) => e.source === node.id && e.target === next.id);
            const otherPrereqs = edges.filter((e) => e.target === node.id && e.source !== ordered[i - 1]?.id);
            const st = colors.status[node.data?.status] || colors.status['Not Started'];
            return (
              <React.Fragment key={node.id}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSel }}
                  accessibilityLabel={`${node.data?.label}, ${st.label}${linkFrom ? '. Tap to link' : ''}`}
                  onPress={() => onNodePress(node)}
                  style={{
                    width: NODE_WIDTH, padding: 16, gap: 8, backgroundColor: colors.surface, borderRadius: radius.xl,
                    borderWidth: isSel ? 2 : 1, borderColor: isSel ? colors.accent : colors.borderStrong,
                    shadowColor: colors.accentSoft, shadowOpacity: isSel ? 1 : 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 },
                  }}
                >
                  <AppText variant="tiny" tone="muted" numberOfLines={1}>{node.data?.group?.name || 'Uncategorized'} · {node.data?.category || 'General'}</AppText>
                  <AppText variant="h4">{node.data?.label}</AppText>
                  <StatusPill status={node.data?.status} />
                  {otherPrereqs.length > 0 && (
                    <AppText variant="caption" tone="muted">After {otherPrereqs.map((e) => titleOf(e.source)).join(', ')}</AppText>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Link ${node.data?.label} to the task that comes after it`}
                    onPress={() => setLinkFrom(linkFrom === node.id ? null : node.id)}
                    hitSlop={16}
                    style={{ position: 'absolute', left: NODE_WIDTH / 2 - 8, bottom: -9, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.surface, backgroundColor: linkFrom === node.id || isSel ? colors.accent : colors.textFaint }}
                  />
                </Pressable>
                {next && <Connector linked={linkedToNext} hint={i === 0 && !linkFrom && edges.length === 0 ? 'Tap a dot to link' : null} />}
              </React.Fragment>
            );
          })}
        </ScrollView>
      </View>

      {selected && (
        <View
          accessibilityLabel="Selected task"
          style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingTop: 10, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 16) + 12, gap: 14, shadowColor: colors.shadow, shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: -8 }, elevation: 12 }}
        >
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong }} />
          <View style={{ gap: 2 }}>
            <AppText variant="h2" accessibilityRole="header">{selected.data?.label}</AppText>
            <AppText variant="meta" tone="muted">
              {TASK_STATUS_LABELS[selected.data?.status] || 'Not started'} · {selected.data?.progress || 0}%
              {selected.data?.dueDate ? ' · Due ' : ''}
              {selected.data?.dueDate ? (
                <AppText variant="meta" color={isOverdue(selected.data.dueDate, selected.data.status === 'Completed') ? colors.dangerText : colors.textMuted}>
                  {longDate(selected.data.dueDate)}
                </AppText>
              ) : null}
            </AppText>
          </View>
          {(prereqs.length > 0 || followers.length > 0) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {[...prereqs.map((e) => ({ e, text: `After ${titleOf(e.source)}` })), ...followers.map((e) => ({ e, text: `Before ${titleOf(e.target)}` }))].map(({ e, text }) => (
                <Pressable
                  key={e.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove link: ${text}`}
                  onPress={() => persist(nodes, edges.filter((x) => x.id !== e.id))}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border }}
                >
                  <AppText variant="caption" tone="secondary" numberOfLines={1} style={{ maxWidth: 220 }}>{text}</AppText>
                  <X size={12} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button
              label="Start session"
              icon={Play}
              style={{ flex: 1 }}
              disabled={selected.data?.status === 'Completed'}
              onPress={() => startFocusOn({ taskType: 'task', taskId: selected.id, projectId: null, title: selected.data?.label })}
            />
            <Button label="Change status" variant="secondary" style={{ flex: 1 }} onPress={() => setStatusOpen(true)} />
          </View>
          <Button label="Open in Tasks" icon={ExternalLink} variant="ghost" height={40} onPress={() => navigation.navigate('TaskDetails', { taskId: selected.id })} />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              persist(nodes.filter((n) => n.id !== selected.id), edges.filter((e) => e.source !== selected.id && e.target !== selected.id));
              setSelectedId(null);
            }}
            style={{ alignSelf: 'center', minHeight: 32, justifyContent: 'center' }}
          >
            <AppText variant="metaStrong" color={colors.dangerStrong}>Remove from roadmap</AppText>
          </Pressable>
        </View>
      )}

      <OptionSheet
        visible={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        title={roadmap.skillName}
        options={[
          { label: 'Rename', icon: Pencil, onPress: () => setRenaming(true) },
          {
            label: 'Delete roadmap',
            icon: Trash2,
            danger: true,
            onPress: () => Alert.alert('Delete roadmap?', `${roadmap.skillName} will be deleted. Its tasks stay in your task list.`, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  const r = await dispatch(deleteRoadmap(roadmapId));
                  if (r.error) return show(r.payload);
                  show('Roadmap deleted');
                  navigation.goBack();
                },
              },
            ]),
          },
        ]}
      />
      <PromptSheet
        visible={renaming}
        onClose={() => setRenaming(false)}
        title="Rename roadmap"
        label="Skill name"
        initialValue={roadmap.skillName}
        maxLength={120}
        onSubmit={async (skillName) => {
          const r = await dispatch(saveRoadmap({ id: roadmapId, skillName }));
          if (r.error) throw r.payload;
        }}
      />
      <OptionSheet
        visible={statusOpen}
        onClose={() => setStatusOpen(false)}
        title="Change status"
        subtitle={selected?.data?.label}
        options={TASK_STATUSES.map((s) => ({ label: TASK_STATUS_LABELS[s], selected: selected?.data?.status === s, onPress: () => changeStatus(s) }))}
      />
      <OptionSheet
        visible={adding}
        onClose={() => setAdding(false)}
        title="Add a task"
        subtitle={available.length ? 'Pick one of your tasks to add to this roadmap' : 'All of your tasks are already on this roadmap. Create a new task on the Tasks tab.'}
        options={available.map((t) => ({ label: t.title, hint: `${t.groupName} · ${TASK_STATUS_LABELS[t.status]}`, dot: t.groupId?.color || colors.textMuted, onPress: () => addNode(t) }))}
      />
    </Screen>
  );
}
