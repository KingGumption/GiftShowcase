import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/obs-dock-manager.js', import.meta.url), 'utf8');
const managerHtml = fs.readFileSync(new URL('../public/index-obs-dock.html', import.meta.url), 'utf8');
const studioHtml = fs.readFileSync(new URL('../public/index-rewards-config.html', import.meta.url), 'utf8');
const managerStyles = fs.readFileSync(new URL('../public/style.css', import.meta.url), 'utf8');
const studioSource = fs.readFileSync(new URL('../public/rewards-admin.js', import.meta.url), 'utf8');
const cloudAdminSource = fs.readFileSync(new URL('../public/overlay-cloud-admin.js', import.meta.url), 'utf8');
const siteChromeSource = fs.readFileSync(new URL('../../site-chrome.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Could not find ${name}`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not read ${name}`);
}

const context = {
  rendererPages: { 'top-likers': 'index-top-likers.html' },
  global: { location: { href: 'https://app.example.test/index-obs-dock.html' } },
  encodeConfig: () => 'encoded-config',
  URL,
  URLSearchParams
};
vm.createContext(context);
vm.runInContext([
  extractFunction('reorderLayerStack'),
  extractFunction('buildRendererUrl'),
  extractFunction('clamp'),
  extractFunction('clampLayerPosition'),
  extractFunction('snapLayerPosition'),
  extractFunction('dimensionsFromConfig'),
  extractFunction('getRowsNaturalHeight'),
  extractFunction('getRendererOverscan'),
  extractFunction('getSideGiftLayoutSide'),
  extractFunction('getSideGiftsNaturalHeight'),
  extractFunction('getUniformScale'),
  extractFunction('getScaledDimensions'),
  extractFunction('withUniformScale')
].join('\n'), context);

const initial = [
  { id: 'back', zIndex: 0 },
  { id: 'middle', zIndex: 4 },
  { id: 'front', zIndex: 9 }
];
context.initial = initial;

const movedToFront = vm.runInContext(`reorderLayerStack(initial, 'back', 'front', false)`, context);
assert.deepEqual(Array.from(movedToFront, item => item.id), ['back', 'front', 'middle']);
assert.deepEqual(Array.from(movedToFront, item => item.zIndex), [2, 1, 0], 'A drop should normalize the complete stack without gaps');

context.movedToFront = movedToFront;
const movedToBack = vm.runInContext(`reorderLayerStack(movedToFront, 'back', 'middle', true)`, context);
assert.deepEqual(Array.from(movedToBack, item => item.id), ['front', 'middle', 'back']);
assert.deepEqual(Array.from(movedToBack, item => item.zIndex), [2, 1, 0]);

assert.doesNotMatch(source, /\['zIndex', 'Layer'\]/, 'The inspector should not expose a numeric layer-order field');
assert.match(source, /Drag to reorder/, 'The layer list should explain its drag-and-drop behavior');
assert.match(managerHtml, /data-role="test-preview"/, 'The layout canvas should offer the output sample activity switch');
assert.match(managerHtml, /<details id="dock-manager-setup"/, 'Setup guidance should use progressive disclosure');
assert.match(managerHtml, /<details class="dock-manager-panel dock-create-disclosure"/, 'Additional output creation should stay collapsed until requested');
assert.match(managerHtml, /<details class="dock-output-settings"/, 'Secondary output settings should stay collapsed inside each output card');
assert.match(managerHtml, /data-action="copy"[^>]*>Copy Link</, 'Copying the output link should remain a primary card action');
assert.match(managerHtml, /id="dock-copy-dialog"/, 'Copying an output link should provide a source-dimension reminder dialog');
assert.match(source, /showCopyDimensions\(dock\)/, 'The copy action should open the dimension reminder for the selected output');
assert.match(source, /copyWidth\.textContent = String\(dock\.width\)/, 'The copy reminder should show the selected output width');
assert.match(source, /copyHeight\.textContent = String\(dock\.height\)/, 'The copy reminder should show the selected output height');
assert.match(siteChromeSource, /get\('embed'\) === '1'\) return/, 'Embedded Studio workspaces should not render a second site banner or support link');
assert.match(studioHtml, /id="studio-output-tab"[^>]*aria-controls="studio-output-workspace"/, 'The Studio sidebar should expose Output Designer as a workspace tab');
assert.match(studioHtml, /id="studio-output-frame"[^>]*data-src="\/studio\/outputs\/\?embed=1"/, 'The Studio output tab should lazily embed the existing designer');
assert.match(studioSource, /setStudioWorkspace\('outputs'\)/, 'The Output Designer tab should switch workspaces without navigating');
assert.match(studioSource, /history\.replaceState/, 'Workspace selection should update the shareable Studio URL without a page load');
assert.doesNotMatch(studioHtml, /id="cloud-load-variant"/, 'Version selection should not require a separate Load button');
assert.match(studioHtml, /id="cloud-version-menu"/, 'Secondary version actions should stay in a compact overflow menu');
assert.match(studioHtml, /id="cloud-variant-dialog"/, 'Version naming should only appear in a focused dialog');
assert.match(cloudAdminSource, /variantSelect\.addEventListener\('change', selectAndLoadVariant\)/, 'Choosing a saved version should load it automatically');
assert.match(cloudAdminSource, /studioRequestNavigation/, 'Automatic version loading should protect unsaved edits');
assert.match(cloudAdminSource, /dirtyOverlayKinds\.delete\(activeOverlayKind\)/, 'Loading or saving a version should clear its dirty state');
assert.match(source, /studio:activate-output/, 'The embedded designer should refresh its cloud data whenever its tab is activated');
assert.match(managerHtml, /Appears in this canvas link; switch it off before going live/, 'The sample-data switch should make its live output effect clear');
assert.match(source, /cloud\.updateDock\(dock\.id, \{ sampleActivity: enabled \}\)/, 'The sample activity switch should be saved on the output');
assert.match(source, /cloud\.updateDockItem\(dock\.id, item\.id, \{ \[field\]: enabled \}\)/, 'Position lock and visibility should save immediately');
assert.match(source, /if \(item\.locked\) \{\s*renderComposer\(card, dock\);\s*return;/s, 'A locked layer should remain selectable without starting a drag');
assert.match(source, /global\.requestAnimationFrame\(paint\)/, 'Pointer movement should be limited to one visual update per animation frame');
assert.match(source, /translate3d\(\$\{translateX\}px, \$\{translateY\}px, 0\)/, 'Moving a layer should use a compositor transform');
assert.match(source, /Object\.assign\(item, result\.item\);rememberCanvas\(dock\);\s*layer\.style\.transform = '';\s*positionLayer/s, 'A saved drag should update the existing layer instead of rebuilding preview iframes');
assert.match(source, /appendCanvasCropShades\(canvas, dock, previewItems\)/, 'The canvas should add a visual treatment outside its crop boundary');
assert.match(managerStyles, /\.dock-layout-canvas\s*\{[^}]*overflow:\s*visible/s, 'Overhanging layers should remain visible in the editor');
assert.match(managerStyles, /\.dock-canvas-overhang-shade\s*\{[^}]*mix-blend-mode:\s*saturation/s, 'Overhanging content should use low-cost desaturation');

const previewItem = { id: 'likers-1', overlayKind: 'top-likers' };
context.previewItem = previewItem;
const sampleRendererUrl = vm.runInContext('buildRendererUrl(previewItem, {}, true)', context);
const idleRendererUrl = vm.runInContext('buildRendererUrl(previewItem, {}, false)', context);
assert.equal(new URL(sampleRendererUrl).searchParams.get('preview'), '1', 'Sample canvas renderers should receive static preview mode');
assert.equal(new URL(sampleRendererUrl).searchParams.get('editor'), '1', 'Canvas samples should identify the low-cost editor mode');
assert.equal(new URL(idleRendererUrl).searchParams.has('preview'), false, 'The sample toggle should be able to show the idle state');
assert.equal(new URL(sampleRendererUrl).searchParams.get('mute'), '1', 'Editor test content must stay muted');
assert.equal(vm.runInContext('clampLayerPosition(-540, 1080, 1080)', context), -540, 'A layer should be movable partly beyond the left edge');
assert.equal(vm.runInContext('clampLayerPosition(800, 960, 1920)', context), 800, 'A layer should retain an ordinary in-canvas position');
assert.equal(vm.runInContext('clampLayerPosition(-2000, 1080, 1080)', context), -1080, 'A layer should not move farther than its complete width beyond the output');
assert.equal(vm.runInContext('clampLayerPosition(2000, 1080, 1080)', context), 1080, 'A layer should not move farther than the opposite output edge');
assert.equal(vm.runInContext('snapLayerPosition(9, 300, 1080, 14)', context), 0, 'Shift should snap near the left edge');
assert.equal(vm.runInContext('snapLayerPosition(788, 300, 1080, 14)', context), 780, 'Shift should snap near the right edge');
assert.equal(vm.runInContext('snapLayerPosition(40, 300, 1080, 14)', context), 40, 'Shift should preserve free movement away from an edge');

context.sideGiftConfig = {
  sideGifts: {
    width: 1080,
    height: 960,
    iconSize: 65,
    labelSize: 10,
    gap: 26,
    showLabels: true,
    gifts: Array.from({ length: 10 }, (_, index) => ({ title: `Gift ${index + 1}` }))
  }
};
const fittedSideGiftsHeight = vm.runInContext('getSideGiftsNaturalHeight(sideGiftConfig.sideGifts, 960)', context);
assert.equal(fittedSideGiftsHeight, 597, 'Five rows per side should replace the legacy fixed 960px height with their fitted height');

context.rowsConfig = { rowsOverlay: { rows: 3, rowHeight: 80, gap: 7 } };
const fittedRowsHeight = vm.runInContext('getRowsNaturalHeight(rowsConfig.rowsOverlay)', context);
assert.equal(
  fittedRowsHeight,
  254,
  'Rows bounds should include every configured row and only the gaps between them'
);
assert.equal(vm.runInContext("getRendererOverscan('rows')", context), 0, 'Rows should not add transparent glow overscan around their fitted bounds');

context.legacyRowsItem = { overlayKind: 'rows', width: 1080, height: 120 };
context.actualRowsSize = { width: 1080, height: 160 };
const fittedRowsItem = vm.runInContext('withUniformScale(legacyRowsItem, actualRowsSize)', context);
assert.deepEqual(
  { width: fittedRowsItem.width, height: fittedRowsItem.height },
  { width: 1080, height: 160 },
  'The designer outline should follow the actual Rows height without shortening its width'
);

context.sideGiftConfig.sideGifts.gifts = context.sideGiftConfig.sideGifts.gifts.slice(0, 4);
const shorterSideGiftsHeight = vm.runInContext('getSideGiftsNaturalHeight(sideGiftConfig.sideGifts, 960)', context);
assert.equal(shorterSideGiftsHeight, 276, 'Removing gifts should reduce the Side Gifts layer height');

console.log('Dock manager layer ordering and test-preview checks passed.');
