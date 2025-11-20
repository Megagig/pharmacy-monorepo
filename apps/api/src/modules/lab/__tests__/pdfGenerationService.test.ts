import { PDFGenerationService, pdfGenerationService } from '../services/pdfGenerationService';
import { IManualLabOrder } from '../models/ManualLabOrder';
import { IPatient } from '../../../models/Patient';
import { IWorkplace } from '../../../models/Workplace';
import { IUser } from '../../../models/User';
import fs from 'fs/promises';
import path from 'path';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { afterEach } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock dependencies
jest.mock('puppeteer');
jest.mock('qrcode');
jest.mock('jsbarcode');
jest.mock('canvas');
jest.mock('fs/promises');

describe('PDFGenerationService', () => {
    let service: PDFGenerationService;
    let mockOrder: IManualLabOrder;
    let mockPatient: IPatient;
    let mockWorkplace: IWorkplace;
    let mockPharmacist: IUser;

    beforeEach(() => {
        service = new PDFGenerationService();

        // Mock order data
        mockOrder = {
            orderId: 'LAB-2024-0001',
            patientId: 'patient123' as any,
            workplaceId: 'workplace123' as any,
            orderedBy: 'pharmacist123' as any,
            tests: [
                {
                    name: 'Complete Blood Count',
                    code: 'CBC',
                    loincCode: '58410-2',
                    specimenType: 'Blood',
                    unit: 'cells/μL',
                    refRange: '4.5-11.0 x10³',
                    category: 'Hematology'
                },
                {
                    name: 'Basic Metabolic Panel',
                    code: 'BMP',
                    specimenType: 'Blood',
                    category: 'Chemistry',
                    refRange: 'Various'
                }
            ],
            indication: 'Routine health screening and diabetes monitoring',
            requisitionFormUrl: '',
            barcodeData: 'secure-token-123',
            status: 'requested',
            priority: 'routine',
            consentObtained: true,
            consentTimestamp: new Date('2024-01-15T10:00:00Z'),
            consentObtainedBy: 'pharmacist123' as any,
            createdAt: new Date('2024-01-15T10:00:00Z'),
            updatedAt: new Date('2024-01-15T10:00:00Z'),
            createdBy: 'pharmacist123' as any,
            isDeleted: false
        } as IManualLabOrder;

        // Mock patient data
        mockPatient = {
            _id: 'patient123' as any,
            workplaceId: 'workplace123' as any,
            mrn: 'PAT-001',
            firstName: 'John',
            lastName: 'Doe',
            dob: new Date('1985-05-15'),
            gender: 'male',
            phone: '+1234567890',
            address: '123 Main St, Anytown, CA 12345',
            state: 'CA'
        } as IPatient;

        // Mock workplace data
        mockWorkplace = {
            _id: 'workplace123' as any,
            name: 'Central Pharmacy',
            type: 'Community',
            licenseNumber: 'LIC-123',
            email: 'info@centralpharmacy.com',
            phone: '+1987654321',
            address: '456 Healthcare Blvd, Medical City, CA 54321',
            state: 'CA',
            ownerId: 'owner123' as any,
            verificationStatus: 'verified',
            documents: [],
            inviteCode: 'INVITE123',
            teamMembers: []
        } as IWorkplace;

        // Mock pharmacist data
        mockPharmacist = {
            _id: 'pharmacist123',
            firstName: 'Dr. Jane',
            lastName: 'Smith',
            email: 'jane.smith@centralpharmacy.com'
        } as IUser;

        // Reset all mocks
        jest.clearAllMocks();
    });

    afterEach(async () => {
        await service.cleanup();
    });

    describe('generateRequisitionPDF', () => {
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

        it('should generate PDF successfully with valid data', async () => {
            const result = await service.generateRequisitionPDF(
                mockOrder,
                mockPatient,
                mockWorkplace,
                mockPharmacist
            );

            expect(result).toHaveProperty('pdfBuffer');
            expect(result).toHaveProperty('fileName');
            expect(result).toHaveProperty('url');
            expect(result).toHaveProperty('metadata');

            expect(result.pdfBuffer).toBeInstanceOf(Buffer);
            expect(result.fileName).toMatch(/^lab-requisition-LAB-2024-0001-\d+\.pdf$/);
            expect(result.url).toBe('/api/manual-lab-orders/LAB-2024-0001/pdf');
            expect(result.metadata.orderId).toBe('LAB-2024-0001');
            expect(result.metadata.fileSize).toBeGreaterThan(0);
        });

        it('should generate QR code with correct data', async () => {
            await service.generateRequisitionPDF(
                mockOrder,
                mockPatient,
                mockWorkplace,
                mockPharmacist
            );

            const QRCode = require('qrcode');
            expect(QRCode.toDataURL).toHaveBeenCalledWith(
                expect.stringContaining('"orderId":"LAB-2024-0001"'),
                expect.objectContaining({
                    errorCorrectionLevel: 'M',
                    type: 'image/png',
                    quality: 0.92,
                    margin: 1,
                    width: 200
                })
            );
        });

        it('should generate barcode with secure token', async () => {
            await service.generateRequisitionPDF(
                mockOrder,
                mockPatient,
                mockWorkplace,
                mockPharmacist
            );

            const JsBarcode = require('jsbarcode');
            expect(JsBarcode).toHaveBeenCalledWith(
                expect.any(Object),
                'secure-token-123',
                expect.objectContaining({
                    format: 'CODE128',
                    width: 2,
                    height: 60,
                    displayValue: true
                })
            );
        });

        it('should handle missing optional patient data gracefully', async () => {
            const patientWithMissingData = {
                ...mockPatient,
                dob: undefined,
                gender: undefined,
                phone: undefined,
                address: undefined
            } as IPatient;

            const result = await service.generateRequisitionPDF(
                mockOrder,
                patientWithMissingData,
                mockWorkplace,
                mockPharmacist
            );

            expect(result).toHaveProperty('pdfBuffer');
            expect(result.pdfBuffer).toBeInstanceOf(Buffer);
        });

        it('should handle missing optional workplace data gracefully', async () => {
            const workplaceWithMissingData = {
                ...mockWorkplace,
                phone: undefined,
                email: undefined,
                address: undefined
            } as IWorkplace;

            const result = await service.generateRequisitionPDF(
                mockOrder,
                mockPatient,
                workplaceWithMissingData,
                mockPharmacist
            );

            expect(result).toHaveProperty('pdfBuffer');
            expect(result.pdfBuffer).toBeInstanceOf(Buffer);
        });

        it('should include all tests in the PDF', async () => {
            const fs = require('fs/promises');
            let capturedHtml = '';

            const mockPage = {
                setContent: jest.fn().mockImplementation((html) => {
                    capturedHtml = html;
                    return Promise.resolve();
                }),
                pdf: jest.fn().mockResolvedValue(Buffer.from('mock-pdf-content')),
                close: jest.fn().mockResolvedValue(undefined)
            };

            const puppeteer = require('puppeteer');
            puppeteer.launch().then((browser: any) => browser.newPage()).mockResolvedValue(mockPage);

            await service.generateRequisitionPDF(
                mockOrder,
                mockPatient,
                mockWorkplace,
                mockPharmacist
            );

            // Verify that both tests are included in the rendered HTML
            expect(capturedHtml).toContain('Complete Blood Count');
            expect(capturedHtml).toContain('Basic Metabolic Panel');
            expect(capturedHtml).toContain('CBC');
            expect(capturedHtml).toContain('BMP');
        });

        it('should set correct PDF options', async () => {
            const mockPage = {
                setContent: jest.fn().mockResolvedValue(undefined),
                pdf: jest.fn().mockResolvedValue(Buffer.from('mock-pdf-content')),
                close: jest.fn().mockResolvedValue(undefined)
            };

            const puppeteer = require('puppeteer');
            puppeteer.launch().then((browser: any) => browser.newPage()).mockResolvedValue(mockPage);

            await service.generateRequisitionPDF(
                mockOrder,
                mockPatient,
                mockWorkplace,
                mockPharmacist
            );

            expect(mockPage.pdf).toHaveBeenCalledWith({
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
            });
        });
    });

    describe('validateGenerationRequirements', () => {
        it('should pass validation with complete data', () => {
            expect(() => {
                service.validateGenerationRequirements(
                    mockOrder,
                    mockPatient,
                    mockWorkplace,
                    mockPharmacist
                );
            }).not.toThrow();
        });

        it('should throw error for missing order ID', () => {
            const invalidOrder = { ...mockOrder, orderId: '' };

            expect(() => {
                service.validateGenerationRequirements(
                    invalidOrder as IManualLabOrder,
                    mockPatient,
                    mockWorkplace,
                    mockPharmacist
                );
            }).toThrow('Order ID is required');
        });

        it('should throw error for missing tests', () => {
            const invalidOrder = { ...mockOrder, tests: [] };

            expect(() => {
                service.validateGenerationRequirements(
                    invalidOrder as IManualLabOrder,
                    mockPatient,
                    mockWorkplace,
                    mockPharmacist
                );
            }).toThrow('At least one test is required');
        });

        it('should throw error for missing indication', () => {
            const invalidOrder = { ...mockOrder, indication: '' };

            expect(() => {
                service.validateGenerationRequirements(
                    invalidOrder as IManualLabOrder,
                    mockPatient,
                    mockWorkplace,
                    mockPharmacist
                );
            }).toThrow('Clinical indication is required');
        });

        it('should throw error for missing patient name', () => {
            const invalidPatient = { ...mockPatient, firstName: '', lastName: '' };

            expect(() => {
                service.validateGenerationRequirements(
                    mockOrder,
                    invalidPatient as IPatient,
                    mockWorkplace,
                    mockPharmacist
                );
            }).toThrow('Patient name is required');
        });

        it('should throw error for missing pharmacy name', () => {
            const invalidWorkplace = { ...mockWorkplace, name: '' };

            expect(() => {
                service.validateGenerationRequirements(
                    mockOrder,
                    mockPatient,
                    invalidWorkplace as IWorkplace,
                    mockPharmacist
                );
            }).toThrow('Pharmacy name is required');
        });

        it('should throw error for missing pharmacist name', () => {
            const invalidPharmacist = { ...mockPharmacist, firstName: '', lastName: '' };

            expect(() => {
                service.validateGenerationRequirements(
                    mockOrder,
                    mockPatient,
                    mockWorkplace,
                    invalidPharmacist as IUser
                );
            }).toThrow('Pharmacist name is required');
        });

        it('should throw error with multiple validation failures', () => {
            const invalidOrder = { ...mockOrder, orderId: '', indication: '', tests: [] };
            const invalidPatient = { ...mockPatient, firstName: '' };

            expect(() => {
                service.validateGenerationRequirements(
                    invalidOrder as IManualLabOrder,
                    invalidPatient as IPatient,
                    mockWorkplace,
                    mockPharmacist
                );
            }).toThrow(/Order ID is required.*At least one test is required.*Clinical indication is required.*Patient name is required/);
        });
    });

    describe('getBrowserStatus', () => {
        it('should return disconnected status when browser is not initialized', async () => {
            const status = await service.getBrowserStatus();
            expect(status.isConnected).toBe(false);
            expect(status.version).toBeUndefined();
        });

        it('should return connected status with version when browser is active', async () => {
            // Mock browser initialization
            const mockBrowser = {
                version: jest.fn().mockResolvedValue('Chrome/91.0.4472.124'),
                close: jest.fn().mockResolvedValue(undefined)
            };

            const puppeteer = require('puppeteer');
            puppeteer.launch = jest.fn().mockResolvedValue(mockBrowser);

            // Initialize browser by calling a method that creates it
            await service['initializeBrowser']();

            const status = await service.getBrowserStatus();
            expect(status.isConnected).toBe(true);
            expect(status.version).toBe('Chrome/91.0.4472.124');
        });
    });

    describe('cleanup', () => {
        it('should close browser when cleanup is called', async () => {
            const mockBrowser = {
                close: jest.fn().mockResolvedValue(undefined),
                version: jest.fn().mockResolvedValue('Chrome/91.0.4472.124')
            };

            const puppeteer = require('puppeteer');
            puppeteer.launch = jest.fn().mockResolvedValue(mockBrowser);

            // Initialize browser
            await service['initializeBrowser']();

            // Cleanup
            await service.cleanup();

            expect(mockBrowser.close).toHaveBeenCalled();
        });

        it('should handle cleanup when browser is not initialized', async () => {
            // Should not throw error
            await expect(service.cleanup()).resolves.not.toThrow();
        });
    });

    describe('error handling', () => {
        it('should handle QR code generation failure', async () => {
            const QRCode = require('qrcode');
            QRCode.toDataURL = jest.fn().mockRejectedValue(new Error('QR generation failed'));

            await expect(
                service.generateRequisitionPDF(
                    mockOrder,
                    mockPatient,
                    mockWorkplace,
                    mockPharmacist
                )
            ).rejects.toThrow('PDF generation failed');
        });

        it('should handle barcode generation failure', async () => {
            const QRCode = require('qrcode');
            QRCode.toDataURL = jest.fn().mockResolvedValue('data:image/png;base64,mock-qr-code');

            const JsBarcode = require('jsbarcode');
            JsBarcode.mockImplementation(() => {
                throw new Error('Barcode generation failed');
            });

            await expect(
                service.generateRequisitionPDF(
                    mockOrder,
                    mockPatient,
                    mockWorkplace,
                    mockPharmacist
                )
            ).rejects.toThrow('PDF generation failed');
        });

        it('should handle template reading failure', async () => {
            const fs = require('fs/promises');
            fs.readFile = jest.fn().mockRejectedValue(new Error('Template not found'));

            await expect(
                service.generateRequisitionPDF(
                    mockOrder,
                    mockPatient,
                    mockWorkplace,
                    mockPharmacist
                )
            ).rejects.toThrow('PDF generation failed');
        });

        it('should handle Puppeteer failure', async () => {
            const puppeteer = require('puppeteer');
            puppeteer.launch = jest.fn().mockRejectedValue(new Error('Browser launch failed'));

            await expect(
                service.generateRequisitionPDF(
                    mockOrder,
                    mockPatient,
                    mockWorkplace,
                    mockPharmacist
                )
            ).rejects.toThrow('PDF generation failed');
        });

        it('should close page even when PDF generation fails', async () => {
            const mockPage = {
                setContent: jest.fn().mockResolvedValue(undefined),
                pdf: jest.fn().mockRejectedValue(new Error('PDF generation failed')),
                close: jest.fn().mockResolvedValue(undefined)
            };

            const mockBrowser = {
                newPage: jest.fn().mockResolvedValue(mockPage),
                close: jest.fn().mockResolvedValue(undefined)
            };

            const puppeteer = require('puppeteer');
            puppeteer.launch = jest.fn().mockResolvedValue(mockBrowser);

            const QRCode = require('qrcode');
            QRCode.toDataURL = jest.fn().mockResolvedValue('data:image/png;base64,mock-qr-code');

            const { createCanvas } = require('canvas');
            const mockCanvas = {
                toDataURL: jest.fn().mockReturnValue('data:image/png;base64,mock-barcode')
            };
            createCanvas.mockReturnValue(mockCanvas);

            const fs = require('fs/promises');
            fs.readFile = jest.fn().mockResolvedValue('<html><body>{{orderId}}</body></html>');

            await expect(
                service.generateRequisitionPDF(
                    mockOrder,
                    mockPatient,
                    mockWorkplace,
                    mockPharmacist
                )
            ).rejects.toThrow('PDF generation failed');

            expect(mockPage.close).toHaveBeenCalled();
        });
    });

    describe('template rendering', () => {
        it('should replace template variables correctly', async () => {
            const fs = require('fs/promises');
            fs.readFile = jest.fn().mockResolvedValue(`
        <div>Order: {{orderId}}</div>
        <div>Patient: {{patientName}}</div>
        <div>Pharmacy: {{pharmacyName}}</div>
        <div>Priority: {{priority}}</div>
      `);

            let capturedHtml = '';
            const mockPage = {
                setContent: jest.fn().mockImplementation((html) => {
                    capturedHtml = html;
                    return Promise.resolve();
                }),
                pdf: jest.fn().mockResolvedValue(Buffer.from('mock-pdf-content')),
                close: jest.fn().mockResolvedValue(undefined)
            };

            const mockBrowser = {
                newPage: jest.fn().mockResolvedValue(mockPage),
                close: jest.fn().mockResolvedValue(undefined)
            };

            const puppeteer = require('puppeteer');
            puppeteer.launch = jest.fn().mockResolvedValue(mockBrowser);

            await service.generateRequisitionPDF(
                mockOrder,
                mockPatient,
                mockWorkplace,
                mockPharmacist
            );

            expect(capturedHtml).toContain('Order: LAB-2024-0001');
            expect(capturedHtml).toContain('Patient: John Doe');
            expect(capturedHtml).toContain('Pharmacy: Central Pharmacy');
            expect(capturedHtml).toContain('Priority: routine');
        });
    });
});

describe('pdfGenerationService singleton', () => {
    it('should export a singleton instance', () => {
        expect(pdfGenerationService).toBeInstanceOf(PDFGenerationService);
    });

    it('should be the same instance when imported multiple times', () => {
        const { pdfGenerationService: service1 } = require('../services/pdfGenerationService');
        const { pdfGenerationService: service2 } = require('../services/pdfGenerationService');

        expect(service1).toBe(service2);
    });
});