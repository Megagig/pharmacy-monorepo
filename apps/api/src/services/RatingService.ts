import mongoose from 'mongoose';
import ConsultationRating, { IConsultationRating, IRatingCategories } from '../models/ConsultationRating';
import Patient from '../models/Patient';
import User from '../models/User';
import Appointment from '../models/Appointment';
import logger from '../utils/logger';

export interface SubmitRatingData {
  pharmacistId: string;
  appointmentId?: string;
  rating: number;
  feedback?: string;
  categories: IRatingCategories;
  isAnonymous?: boolean;
}

export interface RatingFilter {
  pharmacistId?: string;
  patientId?: string;
  appointmentId?: string;
  ratingMin?: number;
  ratingMax?: number;
  dateFrom?: Date;
  dateTo?: Date;
  hasResponse?: boolean;
  limit?: number;
  skip?: number;
}

export interface PharmacistRatingStats {
  pharmacistId: string;
  pharmacistName: string;
  totalRatings: number;
  averageRating: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  categoryAverages: {
    professionalism: number;
    communication: number;
    expertise: number;
    timeliness: number;
  };
  responseRate: number; // Percentage of ratings with responses
  recentRatings: IConsultationRating[];
}

export interface RatingAnalytics {
  totalRatings: number;
  averageRating: number;
  ratingTrend: Array<{
    period: string;
    averageRating: number;
    count: number;
  }>;
  topPharmacists: Array<{
    pharmacistId: string;
    pharmacistName: string;
    averageRating: number;
    totalRatings: number;
  }>;
  categoryBreakdown: {
    professionalism: number;
    communication: number;
    expertise: number;
    timeliness: number;
  };
}

