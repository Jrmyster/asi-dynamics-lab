'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { Simulation, CONSTANTS } = require('../simulation.js');
const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a-b) <= tolerance * Math.max(1,Math.abs(b)), `${a} != ${b}`);
test('a century is finite, bounded, energy-complete and retains the full time span', () => {
  const sim = new Simulation({ nodes: 100, compute: 1000000, alpha: 0.3 });
  sim.advance(CONSTANTS.horizon);
  const s = sim.snapshot(); assert.equal(s.time, 876000);
  assert.ok(Object.values(s.capabilities).every(x=>Number.isFinite(x) && x>=1 && x<=1e12+1));
  assert.ok(s.nodeAlignments.every(x=>Number.isFinite(x) && x>=0 && x<=100));
  near(s.energyKWh, 250 * 876000); assert.equal(sim.history[0].time,0);
  assert.equal(sim.history.at(-1).time,876000); assert.ok(sim.history.length<=CONSTANTS.maxSamples);
  assert.equal(sim.events.filter(e=>e.key==='event.horizon').length,1);
  const frozen=sim.exportJSON();sim.advance(24);assert.equal(sim.exportJSON(),frozen);
});
test('coarse steps preserve exact sublinear and exponential growth when unbounded', () => {
  const sim = new Simulation({alpha:0.0001});const rate=sim.rate();sim.advance(8760);
  near(sim.snapshot().capabilities.sublinear,(1+rate*8760/2)**2);
  near(sim.snapshot().capabilities.exponential,Math.exp(rate*8760));
});
test('long-run export schedule replays exact state and sampled history across interventions', () => {
  const sim = new Simulation({alpha:0.001});sim.advance(730);sim.update({nodes:40});
  sim.injectSafetyPatch();sim.triggerRecursiveLoop();sim.advance(900.5);sim.scaleCompute();sim.advance(8760);
  const replay = Simulation.fromJSON(sim.exportJSON());
  assert.deepEqual(replay.snapshot(),sim.snapshot());assert.deepEqual(replay.history,sim.history);
  assert.deepEqual(replay.integrationSchedule,sim.integrationSchedule);
  near(sim.patch,Math.exp(-9660.5/8),1e-6);assert.ok(sim.loop<1e-6);
});
test('zero growth works over decades, and malformed replay schedules fail', () => {
  const sim=new Simulation({alpha:0});sim.advance(87600);
  assert.deepEqual(sim.snapshot().capabilities,{sublinear:1,exponential:1,superexponential:1});
  const data=JSON.parse(sim.exportJSON()); data.integrationSchedule[0].dt=Infinity;
  assert.throws(()=>Simulation.fromJSON(data),RangeError);
  const empty=new Simulation();assert.deepEqual(Simulation.fromJSON(empty.exportJSON()).snapshot(),empty.snapshot());
});
