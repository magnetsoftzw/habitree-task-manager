const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const noopIo = { to: () => ({ emit: () => {} }) };

const createApp = (io) => {
    const app = express();

    app.use((req, res, next) => { req.io = io || noopIo; next(); });
    app.use(helmet());
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    if (process.env.NODE_ENV === 'development') {
        app.use(morgan('dev'));
    }

    app.get('/', (req, res) => res.send('Habitree API is running...'));

    app.use('/api/auth',          require('./routes/authRoutes'));
    app.use('/api/users',         require('./routes/userRoutes'));
    app.use('/api/tasks',         require('./routes/taskRoutes'));
    app.use('/api/projects',      require('./routes/projectRoutes'));
    app.use('/api/roadmaps',      require('./routes/roadmapRoutes'));
    app.use('/api/groups',        require('./routes/groupRoutes'));
    app.use('/api/sessions',      require('./routes/sessionRoutes'));
    app.use('/api/planner',       require('./routes/plannerRoutes'));
    app.use('/api/stats',         require('./routes/statsRoutes'));
    app.use('/api/notifications', require('./routes/notificationRoutes'));
    app.use('/api/youtube',       require('./routes/youtubeRoutes'));

    app.use((err, req, res, next) => {
        const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
        res.status(statusCode).json({
            success: false,
            message: err.message,
            stack: process.env.NODE_ENV === 'production' ? null : err.stack,
        });
    });

    return app;
};

module.exports = createApp;
