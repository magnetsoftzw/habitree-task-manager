import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, ExternalLink, Info, Pencil, Plus, Route, Trash2 } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Menu from '../../components/ui/Menu';
import EmptyState from '../../components/ui/EmptyState';
import CreateRoadmap from '../../components/modals/Roadmap/CreateRoadmap';
import { createRoadmap, deleteRoadmap, fetchUserRoadmaps, updateRoadmapMeta } from '../../store/slices/roadmapSlice';
import { previewLayout, roadmapHint, roadmapProgress } from '../../utils/Roadmap';
import { formatDueDate } from '../../utils/Format';
import './RoadmapList.css';

const PREVIEW_W = 340;
const PREVIEW_H = 180;
const NODE_W = 128;
const NODE_H = 44;

const MiniMap = ({ roadmap }) => {
    const nodes = previewLayout((roadmap.nodes || []).slice(0, 8), PREVIEW_W, PREVIEW_H, NODE_W, NODE_H);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    return (
        <Link to={`/roadmaps/${roadmap._id}`} className="rm-preview" aria-label={`Open ${roadmap.skillName}`}>
            <div className="rm-preview-stage">
                <svg className="rm-preview-edges" viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`} aria-hidden="true">
                    {(roadmap.edges || []).map((e) => {
                        const a = byId.get(e.source);
                        const b = byId.get(e.target);
                        if (!a || !b) return null;
                        return (
                            <line
                                key={e.id}
                                x1={a.x + NODE_W / 2}
                                y1={a.y + NODE_H / 2}
                                x2={b.x + NODE_W / 2}
                                y2={b.y + NODE_H / 2}
                            />
                        );
                    })}
                </svg>
                {nodes.map((n) => (
                    <span key={n.id} className={`rm-preview-node ${n.done ? 'is-done' : ''}`} style={{ left: n.x, top: n.y }}>
                        <span className="rm-preview-label">{n.label}</span>
                        <span className="rm-preview-bar"><span style={{ width: `${n.progress}%` }} /></span>
                    </span>
                ))}
                {!nodes.length && <span className="rm-preview-empty">No steps yet</span>}
            </div>
        </Link>
    );
};

const RoadmapCard = ({ roadmap, onRename, onDelete }) => {
    const navigate = useNavigate();
    const progress = roadmapProgress(roadmap.nodes);
    return (
        <article className="rm-card">
            <MiniMap roadmap={roadmap} />
            <div className="rm-card-body">
                <div className="rm-card-head">
                    <div className="rm-card-title-wrap">
                        <h2 className="rm-card-title">
                            <Link to={`/roadmaps/${roadmap._id}`}>{roadmap.skillName}</Link>
                        </h2>
                        {roadmap.updatedAt && <span className="rm-card-meta">Updated {formatDueDate(roadmap.updatedAt)}</span>}
                    </div>
                    <Menu
                        label={`Options for ${roadmap.skillName}`}
                        items={[
                            { label: 'Open roadmap', icon: <ExternalLink size={16} />, onSelect: () => navigate(`/roadmaps/${roadmap._id}`) },
                            { label: 'Rename', icon: <Pencil size={16} />, onSelect: () => onRename(roadmap) },
                            { label: 'Delete', icon: <Trash2 size={16} />, danger: true, onSelect: () => onDelete(roadmap) },
                        ]}
                    />
                </div>
                <dl className="rm-stats">
                    <div><dt>Tasks</dt><dd className="tabular">{roadmap.nodes?.length || 0}</dd></div>
                    <div><dt>Links</dt><dd className="tabular">{roadmap.edges?.length || 0}</dd></div>
                    <div><dt>Complete</dt><dd className="tabular">{progress}%</dd></div>
                </dl>
                <div className="progress" role="img" aria-label={`${progress} percent complete`}>
                    <span style={{ width: `${progress}%` }} />
                </div>
                <div className="rm-hint">
                    <Info size={16} aria-hidden="true" />
                    <span>{roadmapHint(roadmap)}</span>
                </div>
                <Link to={`/roadmaps/${roadmap._id}`} className="rm-open">
                    Open roadmap <ArrowRight size={16} aria-hidden="true" />
                </Link>
            </div>
        </article>
    );
};

const RoadmapList = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { list, loading, error } = useSelector((s) => s.roadmaps);
    const [modal, setModal] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        dispatch(fetchUserRoadmaps());
    }, [dispatch]);

    const submit = async ({ skillName }) => {
        setSubmitting(true);
        try {
            if (modal.roadmap) {
                await dispatch(updateRoadmapMeta({ id: modal.roadmap._id, skillName })).unwrap();
                toast.success('Roadmap renamed');
                setModal(null);
            } else {
                const created = await dispatch(createRoadmap({ skillName, nodes: [], edges: [], zoom: 1, pan: { x: 0, y: 0 } })).unwrap();
                setModal(null);
                navigate(`/roadmaps/${created._id}`);
            }
        } catch {
            toast.error('Could not save the roadmap');
        } finally {
            setSubmitting(false);
        }
    };

    const remove = async (roadmap) => {
        if (!window.confirm(`Delete "${roadmap.skillName}"? Its tasks stay on your Tasks page.`)) return;
        try {
            await dispatch(deleteRoadmap(roadmap._id)).unwrap();
            toast.success('Roadmap deleted');
        } catch {
            toast.error('Could not delete the roadmap');
        }
    };

    const roadmaps = list || [];

    return (
        <div className="page">
            <div className="page-inner">
                <PageHeader
                    alignEnd
                    title="Skill roadmaps"
                    subtitle="Map a learning path out of your tasks and watch it fill in as you finish them."
                    actions={(
                        <button type="button" className="btn btn-primary" onClick={() => setModal({})}>
                            <Plus size={16} strokeWidth={2.4} aria-hidden="true" /> New roadmap
                        </button>
                    )}
                />

                {error && !roadmaps.length ? (
                    <EmptyState
                        icon={<Route size={20} />}
                        title="Couldn't load your roadmaps"
                        help="Check your connection and try again."
                        action={<button type="button" className="btn" onClick={() => dispatch(fetchUserRoadmaps())}>Try again</button>}
                    />
                ) : loading && !roadmaps.length ? (
                    <div className="rm-grid" aria-busy="true">
                        {[0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 440, borderRadius: 16 }} />)}
                    </div>
                ) : (
                    <div className="rm-grid">
                        {roadmaps.map((r) => (
                            <RoadmapCard key={r._id} roadmap={r} onRename={(rm) => setModal({ roadmap: rm })} onDelete={remove} />
                        ))}
                        <button type="button" className="rm-new-tile" onClick={() => setModal({})}>
                            <span className="rm-new-icon" aria-hidden="true"><Plus size={20} strokeWidth={2.4} /></span>
                            <span className="rm-new-title">New roadmap</span>
                            <span className="rm-new-help">Start from a skill you want to learn, then add tasks as steps</span>
                        </button>
                    </div>
                )}
            </div>

            <CreateRoadmap
                isOpen={Boolean(modal)}
                initialData={modal?.roadmap}
                loading={submitting}
                onSubmit={submit}
                onClose={() => setModal(null)}
            />
        </div>
    );
};

export default RoadmapList;
