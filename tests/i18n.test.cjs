'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const i18n = require('../i18n.js');
const { Simulation } = require('../simulation.js');
const root = path.resolve(__dirname, '..');
test('every translation and interpolation has a matching Khmer entry', () => {
  const { en, km } = i18n.translations;
  assert.deepEqual(Object.keys(en).sort(), Object.keys(km).sort());
  for (const key of Object.keys(en)) {
    assert.ok(km[key].trim(), key);
    const tokens = text => (text.match(/\{\w+\}/g) || []).sort();
    assert.deepEqual(tokens(en[key]), tokens(km[key]), key);
    assert.match(km[key], /[\u1780-\u17ff]/, key);
  }
});
test('all HTML localization attributes resolve in both languages', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const keys = [...html.matchAll(/data-i18n(?:-aria-label|-title|-content)?="([^"]+)"/g)].map(match => match[1]);
  assert.ok(keys.length > 90);
  for (const key of keys) for (const lang of ['en', 'km']) assert.ok(i18n.translations[lang][key], `${lang}: ${key}`);
});
test('event metadata supports translating interventions, limits and milestones', () => {
  const sim = new Simulation({ alpha: 0.3, compute: 1000000, mode: 'superexponential', guardrail: 0 });
  sim.update({ nodes: 99 }); sim.injectSafetyPatch(); sim.scaleCompute(); sim.triggerRecursiveLoop();
  sim.advance(120);
  for (const event of sim.events) {
    assert.ok(i18n.translations.en[event.key], event.message);
    assert.ok(i18n.translations.km[event.key], event.message);
    if (event.params.domain) assert.ok(i18n.translations.km['domain.' + event.params.domain]);
  }
  assert.ok(sim.events.some(event => event.key === 'event.domain'));
  assert.ok(sim.events.some(event => event.key === 'event.horizon'));
});
test('changing language cannot mutate model state or exports', () => {
  const sim = new Simulation(); sim.advance(3); sim.injectSafetyPatch();
  const before = sim.exportJSON();
  assert.equal(i18n.setLanguage('km'), true);
  assert.equal(i18n.t('hypothesis', { mode: 'test' }), 'សម្មតិកម្ម test');
  assert.equal(i18n.setLanguage('unsupported'), false);
  assert.equal(i18n.language, 'km');
  assert.equal(sim.exportJSON(), before);
  i18n.setLanguage('en');
});
