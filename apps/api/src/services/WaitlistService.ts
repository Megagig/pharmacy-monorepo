/**
 * Waitlist Service
 * Manages appointment waitlists and automatic slot notifications
 */

import mongoose from 'mongoose';
import { addDays, format, isBefore } from 'date-fns';
import { SlotGenerationService } from './SlotGenerationService';
import { AppointmentWaitlist } from '../models/AppointmentWaitlist';
import Patient from '../models/Patient';
import logger from '../utils/logger';

export interface WaitlistEntry {
  _id?: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  appointmentType: string;
  duration: number;
  preferredPharmacistId?: mongoose.Types.ObjectId;
  preferredTimeSlots?: string[];
  preferredDays?: number[];
  urgencyLevel: 'low' | 'medium' | 'high' | 'urgent';
  maxWaitDays: number;
  notificationPreferences: {
    email?: boolean;
    sms?: boolean;
    push?: boolean;
  };
  status: 'active' | 'fulfilled' | 'expired' | 'cancelled';
  createdAt: Date;
  expiresAt: Date;
  fulfilledAt?: Date;
  appointmentId?: mongoose.Types.ObjectId;
}

export interface WaitlistNotification {
  waitlistEntryId: mongoose.Types.ObjectId;
  availableSlots: Array<{
    pharmacistId: mongoose.Types.ObjectId;
    pharmacistName: string;
    date: Date;
    time: string;
    score: number;
  }>;
  expiresAt: Date;
}

export class WaitlistService {
  private static waitlistCollection = 'appointment_waitlist';

  /**
   * Add patient to waitlist
   */
  static async addToWaitlist(entry: Omit<WaitlistEntry, '_id' | 'status' | 'createdAt' | 'expiresAt'>): Promise<WaitlistEntry> {
    try {
      // Check if patient exists
      const patient = await Patient.findById(entry.patientId);
      if (!patient) {
        throw new Error('Patient not found');
      }

      // Check for existing active entry
      const existingEntry = await AppointmentWaitlist.findOne({
        workplaceId: entry.workplaceId,
        patientId: entry.patientId,
        status: 'active',
      });

      if (existingEntry) {
        throw new Error('Patient already on active waitlist');
      }

      // Create waitlist entry in database
      const waitlistDoc = await AppointmentWaitlist.create({
        ...entry,
        status: 'active',
        expiresAt: addDays(new Date(), entry.maxWaitDays)
      });

      const waitlistEntry = waitlistDoc.toObject() as WaitlistEntry;

      logger.info('Added patient to waitlist', {
        waitlistEntryId: waitlistDoc._id.toString(),
        patientId: entry.patientId.toString(),
        appointmentType: entry.appointmentType,
        urgencyLevel: entry.urgencyLevel
      });

      // Start monitoring for available slots
      this.startSlotMonitoring(waitlistEntry);

      return waitlistEntry;

    } catch (error) {
      logger.error('Error adding to waitlist:', error);
      throw error;
    }
  }

  /**
   * Remove patient from waitlist
   */
  static async removeFromWaitlist(
    waitlistEntryId: mongoose.Types.ObjectId,
    reason: 'fulfilled' | 'cancelled' | 'expired'
  ): Promise<boolean> {
    try {
      const result = await AppointmentWaitlist.findByIdAndUpdate(
        waitlistEntryId,
        { 
          status: reason,
          fulfilledAt: reason === 'fulfilled' ? new Date() : undefined,
        },
        { new: true }
      );

      if (!result) {
        logger.warn('Waitlist entry not found', { waitlistEntryId: waitlistEntryId.toString() });
        return false;
      }

      logger.info('Removed from waitlist', {
        waitlistEntryId: waitlistEntryId.toString(),
        reason
      });

      return true;

    } catch (error) {
      logger.error('Error removing from waitlist:', error);
      throw error;
    }
  }

