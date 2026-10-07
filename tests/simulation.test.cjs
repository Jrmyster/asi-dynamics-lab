'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Simulation, CONSTANTS, parameters } = require('../simulation.js');
const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(b)), `${a} differs from ${b}`);
function finiteTree(value) {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), 'state contains a nonfinite number');
  if (value && typeof value === 'object') Object.values(value).forEach(finiteTree);
}

test('inputs normalize and constrain untrusted numeric parameters', () => {
  const p = parameters({ compute: Infinity, alpha: -10, guardrail: 999, nodes: 3.6, mode: 'unknown' });
  assert.deepEqual(p, { compute: 2000, alpha: 0, guardrail: 100, nodes: 4, mode: 'exponential' });
  assert.equal(parameters({ compute: -1, nodes: 1000 }).compute, 1);
  assert.equal(parameters({ nodes: 1000 }).nodes, 100);
});

test('zero alpha prevents all capability growth, including with recursive boosts', () => {
  const s = new Simulation({ alpha: 0 }); s.triggerRecursiveLoop(); s.scaleCompute(); s.advance(120);
  Object.values(s.snapshot().capabilities).forEach(k => near(k, 1));
});

test('sublinear exact solution and constant exponential solution hold without interventions', () => {
  const s = new Simulation(); const rate = s.rate(); s.advance(10);
  near(s.snapshot().capabilities.sublinear, (1 + rate * 10 / 2) ** 2);
  near(s.snapshot().capabilities.exponential, Math.exp(rate * 10));
  assert.ok(s.snapshot().capabilities.superexponential > s.snapshot().capabilities.exponential);
});

test('fixed total compute is shared by nodes and obeys the facility budget', () => {
  const s = new Simulation({ compute: 1e6, nodes: 100 }); const r = s.resources();
  near(r.powerW, 250000); near(r.effectiveCompute, 6250); near(s.coordination().perNodeCompute, 62.5);
  assert.ok(r.throttled); assert.equal(s.coordination().links, 4950);
  const unthrottled = new Simulation({ compute: 2000 }); near(unthrottled.resources().powerW, 80000);
});

test('energy integration is in kWh and erasure floor uses bits, not FLOPs', () => {
  const s = new Simulation({ compute: 2000 }); s.advance(1); near(s.energyKWh, 80);
  const lower = 2e15 * 64 * CONSTANTS.boltzmann * 300 * Math.LN2;
  near(s.resources().lowerBoundW, lower, 1e-12); near(s.resources().gap, (80000 / 1.2) / lower);
});

test('scaling an already throttled cluster does not increase effective compute or learning', () => {
  const s = new Simulation({ compute: 100000 }); const before = s.resources().effectiveCompute; const rate = s.rate();
  s.scaleCompute(); assert.equal(s.params.compute, 200000); near(s.resources().effectiveCompute, before); near(s.rate(), rate);
});

test('maximum guardrails improve long-run stability under the assumed repair equation', () => {
  const weak = new Simulation({ guardrail: 0 }); const strong = new Simulation({ guardrail: 100 });
  weak.advance(120); strong.advance(120);
  assert.ok(strong.snapshot().alignment > weak.snapshot().alignment + 50);
  assert.ok(strong.snapshot().alignment < 100); assert.equal(weak.snapshot().status, 'critical');
});

test('patch is bounded, affects stability immediately, and decays with the documented timescale', () => {
  const s = new Simulation({ guardrail: 0 }); s.advance(20); const before = s.snapshot().alignment;
  s.injectSafetyPatch(); near(s.snapshot().alignment, before + 12); s.advance(8); near(s.patch, Math.exp(-1));
  for (let i = 0; i < 50; i++) s.injectSafetyPatch();
  s.snapshot().nodeAlignments.forEach(a => assert.ok(a >= 0 && a <= 100));
  assert.ok(s.events.length <= 64);
});

