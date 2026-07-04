const fs = require('fs');

let content = fs.readFileSync('src/components/POSSimulator.tsx', 'utf-8');

const regex = /\{(\w+)\s*&&\s*\(\s*(<div style=\{\{\s*zIndex:\s*9999999\s*\}\}[\s\S]*?)\s*\)\}/g;

content = content.replace(regex, (match, condition, divContent) => {
    // Check if it's already using createPortal
    if (match.includes('createPortal')) return match;
    
    // Some match might include the trailing `)}` for the outer block.
    // Let's just do a simpler replacement based on specific conditions.
    return match;
});

// Since the regex might be tricky, let's just do it manually with targeted replacements.