  /**
   * Get waitlist entries for a workplace
   */
  static async getWaitlistEntries(
    workplaceId: mongoose.Types.ObjectId,
    filters?: {
      status?: WaitlistEntry['status'];
      urgencyLevel?: WaitlistEntry['urgencyLevel'];
      appointmentType?: string;
    }
  ): Promise<WaitlistEntry[]> {
    try {
      // Ensure workplaceId is properly converted to ObjectId
      const workplaceObjectId = workplaceId instanceof mongoose.Types.ObjectId 
        ? workplaceId 
        : new mongoose.Types.ObjectId(workplaceId);

      const query: any = { workplaceId: workplaceObjectId };

      if (filters?.status) {
        query.status = filters.status;
      }

      if (filters?.urgencyLevel) {
        query.urgencyLevel = filters.urgencyLevel;
      }

      if (filters?.appointmentType) {
        query.appointmentType = filters.appointmentType;
      }

      console.log('=== WAITLIST SERVICE CALLED ===');
      console.log('Query:', query);
      console.log('WorkplaceId:', workplaceObjectId.toString());
      
      logger.info('Querying waitlist with:', { 
        query: {
          ...query,
          workplaceId: workplaceObjectId.toString()
        }
      });

      // First, let's check if there are ANY waitlist entries at all
      const totalCount = await AppointmentWaitlist.countDocuments({});
      const workplaceCount = await AppointmentWaitlist.countDocuments({ workplaceId: workplaceObjectId });
      
      // Let's see what entries exist for this workplace (without filters first)
      const allEntriesForWorkplace = await AppointmentWaitlist.find({ workplaceId: workplaceObjectId })
        .select('status urgencyLevel appointmentType createdAt workplaceId')
        .lean();
      
      console.log('Database counts:', { totalCount, workplaceCount });
      console.log('All entries for workplace:', allEntriesForWorkplace);
      
      logger.info('Waitlist counts:', { 
        totalInDatabase: totalCount,
        forThisWorkplace: workplaceCount,
        workplaceId: workplaceObjectId.toString()
      });

      // Now run the actual query with filters
      const entries = await AppointmentWaitlist.find(query)
        .populate('patientId', 'firstName lastName email phone')
        .populate('preferredPharmacistId', 'firstName lastName')
        .sort({ urgencyLevel: -1, createdAt: 1 })
        .lean();

      logger.info('Waitlist query result:', { 
        entriesFound: entries.length,
        entries: entries.map(e => ({ 
          id: e._id, 
          status: e.status, 
          workplaceId: e.workplaceId,
          patientId: e.patientId 
        }))
      });

      return entries as WaitlistEntry[];

    } catch (error) {
      logger.error('Error getting waitlist entries:', error);
      throw error;
    }
  }

  /**
   * Process waitlist - check for available slots and notify patients
   */
  static async processWaitlist(workplaceId: mongoose.Types.ObjectId): Promise<{
    processed: number;
    notified: number;
    fulfilled: number;
    expired: number;
  }> {
    try {
      logger.info('Processing waitlist', { workplaceId: workplaceId.toString() });

      const activeEntries = await this.getWaitlistEntries(workplaceId, { status: 'active' });
      
      let processed = 0;
      let notified = 0;
      let fulfilled = 0;
      let expired = 0;

      for (const entry of activeEntries) {
        processed++;

        // Check if entry has expired
        if (isBefore(entry.expiresAt, new Date())) {
          await this.removeFromWaitlist(entry._id!, 'expired');
          expired++;
          continue;
        }

        // Check for available slots
        const availableSlots = await this.findAvailableSlots(entry);

        if (availableSlots.length > 0) {
          // Notify patient about available slots
          const notificationSent = await this.notifyPatientOfAvailability(entry, availableSlots);
          
          if (notificationSent) {
            notified++;
            
            // Auto-book if urgent and patient has auto-booking enabled
            if (entry.urgencyLevel === 'urgent') {
              const autoBooked = await this.autoBookAppointment(entry, availableSlots[0]);
              if (autoBooked) {
                fulfilled++;
              }
            }
          }
        }
      }

      logger.info('Waitlist processing completed', {
        workplaceId: workplaceId.toString(),
        processed,
        notified,
        fulfilled,
        expired
      });

      return { processed, notified, fulfilled, expired };

    } catch (error) {
      logger.error('Error processing waitlist:', error);
      throw error;
    }
  }

