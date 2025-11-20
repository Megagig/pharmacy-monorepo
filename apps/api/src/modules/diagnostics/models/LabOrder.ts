import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../../../utils/tenancyGuard';

export interface ILabTest {
    code: string;
    name: string;
    loincCode?: string;
    indication: string;
    priority: 'stat' | 'urgent' | 'routine';
    category?: string;
    specimen?: string;
    expectedTurnaround?: string;
    estimatedCost?: number;
    clinicalNotes?: string;
}

export interface ILabOrder extends Document {
    _id: mongoose.Types.ObjectId;
    patientId: mongoose.Types.ObjectId;
    orderedBy: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId;
    locationId?: string;

    // Order Details
    orderNumber: string; // Auto-generated unique order number
    tests: ILabTest[];
    status: 'ordered' | 'collected' | 'processing' | 'completed' | 'cancelled' | 'rejected';
    orderDate: Date;
    expectedDate?: Date;
    completedDate?: Date;

    // Clinical Context
    clinicalIndication: string;
    urgentReason?: string;
    patientInstructions?: string;
    labInstructions?: string;

    // Collection Details
    collectionDate?: Date;
    collectedBy?: mongoose.Types.ObjectId;
    collectionNotes?: string;
    specimenType?: string;
    collectionSite?: string;

    // External Integration
    externalOrderId?: string;
    fhirReference?: string;
    labSystemId?: string;

    // Tracking and Notifications
    trackingNumber?: string;
    notificationsSent: {
        ordered: boolean;
        collected: boolean;
        processing: boolean;
        completed: boolean;
    };

    // Quality and Validation
    validationFlags?: string[];
    rejectionReason?: string;

    // Cost and Billing
    totalEstimatedCost?: number;
    insurancePreAuth?: boolean;
    paymentStatus?: 'pending' | 'authorized' | 'paid' | 'rejected';

    // Audit Fields (added by addAuditFields)
    createdAt: Date;
    updatedAt: Date;
    createdBy: mongoose.Types.ObjectId;
    updatedBy?: mongoose.Types.ObjectId;
    isDeleted: boolean;

    // Virtual properties
    isActive: boolean;
    daysSinceOrder: number;

    // Instance methods
    updateStatus(status: ILabOrder['status'], updatedBy?: mongoose.Types.ObjectId): Promise<void>;
    markAsCollected(collectedBy: mongoose.Types.ObjectId, notes?: string): Promise<void>;
    markAsCompleted(): Promise<void>;
    cancel(reason: string, cancelledBy: mongoose.Types.ObjectId): Promise<void>;
    calculateTotalCost(): number;
    getHighestPriority(): 'stat' | 'urgent' | 'routine';
    isOverdue(): boolean;
    canBeModified(): boolean;
}

const labTestSchema = new Schema({
    code: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        maxlength: [20, 'Test code cannot exceed 20 characters'],
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: [200, 'Test name cannot exceed 200 characters'],
        index: true
    },
    loincCode: {
        type: String,
        trim: true,
        maxlength: [20, 'LOINC code cannot exceed 20 characters'],
        index: true,
        sparse: true
    },
    indication: {
        type: String,
        required: true,
        trim: true,
        maxlength: [500, 'Indication cannot exceed 500 characters']
    },
    priority: {
        type: String,
        enum: ['stat', 'urgent', 'routine'],
        required: true,
        index: true
    },
    category: {
        type: String,
        trim: true,
        maxlength: [100, 'Category cannot exceed 100 characters'],
        index: true
    },
    specimen: {
        type: String,
        trim: true,
        maxlength: [100, 'Specimen type cannot exceed 100 characters']
    },
    expectedTurnaround: {
        type: String,
        trim: true,
        maxlength: [50, 'Expected turnaround cannot exceed 50 characters']
    },
    estimatedCost: {
        type: Number,
        min: [0, 'Estimated cost cannot be negative']
    },
    clinicalNotes: {
        type: String,
        trim: true,
        maxlength: [500, 'Clinical notes cannot exceed 500 characters']
    }
}, { _id: false });

const notificationsSchema = new Schema({
    ordered: {
        type: Boolean,
        default: false
    },
    collected: {
        type: Boolean,
        default: false
    },
    processing: {
        type: Boolean,
        default: false
    },
    completed: {
        type: Boolean,
        default: false
    }
}, { _id: false });

