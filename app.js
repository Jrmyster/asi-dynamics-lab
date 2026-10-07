/* Presentation layer. All model equations live in simulation.js. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const { Simulation, CONSTANTS, DEFAULTS } = ASILab;
  const i18n = ASII18n; const t = (key, params) => i18n.t(key, params);
  const modeName = mode => t('ui.' + ({ sublinear: 'sub-linear', exponential: 'exponential', superexponential: 'super-exponential' })[mode]);
  const eventText = event => event.key ? t(event.key, event.params.domain ? { ...event.params, name: t('domain.' + event.params.domain) } : event.params) : event.message;
  const colors = { sublinear: '#6adbd0', exponential: '#ae9cf7', superexponential: '#f4b378' };
  const sim = new Simulation(); let running = false; let accumulator = 0; let last = 0; let drawnTick = -1; let eventsSignature = ''; let nodeCount = -1;
  let formatter = new Intl.NumberFormat(i18n.locale, { maximumFractionDigits: 1 });
  const fmt = n => n >= 1e5 ? n.toExponential(2) : formatter.format(n);
  const mult = n => n < 1000 ? n.toFixed(2) + '×' : fmt(n) + '×';
  function syncControls() {
    for (const k of ['compute', 'alpha', 'guardrail', 'nodes', 'mode']) $(k).value = sim.params[k];
    $('alpha-value').textContent = sim.params.alpha.toFixed(3);
    $('guardrail-value').textContent = sim.params.guardrail + '%'; $('nodes-value').textContent = sim.params.nodes;
  }
  function announce(message) { $('announcement').textContent = message; }
  function playbackText() {
    const value = running;
    $('play').textContent = t(value ? 'pause' : 'run');
    $('play').setAttribute('aria-pressed', String(value));
    $('run-state').textContent = t(value ? 'running' : 'paused'); $('run-dot').classList.toggle('running', value);
    $('step').disabled = value || sim.time >= CONSTANTS.horizon;
  }
  function setRunning(value) { running = value; accumulator = 0; last = 0; playbackText(); }
  function reset(params) {
    setRunning(false); sim.reset(params); eventsSignature = ''; drawnTick = -1; syncControls(); render(true);
    announce(t('reset'));
  }
  function canvasContext(id) {
    const canvas = $(id); const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1); const w = Math.max(1, rect.width); const h = Math.max(1, rect.height);
    const pw = Math.round(w * dpr); const ph = Math.round(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    const ctx = canvas.getContext('2d'); if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }
  function chart(id, series, maxY, labels, thresholds = []) {
    const surface = canvasContext(id); if (!surface) return;
    const { ctx, w, h } = surface; const pad = { l: 42, r: 10, t: 12, b: 29 };
    const pw = w - pad.l - pad.r; const ph = h - pad.t - pad.b;
    const end = Math.max(12, Math.ceil(sim.time / 12) * 12);
    const x = t => pad.l + t / end * pw; const y = v => pad.t + ph - v / maxY * ph;
    ctx.font = i18n.language === 'km' ? '10px "Noto Sans Khmer", sans-serif' : '9px ui-monospace, monospace'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const v = maxY * i / 4; ctx.strokeStyle = '#243045'; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(pad.l, y(v)); ctx.lineTo(w - pad.r, y(v)); ctx.stroke();
      ctx.fillStyle = '#8c9ab1'; ctx.textAlign = 'right'; ctx.fillText(labels(v), pad.l - 7, y(v) + 3);
      const t = end * i / 4; ctx.textAlign = 'center'; ctx.fillText(t.toFixed(0) + i18n.t('hour'), x(t), h - 9);
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
    const logMax = Math.max(2, Math.ceil(Math.max(...Object.values(s.logCapabilities)) / Math.LN10));
    chart('growth-chart', Object.keys(colors).map(k => ({ get: row => Math.log10(row[k]), color: colors[k], width: k === sim.params.mode ? 2.5 : 1.5 })),
      logMax, v => '10^' + v.toFixed(1), ASILab.DOMAINS.map(d => ({ value: Math.log10(d.threshold) })));
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
    $('time').textContent = s.time.toFixed(1); $('capability').textContent = mult(s.capabilities[s.params.mode]);
    $('capability-detail').textContent = t('hypothesis', { mode: modeName(s.params.mode) });
    $('alignment').replaceChildren(document.createTextNode(s.alignment.toFixed(1)));
    const unit = document.createElement('span'); unit.className = 'metric-unit'; unit.textContent = ' / 100'; $('alignment').append(unit);
    $('status').textContent = t('status.' + s.status); $('status').className = 'status ' + s.status;
    $('effective').textContent = fmt(r.effectiveCompute); $('compute-detail').textContent = t(r.throttled ? 'compute.throttled' : 'compute.normal');
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
      el.status.textContent = d.achieved ? t('crossed', { time: d.achieved.time.toFixed(1), hour: t('hour') }) : (d.progress * 100).toFixed(0) + '%';
      el.status.title = d.achieved ? t('domain.remembered', { mode: modeName(d.achieved.mode) }) : t('note.' + d.id);
    });
    const signature = i18n.language + JSON.stringify(sim.events);
    if (signature !== eventsSignature) {
      $('events').replaceChildren(); sim.events.forEach(e => { const li = document.createElement('li'); const time = document.createElement('time'); const message = document.createElement('span'); time.textContent = e.time.toFixed(1) + t('hour'); message.textContent = eventText(e); li.append(time, message); $('events').append(li); });
      $('event-count').textContent = t(sim.events.length === 1 ? 'events.one' : 'events.many', { count: sim.events.length }); eventsSignature = signature;
    }
    $('ceiling-note').textContent = t(s.ceilingReached ? 'ceiling' : 'normalized');
    if (force || drawnTick !== s.tick) { drawCharts(s); drawnTick = s.tick; }
    if (s.time >= CONSTANTS.horizon) { setRunning(false); $('play').disabled = true; $('step').disabled = true; } else { $('play').disabled = false; $('step').disabled = running; }
  }
  for (const key of ['compute', 'alpha', 'guardrail', 'nodes', 'mode']) {
    $(key).addEventListener(key === 'compute' || key === 'mode' ? 'change' : 'input', () => {
      if (key === 'compute' && (!$(key).value.trim() || !Number.isFinite(Number($(key).value)))) { syncControls(); announce(t('validation.compute')); return; }
      sim.update({ [key]: key === 'mode' ? $(key).value : Number($(key).value) }); $('preset').value = 'custom'; syncControls(); render(true);
    });
  }
  $('play').addEventListener('click', () => { setRunning(!running); render(); });
  $('step').addEventListener('click', () => { sim.advance(1); render(); });
  $('reset').addEventListener('click', () => reset(sim.params));
  for (const [id, method] of [['patch', 'injectSafetyPatch'], ['scale', 'scaleCompute'], ['loop', 'triggerRecursiveLoop']]) $(id).addEventListener('click', () => { sim[method](); $('preset').value = 'custom'; syncControls(); render(true); announce(eventText(sim.events[0])); });
  $('preset').addEventListener('change', () => {
    const scenarios = { balanced: { ...DEFAULTS }, runaway: { compute: 6000, alpha: 0.16, guardrail: 15, nodes: 40, mode: 'superexponential' }, constrained: { compute: 100000, alpha: 0.08, guardrail: 85, nodes: 64, mode: 'exponential' } };
    if (scenarios[$('preset').value]) reset(scenarios[$('preset').value]);
  });
  function download(data, type, name) {
    const url = URL.createObjectURL(new Blob([data], { type })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce(t('download', { name }));
  }
  $('export').addEventListener('click', () => download(sim.exportCSV(), 'text/csv;charset=utf-8', 'asi-dynamics-trajectory.csv'));
  $('json').addEventListener('click', () => download(sim.exportJSON(), 'application/json', 'asi-dynamics-scenario.json'));
  function frame(timestamp) {
    if (running) {
      if (last) accumulator += Math.min(timestamp - last, 250); last = timestamp;
      while (accumulator >= 100 && running) { sim.advance(0.5); accumulator -= 100; if (sim.time >= CONSTANTS.horizon) setRunning(false); }
      render();
    }
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && running) { setRunning(false); render(); announce(t('hidden')); } });
  window.addEventListener('resize', () => render(true));
  if (typeof ResizeObserver === 'function') { const observer = new ResizeObserver(() => render(true)); observer.observe($('growth-chart').parentElement); observer.observe($('alignment-chart').parentElement); observer.observe($('power-chart').parentElement); }
  document.addEventListener('i18n:change', () => {
    formatter = new Intl.NumberFormat(i18n.locale, { maximumFractionDigits: 1 });
    playbackText(); render(true); announce(t('language.changed'));
  });
  if (document.fonts) document.fonts.ready.then(() => render(true));
  syncControls(); setRunning(false); render(true); requestAnimationFrame(frame);
})();
