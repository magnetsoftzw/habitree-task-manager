import { conflictFor } from '../../utils/Schedule';

const TimeHint = ({ segments, time, duration }) => {
    const problem = conflictFor(segments, time, duration);
    if (!problem) return null;
    return <span className="pm-error" role="alert">{problem} Pick a time inside a work period.</span>;
};

export default TimeHint;
