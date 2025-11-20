import mongoose from 'mongoose';
import logger from '../utils/logger';

export interface IndexCreationResult {
  collection: string;
  indexSpec: Record<string, 1 | -1>;
  created: boolean;
  error?: string;
  executionTime: number;
}

export interface DatabaseOptimizationSummary {
  totalIndexes: number;
  successfulIndexes: number;
  failedIndexes: number;
  results: IndexCreationResult[];
  executionTime: number;
  timestamp: Date;
}

/**
 * Performance Database Optimizer for PharmacyCopilot application
 * Creates optimized indexes for high-frequency queries across all collections
 */
class PerformanceDatabaseOptimizer {
  private static instance: PerformanceDatabaseOptimizer;

  private constructor() {}

  public static getInstance(): PerformanceDatabaseOptimizer {
    if (!PerformanceDatabaseOptimizer.instance) {
      PerformanceDatabaseOptimizer.instance = new PerformanceDatabaseOptimizer();
    }
    return PerformanceDatabaseOptimizer.instance;
  }

  /**
   * Create all optimized indexes for the application
   */
  public async createAllOptimizedIndexes(): Promise<DatabaseOptimizationSummary> {
    const startTime = Date.now();
    const results: IndexCreationResult[] = [];

    logger.info('Starting comprehensive database index optimization');

    try {
      // Create indexes for each collection
      const indexCreationPromises = [
        this.createPatientIndexes(),
        this.createClinicalNotesIndexes(),
        this.createMedicationIndexes(),
        this.createUserIndexes(),
        this.createWorkspaceIndexes(),
        this.createAuditLogIndexes(),
        this.createMTRIndexes(),
        this.createClinicalInterventionIndexes(),
        this.createCommunicationIndexes(),
        this.createNotificationIndexes(),
        this.createReportsIndexes(),
      ];

      const allResults = await Promise.allSettled(indexCreationPromises);
      
      // Flatten results
      allResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(...result.value);
        } else {
          logger.error(`Index creation failed for collection group ${index}:`, result.reason);
        }
      });

      const executionTime = Date.now() - startTime;
      const successfulIndexes = results.filter(r => r.created).length;
      const failedIndexes = results.filter(r => !r.created).length;

      const summary: DatabaseOptimizationSummary = {
        totalIndexes: results.length,
        successfulIndexes,
        failedIndexes,
        results,
        executionTime,
        timestamp: new Date(),
      };

      logger.info('Database index optimization completed', {
        totalIndexes: summary.totalIndexes,
        successful: successfulIndexes,
        failed: failedIndexes,
        executionTime: `${executionTime}ms`,
      });

      return summary;

    } catch (error) {
      logger.error('Error during database optimization:', error);
      throw error;
    }
  }

  /**
   * Create optimized indexes for Patient collection
   */
  private async createPatientIndexes(): Promise<IndexCreationResult[]> {
    const results: IndexCreationResult[] = [];
    
    try {
      const Patient = mongoose.model('Patient');
      
      const indexes = [
        // Workspace isolation and basic queries
        { workspaceId: 1, createdAt: -1 },
        { workspaceId: 1, updatedAt: -1 },
        
        // Name-based searches (compound for full name search)
        { workspaceId: 1, 'personalInfo.firstName': 1, 'personalInfo.lastName': 1 },
        { workspaceId: 1, 'personalInfo.lastName': 1, 'personalInfo.firstName': 1 },
        
        // Contact information searches
        { workspaceId: 1, 'contactInfo.email': 1 },
        { workspaceId: 1, 'contactInfo.phone': 1 },
        
        // Medical record number and identifiers
        { workspaceId: 1, 'medicalInfo.medicalRecordNumber': 1 },
        { workspaceId: 1, 'identifiers.value': 1, 'identifiers.type': 1 },
        
        // Demographics and filtering
        { workspaceId: 1, 'personalInfo.dateOfBirth': 1 },
        { workspaceId: 1, 'personalInfo.gender': 1 },
        { workspaceId: 1, 'medicalInfo.primaryPhysician': 1 },
        
        // Status and active patient queries
        { workspaceId: 1, status: 1, updatedAt: -1 },
        { workspaceId: 1, isActive: 1, updatedAt: -1 },
        
        // Insurance and billing
        { workspaceId: 1, 'insuranceInfo.primaryInsurance.provider': 1 },
        { workspaceId: 1, 'insuranceInfo.primaryInsurance.policyNumber': 1 },
        
        // Text search support (for search functionality)
        { workspaceId: 1, '$**': 'text' },
      ];

      for (const indexSpec of indexes) {
        const result = await this.createSingleIndex('patients', Patient.collection, indexSpec);
        results.push(result);
      }

    } catch (error) {
      logger.error('Error creating patient indexes:', error);
    }

    return results;
  }

  /**
   * Create optimized indexes for Clinical Notes collection
   */
  private async createClinicalNotesIndexes(): Promise<IndexCreationResult[]> {
    const results: IndexCreationResult[] = [];
    
    try {
      const ClinicalNote = mongoose.model('ClinicalNote');
      
      const indexes = [
        // Patient-specific queries (most common)
        { patientId: 1, createdAt: -1 },
        { patientId: 1, updatedAt: -1 },
        { patientId: 1, noteType: 1, createdAt: -1 },
        
        // Workspace isolation
        { workspaceId: 1, createdAt: -1 },
        { workspaceId: 1, patientId: 1, createdAt: -1 },
        
        // Author and provider queries
        { authorId: 1, createdAt: -1 },
        { workspaceId: 1, authorId: 1, createdAt: -1 },
        
        // Note type and category filtering
        { workspaceId: 1, noteType: 1, createdAt: -1 },
        { workspaceId: 1, category: 1, createdAt: -1 },
        
        // Status and workflow queries
        { workspaceId: 1, status: 1, createdAt: -1 },
        { patientId: 1, status: 1, createdAt: -1 },
        
        // Date range queries (common for reports)
        { workspaceId: 1, dateOfService: -1 },
        { patientId: 1, dateOfService: -1 },
        
        // Priority and urgent notes
        { workspaceId: 1, priority: 1, createdAt: -1 },
        { patientId: 1, priority: 1, createdAt: -1 },
        
        // Template-based notes
        { workspaceId: 1, templateId: 1, createdAt: -1 },
        
        // Text search for note content
        { workspaceId: 1, '$**': 'text' },
      ];

      for (const indexSpec of indexes) {
        const result = await this.createSingleIndex('clinicalnotes', ClinicalNote.collection, indexSpec);
        results.push(result);
      }

    } catch (error) {
      logger.error('Error creating clinical notes indexes:', error);
    }

    return results;
  }

  /**
   * Create optimized indexes for Medication collection
   */
  private async createMedicationIndexes(): Promise<IndexCreationResult[]> {
    const results: IndexCreationResult[] = [];
    
    try {
      const Medication = mongoose.model('Medication');
      
      const indexes = [
        // Patient-specific medication queries
        { patientId: 1, isActive: 1 },
        { patientId: 1, createdAt: -1 },
        { patientId: 1, status: 1, createdAt: -1 },
        
        // Workspace isolation
        { workspaceId: 1, isActive: 1 },
        { workspaceId: 1, createdAt: -1 },
        
        // Drug identification (RxCUI is key for drug info)
        { rxcui: 1 },
        { workspaceId: 1, rxcui: 1 },
        { patientId: 1, rxcui: 1 },
        
        // Medication name searches
        { workspaceId: 1, 'medication.name': 1 },
        { patientId: 1, 'medication.name': 1 },
        
        // Prescriber queries
        { workspaceId: 1, prescriberId: 1, createdAt: -1 },
        { patientId: 1, prescriberId: 1 },
        
        // Date-based queries (start/end dates)
        { patientId: 1, startDate: -1 },
        { patientId: 1, endDate: -1 },
        { workspaceId: 1, startDate: -1 },
        
        // Medication type and category
        { workspaceId: 1, 'medication.type': 1, isActive: 1 },
        { patientId: 1, 'medication.category': 1, isActive: 1 },
        
        // Dosage and frequency (for clinical decision support)
        { patientId: 1, 'dosage.strength': 1, isActive: 1 },
        { patientId: 1, 'dosage.frequency': 1, isActive: 1 },
        
        // Interaction checking (by drug class/category)
        { 'medication.drugClass': 1, isActive: 1 },
        { patientId: 1, 'medication.drugClass': 1, isActive: 1 },
        
        // Adherence tracking
        { patientId: 1, 'adherence.lastReported': -1 },
        { workspaceId: 1, 'adherence.adherenceRate': 1 },
      ];

      for (const indexSpec of indexes) {
        const result = await this.createSingleIndex('medications', Medication.collection, indexSpec);
        results.push(result);
      }

    } catch (error) {
      logger.error('Error creating medication indexes:', error);
    }

    return results;
  }

  /**
   * Create optimized indexes for User collection
   */
  private async createUserIndexes(): Promise<IndexCreationResult[]> {
    const results: IndexCreationResult[] = [];
    
    try {
      const User = mongoose.model('User');
      
      const indexes = [
        // Authentication and login
        { email: 1 }, // Should be unique
        { workspaceId: 1, email: 1 },
        
        // Role-based queries
        { workspaceId: 1, role: 1 },
        { workspaceId: 1, role: 1, isActive: 1 },
        
        // Status and active user queries
        { workspaceId: 1, isActive: 1, createdAt: -1 },
        { isActive: 1, lastLoginAt: -1 },
        
        // Profile and name searches
        { workspaceId: 1, firstName: 1, lastName: 1 },
        { workspaceId: 1, lastName: 1, firstName: 1 },
        
        // License and professional info
        { workspaceId: 1, licenseNumber: 1 },
        { workspaceId: 1, profession: 1, isActive: 1 },
        
        // Department and organizational queries
        { workspaceId: 1, department: 1, isActive: 1 },
        { workspaceId: 1, supervisor: 1 },
        
        // Session and security
        { 'sessions.token': 1 },
        { 'sessions.expiresAt': 1 },
        
        // Invitation and onboarding
        { invitationToken: 1 },
        { invitationExpiresAt: 1 },
      ];

      for (const indexSpec of indexes) {
        const result = await this.createSingleIndex('users', User.collection, indexSpec);
        results.push(result);
      }

    } catch (error) {
      logger.error('Error creating user indexes:', error);
    }

    return results;
  }

  /**
   * Create optimized indexes for Workspace collection
   */
  private async createWorkspaceIndexes(): Promise<IndexCreationResult[]> {
    const results: IndexCreationResult[] = [];
    
    try {
      const Workplace = mongoose.model('Workplace');
      
      const indexes = [
        // Basic workspace queries
        { isActive: 1, createdAt: -1 },
        { name: 1, isActive: 1 },
        
        // Owner and admin queries
        { ownerId: 1, isActive: 1 },
        { 'admins.userId': 1 },
        
        // Subscription and billing
        { 'subscription.planId': 1, isActive: 1 },
        { 'subscription.status': 1, isActive: 1 },
        { 'subscription.expiresAt': 1 },
        
        // Settings and configuration
        { 'settings.timezone': 1 },
        { 'settings.features': 1 },
        
        // License and compliance
        { licenseType: 1, isActive: 1 },
        { complianceStatus: 1, isActive: 1 },
      ];

      for (const indexSpec of indexes) {
        const result = await this.createSingleIndex('workplaces', Workplace.collection, indexSpec);
        results.push(result);
      }

    } catch (error) {
      logger.error('Error creating workspace indexes:', error);
    }

    return results;
  }

  /**
   * Create optimized indexes for Audit Log collection
   */
  private async createAuditLogIndexes(): Promise<IndexCreationResult[]> {
    const results: IndexCreationResult[] = [];
    
    try {
      const AuditLog = mongoose.model('AuditLog');
      
      const indexes = [
        // Time-based queries (most common for audit logs)
        { timestamp: -1 },
        { workspaceId: 1, timestamp: -1 },
        
        // User activity tracking
        { userId: 1, timestamp: -1 },
        { workspaceId: 1, userId: 1, timestamp: -1 },
        
        // Action-based queries
        { action: 1, timestamp: -1 },
        { workspaceId: 1, action: 1, timestamp: -1 },
        
        // Resource-specific auditing
        { resourceType: 1, resourceId: 1, timestamp: -1 },
        { workspaceId: 1, resourceType: 1, timestamp: -1 },
        
        // Security and compliance queries
        { severity: 1, timestamp: -1 },
        { category: 1, timestamp: -1 },
        { workspaceId: 1, category: 1, timestamp: -1 },
        
        // IP and session tracking
        { ipAddress: 1, timestamp: -1 },
        { sessionId: 1, timestamp: -1 },
        
        // Result and status queries
        { result: 1, timestamp: -1 },
        { workspaceId: 1, result: 1, timestamp: -1 },
      ];

      for (const indexSpec of indexes) {
        const result = await this.createSingleIndex('auditlogs', AuditLog.collection, indexSpec);
        results.push(result);
      }

    } catch (error) {
      logger.error('Error creating audit log indexes:', error);
    }

    return results;
  }

  /**
   * Create optimized indexes for MTR (Medication Therapy Review) collection
   */
  private async createMTRIndexes(): Promise<IndexCreationResult[]> {
    const results: IndexCreationResult[] = [];
    
    try {
      const MTR = mongoose.model('MedicationTherapyReview');
      
      const indexes = [
        // Patient-specific MTR queries
        { patientId: 1, createdAt: -1 },
        { patientId: 1, status: 1, createdAt: -1 },
        
        // Workspace isolation
        { workspaceId: 1, createdAt: -1 },
        { workspaceId: 1, status: 1, createdAt: -1 },
        
        // Pharmacist and reviewer queries
        { pharmacistId: 1, createdAt: -1 },
        { workspaceId: 1, pharmacistId: 1, createdAt: -1 },
        
        // Review type and category
        { reviewType: 1, createdAt: -1 },
        { workspaceId: 1, reviewType: 1, createdAt: -1 },
        
        // Date-based queries (review dates, due dates)
        { reviewDate: -1 },
        { nextReviewDate: -1 },
        { workspaceId: 1, nextReviewDate: -1 },
        
        // Priority and urgency
        { priority: 1, createdAt: -1 },
        { workspaceId: 1, priority: 1, createdAt: -1 },
        
        // Completion and follow-up tracking
        { completedAt: -1 },
        { workspaceId: 1, completedAt: -1 },
        { followUpRequired: 1, nextReviewDate: -1 },
      ];

      for (const indexSpec of indexes) {
        const result = await this.createSingleIndex('medicationtherapyreviews', MTR.collection, indexSpec);
        results.push(result);
      }

    } catch (error) {
      logger.error('Error creating MTR indexes:', error);
    }

    return results;
  }

  /**
   * Create optimized indexes for Clinical Intervention collection
   */
  private async createClinicalInterventionIndexes(): Promise<IndexCreationResult[]> {
    const results: IndexCreationResult[] = [];
    
    try {
      const ClinicalIntervention = mongoose.model('ClinicalIntervention');
      
      const indexes = [
        // Patient-specific interventions
        { patientId: 1, createdAt: -1 },
        { patientId: 1, status: 1, createdAt: -1 },
        
        // Workspace isolation
        { workspaceId: 1, createdAt: -1 },
        { workspaceId: 1, status: 1, createdAt: -1 },
        
        // Intervention type and category
        { interventionType: 1, createdAt: -1 },
        { workspaceId: 1, interventionType: 1, createdAt: -1 },
        
        // Priority and severity
        { priority: 1, createdAt: -1 },
        { severity: 1, createdAt: -1 },
        { workspaceId: 1, priority: 1, severity: 1 },
        
        // Pharmacist and provider queries
        { pharmacistId: 1, createdAt: -1 },
        { providerId: 1, createdAt: -1 },
        { workspaceId: 1, pharmacistId: 1, createdAt: -1 },
        
        // Outcome and resolution tracking
        { outcome: 1, createdAt: -1 },
        { resolvedAt: -1 },
        { workspaceId: 1, outcome: 1, resolvedAt: -1 },
        
        // Follow-up and monitoring
        { followUpRequired: 1, followUpDate: -1 },
        { workspaceId: 1, followUpRequired: 1 },
      ];

      for (const indexSpec of indexes) {
        const result = await this.createSingleIndex('clinicalinterventions', ClinicalIntervention.collection, indexSpec);
        results.push(result);
      }

    } catch (error) {
      logger.error('Error creating clinical intervention indexes:', error);
    }

    return results;
  }

  /**
   * Create optimized indexes for Communication collection
   */
  private async createCommunicationIndexes(): Promise<IndexCreationResult[]> {
    const results: IndexCreationResult[] = [];
    
    try {
      const Message = mongoose.model('Message');
      
      const indexes = [
        // Conversation-based queries
        { conversationId: 1, createdAt: -1 },
        { conversationId: 1, messageType: 1, createdAt: -1 },
        
        // Workspace isolation
        { workspaceId: 1, createdAt: -1 },
        
        // Sender and recipient queries
        { senderId: 1, createdAt: -1 },
        { recipientId: 1, createdAt: -1 },
        { workspaceId: 1, senderId: 1, createdAt: -1 },
        
        // Message status and read tracking
        { recipientId: 1, isRead: 1, createdAt: -1 },
        { conversationId: 1, isRead: 1 },
        
        // Message type and priority
        { messageType: 1, createdAt: -1 },
        { priority: 1, createdAt: -1 },
        { workspaceId: 1, messageType: 1, createdAt: -1 },
        
        // Patient-related communications
        { patientId: 1, createdAt: -1 },
        { workspaceId: 1, patientId: 1, createdAt: -1 },
        
        // Attachment and file queries
        { hasAttachments: 1, createdAt: -1 },
        { 'attachments.fileType': 1 },
      ];

      for (const indexSpec of indexes) {
        const result = await this.createSingleIndex('messages', Message.collection, indexSpec);
        results.push(result);
      }

    } catch (error) {
      logger.error('Error creating communication indexes:', error);
    }

    return results;
  }

  /**
   * Create optimized indexes for Notification collection
   */
  private async createNotificationIndexes(): Promise<IndexCreationResult[]> {
    const results: IndexCreationResult[] = [];
    
    try {
      const Notification = mongoose.model('Notification');
      
      const indexes = [
        // User-specific notifications
        { userId: 1, createdAt: -1 },
        { userId: 1, isRead: 1, createdAt: -1 },
        
        // Workspace isolation
        { workspaceId: 1, createdAt: -1 },
        { workspaceId: 1, userId: 1, createdAt: -1 },
        
        // Notification type and category
        { type: 1, createdAt: -1 },
        { category: 1, createdAt: -1 },
        { workspaceId: 1, type: 1, createdAt: -1 },
        
        // Priority and urgency
        { priority: 1, createdAt: -1 },
        { userId: 1, priority: 1, isRead: 1 },
        
        // Delivery and status tracking
        { deliveryStatus: 1, createdAt: -1 },
        { scheduledFor: -1 },
        { expiresAt: -1 },
        
        // Patient-related notifications
        { patientId: 1, createdAt: -1 },
        { userId: 1, patientId: 1, createdAt: -1 },
      ];

      for (const indexSpec of indexes) {
        const result = await this.createSingleIndex('notifications', Notification.collection, indexSpec);
        results.push(result);
      }

    } catch (error) {
      logger.error('Error creating notification indexes:', error);
    }

    return results;
  }

  /**
   * Create optimized indexes for Reports collection
   */
  private async createReportsIndexes(): Promise<IndexCreationResult[]> {
    const results: IndexCreationResult[] = [];
    
    try {
      // Try different possible report model names
      const reportModels = ['Report', 'ReportTemplate', 'ReportSchedule'];
      
      for (const modelName of reportModels) {
        try {
          const ReportModel = mongoose.model(modelName);
          
          const indexes = [
            // Workspace isolation
            { workspaceId: 1, createdAt: -1 },
            
            // Report type and category
            { reportType: 1, createdAt: -1 },
            { workspaceId: 1, reportType: 1, createdAt: -1 },
            
            // Creator and owner queries
            { createdBy: 1, createdAt: -1 },
            { workspaceId: 1, createdBy: 1, createdAt: -1 },
            
            // Status and completion
            { status: 1, createdAt: -1 },
            { workspaceId: 1, status: 1, createdAt: -1 },
            
            // Date range queries (for report generation)
            { dateRange: 1, createdAt: -1 },
            { generatedAt: -1 },
            { workspaceId: 1, generatedAt: -1 },
            
            // Scheduled reports
            { isScheduled: 1, nextRunDate: -1 },
            { workspaceId: 1, isScheduled: 1 },
          ];

          for (const indexSpec of indexes) {
            const result = await this.createSingleIndex(modelName.toLowerCase() + 's', ReportModel.collection, indexSpec);
            results.push(result);
          }

        } catch (error) {
          // Model doesn't exist, skip
          continue;
        }
      }

    } catch (error) {
      logger.error('Error creating report indexes:', error);
    }

    return results;
  }

  /**
   * Create a single index with error handling and timing
   */
  private async createSingleIndex(
    collectionName: string,
    collection: mongoose.Collection,
    indexSpec: Record<string, any>
  ): Promise<IndexCreationResult> {
    const startTime = Date.now();
    
    try {
      await collection.createIndex(indexSpec, { 
        background: true,
        name: this.generateIndexName(indexSpec)
      });
      
      const executionTime = Date.now() - startTime;
      
      logger.debug(`Created index on ${collectionName}:`, {
        indexSpec,
        executionTime: `${executionTime}ms`
      });

      return {
        collection: collectionName,
        indexSpec,
        created: true,
        executionTime,
      };

    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      // Index already exists (code 85) is not an error
      if (error.code === 85) {
        logger.debug(`Index already exists on ${collectionName}:`, indexSpec);
        return {
          collection: collectionName,
          indexSpec,
          created: false,
          error: 'Index already exists',
          executionTime,
        };
      }

      logger.warn(`Failed to create index on ${collectionName}:`, {
        indexSpec,
        error: error.message,
        executionTime: `${executionTime}ms`
      });

      return {
        collection: collectionName,
        indexSpec,
        created: false,
        error: error.message,
        executionTime,
      };
    }
  }

  /**
   * Generate a descriptive name for an index
   */
  private generateIndexName(indexSpec: Record<string, any>): string {
    const keys = Object.keys(indexSpec);
    const name = keys
      .map(key => {
        const direction = indexSpec[key];
        if (direction === 1) return key;
        if (direction === -1) return `${key}_desc`;
        if (direction === 'text') return `${key}_text`;
        return `${key}_${direction}`;
      })
      .join('_');
    
    // Truncate if too long (MongoDB has a 127 character limit)
    return name.length > 120 ? name.substring(0, 120) : name;
  }

  /**
   * Analyze existing indexes and suggest optimizations
   */
  public async analyzeExistingIndexes(): Promise<{
    collections: string[];
    totalIndexes: number;
    unusedIndexes: any[];
    recommendations: string[];
  }> {
    try {
      const db = mongoose.connection.db;
      const collections = await db.listCollections().toArray();
      
      let totalIndexes = 0;
      const unusedIndexes: any[] = [];
      const recommendations: string[] = [];

      for (const collection of collections) {
        try {
          const coll = db.collection(collection.name);
          const indexes = await coll.indexes();
          totalIndexes += indexes.length;

          // Check for unused indexes (this would require query analysis)
          // For now, just log the existing indexes
          logger.debug(`Collection ${collection.name} has ${indexes.length} indexes`);

        } catch (error) {
          logger.warn(`Failed to analyze indexes for collection ${collection.name}:`, error);
        }
      }

      return {
        collections: collections.map(c => c.name),
        totalIndexes,
        unusedIndexes,
        recommendations,
      };

    } catch (error) {
      logger.error('Error analyzing existing indexes:', error);
      throw error;
    }
  }

  /**
   * Drop unused or redundant indexes
   */
  public async dropUnusedIndexes(dryRun: boolean = true): Promise<{
    droppedIndexes: string[];
    errors: string[];
  }> {
    const droppedIndexes: string[] = [];
    const errors: string[] = [];

    try {
      logger.info(`${dryRun ? 'Analyzing' : 'Dropping'} unused indexes`);
      
      // This would implement logic to identify and drop unused indexes
      // For now, just return empty results
      
      return {
        droppedIndexes,
        errors,
      };

    } catch (error) {
      logger.error('Error dropping unused indexes:', error);
      throw error;
    }
  }
}

export default PerformanceDatabaseOptimizer;