/* ASI Dynamics Lab — deterministic educational model, not an ASI predictor. */
(function (root) {
  'use strict';
  const MODES = Object.freeze(['sublinear', 'exponential', 'superexponential']);
  const CONSTANTS = Object.freeze({
    dt: 0.05, horizon: 876000, fineWindow: 120, coarseDt: 24, capabilityCeiling: 1e12, maxLogRate: 0.5,
    facilityLimitW: 250000, flopsPerWatt: 3e10, pue: 1.2,
    temperatureK: 300, erasedBitsPerFlop: 64, boltzmann: 1.380649e-23,
    maxSamples: 4097, maxEvents: 64, seed: 4217
  });
  const DEFAULTS = Object.freeze({ compute: 2000, alpha: 0.08, guardrail: 75, nodes: 8, mode: 'exponential' });
  const DOMAINS = Object.freeze([
    { id: 'quantum', name: 'Quantum physics', threshold: 8, note: 'Toy threshold: hypothesis search' },
    { id: 'biology', name: 'Synthetic biology', threshold: 30, note: 'Toy threshold: model-based design' },
    { id: 'materials', name: 'Materials discovery', threshold: 100, note: 'Toy threshold: candidate screening' },
    { id: 'governance', name: 'Self-governance', threshold: 300, note: 'Toy threshold: coordination proposals; legitimacy is not implied' }
  ]);
  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function number(v, fallback, min, max) { return clamp(Number.isFinite(Number(v)) ? Number(v) : fallback, min, max); }
  function parameters(p = {}) {
    return {
      compute: number(p.compute, DEFAULTS.compute, 1, 1e6),
      alpha: number(p.alpha, DEFAULTS.alpha, 0, 0.3),
      guardrail: number(p.guardrail, DEFAULTS.guardrail, 0, 100),
      nodes: Math.round(number(p.nodes, DEFAULTS.nodes, 1, 100)),
      mode: MODES.includes(p.mode) ? p.mode : DEFAULTS.mode
    };
  }
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; };
  }
  class Simulation {
    constructor(p = {}) { this.reset(p); }
    reset(p = this.params) {
      this.params = parameters(p); this.initialParams = { ...this.params };
      this.time = 0; this.tick = 0; this.energyKWh = 0; this.loop = 0; this.patch = 0;
      this.logs = { sublinear: 0, exponential: 0, superexponential: 0 };
      this.integrationSchedule = []; this.history = []; this.events = []; this.actions = []; this.achieved = new Map();
      const random = rng(CONSTANTS.seed);
      this.resilience = Array.from({ length: 100 }, () => 0.85 + 0.3 * random());
      this.alignments = Array.from({ length: 100 }, () => 0.72 + 0.24 * this.params.guardrail / 100);
      this.event('Scenario initialized. Capability is normalized to 1×.', 'info', 'event.initialized');
      this.record(); return this.snapshot();
    }
    event(message, kind = 'info', key = '', params = {}) {
      this.events.unshift({ time: this.time, message, kind, key, params: { ...params } });
      if (this.events.length > CONSTANTS.maxEvents) this.events.pop();
    }
    update(p) {
      const old = this.params; const next = parameters({ ...old, ...p });
      if (JSON.stringify(next) === JSON.stringify(old)) return this.snapshot();
      this.params = next;
      this.actions.push({ tick: this.tick, type: 'parameters', params: { ...next } });
      this.event('Parameters updated; existing state is retained. Reset to compare initial conditions.', 'info', 'event.parameters');
      this.checkDomains(); this.record(); return this.snapshot();
    }
    injectSafetyPatch() {
      this.patch = 1;
      this.alignments = this.alignments.map(a => clamp(a + 0.12, 0, 1));
      this.actions.push({ tick: this.tick, type: 'safety-patch' });
      this.event('Safety patch: +12 stability points; temporary repair decays over 8 model hours.', 'patch', 'event.patch');
      this.record(); return this.snapshot();
    }
    scaleCompute() {
      const before = this.params.compute;
      this.update({ compute: Math.min(1e6, before * 2) });
      this.event(before === this.params.compute ? 'Compute allocation is already at the input ceiling.' : 'Compute allocation doubled; facility power budget still applies.', 'compute', before === this.params.compute ? 'event.computeCeiling' : 'event.compute');
      this.record(); return this.snapshot();
    }
    triggerRecursiveLoop() {
      this.loop = Math.min(3, this.loop + 0.6);
      this.actions.push({ tick: this.tick, type: 'recursive-loop' });
      this.event('Recursive loop: temporary learning multiplier increased; decay time is 6 model hours.', 'loop', 'event.loop');
      this.record(); return this.snapshot();
    }
    resources() {
      const k = CONSTANTS; const requestedFlops = this.params.compute * 1e12;
      const requestedW = requestedFlops / k.flopsPerWatt * k.pue;
      const powerW = Math.min(requestedW, k.facilityLimitW);
      const effectiveFlops = powerW / k.pue * k.flopsPerWatt;
      const lowerBoundW = effectiveFlops * k.erasedBitsPerFlop * k.boltzmann * k.temperatureK * Math.LN2;
      return { requestedW, powerW, effectiveCompute: effectiveFlops / 1e12,
        utilization: powerW / k.facilityLimitW, throttled: requestedW > k.facilityLimitW,
        lowerBoundW, gap: (powerW / k.pue) / lowerBoundW };
    }
    coordination() {
      const n = this.params.nodes;
      return { efficiency: 1 / (1 + 0.06 * Math.log2(n)), diversity: 1 + 0.12 * Math.log2(n),
        links: n * (n - 1) / 2, perNodeCompute: this.resources().effectiveCompute / n };
    }
    rate() {
      const r = this.resources(); const c = this.coordination(); const g = this.params.guardrail / 100;
      return Math.min(CONSTANTS.maxLogRate, this.params.alpha * Math.pow(r.effectiveCompute / 1000, 0.28) *
        c.efficiency * c.diversity * (1 - 0.18 * g) * (1 + this.loop));
    }
    advance(hours = 0.5) {
      if (!Number.isFinite(hours) || hours < 0 || hours > CONSTANTS.horizon) throw new RangeError('Advance exceeds the 100-year model horizon.');
      const target = Math.min(CONSTANTS.horizon / CONSTANTS.dt, this.tick + Math.round(hours / CONSTANTS.dt));
      while (this.tick < target) {
        // Resolve early dynamics and transient interventions; use bounded daily steps later.
        const fine = this.time < CONSTANTS.fineWindow || this.loop > 1e-6 || this.patch > 1e-6;
        const stepTicks = Math.min(target - this.tick, Math.round((fine ? CONSTANTS.dt : CONSTANTS.coarseDt) / CONSTANTS.dt));
        this.step(stepTicks * CONSTANTS.dt);
      }
      return this.snapshot();
    }
    step(dt = CONSTANTS.dt) {
      if (!Number.isFinite(dt) || dt <= 0 || dt > CONSTANTS.coarseDt || Math.abs(dt / CONSTANTS.dt - Math.round(dt / CONSTANTS.dt)) > 1e-8) throw new RangeError("Invalid integration step.");
      if (this.time >= CONSTANTS.horizon) return;
      dt = Math.min(dt, CONSTANTS.horizon - this.time);
      const previous = this.integrationSchedule[this.integrationSchedule.length - 1];
      if (previous && previous.dt === dt) previous.count++; else this.integrationSchedule.push({ dt, count: 1 });
      const r = this.rate(); const limit = Math.log(CONSTANTS.capabilityCeiling);
      const before = this.logs[this.params.mode];
      // Exact sublinear update (dK/dt = r sqrt(K)); bounded log-space Euler for positive feedback.
      this.logs.sublinear = Math.min(limit, 2 * Math.log(Math.exp(this.logs.sublinear / 2) + r * dt / 2));
      this.logs.exponential = Math.min(limit, this.logs.exponential + Math.min(CONSTANTS.maxLogRate, r) * dt);
      if (dt === CONSTANTS.dt) {
        this.logs.superexponential = Math.min(limit, this.logs.superexponential + Math.min(CONSTANTS.maxLogRate, r * Math.exp(0.35 * this.logs.superexponential)) * dt);
      } else if (r > 0) {
        // Exact frozen-rate positive feedback until the log-rate cap, then linear log growth.
        const start = this.logs.superexponential;
        const transition = Math.max(start, Math.log(CONSTANTS.maxLogRate / r) / 0.35);
        const toCap = Math.max(0, (Math.exp(-0.35 * start) - Math.exp(-0.35 * transition)) / (0.35 * r));
        this.logs.superexponential = Math.min(limit, dt < toCap ? -Math.log(Math.exp(-0.35 * start) - 0.35 * r * dt) / 0.35 : transition + CONSTANTS.maxLogRate * (dt - toCap));
      }
      const speed = (this.logs[this.params.mode] - before) / dt;
      const resource = this.resources(); const g = this.params.guardrail / 100;
      const pressure = 0.008 + 0.035 * speed + 0.01 * Math.log1p(resource.effectiveCompute / 1000) + 0.01 * Math.log(this.params.nodes);
      const repair = 0.05 * g + 0.08 * this.patch;
      for (let j = 0; j < this.params.nodes; j++) {
        const a = this.alignments[j];
        const loss = (1 - 0.88 * g) * pressure * this.resilience[j];
        const total = repair + loss;
        this.alignments[j] = dt === CONSTANTS.dt ? clamp(a + dt * (repair * (1 - a) - loss * a), 0, 1) : clamp(repair / total + (a - repair / total) * Math.exp(-total * dt), 0, 1);
      }
      this.energyKWh += resource.powerW / 1000 * dt;
      this.tick += Math.round(dt / CONSTANTS.dt); this.time = this.tick * CONSTANTS.dt;
      this.loop *= Math.exp(-dt / 6); this.patch *= Math.exp(-dt / 8);
      this.checkDomains(); this.record();
      if (this.time === CONSTANTS.horizon) this.event('100-year model horizon reached. Reset to start another scenario.', 'info', 'event.horizon');
    }
    checkDomains() {
      const capability = Math.exp(this.logs[this.params.mode]);
      for (const d of DOMAINS) if (capability >= d.threshold && !this.achieved.has(d.name)) {
        this.achieved.set(d.name, { time: this.time, mode: this.params.mode });
        this.event(`${d.name}: illustrative ${d.threshold}× threshold crossed. No scientific discovery has occurred.`, 'domain', 'event.domain', { domain: d.id, threshold: d.threshold });
      }
    }
    snapshot() {
      const a = this.alignments.slice(0, this.params.nodes); const mean = a.reduce((s, v) => s + v, 0) / a.length;
      return { time: this.time, tick: this.tick, params: { ...this.params },
        capabilities: Object.fromEntries(MODES.map(m => [m, Math.exp(this.logs[m])])),
        logCapabilities: { ...this.logs }, alignment: mean * 100, minimumAlignment: Math.min(...a) * 100,
        nodeAlignments: a.map(v => v * 100), resources: this.resources(), coordination: this.coordination(),
        energyKWh: this.energyKWh, loop: this.loop, patch: this.patch,
        ceilingReached: this.logs[this.params.mode] >= Math.log(CONSTANTS.capabilityCeiling),
        status: mean < 0.4 ? 'critical' : mean < 0.7 ? 'drifting' : 'stable',
        domains: DOMAINS.map(d => ({ ...d, progress: clamp(this.logs[this.params.mode] / Math.log(d.threshold), 0, 1),
          achieved: this.achieved.get(d.name) || null })) };
    }
    record() {
      const s = this.snapshot(); const row = { time: s.time, ...s.capabilities, alignment: s.alignment,
        minimumAlignment: s.minimumAlignment, powerKW: s.resources.powerW / 1000,
        limitKW: CONSTANTS.facilityLimitW / 1000, energyKWh: s.energyKWh,
        effectiveCompute: s.resources.effectiveCompute, landauerW: s.resources.lowerBoundW,
        compute: this.params.compute, alpha: this.params.alpha, guardrail: this.params.guardrail,
        nodes: this.params.nodes, mode: this.params.mode, loop: this.loop, patch: this.patch };
      if (this.history.length && this.history[this.history.length - 1].time === row.time) this.history[this.history.length - 1] = row;
      else this.history.push(row);
      if (this.history.length > CONSTANTS.maxSamples) {
        // Retain the beginning and current endpoint instead of discarding the early story.
        const last = this.history[this.history.length - 1];
        this.history = this.history.filter((_, i) => i % 2 === 0);
        if (this.history[this.history.length - 1] !== last) this.history.push(last);
      }
    }
    exportJSON() {
      return JSON.stringify({ model: 'asi-dynamics-lab', version: 2, constants: CONSTANTS, integrationSchedule: this.integrationSchedule,
        initialParams: this.initialParams, finalTick: this.tick, actions: this.actions,
        finalState: this.snapshot(), history: this.history, events: this.events }, null, 2);
    }
    static fromJSON(input) {
      const data = typeof input === 'string' ? JSON.parse(input) : input;
      if (!data || data.model !== 'asi-dynamics-lab' || ![1, 2].includes(data.version) || !Number.isSafeInteger(data.finalTick) || data.finalTick < 0 || data.finalTick > CONSTANTS.horizon / CONSTANTS.dt || !Array.isArray(data.actions)) throw new RangeError('Invalid replay.');
      const schedule = data.version === 1 ? [{ dt: CONSTANTS.dt, count: data.finalTick }].filter(group => group.count > 0) : data.integrationSchedule;
      if (!Array.isArray(schedule) || schedule.length > 100000) throw new RangeError('Invalid integration schedule.');
      let totalTicks = 0;
      for (const group of schedule) {
        if (!Number.isSafeInteger(group.count) || group.count < 1 || !Number.isFinite(group.dt) || group.dt < CONSTANTS.dt || group.dt > CONSTANTS.coarseDt || Math.abs(group.dt / CONSTANTS.dt - Math.round(group.dt / CONSTANTS.dt)) > 1e-8) throw new RangeError('Invalid integration schedule.');
        totalTicks += group.count * Math.round(group.dt / CONSTANTS.dt);
      }
      if (totalTicks !== data.finalTick) throw new RangeError('Replay duration mismatch.');
      let priorTick = 0;
      for (const action of data.actions) {
        if (!Number.isSafeInteger(action.tick) || action.tick < priorTick || action.tick > data.finalTick || !['parameters', 'safety-patch', 'recursive-loop'].includes(action.type)) throw new RangeError('Invalid action.');
        priorTick = action.tick;
      }
      const sim = new Simulation(data.initialParams); let index = 0;
      const apply = () => {
        while (index < data.actions.length && data.actions[index].tick === sim.tick) {
          const action = data.actions[index++];
          if (action.type === 'parameters') sim.update(action.params);
          if (action.type === 'safety-patch') sim.injectSafetyPatch();
          if (action.type === 'recursive-loop') sim.triggerRecursiveLoop();
        }
        if (index < data.actions.length && data.actions[index].tick < sim.tick) throw new RangeError('Action falls inside an integration step.');
      };
      for (const group of schedule) for (let i = 0; i < group.count; i++) { apply(); sim.step(group.dt); }
      apply(); return sim;
    }
    exportCSV() {
      const keys = Object.keys(this.history[0]);
      return keys.join(',') + '\n' + this.history.map(row => keys.map(k => row[k]).join(',')).join('\n') + '\n';
    }
  }
  const api = Object.freeze({ Simulation, CONSTANTS, DEFAULTS, MODES, DOMAINS, parameters });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ASILab = api;
})(typeof globalThis === 'object' ? globalThis : this);
