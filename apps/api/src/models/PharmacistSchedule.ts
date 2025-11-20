import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../utils/tenancyGuard';

export interface IPharmacistSchedule extends Document {
  _id: mongoose.Types.ObjectId;
  workplaceId: mongoose.Types.ObjectId;
  locationId?: string;
  
  // Pharmacist
  pharmacistId: mongoose.Types.ObjectId;
  
  // Working hours
  workingHours: Array<{
    dayOfWeek: number;
    isWorkingDay: boolean;
    shifts: Array<{
      startTime: string;
      endTime: string;
      breakStart?: string;
      breakEnd?: string;
    }>;
  }>;
  
  // Time off
  timeOff: Array<{
    startDate: Date;
    endDate: Date;
    reason: string;
    type: 'vacation' | 'sick_leave' | 'personal' | 'training' | 'other';
    status: 'pending' | 'approved' | 'rejected';
    approvedBy?: mongoose.Types.ObjectId;
  }>;
  
  // Appointment preferences
  appointmentPreferences: {
    maxAppointmentsPerDay?: number;
    maxConcurrentAppointments?: number;
    appointmentTypes: string[];
    defaultDuration: number;
    bufferBetweenAppointments?: number;
  };
  
  // Capacity tracking
  capacityStats: {
    totalSlotsAvailable: number;
    slotsBooked: number;
    utilizationRate: number;
    lastCalculatedAt: Date;
  };
  
  // Status
  isActive: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date;
  
  // Audit fields
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  isWorkingOn(date: Date): boolean;
  getShiftsForDate(date: Date): Array<{ startTime: string; endTime: string; breakStart?: string; breakEnd?: string }>;
  requestTimeOff(startDate: Date, endDate: Date, reason: string, type: 'vacation' | 'sick_leave' | 'personal' | 'training' | 'other'): void;
  approveTimeOff(timeOffIndex: number, approvedBy: mongoose.Types.ObjectId): void;
  rejectTimeOff(timeOffIndex: number): void;
  updateCapacityStats(totalSlots: number, bookedSlots: number): void;
  canHandleAppointmentType(appointmentType: string): boolean;
}

// Static methods interface
export interface IPharmacistScheduleModel extends mongoose.Model<IPharmacistSchedule> {
  findByPharmacist(
    pharmacistId: mongoose.Types.ObjectId,
    options?: { activeOnly?: boolean; workplaceId?: mongoose.Types.ObjectId }
  ): Promise<IPharmacistSchedule[]>;
  
  findCurrentSchedule(
    pharmacistId: mongoose.Types.ObjectId,
    workplaceId?: mongoose.Types.ObjectId
  ): Promise<IPharmacistSchedule | null>;
  
  findWithPendingTimeOff(workplaceId?: mongoose.Types.ObjectId): Promise<IPharmacistSchedule[]>;
}

