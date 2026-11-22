const { test } = require('node:test');
const assert = require('node:assert/strict');
const Project = require('../models/project');

test('a project loaded with only some fields can still be serialised', () => {
    const partial = Project.hydrate({ _id: '64b7f0c2a1b2c3d4e5f60718', name: 'Board', color: '#123456' });
    assert.equal(partial.toJSON().formattedDate, null);
    const full = Project.hydrate({ _id: '64b7f0c2a1b2c3d4e5f60718', name: 'Board', createdAt: new Date(2026, 10, 22) });
    assert.equal(full.toJSON().formattedDate, '22-11-2026');
});
