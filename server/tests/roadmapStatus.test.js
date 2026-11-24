const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret';
const createApp = require('../createApp');

let mongo;
let app;
let token;
const auth = () => ({ Authorization: `Bearer ${token}` });

before(async () => {
    mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 120000 } });
    await mongoose.connect(mongo.getUri());
    app = createApp();
    token = (await request(app).post('/api/auth/register').send({ username: 'learner', email: 'learner@example.com', password: 'secret123' })).body.token;
});

after(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
});

test('roadmap links never lock a task and status changes reach the roadmap', async () => {
    const first = (await request(app).post('/api/tasks').set(auth()).send({ title: 'Basics' })).body._id;
    const second = (await request(app).post('/api/tasks').set(auth()).send({ title: 'Advanced' })).body._id;
    const roadmapId = (await request(app).post('/api/roadmaps').set(auth()).send({ skillName: 'Skill' })).body.roadmap._id;

    const nodes = [first, second].map((id, i) => ({ id, position: { x: 0, y: i * 200 }, data: { label: 'stale', status: 'Not Started', progress: 0 } }));
    const edges = [{ id: 'e1', source: first, target: second, sourceHandle: 'right', targetHandle: 'left' }];
    const saved = await request(app).put(`/api/roadmaps/${roadmapId}`).set(auth()).send({ nodes, edges });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.roadmap.nodes[0].data.label, 'Basics');
    assert.equal(saved.body.roadmap.edges[0].sourceHandle, 'right');
    assert.equal(saved.body.roadmap.edges[0].targetHandle, 'left');

    const done = await request(app).patch(`/api/tasks/${second}/status`).set(auth()).send({ status: 'Completed' });
    assert.equal(done.status, 200);
    assert.equal(done.body.task.status, 'Completed');

    const list = (await request(app).get('/api/roadmaps').set(auth())).body.roadmaps[0];
    const node = list.nodes.find((n) => n.id === second);
    assert.equal(node.data.status, 'Completed');
    assert.equal(node.data.progress, 100);

    const stale = await request(app).put(`/api/roadmaps/${roadmapId}`).set(auth()).send({ nodes, edges });
    assert.equal(stale.body.roadmap.nodes.find((n) => n.id === second).data.status, 'Completed');

    const bad = await request(app).put(`/api/roadmaps/${roadmapId}`).set(auth()).send({ nodes, edges: [{ ...edges[0], sourceHandle: 'middle' }] });
    assert.equal(bad.body.roadmap.edges[0].sourceHandle, null);

    assert.equal((await request(app).patch(`/api/tasks/${first}/status`).set(auth()).send({ status: 'Bogus' })).status, 400);
});