  /**
   * Find available slots for a waitlist entry
   */
  private static async findAvailableSlots(entry: WaitlistEntry): Promise<Array<{
    pharmacistId: mongoose.Types.ObjectId;
    pharmacistName: string;
    date: Date;
    time: string;
    score: number;
  }>> {
    try {
      const availableSlots = [];
      const maxDaysToCheck = Math.min(entry.maxWaitDays, 14);

      for (let dayOffset = 0; dayOffset < maxDaysToCheck; dayOffset++) {
        const checkDate = addDays(new Date(), dayOffset);

        // Skip if not a preferred day
        if (entry.preferredDays && entry.preferredDays.length > 0) {
          if (!entry.preferredDays.includes(checkDate.getDay())) {
            continue;
          }
        }

        const slotsResult = await SlotGenerationService.generateAvailableSlots({
          date: checkDate,
          pharmacistId: entry.preferredPharmacistId,
          duration: entry.duration,
          appointmentType: entry.appointmentType,
          workplaceId: entry.workplaceId
        });

        const dayAvailableSlots = slotsResult.slots.filter(slot => {
          // Check if slot is available
          if (!slot.available) return false;

          // Check preferred time slots
          if (entry.preferredTimeSlots && entry.preferredTimeSlots.length > 0) {
            return entry.preferredTimeSlots.includes(slot.time);
          }

          return true;
        });

        // Add slots with scoring
        for (const slot of dayAvailableSlots) {
          const score = this.scoreWaitlistSlot(slot, entry, checkDate);
          
          availableSlots.push({
            pharmacistId: slot.pharmacistId,
            pharmacistName: slot.pharmacistName || 'Unknown',
            date: checkDate,
            time: slot.time,
            score
          });
        }
      }

      // Sort by score and return top slots
      return availableSlots
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

    } catch (error) {
      logger.error('Error finding available slots for waitlist:', error);
      return [];
    }
  }

