import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { Types } from 'mongoose';
import logger from '../../../utils/logger';
import { ILabResult } from '../models/LabResult';
import { ILabOrder } from '../models/LabOrder';

export interface FHIRConfig {
    baseUrl: string;
    clientId?: string;
    clientSecret?: string;
    accessToken?: string;
    version: 'R4' | 'STU3' | 'DSTU2';
    timeout: number;
    retryAttempts: number;
}

export interface FHIRObservation {
    resourceType: 'Observation';
    id: string;
    status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';
    category?: Array<{
        coding: Array<{
            system: string;
            code: string;
            display: string;
        }>;
    }>;
    code: {
        coding: Array<{
            system: string;
            code: string;
            display: string;
        }>;
        text?: string;
    };
    subject: {
        reference: string;
        display?: string;
    };
    effectiveDateTime?: string;
    issued?: string;
    valueQuantity?: {
        value: number;
        unit: string;
        system: string;
        code: string;
    };
    valueString?: string;
    valueCodeableConcept?: {
        coding: Array<{
            system: string;
            code: string;
            display: string;
        }>;
        text?: string;
    };
    referenceRange?: Array<{
        low?: {
            value: number;
            unit: string;
            system: string;
            code: string;
        };
        high?: {
            value: number;
            unit: string;
            system: string;
            code: string;
        };
        type?: {
            coding: Array<{
                system: string;
                code: string;
                display: string;
            }>;
        };
        text?: string;
    }>;
    interpretation?: Array<{
        coding: Array<{
            system: string;
            code: string;
            display: string;
        }>;
        text?: string;
    }>;
    note?: Array<{
        text: string;
    }>;
    performer?: Array<{
        reference: string;
        display?: string;
    }>;
    device?: {
        reference: string;
        display?: string;
    };
}

export interface FHIRServiceRequest {
    resourceType: 'ServiceRequest';
    id: string;
    status: 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed' | 'entered-in-error' | 'unknown';
    intent: 'proposal' | 'plan' | 'directive' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
    priority?: 'routine' | 'urgent' | 'asap' | 'stat';
    code: {
        coding: Array<{
            system: string;
            code: string;
            display: string;
        }>;
        text?: string;
    };
    subject: {
        reference: string;
        display?: string;
    };
    authoredOn?: string;
    requester?: {
        reference: string;
        display?: string;
    };
    reasonCode?: Array<{
        coding: Array<{
            system: string;
            code: string;
            display: string;
        }>;
        text?: string;
    }>;
    note?: Array<{
        text: string;
    }>;
}

export interface FHIRBundle {
    resourceType: 'Bundle';
    id: string;
    type: 'document' | 'message' | 'transaction' | 'transaction-response' | 'batch' | 'batch-response' | 'history' | 'searchset' | 'collection';
    timestamp?: string;
    total?: number;
    entry: Array<{
        fullUrl?: string;
        resource: FHIRObservation | FHIRServiceRequest | any;
        search?: {
            mode: 'match' | 'include' | 'outcome';
            score?: number;
        };
    }>;
}

export interface PatientMapping {
    fhirPatientId: string;
    internalPatientId: string;
    workplaceId: string;
}

export interface FHIRImportResult {
    imported: Array<{
        fhirId: string;
        internalId: string;
        type: 'observation' | 'serviceRequest';
        status: 'success';
    }>;
    failed: Array<{
        fhirId: string;
        type: 'observation' | 'serviceRequest';
        status: 'failed';
        error: string;
        resource?: any;
    }>;
}

export interface FHIRAuthConfig {
    type: 'oauth2' | 'basic' | 'bearer' | 'none';
    tokenUrl?: string;
    clientId?: string;
    clientSecret?: string;
    scope?: string;
    username?: string;
    password?: string;
    bearerToken?: string;
}

