const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_SEGMENTS, computeResize } = require('../utils/scheduleLogic');

const seg = (segments, key) => segments.find((s) => s.key === key);
const span = (segments, key) => [seg(segments, key).start, seg(segments, key).end];
const entry = (id, time, duration) => ({ _id: id, time, duration });
const contiguous = (segments) => segments.slice(1).forEach((s, i) => assert.equal(s.start, segments[i].end));

test('extending an early end cascades later periods and clips at Rest', () => {
    const entries = [entry('own', '08:00', 60), entry('later', '11:00', 30), entry('late', '18:30', 30)];
    const r = computeResize(DEFAULT_SEGMENTS, entries, 'wp2', 'end', 30);
    assert.deepEqual(span(r.segments, 'wp2'), [480, 630]);
    assert.deepEqual(span(r.segments, 'brunch'), [630, 690]);
    assert.deepEqual(span(r.segments, 'wp5'), [1050, 1140]);
    assert.deepEqual(span(r.segments, 'rest'), [1140, 1680]);
    assert.equal(r.workLostMinutes, 30);
    assert.equal(r.restLostMinutes, 0);
    assert.deepEqual(r.moved.map((m) => [m.entry._id, m.time]), [['later', '11:30']]);
    assert.deepEqual(r.removed.map((e) => e._id), ['late']);
    assert.equal(r.requiresConfirmation, true);
    contiguous(r.segments);
});

test('extending Break or wp5 shortens Rest instead', () => {
    const viaBreak = computeResize(DEFAULT_SEGMENTS, [entry('a', '17:30', 60)], 'break', 'end', 60);
    assert.deepEqual(span(viaBreak.segments, 'wp5'), [1080, 1200]);
    assert.deepEqual(span(viaBreak.segments, 'rest'), [1200, 1680]);
    assert.equal(viaBreak.restLostMinutes, 60);
    assert.equal(viaBreak.moved[0].time, '18:30');
    const viaWp5 = computeResize(DEFAULT_SEGMENTS, [], 'wp5', 'end', 300);
    assert.deepEqual(span(viaWp5.segments, 'rest'), [1440, 1680]);
    assert.match(computeResize(DEFAULT_SEGMENTS, [], 'wp5', 'end', 305).error, /midnight/);
});

test('contracting an end grows only the next segment and shelves what no longer fits', () => {
    const r = computeResize(DEFAULT_SEGMENTS, [entry('a', '08:00', 30), entry('b', '09:30', 30)], 'wp2', 'end', -60);
    assert.deepEqual(span(r.segments, 'wp2'), [480, 540]);
    assert.deepEqual(span(r.segments, 'brunch'), [540, 660]);
    assert.deepEqual(span(r.segments, 'wp3'), [660, 780]);
    assert.deepEqual(r.removed.map((e) => e._id), ['b']);
    assert.equal(r.moved.length, 0);
    assert.match(computeResize(DEFAULT_SEGMENTS, [], 'wp1', 'end', -60).error, /at most 55/);
});

test('start edges trade time with the previous segment', () => {
    const grow = computeResize(DEFAULT_SEGMENTS, [entry('x', '07:30', 30)], 'wp2', 'start', -30);
    assert.deepEqual(span(grow.segments, 'breakfast'), [420, 450]);
    assert.deepEqual(span(grow.segments, 'wp2'), [450, 600]);
    assert.equal(grow.removed.length, 0, 'entries outside work periods are left alone');
    const shrink = computeResize(DEFAULT_SEGMENTS, [entry('y', '08:00', 30)], 'wp2', 'start', 30);
    assert.deepEqual(span(shrink.segments, 'breakfast'), [420, 510]);
    assert.deepEqual(shrink.removed.map((e) => e._id), ['y']);
    const intoWp1 = computeResize(DEFAULT_SEGMENTS, [entry('z', '06:30', 30)], 'breakfast', 'start', -30);
    assert.deepEqual(span(intoWp1.segments, 'wp1'), [360, 390]);
    assert.deepEqual(intoWp1.removed.map((e) => e._id), ['z']);
});

test('Rest start follows wp5 and the day boundary is fixed', () => {
    const later = computeResize(DEFAULT_SEGMENTS, [], 'rest', 'start', 60);
    assert.deepEqual(span(later.segments, 'wp5'), [1020, 1200]);
    assert.equal(later.restLostMinutes, 60);
    assert.equal(later.requiresConfirmation, true);
    const earlier = computeResize(DEFAULT_SEGMENTS, [], 'rest', 'start', -60);
    assert.deepEqual(span(earlier.segments, 'wp5'), [1020, 1080]);
    assert.equal(earlier.requiresConfirmation, false);
    assert.match(computeResize(DEFAULT_SEGMENTS, [], 'rest', 'start', 305).error, /midnight/);
    assert.equal(computeResize(DEFAULT_SEGMENTS, [], 'wake', 'start', -5).field, 'edge');
    assert.equal(computeResize(DEFAULT_SEGMENTS, [], 'rest', 'end', 5).field, 'edge');
    assert.equal(computeResize(DEFAULT_SEGMENTS, [], 'wp1', 'middle', 5).field, 'edge');
    assert.match(computeResize(DEFAULT_SEGMENTS, [], 'wp1', 'end', 7).error, /multiple of 5/);
});
