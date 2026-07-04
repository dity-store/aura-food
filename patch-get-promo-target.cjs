const fs = require('fs');
let code = fs.readFileSync('src/components/POSSimulator.tsx', 'utf-8');

code = code.replace(
    /if \(!targets\.includes\(String\(variantId\)\) && !targets\.includes\(String\(menuId\)\) && !targets\.includes\(String\(categoryId\)\)\) return false;/g,
    `if (targets.length > 0 && !targets.includes(String(variantId)) && !targets.includes(String(menuId)) && !targets.includes(String(categoryId))) return false;`
);

fs.writeFileSync('src/components/POSSimulator.tsx', code, 'utf-8');
