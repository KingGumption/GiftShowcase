import assert from 'node:assert/strict';
import fs from 'node:fs';

const configHtml = fs.readFileSync(new URL('../public/index-rewards-config.html', import.meta.url), 'utf8');
const defaults = fs.readFileSync(new URL('../public/rewards-config.js', import.meta.url), 'utf8');
const admin = fs.readFileSync(new URL('../public/rewards-admin.js', import.meta.url), 'utf8');
const renderer = fs.readFileSync(new URL('../public/rewards-rows.js', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../public/style.css', import.meta.url), 'utf8');

assert.match(configHtml, /id="rows-label-size"[^>]*min="8"[^>]*max="24"/, 'Studio should expose the Rows label-size control');
assert.match(defaults, /"rowsOverlay"\s*:\s*\{[\s\S]*?"labelSize"\s*:\s*11/, 'Rows should retain the 11px native label size used by the scaled output');
assert.match(defaults, /"rowsOverlay"\s*:\s*\{[\s\S]*?"animationsEnabled"\s*:\s*true[\s\S]*?"profileAnimationEnabled"\s*:\s*true[\s\S]*?"profileNameEnabled"\s*:\s*true/, 'Rows should default to animated gift-profile-gift playback with the gifter name');
assert.match(admin, /labelSize:\s*clamp\(numberOrDefault\(config\.labelSize, 11\), 8, 24\)/, 'Studio should normalize Rows label sizes against the 11px native default');
assert.match(admin, /n:\s*rows\.labelSize !== 11 \? rows\.labelSize : undefined/, 'Compact Rows URLs should preserve custom label sizes');
assert.match(admin, /l:\s*rows\.profileAnimationEnabled === false \? 0 : undefined/, 'Compact Rows URLs should preserve an explicitly disabled profile animation');
assert.match(admin, /m:\s*rows\.profileAnimationEnabled !== false && rows\.profileNameEnabled === false \? 0 : undefined/, 'Compact Rows URLs should preserve an explicitly hidden gifter name');
assert.match(admin, /animationsEnabled:\s*true,\s*profileAnimationEnabled:\s*true,\s*profileNameEnabled:\s*true/, 'The Rows defaults revision should enable the requested animation sequence and gifter name');
assert.match(admin, /labelSize:\s*rows\.n/, 'Studio should restore label sizes from compact Rows URLs');
assert.match(renderer, /savedRowsConfig\.labelSize \|\| 11/, 'Rows Browser Sources should fall back to 11px native labels');
assert.match(renderer, /\.\.\.fallback,\s*\.\.\.urlConfig\.rowsOverlay/, 'Rows previews should merge compact settings over renderer defaults');
assert.match(configHtml, /id="rows-preview-test"[^>]*checked/, 'Rows preview starts with simulated sample events, without opening a live-device connection');
assert.match(renderer, /--reward-row-label-size', `\$\{labelSize\}px`/, 'Rows renderer should publish the configured label size to CSS');
assert.match(renderer, /labelSize:\s*rows\.n/, 'Browser Sources should restore label sizes from compact Rows URLs');
assert.match(styles, /\.reward-gift-tile strong\s*\{[\s\S]*?font-size:\s*var\(--reward-row-label-size, 11px\)/, 'Rows labels should use the configured native CSS size');

console.log('Rows label-size configuration checks passed.');
