declare module 'jspdf' {
  export class jsPDF {
    constructor(orientation?: string, unit?: string, format?: string);
    addPage(): jsPDF;
    addImage(imageData: string, format: string, x: number, y: number, width: number, height: number): jsPDF;
    text(text: string, x: number, y: number, options?: any): jsPDF;
    setFontSize(size: number): jsPDF;
    save(filename: string): void;
    internal: {
      pageSize: {
        getWidth(): number;
        getHeight(): number;
      };
    };
  }
}