test('recursive intervention boosts then decays and is bounded', () => {
  const s = new Simulation({ alpha: 0.01 }); const before = s.rate(); s.triggerRecursiveLoop();
  assert.ok(s.rate() > before); s.advance(6); near(s.loop, 0.6 * Math.exp(-1));
  for (let i = 0; i < 20; i++) s.triggerRecursiveLoop(); assert.equal(s.loop, 3);
});

test('deterministic repeated scenarios have identical exports', () => {
  const run = () => { const s = new Simulation({ nodes: 33 }); s.advance(3); s.triggerRecursiveLoop(); s.injectSafetyPatch(); s.scaleCompute(); s.advance(25); return s.exportJSON(); };
  assert.equal(run(), run());
});

test('JSON tick-ordered interventions replay exactly, including actions at the same tick', () => {
  const source = new Simulation(); source.advance(2); source.update({ nodes: 22, mode: 'superexponential' });
  source.injectSafetyPatch(); source.triggerRecursiveLoop(); source.advance(3); source.scaleCompute(); source.advance(12);
  const data = JSON.parse(source.exportJSON()); const replay = new Simulation(data.initialParams);
  for (const action of data.actions) {
    replay.advance((action.tick - replay.tick) * CONSTANTS.dt);
    if (action.type === 'parameters') replay.update(action.params);
    if (action.type === 'safety-patch') replay.injectSafetyPatch();
    if (action.type === 'recursive-loop') replay.triggerRecursiveLoop();
  }
  replay.advance((data.finalTick - replay.tick) * CONSTANTS.dt);
  assert.deepEqual(replay.snapshot(), source.snapshot()); assert.deepEqual(replay.history, source.history);
});

test('milestones record illustrative crossings once and remember the active hypothesis', () => {
  const s = new Simulation({ alpha: 0.3, mode: 'superexponential' }); s.advance(120);
  assert.equal(s.achieved.size, 4); s.snapshot().domains.forEach(d => assert.equal(d.achieved.mode, 'superexponential'));
  s.update({ mode: 'sublinear' }); assert.equal(s.achieved.size, 4);
  s.reset(); assert.equal(s.achieved.size, 0);
});

test('extreme conditions remain finite, bounded, ordered, and stop at the horizon', () => {
  for (const compute of [1, 1e6]) for (const nodes of [1, 100]) for (const guardrail of [0, 100]) {
    const s = new Simulation({ compute, nodes, guardrail, alpha: 0.3, mode: 'superexponential' });
    for (let i = 0; i < 10; i++) s.triggerRecursiveLoop(); s.advance(120); const snap = s.snapshot(); finiteTree(snap);
    assert.equal(snap.time, 120); assert.equal(s.history.length, 2401);
    Object.values(snap.capabilities).forEach(k => assert.ok(k >= 1 && k <= 1e12 + 1));
    assert.ok(snap.capabilities.sublinear <= snap.capabilities.exponential + 1e-6);
    assert.ok(snap.capabilities.exponential <= snap.capabilities.superexponential + 1e-6);
    snap.nodeAlignments.forEach(a => assert.ok(a >= 0 && a <= 100));
    const frozen = s.exportJSON(); s.advance(1); assert.equal(s.exportJSON(), frozen);
  }
});

test('invalid time increments are rejected without changing state', () => {
  const s = new Simulation(); const before = s.exportJSON();
  for (const hours of [-1, NaN, Infinity, 121]) assert.throws(() => s.advance(hours), RangeError);
  assert.equal(s.exportJSON(), before);
});

test('CSV has consistent headers, finite values, final state, and same-tick row replacement', () => {
  const s = new Simulation(); s.advance(1); const rowsBefore = s.history.length; s.injectSafetyPatch();
  assert.equal(s.history.length, rowsBefore);
  const lines = s.exportCSV().trim().split('\n'); const headers = lines[0].split(',');
  assert.ok(headers.includes('energyKWh')); assert.ok(headers.includes('landauerW'));
  lines.slice(1).forEach(line => assert.equal(line.split(',').length, headers.length));
  assert.equal(Number(lines.at(-1).split(',')[0]), 1);
  assert.ok(!/NaN|Infinity|undefined/.test(s.exportCSV()));
});
