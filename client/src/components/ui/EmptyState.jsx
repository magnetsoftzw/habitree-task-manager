const EmptyState = ({ icon, title, help, action, stacked = false }) => (
    <div className={`empty-state ${stacked ? 'stacked' : ''}`}>
        {icon && <div className="empty-state-icon" aria-hidden="true">{icon}</div>}
        <div className="empty-state-text">
            <span className="empty-state-title">{title}</span>
            {help && <span className="empty-state-help">{help}</span>}
        </div>
        {action}
    </div>
);

export default EmptyState;
