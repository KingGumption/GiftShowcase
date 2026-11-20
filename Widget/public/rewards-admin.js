const rewardStorageKey = 'reward-overlay-config:v1';
const giftFavoritesStorageKey = 'reward-gift-favorites:v1';
const rowsDefaultsRevisionKey = 'reward-rows-defaults-revision:v1';
const rowsDefaultsRevision = '20260811-animation-2';
const remoteRewardImageBase = 'https://pub-099cf604176d4f20bce0cd8bb2c4d3c6.r2.dev/';
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
const carouselProfileName = document.querySelector('#carousel-profile-name');
const rewardTotal = document.querySelector('#reward-total');
const rewardEnabled = document.querySelector('#reward-enabled');
const rowsGiftList = document.querySelector('#rows-gift-list');
const rowsGiftTotal = document.querySelector('#rows-gift-total');
const rowsGiftEnabled = document.querySelector('#rows-gift-enabled');
const sideGiftList = document.querySelector('#side-gift-list');
const sideGiftTotal = document.querySelector('#side-gift-total');
const sideGiftEnabled = document.querySelector('#side-gift-enabled');
const tabButtons = document.querySelectorAll('[data-config-tab]');
const configPanels = document.querySelectorAll('[data-config-panel]');
const studioCurrentTitle = document.querySelector('#studio-current-title');
const studioOutputTab = document.querySelector('#studio-output-tab');
const studioOutputWorkspace = document.querySelector('#studio-output-workspace');
const studioOutputFrame = document.querySelector('#studio-output-frame');
const rowsCount = document.querySelector('#rows-count');
const rowsPerRow = document.querySelector('#rows-per-row');
const rowsScrolling = document.querySelector('#rows-scrolling');
const rowsDirections = document.querySelector('#rows-directions');
const rowsSpeeds = document.querySelector('#rows-speeds');
const rowsHeight = document.querySelector('#rows-height');
const rowsLabelSize = document.querySelector('#rows-label-size');
const rowsGap = document.querySelector('#rows-gap');
const rowsNames = document.querySelector('#rows-names');
const rowsSounds = document.querySelector('#rows-sounds');
const rowsAnimations = document.querySelector('#rows-animations');
const rowsProfileAnimation = document.querySelector('#rows-profile-animation');
const rowsProfileName = document.querySelector('#rows-profile-name');
const goalType = document.querySelector('#goal-type');
const goalLiveFollowers = document.querySelector('#goal-live-followers');
const goalLabel = document.querySelector('#goal-label');
const goalTarget = document.querySelector('#goal-target');
const goalStep = document.querySelector('#goal-step');
const goalStart = document.querySelector('#goal-start');
const goalReset = document.querySelector('#goal-reset');
const goalWidth = document.querySelector('#goal-width');
const goalHeight = document.querySelector('#goal-height');
const goalFontFields = ['labelSize', 'counterSize', 'targetSize'].map(key => ({ key, input: document.querySelector('#goal-' + key) }));
const topLikersLimit = document.querySelector('#top-likers-limit');
const topLikersAvatars = document.querySelector('#top-likers-avatars');
const topLikersNames = document.querySelector('#top-likers-names');
const topLikersHeart = document.querySelector('#top-likers-heart');
const topLikersLayout = document.querySelector('#top-likers-layout');
const topLikersLikeMilestone = document.querySelector('#top-likers-like-milestone');
const topLikersMedalHearts = document.querySelector('#top-likers-medal-hearts');
const topLikersReset = document.querySelector('#top-likers-reset');
const topLikersWidth = document.querySelector('#top-likers-width');
const topLikersWidthLabel = document.querySelector('#top-likers-width-label');
const topLikersHeight = document.querySelector('#top-likers-height');
const topLikersHeightLabel = document.querySelector('#top-likers-height-label');
const topLikersShell = document.querySelector('#top-likers-shell');
const topLikersTitle = document.querySelector('#top-likers-title');
const topLikersTiles = document.querySelector('#top-likers-tiles');
const topLikersOpacity = document.querySelector('#top-likers-opacity');
const topLikersOpacityLabel = document.querySelector('#top-likers-opacity-label');
const topLikersTileOpacity = document.querySelector('#top-likers-tile-opacity');
const topLikersTileOpacityLabel = document.querySelector('#top-likers-tile-opacity-label');
const sideGiftsSide = document.querySelector('#side-gifts-side');
const sideGiftsWidth = document.querySelector('#side-gifts-width');
const sideGiftsHeight = document.querySelector('#side-gifts-height');
const sideGiftsIconSize = document.querySelector('#side-gifts-icon-size');
const sideGiftsGap = document.querySelector('#side-gifts-gap');
const sideGiftsInsetX = document.querySelector('#side-gifts-inset-x');
const sideGiftsInsetY = document.querySelector('#side-gifts-inset-y');
const sideGiftsLabels = document.querySelector('#side-gifts-labels');
const sideGiftsOutlines = document.querySelector('#side-gifts-outlines');
const sideGiftsTiles = document.querySelector('#side-gifts-tiles');
const sideGiftsIdleGlow = document.querySelector('#side-gifts-idle-glow');
const sideGiftsLabelSize = document.querySelector('#side-gifts-label-size');
const sideGiftsLabelSizeLabel = document.querySelector('#side-gifts-label-size-label');
const sideGiftsLabelLines = document.querySelector('#side-gifts-label-lines');
const sideGiftsOutlineSize = document.querySelector('#side-gifts-outline-size');
const sideGiftsOutlineSizeLabel = document.querySelector('#side-gifts-outline-size-label');
const sideGiftsGiftOutlineSize = document.querySelector('#side-gifts-gift-outline-size');
const sideGiftsGiftOutlineSizeLabel = document.querySelector('#side-gifts-gift-outline-size-label');
const sideGiftsTileOpacity = document.querySelector('#side-gifts-tile-opacity');
const sideGiftsTileOpacityLabel = document.querySelector('#side-gifts-tile-opacity-label');
const sideGiftsSounds = document.querySelector('#side-gifts-sounds');
const sideGiftsAnimations = document.querySelector('#side-gifts-animations');
const sideGiftsProfileAnimation = document.querySelector('#side-gifts-profile-animation');
const sideGiftsProfileName = document.querySelector('#side-gifts-profile-name');
const loadConfigUrlInput = document.querySelector('#load-config-url');
const loadConfigUrlButton = document.querySelector('#load-config-url-button');
const carouselPreview = document.querySelector('#carousel-preview');
const rowsPreview = document.querySelector('#rows-preview');
const sideGiftsPreview = document.querySelector('#side-gifts-preview');
const goalPreview = document.querySelector('#goal-preview');
const topLikersPreview = document.querySelector('#top-likers-preview');
const carouselPreviewTest = document.querySelector('#carousel-preview-test');
const rowsPreviewTest = document.querySelector('#rows-preview-test');
const sideGiftsPreviewTest = document.querySelector('#side-gifts-preview-test');
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
const goalAppearanceEnabled = document.querySelector('#goal-appearance-enabled');
const goalAppearanceOpacity = document.querySelector('#goal-background-opacity');
const goalAppearanceGlow = document.querySelector('#goal-glow-strength');
const goalAppearanceGloss = document.querySelector('#goal-gloss');
const goalAppearanceFields = ['background','border','label','trackBackground','trackBorder','progressStart','progressEnd','progressGlow','counterBackground','counterText','counterBorder','glow'].map(key => ({ key, color: document.querySelector('#goal-custom-' + key), hex: document.querySelector('#goal-custom-' + key + '-hex') }));
const goalColorFields = [
  { key: 'accent', color: document.querySelector('#goal-accent'), hex: document.querySelector('#goal-accent-hex') },
  { key: 'glow', color: document.querySelector('#goal-glow'), hex: document.querySelector('#goal-glow-hex') },
  { key: 'text', color: document.querySelector('#goal-text'), hex: document.querySelector('#goal-text-hex') }
];
const topLikersColorFields = [
  {key:'firstPlaceAccent',color:document.querySelector('#top-likers-first-accent'),hex:document.querySelector('#top-likers-first-accent-hex')},
  {key:'firstPlaceText',color:document.querySelector('#top-likers-first-text'),hex:document.querySelector('#top-likers-first-text-hex')},
  { key: 'backgroundStart', color: document.querySelector('#top-likers-bg-start'), hex: document.querySelector('#top-likers-bg-start-hex') },
  { key: 'backgroundEnd', color: document.querySelector('#top-likers-bg-end'), hex: document.querySelector('#top-likers-bg-end-hex') },
  { key: 'backgroundBase', color: document.querySelector('#top-likers-bg-base'), hex: document.querySelector('#top-likers-bg-base-hex') },
  { key: 'border', color: document.querySelector('#top-likers-border'), hex: document.querySelector('#top-likers-border-hex') },
  { key: 'tile', color: document.querySelector('#top-likers-tile'), hex: document.querySelector('#top-likers-tile-hex') },
  { key: 'tileBorder', color: document.querySelector('#top-likers-tile-border'), hex: document.querySelector('#top-likers-tile-border-hex') },
  { key: 'title', color: document.querySelector('#top-likers-title-color'), hex: document.querySelector('#top-likers-title-color-hex') },
  { key: 'text', color: document.querySelector('#top-likers-text'), hex: document.querySelector('#top-likers-text-hex') },
  { key: 'muted', color: document.querySelector('#top-likers-muted'), hex: document.querySelector('#top-likers-muted-hex') },
  { key: 'glow', color: document.querySelector('#top-likers-glow'), hex: document.querySelector('#top-likers-glow-hex') },
  { key: 'milestoneCard', color: document.querySelector('#top-likers-milestone-card'), hex: document.querySelector('#top-likers-milestone-card-hex') },
  { key: 'milestoneText', color: document.querySelector('#top-likers-milestone-text'), hex: document.querySelector('#top-likers-milestone-text-hex') }
];
const sideGiftsColorFields = [
  { key: 'labelColor', color: document.querySelector('#side-gifts-label-color'), hex: document.querySelector('#side-gifts-label-color-hex') },
  { key: 'gifterLabelColor', color: document.querySelector('#side-gifts-gifter-label-color'), hex: document.querySelector('#side-gifts-gifter-label-color-hex') },
  { key: 'outlineColor', color: document.querySelector('#side-gifts-outline-color'), hex: document.querySelector('#side-gifts-outline-color-hex'), enablesOutlines: true },
  { key: 'giftOutlineColor', color: document.querySelector('#side-gifts-gift-outline-color'), hex: document.querySelector('#side-gifts-gift-outline-color-hex'), enablesOutlines: true },
  { key: 'glow', color: document.querySelector('#side-gifts-glow-color'), hex: document.querySelector('#side-gifts-glow-color-hex') },
  { key: 'tileColor', color: document.querySelector('#side-gifts-tile-color'), hex: document.querySelector('#side-gifts-tile-color-hex') },
  { key: 'tileBorderColor', color: document.querySelector('#side-gifts-tile-border-color'), hex: document.querySelector('#side-gifts-tile-border-color-hex') }
];
const imageCatalog = new Map();
let currentGiftCatalogue = null;
let creatorGiftEntries = [];
let catalogueRefreshInFlight = null;
let includeGiftArchive = false;
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
const defaultGoalBar = {
  type: 'likes',
  label: 'Like Goal',
  target: 5000,
  step: 5000,
  start: 0,
  resetOnConnect: true,
  useLiveFollowerCount: true,
  width: 1080,
  height: 44,
  accent: '#03f5d8',
  glow: '#c447ff',
  text: '#ffffff'
};
const defaultTopLikers = {
  limit: 3,
  showAvatar: true,
  showNames: true,
  showHeart: true,
  layout: 'stacked',
  likeMilestone: 500,
  medalHearts: true,
  resetOnConnect: true,
  width: 390,
  height: 260,
  showShell: false,
  showTitle: false,
  showTiles: false,
  backgroundStart: '#102c34',
  backgroundEnd: '#461f68',
  backgroundBase: '#0c0a14',
  border: '#03f5d8',
  tile: '#080b12',
  tileBorder: '#ffffff',
  title: '#03f5d8',
  text: '#ffffff',
  muted: '#ffffff',
  glow: '#c447ff',
  firstPlaceAccent:'#ffd83d',firstPlaceText:'#ffffff',
  milestoneCard: '#7b2cff',
  milestoneText: '#ffffff',
  opacity: 0.8,
  tileOpacity: 0.6
};
const defaultSideGifts = {
  side: 'both',
  width: 1080,
  height: 960,
  iconSize: 65,
  gap: 26,
  insetX: 8,
  insetY: 34,
  hitMs: 6500,
  showLabels: true,
  outlinesEnabled: false,
  tilesEnabled: false,
  idleGlowEnabled: false,
  labelSize: 10,
  labelTwoLines: false,
  labelColor: '#ffffff',
  gifterLabelColor: '#ffffff',
  outlineColor: '#10131b',
  outlineSize: 0.45,
  giftOutlineColor: '#10131b',
  giftOutlineSize: 2,
  soundsEnabled: true,
  animationsEnabled: true,
  profileAnimationEnabled: true,
  profileNameEnabled: true,
  glow: '#03f5d8',
  hitColor: '#ffd83d',
  tileColor: '#0d0f14',
  tileOpacity: 0.82,
  tileBorderColor: '#ffffff',
  gifts: []
};
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
let carouselDropTarget = null;
let carouselDropPlacement = '';
let rowsGiftDropTarget = null;
let rowsGiftDropPlacement = '';
let giftFavorites = loadGiftFavorites();

draftConfig = loadDraftConfig();
applyRowsDefaultsRevision();

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

let editorScrollRestore = 0;
function restorePageScroll(state = pageScrollState, restoreFocus = true) {
  cancelAnimationFrame(editorScrollRestore);
  editorScrollRestore=requestAnimationFrame(()=>{
    window.scrollTo(state.x,state.y);
    const focusTarget=restoreFocus?state.focusTarget||pageFocusTarget:null;
    if(focusTarget&&document.contains(focusTarget))focusTarget.focus({preventScroll:true});
  });
}

function renderPreservingScroll() {
  const state = interactionScrollState || getPageScrollState();
  render();
  restorePageScroll(state);
}

