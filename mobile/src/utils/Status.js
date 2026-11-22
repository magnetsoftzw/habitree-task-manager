export const TASK_STATUSES = ['Not Started', 'On-Going', 'On-Hold', 'Shelved', 'Completed'];

export const TASK_STATUS_LABELS = {
  'Not Started': 'Not started',
  'On-Going': 'In progress',
  'On-Hold': 'On hold',
  Shelved: 'Shelved',
  Completed: 'Done',
};

export const LIST_STATUSES = ['not_started', 'in_progress', 'done', 'shelved'];

export const LIST_TO_TASK_STATUS = { not_started: 'Not Started', in_progress: 'On-Going', done: 'Completed', shelved: 'Shelved' };

export const LIST_STATUS_LABELS = { not_started: 'Not started', in_progress: 'In progress', done: 'Done', shelved: 'Shelved' };

export const CATEGORIES = ['General', 'Watch', 'Read', 'Practice', 'Note'];

export const KANBAN_COLUMNS = [
  { id: 'backendBacklog', name: 'Backend backlog' },
  { id: 'frontendBacklog', name: 'Frontend backlog' },
  { id: 'mobileBacklog', name: 'Mobile backlog' },
  { id: 'design', name: 'Design' },
  { id: 'issues', name: 'Issues' },
  { id: 'todo', name: 'Todo' },
  { id: 'doing', name: 'Doing' },
  { id: 'testing', name: 'Testing' },
  { id: 'done', name: 'Done' },
];

export const PROJECT_COLORS = ['#C2410C', '#1F5FAD', '#1E6B47', '#6B5BD2', '#C2185B', '#0E7C7B'];

export const GROUP_COLORS = ['#C2185B', '#1F5FAD', '#0E7C7B', '#6B5BD2', '#C2410C', '#1E6B47', '#6B7280'];

export const projectColor = (project) => {
  if (project?.color) return project.color;
  const id = String(project?._id || '');
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return [...PROJECT_COLORS, '#B45309'][hash % 7];
};
