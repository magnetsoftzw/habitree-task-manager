import React, { useCallback, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { Info, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/Tokens';
import AppText from '../../components/ui/AppText';
import { Button, Card, DashedButton, EmptyState, IconButton, ProgressBar } from '../../components/ui/Controls';
import { PageHeader, PromptSheet, Screen, ScrollBody } from '../../components/ui/Layout';
import { OptionSheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import DotGrid from '../../components/roadmaps/DotGrid';
import { createRoadmap, deleteRoadmap, fetchRoadmaps, saveRoadmap } from '../../store/slices/RoadmapsSlice';
import { longDate } from '../../utils/Format';

const hintFor = (r) => {
  const nodes = r.nodes?.length || 0;
  const edges = r.edges?.length || 0;
  if (nodes === 0) return 'Add tasks to start mapping this skill.';
  if (nodes === 1) return 'Add another task, then link them to set their order.';
  if (edges === 0) return `Link the ${nodes === 2 ? 'two' : nodes} tasks to set their order.`;
  return null;
};

function RoadmapCard({ roadmap, onOpen, onMenu }) {
  const { colors } = useTheme();
  const nodes = roadmap.nodes || [];
  const progress = nodes.length ? Math.round(nodes.reduce((sum, n) => sum + (n.data?.progress || 0), 0) / nodes.length) : 0;
  const hint = hintFor(roadmap);

  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <Pressable accessibilityRole="link" accessibilityLabel={`Open ${roadmap.skillName}`} onPress={onOpen} onLongPress={onMenu} style={{ height: 150, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <DotGrid spacing={16} />
        {nodes.slice(0, 2).map((n, i) => (
          <View key={n.id} style={{ position: 'absolute', alignSelf: 'center', top: 22 + i * 64, width: 160, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md }}>
            <AppText variant="captionStrong" numberOfLines={1}>{n.data?.label || 'Task'}</AppText>
          </View>
        ))}
        {nodes.length === 0 && (
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
            <AppText variant="meta" tone="muted">Empty roadmap</AppText>
          </View>
        )}
      </Pressable>
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="h3" style={{ fontSize: 18 }}>{roadmap.skillName}</AppText>
            <AppText variant="caption" tone="muted">
              {nodes.length} task{nodes.length === 1 ? '' : 's'} · {roadmap.edges?.length || 0} link{roadmap.edges?.length === 1 ? '' : 's'} · Updated {longDate(roadmap.updatedAt)}
            </AppText>
          </View>
          <IconButton icon={Pencil} label={`Options for ${roadmap.skillName}`} variant="ghost" iconSize={16} onPress={onMenu} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}><ProgressBar value={progress} height={6} /></View>
          <AppText variant="metaStrong" numeric>{progress}%</AppText>
        </View>
        {hint && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: colors.bg, borderRadius: radius.md }}>
            <Info size={16} color={colors.textSecondary} />
            <AppText variant="meta" tone="secondary" style={{ flex: 1 }}>{hint}</AppText>
          </View>
        )}
        <Button label="Open roadmap" variant="secondary" onPress={onOpen} />
      </View>
    </Card>
  );
}

export default function RoadmapsScreen({ navigation }) {
  const dispatch = useDispatch();
  const { show } = useToast();
  const { items, loading, loaded, error } = useSelector((s) => s.roadmaps);
  const [creating, setCreating] = useState(false);
  const [menu, setMenu] = useState(null);
  const [renaming, setRenaming] = useState(null);

  const load = useCallback(() => { dispatch(fetchRoadmaps()); }, [dispatch]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = (r) => navigation.navigate('RoadmapEditor', { roadmapId: r._id });

  return (
    <Screen>
      <PageHeader overline="Learning paths" title="Roadmaps">
        <IconButton icon={Plus} label="New roadmap" variant="accent" onPress={() => setCreating(true)} />
      </PageHeader>
      <ScrollBody refreshing={loading && loaded} onRefresh={load}>
        {error && !loaded && <EmptyState title="Couldn't load your roadmaps" body={error} action="Try again" onAction={load} />}
        {items.map((r) => <RoadmapCard key={r._id} roadmap={r} onOpen={() => open(r)} onMenu={() => setMenu(r)} />)}
        {loaded && (
          <DashedButton label="New roadmap" sublabel="Start from a skill you want to learn" minHeight={120} onPress={() => setCreating(true)} style={{ borderRadius: radius.card }} />
        )}
      </ScrollBody>

      <PromptSheet
        visible={creating}
        onClose={() => setCreating(false)}
        title="New roadmap"
        label="Skill name"
        placeholder="e.g. Mastering MERN Stack"
        submitLabel="Create roadmap"
        maxLength={120}
        onSubmit={async (name) => {
          const r = await dispatch(createRoadmap(name));
          if (r.error) throw r.payload;
          open(r.payload);
        }}
      />
      <PromptSheet
        visible={!!renaming}
        onClose={() => setRenaming(null)}
        title="Rename roadmap"
        label="Skill name"
        initialValue={renaming?.skillName || ''}
        maxLength={120}
        onSubmit={async (skillName) => {
          const r = await dispatch(saveRoadmap({ id: renaming._id, skillName }));
          if (r.error) throw r.payload;
        }}
      />
      <OptionSheet
        visible={!!menu}
        onClose={() => setMenu(null)}
        title={menu?.skillName}
        options={menu ? [
          { label: 'Rename', icon: Pencil, onPress: () => setRenaming(menu) },
          {
            label: 'Delete roadmap',
            icon: Trash2,
            danger: true,
            onPress: () => Alert.alert('Delete roadmap?', `${menu.skillName} will be deleted. Its tasks stay in your task list.`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: async () => { const r = await dispatch(deleteRoadmap(menu._id)); show(r.error ? r.payload : 'Roadmap deleted'); } },
            ]),
          },
        ] : []}
      />
    </Screen>
  );
}
