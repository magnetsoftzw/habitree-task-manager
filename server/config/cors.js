const PRODUCTION_ORIGIN = 'https://habitree.vercel.app';

const allowedOrigins = () => [
    PRODUCTION_ORIGIN,
    ...(process.env.FRONTEND_URL || '').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean),
];

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

const isAllowedOrigin = (origin) => !origin || allowedOrigins().includes(origin) || LOCAL_ORIGIN.test(origin);

const corsOptions = {
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
};

module.exports = { allowedOrigins, isAllowedOrigin, corsOptions };
