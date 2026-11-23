const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret';
const createApp = require('../createApp');
const Session = require('../models/session');

let mongo;
let app;
const tokens = {};
const auth = (who) => ({ Authorization: `Bearer ${tokens[who]}` });

before(async () => {
    mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 120000 } });
    await mongoose.connect(mongo.getUri());
    app = createApp();
    for (const who of ['owner', 'stranger']) {
        tokens[who] = (await request(app).post('/api/auth/register').send({ username: who, email: `${who}@example.com`, password: 'secret123' })).body.token;
    }
});

after(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
});

test('a project task group can be planned, tracked, rolled over and removed', async () => {
    const projectId = (await request(app).post('/api/projects').set(auth('owner')).send({ name: 'Habitree' })).body.project._id;
    const groupId = (await request(app).post(`/api/projects/${projectId}/task-groups`).set(auth('owner')).send({ name: 'Release' })).body.group._id;
    const tasks = `/api/projects/${projectId}/tasks`;
    const a = (await request(app).post(tasks).set(auth('owner')).send({ title: 'Build', groupId })).body.task._id;
    const b = (await request(app).post(tasks).set(auth('owner')).send({ title: 'Ship', groupId })).body.task._id;

    const entry = { taskType: 'projectTaskGroup', taskId: groupId, projectId, time: '09:00', duration: 60, subtaskId: 'ignored' };
    assert.equal((await request(app).post('/api/planner/2026-12-01/add').set(auth('stranger')).send(entry)).status, 404);
    assert.equal((await request(app).post('/api/planner/2026-12-01/add').set(auth('owner')).send({ ...entry, projectId: undefined })).status, 400);
    const wrongProject = (await request(app).post('/api/projects').set(auth('owner')).send({ name: 'Other' })).body.project._id;
    assert.equal((await request(app).post('/api/planner/2026-12-01/add').set(auth('owner')).send({ ...entry, projectId: wrongProject })).status, 404);

    const added = await request(app).post('/api/planner/2026-12-01/add').set(auth('owner')).send(entry);
    assert.equal(added.status, 201);
    await request(app).post('/api/planner/2026-12-01/add').set(auth('owner')).send(entry);
    assert.equal(added.body.tasks.length, 1);
    const planned = (await request(app).get('/api/planner/2026-12-01').set(auth('owner'))).body.tasks;
    assert.equal(planned.length, 1, 'adding the same group twice keeps one entry');
    const [row] = planned;
    assert.equal(row.taskType, 'projectTaskGroup');
    assert.equal(row.subtaskId, null);
    assert.equal(row.taskId.isGroup, true);
    assert.equal(row.taskId.title, 'Release - Habitree');
    assert.equal(row.taskId.status, 'Not Started');
    assert.deepEqual(row.taskId.tasks.map((t) => t.title), ['Build', 'Ship']);
    assert.equal(row.taskId.projectId.name, 'Habitree');

    await request(app).patch(`${tasks}/${a}`).set(auth('owner')).send({ status: 'done' });
    const partial = (await request(app).get('/api/planner/2026-12-01').set(auth('owner'))).body.tasks[0].taskId;
    assert.equal(partial.status, 'On-Going');
    assert.equal(partial.doneCount, 1);
    assert.equal(partial.taskCount, 2);

    const rolled = await request(app).post('/api/planner/rollover').set(auth('owner')).send({ date: '2026-12-02' });
    assert.equal(rolled.body.moved, 1, 'an unfinished group rolls over');

    await request(app).patch(`${tasks}/${b}`).set(auth('owner')).send({ status: 'done' });
    const day2 = (await request(app).get('/api/planner/2026-12-02').set(auth('owner'))).body.tasks[0].taskId;
    assert.equal(day2.status, 'Completed');
    assert.equal((await request(app).post('/api/planner/rollover').set(auth('owner')).send({ date: '2026-12-03' })).body.moved, 0, 'a finished group stays put');

    const saved = await request(app).post('/api/sessions/save').set(auth('owner')).send({
        startTime: '2026-12-02T09:00:00Z', endTime: '2026-12-02T09:25:00Z', durationMinutes: 25, taskType: 'projectTaskGroup', taskId: groupId, projectId,
    });
    assert.ok(saved.status < 300, JSON.stringify(saved.body));
    const session = await Session.findOne({ taskType: 'projectTaskGroup' });
    assert.equal(session.titleSnapshot, 'Release - Habitree');
    assert.equal(String(session.projectId), projectId);

    assert.equal((await request(app).delete(`/api/projects/${projectId}/task-groups/${groupId}`).set(auth('owner'))).status < 300, true);
    const after = (await request(app).get('/api/planner/2026-12-02').set(auth('owner'))).body.tasks;
    assert.equal(after.length, 0, 'deleting the group removes upcoming planner entries');
});
