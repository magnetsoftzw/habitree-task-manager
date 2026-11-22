import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { ArrowRight, CalendarPlus, Clock, Ellipsis, Pencil, Play, Trash2 } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/Tokens';
import AppText from '../ui/AppText';
import { Chip, IconButton } from '../ui/Controls';
import { Fab, PromptSheet, ScrollBody } from '../ui/Layout';
import { OptionSheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import PlanSheet from '../plan/PlanSheet';
import { useStartFocus } from '../focus/FocusActions';
import { addCard, deleteCard, moveCard, renameCard } from '../../store/slices/ProjectsSlice';
import { refForTask } from '../../store/TaskThunks';
import { formatMinutes } from '../../utils/Format';
import { KANBAN_COLUMNS } from '../../utils/Status';

const TAGS = ['Backend', 'Frontend', 'Mobile', 'Design'];
const TRACK_BY_COLUMN = { backendBacklog: 'Backend', frontendBacklog: 'Frontend', mobileBacklog: 'Mobile', design: 'Design' };
const cardTag = (card, column) => card.track || TRACK_BY_COLUMN[column] || null;

const pickInitialColumn = (kanban) => {
  if (kanban.doing?.length) return 'doing';
  return KANBAN_COLUMNS.find((c) => kanban[c.id]?.length)?.id || 'todo';
};

export default function BoardView({ project }) {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const { show } = useToast();
  const startFocusOn = useStartFocus();
  const [column, setColumn] = useState(() => pickInitialColumn(project.kanban));
  const [adding, setAdding] = useState(false);
  const [moving, setMoving] = useState(null);
  const [menuCard, setMenuCard] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [planning, setPlanning] = useState(null);
  const [tag, setTag] = useState(null);
  const [columnMenu, setColumnMenu] = useState(false);

  useEffect(() => { setColumn(pickInitialColumn(project.kanban)); }, [project._id]);

  const colName = KANBAN_COLUMNS.find((c) => c.id === column)?.name;
  const columnCards = project.kanban[column] || [];
  const cards = tag ? columnCards.filter((c) => cardTag(c, column) === tag) : columnCards;
  const tagged = KANBAN_COLUMNS.some((c) => (project.kanban[c.id] || []).some((card) => cardTag(card, c.id)));

  const clearColumn = () => Alert.alert(`Delete all ${columnCards.length} cards in ${colName}?`, "This can't be undone.", [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete all',
      style: 'destructive',
      onPress: async () => {
        const results = await Promise.all(columnCards.map((c) => dispatch(deleteCard({ taskId: c._id, columnId: column }))));
        const failed = results.filter((r) => r.error).length;
        show(failed ? `${failed} card${failed === 1 ? '' : 's'} couldn't be deleted` : `Cleared ${colName}`);
      },
    },
  ]);

  const move = async (card, toColumn) => {
    const r = await dispatch(moveCard({ projectId: project._id, taskId: card._id, fromColumn: column, toColumn }));
    if (r.error) show(r.payload);
    else show(`Moved to ${KANBAN_COLUMNS.find((c) => c.id === toColumn).name}`);
  };

  const remove = (card) => Alert.alert('Delete card?', `"${card.title}" will be removed from the board.`, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete',
      style: 'destructive',
      onPress: async () => {
        const r = await dispatch(deleteCard({ taskId: card._id, columnId: column }));
        show(r.error ? r.payload : 'Card deleted');
      },
    },
  ]);

  return (
    <View style={{ flex: 1 }}>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" accessibilityLabel="Columns" contentContainerStyle={{ gap: 6, paddingHorizontal: 20, paddingBottom: 12 }}>
          {KANBAN_COLUMNS.map((c) => (
            <Chip
              key={c.id}
              accessibilityRole="tab"
              label={c.name}
              dot={colors.kanbanDots[c.id]}
              count={project.kanban[c.id]?.length || 0}
              selected={c.id === column}
              onPress={() => setColumn(c.id)}
            />
          ))}
        </ScrollView>
      </View>

      {tagged && (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Show cards tagged" contentContainerStyle={{ gap: 6, paddingHorizontal: 20, paddingBottom: 10 }}>
            <Chip label="All tags" selected={!tag} onPress={() => setTag(null)} />
            {TAGS.map((t) => <Chip key={t} label={t} dot={colors.tags[t]?.fg} selected={tag === t} onPress={() => setTag(tag === t ? null : t)} />)}
          </ScrollView>
        </View>
      )}

      <ScrollBody bottomPad={100}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: -6 }}>
          <AppText variant="meta" tone="muted">
            {tag ? `${cards.length} of ${columnCards.length} cards · ${tag}` : `${columnCards.length} card${columnCards.length === 1 ? '' : 's'} in ${colName}`}
          </AppText>
          <IconButton icon={Ellipsis} label={`${colName} column options`} variant="ghost" iconSize={18} onPress={() => setColumnMenu(true)} />
        </View>
        {cards.map((card) => {
          const tag = card.track && colors.tags[card.track];
          return (
            <Pressable
              key={card._id}
              accessibilityRole="button"
              accessibilityLabel={`${card.title}. Card options`}
              onPress={() => setMenuCard(card)}
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, padding: 16, gap: 10 }}
            >
              {tag && (
                <View style={{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: tag.bg }}>
                  <AppText variant="tinyStrong" color={tag.fg}>{card.track}</AppText>
                </View>
              )}
              <AppText variant="titleLarge" style={{ lineHeight: 22 }}>{card.title}</AppText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Clock size={14} color={colors.textMuted} />
                <AppText variant="caption" tone="muted" accessibilityLabel={`${formatMinutes(card.focusMinutes)} focused`}>{formatMinutes(card.focusMinutes)}</AppText>
                <View style={{ flex: 1 }} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Move ${card.title}`}
                  onPress={() => setMoving(card)}
                  style={{ height: 36, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <AppText variant="metaStrong">Move</AppText>
                  <ArrowRight size={14} color={colors.text} />
                </Pressable>
              </View>
            </Pressable>
          );
        })}
        {cards.length === 0 && (
          <View style={{ paddingVertical: 32, paddingHorizontal: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderStrong, borderRadius: radius.card, alignItems: 'center', gap: 4 }}>
            <AppText variant="title">{tag && columnCards.length ? `No ${tag} cards in ${colName}` : `No cards in ${colName}`}</AppText>
            <AppText variant="meta" tone="muted">{tag && columnCards.length ? 'Clear the tag filter to see every card.' : 'Tap + to add one, or move a card here.'}</AppText>
          </View>
        )}
      </ScrollBody>

      <Fab label={`Add card to ${colName}`} onPress={() => setAdding(true)} />

      <PromptSheet
        visible={adding}
        onClose={() => setAdding(false)}
        title={`Add card to ${colName}`}
        label="Card title"
        placeholder="e.g. Offline-first sync queue"
        submitLabel="Add card"
        onSubmit={async (title) => {
          const r = await dispatch(addCard({ projectId: project._id, columnId: column, title }));
          if (r.error) throw r.payload;
        }}
      />
      <PromptSheet
        visible={!!renaming}
        onClose={() => setRenaming(null)}
        title="Rename card"
        label="Card title"
        initialValue={renaming?.title || ''}
        onSubmit={async (title) => {
          const r = await dispatch(renameCard({ taskId: renaming._id, title }));
          if (r.error) throw r.payload;
        }}
      />
      <OptionSheet
        visible={columnMenu}
        onClose={() => setColumnMenu(false)}
        title={colName}
        subtitle={`${columnCards.length} card${columnCards.length === 1 ? '' : 's'}`}
        options={[
          { label: 'Add card', icon: Pencil, onPress: () => setAdding(true) },
          { label: 'Delete all cards', icon: Trash2, danger: true, disabled: !columnCards.length, onPress: clearColumn },
        ]}
      />
      <OptionSheet
        visible={!!moving}
        onClose={() => setMoving(null)}
        title="Move card to"
        subtitle={moving?.title}
        options={KANBAN_COLUMNS.filter((c) => c.id !== column).map((c) => ({ label: c.name, dot: colors.kanbanDots[c.id], onPress: () => move(moving, c.id) }))}
      />
      <OptionSheet
        visible={!!menuCard}
        onClose={() => setMenuCard(null)}
        title={menuCard?.title}
        subtitle={`${colName} · ${formatMinutes(menuCard?.focusMinutes)} focused`}
        options={menuCard ? [
          { label: 'Start focus session', icon: Play, onPress: () => startFocusOn({ ...refForTask(menuCard), projectId: project._id }) },
          { label: 'Add to plan', icon: CalendarPlus, onPress: () => setPlanning({ ...refForTask(menuCard), projectId: project._id }) },
          { label: 'Move', icon: ArrowRight, onPress: () => setMoving(menuCard) },
          { label: 'Rename', icon: Pencil, onPress: () => setRenaming(menuCard) },
          { label: 'Delete card', icon: Trash2, danger: true, onPress: () => remove(menuCard) },
        ] : []}
      />
      <PlanSheet visible={!!planning} onClose={() => setPlanning(null)} preset={planning} />
    </View>
  );
}
