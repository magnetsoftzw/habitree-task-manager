const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_SEGMENTS, computeShift, intervalError, effectiveSegments, toMinutes } = require('../utils/scheduleLogic');

const seg = (segments, key) => segments.find((s) => s.key === key);
const entry = (id, time, duration) => ({ _id: id, time, duration });

test('default template has five work periods and six personal reservations', () => {
    assert.equal(DEFAULT_SEGMENTS.filter((s) => s.kind === 'work').length, 5);
    assert.equal(DEFAULT_SEGMENTS.filter((s) => s.kind === 'personal').length, 6);
    assert.deepEqual([seg(DEFAULT_SEGMENTS, 'wake').start, seg(DEFAULT_SEGMENTS, 'wake').end], [240, 360]);
    assert.deepEqual([seg(DEFAULT_SEGMENTS, 'rest').start, seg(DEFAULT_SEGMENTS, 'rest').end], [1140, 1680]);
    DEFAULT_SEGMENTS.slice(1).forEach((s, i) => assert.equal(s.start, DEFAULT_SEGMENTS[i].end, 'contiguous'));
});

test('interval validation checks the full duration', () => {
    assert.equal(intervalError(DEFAULT_SEGMENTS, toMinutes('08:00'), toMinutes('08:00') + 120), null);
    assert.match(intervalError(DEFAULT_SEGMENTS, toMinutes('09:30'), toMinutes('09:30') + 60), /Brunch \(10:00–11:00 AM\)/);
    assert.match(intervalError(DEFAULT_SEGMENTS, toMinutes('12:30'), toMinutes('12:30') + 60), /Lunch \(1:00–2:00 PM\)/);
    assert.match(intervalError(DEFAULT_SEGMENTS, toMinutes('02:00'), toMinutes('02:00') + 30), /Rest \(7:00 PM–4:00 AM\)/);
    assert.match(intervalError(DEFAULT_SEGMENTS, toMinutes('20:00'), toMinutes('20:00') + 30), /Rest/);
});

test('final work period moved later keeps its length and shortens Rest', () => {
    const r = computeShift(DEFAULT_SEGMENTS, [entry('a', '17:30', 60)], 'wp5', 60);
    assert.deepEqual([seg(r.segments, 'wp5').start, seg(r.segments, 'wp5').end], [1080, 1200]);
    assert.deepEqual([r.rest.start, r.rest.end], [1200, 1680]);
    assert.equal(r.restLostMinutes, 60);
    assert.equal(seg(r.segments, 'break').end, 1080, 'Break grows to meet it');
    assert.equal(r.requiresConfirmation, true);
    assert.deepEqual(r.moved.map((m) => m.time), ['18:30']);
});

test('earlier period moved later cascades and shortens the final period', () => {
    const entries = [entry('a', '08:30', 30), entry('b', '17:00', 60), entry('c', '18:00', 60), entry('d', '06:00', 30)];
    const r = computeShift(DEFAULT_SEGMENTS, entries, 'wp2', 30);
    assert.deepEqual([seg(r.segments, 'wp2').start, seg(r.segments, 'wp2').end], [510, 630]);
    assert.equal(seg(r.segments, 'breakfast').end, 510);
    assert.deepEqual([seg(r.segments, 'wp5').start, seg(r.segments, 'wp5').end], [1050, 1140], 'clipped at Rest');
    assert.deepEqual([r.rest.start, r.rest.end], [1140, 1680], 'Rest unchanged');
    assert.equal(r.workLostMinutes, 30);
    assert.deepEqual(r.moved.map((m) => [m.entry._id, m.time]), [['a', '09:00'], ['b', '17:30']]);
    assert.deepEqual(r.removed.map((e) => e._id), ['c'], 'no longer fits');
    assert.equal(r.requiresConfirmation, true);
});

test('a large later shift drops segments that start past the end of the day', () => {
    const r = computeShift(DEFAULT_SEGMENTS, [entry('x', '17:00', 30)], 'wp4', 180);
    assert.equal(seg(r.segments, 'wp5'), undefined);
    assert.deepEqual([seg(r.segments, 'wp4').start, seg(r.segments, 'wp4').end], [1020, 1140]);
    assert.deepEqual(r.removed.map((e) => e._id), ['x']);
});

test('moving earlier shrinks the slot before it and grows Rest, with no confirmation', () => {
    const r = computeShift(DEFAULT_SEGMENTS, [entry('a', '11:00', 30)], 'wp3', -30);
    assert.equal(seg(r.segments, 'brunch').end, 630);
    assert.equal(seg(r.segments, 'wp3').start, 630);
    assert.equal(r.rest.start, 1110);
    assert.equal(r.requiresConfirmation, false);
    assert.deepEqual(r.moved.map((m) => m.time), ['10:30']);
});

test('shift guards', () => {
    assert.ok(computeShift(DEFAULT_SEGMENTS, [], 'lunch', 30).error, 'personal time cannot be shifted');
    assert.ok(computeShift(DEFAULT_SEGMENTS, [], 'wp2', 7).error, 'multiples of 5');
    assert.ok(computeShift(DEFAULT_SEGMENTS, [], 'wp2', -60).error, 'Breakfast must keep 5 minutes');
    assert.ok(computeShift(DEFAULT_SEGMENTS, [], 'wp5', 305).error, 'work ends by midnight');
    assert.equal(computeShift(DEFAULT_SEGMENTS, [], 'wp5', 300).error, undefined);
});

test('day overrides change times only and keep template names', () => {
    const template = { segments: DEFAULT_SEGMENTS.map((s) => (s.key === 'lunch' ? { ...s, label: 'Gym' } : s)) };
    const override = { segments: computeShift(DEFAULT_SEGMENTS, [], 'wp5', 30).segments.map(({ key, start, end }) => ({ key, start, end })) };
    const day = effectiveSegments(template, override);
    assert.equal(seg(day, 'lunch').label, 'Gym');
    assert.equal(seg(day, 'rest').start, 1170);
    assert.equal(seg(effectiveSegments(template), 'rest').start, 1140, 'template untouched');
});
