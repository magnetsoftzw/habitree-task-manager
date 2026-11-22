const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret';
const createApp = require('../createApp');
const Task = require('../models/task');
const Session = require('../models/session');

let mongo;
let app;
let token;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const as = (device, extra = {}) => ({ Authorization: `Bearer ${token}`, ...(device && { 'X-Device-Id': device }), ...extra });

before(async () => {
    mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 120000 } });
    await mongoose.connect(mongo.getUri());
    app = createApp();
    token = (await request(app).post('/api/auth/register').send({ username: 'syncer', email: 'sync@example.com', password: 'secret123' })).body.token;
});

after(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
});

test('creates keep client ids and replays with the same key are not applied twice', async () => {
    const _id = new mongoose.Types.ObjectId().toString();
    const headers = as('phone', { 'Idempotency-Key': 'op-1' });
    const first = await request(app).post('/api/tasks').set(headers).send({ _id, title: 'Offline task' });
    assert.equal(first.status, 201);
    assert.equal(first.body._id, _id);
    const replay = await request(app).post('/api/tasks').set(headers).send({ _id, title: 'Offline task' });
    assert.equal(replay.status, 201);
    assert.equal(replay.body._id, _id);
    assert.equal(await Task.countDocuments({ title: 'Offline task' }), 1);

    await request(app).post('/api/sessions/save').set(as('phone', { 'Idempotency-Key': 'op-2' }))
        .send({ startTime: '2026-11-22T08:00:00Z', endTime: '2026-11-22T08:20:00Z', durationMinutes: 20 });
    await request(app).post('/api/sessions/save').set(as('phone', { 'Idempotency-Key': 'op-2' }))
        .send({ startTime: '2026-11-22T08:00:00Z', endTime: '2026-11-22T08:20:00Z', durationMinutes: 20 });
    assert.equal(await Session.countDocuments(), 1);
});

test('change feed lists what other devices changed', async () => {
    const since = new Date(Date.now() - 1000).toISOString();
    await request(app).post('/api/groups').set(as('web')).send({ name: 'Work' });
    await wait(150);
    const phone = await request(app).get(`/api/sync/changes?since=${since}`).set(as('phone'));
    assert.equal(phone.body.full, false);
    assert.ok(phone.body.kinds.includes('groups'));
    assert.ok(!phone.body.kinds.includes('sessions'), 'own changes are left out');
    const web = await request(app).get(`/api/sync/changes?since=${since}`).set(as('web'));
    assert.ok(!web.body.kinds.includes('groups'));
    assert.equal((await request(app).get('/api/sync/changes').set(as('phone'))).body.full, true);
});

test('an older edit loses to a newer edit made on another device', async () => {
    const task = (await request(app).post('/api/tasks').set(as('phone')).send({ title: 'Shared' })).body;
    const phoneEditedAt = new Date().toISOString();
    await wait(50);
    await request(app).put(`/api/tasks/${task._id}`).set(as('web')).send({ title: 'Web title' });
    await wait(150);

    const clock = { 'X-Edited-At': phoneEditedAt, 'X-Client-Time': new Date().toISOString() };
    const stale = await request(app).put(`/api/tasks/${task._id}`).set(as('phone', clock)).send({ title: 'Phone title' });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.stale, true);
    assert.equal((await Task.findById(task._id)).title, 'Web title');

    const fresh = await request(app).put(`/api/tasks/${task._id}`)
        .set(as('phone', { 'X-Edited-At': new Date().toISOString(), 'X-Client-Time': new Date().toISOString() })).send({ title: 'Phone wins' });
    assert.equal(fresh.status, 200);

    const skewed = new Date(Date.now() + 3600000);
    await wait(50);
    const ahead = await request(app).put(`/api/tasks/${task._id}`)
        .set(as('phone', { 'X-Edited-At': skewed.toISOString(), 'X-Client-Time': skewed.toISOString() })).send({ title: 'Clock ahead' });
    assert.equal(ahead.status, 200, 'a fast phone clock is corrected using X-Client-Time');
    const ownFollowUp = await request(app).put(`/api/tasks/${task._id}`).set(as('phone', { 'X-Edited-At': phoneEditedAt, 'X-Client-Time': new Date().toISOString() })).send({ title: 'Own older edit' });
    assert.equal(ownFollowUp.status, 409, 'the web edit still beats an edit made before it');
});

test('session save is idempotent by clientId', async () => {
    const before = await Session.countDocuments();
    const body = { startTime: '2026-11-22T09:00:00Z', endTime: '2026-11-22T09:20:00Z', durationMinutes: 20, clientId: 'web-abc' };
    const first = await request(app).post('/api/sessions/save').set(as('web')).send(body);
    assert.equal(first.status, 201);
    const again = await request(app).post('/api/sessions/save').set(as('web')).send(body);
    assert.equal(again.status, 200);
    assert.equal(again.body.duplicate, true);
    assert.equal(again.body.session._id, first.body.session._id);
    assert.equal((await request(app).post('/api/sessions/save').set(as('web')).send({ ...body, clientId: undefined })).status, 201);
    assert.equal(await Session.countDocuments(), before + 2);
});
