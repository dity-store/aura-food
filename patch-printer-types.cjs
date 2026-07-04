const fs = require('fs');
let code = fs.readFileSync('src/utils/printer.ts', 'utf-8');

const typeDefs = `
declare global {
  interface Window {
    bluetoothSerial: any;
  }
  interface Navigator {
    bluetooth: any;
  }
}

interface BluetoothDevice {
  id: string;
  name?: string;
  gatt?: any;
}
`;

code = typeDefs + '\n' + code;

fs.writeFileSync('src/utils/printer.ts', code, 'utf-8');
