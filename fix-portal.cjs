const fs = require('fs');

let content = fs.readFileSync('src/components/POSSimulator.tsx', 'utf-8');

const replacements = [
    'showCatalogModal',
    'showCheckoutModal',
    'showCartPopup',
    'selectedMenuForVarian',
    'confirmDeleteId',
    'confirmDiscardCart',
    'alertMessage',
    'showPrinterWarning',
    'showPrinterSettings', // note: occurs twice
    'showReportPopup',
    'showAddChargeModal'
];

replacements.forEach(name => {
    let searchStr = `{${name} && createPortal(`;
    let index = 0;
    while ((index = content.indexOf(searchStr, index)) !== -1) {
        // Find the matching parenthesis
        let parenCount = 1;
        let i = index + searchStr.length;
        while (i < content.length && parenCount > 0) {
            if (content[i] === '(') parenCount++;
            else if (content[i] === ')') parenCount--;
            i++;
        }
        
        // i - 1 is the closing parenthesis
        if (parenCount === 0) {
            // Check if it already has document.body
            const beforeParen = content.substring(i - 15, i);
            if (!beforeParen.includes('document.body')) {
                content = content.substring(0, i - 1) + ', document.body)' + content.substring(i);
            }
        }
        index = i;
    }
});

fs.writeFileSync('src/components/POSSimulator.tsx', content, 'utf-8');
