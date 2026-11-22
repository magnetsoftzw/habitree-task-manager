import { createAsyncThunk } from '@reduxjs/toolkit';
import { errorMessage } from '../utils/Format';
import { send } from '../sync/SyncEngine';
import { patchInventoryTask, setTaskStatus } from './slices/TasksSlice';
import { updateProjectTask, updateSubtask } from './slices/ProjectTasksSlice';
import { markEntrySubtask, markEntryTask } from './slices/PlannerSlice';
import { fetchActivity } from './slices/StatsSlice';

export const refForTask = (task) => ({
  taskType: 'task',
  taskId: task._id,
  projectId: task.projectId?._id || task.projectId || null,
  title: task.title,
});

export const refForListTask = (task, projectId) => ({
  taskType: 'projectTask',
  taskId: task._id,
  projectId: projectId || task.projectId,
  title: task.title,
});

export const refForSubtask = (task, subtask, projectId) => ({
  ...(projectId ? refForListTask(task, projectId) : refForTask(task)),
  subtaskId: subtask._id,
  title: subtask.title,
  parentTitle: task.title,
});

export const entryInfo = (entry) => {
  const task = entry.taskId;
  if (!task) return null;
  const subtask = entry.subtaskId ? (task.subtasks || []).find((s) => String(s._id) === String(entry.subtaskId)) : null;
  const done = subtask ? !!(subtask.isCompleted || subtask.done) : task.status === 'Completed';
  return {
    task,
    subtask,
    title: subtask?.title || task.title,
    done,
    status: done ? 'Completed' : subtask ? 'Not Started' : task.status,
  };
};

export const refForEntry = (entry) => ({
  taskType: entry.taskType || 'task',
  taskId: entry.taskId?._id,
  projectId: entry.projectId?._id || entry.projectId || entry.taskId?.projectId?._id || null,
  subtaskId: entry.subtaskId || null,
  title: entryInfo(entry)?.title || entry.taskId?.title,
  parentTitle: entry.subtaskId ? entry.taskId?.title : undefined,
});

const setSubtaskDone = async (ref, done, dispatch, getState) => {
  if (ref.taskType === 'projectTask') {
    const loaded = getState().projectTasks.byProject[ref.projectId]?.tasks.some((t) => t._id === ref.taskId);
    if (loaded) {
      await dispatch(updateSubtask({ projectId: ref.projectId, taskId: ref.taskId, subtaskId: ref.subtaskId, updates: { done } })).unwrap();
    } else {
      await send({ dispatch, getState }, { method: 'patch', url: `/projects/${ref.projectId}/tasks/${ref.taskId}/subtasks/${ref.subtaskId}`, body: { done }, kinds: [`projectTasks:${ref.projectId}`], label: 'A subtask change' });
    }
    return;
  }
  const state = getState();
  let task = Object.values(state.tasks.inventory).flat().find((t) => t._id === ref.taskId)
    || (state.tasks.current?._id === ref.taskId ? state.tasks.current : null);
  if (!task) {
    const entry = Object.values(state.planner.byDate).flat().find((e) => e.taskId?._id === ref.taskId);
    task = entry?.taskId;
  }
  if (!task) throw new Error('That task is not saved on this phone yet');
  const subtasks = (task.subtasks || []).map((s) => (String(s._id) === String(ref.subtaskId)
    ? { ...s, isCompleted: done, status: done ? 'Completed' : 'Not Started' }
    : s));
  dispatch(patchInventoryTask({ _id: ref.taskId, subtasks }));
  await send({ dispatch, getState }, { method: 'put', url: `/tasks/${ref.taskId}`, body: { subtasks }, kinds: ['tasks'], label: 'A subtask change' });
};

export const setRefDone = createAsyncThunk('tasks/setRefDone', async ({ ref, done, previousStatus }, { dispatch, getState, rejectWithValue }) => {
  if (ref.subtaskId) {
    dispatch(markEntrySubtask({ taskId: ref.taskId, subtaskId: ref.subtaskId, done }));
    try {
      await setSubtaskDone(ref, done, dispatch, getState);
      dispatch(fetchActivity());
      return true;
    } catch (error) {
      dispatch(markEntrySubtask({ taskId: ref.taskId, subtaskId: ref.subtaskId, done: !done }));
      return rejectWithValue(typeof error === 'string' ? error : errorMessage(error, 'Could not update the subtask'));
    }
  }
  const taskStatus = done ? 'Completed' : 'Not Started';
  dispatch(markEntryTask({ taskId: ref.taskId, status: taskStatus }));
  try {
    if (ref.taskType === 'projectTask') {
      const loaded = getState().projectTasks.byProject[ref.projectId]?.tasks.some((t) => t._id === ref.taskId);
      if (loaded) {
        await dispatch(updateProjectTask({ projectId: ref.projectId, taskId: ref.taskId, updates: { status: done ? 'done' : 'not_started' } })).unwrap();
      } else {
        await send({ dispatch, getState }, { method: 'patch', url: `/projects/${ref.projectId}/tasks/${ref.taskId}`, body: { status: done ? 'done' : 'not_started' }, kinds: [`projectTasks:${ref.projectId}`], label: 'A task status change' });
      }
    } else {
      await dispatch(setTaskStatus({ id: ref.taskId, status: taskStatus, previous: previousStatus })).unwrap();
    }
    dispatch(fetchActivity());
    return true;
  } catch (error) {
    dispatch(markEntryTask({ taskId: ref.taskId, status: previousStatus || (done ? 'Not Started' : 'Completed') }));
    return rejectWithValue(typeof error === 'string' ? error : errorMessage(error, 'Could not update the task'));
  }
});
