const fs = require('fs');
let code = fs.readFileSync('src/components/POSSimulator.tsx', 'utf-8');

code = code.replace(
    /onClick=\{\(\) => setIsCreatingTx\(true\)\}/g,
    `onClick={() => {
                      loadDataFromDB(true);
                      setIsCreatingTx(true);
                    }}`
);

code = code.replace(
    /onClick=\{\(\) => \{\n\s*if \(isInitialLoading\) return;\n\s*setCart\(\[\]\);\n\s*setIsCreatingTx\(true\);\n\s*onSelectTransaction\(null\);\n\s*\}\}/g,
    `onClick={() => {
              if (isInitialLoading) return;
              loadDataFromDB(true);
              setCart([]);
              setIsCreatingTx(true);
              onSelectTransaction(null);
            }}`
);

fs.writeFileSync('src/components/POSSimulator.tsx', code, 'utf-8');
