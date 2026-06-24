const rewardStorageKey = 'reward-overlay-config:v1';
const giftFavoritesStorageKey = 'reward-gift-favorites:v1';
const baseConfig = cloneConfig(window.rewardOverlayConfig || {});
let draftConfig;

const rewardList = document.querySelector('#reward-list');
const template = document.querySelector('#reward-editor-template');
const configState = document.querySelector('#config-state');
const rotateMs = document.querySelector('#rotate-ms');
const holdMs = document.querySelector('#hold-ms');
const labelMs = document.querySelector('#label-ms');
const visibleNext = document.querySelector('#visible-next');
const carouselSounds = document.querySelector('#carousel-sounds');
const carouselAnimations = document.querySelector('#carousel-animations');
const carouselProfileAnimation = document.querySelector('#carousel-profile-animation');
const rewardTotal = document.querySelector('#reward-total');
const rewardEnabled = document.querySelector('#reward-enabled');
const rowsGiftList = document.querySelector('#rows-gift-list');
const rowsGiftTotal = document.querySelector('#rows-gift-total');
const rowsGiftEnabled = document.querySelector('#rows-gift-enabled');
const tabButtons = document.querySelectorAll('[data-config-tab]');
const configPanels = document.querySelectorAll('[data-config-panel]');
const rowsCount = document.querySelector('#rows-count');
const rowsPerRow = document.querySelector('#rows-per-row');
const rowsScrolling = document.querySelector('#rows-scrolling');
const rowsDirections = document.querySelector('#rows-directions');
const rowsSpeeds = document.querySelector('#rows-speeds');
const rowsHeight = document.querySelector('#rows-height');
const rowsGap = document.querySelector('#rows-gap');
const rowsNames = document.querySelector('#rows-names');
const rowsSounds = document.querySelector('#rows-sounds');
const rowsAnimations = document.querySelector('#rows-animations');
const rowsProfileAnimation = document.querySelector('#rows-profile-animation');
const addRewardButton = document.querySelector('#add-reward');
const copyCarouselUrlButton = document.querySelector('#copy-carousel-url');
const copyRowsUrlButton = document.querySelector('#copy-rows-url');
const copyConfigUrlButton = document.querySelector('#copy-config-url');
const loadConfigUrlInput = document.querySelector('#load-config-url');
const loadConfigUrlButton = document.querySelector('#load-config-url-button');
const carouselPreview = document.querySelector('#carousel-preview');
const rowsPreview = document.querySelector('#rows-preview');
const carouselPreviewTest = document.querySelector('#carousel-preview-test');
const rowsPreviewTest = document.querySelector('#rows-preview-test');
const carouselPreviewMute = document.querySelector('#carousel-preview-mute');
const rowsPreviewMute = document.querySelector('#rows-preview-mute');
const themePreset = document.querySelector('#theme-preset');
const themeOpacity = document.querySelector('#theme-opacity');
const themeOpacityLabel = document.querySelector('#theme-opacity-label');
const themeGlowStrength = document.querySelector('#theme-glow-strength');
const themeGlowStrengthLabel = document.querySelector('#theme-glow-strength-label');
const themeColorFields = [
  { key: 'accent', color: document.querySelector('#theme-accent'), hex: document.querySelector('#theme-accent-hex') },
  { key: 'secondary', color: document.querySelector('#theme-secondary'), hex: document.querySelector('#theme-secondary-hex') },
  { key: 'background', color: document.querySelector('#theme-background'), hex: document.querySelector('#theme-background-hex') },
  { key: 'card', color: document.querySelector('#theme-card'), hex: document.querySelector('#theme-card-hex') },
  { key: 'text', color: document.querySelector('#theme-text'), hex: document.querySelector('#theme-text-hex') },
  { key: 'border', color: document.querySelector('#theme-border'), hex: document.querySelector('#theme-border-hex') },
  { key: 'glow', color: document.querySelector('#theme-glow'), hex: document.querySelector('#theme-glow-hex') }
];
const rowsThemePreset = document.querySelector('#rows-theme-preset');
const rowsThemeOpacity = document.querySelector('#rows-theme-opacity');
const rowsThemeOpacityLabel = document.querySelector('#rows-theme-opacity-label');
const rowsThemeGlowStrength = document.querySelector('#rows-theme-glow-strength');
const rowsThemeGlowStrengthLabel = document.querySelector('#rows-theme-glow-strength-label');
const rowsThemeColorFields = [
  { key: 'accent', color: document.querySelector('#rows-theme-accent'), hex: document.querySelector('#rows-theme-accent-hex') },
  { key: 'secondary', color: document.querySelector('#rows-theme-secondary'), hex: document.querySelector('#rows-theme-secondary-hex') },
  { key: 'background', color: document.querySelector('#rows-theme-background'), hex: document.querySelector('#rows-theme-background-hex') },
  { key: 'card', color: document.querySelector('#rows-theme-card'), hex: document.querySelector('#rows-theme-card-hex') },
  { key: 'text', color: document.querySelector('#rows-theme-text'), hex: document.querySelector('#rows-theme-text-hex') },
  { key: 'border', color: document.querySelector('#rows-theme-border'), hex: document.querySelector('#rows-theme-border-hex') },
  { key: 'glow', color: document.querySelector('#rows-theme-glow'), hex: document.querySelector('#rows-theme-glow-hex') }
];
const imageCatalog = new Map();
const giftGridLimit = 80;
const themePresets = {
  'glass-purple': {
    preset: 'glass-purple',
    accent: '#03f5d8',
    secondary: '#531c7b',
    background: '#363a3d',
    card: '#0d0f14',
    text: '#ffffff',
    border: '#ffffff',
    glow: '#c447ff',
    opacity: 0.78,
    glowStrength: 1
  },
  'neon-cyan': {
    preset: 'neon-cyan',
    accent: '#10f4ff',
    secondary: '#3cff9e',
    background: '#07343a',
    card: '#08242b',
    text: '#f2ffff',
    border: '#55f7ff',
    glow: '#10f4ff',
    opacity: 0.82,
    glowStrength: 1.1
  },
  'hot-pink': {
    preset: 'hot-pink',
    accent: '#ff4fd8',
    secondary: '#ffb347',
    background: '#3a1230',
    card: '#240e1e',
    text: '#fff7fd',
    border: '#ff9ee8',
    glow: '#ff4fd8',
    opacity: 0.8,
    glowStrength: 1.15
  },
  gold: {
    preset: 'gold',
    accent: '#ffd83d',
    secondary: '#34d8ff',
    background: '#342714',
    card: '#241b0c',
    text: '#fff8de',
    border: '#ffe58a',
    glow: '#ffd83d',
    opacity: 0.82,
    glowStrength: 0.95
  },
  'minimal-dark': {
    preset: 'minimal-dark',
    accent: '#ffffff',
    secondary: '#8aa0b8',
    background: '#151923',
    card: '#10131b',
    text: '#f4f6fb',
    border: '#586174',
    glow: '#ffffff',
    opacity: 0.72,
    glowStrength: 0.28
  }
};
const defaultTheme = themePresets['glass-purple'];
const soundCatalog = [
  { label: 'No sound', sound: '' },
  { label: 'Disgusting', sound: './sounds/disgusting.mp3' },
  { label: 'Game Cabinet', sound: './sounds/GameCabinet.mp3' },
  { label: 'Heart Me', sound: './sounds/heartmesound.mp3' },
  { label: 'I\'m Fine', sound: './sounds/imfine.mp3' }
];
const availableSounds = new Set(soundCatalog.map(item => item.sound));
let activeConfigTab = 'original';
let rowsBoardScrollState = new Map();
let pageScrollState = { x: 0, y: 0 };
let interactionScrollState = { x: 0, y: 0, focusTarget: null };
let pageFocusTarget = null;
let previewRefreshTimer;
let previewRefreshIndex = 0;
let giftFavorites = loadGiftFavorites();

draftConfig = loadDraftConfig();

function getPageScrollState() {
  const activeElement = document.activeElement;

  return {
    x: window.scrollX,
    y: window.scrollY,
    focusTarget: activeElement && activeElement !== document.body ? activeElement : null
  };
}

function rememberPageScroll() {
  pageScrollState = getPageScrollState();
  pageFocusTarget = pageScrollState.focusTarget;
}

function restorePageScroll(state = pageScrollState) {
  const restore = () => {
    window.scrollTo(state.x, state.y);
    const focusTarget = state.focusTarget || pageFocusTarget;

    if (focusTarget && document.contains(focusTarget)) {
      try {
        focusTarget.focus({ preventScroll: true });
      } catch (error) {
        // ignore focus errors
      }
    }
  };

  requestAnimationFrame(() => {
    restore();
    requestAnimationFrame(restore);
    setTimeout(restore, 80);
    setTimeout(restore, 220);
    setTimeout(restore, 480);
    setTimeout(restore, 900);
  });
}

function renderPreservingScroll() {
  const state = interactionScrollState || getPageScrollState();
  render();
  restorePageScroll(state);
}

function runPreservingScroll(action) {
  const state = getPageScrollState();
  action();
  restorePageScroll(state);
}

function restoreFocusQuietly(target) {
  if (target && document.contains(target)) {
    try {
      target.focus({ preventScroll: true });
    } catch (error) {
      // ignore focus errors
    }
  }
}

function restorePageScrollOnly(state) {
  requestAnimationFrame(() => {
    window.scrollTo(state.x, state.y);
    setTimeout(() => {
      window.scrollTo(state.x, state.y);
      restoreFocusQuietly(state.focusTarget);
    }, 80);
  });
}

function preserveScrollDuring(action) {
  const state = interactionScrollState || getPageScrollState();
  action();
  restorePageScroll(state);
}

function captureInteractionScroll() {
  interactionScrollState = getPageScrollState();
}

document.addEventListener('pointerdown', captureInteractionScroll, { capture: true });
document.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') {
    captureInteractionScroll();
  }
}, { capture: true });

rowsGiftList.addEventListener('scroll', () => {
  rowsBoardScrollState.set('board', rowsGiftList.scrollLeft);
});

addRewardButton.addEventListener('click', addReward);
document.querySelector('#add-row-gift').addEventListener('click', () => addRowGift());
document.querySelector('#save-config').addEventListener('click', saveConfig);
document.querySelector('#export-config').addEventListener('click', exportConfig);
copyCarouselUrlButton.addEventListener('click', () => copyOverlayUrl('index-rewards.html', 'Carousel URL copied'));
copyRowsUrlButton.addEventListener('click', () => copyOverlayUrl('index-rewards-rows.html', 'Rows URL copied'));
copyConfigUrlButton.addEventListener('click', () => copyOverlayUrl('index-rewards-config.html', 'Config URL copied'));
loadConfigUrlButton.addEventListener('click', loadConfigFromUrlInput);
loadConfigUrlInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    loadConfigFromUrlInput();
  }
});
document.querySelector('#reset-config').addEventListener('click', resetConfig);

tabButtons.forEach(button => {
  button.addEventListener('click', () => setActiveTab(button.dataset.configTab));
});

[rotateMs, holdMs, labelMs, visibleNext, carouselSounds, carouselAnimations, carouselProfileAnimation].forEach(input => {
  input.addEventListener('input', () => {
    updateGlobalsFromForm();
    markDirty();
  });
});

[rowsCount, rowsPerRow, rowsScrolling, rowsDirections, rowsSpeeds, rowsHeight, rowsGap, rowsNames, rowsSounds, rowsAnimations, rowsProfileAnimation].forEach(input => {
  input.addEventListener('input', () => {
    updateRowsFromForm();
    markDirty();
    if (input === rowsCount && activeConfigTab === 'rows') {
      renderPreservingScroll();
    }
  });
});

themePreset.addEventListener('change', () => {
  const preset = themePresets[themePreset.value];

  if (preset) {
    const normalized = normalizeTheme(preset);
    draftConfig.carouselTheme = normalized;
    draftConfig.theme = normalized;
    renderThemeForm();
    applyThemeToDocument(getCarouselTheme());
    setState('⚠ Unsaved changes');
    refreshOverlayPreviews();
  }
});

themeColorFields.forEach(field => {
  field.color.addEventListener('input', () => {
    field.hex.value = field.color.value;
    updateThemeFromForm();
    markDirty();
  });

  field.hex.addEventListener('input', () => {
    const hex = normalizeHex(field.hex.value, '');

    if (hex) {
      field.color.value = hex;
    }

    updateThemeFromForm();
    markDirty();
  });
});

