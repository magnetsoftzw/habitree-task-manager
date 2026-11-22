const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret';
const createApp = require('../app');
const Task = require('../models/task');
const ProjectTask = require('../models/projectTask');

let mongo;
let app;
let token;
const auth = () => ({ Authorization: `Bearer ${token}` });
const DATE = '2026-12-01';

before(async () => {
    mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 120000 } });
    await mongoose.connect(mongo.getUri());
    app = createApp();
    const res = await request(app).post('/api/auth/register')
        .send({ username: 'planner', email: 'planner@example.com', password: 'secret123' });
    token = res.body.token;
});

after(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
});

const seg = (segments, key) => segments.find((s) => s.key === key);

describe('daily schedule', () => {
    let task;
    let parent;
    let projectId;
    let listTask;

    test('template is created with the defaults and labels can be edited', async () => {
        const res = await request(app).get('/api/schedule/template').set(auth());
        assert.equal(res.status, 200);
        assert.equal(res.body.template.segments.length, 11);
        assert.equal(seg(res.body.template.segments, 'wake').label, 'WAKE');

        const renamed = await request(app).patch('/api/schedule/template/segments/lunch').set(auth()).send({ label: '  Gym  ' });
        assert.equal(seg(renamed.body.template.segments, 'lunch').label, 'Gym');
        assert.equal((await request(app).patch('/api/schedule/template/segments/lunch').set(auth()).send({ color: '#123456' })).status, 400);
        assert.equal((await request(app).patch('/api/schedule/template/segments/wp1').set(auth()).send({ color: 'red' })).status, 400);
        await request(app).patch('/api/schedule/template/segments/lunch').set(auth()).send({ label: 'Lunch' });

        const day = await request(app).get(`/api/schedule/${DATE}`).set(auth());
        assert.equal(day.body.isOverride, false);
        assert.equal(seg(day.body.segments, 'rest').end, 1680);
    });

    test('planner rejects entries that overlap personal time, checking the full duration', async () => {
        task = (await request(app).post('/api/tasks').set(auth()).send({ title: 'Write report' })).body.task
            || (await Task.findOne({ title: 'Write report' })).toObject();
        const bad = await request(app).post(`/api/planner/${DATE}/add`).set(auth())
            .send({ taskId: task._id, time: '09:30', duration: 60 });
        assert.equal(bad.status, 400);
        assert.equal(bad.body.field, 'time');
        assert.match(bad.body.message, /Brunch/);

        const ok = await request(app).post(`/api/planner/${DATE}/add`).set(auth())
            .send({ taskId: task._id, time: '18:00', duration: 60 });
        assert.equal(ok.status, 201);
        const entryId = ok.body.tasks[0]._id;
        const moved = await request(app).patch(`/api/planner/${DATE}/${entryId}`).set(auth()).send({ duration: 90 });
        assert.equal(moved.status, 400, 'a longer duration runs into Rest');
        assert.equal((await request(app).patch(`/api/planner/${DATE}/${entryId}`).set(auth()).send({ comments: 'hi' })).status, 200);
    });

    test('moving the final period later needs confirmation, then shortens Rest only for that day', async () => {
        const url = `/api/schedule/${DATE}/shift`;
        const ask = await request(app).post(url).set(auth()).send({ segmentKey: 'wp5', offsetMinutes: 60 });
        assert.equal(ask.status, 409);
        assert.equal(ask.body.requiresConfirmation, true);
        assert.equal(ask.body.preview.restLostMinutes, 60);
        assert.equal((await request(app).get(`/api/schedule/${DATE}`).set(auth())).body.isOverride, false, 'nothing applied');

        const done = await request(app).post(url).set(auth()).send({ segmentKey: 'wp5', offsetMinutes: 60, confirm: true });
        assert.equal(done.status, 200);
        assert.equal(seg(done.body.schedule.segments, 'rest').start, 1200);
        assert.equal(done.body.planner.tasks[0].time, '19:00', 'the task moved with its period');

        const next = await request(app).get('/api/schedule/2026-12-02').set(auth());
        assert.equal(seg(next.body.segments, 'rest').start, 1140, 'the next day keeps the template');
        const template = await request(app).get('/api/schedule/template').set(auth());
        assert.equal(seg(template.body.template.segments, 'wp5').start, 1020, 'template untouched');
    });

    test('cascading shift removes entries that no longer fit and shelves only those items', async () => {
        const date = '2026-12-03';
        parent = (await Task.create({ userId: (await Task.findById(task._id)).userId, title: 'Parent', subtasks: [{ title: 'Step one' }, { title: 'Step two' }] })).toObject();
        const project = await request(app).post('/api/projects').set(auth()).send({ name: 'Shelf test' });
        projectId = project.body.project._id;
        listTask = (await request(app).post(`/api/projects/${projectId}/tasks`).set(auth()).send({ title: 'List task' })).body.task;
        const withSub = (await request(app).post(`/api/projects/${projectId}/tasks/${listTask._id}/subtasks`).set(auth()).send({ title: 'List step' })).body.task;
        const listSub = withSub.subtasks[0];

        const add = (body) => request(app).post(`/api/planner/${date}/add`).set(auth()).send(body);
        assert.equal((await add({ taskId: parent._id, time: '18:00', duration: 60 })).status, 201);
        assert.equal((await add({ taskId: parent._id, subtaskId: String(parent.subtasks[0]._id), time: '18:00', duration: 30 })).status, 201);
        assert.equal((await add({ taskType: 'projectTask', projectId, taskId: listTask._id, time: '17:30', duration: 30 })).status, 201);
        assert.equal((await add({ taskType: 'projectTask', projectId, taskId: listTask._id, subtaskId: String(listSub._id), time: '18:30', duration: 30 })).status, 201);
        assert.equal((await add({ taskId: task._id, time: '08:00', duration: 30 })).status, 201);

        const url = `/api/schedule/${date}/shift`;
        const ask = await request(app).post(url).set(auth()).send({ segmentKey: 'wp2', offsetMinutes: 60 });
        assert.equal(ask.status, 409);
        assert.equal(ask.body.preview.removed.length, 3);
        assert.ok(ask.body.preview.removed.some((r) => r.title === 'Step one' && r.parentTitle === 'Parent'));

        const done = await request(app).post(url).set(auth()).send({ segmentKey: 'wp2', offsetMinutes: 60, confirm: true });
        assert.equal(done.status, 200);
        assert.equal(seg(done.body.schedule.segments, 'wp5').end, 1140, 'final period absorbs the shift');
        const times = done.body.planner.tasks.map((e) => e.time).sort();
        assert.deepEqual(times, ['09:00', '18:30'], 'survivors moved by the same offset');

        const p = await Task.findById(parent._id);
        assert.equal(p.status, 'Shelved', 'parent shelved');
        assert.equal(p.subtasks[0].status, 'Shelved', 'its scheduled subtask shelved');
        assert.equal(p.subtasks[1].status, 'Not Started', 'unscheduled subtask untouched');
        const lt = await ProjectTask.findById(listTask._id);
        assert.equal(lt.status, 'not_started', 'list task entry survived (17:30 → 18:30)');
        assert.equal(lt.subtasks[0].shelved, true, 'its subtask entry was removed and shelved');
        assert.equal((await Task.findById(task._id)).status, 'Not Started');
    });

    test('resetting a day is refused while entries sit outside the template work periods', async () => {
        const res = await request(app).delete('/api/schedule/2026-12-01').set(auth());
        assert.equal(res.status, 409, 'the 19:00 task is outside the default 5–7 PM period');
        assert.equal(res.body.entries[0].title, 'Write report');
        assert.equal((await request(app).delete('/api/schedule/2026-12-03').set(auth())).status, 200, 'survivors fit the template');
        await request(app).delete(`/api/planner/2026-12-01/${(await request(app).get('/api/planner/2026-12-01').set(auth())).body.tasks[0]._id}`).set(auth());
        const ok = await request(app).delete('/api/schedule/2026-12-01').set(auth());
        assert.equal(ok.status, 200);
        assert.equal(ok.body.schedule.isOverride, false);
    });

    test('project progress ignores shelved tasks as done, and shelved is a valid status', async () => {
        const res = await request(app).patch(`/api/projects/${projectId}/tasks/${listTask._id}`).set(auth()).send({ status: 'shelved' });
        assert.equal(res.status, 200);
        const project = await request(app).get(`/api/projects/${projectId}`).set(auth());
        assert.equal(project.body.project?.progress ?? project.body.progress, 0);
    });
});

