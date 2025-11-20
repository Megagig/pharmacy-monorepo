import mongoose, { Document, Schema } from 'mongoose';
import { tenancyGuardPlugin, addAuditFields } from '../../../utils/tenancyGuard';

export interface IManualLabTest {
    name: string;
    code: string;
    loincCode?: string;
    specimenType: string;
    unit?: string;
    refRange?: string;
    category?: string;
}

export interface IManualLabOrder extends Document {
    _id: mongoose.Types.ObjectId;
    orderId: string; // Unique identifier (LAB-YYYY-XXXX)
    patientId: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId;
    locationId?: string;
    orderedBy: mongoose.Types.ObjectId;

    tests: IManualLabTest[];
    indication: string;
    requisitionFormUrl: string;
    barcodeData: string; // Secure token for QR/barcode

    status: 'requested' | 'sample_collected' | 'result_awaited' | 'completed' | 'referred';
    priority?: 'routine' | 'urgent' | 'stat';
    notes?: string;

    // Consent and compliance
    consentObtained: boolean;
    consentTimestamp: Date;
    consentObtainedBy: mongoose.Types.ObjectId;

    // Audit fields (added by addAuditFields)
    createdAt: Date;
    updatedAt: Date;
    createdBy: mongoose.Types.ObjectId;
    updatedBy?: mongoose.Types.ObjectId;
    isDeleted: boolean;

    // Instance methods
    updateStatus(status: IManualLabOrder['status'], updatedBy?: mongoose.Types.ObjectId): Promise<void>;
    generateOrderId(workplaceCode: string): Promise<string>;
    canBeModified(): boolean;
    isActive(): boolean;
}

const manualLabTestSchema = new Schema({
    name: {
        type: String,
        required: [true, 'Test name is required'],
        trim: true,
        maxlength: [200, 'Test name cannot exceed 200 characters'],
        index: true
    },
    code: {
        type: String,
        required: [true, 'Test code is required'],
        trim: true,
        uppercase: true,
        maxlength: [20, 'Test code cannot exceed 20 characters'],
        index: true
    },
    loincCode: {
        type: String,
        trim: true,
        maxlength: [20, 'LOINC code cannot exceed 20 characters'],
        index: true,
        sparse: true
    },
    specimenType: {
        type: String,
        required: [true, 'Specimen type is required'],
        trim: true,
        maxlength: [100, 'Specimen type cannot exceed 100 characters']
    },
    unit: {
        type: String,
        trim: true,
        maxlength: [20, 'Unit cannot exceed 20 characters']
    },
    refRange: {
        type: String,
        trim: true,
        maxlength: [100, 'Reference range cannot exceed 100 characters']
    },
    category: {
        type: String,
        trim: true,
        maxlength: [100, 'Category cannot exceed 100 characters'],
        index: true
    }
}, { _id: false });

