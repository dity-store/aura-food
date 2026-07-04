declare module 'thermal-printer-encoder' {
    export default class ReceiptPrinterEncoder {
        constructor(options?: any);
        initialize(): this;
        codepage(codepage: string): this;
        align(align: 'left' | 'center' | 'right'): this;
        text(text: string): this;
        newline(): this;
        line(text: string): this;
        bold(bold: boolean): this;
        size(width: number, height: number): this;
        cut(): this;
        encode(): Uint8Array;
        [key: string]: any;
    }
}
