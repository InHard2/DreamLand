const fs = require('fs');
eval(fs.readFileSync(__dirname + '/../js/shared.js', 'utf8'));
const S = DL_SHARED_FACTORY();
const g = new S.Generator(5);
for (let i=0;i<30;i++) g.generate(i,-5);
let t=Date.now(); for (let i=0;i<50;i++) g.generate(i,3); console.log('gen total ms', (Date.now()-t)/50);
g.carveCaves=()=>{}; t=Date.now(); for (let i=0;i<50;i++) g.generate(i,7); console.log('no caves ms', (Date.now()-t)/50);