const pharmacistScheduleSchema = new Schema(
  {
    workplaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workplace',
      required: [true, 'Workplace ID is required'],
      index: true,
    },
    locationId: {
      type: String,
      index: true,
    },
    pharmacistId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Pharmacist ID is required'],
      index: true,
    },
    workingHours: [
      {
        dayOfWeek: {
          type: Number,
          required: true,
          min: [0, 'Day of week must be between 0 (Sunday) and 6 (Saturday)'],
          max: [6, 'Day of week must be between 0 (Sunday) and 6 (Saturday)'],
        },
        isWorkingDay: {
          type: Boolean,
          required: true,
          default: true,
        },
        shifts: [
          {
            startTime: {
              type: String,
              required: true,
              validate: {
                validator: function (value: string) {
                  return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
                },
                message: 'Time must be in HH:mm format',
              },
            },
            endTime: {
              type: String,
              required: true,
              validate: {
                validator: function (value: string) {
                  return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
                },
                message: 'Time must be in HH:mm format',
              },
            },
            breakStart: {
              type: String,
              validate: {
                validator: function (value: string) {
                  if (!value) return true;
                  return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
                },
                message: 'Time must be in HH:mm format',
              },
            },
            breakEnd: {
              type: String,
              validate: {
                validator: function (value: string) {
                  if (!value) return true;
                  return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
                },
                message: 'Time must be in HH:mm format',
              },
            },
          },
        ],
      },
    ],
    timeOff: [
      {
        startDate: {
          type: Date,
          required: true,
        },
        endDate: {
          type: Date,
          required: true,
        },
        reason: {
          type: String,
          required: true,
          trim: true,
          maxlength: [500, 'Reason cannot exceed 500 characters'],
        },
        type: {
          type: String,
          enum: ['vacation', 'sick_leave', 'personal', 'training', 'other'],
          required: true,
        },
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected'],
          default: 'pending',
          required: true,
        },
        approvedBy: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
      },
    ],
    appointmentPreferences: {
      maxAppointmentsPerDay: {
        type: Number,
        min: [1, 'Must allow at least 1 appointment per day'],
        max: [50, 'Cannot exceed 50 appointments per day'],
      },
      maxConcurrentAppointments: {
        type: Number,
        min: [1, 'Must allow at least 1 concurrent appointment'],
        max: [10, 'Cannot exceed 10 concurrent appointments'],
        default: 1,
      },
      appointmentTypes: {
        type: [String],
        required: [true, 'At least one appointment type is required'],
        validate: {
          validator: function (types: string[]) {
            return types && types.length > 0;
          },
          message: 'Must have at least one appointment type',
        },
      },
      defaultDuration: {
        type: Number,
        required: [true, 'Default duration is required'],
        min: [5, 'Duration must be at least 5 minutes'],
        max: [480, 'Duration cannot exceed 8 hours'],
        default: 30,
      },
      bufferBetweenAppointments: {
        type: Number,
        min: [0, 'Buffer cannot be negative'],
        max: [60, 'Buffer cannot exceed 60 minutes'],
        default: 0,
      },
    },
    capacityStats: {
      totalSlotsAvailable: {
        type: Number,
        default: 0,
        min: 0,
      },
      slotsBooked: {
        type: Number,
        default: 0,
        min: 0,
      },
      utilizationRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      lastCalculatedAt: {
        type: Date,
        default: Date.now,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    effectiveFrom: {
      type: Date,
      required: [true, 'Effective from date is required'],
      index: true,
    },
    effectiveTo: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add audit fields
addAuditFields(pharmacistScheduleSchema);

// Apply tenancy guard plugin
pharmacistScheduleSchema.plugin(tenancyGuardPlugin, { pharmacyIdField: 'workplaceId' });

// Indexes for efficient querying
pharmacistScheduleSchema.index({ workplaceId: 1, pharmacistId: 1, isActive: 1 });
pharmacistScheduleSchema.index({ workplaceId: 1, locationId: 1, isActive: 1 });
pharmacistScheduleSchema.index({ pharmacistId: 1, effectiveFrom: 1, effectiveTo: 1 });
pharmacistScheduleSchema.index({ createdAt: -1 });

// Virtual for pharmacist details
pharmacistScheduleSchema.virtual('pharmacist', {
  ref: 'User',
  localField: 'pharmacistId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for current utilization percentage
pharmacistScheduleSchema.virtual('currentUtilization').get(function (this: IPharmacistSchedule) {
  if (this.capacityStats.totalSlotsAvailable === 0) return 0;
  
  return Math.round((this.capacityStats.slotsBooked / this.capacityStats.totalSlotsAvailable) * 100);
});

// Virtual for available slots
pharmacistScheduleSchema.virtual('availableSlots').get(function (this: IPharmacistSchedule) {
  return Math.max(0, this.capacityStats.totalSlotsAvailable - this.capacityStats.slotsBooked);
});

// Virtual for is currently effective
pharmacistScheduleSchema.virtual('isCurrentlyEffective').get(function (this: IPharmacistSchedule) {
  const now = new Date();
  
  if (!this.isActive) return false;
  if (this.effectiveFrom > now) return false;
  if (this.effectiveTo && this.effectiveTo < now) return false;
  
  return true;
});

// Virtual for working days count
pharmacistScheduleSchema.virtual('workingDaysCount').get(function (this: IPharmacistSchedule) {
  if (!this.workingHours) return 0;
  return this.workingHours.filter(wh => wh.isWorkingDay).length;
});

// Virtual for total weekly hours
pharmacistScheduleSchema.virtual('totalWeeklyHours').get(function (this: IPharmacistSchedule) {
  if (!this.workingHours) return 0;
  
  let totalMinutes = 0;
  
  for (const day of this.workingHours) {
    if (!day.isWorkingDay || !day.shifts) continue;
    
    for (const shift of day.shifts) {
      const [startHour, startMin] = shift.startTime.split(':').map(Number);
      const [endHour, endMin] = shift.endTime.split(':').map(Number);
      
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      let shiftMinutes = endMinutes - startMinutes;
      
      // Subtract break time if provided
      if (shift.breakStart && shift.breakEnd) {
        const [breakStartHour, breakStartMin] = shift.breakStart.split(':').map(Number);
        const [breakEndHour, breakEndMin] = shift.breakEnd.split(':').map(Number);
        
        const breakStartMinutes = breakStartHour * 60 + breakStartMin;
        const breakEndMinutes = breakEndHour * 60 + breakEndMin;
        
        shiftMinutes -= (breakEndMinutes - breakStartMinutes);
      }
      
      totalMinutes += shiftMinutes;
    }
  }
  
  return Math.round((totalMinutes / 60) * 10) / 10; // Round to 1 decimal place
});

// Virtual for approved time off
pharmacistScheduleSchema.virtual('approvedTimeOff').get(function (this: IPharmacistSchedule) {
  if (!this.timeOff) return [];
  return this.timeOff.filter(to => to.status === 'approved');
});

// Virtual for pending time off requests
pharmacistScheduleSchema.virtual('pendingTimeOffRequests').get(function (this: IPharmacistSchedule) {
  if (!this.timeOff) return [];
  return this.timeOff.filter(to => to.status === 'pending');
});

// Pre-save validation
pharmacistScheduleSchema.pre('save', function (this: IPharmacistSchedule) {
  // Validate working hours
  if (this.workingHours && this.workingHours.length > 0) {
    for (const day of this.workingHours) {
      if (day.isWorkingDay && (!day.shifts || day.shifts.length === 0)) {
        throw new Error(`Working day ${day.dayOfWeek} must have at least one shift`);
      }
      
      // Validate shift times
      for (const shift of day.shifts || []) {
        const [startHour, startMin] = shift.startTime.split(':').map(Number);
        const [endHour, endMin] = shift.endTime.split(':').map(Number);
        
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        
        if (endMinutes <= startMinutes) {
          throw new Error('Shift end time must be after start time');
        }
        
        // Validate break times if provided
        if (shift.breakStart && shift.breakEnd) {
          const [breakStartHour, breakStartMin] = shift.breakStart.split(':').map(Number);
          const [breakEndHour, breakEndMin] = shift.breakEnd.split(':').map(Number);
          
          const breakStartMinutes = breakStartHour * 60 + breakStartMin;
          const breakEndMinutes = breakEndHour * 60 + breakEndMin;
          
          if (breakEndMinutes <= breakStartMinutes) {
            throw new Error('Break end time must be after break start time');
          }
          
          if (breakStartMinutes < startMinutes || breakEndMinutes > endMinutes) {
            throw new Error('Break must be within shift hours');
          }
        }
      }
    }
  }
  
  // Validate time off dates
  if (this.timeOff && this.timeOff.length > 0) {
    for (const timeOffEntry of this.timeOff) {
      if (timeOffEntry.endDate <= timeOffEntry.startDate) {
        throw new Error('Time off end date must be after start date');
      }
    }
  }
  
  // Validate effective dates
  if (this.effectiveTo && this.effectiveTo <= this.effectiveFrom) {
    throw new Error('Effective to date must be after effective from date');
  }
});

// Static method to find by pharmacist
pharmacistScheduleSchema.statics.findByPharmacist = function (
  pharmacistId: mongoose.Types.ObjectId,
  options?: { activeOnly?: boolean; workplaceId?: mongoose.Types.ObjectId }
) {
  const query: any = { pharmacistId };
  
  if (options?.activeOnly) {
    query.isActive = true;
  }
  
  if (options?.workplaceId) {
    return this.find(query).setOptions({ workplaceId: options.workplaceId }).sort({ effectiveFrom: -1 });
  }
  
  return this.find(query).sort({ effectiveFrom: -1 });
};

// Static method to find current schedule
pharmacistScheduleSchema.statics.findCurrentSchedule = function (
  pharmacistId: mongoose.Types.ObjectId,
  workplaceId?: mongoose.Types.ObjectId
) {
  const now = new Date();
  
  const query = {
    pharmacistId,
    isActive: true,
    effectiveFrom: { $lte: now },
    $or: [
      { effectiveTo: { $exists: false } },
      { effectiveTo: null },
      { effectiveTo: { $gte: now } },
    ],
  };
  
  if (workplaceId) {
    return this.findOne(query).setOptions({ workplaceId });
  }
  
  return this.findOne(query);
};

// Static method to find schedules with pending time off
pharmacistScheduleSchema.statics.findWithPendingTimeOff = function (
  workplaceId?: mongoose.Types.ObjectId
) {
  const query = {
    'timeOff.status': 'pending',
    isActive: true,
  };
  
  if (workplaceId) {
    return this.find(query).setOptions({ workplaceId });
  }
  
  return this.find(query);
};

// Instance method to check if working on date
pharmacistScheduleSchema.methods.isWorkingOn = function (
  this: IPharmacistSchedule,
  date: Date
): boolean {
  // Check if date is within effective period
  if (date < this.effectiveFrom) return false;
  if (this.effectiveTo && date > this.effectiveTo) return false;
  
  // Check if on approved time off
  const approvedTimeOff = this.get('approvedTimeOff');
  for (const timeOff of approvedTimeOff) {
    if (date >= timeOff.startDate && date <= timeOff.endDate) {
      return false;
    }
  }
  
  // Check if it's a working day
  const dayOfWeek = date.getDay();
  const daySchedule = this.workingHours.find(wh => wh.dayOfWeek === dayOfWeek);
  
  return daySchedule ? daySchedule.isWorkingDay : false;
};

// Instance method to get shifts for date
pharmacistScheduleSchema.methods.getShiftsForDate = function (
  this: IPharmacistSchedule,
  date: Date
): Array<{ startTime: string; endTime: string; breakStart?: string; breakEnd?: string }> {
  if (!this.isWorkingOn(date)) return [];
  
  const dayOfWeek = date.getDay();
  const daySchedule = this.workingHours.find(wh => wh.dayOfWeek === dayOfWeek);
  
  return daySchedule?.shifts || [];
};

// Instance method to request time off
pharmacistScheduleSchema.methods.requestTimeOff = function (
  this: IPharmacistSchedule,
  startDate: Date,
  endDate: Date,
  reason: string,
  type: 'vacation' | 'sick_leave' | 'personal' | 'training' | 'other'
) {
  if (endDate <= startDate) {
    throw new Error('End date must be after start date');
  }
  
  this.timeOff.push({
    startDate,
    endDate,
    reason,
    type,
    status: 'pending',
  });
};

// Instance method to approve time off
pharmacistScheduleSchema.methods.approveTimeOff = function (
  this: IPharmacistSchedule,
  timeOffIndex: number,
  approvedBy: mongoose.Types.ObjectId
) {
  if (timeOffIndex < 0 || timeOffIndex >= this.timeOff.length) {
    throw new Error('Invalid time off index');
  }
  
  this.timeOff[timeOffIndex].status = 'approved';
  this.timeOff[timeOffIndex].approvedBy = approvedBy;
};

// Instance method to reject time off
pharmacistScheduleSchema.methods.rejectTimeOff = function (
  this: IPharmacistSchedule,
  timeOffIndex: number
) {
  if (timeOffIndex < 0 || timeOffIndex >= this.timeOff.length) {
    throw new Error('Invalid time off index');
  }
  
  this.timeOff[timeOffIndex].status = 'rejected';
};

// Instance method to update capacity stats
pharmacistScheduleSchema.methods.updateCapacityStats = function (
  this: IPharmacistSchedule,
  totalSlots: number,
  bookedSlots: number
) {
  this.capacityStats.totalSlotsAvailable = totalSlots;
  this.capacityStats.slotsBooked = bookedSlots;
  this.capacityStats.utilizationRate = totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 100) : 0;
  this.capacityStats.lastCalculatedAt = new Date();
};

// Instance method to check if can handle appointment type
pharmacistScheduleSchema.methods.canHandleAppointmentType = function (
  this: IPharmacistSchedule,
  appointmentType: string
): boolean {
  return this.appointmentPreferences.appointmentTypes.includes(appointmentType);
};

export default mongoose.model<IPharmacistSchedule, IPharmacistScheduleModel>('PharmacistSchedule', pharmacistScheduleSchema);
