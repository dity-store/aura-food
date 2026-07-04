const fs = require('fs');
let code = fs.readFileSync('src/components/POSSimulator.tsx', 'utf-8');

code = code.replace(
    'const getActivePromoForVariant = (variantId: string, qty: number = 1, ignoreQtyCheck: boolean = false) => {',
    'const getActivePromoForVariant = (variantId: string, qty: number = 1, ignoreQtyCheck: boolean = false, includePerPesanan: boolean = false) => {'
);

code = code.replace(
    /const jenis = p\.JENIS_PROMO \|\| 'PER_MENU';\s*if \(jenis !== 'PER_MENU'\) return false;/g,
    `const jenis = p.JENIS_PROMO || 'PER_MENU';
      if (!includePerPesanan && jenis !== 'PER_MENU') return false;`
);

code = code.replace(
    'const promo = getActivePromoForVariant(v.ID_VARIAN, 1, true); // Ignore qty check for catalog grid display',
    'const promo = getActivePromoForVariant(v.ID_VARIAN, 1, true, true); // Include PER_PESANAN for catalog grid badge'
);

fs.writeFileSync('src/components/POSSimulator.tsx', code, 'utf-8');
