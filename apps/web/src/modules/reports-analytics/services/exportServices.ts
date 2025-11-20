// Export Services - Handle different export formats
import '../types/external';
import { ExportConfig, ExportResult, ExportJob } from '../types/exports';
import { ReportData } from '../types/reports';
import { generateExportFilename, getMimeType } from '../utils/exportHelpers';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: any) => jsPDF;
    }
}

export class ExportService {
    /**
     * Export report data in the specified format
     */
    static async exportReport(
        reportData: ReportData,
        config: ExportConfig,
        onProgress?: (progress: number) => void
    ): Promise<ExportResult> {
        const startTime = Date.now();
        const filename = generateExportFilename(config.metadata.reportType, config.format);

        try {
            onProgress?.(10);

            let blob: Blob;
            let fileSize: number;

            switch (config.format) {
                case 'pdf':
                    blob = await this.exportToPDF(reportData, config, onProgress);
                    break;
                case 'excel':
                    blob = await this.exportToExcel(reportData, config, onProgress);
                    break;
                case 'csv':
                    blob = await this.exportToCSV(reportData, config, onProgress);
                    break;
                case 'json':
                    blob = await this.exportToJSON(reportData, config, onProgress);
                    break;
                case 'png':
                    blob = await this.exportToPNG(reportData, config, onProgress);
                    break;
                case 'svg':
                    blob = await this.exportToSVG(reportData, config, onProgress);
                    break;
                default:
                    throw new Error(`Unsupported export format: ${config.format}`);
            }

            fileSize = blob.size;
            onProgress?.(90);

            // Create download URL
            const downloadUrl = URL.createObjectURL(blob);

            // Auto-download the file
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            onProgress?.(100);

            const result: ExportResult = {
                id: `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                status: 'completed',
                format: config.format,
                filename,
                fileSize,
                downloadUrl,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
                createdAt: new Date(startTime),
                completedAt: new Date(),
            };

            return result;

        } catch (error) {
            console.error('Export failed:', error);

            const result: ExportResult = {
                id: `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                status: 'failed',
                format: config.format,
                filename,
                error: error instanceof Error ? error.message : 'Unknown error',
                createdAt: new Date(startTime),
            };

            return result;
        }
    }

