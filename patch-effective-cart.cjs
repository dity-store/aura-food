const fs = require('fs');
let code = fs.readFileSync('src/components/POSSimulator.tsx', 'utf-8');

code = code.replace(
    /const targets = p\.TARGET_ITEM \? String\(p\.TARGET_ITEM\)\.split\('\|'\)\.map\(s => s\.trim\(\)\) : \[\];\n\s*if \(targets\.length === 0\) return;\n\s*let matchingQty = 0;\n\s*let matchingTotalValue = 0;\n\s*for \(let item of cart\) {\n\s*if \(targets\.includes\(String\(item\.varian\.ID_VARIAN\)\) \|\| targets\.includes\(String\(item\.menu\.ID_MENU\)\) \|\| targets\.includes\(String\(item\.menu\.ID_KATEGORI\)\)\) {\n\s*matchingQty \+= item\.quantity;\n\s*matchingTotalValue \+= \(item\.varian\.HARGA \* item\.quantity\);\n\s*}\n\s*}/g,
    `const targets = p.TARGET_ITEM ? String(p.TARGET_ITEM).split('|').map(s => s.trim()).filter(Boolean) : [];
          
          let matchingQty = 0;
          let matchingTotalValue = 0;
          for (let item of cart) {
             if (targets.length === 0 || targets.includes(String(item.varian.ID_VARIAN)) || targets.includes(String(item.menu.ID_MENU)) || targets.includes(String(item.menu.ID_KATEGORI))) {
                matchingQty += item.quantity;
                matchingTotalValue += (item.varian.HARGA * item.quantity);
             }
          }`
);

// We also need to fix the second loop inside `p.TIPE === 'HARGA_FIX'`
code = code.replace(
    /for \(let item of cart\) {\n\s*if \(targets\.includes\(String\(item\.varian\.ID_VARIAN\)\) \|\| targets\.includes\(String\(item\.menu\.ID_MENU\)\) \|\| targets\.includes\(String\(item\.menu\.ID_KATEGORI\)\)\) {\n\s*let takeQty = Math\.min\(item\.quantity, qToCount\);/g,
    `for (let item of cart) {
                  if (targets.length === 0 || targets.includes(String(item.varian.ID_VARIAN)) || targets.includes(String(item.menu.ID_MENU)) || targets.includes(String(item.menu.ID_KATEGORI))) {
                     let takeQty = Math.min(item.quantity, qToCount);`
);

fs.writeFileSync('src/components/POSSimulator.tsx', code, 'utf-8');
