import puppeteer, { Browser, Page } from 'puppeteer';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { Canvas, createCanvas } from 'canvas';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { IManualLabOrder } from '../models/ManualLabOrder';
import { IPatient } from '../../../models/Patient';
import { IWorkplace } from '../../../models/Workplace';
import { IUser } from '../../../models/User';
import ManualLabCacheService from './manualLabCacheService';

export interface RequisitionTemplateData {
    // Order information
    orderId: string;
    orderDate: string;
    orderTime: string;
    priority: string;
    indication: string;

    // Patient information
    patientName: string;
    patientDOB: string;
    patientGender: string;
    patientPhone: string;
    patientAddress: string;

    // Pharmacy information
    pharmacyName: string;
    pharmacyAddress: string;
    pharmacyPhone: string;
    pharmacyEmail: string;
    pharmacistName: string;

    // Tests
    tests: Array<{
        name: string;
        code: string;
        specimenType: string;
        category: string;
        refRange: string;
    }>;

    // Security and metadata
    qrCodeDataUrl: string;
    barcodeDataUrl: string;
    securityToken: string;
    generatedAt: string;
}

export interface PDFGenerationResult {
    pdfBuffer: Buffer;
    fileName: string;
    url: string;
    metadata: {
        orderId: string;
        generatedAt: Date;
        fileSize: number;
        securityHash: string;
    };
}

export class PDFGenerationService {
    private browser: Browser | null = null;
    private templatePath: string;

    constructor() {
        this.templatePath = path.join(__dirname, '../templates/requisitionTemplate.html');
    }

