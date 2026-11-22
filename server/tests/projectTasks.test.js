const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret';
const createApp = require('../app');
const Planner = require('../models/planner');
const Session = require('../models/session');
const ProjectTask = require('../models/projectTask');
const ProjectTaskGroup = require('../models/projectTaskGroup');

let mongo;
let app;
const users = {};

const auth = (who) => ({ Authorization: `Bearer ${users[who].token}` });

const register = async (name) => {
    const res = await request(app).post('/api/auth/register')
        .send({ username: name, email: `${name}@example.com`, password: 'secret123' });
    assert.equal(res.status, 201);
    assert.ok(res.body.user, 'register returns a nested user');
    users[name] = { token: res.body.token, id: res.body._id };
};

before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    app = createApp();
    await register('owner');
    await register('stranger');
});

after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
});

describe('project task lists', () => {
    let projectId;
    let taskA;
    let taskB;

    test('create a project and see both counts on the list', async () => {
        const res = await request(app).post('/api/projects').set(auth('owner')).send({ name: 'Habitree' });
        assert.equal(res.status, 201);
        projectId = res.body.project._id;
        assert.ok(res.body.project.color);

        const list = await request(app).get('/api/projects').set(auth('owner'));
        assert.equal(list.body.projects[0].boardCardCount, 0);
        assert.equal(list.body.projects[0].openTaskCount, 0);
    });

    test('POST creates tasks appended to the end', async () => {
        const a = await request(app).post(`/api/projects/${projectId}/tasks`).set(auth('owner')).send({ title: '  Write spec  ' });
        assert.equal(a.status, 201);
        assert.equal(a.body.task.title, 'Write spec');
        assert.equal(a.body.task.status, 'not_started');
        taskA = a.body.task._id;

        const b = await request(app).post(`/api/projects/${projectId}/tasks`).set(auth('owner')).send({ title: 'Ship APK', dueDate: '2026-12-04' });
        taskB = b.body.task._id;
        assert.ok(b.body.task.order > a.body.task.order);
    });

    test('POST rejects a missing, blank or over-long title and an unknown status', async () => {
        for (const body of [{}, { title: '   ' }, { title: 'x'.repeat(201) }, { title: 'ok', status: 'later' }]) {
            const res = await request(app).post(`/api/projects/${projectId}/tasks`).set(auth('owner')).send(body);
            assert.equal(res.status, 400);
            assert.ok(res.body.field);
        }
    });

    test("another user's project returns 404 on every route", async () => {
        const base = `/api/projects/${projectId}/tasks`;
        const s = auth('stranger');
        assert.equal((await request(app).get(base).set(s)).status, 404);
        assert.equal((await request(app).post(base).set(s).send({ title: 'x' })).status, 404);
        assert.equal((await request(app).patch(`${base}/${taskA}`).set(s).send({ title: 'x' })).status, 404);
        assert.equal((await request(app).delete(`${base}/${taskA}`).set(s)).status, 404);
        assert.equal((await request(app).put(`${base}/order`).set(s).send({ taskIds: [taskB, taskA] })).status, 404);
        assert.equal((await request(app).post(`${base}/${taskA}/subtasks`).set(s).send({ title: 'x' })).status, 404);
    });

    test('PATCH updates fields and manages completedAt', async () => {
        const done = await request(app).patch(`/api/projects/${projectId}/tasks/${taskA}`).set(auth('owner')).send({ status: 'done', notes: 'n' });
        assert.equal(done.status, 200);
        assert.ok(done.body.task.completedAt);

        const back = await request(app).patch(`/api/projects/${projectId}/tasks/${taskA}`).set(auth('owner')).send({ status: 'not_started' });
        assert.equal(back.body.task.completedAt, null);

        const bad = await request(app).patch(`/api/projects/${projectId}/tasks/${taskA}`).set(auth('owner')).send({ status: 'nope' });
        assert.equal(bad.status, 400);
    });

    test('GET supports status=open', async () => {
        await request(app).patch(`/api/projects/${projectId}/tasks/${taskB}`).set(auth('owner')).send({ status: 'done' });
        const open = await request(app).get(`/api/projects/${projectId}/tasks?status=open`).set(auth('owner'));
        assert.deepEqual(open.body.tasks.map((t) => t._id), [taskA]);
        const all = await request(app).get(`/api/projects/${projectId}/tasks`).set(auth('owner'));
        assert.equal(all.body.tasks.length, 2);
    });

    test('PUT order rewrites order and validates the id set', async () => {
        const bad = await request(app).put(`/api/projects/${projectId}/tasks/order`).set(auth('owner')).send({ taskIds: [taskA] });
        assert.equal(bad.status, 400);
        const dup = await request(app).put(`/api/projects/${projectId}/tasks/order`).set(auth('owner')).send({ taskIds: [taskA, taskA] });
        assert.equal(dup.status, 400);

        const ok = await request(app).put(`/api/projects/${projectId}/tasks/order`).set(auth('owner')).send({ taskIds: [taskB, taskA] });
        assert.equal(ok.status, 204);
        const list = await request(app).get(`/api/projects/${projectId}/tasks`).set(auth('owner'));
        assert.deepEqual(list.body.tasks.map((t) => t._id), [taskB, taskA]);
    });

    test('subtasks: create, rename, tick, reorder, delete', async () => {
        const base = `/api/projects/${projectId}/tasks/${taskA}/subtasks`;
        const one = await request(app).post(base).set(auth('owner')).send({ title: 'List events' });
        assert.equal(one.status, 201);
        const two = await request(app).post(base).set(auth('owner')).send({ title: 'Define payloads' });
        const [s1, s2] = two.body.task.subtasks.map((s) => s._id);

        assert.equal((await request(app).post(base).set(auth('owner')).send({ title: '' })).status, 400);

        const renamed = await request(app).patch(`${base}/${s1}`).set(auth('owner')).send({ title: 'List all events', done: true });
        assert.equal(renamed.body.task.subtasks[0].title, 'List all events');
        assert.equal(renamed.body.task.subtasks[0].done, true);
        assert.equal(renamed.body.task.status, 'not_started', 'ticking a subtask never changes the task');

        assert.equal((await request(app).patch(`${base}/${s1}`).set(auth('owner')).send({ done: 'yes' })).status, 400);
        assert.equal((await request(app).put(`${base}/order`).set(auth('owner')).send({ subtaskIds: [s1] })).status, 400);

        const reordered = await request(app).put(`${base}/order`).set(auth('owner')).send({ subtaskIds: [s2, s1] });
        assert.deepEqual(reordered.body.task.subtasks.map((s) => s._id), [s2, s1]);

        const removed = await request(app).delete(`${base}/${s2}`).set(auth('owner'));
        assert.equal(removed.body.task.subtasks.length, 1);
        assert.equal((await request(app).delete(`${base}/${s2}`).set(auth('owner'))).status, 404);
    });

    test('list tasks can be planned and focused on, and count in analytics', async () => {
        const today = new Date().toISOString().split('T')[0];
        const planned = await request(app).post(`/api/planner/${today}/add`).set(auth('owner'))
            .send({ taskType: 'projectTask', taskId: taskA, projectId, time: '10:00', duration: 45 });
        assert.equal(planned.status, 201);
        const entry = planned.body.tasks[0];
        assert.equal(entry.taskType, 'projectTask');
        assert.equal(entry.duration, 45);
        assert.equal(entry.taskId.title, 'Write spec');
        assert.equal(entry.taskId.groupId.name, 'Habitree');

        const missingProject = await request(app).post(`/api/planner/${today}/add`).set(auth('owner'))
            .send({ taskType: 'projectTask', taskId: taskA });
        assert.equal(missingProject.status, 400);
        const foreign = await request(app).post(`/api/planner/${today}/add`).set(auth('stranger'))
            .send({ taskType: 'projectTask', taskId: taskA, projectId });
        assert.equal(foreign.status, 404);

        const start = new Date(Date.now() - 30 * 60000);
        const saved = await request(app).post('/api/sessions/save').set(auth('owner'))
            .send({ startTime: start, endTime: new Date(), durationMinutes: 30, taskType: 'projectTask', taskId: taskA, projectId });
        assert.equal(saved.status, 201);
        assert.equal(saved.body.session.titleSnapshot, 'Write spec');

        const from = new Date(Date.now() - 86400000).toISOString();
        const to = new Date(Date.now() + 86400000).toISOString();
        const stats = await request(app).get(`/api/stats/range?from=${from}&to=${to}`).set(auth('owner'));
        assert.equal(stats.body.totalMinutes, 30);
        const bucket = stats.body.byProject.find((b) => b.name === 'Habitree');
        assert.equal(bucket.minutes, 30);
        assert.equal(bucket.completed, 1, 'taskB was marked done');

        const volume = await request(app).get('/api/stats/tasks').set(auth('owner'));
        assert.equal(volume.body.completedTasks, 1);
    });

    test('board actions never touch list tasks', async () => {
        const card = await request(app).post(`/api/projects/${projectId}/add-task`).set(auth('owner')).send({ columnId: 'todo', title: 'Card' });
        assert.equal(card.status, 201, 'lowercase board columns are valid');
        await request(app).put(`/api/projects/${projectId}/move`).set(auth('owner'))
            .send({ taskId: card.body.task._id, fromColumn: 'todo', toColumn: 'done' });
        const list = await request(app).get(`/api/projects/${projectId}/tasks`).set(auth('owner'));
        assert.equal(list.body.tasks.length, 2);

        const projects = await request(app).get('/api/projects').set(auth('owner'));
        assert.equal(projects.body.projects[0].boardCardCount, 1);
        assert.equal(projects.body.projects[0].openTaskCount, 1);
        assert.equal(projects.body.projects[0].progress, 67, 'done card + done list task over 3 items');

        const stranger = await request(app).post(`/api/projects/${projectId}/add-task`).set(auth('stranger')).send({ columnId: 'todo' });
        assert.equal(stranger.status, 404);
    });

    test('task groups: create in date order, validate, assign, rename, delete', async () => {
        const base = `/api/projects/${projectId}/task-groups`;
        const first = await request(app).post(base).set(auth('owner')).send({ name: '  Release  ' });
        assert.equal(first.status, 201);
        assert.equal(first.body.group.name, 'Release');
        const second = await request(app).post(base).set(auth('owner')).send({ name: 'Docs' });
        assert.equal(second.status, 201);

        assert.equal((await request(app).post(base).set(auth('owner')).send({ name: ' ' })).status, 400);
        assert.equal((await request(app).post(base).set(auth('owner')).send({ name: 'x'.repeat(61) })).status, 400);
        assert.equal((await request(app).get(base).set(auth('stranger'))).status, 404);
        assert.equal((await request(app).post(base).set(auth('stranger')).send({ name: 'Nope' })).status, 404);

        const list = await request(app).get(base).set(auth('owner'));
        assert.deepEqual(list.body.groups.map((g) => g.name), ['Release', 'Docs'], 'oldest first');

        const groupId = first.body.group._id;
        const assigned = await request(app).patch(`/api/projects/${projectId}/tasks/${taskB}`).set(auth('owner')).send({ groupId });
        assert.equal(assigned.status, 200);
        assert.equal(assigned.body.task.groupId, groupId);
        const created = await request(app).post(`/api/projects/${projectId}/tasks`).set(auth('owner')).send({ title: 'In docs', groupId: second.body.group._id });
        assert.equal(created.status, 201);
        assert.equal(created.body.task.groupId, second.body.group._id);

        const bad = await request(app).patch(`/api/projects/${projectId}/tasks/${taskB}`).set(auth('owner')).send({ groupId: new mongoose.Types.ObjectId().toString() });
        assert.equal(bad.status, 400);
        assert.equal(bad.body.field, 'groupId');

        const renamed = await request(app).put(`${base}/${groupId}`).set(auth('owner')).send({ name: 'Launch' });
        assert.equal(renamed.body.group.name, 'Launch');

        assert.equal((await request(app).delete(`${base}/${groupId}`).set(auth('owner'))).status, 204);
        const after = await request(app).get(`/api/projects/${projectId}/tasks`).set(auth('owner'));
        assert.equal(after.body.tasks.find((t) => t._id === taskB).groupId, null, 'tasks fall back to ungrouped');
        await request(app).delete(`/api/projects/${projectId}/tasks/${created.body.task._id}`).set(auth('owner'));
    });

    test('DELETE removes the task and its future planner entries; sessions stay', async () => {
        const res = await request(app).delete(`/api/projects/${projectId}/tasks/${taskA}`).set(auth('owner'));
        assert.equal(res.status, 204);
        const planner = await Planner.findOne({ userId: users.owner.id });
        assert.equal(planner.tasks.length, 0);
        assert.equal(await Session.countDocuments({ taskId: taskA }), 1);
    });

    test('deleting the project deletes its list tasks', async () => {
        const res = await request(app).delete(`/api/projects/${projectId}`).set(auth('owner'));
        assert.equal(res.status, 200);
        assert.equal(await ProjectTask.countDocuments({ projectId }), 0);
        assert.equal(await ProjectTaskGroup.countDocuments({ projectId }), 0);
    });
});
