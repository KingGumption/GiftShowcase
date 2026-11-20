import {spawn} from 'node:child_process';
import {readdir} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const scripts=dirname(fileURLToPath(import.meta.url)),cloudflare=join(scripts,'..','cloudflare');
async function run(args,cwd){await new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd,stdio:'inherit',windowsHide:true});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Release check failed with exit '+code)));});}
try{
  const tests=(await readdir(scripts)).filter(name=>/^test-.*\.mjs$/.test(name)).map(name=>join(scripts,name));
  await run(['--test',...tests],join(scripts,'..'));
  await run(['build-site.mjs'],cloudflare);
  await run([join(scripts,'release-browser.mjs')],cloudflare);
  await run([join(scripts,'release-graphics-browser.mjs')],cloudflare);
  await run([join(scripts,'release-admin-browser.mjs')],cloudflare);
  await run([join(scripts,'release-unified-browser.mjs')],cloudflare);
  await run([join(scripts,'release-creator-live-browser.mjs')],cloudflare);
  console.log('Local release gate passed. Deploy separately with Wrangler after retaining source/database backups.');
}catch(error){console.error(error.message);process.exitCode=1;}
