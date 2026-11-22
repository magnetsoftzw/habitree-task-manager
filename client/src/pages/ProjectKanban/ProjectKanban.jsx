import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { DragDropContext } from '@hello-pangea/dnd';
import { ChevronRight, Columns3, ListChecks, Plus, Search, Settings2 } from 'lucide-react';
import KanbanColumn from '../../components/project/KanbanColumn/KanbanColumn';
import TaskList from '../../components/project/TaskList/TaskList';
import MoveCardModal from '../../components/modals/Project/MoveCardModal';
import ProjectSettingsModal from '../../components/modals/Project/ProjectSettingsModal';
import FilterPopover from '../../components/ui/FilterPopover';
import EmptyState from '../../components/ui/EmptyState';
import TopScrollbar from '../../components/ui/TopScrollbar';
import useProjectRoom from '../../hooks/UseProjectRoom';
import {
    addTaskToColumn, deleteSelectedTasks, fetchSingleProject, moveSelectedTasks, moveTaskBetweenColumns,
} from '../../store/slices/projectSlice';
import { fetchProjectTasks, fetchTaskGroups, selectProjectTasks } from '../../store/slices/projectTasksSlice';
import { CARD_TAGS, COLUMN_KEYS, WORKFLOW_KEYS, cardTag, countCards } from '../../utils/Board';
import { colorFor } from '../../utils/Colors';
import './ProjectKanban.css';

const EMPTY = [];
const VIEW_KEY = (id) => `habitree:projectView:${id}`;
const VIEWS = ['board', 'list'];
const TASK_STATUSES = [
    { value: 'not_started', label: 'Not started' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'done', label: 'Done' },
];

const readSavedView = (id) => {
    try {
        const v = localStorage.getItem(VIEW_KEY(id));
        return VIEWS.includes(v) ? v : 'board';
    } catch {
        return 'board';
    }
};

const initialsOf = (name = '') =>
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

