const fs = require('fs');
const path = require('path');
const root = 'C:/Users/Mao/Desktop/qwq临时/deep seek app/node_modules/monaco-editor/esm/vs';
function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}
const map = new Map();
const re = /localize\((\d+), ?['"]([^'"]{1,44})['"]\)/g;
for (const f of walk(root)) {
  const s = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = re.exec(s)) !== null) map.set(m[1], m[2]);
}
const arr = [...map.entries()].sort((a,b)=>Number(a[0])-Number(b[0]));
console.log(arr.map(([k,v])=>k+'\t'+v).join('\n'));