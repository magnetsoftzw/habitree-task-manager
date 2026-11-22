const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const createApp = require('./createApp');
const { isAllowedOrigin } = require('./config/cors');
const runMigrations = require('./utils/migrations');
const { findAccessibleProject } = require('./utils/projectAccess');

dotenv.config();
connectDB();
mongoose.connection.once('open', () => {
    runMigrations().catch((error) => console.error('Migration failed:', error.message));
});

let io = null;
const relay = { to: (room) => (io ? io.to(room) : { emit: () => {} }) };
const app = express();
app.use(createApp(relay));

const server = http.createServer(app);

io = new Server(server, {
    cors: {
        origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    },
});

io.use((socket, next) => {
    try {
        socket.userId = jwt.verify(socket.handshake.auth?.token, process.env.JWT_SECRET).id;
        next();
    } catch {
        next(new Error('Not authorized'));
    }
});

io.on('connection', (socket) => {
    socket.on('joinProject', async (projectId) => {
        if (!(await findAccessibleProject(projectId, socket.userId))) return;
        socket.join(String(projectId));
    });

    socket.on('leaveProject', (projectId) => socket.leave(String(projectId)));

    socket.on('joinUserRoom', (userId) => {
        if (String(userId) !== String(socket.userId)) return;
        socket.join(String(userId));
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

module.exports = app;
