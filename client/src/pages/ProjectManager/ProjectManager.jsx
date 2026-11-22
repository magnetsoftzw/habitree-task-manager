import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Folder, Plus, Search } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import ProjectCard from '../../components/project/ProjectCard/ProjectCard';
import CreateProjectModal from '../../components/modals/Project/CreateProjectModal';
import { deleteProject, fetchProjects } from '../../store/slices/projectSlice';

const ProjectManager = () => {
    const dispatch = useDispatch();
    const { items: projects, loading, error } = useSelector((state) => state.projects);
    const { profile } = useSelector((state) => state.user);
    const [query, setQuery] = useState('');
    const [isCreateOpen, setCreateOpen] = useState(false);

    useEffect(() => {
        dispatch(fetchProjects());
    }, [dispatch]);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return projects || [];
        return (projects || []).filter((p) =>
            p.name.toLowerCase().includes(q)
            || (p.description || '').toLowerCase().includes(q)
            || (p.techStack || []).some((t) => t.toLowerCase().includes(q)));
    }, [projects, query]);

    const handleDelete = async (project) => {
        if (!window.confirm(`Delete "${project.name}" with its board and task list? This can't be undone.`)) return;
        try {
            await dispatch(deleteProject(project._id)).unwrap();
            toast.success('Project deleted');
        } catch {
            toast.error('Could not delete that project');
        }
    };

    const count = projects?.length || 0;

    return (
        <div className="page">
            <div className="page-inner">
                <PageHeader
                    alignEnd
                    title="Projects"
                    subtitle={count ? `${count} ${count === 1 ? 'project' : 'projects'} · each with its own Kanban board` : 'Each project gets its own Kanban board and task list'}
                    actions={(
                        <>
                            <label className="search-field">
                                <Search size={16} aria-hidden="true" />
                                <span className="sr-only">Search projects</span>
                                <input type="search" placeholder="Search projects" value={query} onChange={(e) => setQuery(e.target.value)} />
                            </label>
                            <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
                                <Plus size={16} strokeWidth={2.4} aria-hidden="true" /> New project
                            </button>
                        </>
                    )}
                />

                {error && count === 0 ? (
                    <EmptyState
                        icon={<Folder size={20} />}
                        title="Couldn't load your projects"
                        help="Check your connection and try again."
                        action={<button type="button" className="btn" onClick={() => dispatch(fetchProjects())}>Try again</button>}
                    />
                ) : loading && count === 0 ? (
                    <div className="project-grid" aria-busy="true">
                        {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 360, borderRadius: 16 }} />)}
                    </div>
                ) : query && visible.length === 0 ? (
                    <EmptyState
                        icon={<Search size={20} />}
                        title={`No projects match "${query}"`}
                        help="Try a different name or tech."
                    />
                ) : (
                    <div className="project-grid">
                        {visible.map((p) => (
                            <ProjectCard
                                key={p._id}
                                project={p}
                                onDelete={(p.owner?._id || p.owner) === profile?._id ? handleDelete : undefined}
                            />
                        ))}
                        {!query && (
                            <button type="button" className="project-new-tile" onClick={() => setCreateOpen(true)}>
                                <span className="project-new-icon" aria-hidden="true"><Plus size={20} strokeWidth={2.4} /></span>
                                <span className="project-new-title">New project</span>
                                <span className="project-new-help">Gets its own board with backlog and workflow columns</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            <CreateProjectModal
                isOpen={isCreateOpen}
                onClose={() => {
                    setCreateOpen(false);
                    dispatch(fetchProjects());
                }}
            />
        </div>
    );
};

export default ProjectManager;
