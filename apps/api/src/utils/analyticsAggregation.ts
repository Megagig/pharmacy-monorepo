import mongoose from 'mongoose';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

export interface AggregationFilters {
  workplaceId: mongoose.Types.ObjectId;
  startDate?: Date;
  endDate?: Date;
  pharmacistId?: mongoose.Types.ObjectId;
  locationId?: string;
  appointmentType?: string;
  status?: string;
  priority?: string;
  taskType?: string;
}

export interface AggregationOptions {
  groupBy?: 'hour' | 'day' | 'week' | 'month' | 'pharmacist' | 'type' | 'location' | 'status';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Build base match stage for aggregation pipelines
 */
export function buildBaseMatchStage(filters: AggregationFilters): Record<string, any> {
  const matchStage: Record<string, any> = {
    workplaceId: filters.workplaceId,
    isDeleted: { $ne: true }
  };

  if (filters.startDate || filters.endDate) {
    matchStage.scheduledDate = {};
    if (filters.startDate) {
      matchStage.scheduledDate.$gte = startOfDay(filters.startDate);
    }
    if (filters.endDate) {
      matchStage.scheduledDate.$lte = endOfDay(filters.endDate);
    }
  }

  if (filters.pharmacistId) {
    matchStage.assignedTo = filters.pharmacistId;
  }

  if (filters.locationId) {
    matchStage.locationId = filters.locationId;
  }

  if (filters.appointmentType) {
    matchStage.type = filters.appointmentType;
  }

  if (filters.status) {
    matchStage.status = filters.status;
  }

  if (filters.priority) {
    matchStage.priority = filters.priority;
  }

  if (filters.taskType) {
    matchStage.type = filters.taskType;
  }

  return matchStage;
}

/**
 * Build group stage for time-based aggregations
 */
export function buildTimeGroupStage(groupBy: 'hour' | 'day' | 'week' | 'month', dateField: string = 'scheduledDate') {
  switch (groupBy) {
    case 'hour':
      return {
        _id: {
          year: { $year: `$${dateField}` },
          month: { $month: `$${dateField}` },
          day: { $dayOfMonth: `$${dateField}` },
          hour: { $hour: `$${dateField}` }
        },
        date: { $first: `$${dateField}` }
      };
    
    case 'day':
      return {
        _id: {
          year: { $year: `$${dateField}` },
          month: { $month: `$${dateField}` },
          day: { $dayOfMonth: `$${dateField}` }
        },
        date: { $first: `$${dateField}` }
      };
    
    case 'week':
      return {
        _id: {
          year: { $year: `$${dateField}` },
          week: { $week: `$${dateField}` }
        },
        date: { $first: `$${dateField}` }
      };
    
    case 'month':
      return {
        _id: {
          year: { $year: `$${dateField}` },
          month: { $month: `$${dateField}` }
        },
        date: { $first: `$${dateField}` }
      };
    
    default:
      throw new Error(`Invalid groupBy value: ${groupBy}`);
  }
}

/**
 * Build appointment analytics aggregation pipeline
 */
export function buildAppointmentAnalyticsPipeline(
  filters: AggregationFilters,
  options: AggregationOptions = {}
): mongoose.PipelineStage[] {
  const pipeline: mongoose.PipelineStage[] = [];

  // Match stage
  pipeline.push({ $match: buildBaseMatchStage(filters) });

  // Add lookup for pharmacist details if needed
  if (options.groupBy === 'pharmacist' || !options.groupBy) {
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'assignedTo',
        foreignField: '_id',
        as: 'pharmacist',
        pipeline: [
          { $project: { firstName: 1, lastName: 1, email: 1 } }
        ]
      }
    });
    pipeline.push({
      $unwind: { path: '$pharmacist', preserveNullAndEmptyArrays: true }
    });
  }

  // Group stage based on options
  if (options.groupBy) {
    const groupStage: Record<string, any> = {
      count: { $sum: 1 },
      completed: {
        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
      },
      cancelled: {
        $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
      },
      noShow: {
        $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] }
      },
      totalDuration: { $sum: '$duration' },
      avgDuration: { $avg: '$duration' }
    };

    if (['hour', 'day', 'week', 'month'].includes(options.groupBy)) {
      groupStage._id = buildTimeGroupStage(options.groupBy as any)._id;
      groupStage.date = buildTimeGroupStage(options.groupBy as any).date;
    } else if (options.groupBy === 'pharmacist') {
      groupStage._id = '$assignedTo';
      groupStage.pharmacistName = { $first: { $concat: ['$pharmacist.firstName', ' ', '$pharmacist.lastName'] } };
      groupStage.pharmacistEmail = { $first: '$pharmacist.email' };
    } else if (options.groupBy === 'type') {
      groupStage._id = '$type';
    } else if (options.groupBy === 'location') {
      groupStage._id = '$locationId';
    } else if (options.groupBy === 'status') {
      groupStage._id = '$status';
    }

    pipeline.push({ $group: groupStage });

    // Add calculated fields
    pipeline.push({
      $addFields: {
        completionRate: {
          $cond: [
            { $gt: ['$count', 0] },
            { $multiply: [{ $divide: ['$completed', '$count'] }, 100] },
            0
          ]
        },
        cancellationRate: {
          $cond: [
            { $gt: ['$count', 0] },
            { $multiply: [{ $divide: ['$cancelled', '$count'] }, 100] },
            0
          ]
        },
        noShowRate: {
          $cond: [
            { $gt: ['$count', 0] },
            { $multiply: [{ $divide: ['$noShow', '$count'] }, 100] },
            0
          ]
        }
      }
    });
  }

  // Sort stage
  if (options.sortBy) {
    const sortOrder = options.sortOrder === 'desc' ? -1 : 1;
    pipeline.push({ $sort: { [options.sortBy]: sortOrder } });
  } else if (options.groupBy && ['hour', 'day', 'week', 'month'].includes(options.groupBy)) {
    pipeline.push({ $sort: { date: 1 } });
  }

  // Pagination
  if (options.offset) {
    pipeline.push({ $skip: options.offset });
  }
  if (options.limit) {
    pipeline.push({ $limit: options.limit });
  }

  return pipeline;
}