describe('resizing segments', () => {
    const DAY2 = '2026-12-05';
    test('resize follows the shift response contract', async () => {
        const url = `/api/schedule/${DAY2}/resize`;
        const t = (await request(app).post('/api/tasks').set(auth()).send({ title: 'Resize me' })).body.task
            || (await Task.findOne({ title: 'Resize me' })).toObject();
        await request(app).post(`/api/planner/${DAY2}/add`).set(auth()).send({ taskId: t._id, time: '09:30', duration: 30 });

        const bad = await request(app).post(url).set(auth()).send({ segmentKey: 'wake', edge: 'start', offsetMinutes: -5 });
        assert.equal(bad.status, 400);
        assert.equal(bad.body.field, 'edge');

        const dry = await request(app).post(url).set(auth()).send({ segmentKey: 'wp2', edge: 'end', offsetMinutes: -60, dryRun: true });
        assert.equal(dry.status, 200);
        assert.equal(dry.body.preview.removed[0].title, 'Resize me');

        const ask = await request(app).post(url).set(auth()).send({ segmentKey: 'wp2', edge: 'end', offsetMinutes: -60 });
        assert.equal(ask.status, 409);
        assert.equal(ask.body.requiresConfirmation, true);

        const done = await request(app).post(url).set(auth()).send({ segmentKey: 'wp2', edge: 'end', offsetMinutes: -60, confirm: true });
        assert.equal(done.status, 200);
        assert.equal(seg(done.body.schedule.segments, 'brunch').start, 540);
        assert.equal(done.body.schedule.isOverride, true);
        assert.equal(done.body.planner.tasks.length, 0);
        assert.equal((await Task.findById(t._id)).status, 'Shelved');

        const grow = await request(app).post(url).set(auth()).send({ segmentKey: 'wp2', edge: 'start', offsetMinutes: -30 });
        assert.equal(grow.status, 200, 'no confirmation when nothing is lost');
        assert.equal(seg(grow.body.schedule.segments, 'breakfast').end, 450);
    });
});

