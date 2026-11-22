import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import ReactFlow, {
    Background, MarkerType, MiniMap, ReactFlowProvider, addEdge, useEdgesState, useNodesState, useReactFlow, useViewport,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
    AlertCircle, ArrowLeft, Check, LayoutGrid, Maximize, Minus, MousePointerClick, Pencil, Play, Plus, Route, Trash2,
} from 'lucide-react';
import RoadmapNode from '../../components/roadmap/RoadmapNode';
import Menu from '../../components/ui/Menu';
import EmptyState from '../../components/ui/EmptyState';
import AddBlockModal from '../../components/modals/Planner/AddBlockModal';
import CreateRoadmap from '../../components/modals/Roadmap/CreateRoadmap';
import FocusSessionFlow from '../../components/session/FocusSessionFlow';
import {
    clearActiveRoadmap, deleteRoadmap, fetchRoadmapById, persistRoadmap, updateRoadmapMeta,
} from '../../store/slices/roadmapSlice';
import { fetchInventoryTasks, updateTaskStatus } from '../../store/slices/taskSlice';
import { roadmapProgress } from '../../utils/Roadmap';
import { formatDueDate, toDateKey } from '../../utils/Format';
import './RoadmapCanvas.css';

const nodeTypes = { taskNode: RoadmapNode };
const NODE_W = 280;
const EDGE_OPTIONS = {
    type: 'smoothstep',
    style: { strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#9AA39C' },
};
const STATUSES = ['Not Started', 'On-Going', 'On-Hold', 'Completed', 'Shelved'];
const STATUS_LABEL = { 'Not Started': 'Not started', 'On-Going': 'In progress', 'On-Hold': 'On hold', Completed: 'Done', Shelved: 'Shelved' };

const toFlowNode = (n) => ({
    id: n.id,
    type: 'taskNode',
    position: n.position || { x: 0, y: 0 },
    data: { label: n.data?.label, status: n.data?.status, progress: n.data?.progress },
});

const toFlowEdge = (e) => ({ id: e.id, source: e.source, target: e.target, ...EDGE_OPTIONS });

const layered = (nodes, edges) => {
    const depth = new Map(nodes.map((n) => [n.id, 0]));
    for (let pass = 0; pass < nodes.length; pass += 1) {
        let changed = false;
        edges.forEach((e) => {
            const next = (depth.get(e.source) ?? 0) + 1;
            if (depth.has(e.target) && next > depth.get(e.target) && next < nodes.length) {
                depth.set(e.target, next);
                changed = true;
            }
        });
        if (!changed) break;
    }
    const rows = new Map();
    nodes.forEach((n) => {
        const d = depth.get(n.id);
        rows.set(d, [...(rows.get(d) || []), n.id]);
    });
    const pos = new Map();
    rows.forEach((ids, d) => ids.forEach((id, i) => pos.set(id, { x: 96 + i * (NODE_W + 60), y: 120 + d * 220 })));
    return nodes.map((n) => ({ ...n, position: pos.get(n.id) }));
};

const SaveState = ({ state, onRetry }) => {
    if (state === 'saving') return <span className="rm-save">Saving…</span>;
    if (state === 'error') {
        return (
            <span className="rm-save is-error">
                <AlertCircle size={14} aria-hidden="true" /> Couldn't save
                <button type="button" className="rm-save-retry" onClick={onRetry}>Retry</button>
            </span>
        );
    }
    return <span className="rm-save"><Check size={14} strokeWidth={2.4} className="rm-save-ok" aria-hidden="true" /> All changes saved</span>;
};

const Editor = ({ roadmap }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const flow = useReactFlow();
    const { zoom } = useViewport();
    const inventory = useSelector((s) => s.tasks.inventory);
    const wrapRef = useRef(null);
    const saveTimer = useRef(null);

    const [nodes, setNodes, onNodesChange] = useNodesState(() => (roadmap.nodes || []).map(toFlowNode));
    const [edges, setEdges, onEdgesChange] = useEdgesState(() => (roadmap.edges || []).map(toFlowEdge));
    const [selectedId, setSelectedId] = useState(null);
    const [saveState, setSaveState] = useState('saved');
    const [revision, setRevision] = useState(0);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [renameOpen, setRenameOpen] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const [sessionTask, setSessionTask] = useState(null);

    const tasks = useMemo(() => Object.values(inventory || {}).flat(), [inventory]);
    const taskById = useMemo(() => new Map(tasks.map((t) => [t._id, t])), [tasks]);
    const tasksLoaded = tasks.length > 0;

    const touch = useCallback(() => setRevision((r) => r + 1), []);

    const save = useCallback(async (currentNodes, currentEdges) => {
        setSaveState('saving');
        try {
            await dispatch(persistRoadmap({
                id: roadmap._id,
                nodes: currentNodes.map((n) => {
                    const t = taskById.get(n.id);
                    return {
                        id: n.id,
                        type: 'taskNode',
                        position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
                        data: { label: t?.title || n.data.label, status: t?.status || n.data.status, progress: t?.progress ?? n.data.progress ?? 0 },
                    };
                }),
                edges: currentEdges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
            })).unwrap();
            setSaveState('saved');
        } catch {
            setSaveState('error');
        }
    }, [dispatch, roadmap._id, taskById]);

    const latest = useRef({ nodes, edges, save });
    useEffect(() => {
        latest.current = { nodes, edges, save };
    }, [nodes, edges, save]);

    useEffect(() => {
        if (!revision) return undefined;
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => latest.current.save(latest.current.nodes, latest.current.edges), 700);
        return () => clearTimeout(saveTimer.current);
    }, [revision]);

    const displayNodes = useMemo(() => nodes.map((n) => ({
        ...n,
        data: { ...n.data, task: taskById.get(n.id), missing: tasksLoaded && !taskById.has(n.id) },
    })), [nodes, taskById, tasksLoaded]);

    const displayEdges = useMemo(() => {
        const name = (id) => taskById.get(id)?.title || nodes.find((n) => n.id === id)?.data.label || 'task';
        return edges.map((e) => ({ ...e, ariaLabel: `${name(e.source)} leads to ${name(e.target)}` }));
    }, [edges, nodes, taskById]);

    const onNodesChangeTracked = useCallback((changes) => {
        onNodesChange(changes);
        if (changes.some((c) => (c.type === 'position' && c.dragging === false) || c.type === 'remove')) touch();
    }, [onNodesChange, touch]);

    const onEdgesChangeTracked = useCallback((changes) => {
        onEdgesChange(changes);
        if (changes.some((c) => c.type === 'remove')) touch();
    }, [onEdgesChange, touch]);

    const onConnect = useCallback((params) => {
        if (params.source === params.target) return;
        setEdges((eds) => {
            if (eds.some((e) => e.source === params.source && e.target === params.target)) return eds;
            return addEdge({ ...params, id: `e-${params.source}-${params.target}`, ...EDGE_OPTIONS }, eds);
        });
        touch();
    }, [setEdges, touch]);

    const addTask = (task) => {
        setPickerOpen(false);
        if (!task || nodes.some((n) => n.id === task._id)) return;
        const rect = wrapRef.current?.getBoundingClientRect();
        const vp = flow.getViewport();
        const position = {
            x: Math.round(((rect?.width || 800) / 2 - vp.x) / vp.zoom - NODE_W / 2 + (nodes.length % 4) * 24),
            y: Math.round(((rect?.height || 600) / 2 - vp.y) / vp.zoom - 70 + (nodes.length % 4) * 24),
        };
        setNodes((nds) => [...nds, { id: task._id, type: 'taskNode', position, data: { label: task.title, status: task.status, progress: task.progress || 0 } }]);
        setSelectedId(task._id);
        touch();
    };

    const removeNode = (id) => {
        setNodes((nds) => nds.filter((n) => n.id !== id));
        setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
        setSelectedId(null);
        touch();
    };

    const autoLayout = () => {
        setNodes((nds) => layered(nds, edges));
        touch();
        setTimeout(() => flow.fitView({ padding: 0.25, duration: 300 }), 50);
    };

    const rename = async ({ skillName }) => {
        setRenaming(true);
        try {
            await dispatch(updateRoadmapMeta({ id: roadmap._id, skillName })).unwrap();
            setRenameOpen(false);
        } catch {
            toast.error('Could not rename the roadmap');
        } finally {
            setRenaming(false);
        }
    };

    const remove = async () => {
        if (!window.confirm(`Delete "${roadmap.skillName}"? Its tasks stay on your Tasks page.`)) return;
        try {
            await dispatch(deleteRoadmap(roadmap._id)).unwrap();
            navigate('/roadmaps');
        } catch {
            toast.error('Could not delete the roadmap');
        }
    };

    const setStatus = async (task, status) => {
        try {
            await dispatch(updateTaskStatus({ id: task._id, status })).unwrap();
            dispatch(fetchInventoryTasks());
            touch();
        } catch {
            toast.error('Could not update the status');
        }
    };

    const progressNodes = nodes.map((n) => {
        const t = taskById.get(n.id);
        return { id: n.id, data: { status: t?.status || n.data.status, progress: t?.progress ?? n.data.progress } };
    });
    const progress = roadmapProgress(progressNodes);
    const selected = selectedId ? nodes.find((n) => n.id === selectedId) : null;
    const selTask = selected ? taskById.get(selected.id) : null;
    const titleOf = (id) => taskById.get(id)?.title || nodes.find((n) => n.id === id)?.data.label || 'Untitled task';
    const before = selected ? edges.filter((e) => e.target === selected.id).map((e) => titleOf(e.source)) : [];
    const after = selected ? edges.filter((e) => e.source === selected.id).map((e) => titleOf(e.target)) : [];
    const overdue = selTask?.scheduledDate && selTask.status !== 'Completed' && toDateKey(new Date(selTask.scheduledDate)) < toDateKey();
    const available = tasks.filter((t) => !nodes.some((n) => n.id === t._id));

    return (
        <div className="rm-editor">
            <header className="rm-toolbar">
                <Link to="/roadmaps" className="rm-back" aria-label="Back to roadmaps">
                    <ArrowLeft size={16} />
                </Link>
                <div className="rm-toolbar-title">
                    <h1>{roadmap.skillName}</h1>
                    <span>
                        {nodes.length} {nodes.length === 1 ? 'task' : 'tasks'} · {edges.length} {edges.length === 1 ? 'link' : 'links'} · {progress}% complete
                    </span>
                </div>
                <SaveState state={saveState} onRetry={() => save(nodes, edges)} />
                <button type="button" className="btn rm-tool-btn" onClick={autoLayout} disabled={nodes.length < 2}>
                    <LayoutGrid size={16} aria-hidden="true" /> Auto-layout
                </button>
                <button type="button" className="btn btn-primary rm-tool-btn" onClick={() => setPickerOpen(true)}>
                    <Plus size={16} strokeWidth={2.4} aria-hidden="true" /> Add task
                </button>
                <Menu
                    label="Roadmap options"
                    items={[
                        { label: 'Rename', icon: <Pencil size={16} />, onSelect: () => setRenameOpen(true) },
                        { label: 'Delete roadmap', icon: <Trash2 size={16} />, danger: true, onSelect: remove },
                    ]}
                />
            </header>

            <div className="rm-body">
                <div className="rm-canvas" ref={wrapRef}>
                    <ReactFlow
                        nodes={displayNodes}
                        edges={displayEdges}
                        nodeTypes={nodeTypes}
                        onNodesChange={onNodesChangeTracked}
                        onEdgesChange={onEdgesChangeTracked}
                        onConnect={onConnect}
                        onNodeClick={(_, n) => setSelectedId(n.id)}
                        onPaneClick={() => setSelectedId(null)}
                        defaultEdgeOptions={EDGE_OPTIONS}
                        deleteKeyCode={['Delete', 'Backspace']}
                        fitView
                        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
                        zoomOnScroll={false}
                        zoomActivationKeyCode="Control"
                        preventScrolling={false}
                        minZoom={0.3}
                        maxZoom={1.75}
                        proOptions={{ hideAttribution: true }}
                    >
                        <Background gap={22} size={1.2} />
                        <MiniMap
                            className="rm-minimap"
                            pannable
                            zoomable
                            nodeBorderRadius={4}
                            nodeClassName={(n) => (taskById.get(n.id)?.status === 'Completed' ? 'rm-mini-done' : 'rm-mini-node')}
                        />
                    </ReactFlow>

                    {nodes.length === 0 && (
                        <div className="rm-canvas-empty">
                            <EmptyState
                                stacked
                                icon={<Route size={20} />}
                                title="This roadmap has no steps yet"
                                help="Add tasks from your list, then drag from a dot to link one task to the next."
                                action={<button type="button" className="btn btn-primary" onClick={() => setPickerOpen(true)}><Plus size={16} /> Add task</button>}
                            />
                        </div>
                    )}

                    {nodes.length >= 2 && edges.length === 0 && (
                        <div className="rm-connect-hint" role="note">
                            <MousePointerClick size={16} aria-hidden="true" />
                            Drag from a dot to link one task to the next
                        </div>
                    )}

                    <div role="group" aria-label="Zoom" className="rm-zoom">
                        <button type="button" aria-label="Zoom out" onClick={() => flow.zoomOut({ duration: 150 })}><Minus size={16} /></button>
                        <span className="tabular" aria-live="polite">{Math.round(zoom * 100)}%</span>
                        <button type="button" aria-label="Zoom in" onClick={() => flow.zoomIn({ duration: 150 })}><Plus size={16} /></button>
                        <span className="rm-zoom-sep" aria-hidden="true" />
                        <button type="button" aria-label="Fit to screen" onClick={() => flow.fitView({ padding: 0.3, duration: 250 })}><Maximize size={16} /></button>
                    </div>
                </div>

                <aside className="rm-inspector" aria-label="Selected task">
                    {selected ? (
                        <>
                            <div className="rm-insp-head">
                                <span className="rm-insp-overline">Selected task</span>
                                <h2>{selTask?.title || selected.data.label || 'Untitled task'}</h2>
                                <span className="rm-insp-meta">
                                    {selTask
                                        ? [selTask.groupId?.name || 'Uncategorized', selTask.category].filter(Boolean).join(' · ')
                                        : 'This task no longer exists'}
                                </span>
                            </div>
                            {selTask && (
                                <label className="field">
                                    <span className="field-label">Status</span>
                                    <select className="input" value={selTask.status} onChange={(e) => setStatus(selTask, e.target.value)}>
                                        {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                                    </select>
                                </label>
                            )}
                            <dl className="rm-insp-facts">
                                <div><dt>Progress</dt><dd className="tabular">{Math.round(selTask?.progress ?? selected.data.progress ?? 0)}%</dd></div>
                                <div>
                                    <dt>Due</dt>
                                    <dd className={overdue ? 'is-overdue' : ''}>{selTask?.scheduledDate ? formatDueDate(selTask.scheduledDate) : '—'}</dd>
                                </div>
                                <div><dt>Comes after</dt><dd>{before.length ? before.join(', ') : '—'}</dd></div>
                                <div><dt>Leads to</dt><dd>{after.length ? after.join(', ') : '—'}</dd></div>
                            </dl>
                            <div className="rm-insp-actions">
                                {selTask && (
                                    <>
                                        <button type="button" className="btn btn-primary" onClick={() => setSessionTask(selTask)}>
                                            <Play size={12} fill="currentColor" aria-hidden="true" /> Start a session
                                        </button>
                                        <Link to={`/tasks/${selTask._id}`} className="btn">Open in Tasks</Link>
                                    </>
                                )}
                                <button type="button" className="btn btn-ghost rm-remove" onClick={() => removeNode(selected.id)}>Remove from roadmap</button>
                            </div>
                        </>
                    ) : (
                        <div className="rm-insp-head">
                            <span className="rm-insp-overline">Roadmap</span>
                            <h2>{roadmap.skillName}</h2>
                            <p className="rm-insp-help">
                                Select a task to see its details. Drag tasks to arrange them, drag from the bottom dot of one task to the top dot of another to link them, and press Delete to remove a selected link.
                            </p>
                        </div>
                    )}
                </aside>
            </div>

            <AddBlockModal
                isOpen={pickerOpen}
                tasks={available}
                pickTitle="Add a task"
                pickSubtitle="Pick a task from your list to add as a step."
                pickAction="Add to roadmap"
                onPick={addTask}
                onClose={() => setPickerOpen(false)}
            />
            <CreateRoadmap isOpen={renameOpen} initialData={roadmap} loading={renaming} onSubmit={rename} onClose={() => setRenameOpen(false)} />
            <FocusSessionFlow
                isOpen={Boolean(sessionTask)}
                task={sessionTask}
                onClose={() => setSessionTask(null)}
                onSaved={() => dispatch(fetchInventoryTasks())}
            />
        </div>
    );
};

const RoadmapCanvas = () => {
    const { id } = useParams();
    const dispatch = useDispatch();
    const { activeRoadmap, loading, error } = useSelector((s) => s.roadmaps);

    useEffect(() => {
        dispatch(fetchRoadmapById(id));
        dispatch(fetchInventoryTasks());
        return () => dispatch(clearActiveRoadmap());
    }, [dispatch, id]);

    if (!activeRoadmap || activeRoadmap._id !== id) {
        if (error && !loading) {
            return (
                <div className="page">
                    <div className="page-inner">
                        <EmptyState
                            icon={<Route size={20} />}
                            title="Couldn't open this roadmap"
                            help="It may have been deleted."
                            action={<Link to="/roadmaps" className="btn">Back to roadmaps</Link>}
                        />
                    </div>
                </div>
            );
        }
        return <div className="rm-editor"><div className="skeleton rm-skeleton" /></div>;
    }

    return (
        <ReactFlowProvider>
            <Editor key={activeRoadmap._id} roadmap={activeRoadmap} />
        </ReactFlowProvider>
    );
};

export default RoadmapCanvas;