    /**
     * Export to PDF format
     */
    private static async exportToPDF(
        reportData: ReportData,
        config: ExportConfig,
        onProgress?: (progress: number) => void
    ): Promise<Blob> {
        onProgress?.(20);

        // Dynamic import for jsPDF
        let jsPDF: any;
        try {
            jsPDF = (await import('jspdf')).default;
            await import('jspdf-autotable');
        } catch (error) {
            throw new Error('PDF export requires jsPDF library. Please install: npm install jspdf jspdf-autotable');
        }

        const pdf = new jsPDF({
            orientation: config.options.orientation || 'portrait',
            unit: 'mm',
            format: config.options.pageSize || 'a4',
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margins = config.options.margins || { top: 20, right: 20, bottom: 20, left: 20 };

        let yPosition = margins.top;

        // Add title
        pdf.setFontSize(20);
        pdf.setFont('helvetica', 'bold');
        pdf.text(config.metadata.title, margins.left, yPosition);
        yPosition += 15;

        onProgress?.(30);

        // Add metadata if enabled
        if (config.options.includeMetadata) {
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`Generated: ${config.metadata.generatedAt.toLocaleString()}`, margins.left, yPosition);
            yPosition += 5;
            pdf.text(`Author: ${config.metadata.author}`, margins.left, yPosition);
            yPosition += 5;
            pdf.text(`Organization: ${config.metadata.organization}`, margins.left, yPosition);
            yPosition += 10;
        }

        onProgress?.(40);

        // Add filters if enabled
        if (config.options.includeFilters && Object.keys(config.metadata.filters).length > 0) {
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Applied Filters:', margins.left, yPosition);
            yPosition += 8;

            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            Object.entries(config.metadata.filters).forEach(([key, value]) => {
                if (value && value !== 'all') {
                    const filterText = `${key}: ${JSON.stringify(value)}`;
                    pdf.text(filterText, margins.left + 5, yPosition);
                    yPosition += 5;
                }
            });
            yPosition += 10;
        }

        onProgress?.(50);

        // Add summary metrics
        if (reportData.summary) {
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Summary', margins.left, yPosition);
            yPosition += 10;

            const summaryData = Object.entries(reportData.summary).map(([key, value]) => [
                key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
                typeof value === 'number' ? value.toLocaleString() : String(value)
            ]);

            pdf.autoTable({
                startY: yPosition,
                head: [['Metric', 'Value']],
                body: summaryData,
                margin: { left: margins.left, right: margins.right },
                styles: { fontSize: 10 },
                headStyles: { fillColor: [66, 139, 202] },
            });

            yPosition = (pdf as any).lastAutoTable.finalY + 10;
        }

        onProgress?.(60);

        // Add charts if enabled and available
        if (config.options.includeCharts && reportData.charts) {
            for (let i = 0; i < reportData.charts.length; i++) {
                const chart = reportData.charts[i];

                // Check if we need a new page
                if (yPosition > pageHeight - 100) {
                    pdf.addPage();
                    yPosition = margins.top;
                }

                pdf.setFontSize(12);
                pdf.setFont('helvetica', 'bold');
                pdf.text(chart.title || `Chart ${i + 1}`, margins.left, yPosition);
                yPosition += 15;

                // Try to capture chart as image
                try {
                    // Dynamic import for html2canvas
                    let html2canvas: any;
                    try {
                        html2canvas = (await import('html2canvas')).default;
                    } catch (error) {
                        console.warn('html2canvas not available, skipping chart capture');
                        continue;
                    }

                    const chartElement = document.querySelector(`[data-chart-id="${chart.id}"]`) as HTMLElement;
                    if (chartElement) {
                        const canvas = await html2canvas(chartElement, {
                            backgroundColor: '#ffffff',
                            scale: 2,
                        });

                        const imgData = canvas.toDataURL('image/png');
                        const imgWidth = pageWidth - margins.left - margins.right;
                        const imgHeight = (canvas.height * imgWidth) / canvas.width;

                        pdf.addImage(imgData, 'PNG', margins.left, yPosition, imgWidth, imgHeight);
                        yPosition += imgHeight + 10;
                    }
                } catch (error) {
                    console.warn('Failed to capture chart:', error);
                    pdf.setFontSize(10);
                    pdf.text('[Chart could not be rendered]', margins.left, yPosition);
                    yPosition += 10;
                }

                onProgress?.(60 + (i / reportData.charts.length) * 20);
            }
        }

        onProgress?.(80);

        // Add tables
        if (reportData.tables) {
            reportData.tables.forEach((table, index) => {
                // Check if we need a new page
                if (yPosition > pageHeight - 50) {
                    pdf.addPage();
                    yPosition = margins.top;
                }

                pdf.setFontSize(12);
                pdf.setFont('helvetica', 'bold');
                pdf.text(table.title || `Table ${index + 1}`, margins.left, yPosition);
                yPosition += 10;

                if (table.data && table.data.length > 0) {
                    const headers = Object.keys(table.data[0]);
                    const rows = table.data.map(row => headers.map(header => String(row[header] || '')));

                    pdf.autoTable({
                        startY: yPosition,
                        head: [headers],
                        body: rows,
                        margin: { left: margins.left, right: margins.right },
                        styles: { fontSize: 8 },
                        headStyles: { fillColor: [66, 139, 202] },
                    });

                    yPosition = (pdf as any).lastAutoTable.finalY + 10;
                }
            });
        }

        // Add watermark if specified
        if (config.options.watermark) {
            const totalPages = pdf.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                pdf.setPage(i);
                pdf.setFontSize(50);
                pdf.setTextColor(200, 200, 200);
                pdf.text(
                    config.options.watermark.text,
                    pageWidth / 2,
                    pageHeight / 2,
                    { angle: 45, align: 'center' }
                );
            }
        }

        onProgress?.(85);

        return new Blob([pdf.output('blob')], { type: 'application/pdf' });
    }

