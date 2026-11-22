const nodePercent = (n) => (n.data?.status === 'Completed' ? 100 : Math.max(0, Math.min(100, Number(n.data?.progress) || 0)));

export const roadmapProgress = (nodes = []) => {
  const total = nodes.length;
  if (!total) return { percent: 0, done: 0, total: 0 };
  const percent = Math.round(nodes.reduce((sum, n) => sum + nodePercent(n), 0) / total);
  return { percent, done: nodes.filter((n) => nodePercent(n) === 100).length, total };
};
