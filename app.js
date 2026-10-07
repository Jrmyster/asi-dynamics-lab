/* Presentation layer. All model equations live in simulation.js. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const { Simulation, CONSTANTS, DEFAULTS } = ASILab;
  const i18n = ASII18n; const t = (key, params) => i18n.t(key, params);
  const modeName = mode => t('mode.' + mode);
  const eventText = event => event.key ? t(event.key, event.params.domain ? { ...event.params, name: t('domain.' + event.params.domain) } : event.params) : event.message;
  const colors = { sublinear: '#6adbd0', exponential: '#ae9cf7', superexponential: '#f4b378' };
  const sim = new Simulation(); let running = false; let accumulator = 0; let last = 0; let drawnTick = -1; let eventsSignature = ''; let nodeCount = -1;
  let formatter = new Intl.NumberFormat(i18n.locale, { maximumFractionDigits: 1 });
  const fmt = n => n >= 1e5 ? n.toExponential(2) : formatter.format(n);
  const mult = n => n < 1000 ? n.toFixed(2) + '×' : fmt(n) + '×';
  let guide = null;
  const scenarios = Object.freeze({ balanced: { ...DEFAULTS }, runaway: { compute: 6000, alpha: 0.16, guardrail: 15, nodes: 40, mode: 'superexponential' }, constrained: { compute: 100000, alpha: 0.08, guardrail: 85, nodes: 64, mode: 'exponential' } });
  const level = (value, low, high) => value < low ? 'low' : value < high ? 'medium' : 'high';
  const horizon = () => Number($('horizon').value);
  function duration(hours, compact = false) {
    if (hours >= 8760) return t(compact ? 'time.axis' : hours === 8760 ? 'time.oneyear' : 'time.years', { value: fmt(hours / 8760) });
    if (hours >= 24) return t(compact ? 'time.dayaxis' : hours === 24 ? 'time.oneday' : 'time.days', { value: fmt(hours / 24) });
    return compact ? fmt(hours) + t('hour') : t(hours === 1 ? 'time.onehour' : 'time.hours', { value: fmt(hours) });
  }
  function advanceVisible(hours) {
    let remaining = Math.max(0, horizon() - sim.time);
    if (guide && [2, 4].includes(guide.phase)) remaining = Math.min(remaining, (guide.tick + Math.round(5 / CONSTANTS.dt) - sim.tick) * CONSTANTS.dt);
    sim.advance(Math.min(hours, remaining));
  }
  function syncControls() {
    for (const k of ['compute', 'alpha', 'guardrail', 'nodes', 'mode']) $(k).value = sim.params[k];
    const p = sim.params;
    $('compute-level').value = Math.round(Math.log10(p.compute) / 6 * 100);
    const levels = { 'compute-level': level(p.compute, 1000, 10000), alpha: p.alpha === 0 ? 'off' : level(p.alpha, 0.1, 0.2), guardrail: level(p.guardrail, 40, 70), nodes: p.nodes < 10 ? 'few' : p.nodes < 40 ? 'medium' : 'many' };
    for (const [id, key] of Object.entries(levels)) { $(id + '-value').textContent = t('level.' + key); $(id).setAttribute('aria-valuetext', t('level.' + key)); }
    $('alpha-exact').textContent = p.alpha.toFixed(3);
    $('guardrail-exact').textContent = p.guardrail + '%'; $('nodes-exact').textContent = p.nodes;
  }
  function announce(message) { $('announcement').textContent = message; }
  function playbackText() {
    const value = running;
    $('play').textContent = t(value ? 'pause' : 'run');
    $('play').setAttribute('aria-pressed', String(value));
    $('run-state').textContent = t(value ? 'running' : 'paused'); $('run-dot').classList.toggle('running', value);
    $('step').disabled = value || sim.time >= horizon();
  }
  function setRunning(value) { running = value; accumulator = 0; last = 0; playbackText(); }
  function reset(params) {
    guide = null; setRunning(false); sim.reset(params); eventsSignature = ''; drawnTick = -1; syncControls(); render(true);
    announce(t('reset'));
  }
  function canvasContext(id) {
    const canvas = $(id); const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return null;
    const dpr = Math.min(2, window.devicePixelRatio || 1); const w = Math.max(1, rect.width); const h = Math.max(1, rect.height);
    const pw = Math.round(w * dpr); const ph = Math.round(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    const ctx = canvas.getContext('2d'); if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }
  function chart(id, series, maxY, labels, thresholds = []) {
    const surface = canvasContext(id); if (!surface) return;
    const { ctx, w, h } = surface; const pad = { l: 42, r: 24, t: 12, b: 29 };
    const pw = w - pad.l - pad.r; const ph = h - pad.t - pad.b;
    const end = Math.max(12, sim.time);
    const x = t => pad.l + t / end * pw; const y = v => pad.t + ph - v / maxY * ph;
    ctx.font = i18n.language === 'km' ? '10px "Noto Sans Khmer", sans-serif' : '9px ui-monospace, monospace'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const v = maxY * i / 4; ctx.strokeStyle = '#243045'; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(pad.l, y(v)); ctx.lineTo(w - pad.r, y(v)); ctx.stroke();
      ctx.fillStyle = '#8c9ab1'; ctx.textAlign = 'right'; ctx.fillText(labels(v), pad.l - 7, y(v) + 3);
      const t = end * i / 4; ctx.textAlign = 'center'; ctx.fillText(end >= 8760 ? i18n.t('time.axis', { value: fmt(t / 8760) }) : end >= 24 ? i18n.t('time.dayaxis', { value: fmt(t / 24) }) : duration(t, true), x(t), h - 9);
    }
    ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, pw, ph); ctx.clip();
    for (const line of thresholds) {
      if (line.value > maxY) continue;
      ctx.setLineDash([3, 5]); ctx.strokeStyle = line.color || '#516077';
      ctx.beginPath(); ctx.moveTo(pad.l, y(line.value)); ctx.lineTo(w - pad.r, y(line.value)); ctx.stroke();
    }
    for (const s of series) {
      ctx.setLineDash(s.dash || []); ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2;
      ctx.beginPath(); sim.history.forEach((row, i) => { const v = s.get(row); if (i === 0) ctx.moveTo(x(row.time), y(v)); else ctx.lineTo(x(row.time), y(v)); }); ctx.stroke();
      const row = sim.history[sim.history.length - 1]; ctx.setLineDash([]); ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(x(row.time), y(s.get(row)), 2.5, 0, 2 * Math.PI); ctx.fill();
    }
    ctx.restore(); ctx.setLineDash([]);
  }
  function drawCharts(s) {
    const mode = s.params.mode;
    const logMax = Math.max(1, Math.ceil(s.logCapabilities[mode] / Math.LN10));
    chart('growth-chart', [{ get: row => Math.log10(row[mode]), color: colors[mode], width: 2.5 }], logMax, v => fmt(Math.pow(10, v)) + '×');
    $('growth-chart').setAttribute('aria-label', t('chart.aria', { score: fmt(s.capabilities[mode]) }));
    chart('alignment-chart', [{ get: row => row.alignment, color: '#6adbd0' }, { get: row => row.minimumAlignment, color: '#94a3bb', dash: [3, 3], width: 1 }],
      100, v => v.toFixed(0), [{ value: 70, color: '#99754e' }, { value: 40, color: '#9d5461' }]);
    chart('power-chart', [{ get: row => row.powerKW, color: '#ae9cf7' }, { get: row => row.limitKW, color: '#f4b378', dash: [4, 4], width: 1 }], 300, v => v.toFixed(0));
    $('alignment-chart').setAttribute('aria-label', t('aria.alignment', { mean: s.alignment.toFixed(1), weakest: s.minimumAlignment.toFixed(1) }));
    $('power-chart').setAttribute('aria-label', t('aria.power', { power: fmt(s.resources.powerW / 1000) }));
  }
  const domainElements = ASILab.DOMAINS.map(d => {
    const el = document.createElement('div'); el.className = 'domain';
    const top = document.createElement('div'); top.className = 'domain-top';
    const title = document.createElement('strong'); title.textContent = d.name;
    const status = document.createElement('span'); status.className = 'domain-status'; top.append(title, status);
    const note = document.createElement('p'); note.textContent = d.threshold + '× illustrative capability threshold';
    const bar = document.createElement('progress'); bar.max = 1; bar.value = 0; bar.setAttribute('aria-label', d.name + ' illustrative threshold progress');
    el.append(top, note, bar); $('domains').append(el); return { title, status, note, bar };
  });
  function render(force = false) {
    const s = sim.snapshot(); const r = s.resources; const c = s.coordination;
    $('time').textContent = duration(s.time);
    $('step').textContent = t('time.advance', { duration: duration(Number($('speed').value)) });
    $('long-energy').textContent = s.energyKWh >= 1e6 ? fmt(s.energyKWh / 1e6) + ' GWh' : s.energyKWh >= 1000 ? fmt(s.energyKWh / 1000) + ' MWh' : fmt(s.energyKWh) + ' kWh';
    $('long-limit').textContent = s.ceilingReached ? t('long.ceiling') : '';
    $('time-finished').textContent = s.time >= horizon() ? t('time.finished') : '';
    Array.from($('horizon').options).forEach(option => { option.disabled = Number(option.value) < s.time; }); $('capability').textContent = mult(s.capabilities[s.params.mode]);
    $('capability-detail').textContent = modeName(s.params.mode);
    $('alignment').replaceChildren(document.createTextNode(s.alignment.toFixed(1)));
    const unit = document.createElement('span'); unit.className = 'metric-unit'; unit.textContent = ' / 100'; $('alignment').append(unit);
    $('status').textContent = t('status.' + s.status); $('status').className = 'status ' + s.status;
    $('effective').textContent = fmt(r.effectiveCompute); $('compute-detail').textContent = t(r.throttled ? 'compute.throttled' : 'compute.normal');
    $('electricity').textContent = (r.powerW / CONSTANTS.facilityLimitW * 100).toFixed(0) + '%';
    $('electricity-detail').textContent = t('metric.budget', { power: fmt(r.powerW / 1000), budget: fmt(CONSTANTS.facilityLimitW / 1000) });
    $('active-legend').textContent = t('legend.active') + ': ' + modeName(s.params.mode);
    $('active-legend').style.color = colors[s.params.mode];
    const storyKey = s.ceilingReached ? 'story.ceiling' : s.params.alpha === 0 ? 'story.off' : s.time === 0 ? 'story.initial' : 'story.' + s.status;
    $('story-main').textContent = t(storyKey);
    $('story-resource').textContent = t(r.throttled ? 'story.power' : 'story.room');
    document.querySelectorAll('[data-scenario]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scenario === $('preset').value)));
    renderGuide(s);
    $('energy').textContent = fmt(s.energyKWh) + ' kWh';
    $('sub-value').textContent = mult(s.capabilities.sublinear); $('exp-value').textContent = mult(s.capabilities.exponential); $('super-value').textContent = mult(s.capabilities.superexponential);
    $('weakest').textContent = s.minimumAlignment.toFixed(1) + ' / 100'; $('patch-value').textContent = (s.patch * 100).toFixed(0) + '%';
    $('warning').className = 'warning ' + s.status;
    const warning = t('warning.' + s.status);
    if ($('warning').textContent !== warning) $('warning').textContent = warning;
    $('power').textContent = fmt(r.powerW / 1000) + ' / 250 kW'; $('requested').textContent = fmt(r.requestedW / 1000) + ' kW';
    $('landauer').textContent = r.lowerBoundW.toExponential(2) + ' W'; $('gap').textContent = r.gap.toExponential(2) + '×';
    $('coordination').textContent = (c.efficiency * 100).toFixed(1) + '%'; $('links').textContent = fmt(c.links); $('per-node').textContent = fmt(c.perNodeCompute);
    $('node-pill').textContent = t('nodes', { count: s.params.nodes });
    if (nodeCount !== s.params.nodes) {
      $('network').replaceChildren(); s.nodeAlignments.forEach(() => { const el = document.createElement('span'); el.className = 'node'; $('network').append(el); }); nodeCount = s.params.nodes;
    }
    Array.from($('network').children).forEach((el, i) => { el.className = 'node ' + (s.nodeAlignments[i] < 40 ? 'critical' : s.nodeAlignments[i] < 70 ? 'drifting' : 'stable'); });
    s.domains.forEach((d, i) => {
      const el = domainElements[i]; const name = t('domain.' + d.id);
      el.title.textContent = name; el.note.textContent = t('domain.threshold', { threshold: d.threshold });
      el.bar.value = d.progress; el.bar.setAttribute('aria-label', t('domain.progress', { name }));
      el.status.textContent = d.achieved ? t('crossed', { time: duration(d.achieved.time), hour: '' }) : (d.progress * 100).toFixed(0) + '%';
      el.status.title = d.achieved ? t('domain.remembered', { mode: modeName(d.achieved.mode) }) : t('note.' + d.id);
    });
    const signature = i18n.language + JSON.stringify(sim.events);
    if (signature !== eventsSignature) {
      $('events').replaceChildren(); sim.events.forEach(e => { const li = document.createElement('li'); const time = document.createElement('time'); const message = document.createElement('span'); time.textContent = duration(e.time, true); message.textContent = eventText(e); li.append(time, message); $('events').append(li); });
      $('event-count').textContent = t(sim.events.length === 1 ? 'events.one' : 'events.many', { count: sim.events.length }); eventsSignature = signature;
    }
    $('ceiling-note').textContent = t(s.ceilingReached ? 'ceiling' : 'normalized');
    if (force || drawnTick !== s.tick) { drawCharts(s); drawnTick = s.tick; }
    if (s.time >= horizon()) { setRunning(false); $('play').disabled = true; $('step').disabled = true; } else { $('play').disabled = false; $('step').disabled = running; }
  }
  function renderGuide(s) {
    if (guide && (guide.phase === 2 || guide.phase === 4) && s.tick - guide.tick >= Math.round(5 / CONSTANTS.dt)) {
      guide.phase += 1; if (guide.phase === 5) guide.now = s.alignment; setRunning(false);
    }
    $('guide-progress').value = guide ? Math.min(4, guide.phase - 1) : 0;
    const message = guide ? guide.phase === 5 ? t('guide.done', { before: guide.before.toFixed(1), after: guide.after.toFixed(1), now: guide.now.toFixed(1) }) : t('guide.' + guide.phase) : t('guide.help');
    if ($('guide-instruction').textContent !== message) $('guide-instruction').textContent = message;
    document.querySelectorAll('.action-button').forEach(button => button.classList.toggle('guided-target', !!guide && ((guide.phase === 1 && button.id === 'loop') || (guide.phase === 3 && button.id === 'patch'))));
  }
  function chooseScenario(name) {
    if (!scenarios[name]) return;
    $('preset').value = name; reset(scenarios[name]);
  }
  document.querySelectorAll('[data-scenario]').forEach(button => button.addEventListener('click', () => chooseScenario(button.dataset.scenario)));
  $('compute-level').addEventListener('input', () => {
    sim.update({ compute: Math.round(Math.pow(10, Number($('compute-level').value) / 100 * 6)) });
    $('preset').value = 'custom'; syncControls(); render(true);
  });
  $('guide-start').addEventListener('click', () => { $('speed').value = '1'; chooseScenario('balanced'); guide = { phase: 1, tick: sim.tick, before: 0, after: 0 }; render(true); $('loop').focus(); });
  document.querySelector('a[href="#theory"]').addEventListener('click', () => { $('advanced').open = true; });
  $('horizon').addEventListener('change', () => { render(true); });
  $('speed').addEventListener('change', () => render(true));
  $('advanced').addEventListener('toggle', () => render(true));
  for (const key of ['compute', 'alpha', 'guardrail', 'nodes', 'mode']) {
    $(key).addEventListener(key === 'compute' || key === 'mode' ? 'change' : 'input', () => {
      if (key === 'compute' && (!$(key).value.trim() || !Number.isFinite(Number($(key).value)))) { syncControls(); announce(t('validation.compute')); return; }
      sim.update({ [key]: key === 'mode' ? $(key).value : Number($(key).value) }); $('preset').value = 'custom'; syncControls(); render(true);
    });
  }
  $('play').addEventListener('click', () => { setRunning(!running); render(); });
  $('step').addEventListener('click', () => { advanceVisible(Number($('speed').value)); render(); });
  $('reset').addEventListener('click', () => reset(sim.params));
  for (const [id, method] of [['patch', 'injectSafetyPatch'], ['scale', 'scaleCompute'], ['loop', 'triggerRecursiveLoop']]) $(id).addEventListener('click', () => {
    const before = sim.snapshot().alignment; sim[method]();
    if (guide && guide.phase === 1 && id === 'loop') { guide.phase = 2; guide.tick = sim.tick; }
    else if (guide && guide.phase === 3 && id === 'patch') { guide.phase = 4; guide.tick = sim.tick; guide.before = before; guide.after = sim.snapshot().alignment; }
    $('preset').value = 'custom'; syncControls(); render(true); announce(eventText(sim.events[0]));
  });
  $('preset').addEventListener('change', () => chooseScenario($('preset').value));
  function download(data, type, name) {
    const url = URL.createObjectURL(new Blob([data], { type })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce(t('download', { name }));
  }
  $('export').addEventListener('click', () => download(sim.exportCSV(), 'text/csv;charset=utf-8', 'asi-dynamics-trajectory.csv'));
  $('json').addEventListener('click', () => download(sim.exportJSON(), 'application/json', 'asi-dynamics-scenario.json'));
  function frame(timestamp) {
    if (running) {
      if (last) accumulator += Math.min(timestamp - last, 250); last = timestamp;
      while (accumulator >= 100 && running) { advanceVisible(Number($('speed').value) / 2); accumulator -= 100; if (sim.time >= horizon()) setRunning(false); }
      render();
    }
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && running) { setRunning(false); render(); announce(t('hidden')); } });
  window.addEventListener('resize', () => render(true));
  if (typeof ResizeObserver === 'function') { const observer = new ResizeObserver(() => render(true)); observer.observe($('growth-chart').parentElement); observer.observe($('alignment-chart').parentElement); observer.observe($('power-chart').parentElement); }
  document.addEventListener('i18n:change', () => {
    formatter = new Intl.NumberFormat(i18n.locale, { maximumFractionDigits: 1 });
    syncControls(); playbackText(); render(true); announce(t('language.changed'));
  });
  if (document.fonts) document.fonts.ready.then(() => render(true));
  syncControls(); setRunning(false); render(true); requestAnimationFrame(frame);
})();
