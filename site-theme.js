(() => {
  const key = 'kg-appearance';
  const allowed = ['automatic', 'light', 'dark'];
  const system = matchMedia('(prefers-color-scheme: dark)');
  let mode = 'automatic';
  try { const saved = localStorage.getItem(key); if (allowed.includes(saved)) mode = saved; } catch {}
  function apply() {
    document.documentElement.dataset.kgTheme = mode === 'automatic' ? (system.matches ? 'dark' : 'light') : mode;
    document.documentElement.dataset.kgAppearance = mode;
    const preview = document.querySelector('[data-theme-preview]');
    if (preview) {
      const source = document.documentElement.dataset.kgTheme === 'dark' ? '/studio-preview.png' : '/studio-preview-light.png';
      if (preview.getAttribute('src') !== source) preview.src = source;
    }
    const select = document.querySelector('#kg-appearance');
    if (select) select.value = mode;
    document.querySelectorAll('[data-appearance-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.appearanceMode === mode)));
  }
  apply();
  system.addEventListener('change', apply);
  addEventListener('storage', event => {
    if (event.key === key || event.key === null) {
      mode = allowed.includes(event.newValue) ? event.newValue : 'automatic';
      apply();
    }
  });
  document.addEventListener('DOMContentLoaded', () => {
    if (new URLSearchParams(location.search).get('embed') === '1') return;
    const control = document.createElement('div');
    control.className = 'kg-appearance-control';
    const text = document.createElement('span');
    text.textContent = 'Appearance';
    const group = document.createElement('div');
    group.className = 'kg-appearance-modes';
    group.setAttribute('role','group');
    group.setAttribute('aria-label','Appearance');
    const icons = {
      light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
      dark: '<path d="M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z"/>',
      automatic: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4M12 7v7"/>'
    };
    for (const value of ['light','dark','automatic']) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.appearanceMode = value;
      const label = value === 'automatic' ? 'Automatic — follow system appearance' : value[0].toUpperCase() + value.slice(1) + ' mode';
      button.title = label;
      button.setAttribute('aria-label',label);
      button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[value] + '</svg>';
      button.addEventListener('click', () => {
        mode = value;
        try { localStorage.setItem(key,mode); } catch {}
        apply();
      });
      group.append(button);
    }
    control.append(text,group);
    const mount = document.querySelector('.studio-account-panel') || document.querySelector('.site-header nav') || document.querySelector('.obs-dock-manager-header') || document.querySelector('.admin-brand') || document.querySelector('.live-header') || document.body;
    const compact = matchMedia('(max-width: 820px)');
    const placeControl = () => {
      const brand = document.querySelector('.studio-brand');
      if (brand && compact.matches) (document.querySelector('.studio-account-panel')||mount).append(control);
      else mount.append(control);
    };
    placeControl();
    compact.addEventListener('change', placeControl);
    const email=document.querySelector('#cloud-account-email');
    if(email){const showEmail=()=>email.title=email.textContent;new MutationObserver(showEmail).observe(email,{childList:true,characterData:true,subtree:true});showEmail();}
    apply();
  }, { once: true });
})();

// Small interface reactions. Widget renderers own their separate animation styles.
document.addEventListener('DOMContentLoaded', () => {
  function makeIcon(kind) {
    const icon = document.createElement('span');
    icon.className = 'kg-icon kg-icon-' + kind;
    icon.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < (kind === 'rows' ? 6 : 3); i++) icon.append(document.createElement('i'));
    return icon;
  }
  const types = { original: 'carousel', rows: 'rows', 'side-gifts': 'sides', goal: 'goal', 'top-likers': 'podium' };
  document.querySelectorAll('[data-config-tab]').forEach(button => {
    const slot = button.querySelector('.studio-nav-icon');
    if (slot && types[button.dataset.configTab]) slot.replaceChildren(makeIcon(types[button.dataset.configTab]));
  });
  const examples = ['carousel', 'rows', 'sides', 'goal', 'podium'];
  document.querySelectorAll('[data-example]').forEach(button => {if(!button.querySelector('svg'))button.prepend(makeIcon(examples[Number(button.dataset.example)]));});
  document.querySelectorAll('[data-config-tab], [data-example]').forEach(button => {
    let timer;
    button.addEventListener('click', () => {
      const icon = button.querySelector('.kg-icon');
      if (!icon) return;
      clearTimeout(timer);
      icon.classList.remove('is-playing');
      void icon.offsetWidth;
      icon.classList.add('is-playing');
      timer = setTimeout(() => icon.classList.remove('is-playing'), 700);
    });
  });
  const picker = document.querySelector('.example-picker');
  if (picker && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      picker.querySelectorAll('.kg-icon').forEach((icon, index) => {
        setTimeout(() => {
          icon.classList.add('is-playing');
          setTimeout(() => icon.classList.remove('is-playing'), 700);
        }, index * 90);
      });
    }, { threshold: .5 });
    observer.observe(picker);
  }
  const save = document.querySelector('#cloud-save-variant');
  const status = document.querySelector('#cloud-config-status');
  if (save && status) {
    const check = document.createElement('span');
    check.className = 'kg-save-check';
    check.setAttribute('aria-hidden', 'true');
    check.textContent = '✓';
    save.append(check);
    let timer;
    new MutationObserver(() => {
      if (!/^(Saved |Live updated )/.test(status.textContent)) return;
      clearTimeout(timer);
      save.classList.add('kg-save-confirmed');
      timer = setTimeout(() => save.classList.remove('kg-save-confirmed'), 1400);
    }).observe(status, { childList: true, characterData: true, subtree: true });
  }
}, { once: true });