export class FHIRService {
    private client: AxiosInstance;
    private config: FHIRConfig;
    private authConfig?: FHIRAuthConfig;
    private accessToken?: string;
    private tokenExpiry?: Date;

    constructor(config: FHIRConfig, authConfig?: FHIRAuthConfig) {
        this.config = config;
        this.authConfig = authConfig;

        this.client = axios.create({
            baseURL: config.baseUrl,
            timeout: config.timeout || 30000,
            headers: {
                'Content-Type': 'application/fhir+json',
                'Accept': 'application/fhir+json',
            },
        });

        // Add request interceptor for authentication
        this.client.interceptors.request.use(
            async (config) => {
                await this.ensureAuthenticated();
                if (this.accessToken) {
                    config.headers.Authorization = `Bearer ${this.accessToken}`;
                }
                return config;
            },
            (error) => {
                logger.error('FHIR request interceptor error:', error);
                return Promise.reject(error);
            }
        );

        // Add response interceptor for error handling
        this.client.interceptors.response.use(
            (response) => response,
            async (error) => {
                if (error.response?.status === 401 && this.authConfig) {
                    // Token expired, try to refresh
                    this.accessToken = undefined;
                    this.tokenExpiry = undefined;

                    // Retry the request once
                    if (!error.config._retry) {
                        error.config._retry = true;
                        await this.ensureAuthenticated();
                        if (this.accessToken) {
                            error.config.headers.Authorization = `Bearer ${this.accessToken}`;
                            return this.client.request(error.config);
                        }
                    }
                }

                logger.error('FHIR API error:', {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data,
                    url: error.config?.url,
                });

                return Promise.reject(error);
            }
        );
    }

    /**
     * Ensure we have a valid access token
     */
    private async ensureAuthenticated(): Promise<void> {
        if (!this.authConfig || this.authConfig.type === 'none') {
            return;
        }

        // Check if we have a valid token
        if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
            return;
        }

