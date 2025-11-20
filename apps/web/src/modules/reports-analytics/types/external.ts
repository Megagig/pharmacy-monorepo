// Type definitions for external libraries that may not be installed

// jsPDF types
declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: any) => jsPDF;
        addImage: (imageData: string, format: string, x: number, y: number, width: number, height: number) => void;
        setFontSize: (size: number) => void;
        setFont: (fontName: string, fontStyle?: string) => void;
        text: (text: string, x: number, y: number, options?: any) => void;
        addPage: () => void;
        getNumberOfPages: () => number;
        setPage: (page: number) => void;
        setTextColor: (r: number, g: number, b: number) => void;
        output: (type: string) => any;
        internal: {
            pageSize: {
                getWidth: () => number;
                getHeight: () => number;
            };
        };
    }

    interface jsPDFOptions {
        orientation?: 'portrait' | 'landscape';
        unit?: string;
        format?: string;
    }

    class jsPDF {
        constructor(options?: jsPDFOptions);
    }

    export = jsPDF;
}

declare module 'jspdf-autotable' {
    // This module extends jsPDF
}

// XLSX types
declare module 'xlsx' {
    interface WorkBook {
        SheetNames: string[];
        Sheets: { [name: string]: WorkSheet };
    }

    interface WorkSheet {
        [cell: string]: any;
    }

    namespace utils {
        function book_new(): WorkBook;
        function json_to_sheet(data: any[]): WorkSheet;
        function book_append_sheet(workbook: WorkBook, worksheet: WorkSheet, name: string): void;
    }

    function write(workbook: WorkBook, options: { bookType: string; type: string }): any;
}

// file-saver types
declare module 'file-saver' {
    function saveAs(blob: Blob, filename: string): void;
}

// html2canvas types
declare module 'html2canvas' {
    interface Html2CanvasOptions {
        backgroundColor?: string;
        width?: number;
        height?: number;
        scale?: number;
        useCORS?: boolean;
        allowTaint?: boolean;
    }

    function html2canvas(element: HTMLElement, options?: Html2CanvasOptions): Promise<HTMLCanvasElement>;
    export = html2canvas;
}