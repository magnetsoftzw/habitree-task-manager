import { fetchGroups, fetchInventory, fetchTask } from '../store/slices/TasksSlice';
import { fetchPlanner } from '../store/slices/PlannerSlice';
import { fetchProject, fetchProjects } from '../store/slices/ProjectsSlice';
import { fetchProjectTasks } from '../store/slices/ProjectTasksSlice';
import { fetchRoadmap, fetchRoadmaps } from '../store/slices/RoadmapsSlice';
import { fetchActivity, fetchRangeStats, fetchTaskVolume } from '../store/slices/StatsSlice';
import { fetchNotifications } from '../store/slices/NotificationsSlice';
import { fetchSchedule, fetchTemplate } from '../store/slices/ScheduleSlice';
import { fetchMe } from '../store/slices/AuthSlice';
import { addDays, toDateKey } from '../utils/Format';

const recentDates = (dates) => {
  const floor = toDateKey(addDays(new Date(), -7));
  return dates.filter((d) => d >= floor);
};

export const refreshKinds = (kinds) => (dispatch, getState) => {
  const all = kinds.includes('all');
  const has = (k) => all || kinds.includes(k);
  const prefixed = (p) => kinds.filter((k) => k.startsWith(`${p}:`)).map((k) => k.slice(p.length + 1));
  const s = getState();
  const jobs = new Set();
  const run = (key, action) => {
    if (jobs.has(key)) return;
    jobs.add(key);
    dispatch(action());
  };

  const tasksChanged = has('tasks') || has('groups');
  if (has('groups')) run('groups', fetchGroups);
  if (tasksChanged) {
    run('inventory', fetchInventory);
    if (s.tasks.current?._id) run(`task:${s.tasks.current._id}`, () => fetchTask(s.tasks.current._id));
  }

  const plannerDates = new Set(prefixed('planner'));
  if (has('planner') || tasksChanged || has('projectTasks') || prefixed('projectTasks').length) {
    recentDates(Object.keys(s.planner.byDate)).forEach((d) => plannerDates.add(d));
  }
  plannerDates.forEach((d) => run(`planner:${d}`, () => fetchPlanner(d)));

  const currentProject = s.projects.current?._id;
  if (has('projects') || tasksChanged) run('projects', fetchProjects);
  const projectIds = new Set(prefixed('project'));
  if ((has('projects') || tasksChanged) && currentProject) projectIds.add(currentProject);
  projectIds.forEach((id) => { if (id === currentProject) run(`project:${id}`, () => fetchProject(id)); });

  const taskLists = new Set(prefixed('projectTasks'));
  if (has('projectTasks')) Object.keys(s.projectTasks.byProject).forEach((id) => taskLists.add(id));
  taskLists.forEach((id) => { if (s.projectTasks.byProject[id]?.loaded) run(`projectTasks:${id}`, () => fetchProjectTasks(id)); });

  if (has('roadmaps')) {
    run('roadmaps', fetchRoadmaps);
    if (s.roadmaps.current?._id) run('roadmap', () => fetchRoadmap(s.roadmaps.current._id));
  }

  const scheduleDates = new Set(prefixed('schedule'));
  if (has('template')) {
    run('template', fetchTemplate);
    Object.keys(s.schedule.byDate).forEach((d) => scheduleDates.add(d));
  }
  if (all) recentDates(Object.keys(s.schedule.byDate)).forEach((d) => scheduleDates.add(d));
  scheduleDates.forEach((d) => { if (s.schedule.byDate[d]) run(`schedule:${d}`, () => fetchSchedule(d)); });

  if (has('sessions') || tasksChanged) {
    run('activity', fetchActivity);
    run('volume', fetchTaskVolume);
    Object.keys(s.stats.ranges).forEach((key) => run(`range:${key}`, () => fetchRangeStats(key)));
  }
  if (has('notifications')) run('notifications', fetchNotifications);
  if (has('user')) run('me', fetchMe);
};