[themeOpacity, themeGlowStrength].forEach(input => {
  input.addEventListener('input', () => {
    updateThemeFromForm();
    markDirty();
  });
});

rowsThemePreset.addEventListener('change', () => {
  const preset = themePresets[rowsThemePreset.value];

  if (preset) {
    draftConfig.rowsTheme = normalizeTheme(preset);
    renderThemeForm();
    setState('⚠ Unsaved changes');
    refreshOverlayPreviews();
  }
});

rowsThemeColorFields.forEach(field => {
  field.color.addEventListener('input', () => {
    field.hex.value = field.color.value;
    updateRowsThemeFromForm();
    markDirty();
  });

  field.hex.addEventListener('input', () => {
    const hex = normalizeHex(field.hex.value, '');

    if (hex) {
      field.color.value = hex;
    }

    updateRowsThemeFromForm();
    markDirty();
  });
});

[rowsThemeOpacity, rowsThemeGlowStrength].forEach(input => {
  input.addEventListener('input', () => {
    updateRowsThemeFromForm();
    markDirty();
  });
});

[carouselPreviewTest, rowsPreviewTest, carouselPreviewMute, rowsPreviewMute].forEach(input => {
  input?.addEventListener('input', refreshOverlayPreviews);
});

seedImageCatalog();
ensureRowsGiftDefaults();
applyThemeToDocument(getCarouselTheme());
render();

function loadDraftConfig() {
  const urlConfig = readConfigFromHash();
  if (urlConfig) {
    return normalizeConfig(urlConfig);
  }

  try {
    const saved = JSON.parse(localStorage.getItem(rewardStorageKey) || 'null');
    return saved && Array.isArray(saved.rewards) ? normalizeConfig(saved) : normalizeConfig(baseConfig);
  } catch {
    return normalizeConfig(baseConfig);
  }
}

function render() {
  rememberPageScroll();
  rotateMs.value = draftConfig.rotateMs;
  holdMs.value = draftConfig.holdOnGiftMs;
  labelMs.value = draftConfig.labelMs;
  visibleNext.value = draftConfig.visibleNext;
  carouselSounds.value = draftConfig.soundsEnabled === false ? '0' : '1';
  carouselAnimations.value = draftConfig.animationsEnabled === false ? '0' : '1';
  carouselProfileAnimation.value = draftConfig.profileAnimationEnabled === true ? '1' : '0';
  rowsCount.value = draftConfig.rowsOverlay.rows;
  rowsPerRow.value = draftConfig.rowsOverlay.perRow;
  rowsScrolling.value = draftConfig.rowsOverlay.scrollRows;
  rowsDirections.value = draftConfig.rowsOverlay.directions;
  rowsSpeeds.value = draftConfig.rowsOverlay.speeds;
  rowsHeight.value = draftConfig.rowsOverlay.rowHeight;
  rowsGap.value = draftConfig.rowsOverlay.gap;
  rowsNames.value = draftConfig.rowsOverlay.names ? '1' : '0';
  rowsSounds.value = draftConfig.rowsOverlay.soundsEnabled === false ? '0' : '1';
  rowsAnimations.value = draftConfig.rowsOverlay.animationsEnabled === false ? '0' : '1';
  rowsProfileAnimation.value = draftConfig.rowsOverlay.profileAnimationEnabled === true ? '1' : '0';
  renderThemeForm();
  rewardList.innerHTML = '';
  rowsGiftList.innerHTML = '';

  if (activeConfigTab === 'rows') {
    renderRowsGifts();
  } else {
    renderRewardsList();
  }

  updateRewardStats();
  updateRowsGiftStats();
  scheduleOverlayPreviewRefresh();
  restorePageScroll();
}

function renderRewardsList() {
  rewardList.append(createInsertRewardControl(0));

  draftConfig.rewards.forEach((reward, index) => {
    const editor = template.content.firstElementChild.cloneNode(true);
    editor.dataset.index = String(index);

    // Set reward number
    editor.querySelector('.reward-number').textContent = String(index + 1);

    // Setup header
    editor.querySelector('[data-field="enabled"]').checked = reward.enabled !== false;
    editor.querySelector('[data-field="title"]').value = reward.title;
    editor.querySelector('[data-field="triggerType"]').value = reward.triggerType;
    editor.querySelector('[data-field="likesRequired"]').value = reward.likesRequired;
    editor.querySelector('[data-field="likesHeartColor"]').value = reward.likesHeartColor;
    editor.querySelector('[data-field="likesNumberColor"]').value = reward.likesNumberColor;
    editor.querySelector('[data-field="likesHeartSize"]').value = reward.likesHeartSize;
    editor.querySelector('[data-field="likesNumberSize"]').value = reward.likesNumberSize;

    // Setup form fields
    editor.querySelector('[data-field="giftNames"]').value = reward.giftNames.join(', ');
    editor.querySelector('[data-field="giftIds"]').value = reward.giftIds.join(', ');
    editor.querySelector('[data-field="image"]').value = reward.image;
    populateSoundSelect(editor, reward.sound);
    editor.querySelector('[data-field="sound"]').value = reward.sound;
    editor.querySelector('[data-field="volume"]').value = reward.volume;
    populateGiftGrid(editor, reward);
    updateTriggerFields(editor, reward);
    alignAudioPreview(editor);

    // Setup preview
    updatePreview(editor, reward);

    // Setup events
    editor.addEventListener('input', event => {
      if (event.target.matches('[data-gift-search]')) {
        populateGiftGrid(editor, draftConfig.rewards[index], event.target.value);
        return;
      }

      if (event.target.dataset.field) {
        updateRewardFromEditor(index, editor);
        markDirty();
        updateEditorState(editor, draftConfig.rewards[index]);
        if (event.target.matches('[data-field="image"], [data-field="sound"], [data-field="volume"], [data-field="triggerType"], [data-field^="likes"]')) {
          updatePreview(editor, draftConfig.rewards[index]);
        }
      }
    });

    editor.addEventListener('click', event => {
      const actionButton = event.target.closest('[data-action]');
      const action = actionButton?.dataset.action;
      if (!action) return;

      if (action === 'select-gift-catalog') {
        applyGiftSelection(index, editor, actionButton.dataset.image);
        return;
      }

      if (action === 'toggle-gift-favorite') {
        toggleGiftFavorite(actionButton.dataset.image);
        populateGiftGrid(editor, draftConfig.rewards[index], editor.querySelector('[data-gift-search]')?.value || '');
        return;
      }

      if (action === 'play-sound') {
        playSoundPreview(editor, draftConfig.rewards[index]);
        return;
      }

      if (action === 'toggle-details') {
        toggleDetailsSection(editor);
        return;
      }

      handleRewardAction(action, index);
    });

    updateEditorState(editor, reward);
    rewardList.append(editor);
    rewardList.append(createInsertRewardControl(index + 1));
  });
}

function renderRowsGifts() {
  rememberRowsBoardScroll();
  ensureRowsGiftRows();
  rowsGiftList.innerHTML = '';
  rowsGiftList.classList.add('rows-gift-board');

  for (let rowIndex = 1; rowIndex <= draftConfig.rowsOverlay.rows; rowIndex += 1) {
    const column = document.createElement('section');
    const rowGifts = draftConfig.rowsOverlay.gifts
      .map((gift, index) => ({ gift, index }))
      .filter(item => item.gift.row === rowIndex);

    column.className = 'rows-gift-column';
    column.dataset.row = String(rowIndex);
    column.innerHTML = `
      <header class="rows-gift-column-header">
        <strong>Row ${rowIndex}</strong>
        <span>${rowGifts.length} gifts</span>
        ${getRowsGiftSettingsMarkup(rowIndex)}
        <button data-action="delete-row" type="button" title="Delete row">🗑️</button>
      </header>
      <div class="rows-gift-dropzone" data-row-dropzone></div>
    `;

    setupRowsGiftSettings(column, rowIndex);

    const dropzone = column.querySelector('[data-row-dropzone]');
    setupRowsGiftDropzone(dropzone, rowIndex);
    dropzone.addEventListener('scroll', () => {
      rowsBoardScrollState.set(String(rowIndex), dropzone.scrollLeft);
    });

    rowGifts.forEach(({ gift, index }) => {
      dropzone.append(createRowsGiftEditor(gift, index));
    });
    dropzone.append(createAddCard(`Add gift to row ${rowIndex}`, () => addRowGift(rowIndex)));

    const deleteRowButton = column.querySelector('[data-action="delete-row"]');
    deleteRowButton?.addEventListener('click', () => deleteRowsBoardRow(rowIndex));

    rowsGiftList.append(column);
  }

  const newRowDrop = document.createElement('section');
  newRowDrop.className = 'rows-gift-column rows-gift-new-row';
  newRowDrop.dataset.row = 'new';
  newRowDrop.innerHTML = `
    <header class="rows-gift-column-header">
      <strong>New row</strong>
      <span>Drop here or add</span>
    </header>
    <div class="rows-gift-dropzone" data-row-dropzone></div>
  `;
  const newRowDropzone = newRowDrop.querySelector('[data-row-dropzone]');
  setupRowsGiftDropzone(newRowDropzone, 'new');
  newRowDropzone.append(createAddCard('Add new row', addRowsBoardRow));
  rowsGiftList.append(newRowDrop);

  updateRowsGiftStats();
  restoreRowsBoardScroll();
}

function getRowsGiftSettingsMarkup(row) {
  const perRow = getCsvValue(draftConfig.rowsOverlay.perRow, row, 6);
  const speed = getCsvValue(draftConfig.rowsOverlay.speeds, row, 28);
  const direction = getCsvValue(draftConfig.rowsOverlay.directions, row, 'left');
  const isScrolling = getScrollingRowsSet().has(row);

  return `
    <div class="rows-gift-settings" data-row-settings="${row}">
      <label>
        <span>Gifts</span>
        <input data-row-setting="perRow" type="number" min="1" max="12" step="1" value="${escapeAttribute(perRow)}">
      </label>
      <label>
        <span>Scroll</span>
        <input data-row-setting="scroll" type="checkbox"${isScrolling ? ' checked' : ''}>
      </label>
      <label>
        <span>Direction</span>
        <select data-row-setting="direction">
          <option value="left"${direction === 'left' ? ' selected' : ''}>Left</option>
          <option value="right"${direction === 'right' ? ' selected' : ''}>Right</option>
        </select>
      </label>
      <label>
        <span>Speed</span>
        <input data-row-setting="speed" type="number" min="8" max="180" step="1" value="${escapeAttribute(speed)}">
      </label>
    </div>
  `;
}

function setupRowsGiftSettings(column, row) {
  column.querySelectorAll('[data-row-setting]').forEach(input => {
    input.addEventListener('input', () => {
      updateRowsGiftSetting(row, input.dataset.rowSetting, input);
      markDirty();
    });
  });
}

function updateRowsGiftSetting(row, setting, input) {
  if (setting === 'perRow') {
    draftConfig.rowsOverlay.perRow = setCsvValue(draftConfig.rowsOverlay.perRow, row, clamp(Number(input.value), 1, 12), 6);
    rowsPerRow.value = draftConfig.rowsOverlay.perRow;
    return;
  }

  if (setting === 'speed') {
    draftConfig.rowsOverlay.speeds = setCsvValue(draftConfig.rowsOverlay.speeds, row, clamp(Number(input.value), 8, 180), 28);
    rowsSpeeds.value = draftConfig.rowsOverlay.speeds;
    return;
  }

  if (setting === 'direction') {
    draftConfig.rowsOverlay.directions = setCsvValue(draftConfig.rowsOverlay.directions, row, input.value === 'right' ? 'right' : 'left', 'left');
    rowsDirections.value = draftConfig.rowsOverlay.directions;
    return;
  }

  if (setting === 'scroll') {
    const rows = getScrollingRowsSet();
    if (input.checked) {
      rows.add(row);
    } else {
      rows.delete(row);
    }

    draftConfig.rowsOverlay.scrollRows = [...rows].sort((a, b) => a - b).join(',');
    rowsScrolling.value = draftConfig.rowsOverlay.scrollRows;
  }
}

function getCsvValue(value, row, fallback) {
  const items = String(value || '').split(',').map(item => item.trim()).filter(Boolean);
  return items[row - 1] || items[items.length - 1] || fallback;
}

