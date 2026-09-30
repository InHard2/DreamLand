const fs = require('fs');
eval(fs.readFileSync(__dirname + '/../js/shared.js', 'utf8'));
const S = DL_SHARED_FACTORY();
const o = new S.Octaves(new S.RNG(1), 5);
const o3 = new S.Octaves(new S.RNG(2), 6);
let a=[],b=[];
for (let i=0;i<20000;i++){ a.push(o.sample2(Math.random()*1000, Math.random()*1000)); b.push(o3.sample(Math.random()*1000,Math.random()*300,Math.random()*1000)); }
const st = v => { v.sort((x,y)=>x-y); const m=v.reduce((s,x)=>s+x,0)/v.length; const sd=Math.sqrt(v.reduce((s,x)=>s+(x-m)**2,0)/v.length); return {m:m.toFixed(3),sd:sd.toFixed(3),p5:v[v.length*0.05|0].toFixed(3),p95:v[v.length*0.95|0].toFixed(3),min:v[0].toFixed(3),max:v[v.length-1].toFixed(3)}; };
console.log('2d', st(a)); console.log('3d', st(b));
// timing
const g = new S.Generator(5);
let t=Date.now(); for (let i=0;i<20;i++) g.generate(i,3); console.log('gen total ms', (Date.now()-t)/20);
const orig = g.carveCaves; g.carveCaves=()=>{}; t=Date.now(); for (let i=0;i<20;i++) g.generate(i,7); console.log('no caves ms', (Date.now()-t)/20);