/**
 * Build follow-up analytics aggregation pipeline
 */
export function buildFollowUpAnalyticsPipeline(
  filters: AggregationFilters,
  options: AggregationOptions = {}
): mongoose.PipelineStage[] {
  const pipeline: mongoose.PipelineStage[] = [];

  // Adjust match stage for follow-up specific fields
  const matchStage = buildBaseMatchStage(filters);
  
  // Use createdAt for date filtering instead of scheduledDate
  if (matchStage.scheduledDate) {
    matchStage.createdAt = matchStage.scheduledDate;
    delete matchStage.scheduledDate;
  }

  pipeline.push({ $match: matchStage });

  // Add lookup for pharmacist details
  pipeline.push({
    $lookup: {
      from: 'users',
      localField: 'assignedTo',
      foreignField: '_id',
      as: 'pharmacist',
      pipeline: [
        { $project: { firstName: 1, lastName: 1, email: 1 } }
      ]
    }
  });
  pipeline.push({
    $unwind: { path: '$pharmacist', preserveNullAndEmptyArrays: true }
  });

  // Add calculated fields for time to completion
  pipeline.push({
    $addFields: {
      timeToCompletion: {
        $cond: [
          { $and: ['$completedAt', '$createdAt'] },
          {
            $divide: [
              { $subtract: ['$completedAt', '$createdAt'] },
              1000 * 60 * 60 * 24 // Convert to days
            ]
          },
          null
        ]
      },
      isOverdue: {
        $cond: [
          { $and: [{ $ne: ['$status', 'completed'] }, { $lt: ['$dueDate', new Date()] }] },
          true,
          false
        ]
      },
      daysSinceDue: {
        $cond: [
          { $lt: ['$dueDate', new Date()] },
          {
            $divide: [
              { $subtract: [new Date(), '$dueDate'] },
              1000 * 60 * 60 * 24
            ]
          },
          0
        ]
      }
    }
  });

  // Group stage
  if (options.groupBy) {
    const groupStage: Record<string, any> = {
      count: { $sum: 1 },
      completed: {
        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
      },
      overdue: {
        $sum: { $cond: ['$isOverdue', 1, 0] }
      },
      avgTimeToCompletion: { $avg: '$timeToCompletion' },
      escalations: { $sum: { $size: { $ifNull: ['$escalationHistory', []] } } }
    };

    if (['hour', 'day', 'week', 'month'].includes(options.groupBy)) {
      groupStage._id = buildTimeGroupStage(options.groupBy as any, 'createdAt')._id;
      groupStage.date = buildTimeGroupStage(options.groupBy as any, 'createdAt').date;
    } else if (options.groupBy === 'pharmacist') {
      groupStage._id = '$assignedTo';
      groupStage.pharmacistName = { $first: { $concat: ['$pharmacist.firstName', ' ', '$pharmacist.lastName'] } };
    } else if (options.groupBy === 'type') {
      groupStage._id = '$type';
    } else if (options.groupBy === 'status') {
      groupStage._id = '$status';
    }

    pipeline.push({ $group: groupStage });

    // Add calculated rates
    pipeline.push({
      $addFields: {
        completionRate: {
          $cond: [
            { $gt: ['$count', 0] },
            { $multiply: [{ $divide: ['$completed', '$count'] }, 100] },
            0
          ]
        },
        overdueRate: {
          $cond: [
            { $gt: ['$count', 0] },
            { $multiply: [{ $divide: ['$overdue', '$count'] }, 100] },
            0
          ]
        }
      }
    });
  }

  // Sort and pagination
  if (options.sortBy) {
    const sortOrder = options.sortOrder === 'desc' ? -1 : 1;
    pipeline.push({ $sort: { [options.sortBy]: sortOrder } });
  }

  if (options.offset) {
    pipeline.push({ $skip: options.offset });
  }
  if (options.limit) {
    pipeline.push({ $limit: options.limit });
  }

  return pipeline;
}