    /**
     * Initialize Puppeteer browser instance
     */
    private async initializeBrowser(): Promise<Browser> {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu'
                ]
            });
        }
        return this.browser;
    }

    /**
     * Generate QR code as data URL
     */
    private async generateQRCode(data: string): Promise<string> {
        try {
            const qrCodeDataUrl = await QRCode.toDataURL(data, {
                errorCorrectionLevel: 'M',
                margin: 1,
                color: {
                    dark: '#2c5aa0',
                    light: '#FFFFFF'
                },
                width: 200
            });
            return qrCodeDataUrl;
        } catch (error: any) {
            throw new Error(`Failed to generate QR code: ${error.message}`);
        }
    }

    /**
     * Generate barcode as data URL
     */
    private async generateBarcode(data: string): Promise<string> {
        try {
            const canvas = createCanvas(300, 100);

            JsBarcode(canvas, data, {
                format: 'CODE128',
                width: 2,
                height: 60,
                displayValue: true,
                fontSize: 12,
                textMargin: 5,
                fontOptions: 'bold',
                font: 'Arial',
                textAlign: 'center',
                textPosition: 'bottom',
                background: '#FFFFFF',
                lineColor: '#2c5aa0'
            });

            return canvas.toDataURL('image/png');
        } catch (error: any) {
            throw new Error(`Failed to generate barcode: ${error.message}`);
        }
    }

    /**
     * Load and render HTML template with data
     */
    private async renderTemplate(templateData: RequisitionTemplateData): Promise<string> {
        try {
            const templateContent = await fs.readFile(this.templatePath, 'utf-8');

            // Simple template replacement (in production, consider using a proper template engine like Handlebars)
            let renderedHtml = templateContent;

            // Replace single values
            const singleValueReplacements = {
                orderId: templateData.orderId,
                orderDate: templateData.orderDate,
                orderTime: templateData.orderTime,
                priority: templateData.priority,
                indication: templateData.indication,
                patientName: templateData.patientName,
                patientDOB: templateData.patientDOB,
                patientGender: templateData.patientGender,
                patientPhone: templateData.patientPhone,
                patientAddress: templateData.patientAddress,
                pharmacyName: templateData.pharmacyName,
                pharmacyAddress: templateData.pharmacyAddress,
                pharmacyPhone: templateData.pharmacyPhone,
                pharmacyEmail: templateData.pharmacyEmail,
                pharmacistName: templateData.pharmacistName,
                qrCodeDataUrl: templateData.qrCodeDataUrl,
                barcodeDataUrl: templateData.barcodeDataUrl,
                securityToken: templateData.securityToken,
                generatedAt: templateData.generatedAt
            };

            for (const [key, value] of Object.entries(singleValueReplacements)) {
                const regex = new RegExp(`{{${key}}}`, 'g');
                renderedHtml = renderedHtml.replace(regex, value || '');
            }

            // Replace tests array (simple implementation)
            const testsHtml = templateData.tests.map(test => `
        <tr>
          <td>${test.name}</td>
          <td>${test.code}</td>
          <td>${test.specimenType}</td>
          <td>${test.category || 'General'}</td>
          <td>${test.refRange || 'N/A'}</td>
        </tr>
      `).join('');

            renderedHtml = renderedHtml.replace(/{{#each tests}}[\s\S]*?{{\/each}}/g, testsHtml);

            return renderedHtml;
        } catch (error: any) {
            throw new Error(`Failed to render template: ${error.message}`);
        }
    }

    /**
     * Generate security hash for PDF metadata
     */
    private generateSecurityHash(orderId: string, timestamp: Date): string {
        const data = `${orderId}-${timestamp.toISOString()}`;
        return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
    }

    /**
     * Format patient address for display
     */
    private formatPatientAddress(patient: IPatient): string {
        return patient.address || 'Address not provided';
    }

    /**
     * Format pharmacy address for display
     */
    private formatPharmacyAddress(workplace: IWorkplace): string {
        return workplace.address || 'Address not provided';
    }

    /**
     * Main method to generate PDF requisition
     */
    async generateRequisitionPDF(
        order: IManualLabOrder,
        patient: IPatient,
        workplace: IWorkplace,
        pharmacist: IUser
    ): Promise<PDFGenerationResult> {
        let page: Page | null = null;

        try {
            const browser = await this.initializeBrowser();
            page = await browser.newPage();

            // Generate QR code and barcode
            const qrCodeData = JSON.stringify({
                orderId: order.orderId,
                token: order.barcodeData,
                type: 'manual_lab_order'
            });

            const [qrCodeDataUrl, barcodeDataUrl] = await Promise.all([
                this.generateQRCode(qrCodeData),
                this.generateBarcode(order.barcodeData)
            ]);

            // Prepare template data
            const now = new Date();
            const templateData: RequisitionTemplateData = {
                // Order information
                orderId: order.orderId,
                orderDate: order.createdAt.toLocaleDateString(),
                orderTime: order.createdAt.toLocaleTimeString(),
                priority: order.priority || 'routine',
                indication: order.indication,

                // Patient information
                patientName: `${patient.firstName} ${patient.lastName}`,
                patientDOB: patient.dob ? patient.dob.toLocaleDateString() : 'Not provided',
                patientGender: patient.gender || 'Not specified',
                patientPhone: patient.phone || 'Not provided',
                patientAddress: this.formatPatientAddress(patient),

                // Pharmacy information
                pharmacyName: workplace.name,
                pharmacyAddress: this.formatPharmacyAddress(workplace),
                pharmacyPhone: workplace.phone || 'Not provided',
                pharmacyEmail: workplace.email || 'Not provided',
                pharmacistName: `${pharmacist.firstName} ${pharmacist.lastName}`,

                // Tests
                tests: order.tests.map(test => ({
                    name: test.name,
                    code: test.code,
                    specimenType: test.specimenType,
                    category: test.category || 'General',
                    refRange: test.refRange || 'N/A'
                })),

                // Security and metadata
                qrCodeDataUrl,
                barcodeDataUrl,
                securityToken: this.generateSecurityHash(order.orderId, now),
                generatedAt: now.toLocaleString()
            };

            // Render HTML template
            const htmlContent = await this.renderTemplate(templateData);

            // Set page content and generate PDF
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

            const pdfBuffer = Buffer.from(await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '0.5in',
                    right: '0.5in',
                    bottom: '0.5in',
                    left: '0.5in'
                },
                displayHeaderFooter: false,
                preferCSSPageSize: true
            }));

            // Generate filename and URL
            const fileName = `lab-requisition-${order.orderId}-${Date.now()}.pdf`;
            const url = `/api/manual-lab-orders/${order.orderId}/pdf`;

            // Create metadata
            const metadata = {
                orderId: order.orderId,
                generatedAt: now,
                fileSize: pdfBuffer.length,
                securityHash: this.generateSecurityHash(order.orderId, now),
                generationTime: Date.now() - now.getTime()
            };

            const result = {
                pdfBuffer,
                fileName,
                url,
                metadata
            };

            // Cache the generated PDF
            await ManualLabCacheService.cachePDFRequisition(order.orderId, result);

            return result;

        } catch (error: any) {
            throw new Error(`PDF generation failed: ${error.message}`);
        } finally {
            if (page) {
                await page.close();
            }
        }
    }

    /**
     * Add watermark to PDF (additional security measure)
     */
    async addWatermark(
        pdfBuffer: Buffer,
        watermarkText: string,
        opacity: number = 0.1
    ): Promise<Buffer> {
        // This is a placeholder for watermark functionality
        // In a production environment, you might use libraries like pdf-lib
        // For now, we're handling watermarks in the HTML template
        return pdfBuffer;
    }

    /**
     * Validate PDF generation requirements
     */
    validateGenerationRequirements(
        order: IManualLabOrder,
        patient: IPatient,
        workplace: IWorkplace,
        pharmacist: IUser
    ): void {
        const errors: string[] = [];

        if (!order.orderId) errors.push('Order ID is required');
        if (!order.tests || order.tests.length === 0) errors.push('At least one test is required');
        if (!order.indication) errors.push('Clinical indication is required');
        if (!order.barcodeData) errors.push('Barcode data is required');

        if (!patient.firstName || !patient.lastName) errors.push('Patient name is required');
        if (!workplace.name) errors.push('Pharmacy name is required');
        if (!pharmacist.firstName || !pharmacist.lastName) errors.push('Pharmacist name is required');

        if (errors.length > 0) {
            throw new Error(`PDF generation validation failed: ${errors.join(', ')}`);
        }
    }

    /**
     * Clean up browser resources
     */
    async cleanup(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    /**
     * Get browser status for health checks
     */
    async getBrowserStatus(): Promise<{ isConnected: boolean; version?: string }> {
        try {
            if (!this.browser) {
                return { isConnected: false };
            }

            const version = await this.browser.version();
            return { isConnected: true, version };
        } catch (error) {
            return { isConnected: false };
        }
    }
}

// Export singleton instance
export const pdfGenerationService = new PDFGenerationService();

// Graceful shutdown handler
process.on('SIGTERM', async () => {
    await pdfGenerationService.cleanup();
});

process.on('SIGINT', async () => {
    await pdfGenerationService.cleanup();
});