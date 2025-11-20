import { PDFGenerationService } from '../services/pdfGenerationService';

// Mock dependencies
jest.mock('puppeteer');
jest.mock('qrcode');
jest.mock('jsbarcode');
jest.mock('canvas');
jest.mock('fs/promises');

describe('PDFGenerationService - Core Functionality', () => {
    let service: PDFGenerationService;

    beforeEach(() => {
        service = new PDFGenerationService();
        jest.clearAllMocks();
    });

    afterEach(async () => {
        await service.cleanup();
    });

    describe('initialization', () => {
        it('should create service instance', () => {
            expect(service).toBeInstanceOf(PDFGenerationService);
        });

        it('should have cleanup method', () => {
            expect(typeof service.cleanup).toBe('function');
        });

        it('should have getBrowserStatus method', () => {
            expect(typeof service.getBrowserStatus).toBe('function');
        });
    });

    describe('validation', () => {
        it('should validate required fields', () => {
            const mockOrder = {
                orderId: 'LAB-2024-0001',
                tests: [{ name: 'CBC', code: 'CBC', specimenType: 'Blood' }],
                indication: 'Routine screening',
                barcodeData: 'token123'
            };

            const mockPatient = {
                firstName: 'John',
                lastName: 'Doe'
            };

            const mockWorkplace = {
                name: 'Test Pharmacy'
            };

            const mockPharmacist = {
                firstName: 'Dr. Jane',
                lastName: 'Smith'
            };

            expect(() => {
                service.validateGenerationRequirements(
                    mockOrder as any,
                    mockPatient as any,
                    mockWorkplace as any,
                    mockPharmacist as any
                );
            }).not.toThrow();
        });

        it('should throw error for missing order ID', () => {
            const mockOrder = {
                orderId: '',
                tests: [{ name: 'CBC', code: 'CBC', specimenType: 'Blood' }],
                indication: 'Routine screening',
                barcodeData: 'token123'
            };

            const mockPatient = { firstName: 'John', lastName: 'Doe' };
            const mockWorkplace = { name: 'Test Pharmacy' };
            const mockPharmacist = { firstName: 'Dr. Jane', lastName: 'Smith' };

            expect(() => {
                service.validateGenerationRequirements(
                    mockOrder as any,
                    mockPatient as any,
                    mockWorkplace as any,
                    mockPharmacist as any
                );
            }).toThrow('Order ID is required');
        });

        it('should throw error for missing tests', () => {
            const mockOrder = {
                orderId: 'LAB-2024-0001',
                tests: [],
                indication: 'Routine screening',
                barcodeData: 'token123'
            };

            const mockPatient = { firstName: 'John', lastName: 'Doe' };
            const mockWorkplace = { name: 'Test Pharmacy' };
            const mockPharmacist = { firstName: 'Dr. Jane', lastName: 'Smith' };

            expect(() => {
                service.validateGenerationRequirements(
                    mockOrder as any,
                    mockPatient as any,
                    mockWorkplace as any,
                    mockPharmacist as any
                );
            }).toThrow('At least one test is required');
        });

        it('should throw error for missing patient name', () => {
            const mockOrder = {
                orderId: 'LAB-2024-0001',
                tests: [{ name: 'CBC', code: 'CBC', specimenType: 'Blood' }],
                indication: 'Routine screening',
                barcodeData: 'token123'
            };

            const mockPatient = { firstName: '', lastName: '' };
            const mockWorkplace = { name: 'Test Pharmacy' };
            const mockPharmacist = { firstName: 'Dr. Jane', lastName: 'Smith' };

            expect(() => {
                service.validateGenerationRequirements(
                    mockOrder as any,
                    mockPatient as any,
                    mockWorkplace as any,
                    mockPharmacist as any
                );
            }).toThrow('Patient name is required');
        });
    });

    describe('PDF generation workflow', () => {
        beforeEach(() => {
            // Mock Puppeteer
            const mockPage = {
                setContent: jest.fn().mockResolvedValue(undefined),
                pdf: jest.fn().mockResolvedValue(Buffer.from('mock-pdf-content')),
                close: jest.fn().mockResolvedValue(undefined)
            };

            const mockBrowser = {
                newPage: jest.fn().mockResolvedValue(mockPage),
                version: jest.fn().mockResolvedValue('Chrome/91.0.4472.124'),
                close: jest.fn().mockResolvedValue(undefined)
            };

            const puppeteer = require('puppeteer');
            puppeteer.launch = jest.fn().mockResolvedValue(mockBrowser);

            // Mock QRCode
            const QRCode = require('qrcode');
            QRCode.toDataURL = jest.fn().mockResolvedValue('data:image/png;base64,mock-qr-code');

            // Mock JsBarcode and Canvas
            const { createCanvas } = require('canvas');
            const mockCanvas = {
                toDataURL: jest.fn().mockReturnValue('data:image/png;base64,mock-barcode')
            };
            createCanvas.mockReturnValue(mockCanvas);

            const JsBarcode = require('jsbarcode');
            JsBarcode.mockImplementation(() => { });

            // Mock fs
            const fs = require('fs/promises');
            fs.readFile = jest.fn().mockResolvedValue(`
        <html>
          <body>
            <div>{{orderId}}</div>
            <div>{{patientName}}</div>
            <div>{{pharmacyName}}</div>
            {{#each tests}}<div>{{name}}</div>{{/each}}
          </body>
        </html>
      `);
        });

        it('should generate PDF with basic data', async () => {
            const mockOrder = {
                orderId: 'LAB-2024-0001',
                tests: [{ name: 'CBC', code: 'CBC', specimenType: 'Blood' }],
                indication: 'Routine screening',
                barcodeData: 'token123',
                priority: 'routine',
                createdAt: new Date('2024-01-15T10:00:00Z')
            };

            const mockPatient = {
                firstName: 'John',
                lastName: 'Doe',
                dob: new Date('1985-05-15'),
                gender: 'male',
                phone: '+1234567890',
                address: '123 Main St'
            };

            const mockWorkplace = {
                name: 'Test Pharmacy',
                phone: '+1987654321',
                email: 'info@testpharmacy.com',
                address: '456 Healthcare Blvd'
            };

            const mockPharmacist = {
                firstName: 'Dr. Jane',
                lastName: 'Smith'
            };

            const result = await service.generateRequisitionPDF(
                mockOrder as any,
                mockPatient as any,
                mockWorkplace as any,
                mockPharmacist as any
            );

            expect(result).toHaveProperty('pdfBuffer');
            expect(result).toHaveProperty('fileName');
            expect(result).toHaveProperty('url');
            expect(result).toHaveProperty('metadata');

            expect(result.pdfBuffer).toBeInstanceOf(Buffer);
            expect(result.fileName).toMatch(/^lab-requisition-LAB-2024-0001-\d+\.pdf$/);
            expect(result.url).toBe('/api/manual-lab-orders/LAB-2024-0001/pdf');
            expect(result.metadata.orderId).toBe('LAB-2024-0001');
        });

        it('should handle QR code generation', async () => {
            const mockOrder = {
                orderId: 'LAB-2024-0001',
                tests: [{ name: 'CBC', code: 'CBC', specimenType: 'Blood' }],
                indication: 'Routine screening',
                barcodeData: 'token123',
                priority: 'routine',
                createdAt: new Date()
            };

            const mockPatient = { firstName: 'John', lastName: 'Doe' };
            const mockWorkplace = { name: 'Test Pharmacy' };
            const mockPharmacist = { firstName: 'Dr. Jane', lastName: 'Smith' };

            await service.generateRequisitionPDF(
                mockOrder as any,
                mockPatient as any,
                mockWorkplace as any,
                mockPharmacist as any
            );

            const QRCode = require('qrcode');
            expect(QRCode.toDataURL).toHaveBeenCalledWith(
                expect.stringContaining('"orderId":"LAB-2024-0001"'),
                expect.objectContaining({
                    errorCorrectionLevel: 'M',
                    type: 'image/png'
                })
            );
        });

        it('should handle barcode generation', async () => {
            const mockOrder = {
                orderId: 'LAB-2024-0001',
                tests: [{ name: 'CBC', code: 'CBC', specimenType: 'Blood' }],
                indication: 'Routine screening',
                barcodeData: 'token123',
                priority: 'routine',
                createdAt: new Date()
            };

            const mockPatient = { firstName: 'John', lastName: 'Doe' };
            const mockWorkplace = { name: 'Test Pharmacy' };
            const mockPharmacist = { firstName: 'Dr. Jane', lastName: 'Smith' };

            await service.generateRequisitionPDF(
                mockOrder as any,
                mockPatient as any,
                mockWorkplace as any,
                mockPharmacist as any
            );

            const JsBarcode = require('jsbarcode');
            expect(JsBarcode).toHaveBeenCalledWith(
                expect.any(Object),
                'token123',
                expect.objectContaining({
                    format: 'CODE128'
                })
            );
        });
    });

    describe('error handling', () => {
        it('should handle QR code generation failure', async () => {
            const QRCode = require('qrcode');
            QRCode.toDataURL = jest.fn().mockRejectedValue(new Error('QR generation failed'));

            const mockOrder = {
                orderId: 'LAB-2024-0001',
                tests: [{ name: 'CBC', code: 'CBC', specimenType: 'Blood' }],
                indication: 'Routine screening',
                barcodeData: 'token123',
                priority: 'routine',
                createdAt: new Date()
            };

            const mockPatient = { firstName: 'John', lastName: 'Doe' };
            const mockWorkplace = { name: 'Test Pharmacy' };
            const mockPharmacist = { firstName: 'Dr. Jane', lastName: 'Smith' };

            await expect(
                service.generateRequisitionPDF(
                    mockOrder as any,
                    mockPatient as any,
                    mockWorkplace as any,
                    mockPharmacist as any
                )
            ).rejects.toThrow('PDF generation failed');
        });

        it('should handle browser launch failure', async () => {
            const puppeteer = require('puppeteer');
            puppeteer.launch = jest.fn().mockRejectedValue(new Error('Browser launch failed'));

            const mockOrder = {
                orderId: 'LAB-2024-0001',
                tests: [{ name: 'CBC', code: 'CBC', specimenType: 'Blood' }],
                indication: 'Routine screening',
                barcodeData: 'token123',
                priority: 'routine',
                createdAt: new Date()
            };

            const mockPatient = { firstName: 'John', lastName: 'Doe' };
            const mockWorkplace = { name: 'Test Pharmacy' };
            const mockPharmacist = { firstName: 'Dr. Jane', lastName: 'Smith' };

            await expect(
                service.generateRequisitionPDF(
                    mockOrder as any,
                    mockPatient as any,
                    mockWorkplace as any,
                    mockPharmacist as any
                )
            ).rejects.toThrow('PDF generation failed');
        });
    });

    describe('browser management', () => {
        it('should return disconnected status when browser is not initialized', async () => {
            const status = await service.getBrowserStatus();
            expect(status.isConnected).toBe(false);
            expect(status.version).toBeUndefined();
        });

        it('should handle cleanup gracefully', async () => {
            await expect(service.cleanup()).resolves.not.toThrow();
        });
    });
});