const labOrderSchema = new Schema({
    patientId: {
        type: Schema.Types.ObjectId,
        ref: 'Patient',
        required: true,
        index: true
    },
    orderedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    workplaceId: {
        type: Schema.Types.ObjectId,
        ref: 'Workplace',
        required: true,
        index: true
    },
    locationId: {
        type: String,
        index: true,
        sparse: true
    },

    // Order Details
    orderNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true,
        maxlength: [20, 'Order number cannot exceed 20 characters'],
        index: true
    },
    tests: {
        type: [labTestSchema],
        required: true,
        validate: {
            validator: function (tests: ILabTest[]) {
                return tests.length > 0;
            },
            message: 'At least one test is required'
        }
    },
    status: {
        type: String,
        enum: ['ordered', 'collected', 'processing', 'completed', 'cancelled', 'rejected'],
        default: 'ordered',
        required: true,
        index: true
    },
    orderDate: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
    },
    expectedDate: {
        type: Date,
        index: true
    },
    completedDate: {
        type: Date,
        index: true
    },

    // Clinical Context
    clinicalIndication: {
        type: String,
        required: true,
        trim: true,
        maxlength: [1000, 'Clinical indication cannot exceed 1000 characters']
    },
    urgentReason: {
        type: String,
        trim: true,
        maxlength: [500, 'Urgent reason cannot exceed 500 characters']
    },
    patientInstructions: {
        type: String,
        trim: true,
        maxlength: [1000, 'Patient instructions cannot exceed 1000 characters']
    },
    labInstructions: {
        type: String,
        trim: true,
        maxlength: [1000, 'Lab instructions cannot exceed 1000 characters']
    },

    // Collection Details
    collectionDate: {
        type: Date,
        index: true
    },
    collectedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    collectionNotes: {
        type: String,
        trim: true,
        maxlength: [500, 'Collection notes cannot exceed 500 characters']
    },
    specimenType: {
        type: String,
        trim: true,
        maxlength: [100, 'Specimen type cannot exceed 100 characters']
    },
    collectionSite: {
        type: String,
        trim: true,
        maxlength: [100, 'Collection site cannot exceed 100 characters']
    },

    // External Integration
    externalOrderId: {
        type: String,
        trim: true,
        maxlength: [100, 'External order ID cannot exceed 100 characters'],
        index: true,
        sparse: true
    },
    fhirReference: {
        type: String,
        trim: true,
        maxlength: [200, 'FHIR reference cannot exceed 200 characters']
    },
    labSystemId: {
        type: String,
        trim: true,
        maxlength: [100, 'Lab system ID cannot exceed 100 characters'],
        index: true,
        sparse: true
    },

    // Tracking and Notifications
    trackingNumber: {
        type: String,
        trim: true,
        maxlength: [50, 'Tracking number cannot exceed 50 characters'],
        index: true,
        sparse: true
    },
    notificationsSent: {
        type: notificationsSchema,
        default: () => ({})
    },

    // Quality and Validation
    validationFlags: {
        type: [String],
        default: []
    },
    rejectionReason: {
        type: String,
        trim: true,
        maxlength: [500, 'Rejection reason cannot exceed 500 characters']
    },

    // Cost and Billing
    totalEstimatedCost: {
        type: Number,
        min: [0, 'Total estimated cost cannot be negative']
    },
    insurancePreAuth: {
        type: Boolean,
        default: false
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'authorized', 'paid', 'rejected'],
        default: 'pending',
        index: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Add audit fields (createdBy, updatedBy, isDeleted)
addAuditFields(labOrderSchema);

// Apply tenancy guard plugin
labOrderSchema.plugin(tenancyGuardPlugin);

// Compound indexes for efficient querying
labOrderSchema.index({ workplaceId: 1, patientId: 1, orderDate: -1 });
labOrderSchema.index({ workplaceId: 1, status: 1, orderDate: -1 });
labOrderSchema.index({ workplaceId: 1, orderedBy: 1, orderDate: -1 });
labOrderSchema.index({ workplaceId: 1, locationId: 1, status: 1 }, { sparse: true });
labOrderSchema.index({ workplaceId: 1, 'tests.priority': 1, orderDate: -1 });
labOrderSchema.index({ workplaceId: 1, expectedDate: 1, status: 1 });
labOrderSchema.index({ workplaceId: 1, isDeleted: 1, orderDate: -1 });

// Text index for searching
labOrderSchema.index({
    orderNumber: 'text',
    clinicalIndication: 'text',
    'tests.name': 'text',
    'tests.indication': 'text'
});

// Virtual for checking if order is active
labOrderSchema.virtual('isActive').get(function (this: ILabOrder) {
    return ['ordered', 'collected', 'processing'].includes(this.status);
});

// Note: isOverdue is implemented as an instance method instead of virtual to avoid conflicts

