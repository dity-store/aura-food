const fs = require('fs');
let code = fs.readFileSync('src/components/POSSimulator.tsx', 'utf-8');

code = code.replace(
    /const discPrice = calculateDiscountedPrice\(v\.HARGA, promo, 1\);/g,
    `const discPrice = promo && promo.JENIS_PROMO !== 'PER_PESANAN' ? calculateDiscountedPrice(v.HARGA, promo, 1) : v.HARGA;`
);

fs.writeFileSync('src/components/POSSimulator.tsx', code, 'utf-8');
