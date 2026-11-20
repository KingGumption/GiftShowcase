import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cloudflareDirectory = dirname(fileURLToPath(import.meta.url));
const widgetDirectory = dirname(cloudflareDirectory);
const projectDirectory = dirname(widgetDirectory);
const publicDirectory = join(widgetDirectory, 'public');
const outputDirectory = join(cloudflareDirectory, 'dist');

const rootFiles = [
  'index.html',
  'privacy.html',
  'help.html',
  'not-found.html',
  'favicon.svg',
  'studio-preview.png',
  'studio-preview-light.png',
  'homepage.css',
  'site-chrome.css',
  'site-chrome.js',
  'site-theme.css',
  'site-theme.js'
];

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(join(outputDirectory, 'Widget', 'public'), { recursive: true });

for (const file of rootFiles) {
  await cp(join(projectDirectory, file), join(outputDirectory, file));
}

await copyPublicDirectory(publicDirectory, join(outputDirectory, 'Widget', 'public'));

const deployedFiles = await countFiles(outputDirectory);
console.log(`Prepared ${deployedFiles} website assets in ${outputDirectory}`);

async function copyPublicDirectory(source, destination) {
  const entries = await readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    if (['rewards', '.git', '.agents'].includes(entry.name)) continue;
    const sourcePath = join(source, entry.name);
    const destinationPath = join(destination, entry.name);
    if (entry.isDirectory()) {
      await mkdir(destinationPath, { recursive: true });
      await copyPublicDirectory(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      await cp(sourcePath, destinationPath);
    }
  }
}

async function countFiles(directory) {
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    total += entry.isDirectory() ? await countFiles(join(directory, entry.name)) : Number(entry.isFile());
  }
  return total;
}