function setCsvValue(value, row, nextValue, fallback) {
  const items = String(value || '').split(',').map(item => item.trim()).filter(Boolean);

  while (items.length < draftConfig.rowsOverlay.rows) {
    items.push(String(items[items.length - 1] || fallback));
  }

  items[row - 1] = String(nextValue);
  return items.slice(0, draftConfig.rowsOverlay.rows).join(',');
}

function removeCsvValue(value, row, fallback) {
  const items = String(value || '').split(',').map(item => item.trim()).filter(Boolean);

  while (items.length < draftConfig.rowsOverlay.rows + 1) {
    items.push(String(items[items.length - 1] || fallback));
  }

  items.splice(row - 1, 1);
  return items.slice(0, draftConfig.rowsOverlay.rows).join(',');
}

function getScrollingRowsSet() {
  const value = String(draftConfig.rowsOverlay.scrollRows || '').trim().toLowerCase();

  if (value === 'all' || value === 'true') {
    return new Set(Array.from({ length: draftConfig.rowsOverlay.rows }, (_, index) => index + 1));
  }

  return new Set(value.split(',').map(item => Number(item.trim())).filter(number => Number.isInteger(number)));
}

function rememberRowsBoardScroll() {
  if (!rowsGiftList.classList.contains('rows-gift-board')) {
    return;
  }

  rowsBoardScrollState.set('board', rowsGiftList.scrollLeft);
  rowsGiftList.querySelectorAll('.rows-gift-column').forEach(column => {
    const row = column.dataset.row;
    const dropzone = column.querySelector('.rows-gift-dropzone');

    if (row && dropzone) {
      rowsBoardScrollState.set(row, dropzone.scrollLeft);
    }
  });
}

function restoreRowsBoardScroll() {
  const state = new Map(rowsBoardScrollState);

  requestAnimationFrame(() => {
    rowsGiftList.scrollLeft = state.get('board') || 0;
    rowsGiftList.querySelectorAll('.rows-gift-column').forEach(column => {
      const row = column.dataset.row;
      const dropzone = column.querySelector('.rows-gift-dropzone');

      if (row && dropzone) {
        dropzone.scrollLeft = state.get(row) || 0;
      }
    });
  });
}

function createAddCard(label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'reward-add-card';
  button.innerHTML = `<span>+</span><strong>${escapeHtml(label)}</strong>`;
  button.addEventListener('click', onClick);
  return button;
}

function createInsertRewardControl(index) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'reward-insert-control';
  button.innerHTML = '<span>+</span>';
  button.title = 'Insert reward card';
  button.addEventListener('click', () => insertReward(index));
  return button;
}

function createRowsGiftEditor(gift, index) {
    const editor = template.content.firstElementChild.cloneNode(true);
    editor.dataset.index = String(index);
    editor.dataset.mode = 'rows';
    editor.draggable = true;

    editor.querySelector('.reward-number').textContent = String(index + 1);
    editor.querySelector('[data-field="enabled"]').checked = gift.enabled !== false;
    editor.querySelector('[data-field="title"]').value = gift.title;
    editor.querySelector('[data-field="triggerType"]').value = gift.triggerType;
    editor.querySelector('[data-field="likesRequired"]').value = gift.likesRequired;
    editor.querySelector('[data-field="likesHeartColor"]').value = gift.likesHeartColor;
    editor.querySelector('[data-field="likesNumberColor"]').value = gift.likesNumberColor;
    editor.querySelector('[data-field="likesHeartSize"]').value = gift.likesHeartSize;
    editor.querySelector('[data-field="likesNumberSize"]').value = gift.likesNumberSize;
    editor.querySelector('[data-field="giftNames"]').value = gift.giftNames.join(', ');
    editor.querySelector('[data-field="giftIds"]').value = gift.giftIds.join(', ');
    editor.querySelector('[data-field="image"]').value = gift.image;
    populateSoundSelect(editor, gift.sound);
    editor.querySelector('[data-field="sound"]').value = gift.sound;
    editor.querySelector('[data-field="volume"]').value = gift.volume;

    populateGiftGrid(editor, gift);
    updateTriggerFields(editor, gift);
    alignAudioPreview(editor);
    updatePreview(editor, gift);

    editor.addEventListener('input', event => {
      if (event.target.matches('[data-gift-search]')) {
        populateGiftGrid(editor, draftConfig.rowsOverlay.gifts[index], event.target.value);
        return;
      }

      if (event.target.dataset.field) {
        updateRowsGiftFromEditor(index, editor);
        markDirty();
        updateEditorState(editor, draftConfig.rowsOverlay.gifts[index]);
        if (event.target.matches('[data-field="image"], [data-field="sound"], [data-field="volume"], [data-field="triggerType"], [data-field^="likes"]')) {
          updatePreview(editor, draftConfig.rowsOverlay.gifts[index]);
        }
      }
    });

    editor.addEventListener('click', event => {
      const actionButton = event.target.closest('[data-action]');
      const action = actionButton?.dataset.action;
      if (!action) return;

      if (action === 'select-gift-catalog') {
        applyRowsGiftSelection(index, editor, actionButton.dataset.image);
        return;
      }

      if (action === 'toggle-gift-favorite') {
        toggleGiftFavorite(actionButton.dataset.image);
        populateGiftGrid(editor, draftConfig.rowsOverlay.gifts[index], editor.querySelector('[data-gift-search]')?.value || '');
        return;
      }

      if (action === 'toggle-details') {
        toggleDetailsSection(editor);
        return;
      }

      if (action === 'play-sound') {
        playSoundPreview(editor, draftConfig.rowsOverlay.gifts[index]);
        return;
      }

      handleRowsGiftAction(action, index);
    });

    updateEditorState(editor, gift);
    editor.addEventListener('dragstart', event => {
      editor.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    });

    editor.addEventListener('dragend', () => {
      editor.classList.remove('is-dragging');
      rowsGiftList.querySelectorAll('.rows-gift-dropzone.is-drag-over').forEach(zone => {
        zone.classList.remove('is-drag-over');
      });
    });

    return editor;
}

function setupRowsGiftDropzone(dropzone, row) {
  dropzone.addEventListener('dragover', event => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    dropzone.classList.add('is-drag-over');
  });

  dropzone.addEventListener('dragleave', event => {
    if (!dropzone.contains(event.relatedTarget)) {
      dropzone.classList.remove('is-drag-over');
    }
  });

  dropzone.addEventListener('drop', event => {
    event.preventDefault();
    dropzone.classList.remove('is-drag-over');

    const sourceIndex = Number(event.dataTransfer.getData('text/plain'));
    const targetEditor = event.target.closest('.reward-editor[data-mode="rows"]');
    const beforeIndex = targetEditor ? Number(targetEditor.dataset.index) : null;
    moveRowsGift(sourceIndex, row, beforeIndex);
  });
}

function moveRowsGift(sourceIndex, row, beforeIndex = null) {
  if (!Number.isInteger(sourceIndex) || !draftConfig.rowsOverlay.gifts[sourceIndex]) {
    return;
  }

  let targetRow = row === 'new' ? draftConfig.rowsOverlay.rows + 1 : Number(row);

  if (!Number.isInteger(targetRow) || targetRow < 1) {
    return;
  }

  if (row === 'new') {
    draftConfig.rowsOverlay.rows = targetRow;
    rowsCount.value = String(targetRow);
  }

  const gifts = draftConfig.rowsOverlay.gifts;
  const movedGift = gifts[sourceIndex];
  const groups = getRowsGiftGroups();

  groups.forEach(group => {
    const index = group.indexOf(movedGift);
    if (index !== -1) {
      group.splice(index, 1);
    }
  });

  while (groups.length < targetRow) {
    groups.push([]);
  }

  movedGift.row = targetRow;

  const targetGroup = groups[targetRow - 1];
  const beforeGift = beforeIndex !== null ? gifts[beforeIndex] : null;
  const insertIndex = beforeGift && beforeGift.row === targetRow ? targetGroup.indexOf(beforeGift) : -1;

  if (insertIndex === -1) {
    targetGroup.push(movedGift);
  } else {
    targetGroup.splice(insertIndex, 0, movedGift);
  }

  draftConfig.rowsOverlay.gifts = groups.flat().map((gift, index) => ({
    ...gift,
    row: clamp(Number(gift.row || 1), 1, draftConfig.rowsOverlay.rows)
  }));

  markDirty();
  renderPreservingScroll();
}

function getRowsGiftGroups() {
  return Array.from({ length: draftConfig.rowsOverlay.rows }, (_, rowIndex) => {
    const row = rowIndex + 1;
    return draftConfig.rowsOverlay.gifts.filter(gift => gift.row === row);
  });
}

function ensureRowsGiftRows() {
  const rowCount = draftConfig.rowsOverlay.rows;
  dedupeRowsGifts();
  const needsAssignment = draftConfig.rowsOverlay.gifts.some(gift => !Number.isInteger(Number(gift.row)));

  if (needsAssignment) {
    const chunkSize = Math.max(1, Math.ceil(draftConfig.rowsOverlay.gifts.length / rowCount));
    draftConfig.rowsOverlay.gifts.forEach((gift, index) => {
      gift.row = clamp(Math.floor(index / chunkSize) + 1, 1, rowCount);
    });
    return;
  }

  draftConfig.rowsOverlay.gifts.forEach(gift => {
    gift.row = clamp(Number(gift.row), 1, rowCount);
  });
}

function dedupeRowsGifts() {
  const seen = new Set();

  draftConfig.rowsOverlay.gifts = [...draftConfig.rowsOverlay.gifts].reverse().filter(gift => {
    const key = getRowsGiftIdentity(gift);

    if (!key) {
      return true;
    }

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  }).reverse();
}

function getRowsGiftIdentity(gift) {
  const ids = (gift.giftIds || []).map(normalizeId).filter(Boolean);
  if (ids.length) {
    return `id:${ids[0]}`;
  }

  const names = (gift.giftNames || []).map(normalizeName).filter(Boolean);
  if (names.length) {
    return `name:${names[0]}`;
  }

  return gift.image ? `image:${normalizePath(gift.image).toLowerCase()}` : '';
}

function seedImageCatalog() {
  (Array.isArray(window.rewardImageCatalog) ? window.rewardImageCatalog : []).forEach(addImageCatalogEntry);

  draftConfig.rewards.forEach(reward => {
    addImagePath(reward.image, getImageLabel(reward.image));
  });
}

function updatePreview(editor, reward) {
  const imagePreview = editor.querySelector('[data-preview="image"]');
  const displayImage = getTriggerIcon(reward) || reward.image;
  imagePreview.onload = () => {
    imagePreview.alt = 'Reward image';
    imagePreview.style.opacity = '1';
  };

  if (displayImage) {
    imagePreview.src = displayImage;
    imagePreview.onerror = () => {
      imagePreview.alt = 'Image not found';
      imagePreview.style.opacity = '0.4';
    };
  } else {
    imagePreview.src = '';
    imagePreview.alt = 'No image selected';
    imagePreview.style.opacity = '0.3';
  }
  
  const volumeLabel = editor.querySelector('[data-label="volume"]');
  const volumeValue = editor.querySelector('[data-field="volume"]');
  if (!volumeLabel || !volumeValue) {
    return;
  }

  const volumePercent = Math.round(volumeValue.value * 100);
  volumeLabel.textContent = `${volumePercent}%`;
}

function ensureRowsGiftDefaults() {
  if (!draftConfig.rowsOverlay.gifts.length) {
    draftConfig.rowsOverlay.gifts = getDefaultRowsGifts().map(normalizeRowsGift);
  }
}

function alignAudioPreview(editor) {
  const audioPreview = editor.querySelector('.audio-preview');
  const soundInput = editor.querySelector('[data-field="sound"]');
  const soundField = soundInput?.closest('.config-field');
  const hint = soundField?.querySelector('.field-hint');

  if (!audioPreview || !soundField || audioPreview.parentElement === soundField) {
    return;
  }

  soundField.insertBefore(audioPreview, hint || null);
}

