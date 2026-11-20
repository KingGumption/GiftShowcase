import fs from 'node:fs';
import vm from 'node:vm';
const directory=new URL('../public/',import.meta.url);
let count=0;
for(const name of fs.readdirSync(directory).filter(name=>name.endsWith('.js'))){new vm.Script(fs.readFileSync(new URL(name,directory),'utf8'),{filename:name});count++;}
console.log('Compiled all '+count+' public JavaScript files without executing browser code.');
