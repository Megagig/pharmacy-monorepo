import { Request, Response, NextFunction } from 'express';
import { encryptionService } from '../services/encryptionService';
import logger from '../utils/logger';

/**
 * Interface for request with encryption context
 */
interface EncryptionRequest extends Request {
    encryptionContext?: {
        keyId: string;
        requiresEncryption: boolean;
        patientId?: string;
        conversationId?: string;
    };
}

/**
 * Middleware to handle automatic encryption of sensitive message content
 * Applies to routes that handle patient-related communications
 */
export const encryptMessageContent = async (
    req: EncryptionRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Check if this request contains message content that needs encryption
        const { body } = req;

        // Skip if no body or already processed
        if (!body || body._encrypted) {
            return next();
        }

        // Determine if encryption is required based on content and context
        const requiresEncryption = shouldEncryptContent(req);

        if (!requiresEncryption) {
            return next();
        }

        // Get or generate encryption key
        let keyId = req.encryptionContext?.keyId;
        if (!keyId) {
            keyId = encryptionService.getCurrentKeyId() || undefined;
            if (!keyId) {
                keyId = await encryptionService.generateEncryptionKey();
            }
        }

        // Encrypt sensitive fields in the request body
        if (body.content && typeof body.content === 'object') {
            // Encrypt text content
            if (body.content.text && typeof body.content.text === 'string') {
                body.content.text = await encryptionService.encryptMessage(body.content.text, keyId);
                body.content._encrypted = true;
                body.content._encryptionKeyId = keyId;
            }

            // Handle other sensitive fields if present
            if (body.content.clinicalNotes && typeof body.content.clinicalNotes === 'string') {
                body.content.clinicalNotes = await encryptionService.encryptMessage(body.content.clinicalNotes, keyId);
            }
        }

        // Encrypt direct text content
        if (body.text && typeof body.text === 'string') {
            body.text = await encryptionService.encryptMessage(body.text, keyId);
            body._encrypted = true;
            body._encryptionKeyId = keyId;
        }

        // Add encryption metadata to request context
        req.encryptionContext = {
            keyId,
            requiresEncryption: true,
            patientId: body.patientId || req.params.patientId,
            conversationId: body.conversationId || req.params.conversationId
        };

        logger.debug('Message content encrypted', {
            keyId,
            patientId: req.encryptionContext.patientId,
            conversationId: req.encryptionContext.conversationId,
            hasTextContent: !!body.content?.text || !!body.text
        });

        next();
    } catch (error) {
        logger.error('Encryption middleware error', {
            error: error instanceof Error ? error.message : error,
            path: req.path,
            method: req.method
        });

        res.status(500).json({
            success: false,
            error: 'Message encryption failed',
            code: 'ENCRYPTION_ERROR'
        });
    }
};

/**
 * Middleware to handle automatic decryption of message content for responses
 */
export const decryptMessageContent = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Store original json method
        const originalJson = res.json;

        // Override json method to decrypt content before sending
        res.json = function (body: any): Response {
            // Decrypt message content if present
            if (body && typeof body === 'object') {
                decryptResponseData(body)
                    .then((decryptedBody) => {
                        originalJson.call(this, decryptedBody);
                    })
                    .catch((error) => {
                        logger.error('Response decryption error', { error });
                        originalJson.call(this, {
                            success: false,
                            error: 'Message decryption failed',
                            code: 'DECRYPTION_ERROR'
                        });
                    });
            } else {
                originalJson.call(this, body);
            }
            return this;
        };

        next();
    } catch (error) {
        logger.error('Decryption middleware error', {
            error: error instanceof Error ? error.message : error,
            path: req.path,
            method: req.method
        });
        next(error);
    }
};

/**
 * Determine if content should be encrypted based on request context
 */
