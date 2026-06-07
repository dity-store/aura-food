const fs = require('fs');
const file = 'src/components/POSSimulator.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/Rp {/g, 'Rp{');
fs.writeFileSync(file, content);
console.log('Fixed Rp in POSSimulator.tsx');
