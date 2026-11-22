import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import StatusPill from '../ui/StatusPill';
import { colorFor } from '../../utils/Colors';

const RoadmapNode = ({ data, selected }) => {
    const task = data.task;
    const status = task?.status || data.status || 'Not Started';
    const progress = Math.round(task?.progress ?? data.progress ?? 0);
    const group = task?.groupId && typeof task.groupId === 'object' ? task.groupId : null;
    const meta = [group?.name || 'Uncategorized', task?.category].filter(Boolean).join(' · ');

    return (
        <div className={`rm-node ${selected ? 'is-selected' : ''} ${data.missing ? 'is-missing' : ''}`}>
            <Handle type="target" position={Position.Top} className="rm-handle" />
            <span className="rm-node-meta">
                <span className="rm-node-dot" style={{ background: colorFor(group) }} aria-hidden="true" />
                {data.missing ? 'Task removed' : meta}
            </span>
            <span className="rm-node-title">{task?.title || data.label || 'Untitled task'}</span>
            <span className="rm-node-foot">
                <StatusPill status={status} />
                <span className="rm-node-bar" aria-hidden="true"><span style={{ width: `${progress}%` }} /></span>
                <span className="rm-node-pct tabular">{progress}%</span>
            </span>
            <Handle type="source" position={Position.Bottom} className="rm-handle rm-handle-source" />
        </div>
    );
};

export default memo(RoadmapNode);