// Virtual for days since order
labOrderSchema.virtual('daysSinceOrder').get(function (this: ILabOrder) {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - this.orderDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Instance methods
labOrderSchema.methods.updateStatus = async function (
    this: ILabOrder,
    status: ILabOrder['status'],
    updatedBy?: mongoose.Types.ObjectId
): Promise<void> {
    this.status = status;

    if (status === 'completed' && !this.completedDate) {
        this.completedDate = new Date();
    }

    if (updatedBy) {
        this.updatedBy = updatedBy;
    }

    await this.save();
};

labOrderSchema.methods.markAsCollected = async function (
    this: ILabOrder,
    collectedBy: mongoose.Types.ObjectId,
    notes?: string
): Promise<void> {
    this.status = 'collected';
    this.collectionDate = new Date();
    this.collectedBy = collectedBy;
    this.updatedBy = collectedBy;

    if (notes) {
        this.collectionNotes = notes;
    }

    await this.save();
};

labOrderSchema.methods.markAsCompleted = async function (this: ILabOrder): Promise<void> {
    this.status = 'completed';
    this.completedDate = new Date();
    await this.save();
};

labOrderSchema.methods.cancel = async function (
    this: ILabOrder,
    reason: string,
    cancelledBy: mongoose.Types.ObjectId
): Promise<void> {
    this.status = 'cancelled';
    this.rejectionReason = reason;
    this.updatedBy = cancelledBy;
    await this.save();
};

labOrderSchema.methods.calculateTotalCost = function (this: ILabOrder): number {
    return this.tests.reduce((total, test) => {
        return total + (test.estimatedCost || 0);
    }, 0);
};

labOrderSchema.methods.getHighestPriority = function (this: ILabOrder): 'stat' | 'urgent' | 'routine' {
    const priorityOrder = { stat: 3, urgent: 2, routine: 1 };

    return this.tests.reduce((highest, test) => {
        return priorityOrder[test.priority] > priorityOrder[highest] ? test.priority : highest;
    }, 'routine' as 'stat' | 'urgent' | 'routine');
};

labOrderSchema.methods.isOverdue = function (this: ILabOrder): boolean {
    if (!this.expectedDate || this.status === 'completed') return false;
    return new Date() > this.expectedDate;
};

labOrderSchema.methods.canBeModified = function (this: ILabOrder): boolean {
    return ['ordered'].includes(this.status);
};

// Pre-save middleware
labOrderSchema.pre('save', function (this: ILabOrder) {
    // Calculate total estimated cost if not set
    if (!this.totalEstimatedCost) {
        this.totalEstimatedCost = this.calculateTotalCost();
    }

    // Set expected date based on highest priority if not set
    if (!this.expectedDate && this.isNew) {
        const priority = this.getHighestPriority();
        const daysToAdd = priority === 'stat' ? 1 : priority === 'urgent' ? 2 : 7;
        this.expectedDate = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000);
    }
});

// Static method interface
interface ILabOrderModel extends mongoose.Model<ILabOrder> {
    generateOrderNumber(workplaceId: mongoose.Types.ObjectId): Promise<string>;
    findActiveOrders(workplaceId: mongoose.Types.ObjectId): mongoose.Query<ILabOrder[], ILabOrder>;
    findOverdueOrders(workplaceId: mongoose.Types.ObjectId): mongoose.Query<ILabOrder[], ILabOrder>;
    findByPatient(workplaceId: mongoose.Types.ObjectId, patientId: mongoose.Types.ObjectId): mongoose.Query<ILabOrder[], ILabOrder>;
    findByPriority(workplaceId: mongoose.Types.ObjectId, priority: 'stat' | 'urgent' | 'routine'): mongoose.Query<ILabOrder[], ILabOrder>;
}

// Static method to generate next order number
labOrderSchema.statics.generateOrderNumber = async function (
    workplaceId: mongoose.Types.ObjectId
): Promise<string> {
    const today = new Date();
    const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');

    const lastOrder = await this.findOne(
        {
            workplaceId,
            orderNumber: { $regex: `^LAB${datePrefix}` }
        },
        { orderNumber: 1 },
        { sort: { createdAt: -1 } }
    );

    let sequence = 1;
    if (lastOrder?.orderNumber) {
        const match = lastOrder.orderNumber.match(/(\d+)$/);
        if (match) {
            sequence = parseInt(match[1], 10) + 1;
        }
    }

    return `LAB${datePrefix}${sequence.toString().padStart(3, '0')}`;
};

// Static methods
labOrderSchema.statics.findActiveOrders = function (workplaceId: mongoose.Types.ObjectId) {
    return this.find({
        workplaceId,
        status: { $in: ['ordered', 'collected', 'processing'] },
        isDeleted: false
    }).sort({ orderDate: -1 });
};

labOrderSchema.statics.findOverdueOrders = function (workplaceId: mongoose.Types.ObjectId) {
    return this.find({
        workplaceId,
        expectedDate: { $lt: new Date() },
        status: { $in: ['ordered', 'collected', 'processing'] },
        isDeleted: false
    }).sort({ expectedDate: 1 });
};

labOrderSchema.statics.findByPatient = function (
    workplaceId: mongoose.Types.ObjectId,
    patientId: mongoose.Types.ObjectId
) {
    return this.find({
        workplaceId,
        patientId,
        isDeleted: false
    }).sort({ orderDate: -1 });
};

labOrderSchema.statics.findByPriority = function (
    workplaceId: mongoose.Types.ObjectId,
    priority: 'stat' | 'urgent' | 'routine'
) {
    return this.find({
        workplaceId,
        'tests.priority': priority,
        status: { $in: ['ordered', 'collected', 'processing'] },
        isDeleted: false
    }).sort({ orderDate: -1 });
};

export default mongoose.model<ILabOrder, ILabOrderModel>('LabOrder', labOrderSchema);