    /**
     * Export to Excel format
     */
    private static async exportToExcel(
        reportData: ReportData,
        config: ExportConfig,
        onProgress?: (progress: number) => void
    ): Promise<Blob> {
        onProgress?.(20);

        // Dynamic import for XLSX
        let XLSX: any;
        try {
            XLSX = await import('xlsx');
        } catch (error) {
            throw new Error('Excel export requires xlsx library. Please install: npm install xlsx');
        }

        const workbook = XLSX.utils.book_new();

        // Summary sheet
        if (reportData.summary) {
            const summaryData = Object.entries(reportData.summary).map(([key, value]) => ({
                Metric: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
                Value: value,
            }));

            const summarySheet = XLSX.utils.json_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
        }

        onProgress?.(40);

        // Charts sheet (metadata only, as Excel charts require different approach)
        if (reportData.charts && config.options.includeCharts) {
            const chartsData = reportData.charts.map((chart, index) => ({
                'Chart ID': chart.id || `chart_${index}`,
                'Title': chart.title || `Chart ${index + 1}`,
                'Type': chart.type || 'unknown',
                'Data Points': Array.isArray(chart.data) ? chart.data.length : 0,
            }));

            const chartsSheet = XLSX.utils.json_to_sheet(chartsData);
            XLSX.utils.book_append_sheet(workbook, chartsSheet, 'Charts');
        }

        onProgress?.(60);

        // Data sheets
        if (reportData.tables) {
            reportData.tables.forEach((table, index) => {
                if (table.data && table.data.length > 0) {
                    const sheet = XLSX.utils.json_to_sheet(table.data);
                    const sheetName = table.title?.substring(0, 31) || `Data_${index + 1}`;
                    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
                }
            });
        }

        onProgress?.(80);

        // Add metadata sheet if enabled
        if (config.options.includeMetadata) {
            const metadataData = [
                { Property: 'Title', Value: config.metadata.title },
                { Property: 'Author', Value: config.metadata.author },
                { Property: 'Organization', Value: config.metadata.organization },
                { Property: 'Generated At', Value: config.metadata.generatedAt.toISOString() },
                { Property: 'Report Type', Value: config.metadata.reportType },
                { Property: 'Version', Value: config.metadata.version },
            ];

            if (config.options.includeFilters) {
                Object.entries(config.metadata.filters).forEach(([key, value]) => {
                    metadataData.push({
                        Property: `Filter: ${key}`,
                        Value: JSON.stringify(value),
                    });
                });
            }

            const metadataSheet = XLSX.utils.json_to_sheet(metadataData);
            XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Metadata');
        }

        onProgress?.(90);

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        return new Blob([excelBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
    }

    /**
     * Export to CSV format
     */
    private static async exportToCSV(
        reportData: ReportData,
        config: ExportConfig,
        onProgress?: (progress: number) => void
    ): Promise<Blob> {
        onProgress?.(20);

        let csvContent = '';
        const delimiter = config.options.delimiter || ',';
        const includeHeaders = config.options.includeHeaders !== false;

        // Add metadata header if enabled
        if (config.options.includeMetadata) {
            csvContent += `# ${config.metadata.title}\n`;
            csvContent += `# Generated: ${config.metadata.generatedAt.toISOString()}\n`;
            csvContent += `# Author: ${config.metadata.author}\n`;
            csvContent += `# Organization: ${config.metadata.organization}\n`;
            csvContent += '\n';
        }

        onProgress?.(40);

        // Add filters if enabled
        if (config.options.includeFilters && Object.keys(config.metadata.filters).length > 0) {
            csvContent += '# Applied Filters:\n';
            Object.entries(config.metadata.filters).forEach(([key, value]) => {
                if (value && value !== 'all') {
                    csvContent += `# ${key}: ${JSON.stringify(value)}\n`;
                }
            });
            csvContent += '\n';
        }

        onProgress?.(60);

        // Combine all table data
        const allData: any[] = [];

        // Add summary data
        if (reportData.summary) {
            Object.entries(reportData.summary).forEach(([key, value]) => {
                allData.push({
                    Category: 'Summary',
                    Metric: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
                    Value: value,
                });
            });
        }

        // Add table data
        if (reportData.tables) {
            reportData.tables.forEach((table) => {
                if (table.data && table.data.length > 0) {
                    table.data.forEach((row) => {
                        allData.push({
                            Category: table.title || 'Data',
                            ...row,
                        });
                    });
                }
            });
        }

        onProgress?.(80);

        if (allData.length > 0) {
            const headers = Object.keys(allData[0]);

            // Add headers if enabled
            if (includeHeaders) {
                csvContent += headers.join(delimiter) + '\n';
            }

            // Add data rows
            allData.forEach((row) => {
                const values = headers.map(header => {
                    const value = row[header];
                    if (value === null || value === undefined) return '';

                    let stringValue = String(value);

                    // Escape quotes and wrap in quotes if contains delimiter or quotes
                    if (stringValue.includes(delimiter) || stringValue.includes('"') || stringValue.includes('\n')) {
                        stringValue = '"' + stringValue.replace(/"/g, '""') + '"';
                    }

                    return stringValue;
                });

                csvContent += values.join(delimiter) + '\n';
            });
        }

        onProgress?.(90);

        const encoding = config.options.encoding || 'utf-8';
        return new Blob([csvContent], { type: `text/csv;charset=${encoding}` });
    }

    /**
     * Export to JSON format
     */
    private static async exportToJSON(
        reportData: ReportData,
        config: ExportConfig,
        onProgress?: (progress: number) => void
    ): Promise<Blob> {
        onProgress?.(20);

        const exportData = {
            metadata: config.options.includeMetadata ? config.metadata : undefined,
            filters: config.options.includeFilters ? config.metadata.filters : undefined,
            summary: reportData.summary,
            charts: config.options.includeCharts ? reportData.charts : undefined,
            tables: reportData.tables,
            exportedAt: new Date().toISOString(),
        };

        onProgress?.(80);

        const jsonString = JSON.stringify(exportData, null, 2);
        const encoding = config.options.encoding || 'utf-8';

        onProgress?.(90);

        return new Blob([jsonString], { type: `application/json;charset=${encoding}` });
    }

    /**
     * Export to PNG format
     */
    private static async exportToPNG(
        reportData: ReportData,
        config: ExportConfig,
        onProgress?: (progress: number) => void
    ): Promise<Blob> {
        onProgress?.(20);

        // Dynamic import for html2canvas
        let html2canvas: unknown;
        try {
            html2canvas = (await import('html2canvas')).default;
        } catch (error) {
            throw new Error('PNG export requires html2canvas library. Please install: npm install html2canvas');
        }

        // Find the main chart container
        const chartContainer = document.querySelector('[data-export-container]') as HTMLElement;
        if (!chartContainer) {
            throw new Error('No chart container found for PNG export');
        }

        onProgress?.(40);

        const canvas = await html2canvas(chartContainer, {
            backgroundColor: config.options.backgroundColor || '#ffffff',
            width: config.options.width || 1200,
            height: config.options.height || 800,
            scale: (config.options.dpi || 150) / 96, // Convert DPI to scale factor
            useCORS: true,
            allowTaint: false,
        });

        onProgress?.(80);

        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    throw new Error('Failed to generate PNG blob');
                }
            }, 'image/png');
        });
    }

    /**
     * Export to SVG format
     */
    private static async exportToSVG(
        reportData: ReportData,
        config: ExportConfig,
        onProgress?: (progress: number) => void
    ): Promise<Blob> {
        onProgress?.(20);

        // Find SVG elements in the chart container
        const chartContainer = document.querySelector('[data-export-container]') as HTMLElement;
        if (!chartContainer) {
            throw new Error('No chart container found for SVG export');
        }

        const svgElements = chartContainer.querySelectorAll('svg');
        if (svgElements.length === 0) {
            throw new Error('No SVG elements found for export');
        }

        onProgress?.(40);

        // Create a combined SVG
        const width = config.options.width || 1200;
        const height = config.options.height || 800;

        let combinedSVG = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

        if (config.options.backgroundColor && !config.options.transparent) {
            combinedSVG += `<rect width="100%" height="100%" fill="${config.options.backgroundColor}"/>`;
        }

        onProgress?.(60);

        // Add each SVG element
        svgElements.forEach((svg, index) => {
            const svgContent = svg.innerHTML;
            const yOffset = index * (height / svgElements.length);

            combinedSVG += `<g transform="translate(0, ${yOffset})">`;
            combinedSVG += svgContent;
            combinedSVG += '</g>';
        });

        combinedSVG += '</svg>';

        onProgress?.(90);

        return new Blob([combinedSVG], { type: 'image/svg+xml' });
    }
}