function shouldEncryptContent(req: EncryptionRequest): boolean {
    const { body, path, method } = req;

    // Always encrypt if explicitly marked
    if (req.encryptionContext?.requiresEncryption) {
        return true;
    }

    // Encrypt message content in communication endpoints
    if (path.includes('/api/messages') || path.includes('/api/conversations')) {
        return true;
    }

    // Encrypt if patient-related content is present
    if (body.patientId || req.params.patientId) {
        return true;
    }

    // Encrypt if content contains sensitive healthcare information
    if (body.content?.text || body.text) {
        const sensitiveKeywords = [
            'patient', 'diagnosis', 'medication', 'treatment', 'condition',
            'symptom', 'allergy', 'prescription', 'therapy', 'clinical'
        ];

        const textContent = (body.content?.text || body.text || '').toLowerCase();
        return sensitiveKeywords.some(keyword => textContent.includes(keyword));
    }

    return false;
}

/**
 * Recursively decrypt response data
 */
async function decryptResponseData(data: any): Promise<any> {
    if (!data || typeof data !== 'object') {
        return data;
    }

    if (Array.isArray(data)) {
        return Promise.all(data.map(item => decryptResponseData(item)));
    }

    const result = { ...data };

    // Decrypt message content
    if (result.content && typeof result.content === 'object') {
        if (result.content._encrypted && result.content.text) {
            try {
                result.content.text = await encryptionService.decryptMessage(
                    result.content.text,
                    result.content._encryptionKeyId
                );
                delete result.content._encrypted;
                delete result.content._encryptionKeyId;
            } catch (error) {
                logger.warn('Failed to decrypt message content', {
                    error: error instanceof Error ? error.message : error,
                    messageId: result._id
                });
                // Keep encrypted content if decryption fails
            }
        }

        if (result.content.clinicalNotes && result.content._encrypted) {
            try {
                result.content.clinicalNotes = await encryptionService.decryptMessage(
                    result.content.clinicalNotes,
                    result.content._encryptionKeyId
                );
            } catch (error) {
                logger.warn('Failed to decrypt clinical notes', {
                    error: error instanceof Error ? error.message : error,
                    messageId: result._id
                });
            }
        }
    }

    // Decrypt direct text content
    if (result._encrypted && result.text) {
        try {
            result.text = await encryptionService.decryptMessage(
                result.text,
                result._encryptionKeyId
            );
            delete result._encrypted;
            delete result._encryptionKeyId;
        } catch (error) {
            logger.warn('Failed to decrypt text content', {
                error: error instanceof Error ? error.message : error,
                messageId: result._id
            });
        }
    }

    // Recursively decrypt nested objects
    for (const key in result) {
        if (result.hasOwnProperty(key) && typeof result[key] === 'object') {
            result[key] = await decryptResponseData(result[key]);
        }
    }

    return result;
}

/**
 * Middleware to validate encryption requirements for HIPAA compliance
 */
export const validateEncryptionCompliance = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    try {
        const { body, path } = req;

        // Check if patient data is being transmitted without encryption
        if (body.patientId || req.params.patientId) {
            if (!body._encrypted && !body.content?._encrypted) {
                logger.warn('Patient data transmitted without encryption', {
                    path,
                    patientId: body.patientId || req.params.patientId,
                    hasContent: !!body.content || !!body.text
                });
            }
        }

        // Validate encryption key rotation
        if (body._encryptionKeyId) {
            const needsRotation = encryptionService.needsRotation(body._encryptionKeyId);
            if (needsRotation) {
                logger.info('Encryption key needs rotation', {
                    keyId: body._encryptionKeyId,
                    path
                });
            }
        }

        next();
    } catch (error) {
        logger.error('Encryption compliance validation error', {
            error: error instanceof Error ? error.message : error,
            path: req.path
        });
        next();
    }
};

/**
 * Error handler for encryption-related errors
 */
export const handleEncryptionError = (
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    if (error.message.includes('Encryption') || error.message.includes('Decryption')) {
        logger.error('Encryption service error', {
            error: error.message,
            path: req.path,
            method: req.method,
            timestamp: new Date().toISOString()
        });

        res.status(500).json({
            success: false,
            error: 'Secure communication service temporarily unavailable',
            code: 'ENCRYPTION_SERVICE_ERROR',
            timestamp: new Date().toISOString()
        });
    } else {
        next(error);
    }
};