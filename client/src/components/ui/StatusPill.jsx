import { statusInfo } from '../../utils/Status';

const StatusPill = ({ status, label, tone }) => {
    const info = statusInfo(status);
    return <span className={`pill pill-${tone || info.tone}`}>{label || info.label}</span>;
};

export default StatusPill;
