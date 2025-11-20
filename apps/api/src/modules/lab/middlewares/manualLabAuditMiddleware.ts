import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../../middlewares/auth';
import ManualLabAuditService from '../services/manualLabAuditService';
import ManualLabSecurityService from '../services/manualLabSecurityService';
import logger from '../../../utils/logger';
import { Types } from 'mongoose';
import { AuditService } from '../../../services/auditService';

/**
 * Enhanced audit middleware for manual lab operations
 */

/**
 * Audit middleware for PDF access tracking
 */
export const auditPDFAccess = (req: AuthRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const orderId = req.params.orderId;
    if (!orderId) {
        res.status(400).json({
            success: false,
            message: 'Order ID is required',
            code: 'VALIDATION_ERROR',
        });
        return;
    }

    // Override res.send to capture response details
    const originalSend = res.send;
    res.send = function (body: any) {
        const endTime = Date.now();
        const accessDuration = endTime - startTime;

        // Log PDF access asynchronously
        setImmediate(async () => {
            try {
                if (res.statusCode === 200 && req.user) {
                    const auditContext = {
                        userId: req.user._id.toString(),
                        workspaceId: req.user.workplaceId!.toString(),
                        sessionId: (req as any).sessionID,
                        ipAddress: req.ip,
                        userAgent: req.get('User-Agent')
                    };

                    // Determine download method based on referrer
                    let downloadMethod: 'direct_link' | 'qr_scan' | 'barcode_scan' = 'direct_link';
                    const referrer = req.get('Referer') || '';
                    if (referrer.includes('scan')) {
                        downloadMethod = referrer.includes('qr') ? 'qr_scan' : 'barcode_scan';
                    }

                    await ManualLabAuditService.logPDFAccess(auditContext, {
                        orderId: orderId as string,
                        patientId: req.body?.patientId || req.query?.patientId,
                        fileName: `lab_requisition_${orderId}.pdf`,
                        fileSize: Buffer.isBuffer(body) ? body.length : 0,
                        downloadMethod,
                        accessDuration,
                        userAgent: req.get('User-Agent'),
                        referrer: req.get('Referer')
                    });
                }
            } catch (error) {
                logger.error('Failed to audit PDF access in middleware', {
                    orderId,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    service: 'manual-lab-audit-middleware'
                });
            }
        });

        return originalSend.call(this, body);
    };

    next();
};

/**
 * Audit middleware for result entry operations
 */
export const auditResultEntry = (req: AuthRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const orderId = req.params.orderId;

    // Store original response data
    const originalJson = res.json;
    res.json = function (body: any) {
        const endTime = Date.now();
        const entryDuration = endTime - startTime;

        // Log result entry asynchronously
        setImmediate(async () => {
            try {
                if (res.statusCode === 201 && req.user && body.success) {
                    const result = body.data?.result;
                    if (result) {
                        const auditContext = {
                            userId: req.user._id.toString(),
                            workspaceId: req.user.workplaceId!.toString(),
                            sessionId: (req as any).sessionID,
                            ipAddress: req.ip,
                            userAgent: req.get('User-Agent')
                        };

                        // Count abnormal and critical results
                        const abnormalCount = result.values?.filter((v: any) => v.abnormalFlag).length || 0;
                        const criticalCount = result.criticalResults?.length || 0;

                        await ManualLabAuditService.logResultEntry(auditContext, result, {
                            orderId: orderId as string,
                            patientId: req.body?.patientId,
                            testCount: result.values?.length || 0,
                            abnormalResultCount: abnormalCount,
                            criticalResultCount: criticalCount,
                            entryDuration,
                            validationErrors: req.body?.validationErrors,
                            aiProcessingTriggered: result.aiProcessed || false
                        });
                    }
                }
            } catch (error) {
                logger.error('Failed to audit result entry in middleware', {
                    orderId,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    service: 'manual-lab-audit-middleware'
                });
            }
        });

        return originalJson.call(this, body);
    };

    next();
};

/**
 * Audit middleware for status changes
 */
export const auditStatusChange = (req: AuthRequest, res: Response, next: NextFunction) => {
    const orderId = req.params.orderId;
    const { status: newStatus } = req.body;

    // Capture original response
    const originalJson = res.json;
    res.json = function (body: any) {
        // Log status change asynchronously
        setImmediate(async () => {
            try {
                if (res.statusCode === 200 && req.user && body.success) {
                    const auditContext = {
                        userId: req.user._id.toString(),
                        workspaceId: req.user.workplaceId!.toString(),
                        sessionId: (req as any).sessionID,
                        ipAddress: req.ip,
                        userAgent: req.get('User-Agent')
                    };

                    const { previousStatus } = body.data;

                    await ManualLabAuditService.logStatusChange(
                        auditContext,
                        orderId as string,
                        previousStatus,
                        newStatus
                    );
                }
            } catch (error) {
                logger.error('Failed to audit status change in middleware', {
                    orderId,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    service: 'manual-lab-audit-middleware'
                });
            }
        });

        return originalJson.call(this, body);
    };

    next();
};

/**
 * Audit middleware for token resolution
 */
