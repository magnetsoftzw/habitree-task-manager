import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { FolderPlus, Plus } from 'lucide-react';
import API from '../../../api/axiosInstance';
import { shiftDateKey, toDateKey } from '../../../utils/Format';
import TaskListRow, { InlineInput } from './TaskListRow';
import TaskGroupHeader from './TaskGroupHeader';
import AddToPlanModal from '../../modals/Project/AddToPlanModal';
import ProjectTaskModal from '../../modals/Project/ProjectTaskModal';
import MoveToGroupModal from '../../modals/Project/MoveToGroupModal';
import ConfirmModal from '../../ui/ConfirmModal';
import {
    createProjectTask, createSubtask, createTaskGroup, deleteProjectTask, deleteSubtask, deleteTaskGroup, fetchProjectTasks,
    hideTaskLocally, renameTaskGroup, reorderProjectTasks, reorderSubtasks, restoreTaskLocally, updateProjectTask, updateSubtask,
} from '../../../store/slices/projectTasksSlice';
import './TaskList.css';

const UNDO_MS = 5000;
const NONE = 'none';
const PREFIX = 'section:';

const TaskList = ({ projectId, tasks, groups = [], query, onlyOpen, statusFilter, adding, onAddingChange }) => {
    const dispatch = useDispatch();
    const [expanded, setExpanded] = useState(() => new Set());
    const [sticky, setSticky] = useState(() => new Set());
    const [planTask, setPlanTask] = useState(null);
    const [editTask, setEditTask] = useState(null);
    const [planned, setPlanned] = useState({});
    const [planVersion, setPlanVersion] = useState(0);
    const [addingIn, setAddingIn] = useState(null);
    const [addingGroup, setAddingGroup] = useState(false);
    const [groupTask, setGroupTask] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [confirm, setConfirm] = useState(null);
    const pendingDeletes = useRef(new Map());

    useEffect(() => {
        const from = toDateKey();
        const controller = new AbortController();
        API.get('/planner/range', { params: { from, to: shiftDateKey(from, 60) }, signal: controller.signal })
            .then(({ data }) => {
                const map = {};
                (data.days || []).forEach((day) => (day.entries || []).forEach((e) => {
                    const id = String(e.taskId?._id || e.taskId);
                    if (e.taskType === 'projectTask' && !map[id]) map[id] = day.date;
                }));
                setPlanned(map);
            })
            .catch(() => {});
        return () => controller.abort();
    }, [projectId, planVersion]);

    useEffect(() => () => {
        pendingDeletes.current.forEach(({ timer, send }) => {
            clearTimeout(timer);
            send();
        });
    }, []);

    const q = query.trim().toLowerCase();
    const filtering = Boolean(q) || onlyOpen || statusFilter.size > 0;

    const { visible, searchExpanded } = useMemo(() => {
        const matched = new Set();
        const list = tasks.filter((t) => {
            if (t._pendingDelete) return false;
            if (onlyOpen && t.status === 'done' && !sticky.has(t._id)) return false;
            if (statusFilter.size && !statusFilter.has(t.status)) return false;
            if (!q) return true;
            const inTitle = t.title.toLowerCase().includes(q);
            const inSubs = (t.subtasks || []).some((s) => s.title.toLowerCase().includes(q));
            if (inSubs) matched.add(t._id);
            return inTitle || inSubs;
        });
        return { visible: list, searchExpanded: matched };
    }, [tasks, onlyOpen, sticky, statusFilter, q]);

    const sections = useMemo(() => {
        const known = new Set(groups.map((g) => g._id));
        const keyOf = (t) => (t.groupId && known.has(t.groupId) ? t.groupId : NONE);
        const bucket = (list, key) => list.filter((t) => keyOf(t) === key);
        return [
            { key: NONE, group: { _id: null, name: 'No group' }, all: bucket(tasks, NONE), shown: bucket(visible, NONE) },
            ...groups.map((g) => ({ key: g._id, group: g, all: bucket(tasks, g._id), shown: bucket(visible, g._id) })),
        ];
    }, [groups, tasks, visible]);

    const sectionOfTask = (task) => sections.find((s) => s.all.some((t) => t._id === task._id)) || sections[0];

    const recover = (message) => () => {
        toast.error(message);
        dispatch(fetchProjectTasks(projectId));
    };

    const toggleExpand = (id) => setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });

    const setStatus = (task, status) => {
        if (status === 'done') setSticky((prev) => new Set(prev).add(task._id));
        dispatch(updateProjectTask({ projectId, taskId: task._id, changes: { status } }))
            .unwrap()
            .catch(recover('Could not update that task'));
    };

    const rename = (task, title) => {
        dispatch(updateProjectTask({ projectId, taskId: task._id, changes: { title } }))
            .unwrap()
            .catch(recover('Could not rename that task'));
    };

    const writeOrder = (ids) => {
        dispatch(reorderProjectTasks({ projectId, taskIds: ids }))
            .unwrap()
            .catch(recover('Could not save the new order'));
    };

    const move = (task, where) => {
        const own = sectionOfTask(task).all.map((t) => t._id);
        const at = own.indexOf(task._id);
        const neighbour = where === 'top' ? own[0] : where === 'up' ? own[at - 1] : own[at + 1];
        if (!neighbour || neighbour === task._id) return;
        const ids = tasks.map((t) => t._id).filter((id) => id !== task._id);
        const anchor = ids.indexOf(neighbour);
        ids.splice(where === 'down' ? anchor + 1 : anchor, 0, task._id);
        writeOrder(ids);
    };

    const remove = (task) => {
        const count = task.subtasks?.length || 0;
        if (count) {
            setConfirm({
                title: 'Delete task?',
                message: `"${task.title}" and its ${count} ${count === 1 ? 'subtask' : 'subtasks'} will be deleted.`,
                onConfirm: () => removeNow(task),
            });
            return;
        }
        removeNow(task);
    };

    const removeNow = (task) => {
        dispatch(hideTaskLocally({ projectId, taskId: task._id }));
        const send = () => {
            pendingDeletes.current.delete(task._id);
            dispatch(deleteProjectTask({ projectId, taskId: task._id }))
                .unwrap()
                .catch(() => {
                    dispatch(restoreTaskLocally({ projectId, taskId: task._id }));
                    toast.error('Could not delete that task');
                });
        };
        const timer = setTimeout(send, UNDO_MS);
        pendingDeletes.current.set(task._id, { timer, send });
        toast((t) => (
            <span className="tl-toast">
                Task deleted
                <button
                    type="button"
                    className="tl-link-btn"
                    onClick={() => {
                        clearTimeout(timer);
                        pendingDeletes.current.delete(task._id);
                        dispatch(restoreTaskLocally({ projectId, taskId: task._id }));
                        toast.dismiss(t.id);
                    }}
                >
                    Undo
                </button>
            </span>
        ), { duration: UNDO_MS });
    };

    const addTask = (title, groupId) => {
        dispatch(createProjectTask({ projectId, title, ...(groupId && { groupId }) }))
            .unwrap()
            .catch((err) => toast.error(err?.message || 'Could not add that task'));
    };

    const addGroup = (name) => {
        setAddingGroup(false);
        dispatch(createTaskGroup({ projectId, name }))
            .unwrap()
            .catch((err) => toast.error(err?.message || 'Could not create that group'));
    };

    const renameGroup = (group, name) => {
        dispatch(renameTaskGroup({ projectId, groupId: group._id, name }))
            .unwrap()
            .catch((err) => toast.error(err?.message || 'Could not rename that group'));
    };

    const removeGroup = (group, count) => {
        setConfirm({
            title: `Delete "${group.name}"?`,
            message: count
                ? `Its ${count} ${count === 1 ? 'task moves' : 'tasks move'} to No group. No tasks are deleted.`
                : 'The group is empty. No tasks are affected.',
            confirmLabel: 'Delete group',
            onConfirm: () => dispatch(deleteTaskGroup({ projectId, groupId: group._id }))
                .unwrap()
                .catch((err) => toast.error(err?.message || 'Could not delete that group')),
        });
    };

    const moveToGroup = (task, groupId) => {
        setGroupTask(null);
        const name = groups.find((g) => g._id === groupId)?.name || 'No group';
        dispatch(updateProjectTask({ projectId, taskId: task._id, changes: { groupId } }))
            .unwrap()
            .then(() => toast.success(`Moved to ${name}`))
            .catch(recover('Could not move that task to the group'));
    };

    const subtaskActions = (task) => ({
        onAddSubtask: (title) => dispatch(createSubtask({ projectId, taskId: task._id, title }))
            .unwrap()
            .catch((err) => toast.error(err?.message || 'Could not add that subtask')),
        onToggleSubtask: (sub) => dispatch(updateSubtask({ projectId, taskId: task._id, subtaskId: sub._id, changes: { done: !sub.done } }))
            .unwrap()
            .catch(recover('Could not update that subtask')),
        onRenameSubtask: (sub, title) => dispatch(updateSubtask({ projectId, taskId: task._id, subtaskId: sub._id, changes: { title } }))
            .unwrap()
            .catch(recover('Could not rename that subtask')),
        onDeleteSubtask: (sub) => dispatch(deleteSubtask({ projectId, taskId: task._id, subtaskId: sub._id }))
            .unwrap()
            .catch(recover('Could not delete that subtask')),
    });

    const onDragEnd = ({ source, destination, type, draggableId }) => {
        setDragging(false);
        if (!destination) return;
        const sameDrop = destination.droppableId === source.droppableId;
        if (sameDrop && destination.index === source.index) return;

        if (type === 'task') {
            const toKey = destination.droppableId.slice(PREFIX.length);
            const target = sections.find((s) => s.key === toKey);
            if (!target) return;
            const ids = tasks.map((t) => t._id).filter((id) => id !== draggableId);
            const anchor = target.shown.map((t) => t._id).filter((id) => id !== draggableId)[destination.index];
            const last = target.all.map((t) => t._id).filter((id) => id !== draggableId).pop();
            const at = anchor ? ids.indexOf(anchor) : last ? ids.indexOf(last) + 1 : ids.length;
            ids.splice(at, 0, draggableId);
            if (!sameDrop) {
                dispatch(updateProjectTask({ projectId, taskId: draggableId, changes: { groupId: toKey === NONE ? null : toKey } }))
                    .unwrap()
                    .catch(recover('Could not move that task to the group'));
            }
            writeOrder(ids);
            return;
        }

        const taskId = type.slice(4);
        const task = tasks.find((t) => t._id === taskId);
        if (!task) return;
        const subIds = task.subtasks.map((s) => s._id);
        const [moved] = subIds.splice(source.index, 1);
        subIds.splice(destination.index, 0, moved);
        dispatch(reorderSubtasks({ projectId, taskId, subtaskIds: subIds }))
            .unwrap()
            .catch(recover('Could not save the new order'));
    };

    const grouped = groups.length > 0;

    return (
        <section className={`tl ${dragging ? 'is-dragging-task' : ''}`} aria-label="Task list">
            <div className="table-scroll">
                <div className="tl-inner">
                    <div className="tl-head" aria-hidden="true">
                        <span className="tl-head-task">Task</span>
                        <span>Subtasks</span>
                        <span>Status</span>
                        <span>Due</span>
                        <span />
                    </div>

                    <DragDropContext onBeforeCapture={({ draggableId }) => !draggableId.startsWith('sub:') && setDragging(true)} onDragEnd={onDragEnd}>
                        {sections.map((section) => {
                            const isNone = section.key === NONE;
                            const isAdding = addingIn === section.key || (isNone && adding);
                            if (isNone && grouped && section.all.length === 0 && !isAdding && !dragging) return null;
                            if (!isNone && filtering && section.shown.length === 0 && !dragging) return null;
                            const stopAdding = () => {
                                setAddingIn(null);
                                if (isNone) onAddingChange(false);
                            };
                            return (
                                <div key={section.key} className="tl-section">
                                    <Droppable droppableId={`${PREFIX}${section.key}`} type="task">
                                        {(provided, snapshot) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.droppableProps}
                                                className={`tl-drop ${snapshot.isDraggingOver ? 'is-over' : ''}`}
                                            >
                                                {grouped && (
                                                    <TaskGroupHeader
                                                        group={section.group}
                                                        count={section.all.length}
                                                        onRename={(name) => renameGroup(section.group, name)}
                                                        onDelete={() => removeGroup(section.group, section.all.length)}
                                                        onAddTask={() => setAddingIn(section.key)}
                                                    />
                                                )}
                                                {section.shown.map((task, i) => (
                                                    <TaskListRow
                                                        key={task._id}
                                                        task={task}
                                                        index={i}
                                                        isFirst={section.all[0]?._id === task._id}
                                                        isLast={section.all[section.all.length - 1]?._id === task._id}
                                                        expanded={expanded.has(task._id) || searchExpanded.has(task._id)}
                                                        onToggleExpand={() => toggleExpand(task._id)}
                                                        onToggleDone={() => setStatus(task, task.status === 'done' ? 'not_started' : 'done')}
                                                        onMarkDone={() => setStatus(task, 'done')}
                                                        onRename={(title) => rename(task, title)}
                                                        onMove={(where) => move(task, where)}
                                                        onDelete={() => remove(task)}
                                                        onPlan={() => setPlanTask(task)}
                                                        plannedDate={planned[task._id]}
                                                        onEdit={() => setEditTask(task)}
                                                        onMoveToGroup={grouped ? () => setGroupTask(task) : undefined}
                                                        {...subtaskActions(task)}
                                                    />
                                                ))}
                                                {provided.placeholder}
                                                {grouped && section.shown.length === 0 && !isAdding && (
                                                    <p className="tl-group-empty">
                                                        {isNone ? 'Drop here to take the task out of its group.' : 'No tasks in this group yet. Add one, or drag a task here.'}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </Droppable>
                                    {isAdding && (
                                        <div className="tl-add-row">
                                            <InlineInput
                                                label={`New task in ${section.group.name}`}
                                                keepOpen
                                                onSave={(title) => addTask(title, section.group._id)}
                                                onCancel={stopAdding}
                                                className="is-task"
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </DragDropContext>

                    {visible.length === 0 && !grouped && !adding && (
                        <div className="tl-empty">
                            {filtering && tasks.length ? (
                                <>
                                    <span className="tl-empty-title">No tasks match</span>
                                    <span className="tl-empty-help">Try a different search or show all tasks.</span>
                                </>
                            ) : (
                                <>
                                    <span className="tl-empty-title">No tasks in this list yet</span>
                                    <span className="tl-empty-help">Add tasks for work that doesn't need a board column. Create groups to sort them under headings.</span>
                                </>
                            )}
                        </div>
                    )}

                    <div className="tl-add-row tl-foot">
                        {!adding && (
                            <button type="button" className="tl-add-btn" onClick={() => onAddingChange(true)}>
                                <Plus size={16} strokeWidth={2.4} aria-hidden="true" /> Add task
                            </button>
                        )}
                        {addingGroup ? (
                            <InlineInput label="New group name" onSave={addGroup} onCancel={() => setAddingGroup(false)} className="is-group" />
                        ) : (
                            <button type="button" className="tl-add-btn" onClick={() => setAddingGroup(true)}>
                                <FolderPlus size={16} strokeWidth={2.2} aria-hidden="true" /> Add group
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <AddToPlanModal isOpen={Boolean(planTask)} task={planTask} projectId={projectId} onClose={() => { setPlanTask(null); setPlanVersion((v) => v + 1); }} />
            <ConfirmModal isOpen={Boolean(confirm)} {...confirm} onClose={() => setConfirm(null)} />
            <MoveToGroupModal isOpen={Boolean(groupTask)} task={groupTask} groups={groups} onClose={() => setGroupTask(null)} onMove={(groupId) => moveToGroup(groupTask, groupId)} />
            <ProjectTaskModal isOpen={Boolean(editTask)} task={editTask} projectId={projectId} groups={groups} onClose={() => setEditTask(null)} />
        </section>
    );
};

export default TaskList;