  /**
   * Score a slot for waitlist entry
   */
  private static scoreWaitlistSlot(
    slot: any,
    entry: WaitlistEntry,
    date: Date
  ): number {
    let score = 50; // Base score

    // Urgency scoring
    const daysFromNow = Math.ceil((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    
    switch (entry.urgencyLevel) {
      case 'urgent':
        score += daysFromNow <= 1 ? 40 : (daysFromNow <= 3 ? 20 : 0);
        break;
      case 'high':
        score += daysFromNow <= 3 ? 30 : (daysFromNow <= 7 ? 15 : 0);
        break;
      case 'medium':
        score += daysFromNow >= 2 && daysFromNow <= 7 ? 20 : 0;
        break;
      case 'low':
        score += daysFromNow >= 7 ? 10 : 0;
        break;
    }

    // Preferred pharmacist
    if (entry.preferredPharmacistId?.toString() === slot.pharmacistId.toString()) {
      score += 25;
    }

    // Preferred time slots
    if (entry.preferredTimeSlots?.includes(slot.time)) {
      score += 20;
    }

    // Preferred days
    if (entry.preferredDays?.includes(date.getDay())) {
      score += 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Notify patient of slot availability
   */
  private static async notifyPatientOfAvailability(
    entry: WaitlistEntry,
    availableSlots: Array<{
      pharmacistId: mongoose.Types.ObjectId;
      pharmacistName: string;
      date: Date;
      time: string;
      score: number;
    }>
  ): Promise<boolean> {
    try {
      // In a real implementation, this would send actual notifications
      logger.info('Notifying patient of slot availability', {
        waitlistEntryId: entry._id?.toString(),
        patientId: entry.patientId.toString(),
        availableSlots: availableSlots.length,
        topSlot: availableSlots[0]
      });

      // Simulate notification sending
      const notifications = [];

      if (entry.notificationPreferences.email) {
        notifications.push(this.sendEmailNotification(entry, availableSlots));
      }

      if (entry.notificationPreferences.sms) {
        notifications.push(this.sendSMSNotification(entry, availableSlots));
      }

      if (entry.notificationPreferences.push) {
        notifications.push(this.sendPushNotification(entry, availableSlots));
      }

      await Promise.all(notifications);
      return true;

    } catch (error) {
      logger.error('Error notifying patient:', error);
      return false;
    }
  }

  /**
   * Auto-book appointment for urgent cases
   */
  private static async autoBookAppointment(
    entry: WaitlistEntry,
    slot: {
      pharmacistId: mongoose.Types.ObjectId;
      pharmacistName: string;
      date: Date;
      time: string;
      score: number;
    }
  ): Promise<boolean> {
    try {
      // In a real implementation, this would create an actual appointment
      logger.info('Auto-booking appointment for urgent waitlist entry', {
        waitlistEntryId: entry._id?.toString(),
        patientId: entry.patientId.toString(),
        slot
      });

      // Mark waitlist entry as fulfilled
      await this.removeFromWaitlist(entry._id!, 'fulfilled');

      return true;

    } catch (error) {
      logger.error('Error auto-booking appointment:', error);
      return false;
    }
  }

  /**
   * Start monitoring slots for a waitlist entry
   */
  private static startSlotMonitoring(entry: WaitlistEntry): void {
    // In a real implementation, this would set up periodic checks
    logger.info('Started slot monitoring for waitlist entry', {
      waitlistEntryId: entry._id?.toString(),
      patientId: entry.patientId.toString()
    });
  }

  /**
   * Send email notification
   */
  private static async sendEmailNotification(
    entry: WaitlistEntry,
    availableSlots: any[]
  ): Promise<void> {
    // Simulate email sending
    logger.info('Sending email notification', {
      patientId: entry.patientId.toString(),
      slotsCount: availableSlots.length
    });
  }

  /**
   * Send SMS notification
   */
  private static async sendSMSNotification(
    entry: WaitlistEntry,
    availableSlots: any[]
  ): Promise<void> {
    // Simulate SMS sending
    logger.info('Sending SMS notification', {
      patientId: entry.patientId.toString(),
      slotsCount: availableSlots.length
    });
  }

  /**
   * Send push notification
   */
  private static async sendPushNotification(
    entry: WaitlistEntry,
    availableSlots: any[]
  ): Promise<void> {
    // Simulate push notification sending
    logger.info('Sending push notification', {
      patientId: entry.patientId.toString(),
      slotsCount: availableSlots.length
    });
  }

  /**
   * Get waitlist statistics
   */
  static async getWaitlistStats(workplaceId: mongoose.Types.ObjectId): Promise<{
    totalActive: number;
    byUrgency: Record<string, number>;
    byAppointmentType: Record<string, number>;
    averageWaitTime: number;
    fulfillmentRate: number;
  }> {
    try {
      const activeEntries = await AppointmentWaitlist.find({
        workplaceId,
        status: 'active',
      });

      const byUrgency: Record<string, number> = {
        low: 0,
        medium: 0,
        high: 0,
        urgent: 0,
      };

      const byAppointmentType: Record<string, number> = {};
      let totalWaitTime = 0;

      activeEntries.forEach((entry) => {
        // Count by urgency
        byUrgency[entry.urgencyLevel] = (byUrgency[entry.urgencyLevel] || 0) + 1;

        // Count by appointment type
        byAppointmentType[entry.appointmentType] = 
          (byAppointmentType[entry.appointmentType] || 0) + 1;

        // Calculate wait time
        const waitTime = Date.now() - entry.createdAt.getTime();
        totalWaitTime += waitTime;
      });

      const averageWaitTime = activeEntries.length > 0
        ? totalWaitTime / activeEntries.length / (1000 * 60 * 60 * 24) // Convert to days
        : 0;

      // Calculate fulfillment rate
      const totalEntries = await AppointmentWaitlist.countDocuments({ workplaceId });
      const fulfilledEntries = await AppointmentWaitlist.countDocuments({
        workplaceId,
        status: 'fulfilled',
      });

      const fulfillmentRate = totalEntries > 0
        ? (fulfilledEntries / totalEntries) * 100
        : 0;

      return {
        totalActive: activeEntries.length,
        byUrgency,
        byAppointmentType,
        averageWaitTime,
        fulfillmentRate,
      };

    } catch (error) {
      logger.error('Error getting waitlist stats:', error);
      throw error;
    }
  }
}