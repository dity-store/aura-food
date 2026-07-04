const fs = require('fs');
let code = fs.readFileSync('src/components/POSSimulator.tsx', 'utf-8');

code = code.replace(
    /const now = new Date\(\);\s*if \(now < start \|\| now > end\) return false;/g,
    `const now = new Date(getWITAString());\n      if (now < start || now > end) return false;`
);

fs.writeFileSync('src/components/POSSimulator.tsx', code, 'utf-8');
