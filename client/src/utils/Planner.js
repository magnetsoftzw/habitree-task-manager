import { colorFor, UNCATEGORIZED_COLOR } from './Colors';

export const resolveEntry = (entry) => {
    const task = entry.taskId;
    if (!task) return null;
    const subtask = entry.subtaskId ? task.subtasks?.find((s) => s._id === entry.subtaskId) : null;
    const done = subtask ? subtask.isCompleted || subtask.status === 'Completed' : task.status === 'Completed' || task.status === 'done';
    const now = !done && (subtask ? subtask.status === 'On-Going' : task.status === 'On-Going' || task.status === 'in_progress');
    return {
        task,
        subtask,
        title: subtask?.title || task.title,
        group: task.groupId?.name || 'Uncategorized',
        color: task.groupId ? colorFor(task.groupId) : UNCATEGORIZED_COLOR,
        kind: entry.taskType === 'projectTask' ? 'Project task' : task.category || 'General',
        state: done ? 'done' : now ? 'now' : 'next',
    };
};

export const planEntryState = (entry) => resolveEntry(entry)?.state || 'next';