export class RatingService {
  /**
   * Submit a new rating for a consultation
   */
  static async submitRating(
    patientId: string,
    workplaceId: string,
    ratingData: SubmitRatingData
  ): Promise<IConsultationRating> {
    try {
      // Verify patient belongs to workspace
      const patient = await Patient.findOne({
        _id: patientId,
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      });

      if (!patient) {
        throw new Error('Patient not found or access denied');
      }

      // Verify pharmacist exists and belongs to workspace
      const pharmacist = await User.findOne({
        _id: ratingData.pharmacistId,
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        role: { $in: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'super_admin'] }
      });

      if (!pharmacist) {
        throw new Error('Pharmacist not found or access denied');
      }

      // Verify appointment if provided
      if (ratingData.appointmentId) {
        const appointment = await Appointment.findOne({
          _id: ratingData.appointmentId,
          patientId: new mongoose.Types.ObjectId(patientId),
          workplaceId: new mongoose.Types.ObjectId(workplaceId)
        });

        if (!appointment) {
          throw new Error('Appointment not found or access denied');
        }

        // Check if rating already exists for this appointment
        const existingRating = await ConsultationRating.findOne({
          appointmentId: ratingData.appointmentId,
          patientId: new mongoose.Types.ObjectId(patientId)
        });

        if (existingRating) {
          throw new Error('Rating already submitted for this appointment');
        }
      }

      // Validate rating values
      if (ratingData.rating < 1 || ratingData.rating > 5) {
        throw new Error('Overall rating must be between 1 and 5');
      }

      const categories = ratingData.categories;
      if (
        categories.professionalism < 1 || categories.professionalism > 5 ||
        categories.communication < 1 || categories.communication > 5 ||
        categories.expertise < 1 || categories.expertise > 5 ||
        categories.timeliness < 1 || categories.timeliness > 5
      ) {
        throw new Error('All category ratings must be between 1 and 5');
      }

      // Create rating
      const rating = new ConsultationRating({
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        patientId: new mongoose.Types.ObjectId(patientId),
        pharmacistId: new mongoose.Types.ObjectId(ratingData.pharmacistId),
        appointmentId: ratingData.appointmentId ? new mongoose.Types.ObjectId(ratingData.appointmentId) : undefined,
        rating: ratingData.rating,
        feedback: ratingData.feedback,
        categories: ratingData.categories,
        isAnonymous: ratingData.isAnonymous || false
      });

      await rating.save();

      logger.info('Rating submitted successfully:', {
        ratingId: rating._id,
        patientId,
        pharmacistId: ratingData.pharmacistId,
        rating: ratingData.rating,
        isAnonymous: ratingData.isAnonymous
      });

      return rating;
    } catch (error) {
      logger.error('Error submitting rating:', {
        error: error.message,
        patientId,
        workplaceId,
        ratingData
      });
      throw error;
    }
  }

  /**
   * Get ratings for a specific pharmacist
   */
  static async getPharmacistRatings(
    pharmacistId: string,
    workplaceId: string,
    filters: RatingFilter = {}
  ): Promise<{
    ratings: IConsultationRating[];
    total: number;
    hasMore: boolean;
    stats: PharmacistRatingStats;
  }> {
    try {
      // Verify pharmacist exists and belongs to workspace
      const pharmacist = await User.findOne({
        _id: pharmacistId,
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      });

      if (!pharmacist) {
        throw new Error('Pharmacist not found or access denied');
      }

      // Build query
      const query: any = {
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        pharmacistId: new mongoose.Types.ObjectId(pharmacistId)
      };

      if (filters.ratingMin || filters.ratingMax) {
        query.rating = {};
        if (filters.ratingMin) query.rating.$gte = filters.ratingMin;
        if (filters.ratingMax) query.rating.$lte = filters.ratingMax;
      }

      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) query.createdAt.$gte = filters.dateFrom;
        if (filters.dateTo) query.createdAt.$lte = filters.dateTo;
      }

      if (filters.hasResponse !== undefined) {
        query.response = filters.hasResponse ? { $exists: true } : { $exists: false };
      }

      const limit = filters.limit || 20;
      const skip = filters.skip || 0;

      // Get ratings with pagination
      const [ratings, total, stats] = await Promise.all([
        ConsultationRating.find(query)
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip(skip)
          .populate('patientId', 'firstName lastName', null, { strictPopulate: false })
          .populate('appointmentId', 'type title scheduledDate', null, { strictPopulate: false }),
        ConsultationRating.countDocuments(query),
        this.getPharmacistRatingStats(pharmacistId, workplaceId)
      ]);

      return {
        ratings,
        total,
        hasMore: skip + ratings.length < total,
        stats
      };
    } catch (error) {
      logger.error('Error getting pharmacist ratings:', {
        error: error.message,
        pharmacistId,
        workplaceId,
        filters
      });
      throw error;
    }
  }

  /**
   * Get comprehensive rating statistics for a pharmacist
   */
  static async getPharmacistRatingStats(
    pharmacistId: string,
    workplaceId: string
  ): Promise<PharmacistRatingStats> {
    try {
      const pharmacist = await User.findById(pharmacistId);
      if (!pharmacist) {
        throw new Error('Pharmacist not found');
      }

      // Aggregate rating statistics
      const stats = await ConsultationRating.aggregate([
        {
          $match: {
            workplaceId: new mongoose.Types.ObjectId(workplaceId),
            pharmacistId: new mongoose.Types.ObjectId(pharmacistId)
          }
        },
        {
          $group: {
            _id: null,
            totalRatings: { $sum: 1 },
            averageRating: { $avg: '$rating' },
            ratingsWithResponse: {
              $sum: { $cond: [{ $ifNull: ['$response', false] }, 1, 0] }
            },
            ratingDistribution: {
              $push: '$rating'
            },
            categoryAverages: {
              $push: {
                professionalism: '$categories.professionalism',
                communication: '$categories.communication',
                expertise: '$categories.expertise',
                timeliness: '$categories.timeliness'
              }
            }
          }
        }
      ]);

      if (stats.length === 0) {
        return {
          pharmacistId,
          pharmacistName: `${pharmacist.firstName} ${pharmacist.lastName}`,
          totalRatings: 0,
          averageRating: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          categoryAverages: {
            professionalism: 0,
            communication: 0,
            expertise: 0,
            timeliness: 0
          },
          responseRate: 0,
          recentRatings: []
        };
      }

      const stat = stats[0];

      // Calculate rating distribution
      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      stat.ratingDistribution.forEach((rating: number) => {
        distribution[rating as keyof typeof distribution]++;
      });

      // Calculate category averages
      const categoryTotals = {
        professionalism: 0,
        communication: 0,
        expertise: 0,
        timeliness: 0
      };

      stat.categoryAverages.forEach((categories: any) => {
        categoryTotals.professionalism += categories.professionalism;
        categoryTotals.communication += categories.communication;
        categoryTotals.expertise += categories.expertise;
        categoryTotals.timeliness += categories.timeliness;
      });

      const categoryAverages = {
        professionalism: Math.round((categoryTotals.professionalism / stat.totalRatings) * 10) / 10,
        communication: Math.round((categoryTotals.communication / stat.totalRatings) * 10) / 10,
        expertise: Math.round((categoryTotals.expertise / stat.totalRatings) * 10) / 10,
        timeliness: Math.round((categoryTotals.timeliness / stat.totalRatings) * 10) / 10
      };

      // Get recent ratings
      const recentRatings = await ConsultationRating.find({
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        pharmacistId: new mongoose.Types.ObjectId(pharmacistId)
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('patientId', 'firstName lastName', null, { strictPopulate: false });

      return {
        pharmacistId,
        pharmacistName: `${pharmacist.firstName} ${pharmacist.lastName}`,
        totalRatings: stat.totalRatings,
        averageRating: Math.round(stat.averageRating * 10) / 10,
        ratingDistribution: distribution,
        categoryAverages,
        responseRate: Math.round((stat.ratingsWithResponse / stat.totalRatings) * 100),
        recentRatings
      };
    } catch (error) {
      logger.error('Error getting pharmacist rating stats:', {
        error: error.message,
        pharmacistId,
        workplaceId
      });
      throw error;
    }
  }

  /**
   * Add response to a rating
   */
  static async addRatingResponse(
    ratingId: string,
    responderId: string,
    workplaceId: string,
    responseText: string
  ): Promise<IConsultationRating> {
    try {
      // Find the rating
      const rating = await ConsultationRating.findOne({
        _id: ratingId,
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      });

      if (!rating) {
        throw new Error('Rating not found or access denied');
      }

      // Check if user can respond (pharmacist who was rated or admin)
      const responder = await User.findOne({
        _id: responderId,
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      });

      if (!responder) {
        throw new Error('Responder not found or access denied');
      }

      const canRespond = rating.pharmacistId.toString() === responderId || 
                        ['super_admin', 'owner'].includes(responder.role);

      if (!canRespond) {
        throw new Error('You are not authorized to respond to this rating');
      }

      if (rating.response) {
        throw new Error('Rating already has a response');
      }

      // Add response
      rating.response = {
        text: responseText,
        respondedBy: new mongoose.Types.ObjectId(responderId),
        respondedAt: new Date()
      };

      await rating.save();

      logger.info('Rating response added:', {
        ratingId,
        responderId,
        pharmacistId: rating.pharmacistId
      });

      return rating;
    } catch (error) {
      logger.error('Error adding rating response:', {
        error: error.message,
        ratingId,
        responderId,
        workplaceId
      });
      throw error;
    }
  }

  /**
   * Get rating analytics for workspace
   */
  static async getRatingAnalytics(
    workplaceId: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<RatingAnalytics> {
    try {
      const matchQuery: any = {
        workplaceId: new mongoose.Types.ObjectId(workplaceId)
      };

      if (dateFrom || dateTo) {
        matchQuery.createdAt = {};
        if (dateFrom) matchQuery.createdAt.$gte = dateFrom;
        if (dateTo) matchQuery.createdAt.$lte = dateTo;
      }

      // Get overall analytics
      const [overallStats, trendData, topPharmacists] = await Promise.all([
        // Overall statistics
        ConsultationRating.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: null,
              totalRatings: { $sum: 1 },
              averageRating: { $avg: '$rating' },
              categoryAverages: {
                $push: {
                  professionalism: '$categories.professionalism',
                  communication: '$categories.communication',
                  expertise: '$categories.expertise',
                  timeliness: '$categories.timeliness'
                }
              }
            }
          }
        ]),

        // Trend data (monthly)
        ConsultationRating.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' }
              },
              averageRating: { $avg: '$rating' },
              count: { $sum: 1 }
            }
          },
          {
            $project: {
              period: {
                $concat: [
                  { $toString: '$_id.year' },
                  '-',
                  { $toString: '$_id.month' }
                ]
              },
              averageRating: { $round: ['$averageRating', 1] },
              count: 1
            }
          },
          { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]),

        // Top pharmacists
        ConsultationRating.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: '$pharmacistId',
              averageRating: { $avg: '$rating' },
              totalRatings: { $sum: 1 }
            }
          },
          { $match: { totalRatings: { $gte: 3 } } }, // At least 3 ratings
          { $sort: { averageRating: -1, totalRatings: -1 } },
          { $limit: 10 },
          {
            $lookup: {
              from: 'users',
              localField: '_id',
              foreignField: '_id',
              as: 'pharmacist'
            }
          },
          {
            $project: {
              pharmacistId: '$_id',
              pharmacistName: {
                $concat: [
                  { $arrayElemAt: ['$pharmacist.firstName', 0] },
                  ' ',
                  { $arrayElemAt: ['$pharmacist.lastName', 0] }
                ]
              },
              averageRating: { $round: ['$averageRating', 1] },
              totalRatings: 1
            }
          }
        ])
      ]);

      // Calculate category breakdown
      let categoryBreakdown = {
        professionalism: 0,
        communication: 0,
        expertise: 0,
        timeliness: 0
      };

      if (overallStats.length > 0 && overallStats[0].categoryAverages.length > 0) {
        const categories = overallStats[0].categoryAverages;
        const totals = {
          professionalism: 0,
          communication: 0,
          expertise: 0,
          timeliness: 0
        };

        categories.forEach((cat: any) => {
          totals.professionalism += cat.professionalism;
          totals.communication += cat.communication;
          totals.expertise += cat.expertise;
          totals.timeliness += cat.timeliness;
        });

        const count = categories.length;
        categoryBreakdown = {
          professionalism: Math.round((totals.professionalism / count) * 10) / 10,
          communication: Math.round((totals.communication / count) * 10) / 10,
          expertise: Math.round((totals.expertise / count) * 10) / 10,
          timeliness: Math.round((totals.timeliness / count) * 10) / 10
        };
      }

      return {
        totalRatings: overallStats[0]?.totalRatings || 0,
        averageRating: overallStats[0] ? Math.round(overallStats[0].averageRating * 10) / 10 : 0,
        ratingTrend: trendData,
        topPharmacists,
        categoryBreakdown
      };
    } catch (error) {
      logger.error('Error getting rating analytics:', {
        error: error.message,
        workplaceId,
        dateFrom,
        dateTo
      });
      throw error;
    }
  }
}