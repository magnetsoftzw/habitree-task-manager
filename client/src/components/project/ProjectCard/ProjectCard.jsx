import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ExternalLink, ListChecks, Trash2 } from 'lucide-react';
import Menu from '../../ui/Menu';
import { colorFor } from '../../../utils/Colors';
import { formatDueDate } from '../../../utils/Format';
import './ProjectCard.css';

const initialsOf = (name = '') =>
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

const ProjectCard = ({ project, onDelete }) => {
    const navigate = useNavigate();
    const color = colorFor(project);
    const members = [project.owner, ...(project.collaborators || [])].filter(Boolean);
    const cards = project.boardCardCount ?? 0;
    const tasks = project.openTaskCount ?? 0;
    const progress = Math.max(0, Math.min(100, project.progress || 0));

    return (
        <article className="project-card">
            <div className="project-card-head">
                <span className="project-card-badge" style={{ background: color }} aria-hidden="true">
                    {initialsOf(project.name)}
                </span>
                <div className="project-card-title-wrap">
                    <h2 className="project-card-title">
                        <Link to={`/projects/${project._id}`}>{project.name}</Link>
                    </h2>
                    {project.createdAt && (
                        <span className="project-card-meta">Created {formatDueDate(project.createdAt)}</span>
                    )}
                </div>
                <Menu
                    label={`Options for ${project.name}`}
                    items={[
                        { label: 'Open board', icon: <ExternalLink size={16} />, onSelect: () => navigate(`/projects/${project._id}?view=board`) },
                        { label: 'Open task list', icon: <ListChecks size={16} />, onSelect: () => navigate(`/projects/${project._id}?view=list`) },
                        onDelete && { label: 'Delete project', icon: <Trash2 size={16} />, danger: true, onSelect: () => onDelete(project) },
                    ]}
                />
            </div>

            <p className="project-card-desc">{project.description || 'No description'}</p>

            {project.techStack?.length > 0 && (
                <ul className="project-card-tags" aria-label="Tech stack">
                    {project.techStack.map((t) => <li key={t}>{t}</li>)}
                </ul>
            )}

            <div className="project-card-progress">
                <div className="project-card-counts">
                    <span>Board · {cards} {cards === 1 ? 'card' : 'cards'}</span>
                    <span>Task list · {tasks} {tasks === 1 ? 'task' : 'tasks'}</span>
                </div>
                <div className="progress" role="img" aria-label={`${progress} percent complete`}>
                    <span style={{ width: `${progress}%`, background: color }} />
                </div>
            </div>

            <div className="project-card-foot">
                <div className="project-card-avatars">
                    {members.slice(0, 4).map((m) => (
                        <span key={m._id || m} className="project-card-avatar" title={m.username}>
                            {(m.username || '?').charAt(0).toUpperCase()}
                        </span>
                    ))}
                </div>
                <span className="project-card-team">
                    {members.length <= 1 ? 'Only you' : `${members.length} members`}
                </span>
                <Link to={`/projects/${project._id}?view=list`} className="project-card-link">Task list</Link>
                <Link to={`/projects/${project._id}`} className="project-card-open">
                    Open board <ArrowRight size={14} strokeWidth={2.2} aria-hidden="true" />
                </Link>
            </div>
        </article>
    );
};

export default ProjectCard;