const manualLabOrderSchema = new Schema({
    orderId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true,
        maxlength: [20, 'Order ID cannot exceed 20 characters'],
        index: true
    },
    patientId: {
        type: Schema.Types.ObjectId,
        ref: 'Patient',
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
    orderedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    tests: {
        type: [manualLabTestSchema],
        required: true,
        validate: {
            validator: function (tests: IManualLabTest[]) {
                return tests.length > 0;
            },
            message: 'At least one test is required'
        }
    },
    indication: {
        type: String,
        required: [true, 'Clinical indication is required'],
        trim: true,
        maxlength: [1000, 'Indication cannot exceed 1000 characters']
    },
    requisitionFormUrl: {
        type: String,
        required: true,
        trim: true,
        maxlength: [500, 'Requisition form URL cannot exceed 500 characters']
    },
    barcodeData: {
        type: String,
        required: true,
        unique: true,
        index: true,
        maxlength: [500, 'Barcode data cannot exceed 500 characters']
    },

    status: {
        type: String,
        enum: ['requested', 'sample_collected', 'result_awaited', 'completed', 'referred'],
        default: 'requested',
        required: true,
        index: true
    },
    priority: {
        type: String,
        enum: ['routine', 'urgent', 'stat'],
        default: 'routine',
        index: true
    },
    notes: {
        type: String,
        trim: true,
        maxlength: [1000, 'Notes cannot exceed 1000 characters']
    },

    // Consent and compliance
    consentObtained: {
        type: Boolean,
        required: true,
        validate: {
            validator: function (consent: boolean) {
                return consent === true;
            },
            message: 'Patient consent is required for manual lab orders'
        }
    },
    consentTimestamp: {
        type: Date,
        required: true,
        default: Date.now
    },
    consentObtainedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Add audit fields (createdBy, updatedBy, isDeleted)
addAuditFields(manualLabOrderSchema);

// Apply tenancy guard plugin
manualLabOrderSchema.plugin(tenancyGuardPlugin);

// Compound indexes for efficient querying
manualLabOrderSchema.index({ workplaceId: 1, orderId: 1 }, { unique: true });
manualLabOrderSchema.index({ workplaceId: 1, patientId: 1, createdAt: -1 });
manualLabOrderSchema.index({ workplaceId: 1, status: 1, createdAt: -1 });
manualLabOrderSchema.index({ workplaceId: 1, orderedBy: 1, createdAt: -1 });
manualLabOrderSchema.index({ workplaceId: 1, locationId: 1, status: 1 }, { sparse: true });
manualLabOrderSchema.index({ workplaceId: 1, priority: 1, createdAt: -1 });
manualLabOrderSchema.index({ workplaceId: 1, isDeleted: 1, createdAt: -1 });
manualLabOrderSchema.index({ barcodeData: 1 }, { unique: true });
manualLabOrderSchema.index({ createdAt: -1 });

// Text index for searching
manualLabOrderSchema.index({
    orderId: 'text',
    indication: 'text',
    'tests.name': 'text',
    notes: 'text'
});

// Virtual for checking if order is active
manualLabOrderSchema.virtual('isActiveOrder').get(function (this: IManualLabOrder) {
    return ['requested', 'sample_collected', 'result_awaited'].includes(this.status);
});

// Instance methods
manualLabOrderSchema.methods.updateStatus = async function (
    this: IManualLabOrder,
    status: IManualLabOrder['status'],
    updatedBy?: mongoose.Types.ObjectId
): Promise<void> {
    this.status = status;

    if (updatedBy) {
        this.updatedBy = updatedBy;
    }

    await this.save();
};

manualLabOrderSchema.methods.canBeModified = function (this: IManualLabOrder): boolean {
    return this.status === 'requested';
};

manualLabOrderSchema.methods.isActive = function (this: IManualLabOrder): boolean {
    return ['requested', 'sample_collected', 'result_awaited'].includes(this.status);
};

// Pre-save middleware
manualLabOrderSchema.pre('save', function (this: IManualLabOrder) {
    // Ensure consent timestamp is set when consent is obtained
    if (this.consentObtained && !this.consentTimestamp) {
        this.consentTimestamp = new Date();
    }
});

// Static method to generate next order ID
manualLabOrderSchema.statics.generateNextOrderId = async function (
    workplaceId: mongoose.Types.ObjectId
): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const datePrefix = `LAB-${year}-`;

    const lastOrder = await this.findOne(
        {
            workplaceId,
            orderId: { $regex: `^${datePrefix}` }
        },
        { orderId: 1 },
        { sort: { createdAt: -1 } }
    );

    let sequence = 1;
    if (lastOrder?.orderId) {
        const match = lastOrder.orderId.match(/LAB-\d{4}-(\d+)$/);
        if (match) {
            sequence = parseInt(match[1], 10) + 1;
        }
    }

    return `${datePrefix}${sequence.toString().padStart(4, '0')}`;
};

// Static methods for querying
manualLabOrderSchema.statics.findActiveOrders = function (workplaceId: mongoose.Types.ObjectId) {
    return this.find({
        workplaceId,
        status: { $in: ['requested', 'sample_collected', 'result_awaited'] },
        isDeleted: false
    }).sort({ createdAt: -1 });
};

manualLabOrderSchema.statics.findByPatient = function (
    workplaceId: mongoose.Types.ObjectId,
    patientId: mongoose.Types.ObjectId
) {
    return this.find({
        workplaceId,
        patientId,
        isDeleted: false
    }).sort({ createdAt: -1 });
};

manualLabOrderSchema.statics.findByBarcodeData = function (barcodeData: string) {
    return this.findOne({
        barcodeData,
        isDeleted: false
    });
};

manualLabOrderSchema.statics.findByStatus = function (
    workplaceId: mongoose.Types.ObjectId,
    status: IManualLabOrder['status']
) {
    return this.find({
        workplaceId,
        status,
        isDeleted: false
    }).sort({ createdAt: -1 });
};

// Static method interface
interface IManualLabOrderModel extends mongoose.Model<IManualLabOrder> {
    generateNextOrderId(workplaceId: mongoose.Types.ObjectId): Promise<string>;
    findActiveOrders(workplaceId: mongoose.Types.ObjectId): mongoose.Query<IManualLabOrder[], IManualLabOrder>;
    findByPatient(workplaceId: mongoose.Types.ObjectId, patientId: mongoose.Types.ObjectId): mongoose.Query<IManualLabOrder[], IManualLabOrder>;
    findByBarcodeData(barcodeData: string): mongoose.Query<IManualLabOrder | null, IManualLabOrder>;
    findByStatus(workplaceId: mongoose.Types.ObjectId, status: IManualLabOrder['status']): mongoose.Query<IManualLabOrder[], IManualLabOrder>;
}

export default mongoose.model<IManualLabOrder, IManualLabOrderModel>('ManualLabOrder', manualLabOrderSchema);