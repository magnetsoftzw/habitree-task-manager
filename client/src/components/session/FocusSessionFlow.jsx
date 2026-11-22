import { useState } from 'react';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import SessionSettings from '../modals/Session/SessionSettings';
import SessionModal from '../modals/Session/SessionModal';
import { logSession } from '../../store/slices/sessionSlice';

const FocusSessionFlow = ({ isOpen, onClose, onSaved, task }) => {
    const dispatch = useDispatch();
    const [seconds, setSeconds] = useState(0);
    const [running, setRunning] = useState(false);

    const close = () => {
        setRunning(false);
        onClose?.();
    };

    return (
        <>
            <SessionSettings
                isOpen={isOpen && !running}
                taskTitle={task?.title}
                onClose={close}
                onStart={(value) => {
                    setSeconds(value);
                    setRunning(true);
                }}
            />
            <SessionModal
                isOpen={isOpen && running}
                initialSeconds={seconds}
                taskTitle={task?.title}
                onFinish={(data) => {
                    dispatch(logSession(task ? {
                        ...data,
                        taskType: task.taskType || 'task',
                        taskId: task._id,
                        ...(task.projectId && { projectId: task.projectId }),
                        titleSnapshot: task.title,
                    } : data));
                    toast.success(navigator.onLine === false ? "Focus session saved. It'll sync when you're back online." : 'Focus session saved');
                    close();
                    onSaved?.();
                }}
                onClose={close}
            />
        </>
    );
};

export default FocusSessionFlow;