describe('template times', () => {
    test('template times move one boundary, snapshot past days and count affected blocks', async () => {
        const url = '/api/schedule/template/segments/wp2';
        const t = (await request(app).post('/api/tasks').set(auth()).send({ title: 'Template check' })).body.task
            || (await Task.findOne({ title: 'Template check' })).toObject();
        await request(app).post('/api/planner/2026-11-28/add').set(auth()).send({ taskId: t._id, time: '08:00', duration: 30 });
        await request(app).post('/api/planner/2027-01-10/add').set(auth()).send({ taskId: t._id, time: '09:00', duration: 60 });

        const dry = await request(app).patch(url).set(auth()).send({ end: 630, dryRun: true, today: '2026-12-02' });
        assert.equal(dry.status, 200);
        assert.equal(seg(dry.body.preview.segments, 'brunch').start, 630);
        assert.equal(seg(dry.body.preview.segments, 'wp3').start, 660, 'nothing else moves');
        assert.equal(dry.body.preview.affected, 0);
        assert.equal(seg((await request(app).get('/api/schedule/template').set(auth())).body.template.segments, 'wp2').end, 600, 'dry run saves nothing');

        const early = await request(app).patch(url).set(auth()).send({ start: 300 });
        assert.equal(early.body.field, 'start');
        assert.match(early.body.message, /at most 55 minutes earlier/);
        assert.equal((await request(app).patch('/api/schedule/template/segments/wake').set(auth()).send({ start: 250 })).body.field, 'start');
        assert.equal((await request(app).patch('/api/schedule/template/segments/rest').set(auth()).send({ end: 1690 })).body.field, 'end');
        assert.match((await request(app).patch('/api/schedule/template/segments/wp5').set(auth()).send({ end: 1450 })).body.message, /midnight/);

        const saved = await request(app).patch(url).set(auth()).send({ start: 450, end: 570, today: '2026-12-02' });
        assert.equal(saved.status, 200);
        assert.equal(saved.body.affected, 1);
        const s2 = saved.body.template.segments;
        assert.deepEqual([seg(s2, 'breakfast').end, seg(s2, 'wp2').start, seg(s2, 'wp2').end, seg(s2, 'brunch').start, seg(s2, 'brunch').end], [450, 450, 570, 570, 660]);

        const past = await request(app).get('/api/schedule/2026-11-28').set(auth());
        assert.equal(past.body.isOverride, true);
        assert.equal(seg(past.body.segments, 'wp2').start, 480, 'past days keep the old times');
        const future = await request(app).get('/api/schedule/2027-01-10').set(auth());
        assert.equal(seg(future.body.segments, 'wp2').start, 450);

        const back = await request(app).patch(url).set(auth()).send({ start: 480, end: 600 });
        assert.equal(seg(back.body.template.segments, 'brunch').start, 600, 'changes are reversible');
    });
});