function populateSoundSelect(editor, selectedSound = '') {
  const select = editor.querySelector('[data-field="sound"]');
  if (!select || select.tagName !== 'SELECT') {
    return;
  }

  const sounds = [...soundCatalog];

  if (selectedSound && !sounds.some(item => item.sound === selectedSound)) {
    sounds.push({ label: getSoundLabel(selectedSound), sound: selectedSound });
  }

  select.innerHTML = sounds.map(item => `
    <option value="${escapeAttribute(item.sound)}">${escapeHtml(item.label)}</option>
  `).join('');
}

function getSoundLabel(soundPath) {
  return String(soundPath || '')
    .split('/')
    .pop()
    .replace(/\.(mp3|ogg|wav|m4a|aac|flac)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Custom sound';
}

function applyGiftSelection(index, editor, imagePath) {
  const gift = getImageCatalogEntry(imagePath);
  if (!gift) return;

  const giftName = gift.name || gift.label || getImageLabel(gift.image);
  const giftId = gift.id || gift.giftId || '';

  editor.querySelector('[data-field="giftNames"]').value = giftName;
  editor.querySelector('[data-field="giftIds"]').value = giftId;

  const titleInput = editor.querySelector('[data-field="title"]');
  if (!titleInput.value.trim() || titleInput.value.trim() === 'New Reward') {
    titleInput.value = giftName;
  }

  if (gift.image) {
    editor.querySelector('[data-field="image"]').value = gift.image;
  }

  updateRewardFromEditor(index, editor);
  markDirty();
  updateEditorState(editor, draftConfig.rewards[index]);
  updatePreview(editor, draftConfig.rewards[index]);
  populateGiftGrid(editor, draftConfig.rewards[index], editor.querySelector('[data-gift-search]')?.value || '');
  setState(`Selected gift: ${giftName}`);
}

function applyRowsGiftSelection(index, editor, imagePath) {
  const gift = getImageCatalogEntry(imagePath);
  if (!gift) return;

  const giftName = gift.name || gift.label || getImageLabel(gift.image);
  const giftId = gift.id || gift.giftId || '';

  editor.querySelector('[data-field="giftNames"]').value = giftName;
  editor.querySelector('[data-field="giftIds"]').value = giftId;
  editor.querySelector('[data-field="image"]').value = gift.image || '';

  const titleInput = editor.querySelector('[data-field="title"]');
  if (!titleInput.value.trim() || titleInput.value.trim() === 'New Row Gift') {
    titleInput.value = giftName;
  }

  updateRowsGiftFromEditor(index, editor);
  markDirty();
  updateEditorState(editor, draftConfig.rowsOverlay.gifts[index]);
  updatePreview(editor, draftConfig.rowsOverlay.gifts[index]);
  populateGiftGrid(editor, draftConfig.rowsOverlay.gifts[index], editor.querySelector('[data-gift-search]')?.value || '');
  setState(`Selected row gift: ${giftName}`);
}

function populateGiftGrid(editor, reward, filter = '') {
  const grid = editor.querySelector('[data-gift-grid]');
  if (!grid) return;

  const selectedEntry = getSelectedGiftEntry(reward);
  const selectedImage = selectedEntry?.image || '';
  const query = normalizeName(filter);
  const matches = getGiftCatalogEntries().filter(entry => {
    if (!query) return true;

    const haystack = [
      entry.name,
      entry.label,
      entry.id,
      entry.giftId
    ].filter(Boolean).join(' ');

    return normalizeName(haystack).includes(query);
  });
  const sortedMatches = sortGiftEntriesForPicker(matches);
  const entries = getVisibleGiftEntries(sortedMatches, selectedEntry);

  if (!matches.length) {
    grid.innerHTML = '<p class="gift-catalog-empty">No gifts found</p>';
    return;
  }

  grid.innerHTML = entries.map(entry => {
    const selected = entry.image === selectedImage ? ' is-selected' : '';
    const favorite = isGiftFavorite(entry.image);
    const favoriteClass = favorite ? ' is-favorite' : '';
    const favoriteLabel = favorite ? 'Remove from favourites' : 'Add to favourites';

    return `
      <div class="gift-catalog-card${selected}${favoriteClass}" title="${escapeAttribute(entry.label)}">
        <button data-action="toggle-gift-favorite" data-image="${escapeAttribute(entry.image)}" type="button" class="gift-favorite-toggle" title="${favoriteLabel}" aria-label="${favoriteLabel}">${favorite ? '★' : '☆'}</button>
        <button data-action="select-gift-catalog" data-image="${escapeAttribute(entry.image)}" type="button" class="gift-catalog-select">
          <img src="${escapeAttribute(entry.image)}" alt="" loading="lazy" decoding="async">
          <strong>${escapeHtml(entry.label)}</strong>
        </button>
      </div>
    `;
  }).join('') + getGiftGridSummary(sortedMatches.length, entries.length);
}

function getVisibleGiftEntries(matches, selectedEntry) {
  const visible = matches.slice(0, giftGridLimit);

  if (selectedEntry && !visible.some(entry => entry.image === selectedEntry.image)) {
    visible.unshift(selectedEntry);
  }

  return visible;
}

function sortGiftEntriesForPicker(entries) {
  return [...entries].sort((first, second) => {
    const firstFavorite = isGiftFavorite(first.image) ? 0 : 1;
    const secondFavorite = isGiftFavorite(second.image) ? 0 : 1;

    if (firstFavorite !== secondFavorite) {
      return firstFavorite - secondFavorite;
    }

    return first.label.localeCompare(second.label);
  });
}

function getGiftFavoriteKey(imagePath) {
  return normalizePath(imagePath).toLowerCase();
}

function isGiftFavorite(imagePath) {
  return giftFavorites.has(getGiftFavoriteKey(imagePath));
}

function toggleGiftFavorite(imagePath) {
  const key = getGiftFavoriteKey(imagePath);
  const entry = getImageCatalogEntry(imagePath);

  if (!key || !entry) {
    return;
  }

  if (giftFavorites.has(key)) {
    giftFavorites.delete(key);
    setState(`Removed favourite: ${entry.label}`);
  } else {
    giftFavorites.add(key);
    setState(`Added favourite: ${entry.label}`);
  }

  saveGiftFavorites();
}

function loadGiftFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem(giftFavoritesStorageKey) || '[]');
    return new Set(Array.isArray(saved) ? saved.map(getGiftFavoriteKey).filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

function saveGiftFavorites() {
  localStorage.setItem(giftFavoritesStorageKey, JSON.stringify([...giftFavorites]));
}

function getGiftGridSummary(total, visible) {
  if (total <= visible) {
    return '';
  }

  return `<p class="gift-catalog-empty">Showing ${visible} of ${total}; search to narrow the catalogue</p>`;
}

function getSelectedGiftEntry(reward) {
  const giftNames = reward?.giftNames || [];
  const giftIds = reward?.giftIds || [];
  const normalizedNames = giftNames.map(normalizeName);
  const normalizedIds = giftIds.map(id => String(id));

  return getGiftCatalogEntries().find(entry => {
    const id = String(entry.id || entry.giftId || '');
    return normalizedNames.includes(normalizeName(entry.name || entry.label)) || (id && normalizedIds.includes(id));
  });
}

function addImageCatalogEntry(entry) {
  if (!entry || typeof entry !== 'object') return;

  const imagePath = entry.image || entry.path || entry.url;
  const label = entry.label || entry.name || getImageLabel(imagePath);
  addImagePath(imagePath, label, entry);
}

function addImagePath(imagePath, label = '', details = {}) {
  if (!imagePath || (!isImagePath(imagePath) && !isHostedImagePath(imagePath))) return;

  const normalizedPath = normalizePath(imagePath);
  const key = normalizedPath.toLowerCase();
  const current = imageCatalog.get(key) || {};
  const id = normalizeId(details.id || details.giftId || current.id || current.giftId || getIdFromLabel(label || details.label || current.label) || getIdFromImagePath(normalizedPath));

  imageCatalog.set(key, {
    ...current,
    ...details,
    id,
    image: normalizedPath,
    label: getDisplayLabel(label || details.name || current.label || getImageLabel(normalizedPath))
  });
}

function getImageCatalogEntries() {
  return [...imageCatalog.values()].sort((first, second) => first.label.localeCompare(second.label));
}

function getGiftCatalogEntries() {
  return getImageCatalogEntries().filter(entry => entry.image);
}

function getImageCatalogEntry(imagePath) {
  return imageCatalog.get(normalizePath(imagePath).toLowerCase());
}

function getRewardImagePath(file) {
  const relativePath = normalizePath(file.webkitRelativePath || file.name);
  const rewardsIndex = relativePath.toLowerCase().lastIndexOf('rewards/');

  if (rewardsIndex !== -1) {
    return `./${relativePath.slice(rewardsIndex)}`;
  }

  return `./rewards/${file.name}`;
}

function normalizePath(path) {
  const normalized = String(path || '').replace(/\\/g, '/').replace(/^\.?\//, '');
  return normalized.startsWith('rewards/') ? `./${normalized}` : normalized;
}

function isImageFile(file) {
  return file?.type?.startsWith('image/') || isImagePath(file?.name);
}

function isImagePath(path) {
  return /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(String(path || ''));
}

function isHostedImagePath(path) {
  return /^(https?:\/\/|data:image\/)/i.test(String(path || ''));
}

function getImageLabel(imagePath) {
  const filename = String(imagePath || '').replace(/^\.\/rewards\//, '').split('/').pop() || '';
  return getDisplayLabel(filename);
}

function getDisplayLabel(label) {
  return String(label || '')
    .replace(/\.(avif|gif|jpe?g|png|svg|webp)$/i, '')
    .replace(/^\d+[_ -]+/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getIdFromLabel(label) {
  const match = String(label || '').match(/\((\d+)\)\s*$/);
  return match ? match[1] : '';
}

function getIdFromImagePath(imagePath) {
  const filename = String(imagePath || '').split('/').pop() || '';
  const match = filename.match(/^(\d+)[_ -]+/);
  return match ? match[1] : '';
}

function playSoundPreview(editor, reward) {
  if (!reward.sound) return;
  
  const audio = new Audio(reward.sound);
  audio.volume = reward.volume;
  audio.play().catch(() => {
    alert('Could not play sound. Check the file path.');
  });
}

function toggleDetailsSection(editor) {
  const details = editor.querySelector('.reward-editor-details');
  details.classList.toggle('collapsed');
}

function updateEditorState(editor, reward) {
  editor.classList.toggle('is-disabled', reward.enabled === false);
}

function updateRewardStats() {
  const total = draftConfig.rewards.length;
  const enabled = draftConfig.rewards.filter(r => r.enabled !== false).length;
  rewardTotal.textContent = String(total);
  rewardEnabled.textContent = String(enabled);
}

function updateRowsGiftStats() {
  const total = draftConfig.rowsOverlay.gifts.length;
  const enabled = draftConfig.rowsOverlay.gifts.filter(gift => gift.enabled !== false).length;
  rowsGiftTotal.textContent = String(total);
  rowsGiftEnabled.textContent = String(enabled);
}

function setActiveTab(tabName) {
  activeConfigTab = tabName;

  tabButtons.forEach(button => {
    button.classList.toggle('is-active', button.dataset.configTab === tabName);
  });

  configPanels.forEach(panel => {
    panel.hidden = panel.dataset.configPanel !== tabName;
  });

  addRewardButton.hidden = true;
  renderPreservingScroll();
}

function updateGlobalsFromForm() {
  draftConfig.rotateMs = numberOrDefault(rotateMs.value, 2600);
  draftConfig.holdOnGiftMs = numberOrDefault(holdMs.value, 6500);
  draftConfig.labelMs = numberOrDefault(labelMs.value, 2600);
  draftConfig.visibleNext = clamp(numberOrDefault(visibleNext.value, 3), 0, 3);
  draftConfig.soundsEnabled = carouselSounds.value !== '0';
  draftConfig.animationsEnabled = carouselAnimations.value !== '0';
  draftConfig.profileAnimationEnabled = carouselProfileAnimation.value === '1';
  updateThemeFromForm();
}

function updateRowsFromForm() {
  draftConfig.rowsOverlay = normalizeRowsOverlay({
    rows: rowsCount.value,
    perRow: rowsPerRow.value,
    scrollRows: rowsScrolling.value,
    directions: rowsDirections.value,
    speeds: rowsSpeeds.value,
    rowHeight: rowsHeight.value,
    gap: rowsGap.value,
    names: rowsNames.value !== '0',
    soundsEnabled: rowsSounds.value !== '0',
    animationsEnabled: rowsAnimations.value !== '0',
    profileAnimationEnabled: rowsProfileAnimation.value === '1',
    gifts: draftConfig.rowsOverlay.gifts
  });
  ensureRowsGiftRows();
}

function renderThemeForm() {
  const theme = getCarouselTheme();
  themePreset.value = themePresets[theme.preset] ? theme.preset : 'custom';

  themeColorFields.forEach(field => {
    const value = normalizeHex(theme[field.key], defaultTheme[field.key]);
    field.color.value = value;
    field.hex.value = value;
  });

  themeOpacity.value = String(theme.opacity);
  themeGlowStrength.value = String(theme.glowStrength);
  themeOpacityLabel.textContent = `${Math.round(theme.opacity * 100)}%`;
  themeGlowStrengthLabel.textContent = `${Math.round(theme.glowStrength * 100)}%`;

  const rowsTheme = getRowsTheme();
  rowsThemePreset.value = themePresets[rowsTheme.preset] ? rowsTheme.preset : 'custom';

  rowsThemeColorFields.forEach(field => {
    const value = normalizeHex(rowsTheme[field.key], defaultTheme[field.key]);
    field.color.value = value;
    field.hex.value = value;
  });

  rowsThemeOpacity.value = String(rowsTheme.opacity);
  rowsThemeGlowStrength.value = String(rowsTheme.glowStrength);
  rowsThemeOpacityLabel.textContent = `${Math.round(rowsTheme.opacity * 100)}%`;
  rowsThemeGlowStrengthLabel.textContent = `${Math.round(rowsTheme.glowStrength * 100)}%`;
}

function updateThemeFromForm() {
  const nextTheme = {
    preset: themePreset.value,
    opacity: clamp(Number(themeOpacity.value), 0.35, 1),
    glowStrength: clamp(Number(themeGlowStrength.value), 0, 1.5)
  };

  themeColorFields.forEach(field => {
    nextTheme[field.key] = normalizeHex(field.hex.value, defaultTheme[field.key]);
  });

  const preset = themePresets[nextTheme.preset];
  if (!preset || !themesMatch(nextTheme, preset)) {
    nextTheme.preset = 'custom';
    themePreset.value = 'custom';
  }

  const normalized = normalizeTheme(nextTheme);
  draftConfig.carouselTheme = normalized;
  draftConfig.theme = normalized;
  themeOpacityLabel.textContent = `${Math.round(draftConfig.carouselTheme.opacity * 100)}%`;
  themeGlowStrengthLabel.textContent = `${Math.round(draftConfig.carouselTheme.glowStrength * 100)}%`;
  applyThemeToDocument(getCarouselTheme());
}

function updateRowsThemeFromForm() {
  const nextTheme = {
    preset: rowsThemePreset.value,
    opacity: clamp(Number(rowsThemeOpacity.value), 0.35, 1),
    glowStrength: clamp(Number(rowsThemeGlowStrength.value), 0, 1.5)
  };

  rowsThemeColorFields.forEach(field => {
    nextTheme[field.key] = normalizeHex(field.hex.value, defaultTheme[field.key]);
  });

  const preset = themePresets[nextTheme.preset];
  if (!preset || !themesMatch(nextTheme, preset)) {
    nextTheme.preset = 'custom';
    rowsThemePreset.value = 'custom';
  }

  const normalized = normalizeTheme(nextTheme);
  draftConfig.rowsTheme = normalized;
  rowsThemeOpacityLabel.textContent = `${Math.round(draftConfig.rowsTheme.opacity * 100)}%`;
  rowsThemeGlowStrengthLabel.textContent = `${Math.round(draftConfig.rowsTheme.glowStrength * 100)}%`;
}

function updateRewardFromEditor(index, editor) {
  const reward = draftConfig.rewards[index];
  reward.enabled = editor.querySelector('[data-field="enabled"]').checked;
  reward.title = editor.querySelector('[data-field="title"]').value.trim() || 'Reward';
  reward.triggerType = normalizeTriggerType(editor.querySelector('[data-field="triggerType"]').value);
  reward.likesRequired = clamp(Math.floor(Number(editor.querySelector('[data-field="likesRequired"]').value) || 50), 1, 1000000000);
  reward.likesHeartColor = normalizeHex(editor.querySelector('[data-field="likesHeartColor"]').value, '#ef233c');
  reward.likesNumberColor = normalizeHex(editor.querySelector('[data-field="likesNumberColor"]').value, '#ffffff');
  reward.likesHeartSize = clamp(Math.floor(Number(editor.querySelector('[data-field="likesHeartSize"]').value) || 160), 40, 160);
  reward.likesNumberSize = clamp(Math.floor(Number(editor.querySelector('[data-field="likesNumberSize"]').value) || 96), 16, 96);
  reward.giftNames = splitList(editor.querySelector('[data-field="giftNames"]').value);
  reward.giftIds = splitList(editor.querySelector('[data-field="giftIds"]').value);
  reward.image = editor.querySelector('[data-field="image"]').value.trim();
  reward.sound = editor.querySelector('[data-field="sound"]').value.trim();
  reward.volume = clamp(Number(editor.querySelector('[data-field="volume"]').value), 0, 1);
  reward.useGiftImage = false;
  reward.giftImageNames = [];
  reward.giftImageIds = [];
  updateTriggerFields(editor, reward);

  // Propagate title changes to any matching rows overlay gifts so rows names stay in sync.
  if (draftConfig.rowsOverlay && Array.isArray(draftConfig.rowsOverlay.gifts)) {
    try {
      const rewardIds = (reward.giftIds || []).map(i => normalizeId(i)).filter(Boolean);
      const rewardNames = (reward.giftNames || []).map(n => normalizeName(n)).filter(Boolean);

      draftConfig.rowsOverlay.gifts.forEach(gift => {
        const giftIds = (gift.giftIds || []).map(i => normalizeId(i)).filter(Boolean);
        const giftNames = (gift.giftNames || []).map(n => normalizeName(n)).filter(Boolean);

        const idMatch = giftIds.some(id => rewardIds.includes(id));
        const nameMatch = giftNames.some(name => rewardNames.includes(name));

        if (reward.triggerType === 'gift' && normalizeTriggerType(gift.triggerType) === 'gift' && (idMatch || nameMatch)) {
          gift.title = reward.title;
        }
      });
    } catch (err) {
      // ignore propagation errors
    }
  }

  // Update any open rows editors in the config UI so their title inputs reflect the change.
  try {
    rowsGiftList.querySelectorAll('.reward-editor[data-mode="rows"]').forEach(editor => {
      const idx = Number(editor.dataset.index);
      const gift = draftConfig.rowsOverlay.gifts[idx];
      if (!gift) return;

      const giftIds = (gift.giftIds || []).map(normalizeId).filter(Boolean);
      const giftNames = (gift.giftNames || []).map(normalizeName).filter(Boolean);
      const idMatch = giftIds.some(id => (reward.giftIds || []).map(normalizeId).includes(id));
      const nameMatch = giftNames.some(n => (reward.giftNames || []).map(normalizeName).includes(n));

      if (reward.triggerType === 'gift' && normalizeTriggerType(gift.triggerType) === 'gift' && (idMatch || nameMatch)) {
        const titleInput = editor.querySelector('[data-field="title"]');
        if (titleInput) titleInput.value = reward.title;
        updateEditorState(editor, gift);
        updatePreview(editor, gift);
      }
    });
  } catch (err) {
    // ignore UI sync errors
  }

  // Post a message to the rows preview iframe to update visible tile text without a reload.
  try {
    if (rowsPreview?.contentWindow) {
      const updates = draftConfig.rowsOverlay.gifts.map(g => ({
        keys: getGiftKeys({ ids: g.giftIds || [], names: g.giftNames || [] }),
        title: g.title
      }));

      rowsPreview.contentWindow.postMessage({ type: 'rows:updateTitles', updates }, '*');
    }
  } catch (err) {
    // ignore postMessage errors
  }
}

function updateRowsGiftFromEditor(index, editor) {
  const gift = draftConfig.rowsOverlay.gifts[index];
  gift.enabled = editor.querySelector('[data-field="enabled"]').checked;
  gift.title = editor.querySelector('[data-field="title"]').value.trim() || 'Row Gift';
  gift.triggerType = normalizeTriggerType(editor.querySelector('[data-field="triggerType"]').value);
  gift.likesRequired = clamp(Math.floor(Number(editor.querySelector('[data-field="likesRequired"]').value) || 50), 1, 1000000000);
  gift.likesHeartColor = normalizeHex(editor.querySelector('[data-field="likesHeartColor"]').value, '#ef233c');
  gift.likesNumberColor = normalizeHex(editor.querySelector('[data-field="likesNumberColor"]').value, '#ffffff');
  gift.likesHeartSize = clamp(Math.floor(Number(editor.querySelector('[data-field="likesHeartSize"]').value) || 160), 40, 160);
  gift.likesNumberSize = clamp(Math.floor(Number(editor.querySelector('[data-field="likesNumberSize"]').value) || 96), 16, 96);
  gift.giftNames = splitList(editor.querySelector('[data-field="giftNames"]').value);
  gift.giftIds = splitList(editor.querySelector('[data-field="giftIds"]').value);
  gift.image = editor.querySelector('[data-field="image"]').value.trim();
  gift.sound = editor.querySelector('[data-field="sound"]').value.trim();
  gift.volume = clamp(Number(editor.querySelector('[data-field="volume"]').value), 0, 1);
  gift.row = clamp(Number(gift.row || 1), 1, draftConfig.rowsOverlay.rows);
  updateTriggerFields(editor, gift);
}

function updateTriggerFields(editor, item) {
  const triggerType = normalizeTriggerType(item?.triggerType);
  editor.dataset.triggerType = triggerType;
  const likesField = editor.querySelector('[data-likes-settings]');
  const imageFields = editor.querySelector('[data-gift-search]')?.closest('.config-field-group');

  if (likesField) {
    likesField.hidden = triggerType !== 'likes';
  }

  if (imageFields) {
    imageFields.hidden = triggerType !== 'gift';
  }
}

function handleRewardAction(action, index) {
  if (action === 'up' && index > 0) {
    swapRewards(index, index - 1);
  }

  if (action === 'down' && index < draftConfig.rewards.length - 1) {
    swapRewards(index, index + 1);
  }

  if (action === 'duplicate') {
    draftConfig.rewards.splice(index + 1, 0, cloneConfig(draftConfig.rewards[index]));
  }

  if (action === 'delete') {
    if (confirm('Delete this reward?')) {
      draftConfig.rewards.splice(index, 1);
    } else {
      return;
    }
  }

  markDirty();
  renderPreservingScroll();
}

function handleRowsGiftAction(action, index) {
  const gifts = draftConfig.rowsOverlay.gifts;

  if (action === 'up' && index > 0) {
    [gifts[index], gifts[index - 1]] = [gifts[index - 1], gifts[index]];
  }

  if (action === 'down' && index < gifts.length - 1) {
    [gifts[index], gifts[index + 1]] = [gifts[index + 1], gifts[index]];
  }

  if (action === 'duplicate') {
    gifts.splice(index + 1, 0, cloneConfig(gifts[index]));
  }

  if (action === 'delete') {
    if (confirm('Delete this row gift?')) {
      gifts.splice(index, 1);
    } else {
      return;
    }
  }

  markDirty();
  renderPreservingScroll();
}

function swapRewards(first, second) {
  const rewards = draftConfig.rewards;
  [rewards[first], rewards[second]] = [rewards[second], rewards[first]];
}

function addReward() {
  insertReward(draftConfig.rewards.length);
}

function insertReward(index) {
  draftConfig.rewards.splice(index, 0, {
    enabled: false,
    title: 'New Reward',
    triggerType: 'gift',
    likesRequired: 50,
    likesHeartColor: '#ef233c',
    likesNumberColor: '#ffffff',
    likesHeartSize: 160,
    likesNumberSize: 96,
    giftNames: [],
    giftIds: [],
    image: '',
    useGiftImage: false,
    giftImageNames: [],
    giftImageIds: [],
    sound: '',
    volume: 0.85
  });

  markDirty();
  renderPreservingScroll();
}

function addRowGift(row = draftConfig.rowsOverlay.rows) {
  draftConfig.rowsOverlay.gifts.push({
    enabled: true,
    title: 'New Row Gift',
    triggerType: 'gift',
    likesRequired: 50,
    likesHeartColor: '#ef233c',
    likesNumberColor: '#ffffff',
    likesHeartSize: 160,
    likesNumberSize: 96,
    giftNames: [],
    giftIds: [],
    image: '',
    row: clamp(Number(row), 1, draftConfig.rowsOverlay.rows),
    sound: '',
    volume: 0.85
  });

  markDirty();
  renderPreservingScroll();
}

function addRowsBoardRow() {
  draftConfig.rowsOverlay.rows += 1;
  rowsCount.value = String(draftConfig.rowsOverlay.rows);
  draftConfig.rowsOverlay.perRow = setCsvValue(draftConfig.rowsOverlay.perRow, draftConfig.rowsOverlay.rows, getCsvValue(draftConfig.rowsOverlay.perRow, draftConfig.rowsOverlay.rows - 1, 6), 6);
  draftConfig.rowsOverlay.directions = setCsvValue(draftConfig.rowsOverlay.directions, draftConfig.rowsOverlay.rows, getCsvValue(draftConfig.rowsOverlay.directions, draftConfig.rowsOverlay.rows - 1, 'left'), 'left');
  draftConfig.rowsOverlay.speeds = setCsvValue(draftConfig.rowsOverlay.speeds, draftConfig.rowsOverlay.rows, getCsvValue(draftConfig.rowsOverlay.speeds, draftConfig.rowsOverlay.rows - 1, 28), 28);
  updateRowsFromForm();
  markDirty();
  renderPreservingScroll();
}

function deleteRowsBoardRow(row) {
  const rowIndex = Number(row);
  if (!Number.isInteger(rowIndex) || rowIndex < 1 || rowIndex > draftConfig.rowsOverlay.rows) {
    return;
  }

  if (!confirm(`Delete row ${rowIndex} and all its cards?`)) {
    return;
  }

  const scrollingRows = getScrollingRowsSet();

  draftConfig.rowsOverlay.gifts = draftConfig.rowsOverlay.gifts
    .filter(gift => Number(gift.row) !== rowIndex)
    .map(gift => ({
      ...gift,
      row: Number(gift.row) > rowIndex ? Number(gift.row) - 1 : Number(gift.row)
    }));

  draftConfig.rowsOverlay.rows = Math.max(1, draftConfig.rowsOverlay.rows - 1);
  rowsCount.value = String(draftConfig.rowsOverlay.rows);
  draftConfig.rowsOverlay.perRow = removeCsvValue(draftConfig.rowsOverlay.perRow, rowIndex, 6);
  draftConfig.rowsOverlay.directions = removeCsvValue(draftConfig.rowsOverlay.directions, rowIndex, 'left');
  draftConfig.rowsOverlay.speeds = removeCsvValue(draftConfig.rowsOverlay.speeds, rowIndex, 28);
  draftConfig.rowsOverlay.scrollRows = [...scrollingRows]
    .filter(nextRow => nextRow !== rowIndex)
    .map(nextRow => nextRow > rowIndex ? nextRow - 1 : nextRow)
    .sort((a, b) => a - b)
    .join(',');
  updateRowsFromForm();
  markDirty();
  renderPreservingScroll();
}

function saveConfig() {
  updateGlobalsFromForm();
  updateRowsFromForm();
  updateRowsThemeFromForm();
  localStorage.setItem(rewardStorageKey, JSON.stringify(draftConfig));
  setState('✓ Saved for this browser');
}

function resetConfig() {
  if (!confirm('Reset all rewards to file config? This cannot be undone.')) return;
  draftConfig = normalizeConfig(baseConfig);
  localStorage.removeItem(rewardStorageKey);
  if (window.location.hash) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }
  setState('✓ Reset to file config');
  renderPreservingScroll();
}

function exportConfig() {
  updateGlobalsFromForm();
  updateRowsFromForm();
  updateRowsThemeFromForm();
  const content = `window.rewardOverlayConfig = ${JSON.stringify(draftConfig, null, 2)};\n`;
  const blob = new Blob([content], { type: 'text/javascript' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'rewards-config.js';
  link.click();
  URL.revokeObjectURL(link.href);
  setState('✓ Exported');
}

function copyOverlayUrl(page, successText) {
  updateGlobalsFromForm();
  updateRowsFromForm();
  updateRowsThemeFromForm();

  const url = getUrlForPage(page, draftConfig);

  copyText(url.toString()).then(() => {
    setState(`✓ ${successText}`);
  }).catch(() => {
    setState('Could not copy URL');
  });
}

function loadConfigFromUrlInput() {
  const value = loadConfigUrlInput.value.trim();
  if (!value) {
    setState('Paste a config URL first');
    loadConfigUrlInput.focus();
    return;
  }

  const loadedConfig = readConfigFromUrl(value);
  if (!loadedConfig) {
    setState('Could not find a valid config in that URL');
    loadConfigUrlInput.select();
    return;
  }

  draftConfig = normalizeConfig(loadedConfig);
  ensureRowsGiftDefaults();
  applyThemeToDocument(getCarouselTheme());
  render();
  setState('✓ URL loaded — unsaved changes');
}

function getUrlForPage(page, config = draftConfig, options = {}) {
  const url = new URL(window.location.href);
  const pathParts = url.pathname.split('/');
  pathParts[pathParts.length - 1] = page;
  url.pathname = pathParts.join('/');
  const search = new URLSearchParams(getShareSearchParams());
  if (options.test) {
    search.set('test', '1');
  } else if (options.preview) {
    search.set('preview', '1');
  }

  if (options.mute) {
    search.set('mute', '1');
  }

  if (options.preview || options.test) {
    search.set('previewRefresh', String(options.previewRefresh || 0));
  }
  url.search = search.toString();
  url.hash = `config=${encodeURIComponent(encodeConfig(config))}`;
  return url;
}

function getShareSearchParams() {
  const currentParams = new URLSearchParams(window.location.search);
  const shareParams = new URLSearchParams();
  const endpoint = currentParams.get('endpoint');

  if (endpoint) {
    shareParams.set('endpoint', endpoint);
  }

  return shareParams.toString();
}

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }

  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.append(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  return copied ? Promise.resolve() : Promise.reject(new Error('copy failed'));
}

function readConfigFromHash() {
  const encoded = new URLSearchParams(window.location.hash.slice(1)).get('config');

  return decodeConfigValue(encoded);
}

function readConfigFromUrl(value) {
  try {
    const url = new URL(value, window.location.href);
    const encoded = new URLSearchParams(url.hash.slice(1)).get('config');
    if (encoded) {
      return decodeConfigValue(encoded);
    }
  } catch {
    // Fall through to accepting a copied hash or encoded config value.
  }

  const text = String(value || '').trim().replace(/^#/, '');
  const encoded = new URLSearchParams(text).get('config') || text;
  return decodeConfigValue(encoded);
}

function decodeConfigValue(encoded) {
  if (!encoded) {
    return null;
  }

  try {
    return expandCompactConfig(JSON.parse(decodeURIComponent(escape(atob(toBase64(encoded))))));
  } catch {
    return null;
  }
}

function encodeConfig(config) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(compactConfigForUrl(config)))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function toBase64(value) {
  const base64 = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  return base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
}

function compactConfigForUrl(inputConfig) {
  const config = normalizeConfig(inputConfig || {});
  return removeEmptyUrlFields({
    _: 'r2',
    a: config.rotateMs !== 2600 ? config.rotateMs : undefined,
    b: config.holdOnGiftMs !== 6500 ? config.holdOnGiftMs : undefined,
    c: config.labelMs !== 2600 ? config.labelMs : undefined,
    d: config.visibleNext !== 3 ? config.visibleNext : undefined,
    e: config.soundsEnabled === false ? 0 : undefined,
    f: config.animationsEnabled === false ? 0 : undefined,
    h: config.profileAnimationEnabled === true ? 1 : undefined,
    t: compactThemeForUrl(config.theme),
    u: compactThemeForUrl(config.carouselTheme),
    v: compactThemeForUrl(config.rowsTheme),
    o: compactRowsOverlayForUrl(config.rowsOverlay),
    g: config.rewards.map(compactRewardForUrl)
  });
}

function compactThemeForUrl(theme) {
  const normalized = normalizeTheme(theme || {});
  const presetTheme = themePresets[normalized.preset] || defaultTheme;
  return removeEmptyUrlFields({
    p: normalized.preset !== 'glass-purple' ? normalized.preset : undefined,
    a: normalizeHex(normalized.accent, '') !== normalizeHex(presetTheme.accent, '') ? normalized.accent : undefined,
    b: normalizeHex(normalized.secondary, '') !== normalizeHex(presetTheme.secondary, '') ? normalized.secondary : undefined,
    c: normalizeHex(normalized.background, '') !== normalizeHex(presetTheme.background, '') ? normalized.background : undefined,
    d: normalizeHex(normalized.card, '') !== normalizeHex(presetTheme.card, '') ? normalized.card : undefined,
    e: normalizeHex(normalized.text, '') !== normalizeHex(presetTheme.text, '') ? normalized.text : undefined,
    f: normalizeHex(normalized.border, '') !== normalizeHex(presetTheme.border, '') ? normalized.border : undefined,
    g: normalizeHex(normalized.glow, '') !== normalizeHex(presetTheme.glow, '') ? normalized.glow : undefined,
    h: decimalsMatch(normalized.opacity, presetTheme.opacity) ? undefined : normalized.opacity,
    i: decimalsMatch(normalized.glowStrength, presetTheme.glowStrength) ? undefined : normalized.glowStrength
  });
}

function compactRowsOverlayForUrl(rowsOverlay) {
  const rows = normalizeRowsOverlay(rowsOverlay || {});
  return removeEmptyUrlFields({
    a: rows.rows !== 2 ? rows.rows : undefined,
    b: rows.perRow !== '6,6' ? rows.perRow : undefined,
    c: rows.scrollRows || undefined,
    d: rows.directions !== 'left,left' ? rows.directions : undefined,
    e: rows.speeds !== '28,28' ? rows.speeds : undefined,
    f: rows.rowHeight !== 96 ? rows.rowHeight : undefined,
    g: rows.gap || undefined,
    h: rows.names === false ? 0 : undefined,
    i: rows.soundsEnabled === false ? 0 : undefined,
    k: rows.animationsEnabled === false ? 0 : undefined,
    l: rows.profileAnimationEnabled === true ? 1 : undefined,
    j: rows.gifts.map(compactRowsGiftForUrl)
  });
}

function compactRowsGiftForUrl(gift) {
  return compactGiftForUrl(gift, {
    r: Number.isInteger(Number(gift.row)) ? Number(gift.row) : undefined
  });
}

function compactRewardForUrl(reward) {
  return compactGiftForUrl(reward, {
    u: reward.useGiftImage ? 1 : undefined,
    x: reward.giftImageNames?.length ? reward.giftImageNames : undefined,
    y: reward.giftImageIds?.length ? reward.giftImageIds : undefined
  });
}

function compactGiftForUrl(gift, extra = {}) {
  const catalogMatch = findCatalogEntryForReward(gift);
  const catalogImage = catalogMatch?.image || '';
  const image = String(gift.image || '');
  const names = Array.isArray(gift.giftNames) ? gift.giftNames : [];
  const ids = Array.isArray(gift.giftIds) ? gift.giftIds : [];

  return removeEmptyUrlFields({
    t: gift.title,
    n: names.length ? names : undefined,
    i: ids.length ? ids : undefined,
    m: image && image !== catalogImage ? image : undefined,
    e: gift.enabled === false ? 0 : undefined,
    s: gift.sound || undefined,
    v: Number(gift.volume ?? 0.85) !== 0.85 ? gift.volume : undefined,
    q: normalizeTriggerType(gift.triggerType) !== 'gift' ? normalizeTriggerType(gift.triggerType) : undefined,
    l: normalizeTriggerType(gift.triggerType) === 'likes' ? gift.likesRequired : undefined,
    j: normalizeTriggerType(gift.triggerType) === 'likes' && gift.likesHeartColor !== '#ef233c' ? gift.likesHeartColor : undefined,
    k: normalizeTriggerType(gift.triggerType) === 'likes' && gift.likesNumberColor !== '#ffffff' ? gift.likesNumberColor : undefined,
    o: normalizeTriggerType(gift.triggerType) === 'likes' && gift.likesHeartSize !== 160 ? gift.likesHeartSize : undefined,
    p: normalizeTriggerType(gift.triggerType) === 'likes' && gift.likesNumberSize !== 96 ? gift.likesNumberSize : undefined,
    ...extra
  });
}

function expandCompactConfig(config) {
  if (!config || config._ !== 'r2') {
    return config;
  }

  return removeEmptyUrlFields({
    rotateMs: config.a,
    holdOnGiftMs: config.b,
    labelMs: config.c,
    visibleNext: config.d,
    soundsEnabled: config.e === 0 ? false : undefined,
    animationsEnabled: config.f === 0 ? false : undefined,
    profileAnimationEnabled: config.h === 1 ? true : undefined,
    theme: expandCompactTheme(config.t),
    carouselTheme: expandCompactTheme(config.u),
    rowsTheme: expandCompactTheme(config.v),
    rowsOverlay: expandCompactRowsOverlay(config.o),
    rewards: Array.isArray(config.g) ? config.g.map(expandCompactReward) : undefined
  });
}

function expandCompactTheme(theme) {
  if (!theme) {
    return undefined;
  }

  return removeEmptyUrlFields({
    preset: theme.p || 'glass-purple',
    accent: theme.a,
    secondary: theme.b,
    background: theme.c,
    card: theme.d,
    text: theme.e,
    border: theme.f,
    glow: theme.g,
    opacity: theme.h,
    glowStrength: theme.i
  });
}

function expandCompactRowsOverlay(rows) {
  if (!rows) {
    return undefined;
  }

  return removeEmptyUrlFields({
    rows: rows.a,
    perRow: rows.b,
    scrollRows: rows.c,
    directions: rows.d,
    speeds: rows.e,
    rowHeight: rows.f,
    gap: rows.g,
    names: rows.h === 0 ? false : undefined,
    soundsEnabled: rows.i === 0 ? false : undefined,
    animationsEnabled: rows.k === 0 ? false : undefined,
    profileAnimationEnabled: rows.l === 1 ? true : undefined,
    gifts: Array.isArray(rows.j) ? rows.j.map(expandCompactRowsGift) : undefined
  });
}

function expandCompactRowsGift(gift) {
  return {
    ...expandCompactGift(gift),
    row: gift?.r
  };
}

function expandCompactReward(gift) {
  return {
    ...expandCompactGift(gift),
    useGiftImage: gift?.u === 1,
    giftImageNames: Array.isArray(gift?.x) ? gift.x : [],
    giftImageIds: Array.isArray(gift?.y) ? gift.y : []
  };
}

function expandCompactGift(gift = {}) {
  return removeEmptyUrlFields({
    enabled: gift.e === 0 ? false : undefined,
    title: gift.t,
    giftNames: Array.isArray(gift.n) ? gift.n : [],
    giftIds: Array.isArray(gift.i) ? gift.i : [],
    image: gift.m,
    sound: gift.s,
    volume: gift.v,
    triggerType: gift.q,
    likesRequired: gift.l,
    likesHeartColor: gift.j,
    likesNumberColor: gift.k,
    likesHeartSize: gift.o,
    likesNumberSize: gift.p
  });
}

function removeEmptyUrlFields(value) {
  Object.keys(value).forEach(key => {
    if (value[key] === undefined || value[key] === null) {
      delete value[key];
      return;
    }

    if (typeof value[key] === 'object' && !Array.isArray(value[key]) && Object.keys(value[key]).length === 0) {
      delete value[key];
    }
  });

  return value;
}

function scheduleOverlayPreviewRefresh() {
  clearTimeout(previewRefreshTimer);
  previewRefreshTimer = setTimeout(refreshOverlayPreviews, 240);
}

function refreshOverlayPreviews() {
  const previewConfig = cloneConfig(draftConfig);
  previewRefreshIndex += 1;

  if (carouselPreview) {
    setPreviewUrl(carouselPreview, getUrlForPage('index-rewards.html', previewConfig, {
      preview: !carouselPreviewTest?.checked,
      test: Boolean(carouselPreviewTest?.checked),
      mute: Boolean(carouselPreviewMute?.checked),
      previewRefresh: previewRefreshIndex
    }));
  }

  if (rowsPreview) {
    setPreviewUrl(rowsPreview, getUrlForPage('index-rewards-rows.html', previewConfig, {
      preview: !rowsPreviewTest?.checked,
      test: Boolean(rowsPreviewTest?.checked),
      mute: Boolean(rowsPreviewMute?.checked),
      previewRefresh: previewRefreshIndex
    }));
  }
}

function setPreviewUrl(frame, url) {
  const nextUrl = url.toString();

  if (frame.dataset.previewUrl === nextUrl) {
    return;
  }

  preserveScrollDuring(() => {
    frame.dataset.previewUrl = nextUrl;
    frame.src = nextUrl;
  });
}

function markDirty() {
  scheduleOverlayPreviewRefresh();
  setState('⚠ Unsaved changes');
}

function setState(text) {
  configState.textContent = text;
}

function normalizeConfig(config) {
  const fallbackRewards = Array.isArray(baseConfig.rewards) ? baseConfig.rewards : [];
  const rewards = Array.isArray(config.rewards) && config.rewards.length ? config.rewards : fallbackRewards;
  const themeSource = config.theme || config.carouselTheme || {};
  const carouselThemeSource = config.carouselTheme || config.theme || {};
  const rowsThemeSource = config.rowsTheme || config.theme || config.carouselTheme || {};

  return {
    rotateMs: numberOrDefault(config.rotateMs, 2600),
    holdOnGiftMs: numberOrDefault(config.holdOnGiftMs, 6500),
    labelMs: numberOrDefault(config.labelMs, 2600),
    visibleNext: clamp(numberOrDefault(config.visibleNext, 3), 0, 3),
    soundsEnabled: config.soundsEnabled !== false,
    animationsEnabled: config.animationsEnabled !== false,
    profileAnimationEnabled: config.profileAnimationEnabled === true,
    theme: normalizeTheme(themeSource),
    carouselTheme: normalizeTheme(carouselThemeSource),
    rowsTheme: normalizeTheme(rowsThemeSource),
    rowsOverlay: normalizeRowsOverlay(config.rowsOverlay || {}),
    rewards: rewards.map(normalizeReward)
  };
}

function getCarouselTheme() {
  return normalizeTheme(draftConfig.carouselTheme || draftConfig.theme || {});
}

function getRowsTheme() {
  return normalizeTheme(draftConfig.rowsTheme || draftConfig.theme || draftConfig.carouselTheme || {});
}

function getPresetFromTheme(theme) {
  const candidate = theme?.preset;
  if (themePresets[candidate]) {
    return candidate;
  }

  return Object.keys(themePresets).find(preset => themesMatch(theme, themePresets[preset])) || null;
}

function normalizeTheme(theme) {
  const preset = getPresetFromTheme(theme) || 'custom';
  const presetTheme = themePresets[preset] || defaultTheme;

  return {
    preset,
    accent: normalizeHex(theme.accent, presetTheme.accent),
    secondary: normalizeHex(theme.secondary, presetTheme.secondary),
    background: normalizeHex(theme.background, presetTheme.background),
    card: normalizeHex(theme.card, presetTheme.card),
    text: normalizeHex(theme.text, presetTheme.text),
    border: normalizeHex(theme.border, presetTheme.border),
    glow: normalizeHex(theme.glow, presetTheme.glow),
    opacity: clamp(numberOrDefault(theme.opacity, presetTheme.opacity), 0.35, 1),
    glowStrength: clamp(numberOrDefault(theme.glowStrength, presetTheme.glowStrength), 0, 1.5)
  };
}

function themesMatch(theme, preset) {
  return ['accent', 'secondary', 'background', 'card', 'text', 'border', 'glow'].every(key => {
    return normalizeHex(theme[key], '') === normalizeHex(preset[key], '');
  }) &&
    decimalsMatch(theme.opacity, preset.opacity) &&
    decimalsMatch(theme.glowStrength, preset.glowStrength);
}

function decimalsMatch(value, presetValue) {
  return Math.abs(Number(value) - Number(presetValue)) < 0.026;
}

function applyThemeToDocument(themeInput) {
  const theme = normalizeTheme(themeInput || {});
  const root = document.documentElement;
  const opacity = theme.opacity;
  const glow = theme.glowStrength;

  root.style.setProperty('--reward-theme-accent', theme.accent);
  root.style.setProperty('--reward-theme-accent-soft', hexToRgba(theme.accent, 0.18));
  root.style.setProperty('--reward-theme-accent-strong', hexToRgba(theme.accent, 0.76));
  root.style.setProperty('--reward-theme-secondary', theme.secondary);
  root.style.setProperty('--reward-theme-secondary-soft', hexToRgba(theme.secondary, 0.2));
  root.style.setProperty('--reward-theme-background', hexToRgba(theme.background, opacity));
  root.style.setProperty('--reward-theme-background-deep', hexToRgba(theme.background, Math.min(0.95, opacity + 0.1)));
  root.style.setProperty('--reward-theme-card', hexToRgba(theme.card, Math.min(0.9, opacity + 0.04)));
  root.style.setProperty('--reward-theme-card-soft', hexToRgba(theme.card, Math.max(0.38, opacity - 0.16)));
  root.style.setProperty('--reward-theme-text', theme.text);
  root.style.setProperty('--reward-theme-muted', hexToRgba(theme.text, 0.74));
  root.style.setProperty('--reward-theme-border', hexToRgba(theme.border, 0.34));
  root.style.setProperty('--reward-theme-border-strong', hexToRgba(theme.border, 0.68));
  root.style.setProperty('--reward-theme-glow', hexToRgba(theme.glow, 0.5 * glow));
  root.style.setProperty('--reward-theme-glow-soft', hexToRgba(theme.glow, 0.22 * glow));
  root.style.setProperty('--reward-theme-glow-strong', hexToRgba(theme.glow, 0.78 * glow));
  root.style.setProperty('--reward-theme-shine', hexToRgba(theme.text, 0.18));

  if (theme.preset === 'glass-purple') {
    root.style.setProperty('--reward-theme-widget-border', hexToRgba(theme.border, 0.28));
    root.style.setProperty('--reward-theme-widget-glow', hexToRgba(theme.glow, 0.44 * glow));
    root.style.setProperty('--reward-theme-widget-inset-shine', hexToRgba(theme.text, 0.16));
    root.style.setProperty('--reward-theme-widget-shine', hexToRgba(theme.text, 0.2));
    root.style.setProperty('--reward-theme-widget-side-shine-left', hexToRgba(theme.text, 0.2));
    root.style.setProperty('--reward-theme-widget-side-shine-right', hexToRgba(theme.text, 0.16));
    root.style.setProperty('--reward-theme-widget-radial-shine', hexToRgba(theme.text, 0.22));
    root.style.setProperty('--reward-theme-widget-top-shine', hexToRgba(theme.text, 0.22));
    root.style.setProperty('--reward-theme-widget-bottom-shine', hexToRgba(theme.text, 0.12));
    root.style.setProperty('--reward-theme-widget-after-left-shine', hexToRgba(theme.text, 0.2));
    root.style.setProperty('--reward-theme-widget-after-right-shine', hexToRgba(theme.text, 0.14));
    root.style.setProperty('--reward-theme-widget-top', hexToRgba(theme.background, Math.min(0.92, opacity - 0.06)));
    root.style.setProperty('--reward-theme-widget-mid', hexToRgba(theme.card, opacity));
    root.style.setProperty('--reward-theme-widget-bottom', hexToRgba(theme.secondary, Math.max(0.35, opacity - 0.1)));
    root.style.setProperty('--reward-theme-widget-base', hexToRgba(theme.card, Math.max(0.35, opacity - 0.16)));
    root.style.setProperty('--reward-theme-card-border', hexToRgba(theme.border, 0.2));
    root.style.setProperty('--reward-theme-card-shine', hexToRgba(theme.text, 0.16));
    root.style.setProperty('--reward-theme-card-base', hexToRgba(theme.card, Math.max(0.35, opacity - 0.2)));
    root.style.setProperty('--reward-theme-card-text', hexToRgba(theme.text, 0.96));
    root.style.setProperty('--reward-theme-card-active-glow', hexToRgba(theme.glow, 0.38 * glow));
    root.style.setProperty('--reward-theme-card-active-accent', hexToRgba(theme.accent, 0.18));
    root.style.setProperty('--reward-theme-callout-border', hexToRgba(theme.border, 0.26));
    root.style.setProperty('--reward-theme-callout-start', hexToRgba(theme.accent, 0.22));
    root.style.setProperty('--reward-theme-callout-end', hexToRgba(theme.glow, 0.34 * glow));
    root.style.setProperty('--reward-theme-callout-base', hexToRgba(theme.card, Math.min(0.94, opacity + 0.06)));
    root.style.setProperty('--reward-theme-callout-glow', hexToRgba(theme.glow, 0.48 * glow));
    return;
  }

  root.style.setProperty('--reward-theme-widget-border', hexToRgba(theme.border, 0.7));
  root.style.setProperty('--reward-theme-widget-glow', hexToRgba(theme.glow, 1 * glow));
  root.style.setProperty('--reward-theme-widget-inset-shine', hexToRgba(theme.accent, 0.34));
  root.style.setProperty('--reward-theme-widget-shine', hexToRgba(theme.accent, 0.54));
  root.style.setProperty('--reward-theme-widget-side-shine-left', hexToRgba(theme.accent, 0.48));
  root.style.setProperty('--reward-theme-widget-side-shine-right', hexToRgba(theme.secondary, 0.52));
  root.style.setProperty('--reward-theme-widget-radial-shine', hexToRgba(theme.accent, 0.46));
  root.style.setProperty('--reward-theme-widget-top-shine', hexToRgba(theme.text, 0.18));
  root.style.setProperty('--reward-theme-widget-bottom-shine', hexToRgba(theme.secondary, 0.44));
  root.style.setProperty('--reward-theme-widget-after-left-shine', hexToRgba(theme.accent, 0.46));
  root.style.setProperty('--reward-theme-widget-after-right-shine', hexToRgba(theme.secondary, 0.5));
  root.style.setProperty('--reward-theme-widget-top', hexToRgba(theme.background, Math.min(0.98, opacity + 0.12)));
  root.style.setProperty('--reward-theme-widget-mid', hexToRgba(theme.secondary, 0.46));
  root.style.setProperty('--reward-theme-widget-bottom', hexToRgba(theme.accent, 0.34));
  root.style.setProperty('--reward-theme-widget-base', hexToRgba(theme.card, Math.max(0.82, opacity)));
  root.style.setProperty('--reward-theme-card-border', hexToRgba(theme.border, 0.64));
  root.style.setProperty('--reward-theme-card-shine', hexToRgba(theme.accent, 0.38));
  root.style.setProperty('--reward-theme-card-base', hexToRgba(theme.card, Math.max(0.82, opacity)));
  root.style.setProperty('--reward-theme-card-text', hexToRgba(theme.text, 0.96));
  root.style.setProperty('--reward-theme-card-active-glow', hexToRgba(theme.glow, 0.78 * glow));
  root.style.setProperty('--reward-theme-card-active-accent', hexToRgba(theme.accent, 0.54));
  root.style.setProperty('--reward-theme-callout-border', hexToRgba(theme.border, 0.42));
  root.style.setProperty('--reward-theme-callout-start', hexToRgba(theme.accent, 0.48));
  root.style.setProperty('--reward-theme-callout-end', hexToRgba(theme.secondary, 0.62));
  root.style.setProperty('--reward-theme-callout-base', hexToRgba(theme.background, Math.min(0.96, opacity + 0.1)));
  root.style.setProperty('--reward-theme-callout-glow', hexToRgba(theme.glow, 0.62 * glow));
}

function normalizeRowsOverlay(config) {
  const hasConfiguredGifts = Array.isArray(config.gifts) && config.gifts.length > 0;
  const gifts = hasConfiguredGifts ? config.gifts : getDefaultRowsGifts();
  const migratedGap = !hasConfiguredGifts && Number(config.gap) === 12 ? 0 : config.gap;

  return {
    rows: clamp(numberOrDefault(config.rows, 2), 1, 8),
    perRow: normalizeCsv(config.perRow, '6,6'),
    scrollRows: normalizeCsv(config.scrollRows, ''),
    directions: normalizeCsv(config.directions, 'left,left'),
    speeds: normalizeCsv(config.speeds, '28,28'),
    rowHeight: clamp(numberOrDefault(config.rowHeight, 96), 64, 160),
    gap: clamp(numberOrDefault(migratedGap, 0), 0, 32),
    names: config.names !== false,
    soundsEnabled: config.soundsEnabled !== false,
    animationsEnabled: config.animationsEnabled !== false,
    profileAnimationEnabled: config.profileAnimationEnabled === true,
    gifts: gifts.map(normalizeRowsGift)
  };
}

function getDefaultRowsGifts() {
  const catalog = Array.isArray(window.rewardImageCatalog) ? window.rewardImageCatalog : [];

  return catalog.map(entry => {
    const name = entry.name || entry.label || getImageLabel(entry.image || '');

    return {
      enabled: true,
      title: name,
      giftNames: name ? [name] : [],
      giftIds: entry.id || entry.giftId ? [String(entry.id || entry.giftId)] : [],
      image: String(entry.image || entry.path || entry.url || ''),
      sound: '',
      volume: 0.85
    };
  }).filter(gift => gift.image);
}

function normalizeRowsGift(gift) {
  const triggerType = normalizeTriggerType(gift.triggerType);
  return {
    enabled: gift.enabled !== false,
    title: String(gift.title || gift.name || 'Row Gift'),
    triggerType,
    likesRequired: clamp(Math.floor(numberOrDefault(gift.likesRequired, 50)), 1, 1000000000),
    likesHeartColor: normalizeHex(gift.likesHeartColor, '#ef233c'),
    likesNumberColor: normalizeHex(gift.likesNumberColor, '#ffffff'),
    likesHeartSize: clamp(Math.floor(numberOrDefault(gift.likesHeartSize, 160)), 40, 160),
    likesNumberSize: clamp(Math.floor(numberOrDefault(gift.likesNumberSize, 96)), 16, 96),
    giftNames: Array.isArray(gift.giftNames) ? gift.giftNames.map(String) : [],
    giftIds: Array.isArray(gift.giftIds) ? gift.giftIds.map(normalizeId).filter(Boolean) : [],
    image: getCatalogImageForReward(gift),
    row: Number.isInteger(Number(gift.row)) ? Number(gift.row) : undefined,
    sound: normalizeSound(gift.sound),
    volume: clamp(Number(gift.volume ?? 0.85), 0, 1)
  };
}

function normalizeReward(reward) {
  const triggerType = normalizeTriggerType(reward.triggerType);
  return {
    enabled: reward.enabled !== false,
    title: String(reward.title || 'Reward'),
    triggerType,
    likesRequired: clamp(Math.floor(numberOrDefault(reward.likesRequired, 50)), 1, 1000000000),
    likesHeartColor: normalizeHex(reward.likesHeartColor, '#ef233c'),
    likesNumberColor: normalizeHex(reward.likesNumberColor, '#ffffff'),
    likesHeartSize: clamp(Math.floor(numberOrDefault(reward.likesHeartSize, 160)), 40, 160),
    likesNumberSize: clamp(Math.floor(numberOrDefault(reward.likesNumberSize, 96)), 16, 96),
    giftNames: Array.isArray(reward.giftNames) ? reward.giftNames.map(String) : [],
    giftIds: Array.isArray(reward.giftIds) ? reward.giftIds.map(normalizeId).filter(Boolean) : [],
    image: getCatalogImageForReward(reward),
    useGiftImage: Boolean(reward.useGiftImage),
    giftImageNames: Array.isArray(reward.giftImageNames) ? reward.giftImageNames.map(String) : [],
    giftImageIds: Array.isArray(reward.giftImageIds) ? reward.giftImageIds.map(String) : [],
    sound: normalizeSound(reward.sound),
    volume: clamp(Number(reward.volume ?? 0.85), 0, 1)
  };
}

function splitList(value) {
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

function normalizeSound(sound) {
  const value = String(sound || '').trim();
  return availableSounds.has(value) ? value : '';
}

function normalizeCsv(value, fallback) {
  const normalized = String(value ?? '').split(',').map(item => item.trim()).filter(Boolean).join(',');
  return normalized || fallback;
}

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

function normalizeTriggerType(value) {
  const type = String(value || '').trim().toLowerCase();
  return type === 'follow' || type === 'likes' ? type : 'gift';
}

function getTriggerIcon(item) {
  const type = normalizeTriggerType(item?.triggerType || item);
  if (type === 'gift') {
    return '';
  }

  const isFollow = type === 'follow';
  const likes = Math.max(1, Math.floor(Number(item?.likesRequired || 50)));
  const heartColor = normalizeHex(item?.likesHeartColor, '#ef233c');
  const numberColor = normalizeHex(item?.likesNumberColor, '#ffffff');
  const heartScale = clamp(Number(item?.likesHeartSize || 160), 40, 160) / 100;
  const numberSize = clamp(Number(item?.likesNumberSize || 96), 16, 96);
  const canvasWidth = Math.max(300, Math.ceil(180 + (String(likes).length * numberSize * 0.68)));
  const svg = isFollow
    ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 104 104"><circle cx="42" cy="31" r="17" fill="#25f4ee"/><path d="M13 86c2-24 14-37 29-37s27 13 29 37" fill="#25f4ee"/><circle cx="78" cy="61" r="20" fill="#fe2c55"/><path d="M78 49v24M66 61h24" stroke="white" stroke-width="7" stroke-linecap="round"/></svg>'
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasWidth} 160"><g transform="translate(40 27)"><g transform="translate(50 53) scale(${heartScale}) translate(-50 -53)"><path d="M50 91C21 73 8 58 8 40c0-14 10-24 24-24 8 0 15 4 18 11 3-7 10-11 18-11 14 0 24 10 24 24 0 18-13 33-42 51Z" fill="${heartColor}"/></g></g><text x="180" y="80" fill="${numberColor}" font-family="Arial, sans-serif" font-size="${numberSize}" font-weight="800" dominant-baseline="middle">${likes}</text></svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function normalizeId(id) {
  const value = String(id || '').trim();
  return /^\d+$/.test(value) ? String(Number(value)) : value;
}

function normalizeHex(value, fallback = '#ffffff') {
  const text = String(value || '').trim();
  const fallbackHex = /^#[0-9a-f]{6}$/i.test(String(fallback || '')) ? fallback.toLowerCase() : '#ffffff';

  if (/^#[0-9a-f]{6}$/i.test(text)) {
    return text.toLowerCase();
  }

  if (/^#[0-9a-f]{3}$/i.test(text)) {
    const [, r, g, b] = text.toLowerCase();
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  if (/^[0-9a-f]{6}$/i.test(text)) {
    return `#${text.toLowerCase()}`;
  }

  if (/^[0-9a-f]{3}$/i.test(text)) {
    const [r, g, b] = text.toLowerCase();
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  return fallbackHex;
}

function hexToRgba(hex, alpha) {
  const normalized = normalizeHex(hex);
  const red = parseInt(normalized.slice(1, 3), 16);
  const green = parseInt(normalized.slice(3, 5), 16);
  const blue = parseInt(normalized.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${clamp(Number(alpha), 0, 1)})`;
}

function getCatalogImageForReward(reward) {
  const currentImage = String(reward.image || '');
  const match = findCatalogEntryForReward(reward);
  return match?.image || currentImage;
}

function findCatalogEntryForReward(reward) {
  const catalog = Array.isArray(window.rewardImageCatalog) ? window.rewardImageCatalog : [];
  if (!catalog.length) {
    return null;
  }

  const ids = [
    ...(reward.giftIds || []),
    ...(reward.giftImageIds || []),
    getIdFromImagePath(reward.image)
  ].map(normalizeId).filter(Boolean);
  const names = [
    ...(reward.giftNames || []),
    ...(reward.giftImageNames || []),
    reward.title,
    getImageLabel(reward.image)
  ].map(normalizeName).filter(Boolean);

  return catalog.find(entry => ids.includes(normalizeId(entry.id || entry.giftId))) ||
    catalog.find(entry => names.includes(normalizeName(entry.name || entry.label || getImageLabel(entry.image))));
}

function numberOrDefault(value, fallback) {
  if (value === '' || value === null || value === undefined) {
    return fallback;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return max;
  }

  return Math.min(max, Math.max(min, value));
}

function cloneConfig(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeAttribute(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}
