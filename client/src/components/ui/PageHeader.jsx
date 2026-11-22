const PageHeader = ({ overline, title, subtitle, actions, alignEnd = false }) => (
    <header className={`page-header ${alignEnd ? 'align-end' : ''}`}>
        <div className="page-header-text">
            {overline && <span className="page-overline">{overline}</span>}
            <h1 className="page-title">{title}</h1>
            {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
    </header>
);

export default PageHeader;