function preserveScrollDuring(action) {
  const state = getPageScrollState();
  action();
  restorePageScroll(state, false);
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

document.querySelector('#add-row-gift').addEventListener('click', () => openAddCard({row: rowsSelectedGift?.row || draftConfig.rowsOverlay.rows}));
document.querySelector('#add-side-gift').addEventListener('click', () => openAddCard({row:1}));
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
studioOutputTab?.addEventListener('click', () => setStudioWorkspace('outputs'));
studioOutputFrame?.addEventListener('load', () => { studioOutputFrame.dataset.ready = '1'; });

[rotateMs, holdMs, labelMs, visibleNext, carouselSounds, carouselAnimations, carouselProfileAnimation, carouselProfileName].forEach(input => {
  input.addEventListener('input', () => {
    updateGlobalsFromForm();
    updateProfileNameToggleVisibility();
    markDirty();
  });
});

[rowsCount, rowsPerRow, rowsScrolling, rowsDirections, rowsSpeeds, rowsHeight, rowsLabelSize, rowsGap, rowsNames, rowsSounds, rowsAnimations, rowsProfileAnimation, rowsProfileName].forEach(input => {
  input.addEventListener('input', () => {
    updateRowsFromForm();
    updateProfileNameToggleVisibility();
    markDirty();
    if (input === rowsCount && activeConfigTab === 'rows') {
      renderPreservingScroll();
    }
  });
});

[goalType, goalLiveFollowers, goalLabel, goalTarget, goalStep, goalStart, goalReset, goalWidth, goalHeight, ...goalFontFields.map(field => field.input)].forEach(input => {
  input.addEventListener('input', () => {
    if (input === goalType && (!goalLabel.value.trim() || isDefaultGoalLabel(goalLabel.value))) {
      goalLabel.value = defaultGoalLabel(goalType.value);
    }

    if (input === goalType) {
      goalReset.value = defaultGoalResetOnConnect(goalType.value) ? '1' : '0';
    }

    updateGoalBarFromForm();
    updateGoalFieldVisibility();
    markDirty();
  });
});

[topLikersLimit, topLikersAvatars, topLikersNames, topLikersHeart, topLikersLayout, topLikersLikeMilestone, topLikersMedalHearts, topLikersReset, topLikersWidth, topLikersHeight, topLikersShell, topLikersTitle, topLikersTiles, topLikersOpacity, topLikersTileOpacity].forEach(input => {
  input.addEventListener('input', () => {
    updateTopLikersFromForm();
    markDirty();
  });
});

[sideGiftsSide, sideGiftsWidth, sideGiftsHeight, sideGiftsIconSize, sideGiftsGap, sideGiftsInsetX, sideGiftsInsetY, sideGiftsLabels, sideGiftsOutlines, sideGiftsTiles, sideGiftsIdleGlow, sideGiftsLabelSize, sideGiftsLabelLines, sideGiftsOutlineSize, sideGiftsGiftOutlineSize, sideGiftsTileOpacity, sideGiftsSounds, sideGiftsAnimations, sideGiftsProfileAnimation, sideGiftsProfileName].forEach(input => {
  input?.addEventListener('input', () => {
    if ((input === sideGiftsOutlineSize || input === sideGiftsGiftOutlineSize) && Number(input.value) > 0) {
      sideGiftsOutlines.value = '1';
    }

    updateSideGiftsFromForm();
    updateProfileNameToggleVisibility();
    updateSideGiftsStyleLabels();
    markDirty();
  });
});

sideGiftsColorFields.forEach(field => {
  field.color?.addEventListener('input', () => {
    field.hex.value = field.color.value;
    if (field.enablesOutlines) {
      sideGiftsOutlines.value = '1';
    }
    updateSideGiftsFromForm();
    markDirty();
  });

  field.hex?.addEventListener('input', () => {
    const hex = normalizeHex(field.hex.value, '');

    if (hex) {
      field.color.value = hex;
      if (field.enablesOutlines) {
        sideGiftsOutlines.value = '1';
      }
    }

    updateSideGiftsFromForm();
    markDirty();
  });
});

topLikersColorFields.forEach(field => {
  field.color.addEventListener('input', () => {
    field.hex.value = field.color.value;
    updateTopLikersFromForm();
    markDirty();
  });

  field.hex.addEventListener('input', () => {
    const hex = normalizeHex(field.hex.value, '');

    if (hex) {
      field.color.value = hex;
    }

    updateTopLikersFromForm();
    markDirty();
  });
});

[goalAppearanceEnabled, goalAppearanceOpacity, goalAppearanceGlow, goalAppearanceGloss].forEach(input => {
  input.addEventListener('change', () => { updateGoalBarFromForm(); renderGoalAppearanceForm(); markDirty(); });
});
goalAppearanceFields.forEach(field => {
  field.color.addEventListener('input', () => {
    field.hex.value = field.color.value;
    updateGoalBarFromForm(); markDirty();
  });
  field.hex.addEventListener('input', () => {
    const value = normalizeHex(field.hex.value, '');
    if (!value) return;
    field.color.value = value;
    updateGoalBarFromForm(); markDirty();
  });
});

goalColorFields.forEach(field => {
  field.color.addEventListener('input', () => {
    field.hex.value = field.color.value;
    updateGoalBarFromForm();
    markDirty();
  });

  field.hex.addEventListener('input', () => {
    const hex = normalizeHex(field.hex.value, '');

    if (hex) {
      field.color.value = hex;
    }

    updateGoalBarFromForm();
    markDirty();
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

[carouselPreviewTest, rowsPreviewTest, sideGiftsPreviewTest, carouselPreviewMute, rowsPreviewMute].forEach(input => {
  input?.addEventListener('input', refreshOverlayPreviews);
});

seedImageCatalog();
ensureRowsGiftDefaults();
applyThemeToDocument(getCarouselTheme());
render();
refreshOverlayPreviews();
clearTimeout(previewRefreshTimer);
setStudioWorkspace(new URLSearchParams(window.location.search).get('workspace') === 'outputs' ? 'outputs' : 'editor', { updateUrl: false });

window.rewardConfigEditor = Object.freeze({
  getConfig() {
    syncDraftFromForm();
    return cloneConfig(draftConfig);
  },
  getActiveOverlayKind() {
    return overlayKindFromTab(activeConfigTab);
  },
  getConfigForKind(kind = overlayKindFromTab(activeConfigTab), config = null) {
    if (config === null) syncDraftFromForm();
    return extractOverlayConfig(config === null ? draftConfig : config, kind);
  },
  loadConfig(config, stateText = 'Design loaded') {
    draftConfig = normalizeConfig(config || {});
    ensureRowsGiftDefaults();
    ensureSideGiftDefaults();
    localStorage.setItem(rewardStorageKey, JSON.stringify(draftConfig));
    applyThemeToDocument(getCarouselTheme());
    render();
    setState(stateText);
  },
  loadConfigForKind(kind, config, stateText = 'Design loaded') {
    draftConfig = normalizeConfig({
      ...draftConfig,
      ...extractOverlayConfig(config || {}, kind)
    });
    ensureRowsGiftDefaults();
    ensureSideGiftDefaults();
    localStorage.setItem(rewardStorageKey, JSON.stringify(draftConfig));
    applyThemeToDocument(getCarouselTheme());
    render();
    setState(stateText);
  },
  getDefaults(kind) {return extractOverlayConfig(normalizeConfig(baseConfig),kind);},
  resetLocal() { draftConfig=normalizeConfig(baseConfig);localStorage.removeItem(rewardStorageKey);render();setState('New design'); },
  setActiveKind(kind) { setActiveTab(kind === 'carousel' ? 'original' : kind); },
  getSelection(kind=overlayKindFromTab(activeConfigTab)) { const items=kind==='carousel'?draftConfig.rewards:kind==='rows'?draftConfig.rowsOverlay.gifts:kind==='side-gifts'?draftConfig.sideGifts.gifts:[];return items.indexOf(rowsSelectedGift); },
  selectCard(index) { if (['original','rows','side-gifts'].includes(activeConfigTab)) { rowsSelectedGift=cardEditorItems()[index] || null; renderRowsWorkspace(); } },
  setState
});

function syncDraftFromForm() {
  updateGlobalsFromForm();
  updateRowsFromForm();
  updateRowsThemeFromForm();
  updateGoalBarFromForm();
  updateTopLikersFromForm();
  updateSideGiftsFromForm();
}

function overlayKindFromTab(tabName) {
  return tabName === 'original' ? 'carousel' : tabName;
}

function extractOverlayConfig(config, kind) {
  const source = config && typeof config === 'object' ? config : {};

  if (kind === 'rows') {
    return cloneConfig({
      rowsTheme: source.rowsTheme,
      rowsOverlay: {
        ...(source.rowsOverlay || {}),
        holdOnGiftMs: source.rowsOverlay?.holdOnGiftMs ?? source.holdOnGiftMs
      }
    });
  }

  if (kind === 'side-gifts') return cloneConfig({ sideGifts: source.sideGifts });
  if (kind === 'goal') return cloneConfig({ goalBar: source.goalBar });
  if (kind === 'top-likers') return cloneConfig({ topLikers: source.topLikers });

  return cloneConfig({
    rotateMs: source.rotateMs,
    holdOnGiftMs: source.holdOnGiftMs,
    labelMs: source.labelMs,
    visibleNext: source.visibleNext,
    soundsEnabled: source.soundsEnabled,
    animationsEnabled: source.animationsEnabled,
    profileAnimationEnabled: source.profileAnimationEnabled,
    profileNameEnabled: source.profileNameEnabled,
    theme: source.theme,
    carouselTheme: source.carouselTheme,
    rewards: source.rewards
  });
}

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

function applyRowsDefaultsRevision() {
  if (window.location.hash) return;

  try {
    if (localStorage.getItem(rowsDefaultsRevisionKey) === rowsDefaultsRevision) return;

    draftConfig.rowsOverlay = getRevisedRowsDefaults(draftConfig.rowsOverlay);
    localStorage.setItem(rewardStorageKey, JSON.stringify(draftConfig));
    localStorage.setItem(rowsDefaultsRevisionKey, rowsDefaultsRevision);
  } catch {
    draftConfig.rowsOverlay = getRevisedRowsDefaults(draftConfig.rowsOverlay);
  }
}

function getRevisedRowsDefaults(rows = {}) {
  // A configured array, including an empty one, is always intentional.
  // Starter IDs cannot identify an untouched design: users customise them.
  return normalizeRowsOverlay(rows);
}

function render() {
  rememberPageScroll();
  ensureSideGiftDefaults();
  rotateMs.value = draftConfig.rotateMs;
  holdMs.value = draftConfig.holdOnGiftMs;
  labelMs.value = draftConfig.labelMs;
  visibleNext.value = draftConfig.visibleNext;
  carouselSounds.value = draftConfig.soundsEnabled === false ? '0' : '1';
  carouselAnimations.value = draftConfig.animationsEnabled === false ? '0' : '1';
  carouselProfileAnimation.value = draftConfig.profileAnimationEnabled === true ? '1' : '0';
  carouselProfileName.value = draftConfig.profileNameEnabled === true ? '1' : '0';
  rowsCount.value = draftConfig.rowsOverlay.rows;
  rowsPerRow.value = draftConfig.rowsOverlay.perRow;
  rowsScrolling.value = draftConfig.rowsOverlay.scrollRows;
  rowsDirections.value = draftConfig.rowsOverlay.directions;
  rowsSpeeds.value = draftConfig.rowsOverlay.speeds;
  rowsHeight.value = draftConfig.rowsOverlay.rowHeight;
  rowsLabelSize.value = draftConfig.rowsOverlay.labelSize;
  rowsGap.value = draftConfig.rowsOverlay.gap;
  rowsNames.value = draftConfig.rowsOverlay.names ? '1' : '0';
  rowsSounds.value = draftConfig.rowsOverlay.soundsEnabled === false ? '0' : '1';
  rowsAnimations.value = draftConfig.rowsOverlay.animationsEnabled === false ? '0' : '1';
  rowsProfileAnimation.value = draftConfig.rowsOverlay.profileAnimationEnabled === true ? '1' : '0';
  rowsProfileName.value = draftConfig.rowsOverlay.profileNameEnabled === true ? '1' : '0';
  renderGoalBarForm();
  renderTopLikersForm();
  renderSideGiftsForm();
  updateProfileNameToggleVisibility();
  renderThemeForm();
  rewardList.innerHTML = '';
  rowsGiftList.innerHTML = '';
  sideGiftList.innerHTML = '';

  if (activeConfigTab === 'rows') {
    renderRowsGifts();
  } else if (activeConfigTab === 'side-gifts') {
    renderSideGifts();
  } else if (activeConfigTab === 'original') {
    renderRewardsList();
  }
  updateEditorSections();

  updateRewardStats();
  updateRowsGiftStats();
  updateSideGiftStats();
  scheduleOverlayPreviewRefresh();
  restorePageScroll();
}

function renderGoalBarForm() {
  const goal = draftConfig.goalBar;
  goalType.value = goal.type;
  goalLiveFollowers.value = goal.useLiveFollowerCount === false ? '0' : '1';
  goalLabel.value = goal.label;
  goalTarget.value = goal.target;
  goalStep.value = goal.step;
  goalStart.value = goal.start;
  goalReset.value = goal.resetOnConnect ? '1' : '0';
  goalWidth.value = goal.width;
  goalHeight.value = goal.height;
  goalFontFields.forEach(field => { field.input.value = goal[field.key] ?? ''; });
  renderGoalAppearanceForm();
  updateGoalFieldVisibility();

  goalColorFields.forEach(field => {
    const value = normalizeHex(goal[field.key], defaultGoalBar[field.key]);
    field.color.value = value;
    field.hex.value = value.toUpperCase();
  });
}

function renderGoalAppearanceForm() {
  const appearance = normalizeGoalAppearance(draftConfig.goalBar.appearance);
  const values = appearance || normalizeGoalAppearance({ enabled: true });
  goalAppearanceEnabled.checked = Boolean(appearance);
  goalAppearanceFields.forEach(field => {
    field.color.value = values[field.key]; field.hex.value = values[field.key].toUpperCase();
  });
  goalAppearanceOpacity.value = values.backgroundOpacity;
  goalAppearanceGlow.value = values.glowStrength;
  goalAppearanceGloss.checked = values.gloss;
  document.querySelectorAll('[data-goal-custom-control]').forEach(element => { element.disabled = !appearance; });
}

function updateGoalFieldVisibility() {
  document.querySelectorAll('[data-goal-visible]').forEach(field => {
    field.hidden = field.dataset.goalVisible !== goalType.value;
  });
  document.querySelector('.goal-config-grid')?.classList.toggle('is-followers-goal', goalType.value === 'followers');
}

function renderTopLikersForm() {
  const topLikers = draftConfig.topLikers;
  topLikersLimit.value = topLikers.limit;
  topLikersAvatars.value = topLikers.showAvatar ? '1' : '0';
  topLikersNames.value = topLikers.showNames ? '1' : '0';
  topLikersHeart.value = topLikers.showHeart ? '1' : '0';
  topLikersLayout.value = topLikers.layout;
  topLikersLikeMilestone.value = topLikers.likeMilestone;
  topLikersMedalHearts.value = topLikers.medalHearts ? '1' : '0';
  topLikersReset.value = topLikers.resetOnConnect ? '1' : '0';
  topLikersWidth.value = topLikers.width;
  topLikersHeight.value = topLikers.height;
  topLikersWidthLabel.textContent = `${topLikers.width}px`;
  topLikersHeightLabel.textContent = `${topLikers.height}px`;
  topLikersShell.value = topLikers.showShell ? '1' : '0';
  topLikersTitle.value = topLikers.showTitle ? '1' : '0';
  topLikersTiles.value = topLikers.showTiles ? '1' : '0';
  topLikersOpacity.value = String(topLikers.opacity);
  topLikersTileOpacity.value = String(topLikers.tileOpacity);
  topLikersOpacityLabel.textContent = `${Math.round(topLikers.opacity * 100)}%`;
  topLikersTileOpacityLabel.textContent = `${Math.round(topLikers.tileOpacity * 100)}%`;
  topLikersColorFields.forEach(field => {
    const value = normalizeHex(topLikers[field.key], defaultTopLikers[field.key]);
    field.color.value = value;
    field.hex.value = value.toUpperCase();
  });
  updateTopLikersPreviewFrameSize();
}

function renderSideGiftsForm() {
  const sideGifts = draftConfig.sideGifts;
  sideGiftsSide.value = sideGifts.side;
  sideGiftsWidth.value = sideGifts.width;
  sideGiftsHeight.value = getEffectiveSideGiftsPreviewHeight(sideGifts);
  sideGiftsIconSize.value = sideGifts.iconSize;
  sideGiftsGap.value = sideGifts.gap;
  sideGiftsInsetX.value = sideGifts.insetX;
  sideGiftsInsetY.value = sideGifts.insetY;
  sideGiftsLabels.value = sideGifts.showLabels ? '1' : '0';
  sideGiftsOutlines.value = sideGifts.outlinesEnabled ? '1' : '0';
  sideGiftsTiles.value = sideGifts.tilesEnabled ? '1' : '0';
  sideGiftsIdleGlow.value = sideGifts.idleGlowEnabled ? '1' : '0';
  sideGiftsLabelSize.value = sideGifts.labelSize;
  sideGiftsLabelLines.checked = sideGifts.labelTwoLines === true;
  sideGiftsOutlineSize.value = sideGifts.outlineSize;
  sideGiftsGiftOutlineSize.value = sideGifts.giftOutlineSize;
  sideGiftsTileOpacity.value = String(sideGifts.tileOpacity);
  sideGiftsSounds.value = sideGifts.soundsEnabled === false ? '0' : '1';
  sideGiftsAnimations.value = sideGifts.animationsEnabled === false ? '0' : '1';
  sideGiftsProfileAnimation.value = sideGifts.profileAnimationEnabled === true ? '1' : '0';
  sideGiftsProfileName.value = sideGifts.profileNameEnabled === true ? '1' : '0';
  sideGiftsColorFields.forEach(field => {
    const value = normalizeHex(sideGifts[field.key], defaultSideGifts[field.key]);
    field.color.value = value;
    field.hex.value = value.toUpperCase();
  });
  updateSideGiftsStyleLabels();
  updateSideGiftsPreviewFrameSize();
}

function updateSideGiftsStyleLabels() {
  if (sideGiftsLabelSizeLabel && sideGiftsLabelSize) {
    sideGiftsLabelSizeLabel.textContent = `${sideGiftsLabelSize.value}px`;
  }

  if (sideGiftsOutlineSizeLabel && sideGiftsOutlineSize) {
    sideGiftsOutlineSizeLabel.textContent = `${formatPixelSliderValue(sideGiftsOutlineSize.value)}px`;
  }

  if (sideGiftsGiftOutlineSizeLabel && sideGiftsGiftOutlineSize) {
    sideGiftsGiftOutlineSizeLabel.textContent = `${formatPixelSliderValue(sideGiftsGiftOutlineSize.value)}px`;
  }

  if (sideGiftsTileOpacityLabel && sideGiftsTileOpacity) {
    sideGiftsTileOpacityLabel.textContent = `${Math.round(Number(sideGiftsTileOpacity.value || 0) * 100)}%`;
  }
}

function formatPixelSliderValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function updateProfileNameToggleVisibility() {
  const carouselField = carouselProfileName?.closest('[data-profile-name-toggle]');
  const rowsField = rowsProfileName?.closest('[data-profile-name-toggle]');
  const sideGiftsField = sideGiftsProfileName?.closest('[data-profile-name-toggle]');

  if (carouselField) {
    carouselField.hidden = carouselProfileAnimation.value !== '1';
  }

  if (rowsField) {
    rowsField.hidden = rowsProfileAnimation.value !== '1';
  }

  if (sideGiftsField) {
    sideGiftsField.hidden = sideGiftsProfileAnimation.value !== '1';
  }
}

function renderRewardsList() { renderRowsWorkspace(); }

function setupCarouselRewardDrag(editor, index) {
  editor.addEventListener('dragstart', event => {
    if (event.target.closest('input, select, textarea, button')) {
      event.preventDefault();
      return;
    }

    editor.classList.add('is-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
    event.dataTransfer.setData('application/x-carousel-reward-index', String(index));
  });

  editor.addEventListener('dragover', event => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    updateCarouselDropTarget(editor, event);
  });

  editor.addEventListener('dragleave', event => {
    if (!editor.contains(event.relatedTarget)) {
      clearCarouselDropTarget(editor);
    }
  });

  editor.addEventListener('drop', event => {
    event.preventDefault();
    const sourceIndex = Number(event.dataTransfer.getData('application/x-carousel-reward-index') || event.dataTransfer.getData('text/plain'));
    const targetIndex = Number(editor.dataset.index);
    const insertAfter = getCarouselDropPlacement(editor, event) === 'after';
    clearCarouselDragState();
    moveReward(sourceIndex, targetIndex + (insertAfter ? 1 : 0));
  });

  editor.addEventListener('dragend', clearCarouselDragState);
}

function updateCarouselDropTarget(editor, event) {
  const placement = getCarouselDropPlacement(editor, event);
  if (carouselDropTarget === editor && carouselDropPlacement === placement) {
    return;
  }

  if (carouselDropTarget && carouselDropTarget !== editor) {
    clearCarouselDropTarget(carouselDropTarget);
  }

  carouselDropTarget = editor;
  carouselDropPlacement = placement;
  editor.classList.toggle('is-drop-before', placement === 'before');
  editor.classList.toggle('is-drop-after', placement === 'after');
}

function getCarouselDropPlacement(editor, event) {
  const rect = editor.getBoundingClientRect();
  return event.clientY > rect.top + (rect.height / 2) ? 'after' : 'before';
}

function clearCarouselDropTarget(editor) {
  editor.classList.remove('is-drop-before', 'is-drop-after');
  if (carouselDropTarget === editor) {
    carouselDropTarget = null;
    carouselDropPlacement = '';
  }
}

function clearCarouselDragState() {
  rewardList.querySelector('.reward-editor.is-dragging')?.classList.remove('is-dragging');
  if (carouselDropTarget) {
    clearCarouselDropTarget(carouselDropTarget);
  }
}

function renderRowsGifts() {
  renderRowsWorkspace();
}

function getRowsGiftSettingsMarkup(row) {
  const perRow = getCsvValue(draftConfig.rowsOverlay.perRow, row, 6);
  const speed = getCsvValue(draftConfig.rowsOverlay.speeds, row, 28);
  const direction = getCsvValue(draftConfig.rowsOverlay.directions, row, 'left');
  const isScrolling = getScrollingRowsSet().has(row);

  return `
    <div class="rows-gift-settings" data-row-settings="${row}">
      <label>
        <span>Cards visible</span>
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
    input.addEventListener('change',()=>renderRowsWorkspace());
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
      if (event.target.closest('input, select, textarea, button')) {
        event.preventDefault();
        return;
      }

      editor.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
      event.dataTransfer.setData('application/x-rows-gift-index', String(index));
    });

    editor.addEventListener('dragend', clearRowsGiftDragState);

    return editor;
}

function renderSideGifts() { renderRowsWorkspace(); }

function createSideGiftEditor(gift, index) {
  const editor = template.content.firstElementChild.cloneNode(true);
  editor.dataset.index = String(index);
  editor.dataset.mode = 'side-gifts';

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

  const triggerFields = editor.querySelector('.reward-trigger-fields');
  triggerFields?.insertAdjacentHTML('beforeend', `
    <div class="config-field">
      <label>Side</label>
      <select data-field="side" aria-label="Display side">
        <option value="auto"${gift.side === 'auto' ? ' selected' : ''}>Auto split</option>
        <option value="left"${gift.side === 'left' ? ' selected' : ''}>Left</option>
        <option value="right"${gift.side === 'right' ? ' selected' : ''}>Right</option>
      </select>
      <span class="field-hint">Override which column this gift appears in</span>
    </div>
  `);

  populateGiftGrid(editor, gift);
  updateTriggerFields(editor, gift);
  alignAudioPreview(editor);
  updatePreview(editor, gift);

  editor.addEventListener('input', event => {
    if (event.target.matches('[data-gift-search]')) {
      populateGiftGrid(editor, draftConfig.sideGifts.gifts[index], event.target.value);
      return;
    }

    if (event.target.dataset.field) {
      updateSideGiftFromEditor(index, editor);
      markDirty();
      updateEditorState(editor, draftConfig.sideGifts.gifts[index]);
      if (event.target.matches('[data-field="image"], [data-field="sound"], [data-field="volume"], [data-field="triggerType"], [data-field^="likes"]')) {
        updatePreview(editor, draftConfig.sideGifts.gifts[index]);
      }
    }
  });

  editor.addEventListener('click', event => {
    const actionButton = event.target.closest('[data-action]');
    const action = actionButton?.dataset.action;
    if (!action) return;

    if (action === 'select-gift-catalog') {
      applySideGiftSelection(index, editor, actionButton.dataset.image);
      return;
    }

    if (action === 'toggle-gift-favorite') {
      toggleGiftFavorite(actionButton.dataset.image);
      populateGiftGrid(editor, draftConfig.sideGifts.gifts[index], editor.querySelector('[data-gift-search]')?.value || '');
      return;
    }

    if (action === 'toggle-details') {
      toggleDetailsSection(editor);
      return;
    }

    if (action === 'play-sound') {
      playSoundPreview(editor, draftConfig.sideGifts.gifts[index]);
      return;
    }

    handleSideGiftAction(action, index);
  });

  updateEditorState(editor, gift);
  return editor;
}

function setupRowsGiftDropzone(dropzone, row) {
  dropzone.addEventListener('dragover', event => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    dropzone.classList.add('is-drag-over');

    const targetEditor = event.target.closest('.reward-editor[data-mode="rows"]');
    if (targetEditor && dropzone.contains(targetEditor)) {
      updateRowsGiftDropTarget(targetEditor, event);
    } else if (rowsGiftDropTarget) {
      clearRowsGiftDropTarget(rowsGiftDropTarget);
    }
  });

  dropzone.addEventListener('dragleave', event => {
    if (!dropzone.contains(event.relatedTarget)) {
      dropzone.classList.remove('is-drag-over');
      if (rowsGiftDropTarget && dropzone.contains(rowsGiftDropTarget)) {
        clearRowsGiftDropTarget(rowsGiftDropTarget);
      }
    }
  });

  dropzone.addEventListener('drop', event => {
    event.preventDefault();
    dropzone.classList.remove('is-drag-over');

    const sourceIndex = Number(event.dataTransfer.getData('application/x-rows-gift-index') || event.dataTransfer.getData('text/plain'));
    const targetEditor = event.target.closest('.reward-editor[data-mode="rows"]');
    const beforeIndex = targetEditor ? Number(targetEditor.dataset.index) : null;
    const insertAfter = targetEditor ? getRowsGiftDropPlacement(targetEditor, event) === 'after' : false;
    clearRowsGiftDragState();
    moveRowsGift(sourceIndex, row, beforeIndex, insertAfter);
  });
}

function updateRowsGiftDropTarget(editor, event) {
  const placement = getRowsGiftDropPlacement(editor, event);
  if (rowsGiftDropTarget === editor && rowsGiftDropPlacement === placement) {
    return;
  }

  if (rowsGiftDropTarget && rowsGiftDropTarget !== editor) {
    clearRowsGiftDropTarget(rowsGiftDropTarget);
  }

  rowsGiftDropTarget = editor;
  rowsGiftDropPlacement = placement;
  editor.classList.toggle('is-drop-before', placement === 'before');
  editor.classList.toggle('is-drop-after', placement === 'after');
}

function getRowsGiftDropPlacement(editor, event) {
  const rect = editor.getBoundingClientRect();
  return event.clientX > rect.left + (rect.width / 2) ? 'after' : 'before';
}

function clearRowsGiftDropTarget(editor) {
  editor.classList.remove('is-drop-before', 'is-drop-after');
  if (rowsGiftDropTarget === editor) {
    rowsGiftDropTarget = null;
    rowsGiftDropPlacement = '';
  }
}

function clearRowsGiftDragState() {
  rowsGiftList.querySelector('.reward-editor.is-dragging')?.classList.remove('is-dragging');
  rowsGiftList.querySelectorAll('.rows-gift-dropzone.is-drag-over').forEach(zone => {
    zone.classList.remove('is-drag-over');
  });
  if (rowsGiftDropTarget) {
    clearRowsGiftDropTarget(rowsGiftDropTarget);
  }
}

function moveRowsGift(sourceIndex, row, beforeIndex = null, insertAfter = false) {
  if (!Number.isInteger(sourceIndex) || !draftConfig.rowsOverlay.gifts[sourceIndex]) {
    return;
  }

  if (beforeIndex === sourceIndex) {
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
  let insertIndex = beforeGift && beforeGift.row === targetRow ? targetGroup.indexOf(beforeGift) : -1;

  if (insertIndex === -1) {
    targetGroup.push(movedGift);
  } else {
    if (insertAfter) {
      insertIndex += 1;
    }
    targetGroup.splice(insertIndex, 0, movedGift);
  }

  const selectedIndex = groups.flat().indexOf(rowsSelectedGift);
  draftConfig.rowsOverlay.gifts = groups.flat().map((gift, index) => ({
    ...gift,
    row: clamp(Number(gift.row || 1), 1, draftConfig.rowsOverlay.rows)
  }));
  rowsSelectedGift = draftConfig.rowsOverlay.gifts[selectedIndex] || null;

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
  // Each configured card is an independent action, even when gifts repeat.
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
  if (gift.triggerType && gift.triggerType !== 'gift') return ''; // Event cards may intentionally share a gift backup.

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
    imagePreview.src = resolveRewardImageUrl(displayImage);
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

function resolveRewardImageUrl(image) {
  const value = String(image || '');
  if (value.startsWith('./rewards/')) {
    return `${remoteRewardImageBase}${encodeURIComponent(value.replace('./rewards/', ''))}`;
  }

  return value;
}

function ensureRowsGiftDefaults() {
  if (!Array.isArray(draftConfig.rowsOverlay.gifts)) {
    draftConfig.rowsOverlay.gifts = getDefaultRowsGifts().map(normalizeRowsGift);
  }
}

function ensureSideGiftDefaults() {
  if (!Array.isArray(draftConfig.sideGifts.gifts)) {
    draftConfig.sideGifts.gifts = getDefaultSideGifts().map(normalizeSideGift);
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

  const sounds = [...soundCatalog,...(window.studioSoundLibrary||[]).filter(sound=>!sound.removed).map(sound=>({label:sound.name,sound:sound.url}))];

  if (selectedSound && !sounds.some(item => item.sound === selectedSound)) {
    sounds.push({ label: getSoundLabel(selectedSound), sound: selectedSound });
  }

  select.innerHTML = sounds.map(item => `
    <option value="${escapeAttribute(item.sound)}">${escapeHtml(item.label)}</option>
  `).join('');
}

function getSoundLabel(soundPath) {
  const hosted=(window.studioSoundLibrary||[]).find(item=>item.url===soundPath);if(hosted)return hosted.name+(hosted.removed?' (removed from library)':'');
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

function applySideGiftSelection(index, editor, imagePath) {
  const gift = getImageCatalogEntry(imagePath);
  if (!gift) return;

  const giftName = gift.name || gift.label || getImageLabel(gift.image);
  const giftId = gift.id || gift.giftId || '';

  editor.querySelector('[data-field="giftNames"]').value = giftName;
  editor.querySelector('[data-field="giftIds"]').value = giftId;
  editor.querySelector('[data-field="image"]').value = gift.image || '';

  const titleInput = editor.querySelector('[data-field="title"]');
  if (!titleInput.value.trim() || titleInput.value.trim() === 'New Side Gift') {
    titleInput.value = giftName;
  }

  updateSideGiftFromEditor(index, editor);
  markDirty();
  updateEditorState(editor, draftConfig.sideGifts.gifts[index]);
  updatePreview(editor, draftConfig.sideGifts.gifts[index]);
  populateGiftGrid(editor, draftConfig.sideGifts.gifts[index], editor.querySelector('[data-gift-search]')?.value || '');
  setState(`Selected side gift: ${giftName}`);
}

function populateGiftGrid(editor, reward, filter = '') {
  const grid = editor.querySelector('[data-gift-grid]');
  if (!grid) return;

  const selectedEntry = getSelectedGiftEntry(reward);
  const selectedImage = selectedEntry?.image || '';
  const query = normalizeName(filter);
  const matches = getGiftCatalogEntries().filter(entry => matchesGiftSearch(entry, filter));
  const sortedMatches = sortGiftEntriesForPicker(matches, query);
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
          <img src="${escapeAttribute(resolveRewardImageUrl(entry.image))}" alt="" loading="lazy" decoding="async">
          <strong>${escapeHtml(entry.label)}</strong>
          <span class="gift-coin-value">${entry.coins !== null && entry.coins !== undefined ? escapeHtml(String(entry.coins)) + ' coins' : 'Coin value unknown'}</span>
          ${entry.creatorManaged ? '<span class="gift-source-badge">' + (entry.source === 'manual' ? 'Imported' : 'Discovered') + '</span>' : ''}
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

function sortGiftEntriesForPicker(entries, query = '') {
  return [...entries].sort((first, second) => {
    const firstRank = getGiftSearchRank(first, query);
    const secondRank = getGiftSearchRank(second, query);

    if (firstRank !== secondRank) {
      return firstRank - secondRank;
    }

    const firstFavorite = isGiftFavorite(first.image) ? 0 : 1;
    const secondFavorite = isGiftFavorite(second.image) ? 0 : 1;

    if (firstFavorite !== secondFavorite) {
      return firstFavorite - secondFavorite;
    }

    return first.label.localeCompare(second.label);
  });
}

function getGiftSearchRank(entry, query) {
  const normalizedQuery = normalizeName(query);
  if (!normalizedQuery) return 0;

  const values = [
    entry.name,
    entry.label,
    entry.id,
    entry.giftId
  ]
    .map(normalizeName)
    .filter(Boolean);
  if (values.some(value => value === normalizedQuery)) return 0;
  if (values.some(value => value.startsWith(normalizedQuery))) return 1;

  const words = values.flatMap(value => value.split(/\s+/).filter(Boolean));
  if (words.some(word => word === normalizedQuery)) return 2;
  if (words.some(word => word.startsWith(normalizedQuery))) return 3;
  return 4;
}

function getGiftFavoriteKey(imagePath) {
  if(String(imagePath).startsWith('id:'))return String(imagePath);
  try{const entry=getImageCatalogEntry(imagePath);if(entry?.id)return 'id:'+entry.id;}catch{}
  return normalizePath(imagePath).toLowerCase();
}

function isGiftFavorite(imagePath) {
  return giftFavorites.has(getGiftFavoriteKey(imagePath))||giftFavorites.has(normalizePath(imagePath).toLowerCase());
}

function toggleGiftFavorite(imagePath) {
  const key = getGiftFavoriteKey(imagePath);
  const entry = getImageCatalogEntry(imagePath);

  if (!key || !entry) {
    return;
  }

  if (isGiftFavorite(imagePath)) {
    giftFavorites.delete(key);giftFavorites.delete(normalizePath(imagePath).toLowerCase());
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
  const views = editorCatalogueViews();
  const image = normalizePath(reward?.image || '').toLowerCase();
  const byImage = image && imageCatalog.get(image);
  return byImage || (reward?.giftIds || []).map(id => views.byId.get(String(id))).find(Boolean)
    || (reward?.giftNames || []).map(name => views.byName.get(normalizeName(name))).find(Boolean);
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

  invalidateEditorCatalogue();
  imageCatalog.set(key, {
    ...current,
    ...details,
    id,
    image: normalizedPath,
    label: getDisplayLabel(label || details.name || current.label || getImageLabel(normalizedPath))
  });
}

function getImageCatalogEntries() {
  return editorCatalogueViews().entries;
}

function getGiftCatalogEntries() {
  const views = editorCatalogueViews();
  if(views.gifts && views.archive === includeGiftArchive && views.current === currentGiftCatalogue && views.creator === creatorGiftEntries)return views.gifts;
  const creatorIds = new Set(creatorGiftEntries.map(gift=>gift.id));
  views.archive=includeGiftArchive;views.current=currentGiftCatalogue;views.creator=creatorGiftEntries;
  return views.gifts=views.entries.filter(entry=>entry.image&&String(entry.label||entry.name||'').trim()&&(!currentGiftCatalogue?.gifts?.length||includeGiftArchive||entry.catalogueManaged||entry.creatorManaged)&&(entry.creatorManaged||!creatorIds.has(entry.id)||includeGiftArchive));
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

function updateSideGiftStats() {
  const total = draftConfig.sideGifts.gifts.length;
  const enabled = draftConfig.sideGifts.gifts.filter(gift => gift.enabled !== false).length;
  sideGiftTotal.textContent = String(total);
  sideGiftEnabled.textContent = String(enabled);
}

function setActiveTab(tabName) {
  if (tabName === activeConfigTab && !document.body.classList.contains('studio-output-active')) return;
  activeConfigTab = tabName;
  window.dispatchEvent(new CustomEvent('rewardconfig:tabchanged', { detail: { tabName } }));

  tabButtons.forEach(button => {
    button.classList.toggle('is-active', button.dataset.configTab === tabName);
    if (button.dataset.configTab === tabName) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });

  const activeButton = Array.from(tabButtons).find(button => button.dataset.configTab === tabName);
  if (studioCurrentTitle && activeButton) {
    studioCurrentTitle.textContent = activeButton.dataset.studioTitle || activeButton.textContent.trim();
  }

  configPanels.forEach(panel => {
    panel.hidden = panel.dataset.configPanel !== tabName;
  });

  setStudioWorkspace('editor');
  renderPreservingScroll();
}

function setStudioWorkspace(workspace, options = {}) {
  const showOutputs = workspace === 'outputs';
  document.body.classList.toggle('studio-output-active', showOutputs);

  if (studioOutputWorkspace) studioOutputWorkspace.hidden = !showOutputs;
  studioOutputTab?.classList.toggle('is-active', showOutputs);
  studioOutputTab?.setAttribute('aria-pressed', String(showOutputs));
  document.title = `King Gumption Studio — ${showOutputs ? 'Canvas Designer' : 'Overlay Editor'}`;

  if (showOutputs) {
    tabButtons.forEach(button => button.classList.remove('is-active'));
    if (studioOutputFrame && !studioOutputFrame.hasAttribute('src')) {
      studioOutputFrame.src = studioOutputFrame.dataset.src;
    } else {
      activateOutputFrame();
    }
  } else {
    const activeButton = Array.from(tabButtons).find(button => button.dataset.configTab === activeConfigTab);
    activeButton?.classList.add('is-active');
  }

  syncEditorPreviewActivity();
  if (options.updateUrl === false) return;
  const url = new URL(window.location.href);
  if (showOutputs) {
    url.searchParams.set('workspace', 'outputs');
  } else {
    url.searchParams.delete('workspace');
  }
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

function activateOutputFrame() {
  if (studioOutputFrame?.dataset.ready !== '1') return;
  studioOutputFrame?.contentWindow?.postMessage({ type: 'studio:activate-output' }, window.location.origin);
}

function updateGlobalsFromForm() {
  draftConfig.rotateMs = numberOrDefault(rotateMs.value, 2600);
  draftConfig.holdOnGiftMs = numberOrDefault(holdMs.value, 6500);
  draftConfig.labelMs = numberOrDefault(labelMs.value, 2600);
  draftConfig.visibleNext = clamp(numberOrDefault(visibleNext.value, 3), 0, 3);
  draftConfig.soundsEnabled = carouselSounds.value !== '0';
  draftConfig.animationsEnabled = carouselAnimations.value !== '0';
  draftConfig.profileAnimationEnabled = carouselProfileAnimation.value === '1';
  draftConfig.profileNameEnabled = draftConfig.profileAnimationEnabled && carouselProfileName.value === '1';
  updateThemeFromForm();
}

function updateRowsFromForm() {
  const currentGifts = draftConfig.rowsOverlay.gifts;
  draftConfig.rowsOverlay = normalizeRowsOverlay({
    rows: rowsCount.value,
    perRow: rowsPerRow.value,
    scrollRows: rowsScrolling.value,
    directions: rowsDirections.value,
    speeds: rowsSpeeds.value,
    rowHeight: rowsHeight.value,
    labelSize: rowsLabelSize.value,
    gap: rowsGap.value,
    names: rowsNames.value !== '0',
    soundsEnabled: rowsSounds.value !== '0',
    animationsEnabled: rowsAnimations.value !== '0',
    profileAnimationEnabled: rowsProfileAnimation.value === '1',
    profileNameEnabled: rowsProfileAnimation.value === '1' && rowsProfileName.value === '1',
    gifts: draftConfig.rowsOverlay.gifts
  });
  // Saving normalizes values, but inspector handlers must retain the same card objects.
  draftConfig.rowsOverlay.gifts = draftConfig.rowsOverlay.gifts.map((gift, index) => Object.assign(currentGifts[index] || {}, gift));
  ensureRowsGiftRows();
}

function updateGoalBarFromForm() {
  const appearance = goalAppearanceEnabled.checked ? {
    enabled: true,
    ...(draftConfig.goalBar.appearance?.noBackground?{noBackground:true}:{}),
    ...Object.fromEntries(goalAppearanceFields.map(field => [field.key, field.color.value])),
    backgroundOpacity: goalAppearanceOpacity.value,
    glowStrength: goalAppearanceGlow.value,
    gloss: goalAppearanceGloss.checked
  } : undefined;
  draftConfig.goalBar = normalizeGoalBar({
    ...(draftConfig.goalBar.graphic?{graphic:draftConfig.goalBar.graphic}:{}),
    appearance,
    type: goalType.value,
    useLiveFollowerCount: goalLiveFollowers.value !== '0',
    label: goalLabel.value,
    target: goalTarget.value,
    step: goalStep.value,
    start: goalStart.value,
    resetOnConnect: goalReset.value !== '0',
    width: goalWidth.value,
    height: goalHeight.value,
    ...Object.fromEntries(goalFontFields.map(field => [field.key, field.input.value])),
    accent: goalColorFields.find(field => field.key === 'accent')?.hex.value,
    glow: goalColorFields.find(field => field.key === 'glow')?.hex.value,
    text: goalColorFields.find(field => field.key === 'text')?.hex.value
  });
}

function updateTopLikersFromForm() {
  draftConfig.topLikers = normalizeTopLikers({
    ...(draftConfig.topLikers.graphic?{graphic:draftConfig.topLikers.graphic}:{}),
    limit: topLikersLimit.value,
    showAvatar: topLikersAvatars.value !== '0',
    showNames: topLikersNames.value !== '0',
    showHeart: topLikersHeart.value !== '0',
    layout: topLikersLayout.value,
    likeMilestone: topLikersLikeMilestone.value,
    medalHearts: topLikersMedalHearts.value !== '0',
    resetOnConnect: topLikersReset.value !== '0',
    width: topLikersWidth.value,
    height: topLikersHeight.value,
    showShell: topLikersShell.value !== '0',
    showTitle: topLikersTitle.value !== '0',
    showTiles: topLikersTiles.value !== '0',
    opacity: topLikersOpacity.value,
    tileOpacity: topLikersTileOpacity.value,
    ...Object.fromEntries(topLikersColorFields.map(field => [field.key, field.hex.value]))
  });
  topLikersOpacityLabel.textContent = `${Math.round(draftConfig.topLikers.opacity * 100)}%`;
  topLikersTileOpacityLabel.textContent = `${Math.round(draftConfig.topLikers.tileOpacity * 100)}%`;
  topLikersWidthLabel.textContent = `${draftConfig.topLikers.width}px`;
  topLikersHeightLabel.textContent = `${draftConfig.topLikers.height}px`;
  updateTopLikersPreviewFrameSize();
}

function updateTopLikersPreviewFrameSize() {
  if (!topLikersPreview || !draftConfig?.topLikers) {
    return;
  }

  topLikersPreview.style.width = `${draftConfig.topLikers.width}px`;
  topLikersPreview.style.height = `${getEffectiveTopLikersHeight(draftConfig.topLikers)}px`;
}

function updateSideGiftsFromForm() {
  const currentGifts = draftConfig.sideGifts.gifts;
  draftConfig.sideGifts = normalizeSideGifts({
    ...(draftConfig.sideGifts.graphic?{graphic:draftConfig.sideGifts.graphic}:{}),
    ...draftConfig.sideGifts,
    side: sideGiftsSide.value,
    width: sideGiftsWidth.value,
    height: getEffectiveSideGiftsPreviewHeight(draftConfig.sideGifts),
    iconSize: sideGiftsIconSize.value,
    gap: sideGiftsGap.value,
    insetX: sideGiftsInsetX.value,
    insetY: sideGiftsInsetY.value,
    showLabels: sideGiftsLabels.value === '1',
    outlinesEnabled: sideGiftsOutlines.value === '1',
    tilesEnabled: sideGiftsTiles.value === '1',
    idleGlowEnabled: sideGiftsIdleGlow.value === '1',
    labelSize: sideGiftsLabelSize.value,
    labelTwoLines: sideGiftsLabelLines.checked,
    outlineSize: sideGiftsOutlineSize.value,
    giftOutlineSize: sideGiftsGiftOutlineSize.value,
    tileOpacity: sideGiftsTileOpacity.value,
    soundsEnabled: sideGiftsSounds.value !== '0',
    animationsEnabled: sideGiftsAnimations.value !== '0',
    profileAnimationEnabled: sideGiftsProfileAnimation.value === '1',
    profileNameEnabled: sideGiftsProfileAnimation.value === '1' && sideGiftsProfileName.value === '1'
  });
  draftConfig.sideGifts.gifts = draftConfig.sideGifts.gifts.map((gift,index)=>Object.assign(currentGifts[index] || {},gift));
  draftConfig.sideGifts.height = getEffectiveSideGiftsPreviewHeight(draftConfig.sideGifts);
  sideGiftsHeight.value = draftConfig.sideGifts.height;
  sideGiftsColorFields.forEach(field => {
    draftConfig.sideGifts[field.key] = normalizeHex(field.hex.value, defaultSideGifts[field.key]);
  });
  updateSideGiftsPreviewFrameSize();
}

function updateSideGiftsPreviewFrameSize() {
  if (!sideGiftsPreview || !draftConfig?.sideGifts) {
    return;
  }

  const frame = sideGiftsPreview.closest('.overlay-preview-frame-side-gifts');
  if (frame) {
    frame.style.setProperty('--side-gifts-preview-width', `${draftConfig.sideGifts.width}px`);
    frame.style.setProperty('--side-gifts-preview-height', `${getEffectiveSideGiftsPreviewHeight(draftConfig.sideGifts)}px`);
  }
}

function getEffectiveSideGiftsPreviewHeight(sideGiftsConfig) {
  const sideGifts = normalizeSideGifts(sideGiftsConfig || {});
  const visibleGifts = sideGifts.gifts.filter(gift => gift.enabled !== false);
  const leftCount = visibleGifts.filter((gift, index) => getSideGiftPreviewSide(gift, index, sideGifts.side) === 'left').length;
  const rightCount = visibleGifts.filter((gift, index) => getSideGiftPreviewSide(gift, index, sideGifts.side) === 'right').length;
  const slotCount = Math.max(leftCount, rightCount, 1);
  const labelLines = sideGifts.labelTwoLines ? 2 : 1;
  const labelHeight = sideGifts.showLabels ? Math.ceil(sideGifts.labelSize * 1.18 * labelLines) : 0;
  const tileExtra = sideGifts.tilesEnabled ? 18 : 4;
  const edgePadding = 88;
  return (slotCount * (sideGifts.iconSize + labelHeight + tileExtra)) + (Math.max(0, slotCount - 1) * sideGifts.gap) + edgePadding;
}

function getSideGiftPreviewSide(gift, index, globalSide) {
  if ((globalSide === 'left' || globalSide === 'right') && gift.side !== globalSide) {
    return '';
  }

  if (gift.side === 'left' || gift.side === 'right') {
    return gift.side;
  }

  if (globalSide === 'left' || globalSide === 'right') {
    return '';
  }

  return index % 2 === 0 ? 'left' : 'right';
}

function getEffectiveTopLikersHeight(topLikersConfig) {
  const topLikers = normalizeTopLikers(topLikersConfig || {});
  const rowHeight = 58;
  const rowGap = 8;
  const headerHeight = topLikers.showTitle ? 52 : 0;
  const shellPadding = 56;
  const rowsHeight = (topLikers.limit * rowHeight) + (Math.max(0, topLikers.limit - 1) * rowGap);
  const naturalHeight = rowsHeight + headerHeight + shellPadding;
  const titleAdjustment = topLikers.showTitle ? 0 : 52;
  const configuredHeight = Math.max(1, topLikers.height - titleAdjustment);

  return Math.max(naturalHeight, configuredHeight);
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
    ...(draftConfig.carouselTheme?.graphic?{graphic:draftConfig.carouselTheme.graphic}:{}),
    ...(draftConfig.carouselTheme?.backgroundEnabled===false?{backgroundEnabled:false}:{}),
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
    ...(draftConfig.rowsTheme?.graphic?{graphic:draftConfig.rowsTheme.graphic}:{}),
    ...(draftConfig.rowsTheme?.backgroundEnabled===false?{backgroundEnabled:false}:{}),
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

function updateSideGiftFromEditor(index, editor) {
  const gift = draftConfig.sideGifts.gifts[index];
  gift.enabled = editor.querySelector('[data-field="enabled"]').checked;
  gift.title = editor.querySelector('[data-field="title"]').value.trim() || 'Side Gift';
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
  gift.side = normalizeSideGiftSide(editor.querySelector('[data-field="side"]')?.value);
  updateTriggerFields(editor, gift);
}

function normalizeSideGiftSide(value) {
  const side = String(value || '').toLowerCase();
  return side === 'left' || side === 'right' ? side : 'auto';
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

function handleSideGiftAction(action, index) {
  if (action === 'up' && index > 0) {
    swapSideGifts(index, index - 1);
  }

  if (action === 'down' && index < draftConfig.sideGifts.gifts.length - 1) {
    swapSideGifts(index, index + 1);
  }

  if (action === 'duplicate') {
    draftConfig.sideGifts.gifts.splice(index + 1, 0, cloneConfig(draftConfig.sideGifts.gifts[index]));
    markDirty();
    renderPreservingScroll();
  }

  if (action === 'delete') {
    draftConfig.sideGifts.gifts.splice(index, 1);
    markDirty();
    renderPreservingScroll();
  }
}

function swapSideGifts(a, b) {
  const gifts = draftConfig.sideGifts.gifts;
  [gifts[a], gifts[b]] = [gifts[b], gifts[a]];
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

function moveReward(sourceIndex, targetIndex) {
  if (!Number.isInteger(sourceIndex) || !draftConfig.rewards[sourceIndex]) {
    return;
  }

  const boundedTarget = clamp(Number(targetIndex), 0, draftConfig.rewards.length);
  if (sourceIndex === boundedTarget || sourceIndex + 1 === boundedTarget) {
    return;
  }

  const [movedReward] = draftConfig.rewards.splice(sourceIndex, 1);
  const adjustedTarget = sourceIndex < boundedTarget ? boundedTarget - 1 : boundedTarget;
  draftConfig.rewards.splice(adjustedTarget, 0, movedReward);

  markDirty();
  renderPreservingScroll();
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
    useGiftImage: false,
    giftImageNames: [],
    giftImageIds: [],
    row: clamp(Number(row), 1, draftConfig.rowsOverlay.rows),
    sound: '',
    volume: 0.85
  });

  markDirty();
  renderPreservingScroll();
}

function addSideGift() {
  draftConfig.sideGifts.gifts.push({
    enabled: true,
    title: 'New Side Gift',
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
    side: 'auto',
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

function resetConfig() {
  if (!confirm('Reset this overlay to its starter settings? You can undo the reset before leaving this design.')) return;
  const kind=overlayKindFromTab(activeConfigTab);
  draftConfig = normalizeConfig({...draftConfig,...extractOverlayConfig(normalizeConfig(baseConfig),kind)});
  localStorage.removeItem(rewardStorageKey);
  if (window.location.hash) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }
  markDirty();
  setState('Reset to file config — unsaved changes');
  renderPreservingScroll();
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
  markDirty();
}

function getUrlForPage(page, config = draftConfig, options = {}) {
  const graphicKind=page.includes('rows')?'rows':page.includes('side-gifts')?'side-gifts':page.includes('top-likers')?'top-likers':page.includes('thin')?'goal':'carousel';
  if(window.KGGraphics?.definition(graphicKind,config)){
    const url=new URL('./index-graphic.html',location.href);url.searchParams.set('kind',graphicKind);url.searchParams.set('preview','1');url.searchParams.set('mute','1');url.searchParams.set('sampleEvents',options.test||options.sampleEvents?'1':'0');
    const bytes=new TextEncoder().encode(JSON.stringify(config));let binary='';bytes.forEach(b=>binary+=String.fromCharCode(b));url.hash='config='+btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');return url;
  }
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

  if(typeof options.sampleEvents==='boolean')search.set('sampleEvents',options.sampleEvents?'1':'0');
  if (options.previewFit) {
    search.set('previewFit', '1');
  }

  if (options.stateKey) {
    search.set('stateKey', String(options.stateKey));
  }

  if (options.preview || options.test) {
    search.set('previewRefresh', 'stable');
    search.set('editorPreview','1');
  }
  url.search = search.toString();
  url.hash = `config=${encodeURIComponent(page === 'index-thin.html' ? encodeGoalConfig(config) : (options.preview || options.test ? encodeEditorPreviewConfig(page, config) : encodeConfig(config)))}`;
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
  return encodeCompactConfig(compactConfigForUrl(config));
}

function encodeGoalConfig(config) {
  return encodeCompactConfig(removeEmptyUrlFields({
    _: 'r2',
    q: compactGoalBarForUrl(config.goalBar)
  }));
}

function encodeCompactConfig(config) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(config))))
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
    i: config.profileAnimationEnabled === true && config.profileNameEnabled === true ? 1 : undefined,
    t: compactThemeForUrl(config.theme),
    u: compactThemeForUrl(config.carouselTheme),
    v: compactThemeForUrl(config.rowsTheme),
    o: compactRowsOverlayForUrl(config.rowsOverlay),
    z: compactSideGiftsForUrl(config.sideGifts),
    q: compactGoalBarForUrl(config.goalBar),
    w: compactTopLikersForUrl(config.topLikers),
    g: config.rewards.map(compactRewardForUrl)
  });
}

function compactThemeForUrl(theme) {
  const normalized = normalizeTheme(theme || {});
  const presetTheme = themePresets[normalized.preset] || defaultTheme;
  return removeEmptyUrlFields({
    j: normalized.backgroundEnabled===false?0:undefined,
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
    n: rows.labelSize !== 11 ? rows.labelSize : undefined,
    g: rows.gap || undefined,
    h: rows.names === false ? 0 : undefined,
    i: rows.soundsEnabled === false ? 0 : undefined,
    k: rows.animationsEnabled === false ? 0 : undefined,
    l: rows.profileAnimationEnabled === false ? 0 : undefined,
    m: rows.profileAnimationEnabled !== false && rows.profileNameEnabled === false ? 0 : undefined,
    j: rows.gifts.map(compactRowsGiftForUrl)
  });
}

function compactSideGiftsForUrl(sideGifts) {
  const side = normalizeSideGifts(sideGifts || {});
  return removeEmptyUrlFields({
    a: side.side !== defaultSideGifts.side ? side.side : undefined,
    b: side.width !== defaultSideGifts.width ? side.width : undefined,
    c: side.height !== defaultSideGifts.height ? side.height : undefined,
    d: side.iconSize !== defaultSideGifts.iconSize ? side.iconSize : undefined,
    e: side.gap !== defaultSideGifts.gap ? side.gap : undefined,
    f: side.insetX !== defaultSideGifts.insetX ? side.insetX : undefined,
    g: side.insetY !== defaultSideGifts.insetY ? side.insetY : undefined,
    h: side.showLabels === false ? 0 : undefined,
    aa: side.outlinesEnabled === true ? 1 : undefined,
    ab: side.tilesEnabled === true ? 1 : undefined,
    am: side.idleGlowEnabled === true ? 1 : undefined,
    ac: side.labelSize !== defaultSideGifts.labelSize ? side.labelSize : undefined,
    ak: side.labelTwoLines === true ? 1 : undefined,
    ad: normalizeHex(side.labelColor, '') !== defaultSideGifts.labelColor ? side.labelColor : undefined,
    an: normalizeHex(side.gifterLabelColor, '') !== defaultSideGifts.gifterLabelColor ? side.gifterLabelColor : undefined,
    ae: normalizeHex(side.outlineColor, '') !== defaultSideGifts.outlineColor ? side.outlineColor : undefined,
    af: normalizeHex(side.giftOutlineColor, '') !== defaultSideGifts.giftOutlineColor ? side.giftOutlineColor : undefined,
    ai: decimalsMatch(side.outlineSize, defaultSideGifts.outlineSize) ? undefined : side.outlineSize,
    aj: decimalsMatch(side.giftOutlineSize, defaultSideGifts.giftOutlineSize) ? undefined : side.giftOutlineSize,
    i: normalizeHex(side.glow, '') !== defaultSideGifts.glow ? side.glow : undefined,
    j: normalizeHex(side.hitColor, '') !== defaultSideGifts.hitColor ? side.hitColor : undefined,
    ag: normalizeHex(side.tileColor, '') !== defaultSideGifts.tileColor ? side.tileColor : undefined,
    ah: normalizeHex(side.tileBorderColor, '') !== defaultSideGifts.tileBorderColor ? side.tileBorderColor : undefined,
    ao: decimalsMatch(side.tileOpacity, defaultSideGifts.tileOpacity) ? undefined : side.tileOpacity,
    k: side.hitMs !== defaultSideGifts.hitMs ? side.hitMs : undefined,
    l: side.soundsEnabled === false ? 0 : undefined,
    n: side.animationsEnabled === false ? 0 : undefined,
    o: side.profileAnimationEnabled === false ? 0 : undefined,
    p: side.profileAnimationEnabled !== false && side.profileNameEnabled === false ? 0 : undefined,
    m: side.gifts.map(compactSideGiftForUrl)
  });
}

function compactSideGiftForUrl(gift) {
  return compactGiftForUrl(gift, {
    r: gift.side && gift.side !== 'auto' ? gift.side : undefined,
    u: gift.useGiftImage ? 1 : undefined,
    x: gift.giftImageNames?.length ? gift.giftImageNames : undefined,
    y: gift.giftImageIds?.length ? gift.giftImageIds : undefined
  });
}

function compactGoalBarForUrl(goalBar) {
  const goal = normalizeGoalBar(goalBar || {});
  const defaultReset = defaultGoalResetOnConnect(goal.type);
  return removeEmptyUrlFields({
    a: goal.label !== defaultGoalBar.label ? goal.label : undefined,
    b: goal.step !== defaultGoalBar.step ? goal.step : undefined,
    c: goal.start !== defaultGoalBar.start ? goal.start : undefined,
    d: goal.resetOnConnect !== defaultReset ? (goal.resetOnConnect ? 1 : 0) : undefined,
    e: goal.width !== defaultGoalBar.width ? goal.width : undefined,
    f: goal.height !== defaultGoalBar.height ? goal.height : undefined,
    g: normalizeHex(goal.accent, '') !== defaultGoalBar.accent ? goal.accent : undefined,
    h: normalizeHex(goal.glow, '') !== defaultGoalBar.glow ? goal.glow : undefined,
    i: normalizeHex(goal.text, '') !== defaultGoalBar.text ? goal.text : undefined,
    j: goal.type !== defaultGoalBar.type ? goal.type : undefined,
    l: goal.target !== defaultGoalBar.target ? goal.target : undefined,
    m: goal.useLiveFollowerCount === false ? 0 : undefined,
    n: goal.appearance,
    o: goal.labelSize,
    p: goal.counterSize,
    r: goal.targetSize
  });
}

function compactTopLikersForUrl(topLikers) {
  const likers = normalizeTopLikers(topLikers || {});
  return removeEmptyUrlFields({
    a: likers.limit !== defaultTopLikers.limit ? likers.limit : undefined,
    b: likers.showAvatar === false ? 0 : undefined,
    z: likers.showNames === false ? 0 : undefined,
    c: likers.showHeart === false ? 0 : undefined,
    r: likers.layout !== defaultTopLikers.layout ? likers.layout : undefined,
    q: likers.likeMilestone !== defaultTopLikers.likeMilestone ? likers.likeMilestone : undefined,
    d: likers.medalHearts === false ? 0 : undefined,
    e: likers.resetOnConnect === false ? 0 : undefined,
    f: likers.width !== defaultTopLikers.width ? likers.width : undefined,
    g: likers.height !== defaultTopLikers.height ? likers.height : undefined,
    h: likers.showShell !== defaultTopLikers.showShell ? (likers.showShell ? 1 : 0) : undefined,
    i: likers.showTitle !== defaultTopLikers.showTitle ? (likers.showTitle ? 1 : 0) : undefined,
    y: likers.showTiles !== defaultTopLikers.showTiles ? (likers.showTiles ? 1 : 0) : undefined,
    j: normalizeHex(likers.backgroundStart, '') !== defaultTopLikers.backgroundStart ? likers.backgroundStart : undefined,
    k: normalizeHex(likers.backgroundEnd, '') !== defaultTopLikers.backgroundEnd ? likers.backgroundEnd : undefined,
    l: normalizeHex(likers.backgroundBase, '') !== defaultTopLikers.backgroundBase ? likers.backgroundBase : undefined,
    m: normalizeHex(likers.border, '') !== defaultTopLikers.border ? likers.border : undefined,
    n: normalizeHex(likers.tile, '') !== defaultTopLikers.tile ? likers.tile : undefined,
    o: normalizeHex(likers.tileBorder, '') !== defaultTopLikers.tileBorder ? likers.tileBorder : undefined,
    p: normalizeHex(likers.title, '') !== defaultTopLikers.title ? likers.title : undefined,
    s: normalizeHex(likers.text, '') !== defaultTopLikers.text ? likers.text : undefined,
    t: normalizeHex(likers.muted, '') !== defaultTopLikers.muted ? likers.muted : undefined,
    u: normalizeHex(likers.glow, '') !== defaultTopLikers.glow ? likers.glow : undefined,
    v: decimalsMatch(likers.opacity, defaultTopLikers.opacity) ? undefined : likers.opacity,
    x: decimalsMatch(likers.tileOpacity, defaultTopLikers.tileOpacity) ? undefined : likers.tileOpacity,
    aa: normalizeHex(likers.milestoneCard, '') !== defaultTopLikers.milestoneCard ? likers.milestoneCard : undefined,
    ac:likers.firstPlaceAccent,ad:likers.firstPlaceText,
    ab: normalizeHex(likers.milestoneText, '') !== defaultTopLikers.milestoneText ? likers.milestoneText : undefined
  });
}


function compactRowsGiftForUrl(gift) {
  return compactGiftForUrl(gift, {
    r: Number.isInteger(Number(gift.row)) ? Number(gift.row) : undefined,
    u: gift.useGiftImage ? 1 : 0,
    x: gift.giftImageNames?.length ? gift.giftImageNames : undefined,
    y: gift.giftImageIds?.length ? gift.giftImageIds : undefined
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
  // Test how the renderer will reconstruct this gift after the image field is
  // omitted. Keep the explicit path whenever name/ID lookup is ambiguous.
  const catalogMatch = findCatalogEntryForReward({ ...gift, image: '' });
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
    l: gift.likesRequired !== 50 ? gift.likesRequired : undefined,
    j: gift.likesHeartColor !== '#ef233c' ? gift.likesHeartColor : undefined,
    k: gift.likesNumberColor !== '#ffffff' ? gift.likesNumberColor : undefined,
    o: gift.likesHeartSize !== 160 ? gift.likesHeartSize : undefined,
    p: gift.likesNumberSize !== 96 ? gift.likesNumberSize : undefined,
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
    profileNameEnabled: config.i === 1 ? true : undefined,
    theme: expandCompactTheme(config.t),
    carouselTheme: expandCompactTheme(config.u),
    rowsTheme: expandCompactTheme(config.v),
    rowsOverlay: expandCompactRowsOverlay(config.o),
    sideGifts: expandCompactSideGifts(config.z),
    goalBar: expandCompactGoalBar(config.q),
    topLikers: expandCompactTopLikers(config.w),
    rewards: Array.isArray(config.g) ? config.g.map(expandCompactReward) : undefined
  });
}

function expandCompactTheme(theme) {
  if (!theme) {
    return undefined;
  }

  return removeEmptyUrlFields({
    preset: theme.p || 'glass-purple',
    ...(theme.j===0?{backgroundEnabled:false}:{}),
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
    labelSize: rows.n,
    gap: rows.g,
    names: rows.h === 0 ? false : undefined,
    soundsEnabled: rows.i === 0 ? false : undefined,
    animationsEnabled: rows.k === 0 ? false : undefined,
    profileAnimationEnabled: rows.l === 0 ? false : rows.l === 1 ? true : undefined,
    profileNameEnabled: rows.m === 0 ? false : rows.m === 1 ? true : undefined,
    gifts: Array.isArray(rows.j) ? rows.j.map(expandCompactRowsGift) : undefined
  });
}

function expandCompactSideGifts(side) {
  if (!side) {
    return undefined;
  }

  return removeEmptyUrlFields({
    side: side.a,
    width: side.b,
    height: side.c,
    iconSize: side.d,
    gap: side.e,
    insetX: side.f,
    insetY: side.g,
    showLabels: side.h === 0 ? false : undefined,
    outlinesEnabled: side.aa === 1 ? true : undefined,
    tilesEnabled: side.ab === 1 ? true : undefined,
    idleGlowEnabled: side.am === 1 ? true : undefined,
    labelSize: side.ac,
    labelTwoLines: side.ak === 1 ? true : undefined,
    labelColor: side.ad,
    gifterLabelColor: side.an,
    outlineColor: side.ae,
    giftOutlineColor: side.af,
    outlineSize: side.ai,
    giftOutlineSize: side.aj,
    glow: side.i,
    hitColor: side.j,
    tileColor: side.ag,
    tileBorderColor: side.ah,
    tileOpacity: side.ao,
    hitMs: side.k,
    soundsEnabled: side.l === 0 ? false : undefined,
    animationsEnabled: side.n === 0 ? false : undefined,
    profileAnimationEnabled: side.o === 0 ? false : undefined,
    profileNameEnabled: side.p === 0 ? false : side.p === 1 ? true : undefined,
    gifts: Array.isArray(side.m) ? side.m.map(expandCompactSideGift) : undefined
  });
}

function expandCompactSideGift(gift) {
  return {
    ...expandCompactReward(gift),
    side: gift?.r,
    useGiftImage: gift?.u === 1,
    giftImageNames: Array.isArray(gift?.x) ? gift.x : [],
    giftImageIds: Array.isArray(gift?.y) ? gift.y : []
  };
}

function expandCompactGoalBar(goal) {
  if (!goal) {
    return undefined;
  }

  return removeEmptyUrlFields({
    label: goal.a,
    step: goal.b,
    start: goal.c,
    resetOnConnect: goal.d === 0 ? false : goal.d === 1 ? true : undefined,
    width: goal.e,
    height: goal.f,
    accent: goal.g,
    glow: goal.h,
    text: goal.i,
    type: goal.j,
    target: goal.l,
    useLiveFollowerCount: goal.m === 0 ? false : undefined,
    ...normalizeGoalFonts({ labelSize: goal.o, counterSize: goal.p, targetSize: goal.r }),
    appearance: normalizeGoalAppearance(goal.n)
  });
}

function expandCompactTopLikers(likers) {
  if (!likers) {
    return undefined;
  }

  return removeEmptyUrlFields({
    limit: likers.a,
    showAvatar: likers.b === 0 ? false : undefined,
    showNames: likers.z === 0 ? false : undefined,
    showHeart: likers.c === 0 ? false : undefined,
    layout: likers.r,
    likeMilestone: likers.q,
    medalHearts: likers.d === 0 ? false : undefined,
    resetOnConnect: likers.e === 0 ? false : undefined,
    width: likers.f,
    height: likers.g,
    showShell: typeof likers.h === 'number' ? likers.h !== 0 : undefined,
    showTitle: typeof likers.i === 'number' ? likers.i !== 0 : undefined,
    showTiles: typeof likers.y === 'number' ? likers.y !== 0 : undefined,
    backgroundStart: likers.j,
    backgroundEnd: likers.k,
    backgroundBase: likers.l,
    border: likers.m,
    tile: likers.n,
    tileBorder: likers.o,
    title: likers.p,
    text: likers.s,
    muted: likers.t,
    glow: likers.u,
    opacity: likers.v,
    tileOpacity: likers.x,
    firstPlaceAccent:likers.ac,firstPlaceText:likers.ad,
    milestoneCard: likers.aa,
    milestoneText: likers.ab
  });
}


function expandCompactRowsGift(gift) {
  return {
    ...expandCompactGift(gift),
    row: gift?.r,
    useGiftImage: gift?.u === undefined ? undefined : gift.u === 1,
    giftImageNames: Array.isArray(gift?.x) ? gift.x : [],
    giftImageIds: Array.isArray(gift?.y) ? gift.y : []
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

function refreshOverlayPreviews(options = {}) {
  const previewConfig = cloneConfig(draftConfig);
  const initializeAll = options?.initializeAll === true;
  previewRefreshIndex += 1;
  const refreshCarousel = activeConfigTab === 'original';
  const refreshRows = activeConfigTab === 'rows';
  const refreshSideGifts = activeConfigTab === 'side-gifts';
  const refreshGoal = activeConfigTab === 'goal';
  const refreshTopLikers = activeConfigTab === 'top-likers';

  if (carouselPreview && refreshCarousel) {
    setPreviewUrl(carouselPreview, getUrlForPage('index-rewards.html', previewConfig, {
      preview: !carouselPreviewTest?.checked,
      test: Boolean(carouselPreviewTest?.checked),
      mute: Boolean(carouselPreviewMute?.checked),
      previewRefresh: previewRefreshIndex
    }));
  }

  if (rowsPreview && refreshRows) {
    setPreviewUrl(rowsPreview, getUrlForPage('index-rewards-rows.html', previewConfig, {
      preview: !rowsPreviewTest?.checked,
      test: Boolean(rowsPreviewTest?.checked),
      mute: Boolean(rowsPreviewMute?.checked),
      previewRefresh: previewRefreshIndex
    }));
  }

  if (sideGiftsPreview && refreshSideGifts) {
    updateSideGiftsPreviewFrameSize();
    setPreviewUrl(sideGiftsPreview, getUrlForPage('index-side-gifts-test.html', previewConfig, {
      test: Boolean(sideGiftsPreviewTest?.checked),
      preview: !sideGiftsPreviewTest?.checked,
      previewFit: true,
      mute: document.querySelector('#side-gifts-preview-mute')?.checked !== false,
      previewRefresh: previewRefreshIndex
    }));
  }

  if (goalPreview && refreshGoal) {
    setPreviewUrl(goalPreview, getUrlForPage('index-thin.html', previewConfig, {
      preview: true,
      sampleEvents: document.querySelector('#goal-preview-test')?.checked !== false,
      previewRefresh: previewRefreshIndex
    }));
  }

  if (topLikersPreview && refreshTopLikers) {
    updateTopLikersPreviewFrameSize();
    setPreviewUrl(topLikersPreview, getUrlForPage('index-top-likers-test.html', previewConfig, {
      test: document.querySelector('#top-likers-preview-test')?.checked !== false,
      preview: document.querySelector('#top-likers-preview-test')?.checked === false,
      stateKey: 'editor-preview',
      previewRefresh: previewRefreshIndex
    }));
  }
}

function setPreviewUrl(frame, url) {
  const kind=frame===carouselPreview?'carousel':frame===rowsPreview?'rows':frame===sideGiftsPreview?'side-gifts':frame===goalPreview?'goal':'top-likers';
  const config=extractOverlayConfig(draftConfig,kind),withoutTheme=value=>{const copy=cloneConfig(value);delete copy.theme;delete copy.carouselTheme;delete copy.rowsTheme;return JSON.stringify(copy);};
  const old=frame.studioConfig;frame.studioConfig=cloneConfig(config);
  if(old&&withoutTheme(old)===withoutTheme(config)&&frame.contentWindow?.studioApplyTheme&&new URL(frame.src).searchParams.get('test')===url.searchParams.get('test')&&new URL(frame.src).searchParams.get('mute')===url.searchParams.get('mute')){
    frame.contentWindow.studioApplyTheme(config);frame.dataset.previewUrl=url.toString();return;
  }
  const nextUrl = url.toString();

  if (frame.dataset.previewUrl === nextUrl) {
    return;
  }

  preserveScrollDuring(() => {
    frame.dataset.previewUrl = nextUrl;
    frame.addEventListener('load', () => {fitEditorPreview(frame);syncEditorPreviewActivity();}, {once:true});
    const navigationUrl = new URL(nextUrl);
    navigationUrl.searchParams.set('previewRefresh', String(previewRefreshIndex));
    frame.src = navigationUrl.toString();
  });
}

function markDirty() {
  scheduleOverlayPreviewRefresh();
  setState('⚠ Unsaved changes');
  window.dispatchEvent(new CustomEvent('rewardconfig:changed'));
}

function setState(text) {
  const label=String(text).replace(/^[\s✓⚠\uFE0F]+/u,'').trim();
  configState.textContent=label;configState.title=label;
  configState.dataset.state=/unsaved/i.test(label)?'warning':/failed|could not|error/i.test(label)?'error':'ready';
}

function normalizeConfig(config) {
  const fallbackRewards = Array.isArray(baseConfig.rewards) ? baseConfig.rewards : [];
  const rewards = Array.isArray(config.rewards) ? config.rewards : fallbackRewards;
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
    profileNameEnabled: config.profileAnimationEnabled === true && config.profileNameEnabled === true,
    theme: normalizeTheme(themeSource),
    carouselTheme: normalizeTheme(carouselThemeSource),
    rowsTheme: normalizeTheme(rowsThemeSource),
    rowsOverlay: normalizeRowsOverlay(config.rowsOverlay || {}),
    sideGifts: normalizeSideGifts(config.sideGifts || {}),
    goalBar: normalizeGoalBar(config.goalBar || {}),
    topLikers: normalizeTopLikers(config.topLikers || {}),
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
    ...(theme.graphic?{graphic:theme.graphic}:{}),
    ...(theme.backgroundEnabled===false?{backgroundEnabled:false}:{}),
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
  const useDefaultGifts = !Array.isArray(config.gifts);
  const gifts = useDefaultGifts ? getDefaultRowsGifts() : config.gifts;
  const migratedGap = config.gap;

  return {
    rows: clamp(numberOrDefault(config.rows, 2), 1, 8),
    schemaVersion: 1,
    perRow: normalizeCsv(config.perRow, '6,6'),
    scrollRows: normalizeCsv(config.scrollRows, ''),
    directions: normalizeCsv(config.directions, 'left,left'),
    speeds: normalizeCsv(config.speeds, '28,28'),
    rowHeight: clamp(numberOrDefault(config.rowHeight, 96), 64, 160),
    labelSize: clamp(numberOrDefault(config.labelSize, 11), 8, 24),
    gap: clamp(numberOrDefault(migratedGap, 0), 0, 32),
    names: config.names !== false,
    soundsEnabled: config.soundsEnabled !== false,
    animationsEnabled: config.animationsEnabled !== false,
    profileAnimationEnabled: config.profileAnimationEnabled !== false,
    profileNameEnabled: config.profileAnimationEnabled !== false && config.profileNameEnabled !== false,
    gifts: gifts.map(normalizeRowsGift)
  };
}

function normalizeSideGifts(config) {
  const side = String(config.side || defaultSideGifts.side).toLowerCase();
  return {
    ...(config.graphic?{graphic:config.graphic}:{}),
    side: side === 'left' || side === 'right' ? side : 'both',
    width: clamp(Math.floor(numberOrDefault(config.width, defaultSideGifts.width)), 180, 1920),
    height: clamp(Math.floor(numberOrDefault(config.height, defaultSideGifts.height)), 240, 1920),
    iconSize: clamp(Math.floor(numberOrDefault(config.iconSize, defaultSideGifts.iconSize)), 24, 120),
    gap: clamp(Math.floor(numberOrDefault(config.gap, defaultSideGifts.gap)), 0, 40),
    insetX: clamp(Math.floor(numberOrDefault(config.insetX, defaultSideGifts.insetX)), 0, 160),
    insetY: clamp(Math.floor(numberOrDefault(config.insetY, defaultSideGifts.insetY)), 0, 240),
    hitMs: clamp(Math.floor(numberOrDefault(config.hitMs, defaultSideGifts.hitMs)), 300, 10000),
    showLabels: config.showLabels !== false,
    outlinesEnabled: config.outlinesEnabled === true,
    tilesEnabled: config.tilesEnabled === true,
    idleGlowEnabled: config.idleGlowEnabled === true,
    labelSize: clamp(Math.floor(numberOrDefault(config.labelSize, defaultSideGifts.labelSize)), 8, 28),
    labelTwoLines: config.labelTwoLines === true,
    labelColor: normalizeHex(config.labelColor, defaultSideGifts.labelColor),
    gifterLabelColor: normalizeHex(config.gifterLabelColor, defaultSideGifts.gifterLabelColor),
    outlineColor: normalizeHex(config.outlineColor, defaultSideGifts.outlineColor),
    outlineSize: clamp(numberOrDefault(config.outlineSize, defaultSideGifts.outlineSize), 0, 4),
    giftOutlineColor: normalizeHex(config.giftOutlineColor, defaultSideGifts.giftOutlineColor),
    giftOutlineSize: clamp(numberOrDefault(config.giftOutlineSize, defaultSideGifts.giftOutlineSize), 0, 8),
    soundsEnabled: config.soundsEnabled !== false,
    animationsEnabled: config.animationsEnabled !== false,
    profileAnimationEnabled: config.profileAnimationEnabled !== false,
    profileNameEnabled: config.profileAnimationEnabled !== false && config.profileNameEnabled !== false,
    glow: normalizeHex(config.glow, defaultSideGifts.glow),
    hitColor: normalizeHex(config.hitColor, defaultSideGifts.hitColor),
    tileColor: normalizeHex(config.tileColor, defaultSideGifts.tileColor),
    tileOpacity: clamp(numberOrDefault(config.tileOpacity, defaultSideGifts.tileOpacity), 0, 1),
    tileBorderColor: normalizeHex(config.tileBorderColor, defaultSideGifts.tileBorderColor),
    gifts: Array.isArray(config.gifts) ? config.gifts.map(normalizeSideGift) : defaultSideGifts.gifts
  };
}

function normalizeSideGift(gift) {
  return {
    ...normalizeRowsGift(gift),
    title: String(gift.title || gift.name || 'Side Gift'),
    side: normalizeSideGiftSide(gift.side),
    row: undefined
  };
}

function normalizeGoalBar(config) {
  const type = normalizeGoalType(config.type);
  const defaultLabel = defaultGoalLabel(type);
  const legacyStep = Math.max(1, Math.floor(numberOrDefault(config.step, defaultGoalBar.step)));
  return {
    ...(config.graphic?{graphic:config.graphic}:{}),
    type,
    label: String(config.label || defaultLabel).replace(/\s+/g, ' ').trim().slice(0, 32) || defaultLabel,
    target: Math.max(1, Math.floor(numberOrDefault(config.target, legacyStep))),
    step: legacyStep,
    start: Math.max(0, Math.floor(numberOrDefault(config.start, defaultGoalBar.start))),
    resetOnConnect: typeof config.resetOnConnect === 'boolean' ? config.resetOnConnect : defaultGoalResetOnConnect(type),
    useLiveFollowerCount: config.useLiveFollowerCount !== false,
    width: clamp(numberOrDefault(config.width, defaultGoalBar.width), 320, 1920),
    height: clamp(numberOrDefault(config.height, defaultGoalBar.height), 30, 120),
    accent: normalizeHex(config.accent, defaultGoalBar.accent),
    glow: normalizeHex(config.glow, defaultGoalBar.glow),
    text: normalizeHex(config.text, defaultGoalBar.text),
    ...normalizeGoalFonts(config),
    ...(normalizeGoalAppearance(config.appearance) ? { appearance: normalizeGoalAppearance(config.appearance) } : {})
  };
}

function normalizeTopLikers(config) {
  return {
    ...(config.firstPlaceAccent?{firstPlaceAccent:normalizeHex(config.firstPlaceAccent,'#ffd83d')}:{}),
    ...(config.firstPlaceText?{firstPlaceText:normalizeHex(config.firstPlaceText,'#ffffff')}:{}),
    ...(config.graphic?{graphic:config.graphic}:{}),
    limit: clamp(Math.floor(numberOrDefault(config.limit, defaultTopLikers.limit)), 1, 10),
    showAvatar: config.showAvatar !== false,
    showNames: config.showNames !== false,
    showHeart: config.showHeart !== false,
    layout: normalizeTopLikersLayout(config.layout),
    likeMilestone: clamp(Math.floor(numberOrDefault(config.likeMilestone, defaultTopLikers.likeMilestone)), 0, 1000000000),
    medalHearts: config.medalHearts !== false,
    resetOnConnect: config.resetOnConnect !== false,
    width: clamp(Math.floor(numberOrDefault(config.width, defaultTopLikers.width)), 260, 1000),
    height: clamp(Math.floor(numberOrDefault(config.height, defaultTopLikers.height)), 120, 900),
    showShell: typeof config.showShell === 'boolean' ? config.showShell : defaultTopLikers.showShell,
    showTitle: typeof config.showTitle === 'boolean' ? config.showTitle : defaultTopLikers.showTitle,
    showTiles: typeof config.showTiles === 'boolean' ? config.showTiles : defaultTopLikers.showTiles,
    backgroundStart: normalizeHex(config.backgroundStart, defaultTopLikers.backgroundStart),
    backgroundEnd: normalizeHex(config.backgroundEnd, defaultTopLikers.backgroundEnd),
    backgroundBase: normalizeHex(config.backgroundBase, defaultTopLikers.backgroundBase),
    border: normalizeHex(config.border, defaultTopLikers.border),
    tile: normalizeHex(config.tile, defaultTopLikers.tile),
    tileBorder: normalizeHex(config.tileBorder, defaultTopLikers.tileBorder),
    title: normalizeHex(config.title, defaultTopLikers.title),
    text: normalizeHex(config.text, defaultTopLikers.text),
    muted: normalizeHex(config.muted, defaultTopLikers.muted),
    glow: normalizeHex(config.glow, defaultTopLikers.glow),
    milestoneCard: normalizeHex(config.milestoneCard, defaultTopLikers.milestoneCard),
    milestoneText: normalizeHex(config.milestoneText, defaultTopLikers.milestoneText),
    opacity: clamp(numberOrDefault(config.opacity, defaultTopLikers.opacity), 0, 1),
    tileOpacity: clamp(numberOrDefault(config.tileOpacity, defaultTopLikers.tileOpacity), 0, 1)
  };
}

function normalizeTopLikersLayout(value) {
  return String(value || defaultTopLikers.layout).toLowerCase() === 'stacked' ? 'stacked' : 'inline';
}


function normalizeGoalType(type) {
  const value = String(type || '').toLowerCase();
  return value === 'followers' || value === 'support' ? value : 'likes';
}

function defaultGoalResetOnConnect(type) {
  return normalizeGoalType(type) !== 'followers';
}

function defaultGoalLabel(type) {
  const goalType = normalizeGoalType(type);

  if (goalType === 'followers') {
    return 'Follower Goal';
  }

  if (goalType === 'support') {
    return 'Gift Goal';
  }

  return defaultGoalBar.label;
}

function isDefaultGoalLabel(label) {
  return ['Like Goal', 'Follower Goal', 'Support Goal', 'Gift Goal'].includes(String(label || '').trim());
}

function getDefaultRowsGifts() {
  return [
    { id: '33', name: 'Heart Me', image: './rewards/033_Heart_Me.png', row: 1 },
    { id: '30', name: 'GG', image: './rewards/030_GG.png', row: 1 },
    { id: '817', name: 'Gold Boxing Glove', giftNames: ['Gold Boxing Gloves'], image: './rewards/817_Gold_Boxing_Gloves.png', row: 1 },
    { id: '792', name: 'Finger Heart', image: './rewards/792_Finger_heart.png', row: 1 },
    { id: '856', name: 'Doughnut', image: './rewards/856_Doughnut.png', row: 1 },
    { id: '913', name: 'Super GG', image: './rewards/913_Super_GG.png', row: 1 },
    { id: '1176', name: 'Coral', image: './rewards/1176_Coral.png', row: 2 },
    { id: '1258', name: 'Lucky Air Drop', giftNames: ['Lucky Air Drop', 'Lucky Airdrop', 'Lucky Airdrop Box'], image: './rewards/1258_Lucky_Airdrop_Box.png', row: 2 },
    { id: '1313', name: 'Arcade Game', image: './rewards/1313_Arcade_Game.png', row: 2 },
    { id: '1312', name: 'Gaming Chair', image: './rewards/1312_Gaming_Chair.png', row: 2 },
    { id: '1270', name: 'Galaxy', image: './rewards/1270_Galaxy.png', row: 2 },
    { id: '1596', name: 'TikTok Universe', image: './rewards/1596_TikTok_Universe.png', row: 2 }
  ].map(gift => ({
    enabled: true,
    title: gift.name,
    giftNames: gift.giftNames || [gift.name],
    giftIds: [gift.id],
    image: gift.image,
    row: gift.row,
    sound: '',
    volume: 0.85
  }));
}

function isLegacyDefaultRowsGiftSet(gifts) {
  if (!Array.isArray(gifts)) return false;

  const actualIds = gifts.map(gift => normalizeId(
    gift?.giftIds?.[0]
      || gift?.id
      || gift?.giftId
      || getIdFromImagePath(gift?.image)
  )).sort((first, second) => Number(first) - Number(second));

  const legacySets = [
    ['18', '30', '33', '792', '817', '856', '913', '1176', '1258', '1270', '1312', '1313'],
    ['30', '33', '817', '856', '913', '1176', '1258', '1270', '1312', '1313', '1596']
  ];

  return legacySets.some(expectedIds => (
    actualIds.length === expectedIds.length
      && actualIds.every((id, index) => id === expectedIds[index])
  ));
}

function getDefaultSideGifts() {
  return [
    { id: '33', name: 'Heart Me', image: './rewards/033_Heart_Me.png', side: 'left' },
    { id: '5', name: 'Heart Puff', image: './rewards/005_Heart_Puff.png', side: 'left' },
    { id: '1', name: 'Rose', image: './rewards/001_Rose.png', side: 'left' },
    { id: '2', name: 'Flame heart', image: './rewards/002_Flame_heart.png', side: 'left' },
    { id: '3', name: 'You re awesome', image: './rewards/003_You_re_awesome.png', side: 'left' },
    { id: '4', name: 'Love you so much', image: './rewards/004_Love_you_so_much.png', side: 'right' },
    { id: '1597', name: 'Misty Purr', image: './rewards/1597_Misty_Purr.png', side: 'right' },
    { id: '51', name: 'Good Job', image: './rewards/0051_Good_Job.png', side: 'right' },
    { id: '52', name: 'Clap Clap', image: './rewards/0052_Clap_Clap.png', side: 'right' },
    { id: '1270', name: 'Galaxy', image: './rewards/1270_Galaxy.png', side: 'right' }
  ].map(gift => ({
    enabled: true,
    title: gift.name,
    giftNames: [gift.name],
    giftIds: [gift.id],
    image: gift.image,
    side: gift.side,
    sound: '',
    volume: 0.85
  }));
}

function normalizeRowsGift(gift) {
  const triggerType = normalizeTriggerType(gift.triggerType);
  const hasUseGiftImage = Object.prototype.hasOwnProperty.call(gift, 'useGiftImage');
  const giftNames = Array.isArray(gift.giftNames) ? gift.giftNames.map(String) : [];
  return {
    enabled: gift.enabled !== false,
    title: String(gift.title || gift.name || giftNames[0] || getImageLabel(gift.image || '') || 'Row Gift'),
    triggerType,
    likesRequired: clamp(Math.floor(numberOrDefault(gift.likesRequired, 50)), 1, 1000000000),
    likesHeartColor: normalizeHex(gift.likesHeartColor, '#ef233c'),
    likesNumberColor: normalizeHex(gift.likesNumberColor, '#ffffff'),
    likesHeartSize: clamp(Math.floor(numberOrDefault(gift.likesHeartSize, 160)), 40, 160),
    likesNumberSize: clamp(Math.floor(numberOrDefault(gift.likesNumberSize, 96)), 16, 96),
    giftNames,
    giftIds: Array.isArray(gift.giftIds) ? gift.giftIds.map(normalizeId).filter(Boolean) : [],
    image: getCatalogImageForReward(gift),
    useGiftImage: triggerType === 'gift' && (gift.useGiftImage === true || (!hasUseGiftImage && isHeartMeGift(gift))),
    giftImageNames: Array.isArray(gift.giftImageNames) ? gift.giftImageNames.map(String) : [],
    giftImageIds: Array.isArray(gift.giftImageIds) ? gift.giftImageIds.map(String) : [],
    row: Number.isInteger(Number(gift.row)) ? Number(gift.row) : undefined,
    sound: normalizeSound(gift.sound),
    volume: clamp(Number(gift.volume ?? 0.85), 0, 1)
  };
}

function isHeartMeGift(gift) {
  const ids = (gift.giftIds || []).map(normalizeId).filter(Boolean);
  const names = [
    ...(gift.giftNames || []),
    gift.title,
    gift.name
  ].map(normalizeName).filter(Boolean);

  return ids.includes('33') || names.includes('heart me');
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
  if(availableSounds.has(value))return value;
  try{const url=new URL(value,location.href);if(url.origin===location.origin&&/^\/api\/v1\/sounds\/[A-Za-z0-9_-]{40,50}\.wav$/.test(url.pathname))return url.href;}catch{}
  return ''; 
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
  return ['follow', 'likes', 'share'].includes(type) ? type : 'gift';
}

function getTriggerIcon(item) {
  const type = normalizeTriggerType(item?.triggerType || item);
  if (type === 'gift') {
    return '';
  }

  if (type === 'share') {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 104 104"><path d="M61 72 88 46 61 20M15 85V70c0-13 10-24 24-24h49" fill="none" stroke="#fe2c55" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)"/><path d="M61 72 88 46 61 20M15 85V70c0-13 10-24 24-24h49" fill="none" stroke="#25f4ee" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>');
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
  if (/\/api\/v1\/gifts\/(?:images|creator-images)\//.test(currentImage)) return currentImage;
  const match = findCatalogEntryForReward(reward);
  return match?.image || currentImage;
}

function findCatalogEntryForReward(reward) {
  const views = editorLegacyCatalogueViews();
  const image = normalizePath(reward.image || '').toLowerCase();
  if (image && views.byImage.has(image)) return views.byImage.get(image);
  const names = [...(reward.giftNames || []), ...(reward.giftImageNames || []), reward.title, getImageLabel(reward.image)].map(normalizeName).filter(Boolean);
  const nameMatches = new Set(names.flatMap(name => views.byName.get(name) || []));
  if (nameMatches.size === 1) return [...nameMatches][0];
  const ids = [...(reward.giftIds || []), ...(reward.giftImageIds || []), getIdFromImagePath(reward.image)].map(normalizeId).filter(Boolean);
  const idMatches = new Set(ids.flatMap(id => views.byId.get(id) || []));
  return idMatches.size === 1 ? [...idMatches][0] : null;
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

// Optional appearance v1. Absence keeps all legacy CSS and activity colours intact.
function normalizeGoalFonts(config) {
  const result = {};
  for (const key of ['labelSize', 'counterSize', 'targetSize']) {
    const value = config[key];
    if (value === undefined || value === null || value === '' || typeof value === 'boolean') continue;
    const number = Number(value);
    if (Number.isFinite(number)) result[key] = Math.max(8, Math.min(48, Math.round(number)));
  }
  return result;
}

function normalizeGoalAppearance(value) {
  if (!value || typeof value !== 'object' || value.enabled !== true) return undefined;
  const defaults = {
    background: '#15101f',
    border: '#79548e',
    label: '#03f5d8',
    trackBackground: '#050a12',
    trackBorder: '#03f5d8',
    progressStart: '#03f5d8',
    progressEnd: '#7affed',
    progressGlow: '#03f5d8',
    counterBackground: '#7affed',
    counterText: '#061013',
    counterBorder: '#ffffff',
    glow: '#c447ff'
  };
  const result = { enabled: true };
  for (const [key, fallback] of Object.entries(defaults)) {
    result[key] = typeof value[key] === 'string' && /^#[0-9a-f]{6}$/i.test(value[key]) ? value[key] : fallback;
  }
  const percent = (v, fallback) => v !== null && v !== '' && Number.isFinite(Number(v)) ? Math.min(100, Math.max(0, Number(v))) : fallback;
  result.backgroundOpacity = percent(value.backgroundOpacity, 65);
  result.glowStrength = percent(value.glowStrength, 35);
  result.gloss = value.gloss !== false;
  if(value.noBackground===true)result.noBackground=true;
  return result;
}


function refreshGiftCatalogueGrids() {
  if (document.querySelector('#rows-gift-picker[open]')) renderRowsPickerGifts();

  document.querySelectorAll('[data-gift-grid]').forEach(grid => {
    const editor = grid.closest('.reward-editor');
    if (!editor) return;
    const reward = {
      image: editor.querySelector('[data-field="image"]')?.value || '',
      giftIds: (editor.querySelector('[data-field="giftIds"]')?.value || '').split(',').map(value => value.trim()),
      giftNames: (editor.querySelector('[data-field="giftNames"]')?.value || '').split(',').map(value => value.trim())
    };
    populateGiftGrid(editor, reward, editor.querySelector('[data-gift-search]')?.value || '');
  });
}

function applyGiftCatalogue(payload) {
  if (!Array.isArray(payload?.gifts) || !payload.gifts.length) return;
  for (const [key, entry] of imageCatalog) {
    if (entry.catalogueManaged) entry.catalogueManaged = false;
  }
  payload.gifts.forEach(entry => addImageCatalogEntry({ ...entry, catalogueManaged: true }));
  creatorGiftEntries.forEach(entry => addImageCatalogEntry({ ...entry, creatorManaged: true }));
  currentGiftCatalogue = payload;
  refreshGiftCatalogueGrids();
}

let giftCatalogueOffline=false;
let lastGiftCatalogueSuccessAt=0;
let lastGiftCatalogueSession='';
async function loadGiftCatalogue(force = false) {
  const session=window.overlayCloud?.session?.token||'';
  if(!force&&currentGiftCatalogue&&session===lastGiftCatalogueSession&&Date.now()-lastGiftCatalogueSuccessAt<60000)return;
  if (catalogueRefreshInFlight) return catalogueRefreshInFlight;
  // Catalogue sync is independent of maintenance controls on the editing page.
  catalogueRefreshInFlight = (async () => {
    try {
      const creatorRequest = loadCreatorGifts();
      let payload;
      if (force) {
        const response = await window.overlayCloud.request('/v1/gifts/sync', { method: 'POST' });
        payload = response.catalogue;
      } else {
        const response = await fetch('/api/v1/gifts/catalogue', { cache: 'no-store' });
        if (!response.ok) throw new Error('Catalogue unavailable');
        payload = await response.json();
      }
      await creatorRequest;
      applyGiftCatalogue(payload);
      giftCatalogueOffline=false;lastGiftCatalogueSuccessAt=Date.now();lastGiftCatalogueSession=session;
    } catch {
      giftCatalogueOffline=true;
      if(document.querySelector('#rows-gift-picker[open]'))renderRowsPickerGifts();
      // Retain the last loaded catalogue and all saved designs if sync is unavailable.
    } finally {
      catalogueRefreshInFlight = null;
    }
  })();
  return catalogueRefreshInFlight;
}

// Keep an editor left open during a stream aligned with the published catalogue.
const giftCatalogueTimer = setInterval(() => {
  if (!document.hidden && window.overlayCloud?.signedIn) loadGiftCatalogue();
}, 15 * 60 * 1000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && window.overlayCloud?.signedIn) loadGiftCatalogue();
});
window.addEventListener('beforeunload', () => clearInterval(giftCatalogueTimer), { once: true });

function matchesGiftSearch(entry, filter) {
  let query=String(filter||'').toLowerCase().trim();
  const coins=entry.coins===null||entry.coins===undefined?null:Number(entry.coins);
  const value=query.match(/(?:coins?:\s*)?(?:(>=|<=|>|<)\s*(\d+)|(\d+)\s*[-–]\s*(\d+)|coins?:\s*(\d+)|(\d+)\s*coins?\b)/);
  if(value) {
    if(coins===null||!Number.isFinite(coins))return false;
    if(value[1]) { const n=Number(value[2]);if(!({'>=':coins>=n,'<=':coins<=n,'>':coins>n,'<':coins<n}[value[1]]))return false; }
    else if(value[3]) { if(coins<Number(value[3])||coins>Number(value[4]))return false; }
    else if(coins!==Number(value[5]??value[6]))return false;
    query=query.replace(value[0],'').trim();
  } else if(/^\d+$/.test(query)) {
    return String(entry.id||entry.giftId||'')===query || coins===Number(query);
  }
  return !query || normalizeName([entry.name,entry.label,entry.id,entry.giftId].filter(Boolean).join(' ')).includes(normalizeName(query));
}

async function loadCreatorGifts() {
  const session=window.overlayCloud?.session?.token;
  if(!session)return;
  try {
    const result=await window.overlayCloud.request('/v1/gifts/creator');
    if(window.overlayCloud?.session?.token!==session)return;
    applyCreatorGifts(result.gifts);
  } catch {
    const status=document.querySelector('#creator-gift-status');
    if(status)status.textContent='Your creator library is temporarily unavailable. Loaded gifts are retained.';
  }
}
function applyCreatorGifts(gifts) {
  if(!Array.isArray(gifts))return;
  invalidateEditorCatalogue();
  for(const [key,entry] of imageCatalog)if(entry.creatorManaged)imageCatalog.delete(key);
  creatorGiftEntries=gifts;
  gifts.forEach(entry=>addImageCatalogEntry({...entry,creatorManaged:true}));
  const status=document.querySelector('#creator-gift-status');
  if(status)status.textContent=gifts.length+' creator gifts in your library. New gifts appear after they are received through TikFinity.';
  refreshGiftCatalogueGrids();
}
window.addEventListener('overlaycloud:session',()=>{
  invalidateEditorCatalogue();
  for(const [key,entry] of imageCatalog)if(entry.creatorManaged)imageCatalog.delete(key);
  creatorGiftEntries=[];
  if(window.overlayCloud?.signedIn)loadCreatorGifts();
});
// Poll only the small account catalogue while the editor is open during a stream.
const creatorGiftTimer=setInterval(()=>{if(!document.hidden&&window.overlayCloud?.signedIn)loadCreatorGifts();},30000);
window.addEventListener('beforeunload',()=>clearInterval(creatorGiftTimer),{once:true});