/**
 * Build reminder analytics aggregation pipeline
 */
export function buildReminderAnalyticsPipeline(
  filters: AggregationFilters,
  options: AggregationOptions = {}
): mongoose.PipelineStage[] {
  const pipeline: mongoose.PipelineStage[] = [];

  // Match appointments with reminders
  const matchStage = buildBaseMatchStage(filters);
  matchStage['reminders.0'] = { $exists: true };

  pipeline.push({ $match: matchStage });

  // Unwind reminders array
  pipeline.push({ $unwind: '$reminders' });

  // Filter reminders by date if specified
  if (filters.startDate || filters.endDate) {
    const reminderDateFilter: Record<string, any> = {};
    if (filters.startDate) {
      reminderDateFilter.$gte = startOfDay(filters.startDate);
    }
    if (filters.endDate) {
      reminderDateFilter.$lte = endOfDay(filters.endDate);
    }
    pipeline.push({
      $match: {
        'reminders.scheduledFor': reminderDateFilter
      }
    });
  }

  // Group by reminder channel or other criteria
  if (options.groupBy === 'type' || !options.groupBy) {
    pipeline.push({
      $group: {
        _id: '$reminders.type',
        totalSent: { $sum: 1 },
        delivered: {
          $sum: { $cond: [{ $eq: ['$reminders.deliveryStatus', 'delivered'] }, 1, 0] }
        },
        failed: {
          $sum: { $cond: [{ $eq: ['$reminders.deliveryStatus', 'failed'] }, 1, 0] }
        },
        pending: {
          $sum: { $cond: [{ $eq: ['$reminders.deliveryStatus', 'pending'] }, 1, 0] }
        }
      }
    });

    // Calculate delivery rates
    pipeline.push({
      $addFields: {
        deliveryRate: {
          $cond: [
            { $gt: ['$totalSent', 0] },
            { $multiply: [{ $divide: ['$delivered', '$totalSent'] }, 100] },
            0
          ]
        },
        failureRate: {
          $cond: [
            { $gt: ['$totalSent', 0] },
            { $multiply: [{ $divide: ['$failed', '$totalSent'] }, 100] },
            0
          ]
        }
      }
    });
  }

  return pipeline;
}

/**
 * Build capacity analytics aggregation pipeline
 */
