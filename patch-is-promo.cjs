const fs = require('fs');
let code = fs.readFileSync('src/components/POSSimulator.tsx', 'utf-8');

const replacement = `  const isPromoInPeriod = (periode: string | undefined): boolean => {
    if (!periode) return true;
    try {
      const parts = periode.split(' - ');
      const startStr = parts[0];
      const endStr = parts.length > 1 ? parts[1] : startStr;
      
      const parseDate = (dStr: string, isEnd: boolean = false) => {
        if (!dStr) return new Date(NaN);
        const s = dStr.trim();
        let dateStr = '';
        if (s.match(/^\\d{1,2}\\/\\d{1,2}\\/\\d{4}/)) {
           const p = s.split(' ');
           const dParts = p[0].split('/');
           const time = p[1] || (isEnd ? '23:59:59' : '00:00:00');
           dateStr = \`\${dParts[2]}-\${dParts[1]}-\${dParts[0]}T\${time}+08:00\`;
        }
        else if (s.match(/^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}$/)) {
           dateStr = \`\${s.replace(' ', 'T')}:00+08:00\`;
        }
        else if (s.match(/^\\d{4}-\\d{2}-\\d{2}$/)) {
           dateStr = \`\${s}T\${isEnd ? '23:59:59' : '00:00:00'}+08:00\`;
        } else {
           dateStr = s.replace(' ', 'T');
        }
        return new Date(dateStr);
      };
      
      const start = parseDate(startStr, false);
      const end = parseDate(endStr, true);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
         return false;
      }
      
      const now = new Date();
      if (now < start || now > end) return false;
      return true;
    } catch (e) {
      return false;
    }
  };`;

code = code.replace(/const isPromoInPeriod = \([^\{]+\{([\s\S]*?)catch \(e\) \{\s*return false;\s*\}\s*\};\s*/, replacement + '\n');
fs.writeFileSync('src/components/POSSimulator.tsx', code, 'utf-8');
