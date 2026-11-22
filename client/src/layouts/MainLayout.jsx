import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { logout } from '../store/slices/authSlice';
import { fetchCurrentUser } from '../store/slices/userSlice';
import { fetchProjects } from '../store/slices/projectSlice';
import { fetchUserRoadmaps } from '../store/slices/roadmapSlice';
import { fetchInventoryTasks } from '../store/slices/taskSlice';
import Sidebar from '../components/layout/Sidebar';
import './MainLayout.css';

const REDESIGNED_ROUTES = [/^\/dashboard$/, /^\/tasks$/, /^\/tasks\/[^/]+$/, /^\/projects$/, /^\/projects\/[^/]+$/, /^\/roadmaps$/, /^\/roadmaps\/[^/]+$/, /^\/calendar$/, /^\/analytics$/, /^\/settings$/];

const MainLayout = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const isLegacy = !REDESIGNED_ROUTES.some((re) => re.test(pathname));

    const { profile } = useSelector((state) => state.user);
    const projects = useSelector((state) => state.projects.items);
    const roadmaps = useSelector((state) => state.roadmaps.list);
    const inventory = useSelector((state) => state.tasks.inventory);

    useEffect(() => {
        dispatch(fetchCurrentUser());
        dispatch(fetchProjects());
        dispatch(fetchUserRoadmaps());
        dispatch(fetchInventoryTasks());
    }, [dispatch]);

    const counts = useMemo(() => ({
        tasks: Object.values(inventory || {}).reduce((sum, list) => sum + (list?.length || 0), 0),
        projects: projects?.length || 0,
        roadmaps: roadmaps?.length || 0,
    }), [inventory, projects, roadmaps]);

    const handleLogout = () => {
        dispatch(logout());
        navigate('/login');
    };

    return (
        <div className="app-shell">
            <Sidebar user={profile} counts={counts} projects={projects || []} onLogout={handleLogout} />
            <main className={`app-main ${isLegacy ? 'is-legacy' : ''}`} id="main">
                <Outlet />
            </main>
        </div>
    );
};

export default MainLayout;