const ProjectKanban = () => {
    const { id } = useParams();
    const dispatch = useDispatch();
    const [params, setParams] = useSearchParams();
    const { currentProject: project, loading, error } = useSelector((s) => s.projects);
    const profile = useSelector((s) => s.user.profile);
    const listState = useSelector((s) => selectProjectTasks(s, id));
    const tabRefs = useRef([]);
    const boardScrollRef = useRef(null);

    const paramView = params.get('view');
    const view = VIEWS.includes(paramView) ? paramView : readSavedView(id);
    const isBoard = view === 'board';

    const [query, setQuery] = useState('');
    const [workflowOnly, setWorkflowOnly] = useState(false);
    const [onlyOpen, setOnlyOpen] = useState(false);
    const [tagFilter, setTagFilter] = useState(() => new Set());
    const [statusFilter, setStatusFilter] = useState(() => new Set());
    const [selected, setSelected] = useState(() => new Set());
    const [moveTarget, setMoveTarget] = useState(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [addingTask, setAddingTask] = useState(false);

    useProjectRoom(id);

    useEffect(() => {
        dispatch(fetchSingleProject(id));
        dispatch(fetchProjectTasks(id));
        dispatch(fetchTaskGroups(id));
    }, [dispatch, id]);

    useEffect(() => {
        try {
            localStorage.setItem(VIEW_KEY(id), view);
        } catch {
            /* storage unavailable */
        }
    }, [id, view]);

    const switchView = useCallback((next) => {
        const p = new URLSearchParams(params);
        p.set('view', next);
        setParams(p, { replace: true });
        setQuery('');
    }, [params, setParams]);

    const onTabKey = (e, index) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + VIEWS.length) % VIEWS.length;
        switchView(VIEWS[next]);
        tabRefs.current[next]?.focus();
    };

    const tasks = useMemo(() => listState?.tasks || [], [listState]);
    const openTaskCount = tasks.filter((t) => t.status !== 'done' && !t._pendingDelete).length;
    const ready = project && project._id === id;
    const cardCount = ready ? countCards(project.kanban) : (project?.boardCardCount ?? 0);

    const columns = useMemo(() => {
        if (!ready) return [];
        const q = query.trim().toLowerCase();
        return (workflowOnly ? WORKFLOW_KEYS : COLUMN_KEYS).map((key) => {
            const all = project.kanban?.[key] || [];
            const cards = all.filter((c) => (!q || (c.title || '').toLowerCase().includes(q))
                && (!tagFilter.size || tagFilter.has(cardTag(c, key))));
            return { key, cards, total: all.length };
        });
    }, [ready, project, query, workflowOnly, tagFilter]);

    const toggleSelect = useCallback((taskId) => setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(taskId)) next.delete(taskId);
        else next.add(taskId);
        return next;
    }), []);

    const columnOf = (taskId) => COLUMN_KEYS.find((k) => project.kanban?.[k]?.some((c) => c._id === taskId));

    const onDragEnd = ({ source, destination, draggableId }) => {
        if (!destination || destination.droppableId === source.droppableId) return;
        dispatch(moveTaskBetweenColumns({
            projectId: id, taskId: draggableId, fromColumn: source.droppableId, toColumn: destination.droppableId,
        })).unwrap().catch(() => toast.error('Could not move that card'));
    };

    const doMove = async (toColumn) => {
        const target = moveTarget;
        setMoveTarget(null);
        if (target.bulk) {
            const list = [...selected].map((taskId) => ({ taskId, fromColumn: columnOf(taskId) })).filter((t) => t.fromColumn);
            try {
                await dispatch(moveSelectedTasks({ projectId: id, tasks: list, toColumn })).unwrap();
                setSelected(new Set());
            } catch {
                toast.error('Could not move those cards');
            }
            return;
        }
        dispatch(moveTaskBetweenColumns({ projectId: id, taskId: target.card._id, fromColumn: target.from, toColumn }))
            .unwrap()
            .catch(() => toast.error('Could not move that card'));
    };

    const bulkDelete = async () => {
        if (!window.confirm(`Delete ${selected.size} selected ${selected.size === 1 ? 'card' : 'cards'}? This can't be undone.`)) return;
        try {
            await dispatch(deleteSelectedTasks({ taskIds: [...selected] })).unwrap();
            setSelected(new Set());
        } catch {
            toast.error('Could not delete those cards');
        }
    };

    const primaryAction = () => {
        if (isBoard) {
            dispatch(addTaskToColumn({ projectId: id, columnId: 'todo' }))
                .unwrap()
                .then(() => toast.success('Card added to Todo'))
                .catch(() => toast.error('Could not add a card'));
        } else {
            setAddingTask(true);
        }
    };

    if (!ready) {
        if (error && !loading) {
            return (
                <div className="page">
                    <div className="page-inner">
                        <EmptyState
                            icon={<Columns3 size={20} />}
                            title="Couldn't open this project"
                            help="It may have been deleted, or you no longer have access."
                            action={<Link to="/projects" className="btn">Back to projects</Link>}
                        />
                    </div>
                </div>
            );
        }
        return (
            <div className="page">
                <div className="page-inner project-page" aria-busy="true">
                    <div className="skeleton" style={{ height: 18, width: 220 }} />
                    <div className="skeleton" style={{ height: 64, width: '60%' }} />
                    <div className="skeleton" style={{ height: 360 }} />
                </div>
            </div>
        );
    }

    const color = colorFor(project);
    const ownerId = project.owner?._id || project.owner;
    const tabs = [
        { value: 'board', label: 'Board', icon: Columns3, count: cardCount },
        { value: 'list', label: 'Task list', icon: ListChecks, count: openTaskCount },
    ];

    return (
        <div className="page">
            <div className="project-page">
                <nav aria-label="Breadcrumb" className="project-crumbs">
                    <Link to="/projects">Projects</Link>
                    <ChevronRight size={14} aria-hidden="true" />
                    <span aria-current="page">{project.name}</span>
                </nav>

                <header className="project-header">
                    <span className="project-badge" style={{ background: color }} aria-hidden="true">{initialsOf(project.name)}</span>
                    <div className="project-heading">
                        <h1 className="project-title">{project.name}</h1>
                        {project.description && <p className="project-desc">{project.description}</p>}
                    </div>
                    <div className="project-actions">
                        <button type="button" className="btn" onClick={() => setSettingsOpen(true)}>
                            <Settings2 size={16} aria-hidden="true" /> Project settings
                        </button>
                        <button type="button" className="btn btn-primary" onClick={primaryAction}>
                            <Plus size={16} strokeWidth={2.4} aria-hidden="true" /> {isBoard ? 'Add card' : 'Add task'}
                        </button>
                    </div>
                </header>

                <div className="project-tabs-row">
                    <div role="tablist" aria-label="Project view" className="project-tabs">
                        {tabs.map((t, i) => {
                            const on = view === t.value;
                            const Icon = t.icon;
                            return (
                                <button
                                    key={t.value}
                                    ref={(el) => { tabRefs.current[i] = el; }}
                                    type="button"
                                    role="tab"
                                    id={`tab-${t.value}`}
                                    aria-selected={on}
                                    aria-controls={`panel-${t.value}`}
                                    tabIndex={on ? 0 : -1}
                                    className={`project-tab ${on ? 'is-on' : ''}`}
                                    onClick={() => switchView(t.value)}
                                    onKeyDown={(e) => onTabKey(e, i)}
                                >
                                    <Icon size={16} aria-hidden="true" />
                                    {t.label}
                                    <span className="project-tab-count tabular">{t.count}</span>
                                </button>
                            );
                        })}
                    </div>
                    <span className="project-tabs-note">Board cards and list tasks are kept separate — both belong to this project.</span>
                </div>

                <div className="project-toolbar">
                    <label className="search-field project-search">
                        <Search size={16} aria-hidden="true" />
                        <span className="sr-only">{isBoard ? 'Search cards' : 'Search tasks'}</span>
                        <input
                            type="search"
                            placeholder={isBoard ? 'Search cards' : 'Search tasks'}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </label>
                    {isBoard ? (
                        <FilterPopover
                            title="Show cards tagged"
                            options={CARD_TAGS.map((t) => ({ value: t, label: t }))}
                            selected={tagFilter}
                            onChange={setTagFilter}
                        />
                    ) : (
                        <FilterPopover title="Show tasks that are" options={TASK_STATUSES} selected={statusFilter} onChange={setStatusFilter} />
                    )}
                    <span className="project-toolbar-spacer" />
                    {isBoard ? (
                        <div role="group" aria-label="Show columns" className="segmented">
                            <button type="button" aria-pressed={!workflowOnly} className="segmented-option" onClick={() => setWorkflowOnly(false)}>All columns</button>
                            <button type="button" aria-pressed={workflowOnly} className="segmented-option" onClick={() => setWorkflowOnly(true)}>Workflow only</button>
                        </div>
                    ) : (
                        <div role="group" aria-label="Show tasks" className="segmented">
                            <button type="button" aria-pressed={onlyOpen} className="segmented-option" onClick={() => setOnlyOpen(true)}>Open</button>
                            <button type="button" aria-pressed={!onlyOpen} className="segmented-option" onClick={() => setOnlyOpen(false)}>All</button>
                        </div>
                    )}
                </div>

                {isBoard && selected.size > 0 && (
                    <div className="project-selection" role="status">
                        <span>{selected.size} {selected.size === 1 ? 'card' : 'cards'} selected</span>
                        <button type="button" className="btn btn-sm" onClick={() => setMoveTarget({ bulk: true })}>Move…</button>
                        <button type="button" className="btn btn-sm btn-danger" onClick={bulkDelete}>Delete</button>
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set())}>Clear</button>
                    </div>
                )}

                {isBoard ? (
                    <div role="tabpanel" id="panel-board" aria-labelledby="tab-board">
                        <DragDropContext onDragEnd={onDragEnd}>
                            <TopScrollbar targetRef={boardScrollRef} className="kanban-top-scroll" />
                            <div className="kanban-scroll" ref={boardScrollRef}>
                                <div className="kanban-track">
                                    {columns.map((c) => (
                                        <KanbanColumn
                                            key={c.key}
                                            projectId={id}
                                            columnKey={c.key}
                                            cards={c.cards}
                                            totalCount={c.total}
                                            selectedTasks={selected}
                                            onToggleSelect={toggleSelect}
                                            onMoveCard={(card, from) => setMoveTarget({ card, from })}
                                            onBulkMove={() => setMoveTarget({ bulk: true })}
                                            onBulkDelete={bulkDelete}
                                        />
                                    ))}
                                </div>
                            </div>
                        </DragDropContext>
                    </div>
                ) : (
                    <div role="tabpanel" id="panel-list" aria-labelledby="tab-list">
                        {!listState?.loaded && listState?.loading ? (
                            <div className="skeleton" style={{ height: 280, borderRadius: 16 }} />
                        ) : listState?.error && !listState?.loaded ? (
                            <EmptyState
                                icon={<ListChecks size={20} />}
                                title="Couldn't load the task list"
                                help={listState.error}
                                action={<button type="button" className="btn" onClick={() => dispatch(fetchProjectTasks(id))}>Try again</button>}
                            />
                        ) : (
                            <TaskList
                                key={onlyOpen ? 'open' : 'all'}
                                projectId={id}
                                tasks={tasks}
                                groups={listState?.groups || EMPTY}
                                query={query}
                                onlyOpen={onlyOpen}
                                statusFilter={statusFilter}
                                adding={addingTask}
                                onAddingChange={setAddingTask}
                            />
                        )}
                    </div>
                )}
            </div>

            <MoveCardModal
                isOpen={Boolean(moveTarget)}
                title={moveTarget?.bulk ? `${selected.size} selected ${selected.size === 1 ? 'card' : 'cards'}` : moveTarget?.card?.title}
                fromColumn={moveTarget?.bulk ? null : moveTarget?.from}
                onMove={doMove}
                onClose={() => setMoveTarget(null)}
            />
            <ProjectSettingsModal
                isOpen={settingsOpen}
                project={project}
                canDelete={String(ownerId) === String(profile?._id)}
                onClose={() => setSettingsOpen(false)}
            />
        </div>
    );
};

export default ProjectKanban;
