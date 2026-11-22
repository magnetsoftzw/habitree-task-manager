import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { getSocket } from '../api/SocketClient';
import { fetchProjectTasks, fetchTaskGroups, projectTaskEvent, projectTaskGroupEvent } from '../store/slices/projectTasksSlice';
import { fetchSingleProject } from '../store/slices/projectSlice';

const EVENTS = ['created', 'updated', 'deleted', 'reordered'];
const GROUP_EVENTS = ['created', 'updated', 'deleted'];

const useProjectRoom = (projectId) => {
    const dispatch = useDispatch();

    useEffect(() => {
        const socket = getSocket();
        if (!socket || !projectId) return undefined;

        const join = () => socket.emit('joinProject', projectId);
        let hasConnected = socket.connected;
        const onConnect = () => {
            join();
            if (hasConnected) {
                dispatch(fetchProjectTasks(projectId));
                dispatch(fetchTaskGroups(projectId));
                dispatch(fetchSingleProject(projectId));
            }
            hasConnected = true;
        };

        const handlers = EVENTS.map((type) => {
            const handler = (payload) => {
                if (String(payload?.projectId) !== String(projectId)) return;
                dispatch(projectTaskEvent({ type, projectId, ...payload }));
            };
            socket.on(`projectTask:${type}`, handler);
            return [`projectTask:${type}`, handler];
        });

        GROUP_EVENTS.forEach((type) => {
            const handler = (payload) => {
                if (String(payload?.projectId) !== String(projectId)) return;
                dispatch(projectTaskGroupEvent({ type, projectId, ...payload }));
                if (type === 'deleted') dispatch(fetchProjectTasks(projectId));
            };
            socket.on(`projectTaskGroup:${type}`, handler);
            handlers.push([`projectTaskGroup:${type}`, handler]);
        });

        const onBoardChange = () => dispatch(fetchSingleProject(projectId));
        socket.on('taskMoved', onBoardChange);
        socket.on('connect', onConnect);
        if (socket.connected) join();

        return () => {
            handlers.forEach(([event, handler]) => socket.off(event, handler));
            socket.off('taskMoved', onBoardChange);
            socket.off('connect', onConnect);
            socket.emit('leaveProject', projectId);
        };
    }, [dispatch, projectId]);
};

export default useProjectRoom;
