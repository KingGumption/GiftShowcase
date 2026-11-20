(function () {
  'use strict';
  if (!sessionOverlay) return;
  const byId = id => document.getElementById(id);
  const settings = document.querySelector('[data-editor-panel="goal"][data-editor-section="settings"]');
  const goalFields = document.createElement('div');
  goalFields.hidden = true;
  goalFields.append(...settings.children);
  settings.append(goalFields,byId('session-fields').content.cloneNode(true));
  const nav = document.querySelector('[data-editor-nav="goal"]');
  const panel = document.createElement('div');
  panel.className = 'editor-section-panel';
  panel.id = 'editor-panel-goal-session';
  panel.dataset.editorPanel = 'goal';
  panel.dataset.editorSection = 'session';
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', 'editor-tab-goal-session');
  panel.hidden = true;
  panel.append(byId('session-controls').content.cloneNode(true));
  settings.after(panel);
  document.body.append(byId('live-dialog'));
  byId('live-dialog-close').onclick = () => byId('live-dialog').close();
  const tab = nav.querySelector('[role="tab"]').cloneNode(true);
  tab.id = 'editor-tab-goal-session';
  tab.dataset.editorSectionTab = 'session';
  tab.setAttribute('aria-controls', panel.id);
  tab.lastChild.textContent = 'Session controls';
  nav.append(tab);
  const fields = {label:'graphic-label', hold:'graphic-hold', duration:'graphic-duration', giftId:'graphic-gift',
    hp:'graphic-hp', damage:'graphic-damage', damageMode:'graphic-damage-mode', aName:'graphic-a-name',
    bName:'graphic-b-name', aGift:'graphic-a-gift', bGift:'graphic-b-gift', weight:'graphic-weight',
    sound:'graphic-sound', volume:'graphic-volume'};
  const form = byId('live-form');
  for (const element of form.querySelectorAll('[data-for]')) element.hidden = !element.dataset.for.split(' ').includes(sessionOverlay.id);
  const steps = byId('quest-steps');
  function addStep(step = {label:'Next quest',type:'like',target:5000,giftId:''}) {
    const row = document.createElement('div');
    row.className = 'step config-globals';
    for (const [key,title] of Object.entries({label:'Step label',type:'Event',target:'Target',giftId:'Gift ID (optional)'})) {
      const label = document.createElement('label');
      label.className = 'config-field';
      label.textContent = title;
      const input = document.createElement(key === 'type' ? 'select' : 'input');
      if (key === 'type') for (const type of ['like','follow','share','gift']) input.add(new Option(type,type));
      if (key === 'target') { input.type = 'number'; input.min = '1'; input.max = '10000000'; }
      input.dataset.step = key;
      input.value = step[key] ?? '';
      label.append(input);
      row.append(label);
    }
    const remove = document.createElement('button');
    remove.type = 'button'; remove.textContent = 'Remove';
    remove.onclick = () => { row.remove(); changed(); };
    row.append(remove);
    steps.append(row);
  }
  function readSteps() {
    return [...steps.children].map(row => Object.fromEntries([...row.querySelectorAll('[data-step]')].map(input =>
      [input.dataset.step,input.dataset.step === 'target' ? Number(input.value) : input.value])));
  }
  window.renderSessionRules = rules => {
    if (rules?.variant !== sessionOverlay.id) return;
    const options = KGGraphics.options(rules);
    for (const [key,id] of Object.entries(fields)) byId(id).value = rules[key] ?? options[key] ?? '';
    if (JSON.stringify(options.steps) !== JSON.stringify(readSteps())) {
      steps.replaceChildren();
      options.steps.forEach(addStep);
    }
    window.dispatchEvent(new Event('livegraphic:loaded'));
  };
  function changed(event) {
    const rules = draftConfig.goalBar.graphic;
    if (rules?.variant !== sessionOverlay.id) return;
    const field = Object.entries(fields).find(([,id]) => id === event?.target.id);
    if (field) {
      const [key] = field;
      const input = event.target;
      rules[key] = input.type === 'number' ? Number(input.value) : input.value;
      if (key === 'aGift' || key === 'bGift') rules[key[0]+'Image'] = input.dataset.giftImage || '';
    } else {
      rules.steps = readSteps();
    }
    markDirty();
  }
  form.oninput = changed;
  form.onchange = changed;
  form.onsubmit = event => event.preventDefault();
  byId('quest-add').onclick = () => { if (steps.children.length < 8) { addStep(); changed(); } };
  async function loadSounds() {
    renderSessionRules(draftConfig.goalBar.graphic);
    try {
      const {sounds} = await overlayCloud.request('/v1/sounds');
      for (const sound of sounds.filter(s => !s.removed)) byId('graphic-sound').add(new Option(sound.name,sound.url));
      byId('graphic-sound').value = draftConfig.goalBar.graphic?.sound || '';
    } catch { /* Built-in sounds remain available. */ }
  }
  window.addEventListener('studio:session-ready',loadSounds);
  if(window.studioSessionReady)loadSounds();

  const buttons = [...panel.querySelectorAll('[data-command]'),byId('live-adjust-apply')];
  byId('live-adjust-choice-wrap').hidden = sessionOverlay.id !== 'vote';
  let pending = false;
  let lastRead = 0;
  function selectedId() { return studioDesigns.selected()?.id; }
  function paint(state) {
    byId('live-phase').textContent = state ? state.phase + (state.visible ? ' · visible' : ' · hidden') : 'Save a design first';
    byId('live-summary').textContent = !state ? '' : ({
      combo:state.total+' gifts in current combo', boss:Math.ceil(state.hp).toLocaleString()+' health remaining',
      vote:state.counts?.join(' / ')+' votes', quest:'Step '+(state.step+1)+' · '+state.stepValue
    })[sessionOverlay.id];
    for (const button of buttons) button.disabled = pending || !state ||
      (button.dataset.command === 'resume' && state.phase !== 'paused') ||
      (button.dataset.command === 'pause' && state.phase !== 'running');
  }
  async function read() {
    const id = selectedId();
    const version = ++lastRead;
    if (!id) { paint(null); return; }
    if (panel.hidden || document.hidden || pending) return;
    try {
      const {state} = await overlayCloud.request('/v1/variants/'+encodeURIComponent(id)+'/live');
      if (version === lastRead && id === selectedId()) paint(state);
    } catch (error) { if (version === lastRead) studioDesigns.status(error.message,true); }
  }
  async function command(action, extra = {}) {
    const id = selectedId();
    if (!id || pending) return;
    if (studioDesigns.state().dirty && ['start','reset'].includes(action)) {
      studioDesigns.status('Save your settings before starting or resetting a session.',true); return;
    }
    if (['start','reset','end'].includes(action) && !confirm({start:'Start a fresh session using the saved rules?',reset:'Reset the totals for this session?',end:'End the current round?'}[action])) return;
    pending = true; ++lastRead;
    buttons.forEach(button => button.disabled = true);
    try {
      await overlayCloud.request('/v1/variants/'+encodeURIComponent(id)+'/live',{method:'POST',body:{action,...extra}});
    } catch (error) { studioDesigns.status(error.message,true); }
    finally { pending = false; await read(); }
  }
  for (const button of panel.querySelectorAll('[data-command]')) button.onclick = () => command(button.dataset.command);
  byId('live-adjust-apply').onclick = () => command('adjust',{value:Number(byId('live-adjust').value),choice:Number(byId('live-adjust-choice').value)});
  new MutationObserver(read).observe(panel,{attributes:true,attributeFilter:['hidden']});
  byId('cloud-variant-select').addEventListener('change',read);
  document.addEventListener('visibilitychange',read);
  const timer = setInterval(read,2000);
  window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
  paint(null);
})();