export function buildCapacityAnalyticsPipeline(
  filters: AggregationFilters,
  options: AggregationOptions = {}
): mongoose.PipelineStage[] {
  const pipeline: mongoose.PipelineStage[] = [];

  // This pipeline works with PharmacistSchedule collection
  const matchStage: Record<string, any> = {
    workplaceId: filters.workplaceId,
    isActive: true
  };

  if (filters.pharmacistId) {
    matchStage.pharmacistId = filters.pharmacistId;
  }

  if (filters.locationId) {
    matchStage.locationId = filters.locationId;
  }

  pipeline.push({ $match: matchStage });

  // Lookup pharmacist details
  pipeline.push({
    $lookup: {
      from: 'users',
      localField: 'pharmacistId',
      foreignField: '_id',
      as: 'pharmacist',
      pipeline: [
        { $project: { firstName: 1, lastName: 1, email: 1 } }
      ]
    }
  });
  pipeline.push({
    $unwind: { path: '$pharmacist', preserveNullAndEmptyArrays: true }
  });

  // Lookup appointments for the pharmacist in the date range
  const appointmentLookup: Record<string, any> = {
    from: 'appointments',
    localField: 'pharmacistId',
    foreignField: 'assignedTo',
    as: 'appointments',
    pipeline: [
      {
        $match: {
          status: { $nin: ['cancelled'] }
        }
      }
    ]
  };

  if (filters.startDate || filters.endDate) {
    const dateFilter: Record<string, any> = {};
    if (filters.startDate) {
      dateFilter.$gte = startOfDay(filters.startDate);
    }
    if (filters.endDate) {
      dateFilter.$lte = endOfDay(filters.endDate);
    }
    appointmentLookup.pipeline.unshift({
      $match: { scheduledDate: dateFilter }
    });
  }

  pipeline.push({ $lookup: appointmentLookup as any });

  // Calculate capacity metrics
  pipeline.push({
    $addFields: {
      pharmacistName: { $concat: ['$pharmacist.firstName', ' ', '$pharmacist.lastName'] },
      bookedSlots: { $size: '$appointments' },
      utilizationRate: {
        $cond: [
          { $gt: ['$capacityStats.totalSlotsAvailable', 0] },
          {
            $multiply: [
              { $divide: [{ $size: '$appointments' }, '$capacityStats.totalSlotsAvailable'] },
              100
            ]
          },
          0
        ]
      }
    }
  });

  // Group by pharmacist or overall
  if (options.groupBy === 'pharmacist' || !options.groupBy) {
    pipeline.push({
      $group: {
        _id: '$pharmacistId',
        pharmacistName: { $first: '$pharmacistName' },
        totalSlots: { $first: '$capacityStats.totalSlotsAvailable' },
        bookedSlots: { $first: '$bookedSlots' },
        utilizationRate: { $first: '$utilizationRate' },
        workingHours: { $first: { $size: '$workingHours' } }
      }
    });
  }

  return pipeline;
}

/**
 * Execute aggregation pipeline with error handling and performance monitoring
 */
export async function executeAggregationPipeline<T>(
  model: mongoose.Model<any>,
  pipeline: mongoose.PipelineStage[],
  options: { 
    allowDiskUse?: boolean;
    maxTimeMS?: number;
    hint?: string | Record<string, any>;
  } = {}
): Promise<T[]> {
  const startTime = Date.now();
  
  try {
    const aggregationOptions = {
      allowDiskUse: options.allowDiskUse ?? true,
      maxTimeMS: options.maxTimeMS ?? 30000, // 30 second timeout
      ...options
    };

    const result = await model.aggregate(pipeline, aggregationOptions);
    
    const executionTime = Date.now() - startTime;
    
    // Log slow queries for optimization
    if (executionTime > 5000) {
      console.warn(`Slow aggregation query detected: ${executionTime}ms`, {
        model: model.modelName,
        pipeline: JSON.stringify(pipeline),
        executionTime
      });
    }

    return result;
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`Aggregation pipeline failed after ${executionTime}ms:`, {
      model: model.modelName,
      error: error.message,
      pipeline: JSON.stringify(pipeline)
    });
    throw error;
  }
}

/**
 * Build summary statistics pipeline
 */
export function buildSummaryStatsPipeline(
  baseMatchStage: Record<string, any>
): mongoose.PipelineStage[] {
  return [
    { $match: baseMatchStage },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        cancelled: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        },
        noShow: {
          $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] }
        },
        avgDuration: { $avg: '$duration' },
        totalDuration: { $sum: '$duration' }
      }
    },
    {
      $addFields: {
        completionRate: {
          $cond: [
            { $gt: ['$total', 0] },
            { $multiply: [{ $divide: ['$completed', '$total'] }, 100] },
            0
          ]
        },
        cancellationRate: {
          $cond: [
            { $gt: ['$total', 0] },
            { $multiply: [{ $divide: ['$cancelled', '$total'] }, 100] },
            0
          ]
        },
        noShowRate: {
          $cond: [
            { $gt: ['$total', 0] },
            { $multiply: [{ $divide: ['$noShow', '$total'] }, 100] },
            0
          ]
        }
      }
    }
  ];
}