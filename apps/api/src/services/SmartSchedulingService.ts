/**
 * Smart Scheduling Service
 * Provides intelligent appointment scheduling with optimization algorithms
 */

import mongoose from 'mongoose';
import { addDays, format, isWeekend, startOfDay, addMinutes, differenceInMinutes } from 'date-fns';
import { SlotGenerationService } from './SlotGenerationService';
import PharmacistSchedule, { IPharmacistSchedule } from '../models/PharmacistSchedule';
import Appointment, { IAppointment } from '../models/Appointment';
import User from '../models/User';
import logger from '../utils/logger';

export interface SmartSchedulingOptions {
    patientId: mongoose.Types.ObjectId;
    appointmentType: string;
    duration: number;
    workplaceId: mongoose.Types.ObjectId;
    preferredPharmacistId?: mongoose.Types.ObjectId;
    preferredTimeSlots?: string[]; // e.g., ['09:00', '10:00', '14:00']
    preferredDays?: number[]; // 0-6, Sunday-Saturday
    maxDaysAhead?: number;
    urgencyLevel?: 'low' | 'medium' | 'high' | 'urgent';
    patientPreferences?: {
        morningPreferred?: boolean;
        afternoonPreferred?: boolean;
        avoidLunchTime?: boolean;
        preferredLanguage?: string;
    };
}

export interface SmartSchedulingSuggestion {
    pharmacistId: mongoose.Types.ObjectId;
    pharmacistName: string;
    date: Date;
    time: string;
    score: number; // 0-100, higher is better
    reasons: string[];
    alternativeSlots?: Array<{
        date: Date;
        time: string;
        score: number;
    }>;
}

export interface SchedulingOptimizationReport {
    currentUtilization: number;
    recommendedActions: string[];
    bottlenecks: Array<{
        pharmacistId: mongoose.Types.ObjectId;
        pharmacistName: string;
        issue: string;
        severity: 'low' | 'medium' | 'high';
        suggestion: string;
    }>;
    capacityForecast: Array<{
        date: Date;
        expectedDemand: number;
        availableCapacity: number;
        utilizationRate: number;
    }>;
}

export class SmartSchedulingService {
    /**
     * Get intelligent appointment suggestions based on preferences and optimization
     */
    static async getSmartSuggestions(
        options: SmartSchedulingOptions
    ): Promise<SmartSchedulingSuggestion[]> {
        try {
            const {
                patientId,
                appointmentType,
                duration,
                workplaceId,
                preferredPharmacistId,
                preferredTimeSlots = [],
                preferredDays = [],
                maxDaysAhead = 14,
                urgencyLevel = 'medium',
                patientPreferences = {}
            } = options;

            logger.info('Generating smart scheduling suggestions', {
                patientId: patientId.toString(),
                appointmentType,
                duration,
                urgencyLevel
            });

            // Get available pharmacists
            const pharmacists = await this.getAvailablePharmacists(
                workplaceId,
                appointmentType,
                preferredPharmacistId
            );

            if (pharmacists.length === 0) {
                return [];
            }

            const suggestions: SmartSchedulingSuggestion[] = [];
            const today = new Date();

            // Generate suggestions for each day within the range
            for (let dayOffset = 0; dayOffset < maxDaysAhead; dayOffset++) {
                const checkDate = addDays(today, dayOffset);

                // Skip weekends if not preferred (unless urgent)
                if (isWeekend(checkDate) && urgencyLevel !== 'urgent' && preferredDays.length > 0) {
                    if (!preferredDays.includes(checkDate.getDay())) {
                        continue;
                    }
                }

                // Get slots for each pharmacist on this date
                for (const pharmacist of pharmacists) {
                    try {
                        const slotsResult = await SlotGenerationService.generateAvailableSlots({
                            date: checkDate,
                            pharmacistId: pharmacist._id,
                            duration,
                            appointmentType,
                            workplaceId
                        });

                        const availableSlots = slotsResult.slots.filter(slot => slot.available);

                        // Score and rank slots
                        for (const slot of availableSlots) {
                            const suggestion = await this.scoreSlot(
                                pharmacist,
                                checkDate,
                                slot.time,
                                options,
                                slotsResult.summary
                            );

                            if (suggestion.score > 0) {
                                suggestions.push(suggestion);
                            }
                        }
                    } catch (error) {
                        logger.warn('Error getting slots for pharmacist', {
                            pharmacistId: pharmacist._id.toString(),
                            date: format(checkDate, 'yyyy-MM-dd'),
                            error: error instanceof Error ? error.message : 'Unknown error'
                        });
                    }
                }
            }

            // Sort by score (highest first) and return top suggestions
            const sortedSuggestions = suggestions
                .sort((a, b) => b.score - a.score)
                .slice(0, 10); // Return top 10 suggestions

            // Add alternative slots for top suggestions
            for (const suggestion of sortedSuggestions.slice(0, 3)) {
                suggestion.alternativeSlots = await this.getAlternativeSlots(
                    suggestion,
                    options,
                    suggestions
                );
            }

            logger.info('Generated smart suggestions', {
                totalSuggestions: suggestions.length,
                topSuggestions: sortedSuggestions.length
            });

            return sortedSuggestions;

        } catch (error) {
            logger.error('Error generating smart suggestions:', error);
            throw error;
        }
    }

