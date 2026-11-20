import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const admin = readFileSync(new URL('../public/rewards-admin.js', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../public/script.js', import.meta.url), 'utf8');
function fn(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  let depth = 0;
  const body = source.indexOf('{', start);
  for (let i = body; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}
const defaults = admin.match(/const defaultGoalBar = \{[\s\S]*?\n\};/)[0];
function harness(source, runtime = false) {
  const names = runtime
    ? ['normalizeGoalFonts', 'normalizeGoalAppearance', 'normalizeGoalBarConfig', 'normalizeGoalHex', 'normalizeGoalType', 'defaultGoalLabel', 'defaultGoalResetOnConnect', 'clampNumber', 'expandCompactGoalBar', 'applyGoalBarConfig']
    : ['normalizeGoalFonts', 'normalizeGoalAppearance', 'normalizeGoalBar', 'normalizeHex', 'normalizeGoalType', 'defaultGoalLabel', 'defaultGoalResetOnConnect', 'numberOrDefault', 'clamp', 'compactGoalBarForUrl', 'expandCompactGoalBar', 'removeEmptyUrlFields'];
  const styles = new Map(); const classes = new Set(['thin-source']);
  const context = vm.createContext({ document: {
    body: { classList: { contains: k => classes.has(k), toggle: (k,v) => v ? classes.add(k) : classes.delete(k) } },
    querySelector: () => null,
    documentElement: { style: { setProperty: (k,v) => styles.set(k,v) } }
  } });
  vm.runInContext(defaults + '\n' + names.map(n=>fn(source,n)).join('\n'), context);
  return { context, styles, classes, run: expr => JSON.parse(vm.runInContext(`JSON.stringify(${expr})`, context) || 'null') };
}
const a=harness(admin), r=harness(renderer,true);

test('transparent goal surfaces survive saved JSON and compact links without opting legacy goals in', () => {
  const input={label:'Portrait goal',target:1000,appearance:{enabled:true,noBackground:true}};
  const normalized=a.run(`normalizeGoalBar(${JSON.stringify(input)})`);
  const compact=a.run(`compactGoalBarForUrl(${JSON.stringify(normalized)})`);
  const rendered=r.run(`normalizeGoalBarConfig(expandCompactGoalBar(${JSON.stringify(compact)}), defaultGoalBar)`);
  assert.equal(rendered.appearance.noBackground,true);
  assert.deepEqual(rendered,normalized);
  vm.runInContext(`applyGoalBarConfig(${JSON.stringify(rendered)})`,r.context);
  assert.ok(r.classes.has('goal-no-background'));
  vm.runInContext('applyGoalBarConfig({})',r.context);
  assert.equal(r.classes.has('goal-no-background'),false);
  assert.equal(Object.hasOwn(a.run('normalizeGoalAppearance({enabled:true})'),'noBackground'),false);
});
test('legacy configurations stay opt-out and retain custom legacy colours', () => {
  for (const config of [{}, {accent:'#BFC0B2',glow:'#542127',text:'#E8E5DA'}, {type:'followers', start:120, resetOnConnect:false}]) {
    const json=JSON.stringify(config);
    const normalized=a.run(`normalizeGoalBar(${json})`);
    assert.equal(Object.hasOwn(normalized,'appearance'),false);
    const rendered=r.run(`normalizeGoalBarConfig(${json}, defaultGoalBar)`);
    for (const key of ['accent','glow','text']) rendered[key]=rendered[key].toLowerCase();
    assert.deepEqual(rendered, normalized);
    const compact=a.run(`compactGoalBarForUrl(${json})`);
    assert.equal(Object.hasOwn(compact,'n'),false);
    assert.deepEqual(a.run(`normalizeGoalBar(expandCompactGoalBar(${JSON.stringify(compact)}))`),normalized);
  }
});
test('appearance round-trips through editor, compact URL and runtime without losing zero values', () => {
  const input={label:'Spooktober',type:'support',target:750,appearance:{enabled:true,background:'#10110f',border:'#DEDCC3',progressStart:'#BFC0B2',progressEnd:'#BFC0B2',glowStrength:0,backgroundOpacity:0,gloss:false}};
  const normalized=a.run(`normalizeGoalBar(${JSON.stringify(input)})`);
  const compact=a.run(`compactGoalBarForUrl(${JSON.stringify(normalized)})`);
  const decoded=JSON.stringify(compact);
  assert.deepEqual(a.run(`normalizeGoalBar(expandCompactGoalBar(${decoded}))`),normalized);
  assert.deepEqual(r.run(`normalizeGoalBarConfig(expandCompactGoalBar(${decoded}), defaultGoalBar)`),normalized);
  assert.equal(normalized.appearance.glowStrength,0);
  assert.equal(normalized.appearance.gloss,false);
  // Cloud variants store this JSON unchanged; exercise that representation as well.
  assert.deepEqual(r.run(`normalizeGoalBarConfig(${JSON.stringify(normalized)}, defaultGoalBar)`),normalized);
});
test('invalid values cannot inject CSS and require an explicit opt-in', () => {
  for(const value of [null,{},false,{enabled:'true'},{enabled:false}]) assert.equal(a.run(`normalizeGoalAppearance(${JSON.stringify(value)})`),null);
  const input={enabled:true,background:'red;position:fixed',glowStrength:500,backgroundOpacity:-10,counterText:'#zzzzzz'};
  const good=a.run(`normalizeGoalAppearance(${JSON.stringify(input)})`);
  assert.equal(good.background,'#15101f'); assert.equal(good.glowStrength,100); assert.equal(good.backgroundOpacity,0);
  assert.deepEqual(r.run(`normalizeGoalAppearance(${JSON.stringify(input)})`),good);
});
test('renderer enables overrides only for opted-in thin goals and removes mode on a legacy update', () => {
  vm.runInContext('applyGoalBarConfig({appearance:{enabled:true,gloss:false,glowStrength:0}})',r.context);
  assert.ok(r.classes.has('goal-custom')); assert.ok(r.classes.has('goal-custom-matte'));
  assert.equal(r.styles.get('--goal-custom-glow-alpha'),'0%');
  vm.runInContext('applyGoalBarConfig({})',r.context);
  assert.equal(r.classes.has('goal-custom'),false); assert.equal(r.classes.has('goal-custom-matte'),false);
  r.classes.delete('thin-source');
  vm.runInContext('applyGoalBarConfig({appearance:{enabled:true}})',r.context);
  assert.equal(r.classes.has('goal-custom'),false);
});

test('font sizes preserve legacy defaults and round-trip through compact links', () => {
  const input = {labelSize:24,counterSize:22,targetSize:26};
  const normalized = a.run(`normalizeGoalBar(${JSON.stringify(input)})`);
  const compact = a.run(`compactGoalBarForUrl(${JSON.stringify(input)})`);
  assert.deepEqual(r.run(`normalizeGoalBarConfig(expandCompactGoalBar(${JSON.stringify(compact)}), defaultGoalBar)`), normalized);
  assert.deepEqual(a.run('normalizeGoalFonts({labelSize:"",counterSize:null})'),{});
  assert.deepEqual(r.run('normalizeGoalFonts({labelSize:999,counterSize:-10,targetSize:"invalid"})'),{labelSize:48,counterSize:8});
  r.classes.add('thin-source');
  vm.runInContext('applyGoalBarConfig({labelSize:24})',r.context);
  assert.equal(r.styles.get('--thin-goal-labelSize'),'24px');
  vm.runInContext('applyGoalBarConfig({})',r.context);
  assert.equal(r.styles.get('--thin-goal-labelSize'),'');
});