export const auditTokenResolution = (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.query.token as string;

    // Override response to capture token resolution result
    const originalJson = res.json;
    res.json = function (body: any) {
        // Log token resolution asynchronously
        setImmediate(async () => {
            try {
                if (req.user) {
                    const auditContext = {
                        userId: req.user._id.toString(),
                        workspaceId: req.user.workplaceId!.toString(),
                        sessionId: (req as any).sessionID,
                        ipAddress: req.ip,
                        userAgent: req.get('User-Agent')
                    };

                    const success = res.statusCode === 200 && body.success;
                    const orderId = body.data?.order?.orderId || 'unknown';
                    const errorReason = !success ? body.error?.message : undefined;

                    // Determine token type based on request characteristics
                    let tokenType: 'qr_code' | 'barcode' | 'manual_entry' = 'manual_entry';
                    const userAgent = req.get('User-Agent') || '';
                    if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
                        tokenType = 'qr_code'; // Assume mobile devices use QR codes
                    }

                    await ManualLabAuditService.logTokenResolution(
                        auditContext,
                        orderId as string,
                        tokenType,
                        success,
                        errorReason
                    );
                }
            } catch (error) {
                logger.error('Failed to audit token resolution in middleware', {
                    token: token ? 'present' : 'missing',
                    error: error instanceof Error ? error.message : 'Unknown error',
                    service: 'manual-lab-audit-middleware'
                });
            }
        });

        return originalJson.call(this, body);
    };

    next();
};

/**
 * General audit middleware for all manual lab operations
 */
export const auditManualLabOperation = (operationType: string) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        const startTime = Date.now();

        // Log operation start
        logger.info('Manual lab operation started', {
            operationType,
            orderId: req.params.orderId,
            userId: req.user?._id,
            method: req.method,
            url: req.originalUrl,
            service: 'manual-lab-audit-middleware'
        });

        // Perform security analysis
        if (req.user) {
            try {
                const auditContext = {
                    userId: req.user._id.toString(),
                    workspaceId: req.user.workplaceId!.toString(),
                    sessionId: (req as any).sessionID,
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent')
                };

                const threats = await ManualLabSecurityService.analyzeRequest(auditContext, {
                    method: req.method,
                    url: req.originalUrl,
                    body: req.body,
                    query: req.query,
                    headers: req.headers
                });

                // Block request if critical threats detected
                const criticalThreats = threats.filter(t => t.severity === 'critical');
                if (criticalThreats.length > 0) {
                    logger.error('Critical security threat detected - blocking request', {
                        userId: req.user._id,
                        threats: criticalThreats,
                        service: 'manual-lab-audit-middleware'
                    });

                    return res.status(403).json({
                        success: false,
                        code: 'SECURITY_THREAT_DETECTED',
                        message: 'Request blocked due to security threat detection'
                    });
                }
            } catch (error) {
                logger.error('Security analysis failed', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    userId: req.user._id,
                    service: 'manual-lab-audit-middleware'
                });
            }
        }

        // Override response to capture operation completion
        const originalJson = res.json;
        res.json = function (body: any) {
            const endTime = Date.now();
            const duration = endTime - startTime;

            // Log operation completion
            logger.info('Manual lab operation completed', {
                operationType,
                orderId: req.params.orderId,
                userId: req.user?._id,
                statusCode: res.statusCode,
                duration,
                success: body.success,
                service: 'manual-lab-audit-middleware'
            });

            return originalJson.call(this, body);
        };

        next();
        return;
    };
};

/**
 * Compliance monitoring middleware
 */
export const monitorCompliance = (req: AuthRequest, res: Response, next: NextFunction) => {
    // Check for compliance violations
    const violations: string[] = [];

    // Check for required headers
    if (!req.get('User-Agent')) {
        violations.push('missing_user_agent');
    }

    // Check for suspicious patterns
    if (req.originalUrl.includes('pdf') && !req.get('Referer')) {
        violations.push('direct_pdf_access');
    }

    // Check for rapid requests (simplified)
    const lastRequestTime = (req as any).session?.lastManualLabRequest;
    const currentTime = Date.now();
    if (lastRequestTime && (currentTime - lastRequestTime) < 1000) { // Less than 1 second
        violations.push('rapid_requests');
    }
    if ((req as any).session) {
        (req as any).session.lastManualLabRequest = currentTime;
    }

    // Log violations if any
    if (violations.length > 0) {
        logger.warn('Compliance violations detected', {
            violations,
            userId: req.user?._id,
            url: req.originalUrl,
            service: 'manual-lab-audit-middleware'
        });

        // Log compliance violation asynchronously
        setImmediate(async () => {
            try {
                if (req.user) {
                    const auditContext = {
                        userId: req.user._id,
                        workplaceId: req.user.workplaceId!,
                        userRole: req.user.role,
                        sessionId: (req as any).sessionID,
                        ipAddress: req.ip,
                        userAgent: req.get('User-Agent'),
                        requestMethod: req.method,
                        requestUrl: req.originalUrl
                    };

                    await AuditService.logActivity(auditContext, {
                        action: 'MANUAL_LAB_COMPLIANCE_VIOLATION',
                        resourceType: 'System',
                        resourceId: req.user._id,
                        details: {
                            violations,
                            url: req.originalUrl,
                            method: req.method,
                            timestamp: new Date()
                        },
                        complianceCategory: 'workflow_compliance',
                        riskLevel: violations.length > 2 ? 'high' : 'medium'
                    });
                }
            } catch (error) {
                logger.error('Failed to log compliance violation', {
                    violations,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    service: 'manual-lab-audit-middleware'
                });
            }
        });
    }

    next();
};