    /**
     * Score a specific slot based on various factors
     */
    private static async scoreSlot(
        pharmacist: any,
        date: Date,
        time: string,
        options: SmartSchedulingOptions,
        slotSummary: any
    ): Promise<SmartSchedulingSuggestion> {
        let score = 50; // Base score
        const reasons: string[] = [];

        // Time preference scoring
        const [hour] = time.split(':').map(Number);

        // Morning preference (8-12)
        if (options.patientPreferences?.morningPreferred && hour >= 8 && hour < 12) {
            score += 15;
            reasons.push('Matches morning preference');
        }

        // Afternoon preference (13-17)
        if (options.patientPreferences?.afternoonPreferred && hour >= 13 && hour < 17) {
            score += 15;
            reasons.push('Matches afternoon preference');
        }

        // Avoid lunch time (12-13)
        if (options.patientPreferences?.avoidLunchTime && hour >= 12 && hour < 13) {
            score -= 10;
            reasons.push('During lunch time (not preferred)');
        }

        // Preferred time slots
        if (options.preferredTimeSlots?.includes(time)) {
            score += 20;
            reasons.push('Matches preferred time slot');
        }

        // Preferred days
        if (options.preferredDays?.includes(date.getDay())) {
            score += 10;
            reasons.push('Matches preferred day');
        }

        // Preferred pharmacist
        if (options.preferredPharmacistId?.toString() === pharmacist._id.toString()) {
            score += 25;
            reasons.push('Preferred pharmacist');
        }

        // Urgency level adjustments
        const daysFromNow = Math.ceil((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

        switch (options.urgencyLevel) {
            case 'urgent':
                if (daysFromNow <= 1) {
                    score += 30;
                    reasons.push('Urgent - very soon');
                } else if (daysFromNow <= 3) {
                    score += 15;
                    reasons.push('Urgent - within 3 days');
                }
                break;
            case 'high':
                if (daysFromNow <= 3) {
                    score += 20;
                    reasons.push('High priority - within 3 days');
                } else if (daysFromNow <= 7) {
                    score += 10;
                    reasons.push('High priority - within week');
                }
                break;
            case 'medium':
                if (daysFromNow >= 2 && daysFromNow <= 7) {
                    score += 10;
                    reasons.push('Good timing for medium priority');
                }
                break;
            case 'low':
                if (daysFromNow >= 7) {
                    score += 5;
                    reasons.push('Appropriate timing for low priority');
                }
                break;
        }

        // Pharmacist utilization (prefer less busy pharmacists for better service)
        if (slotSummary.utilizationRate < 60) {
            score += 10;
            reasons.push('Pharmacist has good availability');
        } else if (slotSummary.utilizationRate > 80) {
            score -= 5;
            reasons.push('Pharmacist is quite busy');
        }

        // Language preference
        if (options.patientPreferences?.preferredLanguage) {
            // This would need to be added to pharmacist profile
            // For now, we'll assume English is default
            if (options.patientPreferences.preferredLanguage === 'en') {
                score += 5;
                reasons.push('Language preference matched');
            }
        }

        // Optimal appointment spacing (avoid back-to-back if possible)
        const optimalTimes = ['09:00', '10:30', '14:00', '15:30'];
        if (optimalTimes.includes(time)) {
            score += 8;
            reasons.push('Optimal appointment timing');
        }

        // Weekend penalty (unless preferred)
        if (isWeekend(date) && !options.preferredDays?.includes(date.getDay())) {
            score -= 5;
            reasons.push('Weekend appointment');
        }

        return {
            pharmacistId: pharmacist._id,
            pharmacistName: `${pharmacist.firstName} ${pharmacist.lastName}`,
            date,
            time,
            score: Math.max(0, Math.min(100, score)), // Clamp between 0-100
            reasons
        };
    }

    /**
     * Get alternative slots for a suggestion
     */
    private static async getAlternativeSlots(
        mainSuggestion: SmartSchedulingSuggestion,
        options: SmartSchedulingOptions,
        allSuggestions: SmartSchedulingSuggestion[]
    ): Promise<Array<{ date: Date; time: string; score: number }>> {
        // Find other slots for the same pharmacist on the same day
        const samePharmacistSlots = allSuggestions
            .filter(s =>
                s.pharmacistId.toString() === mainSuggestion.pharmacistId.toString() &&
                format(s.date, 'yyyy-MM-dd') === format(mainSuggestion.date, 'yyyy-MM-dd') &&
                s.time !== mainSuggestion.time
            )
            .slice(0, 3)
            .map(s => ({
                date: s.date,
                time: s.time,
                score: s.score
            }));

        return samePharmacistSlots;
    }

    /**
     * Get available pharmacists for appointment type
     */
    private static async getAvailablePharmacists(
        workplaceId: mongoose.Types.ObjectId,
        appointmentType: string,
        preferredPharmacistId?: mongoose.Types.ObjectId
    ): Promise<any[]> {
        const query: any = {
            workplaceId,
            isActive: true,
            'appointmentPreferences.appointmentTypes': appointmentType
        };

        if (preferredPharmacistId) {
            // If preferred pharmacist is specified, try them first
            const preferredSchedule = await PharmacistSchedule.findOne({
                ...query,
                pharmacistId: preferredPharmacistId
            }).populate('pharmacistId', 'firstName lastName email');

            if (preferredSchedule) {
                return [preferredSchedule.pharmacistId];
            }
        }

        const schedules = await PharmacistSchedule.find(query)
            .populate('pharmacistId', 'firstName lastName email')
            .limit(10); // Limit to prevent performance issues

        return schedules.map(schedule => schedule.pharmacistId).filter(Boolean);
    }

    /**
     * Generate scheduling optimization report
     */
    static async generateOptimizationReport(
        workplaceId: mongoose.Types.ObjectId,
        startDate: Date,
        endDate: Date
    ): Promise<SchedulingOptimizationReport> {
        try {
            logger.info('Generating scheduling optimization report', {
                workplaceId: workplaceId.toString(),
                startDate: format(startDate, 'yyyy-MM-dd'),
                endDate: format(endDate, 'yyyy-MM-dd')
            });

            // Get all pharmacist schedules
            const schedules = await PharmacistSchedule.find({
                workplaceId,
                isActive: true
            }).populate('pharmacistId', 'firstName lastName email');

            // Get appointments in the date range
            const appointments = await Appointment.find({
                workplaceId,
                scheduledDate: { $gte: startDate, $lte: endDate },
                status: { $nin: ['cancelled', 'no_show'] },
                isDeleted: false
            });

            // Calculate current utilization
            const totalSlots = await this.calculateTotalAvailableSlots(schedules, startDate, endDate);
            const bookedSlots = appointments.length;
            const currentUtilization = totalSlots > 0 ? (bookedSlots / totalSlots) * 100 : 0;

            // Identify bottlenecks
            const bottlenecks = await this.identifyBottlenecks(schedules, appointments, workplaceId);

            // Generate recommendations
            const recommendedActions = this.generateRecommendations(
                currentUtilization,
                bottlenecks,
                schedules
            );

            // Generate capacity forecast
            const capacityForecast = await this.generateCapacityForecast(
                schedules,
                workplaceId,
                endDate
            );

            return {
                currentUtilization: Math.round(currentUtilization * 100) / 100,
                recommendedActions,
                bottlenecks,
                capacityForecast
            };

        } catch (error) {
            logger.error('Error generating optimization report:', error);
            throw error;
        }
    }

    /**
     * Calculate total available slots for a period
     */
    private static async calculateTotalAvailableSlots(
        schedules: IPharmacistSchedule[],
        startDate: Date,
        endDate: Date
    ): Promise<number> {
        let totalSlots = 0;
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            for (const schedule of schedules) {
                if (schedule.isWorkingOn(currentDate)) {
                    const shifts = schedule.getShiftsForDate(currentDate);
                    for (const shift of shifts) {
                        const [startHour, startMin] = shift.startTime.split(':').map(Number);
                        const [endHour, endMin] = shift.endTime.split(':').map(Number);

                        const shiftStart = new Date(currentDate);
                        shiftStart.setHours(startHour, startMin, 0, 0);
                        const shiftEnd = new Date(currentDate);
                        shiftEnd.setHours(endHour, endMin, 0, 0);

                        // Calculate slots (30-minute intervals)
                        const shiftMinutes = differenceInMinutes(shiftEnd, shiftStart);
                        const slotsInShift = Math.floor(shiftMinutes / 30);
                        totalSlots += slotsInShift;
                    }
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return totalSlots;
    }

    /**
     * Identify scheduling bottlenecks
     */
    private static async identifyBottlenecks(
        schedules: IPharmacistSchedule[],
        appointments: IAppointment[],
        workplaceId: mongoose.Types.ObjectId
    ): Promise<Array<{
        pharmacistId: mongoose.Types.ObjectId;
        pharmacistName: string;
        issue: string;
        severity: 'low' | 'medium' | 'high';
        suggestion: string;
    }>> {
        const bottlenecks = [];

        for (const schedule of schedules) {
            const pharmacist = schedule.pharmacistId as any;
            const pharmacistAppointments = appointments.filter(
                apt => apt.assignedTo.toString() === schedule.pharmacistId.toString()
            );

            // Check utilization rate
            const pharmacistSlots = await this.calculatePharmacistSlots(schedule);
            const utilizationRate = pharmacistSlots > 0 ? (pharmacistAppointments.length / pharmacistSlots) * 100 : 0;

            if (utilizationRate > 90) {
                bottlenecks.push({
                    pharmacistId: schedule.pharmacistId,
                    pharmacistName: `${pharmacist.firstName} ${pharmacist.lastName}`,
                    issue: `Over-utilized (${Math.round(utilizationRate)}%)`,
                    severity: 'high' as const,
                    suggestion: 'Consider redistributing appointments or extending working hours'
                });
            } else if (utilizationRate < 30) {
                bottlenecks.push({
                    pharmacistId: schedule.pharmacistId,
                    pharmacistName: `${pharmacist.firstName} ${pharmacist.lastName}`,
                    issue: `Under-utilized (${Math.round(utilizationRate)}%)`,
                    severity: 'medium' as const,
                    suggestion: 'Consider marketing services or adjusting schedule'
                });
            }

            // Check for appointment clustering
            const appointmentTimes = pharmacistAppointments.map(apt => apt.scheduledTime);
            const clusteredTimes = this.findClusteredTimes(appointmentTimes);

            if (clusteredTimes.length > 0) {
                bottlenecks.push({
                    pharmacistId: schedule.pharmacistId,
                    pharmacistName: `${pharmacist.firstName} ${pharmacist.lastName}`,
                    issue: 'Appointments clustered in specific time slots',
                    severity: 'low' as const,
                    suggestion: 'Encourage appointment distribution throughout the day'
                });
            }
        }

        return bottlenecks;
    }

    /**
     * Calculate available slots for a pharmacist
     */
    private static async calculatePharmacistSlots(schedule: IPharmacistSchedule): Promise<number> {
        let totalSlots = 0;

        for (const daySchedule of schedule.workingHours) {
            if (daySchedule.isWorkingDay) {
                for (const shift of daySchedule.shifts) {
                    const [startHour, startMin] = shift.startTime.split(':').map(Number);
                    const [endHour, endMin] = shift.endTime.split(':').map(Number);

                    const shiftMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
                    const slotsInShift = Math.floor(shiftMinutes / 30);
                    totalSlots += slotsInShift;
                }
            }
        }

        return totalSlots;
    }

    /**
     * Find clustered appointment times
     */
    private static findClusteredTimes(appointmentTimes: string[]): string[] {
        const timeCount: Record<string, number> = {};

        appointmentTimes.forEach(time => {
            timeCount[time] = (timeCount[time] || 0) + 1;
        });

        return Object.entries(timeCount)
            .filter(([_, count]) => count > 3)
            .map(([time, _]) => time);
    }

    /**
     * Generate optimization recommendations
     */
    private static generateRecommendations(
        currentUtilization: number,
        bottlenecks: any[],
        schedules: IPharmacistSchedule[]
    ): string[] {
        const recommendations = [];

        if (currentUtilization > 85) {
            recommendations.push('Consider hiring additional pharmacists or extending working hours');
            recommendations.push('Implement appointment waitlist system for high-demand periods');
        } else if (currentUtilization < 50) {
            recommendations.push('Focus on marketing and patient outreach to increase appointment bookings');
            recommendations.push('Consider offering additional services during low-demand periods');
        }

        const highSeverityBottlenecks = bottlenecks.filter(b => b.severity === 'high');
        if (highSeverityBottlenecks.length > 0) {
            recommendations.push('Address over-utilized pharmacists by redistributing workload');
        }

        const underUtilizedPharmacists = bottlenecks.filter(b => b.issue.includes('Under-utilized'));
        if (underUtilizedPharmacists.length > 0) {
            recommendations.push('Cross-train under-utilized pharmacists for high-demand services');
        }

        if (schedules.some(s => s.workingHours.filter(wh => wh.isWorkingDay).length < 5)) {
            recommendations.push('Consider expanding working days for better coverage');
        }

        return recommendations;
    }

    /**
     * Generate capacity forecast
     */
    private static async generateCapacityForecast(
        schedules: IPharmacistSchedule[],
        workplaceId: mongoose.Types.ObjectId,
        fromDate: Date
    ): Promise<Array<{
        date: Date;
        expectedDemand: number;
        availableCapacity: number;
        utilizationRate: number;
    }>> {
        const forecast = [];
        const forecastDays = 14; // 2 weeks ahead

        for (let i = 0; i < forecastDays; i++) {
            const forecastDate = addDays(fromDate, i);

            // Calculate available capacity
            let availableCapacity = 0;
            for (const schedule of schedules) {
                if (schedule.isWorkingOn(forecastDate)) {
                    const shifts = schedule.getShiftsForDate(forecastDate);
                    for (const shift of shifts) {
                        const [startHour, startMin] = shift.startTime.split(':').map(Number);
                        const [endHour, endMin] = shift.endTime.split(':').map(Number);

                        const shiftMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
                        availableCapacity += Math.floor(shiftMinutes / 30);
                    }
                }
            }

            // Estimate demand based on historical patterns
            const dayOfWeek = forecastDate.getDay();
            const expectedDemand = this.estimateDemand(dayOfWeek, availableCapacity);

            const utilizationRate = availableCapacity > 0 ? (expectedDemand / availableCapacity) * 100 : 0;

            forecast.push({
                date: forecastDate,
                expectedDemand,
                availableCapacity,
                utilizationRate: Math.round(utilizationRate * 100) / 100
            });
        }

        return forecast;
    }

    /**
     * Estimate demand based on day of week and historical patterns
     */
    private static estimateDemand(dayOfWeek: number, availableCapacity: number): number {
        // Simple demand estimation based on typical patterns
        const demandMultipliers = {
            0: 0.3, // Sunday - low
            1: 0.8, // Monday - high
            2: 0.7, // Tuesday - medium-high
            3: 0.6, // Wednesday - medium
            4: 0.7, // Thursday - medium-high
            5: 0.5, // Friday - medium-low
            6: 0.4, // Saturday - low-medium
        };

        const multiplier = demandMultipliers[dayOfWeek as keyof typeof demandMultipliers] || 0.6;
        return Math.round(availableCapacity * multiplier);
    }
}