        try {
            switch (this.authConfig.type) {
                case 'oauth2':
                    await this.authenticateOAuth2();
                    break;
                case 'basic':
                    // Basic auth is handled in headers, no token needed
                    if (this.authConfig.username && this.authConfig.password) {
                        const credentials = Buffer.from(
                            `${this.authConfig.username}:${this.authConfig.password}`
                        ).toString('base64');
                        this.client.defaults.headers.Authorization = `Basic ${credentials}`;
                    }
                    break;
                case 'bearer':
                    if (this.authConfig.bearerToken) {
                        this.accessToken = this.authConfig.bearerToken;
                    }
                    break;
            }
        } catch (error) {
            logger.error('FHIR authentication failed:', error);
            throw new Error(`FHIR authentication failed: ${error}`);
        }
    }

    /**
     * Authenticate using OAuth2
     */
    private async authenticateOAuth2(): Promise<void> {
        if (!this.authConfig?.tokenUrl || !this.authConfig?.clientId || !this.authConfig?.clientSecret) {
            throw new Error('OAuth2 configuration incomplete');
        }

        try {
            const response = await axios.post(
                this.authConfig.tokenUrl,
                new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: this.authConfig.clientId,
                    client_secret: this.authConfig.clientSecret,
                    scope: this.authConfig.scope || 'system/*.read system/*.write',
                }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            this.accessToken = response.data.access_token;

            // Set token expiry (default to 1 hour if not provided)
            const expiresIn = response.data.expires_in || 3600;
            this.tokenExpiry = new Date(Date.now() + (expiresIn * 1000));

            logger.info('FHIR OAuth2 authentication successful', {
                tokenUrl: this.authConfig.tokenUrl,
                expiresIn,
            });
        } catch (error) {
            logger.error('OAuth2 authentication failed:', error);
            throw error;
        }
    }

    /**
     * Import lab results from FHIR bundle
     */
    async importLabResults(
        bundle: FHIRBundle,
        patientMappings: PatientMapping[]
    ): Promise<FHIRImportResult> {
        const result: FHIRImportResult = {
            imported: [],
            failed: [],
        };

        try {
            // Create patient mapping lookup
            const patientMap = new Map<string, PatientMapping>();
            patientMappings.forEach(mapping => {
                patientMap.set(mapping.fhirPatientId, mapping);
            });

            // Process each entry in the bundle
            for (const entry of bundle.entry) {
                try {
                    const resource = entry.resource;

                    if (resource.resourceType === 'Observation') {
                        const labResult = await this.processObservation(resource as FHIRObservation, patientMap);
                        if (labResult) {
                            result.imported.push({
                                fhirId: resource.id,
                                internalId: labResult._id.toString(),
                                type: 'observation',
                                status: 'success',
                            });
                        }
                    } else if (resource.resourceType === 'ServiceRequest') {
                        const labOrder = await this.processServiceRequest(resource as FHIRServiceRequest, patientMap);
                        if (labOrder) {
                            result.imported.push({
                                fhirId: resource.id,
                                internalId: labOrder._id.toString(),
                                type: 'serviceRequest',
                                status: 'success',
                            });
                        }
                    }
                } catch (error) {
                    logger.error('Failed to process FHIR resource:', error);
                    result.failed.push({
                        fhirId: entry.resource.id || 'unknown',
                        type: entry.resource.resourceType === 'Observation' ? 'observation' : 'serviceRequest',
                        status: 'failed',
                        error: error instanceof Error ? error.message : 'Unknown error',
                        resource: entry.resource,
                    });
                }
            }

            logger.info('FHIR bundle import completed', {
                bundleId: bundle.id,
                totalEntries: bundle.entry.length,
                imported: result.imported.length,
                failed: result.failed.length,
            });

            return result;
        } catch (error) {
            logger.error('Failed to import FHIR bundle:', error);
            throw new Error(`Failed to import FHIR bundle: ${error}`);
        }
    }

    /**
     * Process FHIR Observation resource
     */
    private async processObservation(
        observation: FHIRObservation,
        patientMap: Map<string, PatientMapping>
    ): Promise<ILabResult | null> {
        try {
            // Extract patient reference
            const patientRef = observation.subject.reference;
            const fhirPatientId = patientRef.replace(/^Patient\//, '');

            const patientMapping = patientMap.get(fhirPatientId);
            if (!patientMapping) {
                throw new Error(`No patient mapping found for FHIR patient ID: ${fhirPatientId}`);
            }

            // Extract test information
            const testCode = this.extractTestCode(observation.code);
            const testName = this.extractTestName(observation.code);
            const loincCode = this.extractLoincCode(observation.code);

            // Validate required fields
            if (!observation.code || testCode === 'UNKNOWN') {
                throw new Error('Missing or invalid test code in FHIR Observation');
            }

            // Extract result value
            const { value, unit, numericValue } = this.extractValue(observation);

            // Extract reference range
            const referenceRange = this.extractReferenceRange(observation);

            // Extract timing information
            const performedAt = observation.effectiveDateTime
                ? new Date(observation.effectiveDateTime)
                : new Date();
            const reportedAt = observation.issued
                ? new Date(observation.issued)
                : new Date();

            // Extract interpretation
            const interpretation = this.extractInterpretation(observation);

            // Create lab result data
            const labResultData = {
                patientId: new Types.ObjectId(patientMapping.internalPatientId),
                workplaceId: new Types.ObjectId(patientMapping.workplaceId),
                testCode,
                testName,
                testCategory: this.extractCategory(observation),
                loincCode,
                value,
                numericValue,
                unit,
                referenceRange,
                interpretation,
                flags: this.extractFlags(observation),
                source: 'fhir' as const,
                performedAt,
                reportedAt,
                recordedAt: new Date(),
                recordedBy: new Types.ObjectId(patientMapping.internalPatientId), // System user
                externalResultId: observation.id,
                fhirReference: `Observation/${observation.id}`,
                technicalNotes: this.extractNotes(observation),
                reviewStatus: observation.status === 'final' ? 'approved' : 'pending',
                // Required audit fields
                createdBy: new Types.ObjectId(patientMapping.internalPatientId),
                followUpRequired: false,
                criticalValue: interpretation === 'critical',
            };

            // Import using lab service
            const LabResult = (await import('../models/LabResult')).default;
            const labResult = new LabResult(labResultData);
            await labResult.save();

            logger.info('FHIR Observation imported successfully', {
                fhirId: observation.id,
                internalId: labResult._id,
                testCode,
                testName,
                patientId: patientMapping.internalPatientId,
            });

            return labResult;
        } catch (error) {
            logger.error('Failed to process FHIR Observation:', error);
            throw error;
        }
    }

    /**
     * Process FHIR ServiceRequest resource
     */
    private async processServiceRequest(
        serviceRequest: FHIRServiceRequest,
        patientMap: Map<string, PatientMapping>
    ): Promise<ILabOrder | null> {
        try {
            // Extract patient reference
            const patientRef = serviceRequest.subject.reference;
            const fhirPatientId = patientRef.replace(/^Patient\//, '');

            const patientMapping = patientMap.get(fhirPatientId);
            if (!patientMapping) {
                throw new Error(`No patient mapping found for FHIR patient ID: ${fhirPatientId}`);
            }

            // Extract test information
            const testCode = this.extractTestCode(serviceRequest.code);
            const testName = this.extractTestName(serviceRequest.code);
            const loincCode = this.extractLoincCode(serviceRequest.code);

            // Map FHIR priority to internal priority
            const priority = this.mapPriority(serviceRequest.priority);

            // Extract timing information
            const orderDate = serviceRequest.authoredOn
                ? new Date(serviceRequest.authoredOn)
                : new Date();

            // Map FHIR status to internal status
            const status = this.mapServiceRequestStatus(serviceRequest.status);

            // Create lab order data
            const labOrderData = {
                patientId: new Types.ObjectId(patientMapping.internalPatientId),
                orderedBy: new Types.ObjectId(patientMapping.internalPatientId), // System user
                workplaceId: new Types.ObjectId(patientMapping.workplaceId),
                tests: [{
                    code: testCode,
                    name: testName,
                    loincCode,
                    indication: this.extractIndication(serviceRequest),
                    priority,
                }],
                status,
                orderDate,
                externalOrderId: serviceRequest.id,
                fhirReference: `ServiceRequest/${serviceRequest.id}`,
                // Required fields
                clinicalIndication: this.extractIndication(serviceRequest),
                orderNumber: `FHIR-${serviceRequest.id}`,
                createdBy: new Types.ObjectId(patientMapping.internalPatientId),
            };

            // Import using lab service
            const LabOrder = (await import('../models/LabOrder')).default;
            const labOrder = new LabOrder(labOrderData);
            await labOrder.save();

            logger.info('FHIR ServiceRequest imported successfully', {
                fhirId: serviceRequest.id,
                internalId: labOrder._id,
                testCode,
                testName,
                patientId: patientMapping.internalPatientId,
            });

            return labOrder;
        } catch (error) {
            logger.error('Failed to process FHIR ServiceRequest:', error);
            throw error;
        }
    }

    /**
     * Export lab order as FHIR ServiceRequest
     */
    async exportLabOrder(labOrder: ILabOrder): Promise<FHIRServiceRequest> {
        try {
            const serviceRequest: FHIRServiceRequest = {
                resourceType: 'ServiceRequest',
                id: labOrder._id.toString(),
                status: this.mapInternalStatusToFHIR(labOrder.status),
                intent: 'order',
                priority: this.mapInternalPriorityToFHIR(labOrder.tests[0]?.priority || 'routine'),
                code: {
                    coding: labOrder.tests.map(test => ({
                        system: test.loincCode ? 'http://loinc.org' : 'http://terminology.hl7.org/CodeSystem/v2-0074',
                        code: test.loincCode || test.code,
                        display: test.name,
                    })),
                    text: labOrder.tests.map(test => test.name).join(', '),
                },
                subject: {
                    reference: `Patient/${labOrder.patientId}`,
                },
                authoredOn: labOrder.orderDate.toISOString(),
                requester: {
                    reference: `Practitioner/${labOrder.orderedBy}`,
                },
                reasonCode: labOrder.tests.map(test => ({
                    coding: [],
                    text: test.indication,
                })),
            };

            return serviceRequest;
        } catch (error) {
            logger.error('Failed to export lab order as FHIR ServiceRequest:', error);
            throw error;
        }
    }

    /**
     * Submit lab order to FHIR server
     */
    async submitLabOrder(serviceRequest: FHIRServiceRequest): Promise<string> {
        try {
            const response = await this.client.post('/ServiceRequest', serviceRequest);

            logger.info('Lab order submitted to FHIR server', {
                fhirId: response.data.id,
                status: response.status,
            });

            return response.data.id;
        } catch (error) {
            logger.error('Failed to submit lab order to FHIR server:', error);
            throw error;
        }
    }

    /**
     * Fetch lab results from FHIR server
     */
    async fetchLabResults(
        patientId: string,
        fromDate?: Date,
        toDate?: Date
    ): Promise<FHIRBundle> {
        try {
            const params = new URLSearchParams({
                'subject': `Patient/${patientId}`,
                'category': 'laboratory',
                '_sort': '-date',
            });

            if (fromDate) {
                params.append('date', `ge${fromDate.toISOString()}`);
            }
            if (toDate) {
                params.append('date', `le${toDate.toISOString()}`);
            }

            const response = await this.client.get(`/Observation?${params.toString()}`);

            logger.info('Lab results fetched from FHIR server', {
                patientId,
                resultCount: response.data.total || 0,
            });

            return response.data;
        } catch (error) {
            logger.error('Failed to fetch lab results from FHIR server:', error);
            throw error;
        }
    }

    /**
     * Test FHIR server connection
     */
    async testConnection(): Promise<boolean> {
        try {
            const response = await this.client.get('/metadata');

            logger.info('FHIR server connection test successful', {
                version: response.data.fhirVersion,
                software: response.data.software?.name,
            });

            return true;
        } catch (error) {
            logger.error('FHIR server connection test failed:', error);
            return false;
        }
    }

    // Helper methods for data extraction and mapping

    private extractTestCode(code: any): string {
        if (code && code.coding && code.coding.length > 0) {
            return code.coding[0]?.code || 'UNKNOWN';
        }
        return code?.text || 'UNKNOWN';
    }

    private extractTestName(code: any): string {
        if (code && code.coding && code.coding.length > 0) {
            return code.coding[0]?.display || code.coding[0]?.code || 'Unknown Test';
        }
        return code?.text || 'Unknown Test';
    }

    private extractLoincCode(code: any): string | undefined {
        if (code && code.coding) {
            const loincCoding = code.coding.find((c: any) =>
                c && c.system === 'http://loinc.org'
            );
            return loincCoding?.code;
        }
        return undefined;
    }

    private extractValue(observation: FHIRObservation): { value: string; unit?: string; numericValue?: number } {
        if (observation.valueQuantity) {
            return {
                value: observation.valueQuantity.value.toString(),
                unit: observation.valueQuantity.unit,
                numericValue: observation.valueQuantity.value,
            };
        }

        if (observation.valueString) {
            return {
                value: observation.valueString,
            };
        }

        if (observation.valueCodeableConcept) {
            return {
                value: observation.valueCodeableConcept.text ||
                    observation.valueCodeableConcept.coding[0]?.display ||
                    'Unknown',
            };
        }

        return { value: 'No value' };
    }

    private extractReferenceRange(observation: FHIRObservation): any {
        if (observation.referenceRange && observation.referenceRange.length > 0) {
            const range = observation.referenceRange[0];
            if (range) {
                return {
                    low: range.low?.value,
                    high: range.high?.value,
                    text: range.text,
                    unit: range.low?.unit || range.high?.unit,
                };
            }
        }
        return {};
    }

    private extractInterpretation(observation: FHIRObservation): 'low' | 'normal' | 'high' | 'critical' | 'abnormal' {
        if (observation.interpretation && observation.interpretation.length > 0) {
            const interp = observation.interpretation[0];
            if (interp && interp.coding && interp.coding.length > 0) {
                const coding = interp.coding[0];
                if (coding && coding.code) {
                    const code = coding.code.toLowerCase();
                    switch (code) {
                        case 'l':
                        case 'low':
                            return 'low';
                        case 'h':
                        case 'high':
                            return 'high';
                        case 'hh':
                        case 'll':
                        case 'critical':
                            return 'critical';
                        case 'n':
                        case 'normal':
                            return 'normal';
                        default:
                            return 'abnormal';
                    }
                }
            }
        }
        return 'normal';
    }

    private extractCategory(observation: FHIRObservation): string | undefined {
        if (observation.category && observation.category.length > 0) {
            const category = observation.category[0];
            if (category && category.coding && category.coding.length > 0) {
                const coding = category.coding[0];
                if (coding) {
                    return coding.display || coding.code;
                }
            }
        }
        return undefined;
    }

    private extractFlags(observation: FHIRObservation): string[] {
        const flags: string[] = [];

        if (observation.interpretation) {
            observation.interpretation.forEach(interp => {
                if (interp.text) {
                    flags.push(interp.text);
                }
            });
        }

        return flags;
    }

    private extractNotes(observation: FHIRObservation): string | undefined {
        if (observation.note && observation.note.length > 0) {
            return observation.note.map(note => note.text).join('; ');
        }
        return undefined;
    }

    private extractIndication(serviceRequest: FHIRServiceRequest): string {
        if (serviceRequest.reasonCode && serviceRequest.reasonCode.length > 0) {
            const reasonCode = serviceRequest.reasonCode[0];
            if (reasonCode) {
                return reasonCode.text ||
                    reasonCode.coding?.[0]?.display ||
                    'Clinical indication';
            }
        }
        return 'Clinical indication';
    }

    private mapPriority(fhirPriority?: string): 'stat' | 'urgent' | 'routine' {
        switch (fhirPriority) {
            case 'stat':
                return 'stat';
            case 'urgent':
            case 'asap':
                return 'urgent';
            default:
                return 'routine';
        }
    }

    private mapServiceRequestStatus(fhirStatus: string): 'ordered' | 'collected' | 'processing' | 'completed' | 'cancelled' {
        switch (fhirStatus) {
            case 'active':
            case 'draft':
                return 'ordered';
            case 'on-hold':
                return 'collected';
            case 'completed':
                return 'completed';
            case 'revoked':
            case 'entered-in-error':
                return 'cancelled';
            default:
                return 'ordered';
        }
    }

    private mapInternalStatusToFHIR(status: string): FHIRServiceRequest['status'] {
        switch (status) {
            case 'ordered':
                return 'active';
            case 'collected':
                return 'on-hold';
            case 'processing':
                return 'active';
            case 'completed':
                return 'completed';
            case 'cancelled':
                return 'revoked';
            default:
                return 'unknown';
        }
    }

    private mapInternalPriorityToFHIR(priority: string): FHIRServiceRequest['priority'] {
        switch (priority) {
            case 'stat':
                return 'stat';
            case 'urgent':
                return 'urgent';
            default:
                return 'routine';
        }
    }
}

export default FHIRService;