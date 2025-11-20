import mongoose, { Document, Schema } from 'mongoose';

export interface IReportTemplate extends Document {
    _id: string;
    name: string;
    description: string;
    reportType: string;
    layout: {
        sections: Array<{
            id: string;
            type: 'chart' | 'table' | 'kpi' | 'text';
            title: string;
            position: { x: number; y: number; width: number; height: number };
            config: any;
        }>;
        theme: {
            colorPalette: string[];
            fontFamily: string;
            fontSize: number;
        };
        responsive: boolean;
    };
    filters: Array<{
        key: string;
        label: string;
        type: 'date' | 'select' | 'multiselect' | 'text' | 'number';
        options?: Array<{ value: string; label: string }>;
        defaultValue?: any;
        required: boolean;
        validation?: {
            min?: number;
            max?: number;
            pattern?: string;
        };
    }>;
    charts: Array<{
        id: string;
        type: string;
        title: string;
        dataSource: string;
        config: {
            xAxis?: string;
            yAxis?: string;
            groupBy?: string;
            aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
            colors?: string[];
            showLegend?: boolean;
            showTooltip?: boolean;
            animations?: boolean;
        };
        styling: {
            width: number;
            height: number;
            backgroundColor?: string;
            borderRadius?: number;
            padding?: number;
        };
    }>;
    tables: Array<{
        id: string;
        title: string;
        dataSource: string;
        columns: Array<{
            key: string;
            label: string;
            type: 'text' | 'number' | 'date' | 'currency' | 'percentage';
            format?: string;
            sortable: boolean;
            filterable: boolean;
        }>;
        pagination: {
            enabled: boolean;
            pageSize: number;
        };
        styling: {
            striped: boolean;
            bordered: boolean;
            compact: boolean;
        };
    }>;
    createdBy: mongoose.Types.ObjectId;
    workplaceId: mongoose.Types.ObjectId;
    isPublic: boolean;
    isActive: boolean;
    version: number;
    tags: string[];
    category: string;
    permissions: {
        view: string[];
        edit: string[];
        delete: string[];
    };
    usage: {
        viewCount: number;
        lastViewed: Date;
        favoriteCount: number;
    };
    createdAt: Date;
    updatedAt: Date;
}

const ReportTemplateSchema = new Schema<IReportTemplate>({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
        index: true
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500
    },
    reportType: {
        type: String,
        required: true,
        enum: [
            'patient-outcomes',
            'pharmacist-interventions',
            'therapy-effectiveness',
            'quality-improvement',
            'regulatory-compliance',
            'cost-effectiveness',
            'trend-forecasting',
            'operational-efficiency',
            'medication-inventory',
            'patient-demographics',
            'adverse-events',
            'custom'
        ],
        index: true
    },
    layout: {
        sections: [{
            id: { type: String, required: true },
            type: {
                type: String,
                required: true,
                enum: ['chart', 'table', 'kpi', 'text']
            },
            title: { type: String, required: true },
            position: {
                x: { type: Number, required: true, min: 0 },
                y: { type: Number, required: true, min: 0 },
                width: { type: Number, required: true, min: 1, max: 12 },
                height: { type: Number, required: true, min: 1 }
            },
            config: { type: Schema.Types.Mixed }
        }],
        theme: {
            colorPalette: [{ type: String }],
            fontFamily: { type: String, default: 'Inter' },
            fontSize: { type: Number, default: 14, min: 10, max: 24 }
        },
        responsive: { type: Boolean, default: true }
    },
    filters: [{
        key: { type: String, required: true },
        label: { type: String, required: true },
        type: {
            type: String,
            required: true,
            enum: ['date', 'select', 'multiselect', 'text', 'number']
        },
        options: [{
            value: { type: String, required: true },
            label: { type: String, required: true }
        }],
        defaultValue: { type: Schema.Types.Mixed },
        required: { type: Boolean, default: false },
        validation: {
            min: { type: Number },
            max: { type: Number },
            pattern: { type: String }
        }
    }],
    charts: [{
        id: { type: String, required: true },
        type: { type: String, required: true },
        title: { type: String, required: true },
        dataSource: { type: String, required: true },
        config: {
            xAxis: { type: String },
            yAxis: { type: String },
            groupBy: { type: String },
            aggregation: {
                type: String,
                enum: ['sum', 'avg', 'count', 'min', 'max'],
                default: 'count'
            },
            colors: [{ type: String }],
            showLegend: { type: Boolean, default: true },
            showTooltip: { type: Boolean, default: true },
            animations: { type: Boolean, default: true }
        },
        styling: {
            width: { type: Number, required: true, min: 200 },
            height: { type: Number, required: true, min: 200 },
            backgroundColor: { type: String },
            borderRadius: { type: Number, default: 8 },
            padding: { type: Number, default: 16 }
        }
    }],
    tables: [{
        id: { type: String, required: true },
        title: { type: String, required: true },
        dataSource: { type: String, required: true },
        columns: [{
            key: { type: String, required: true },
            label: { type: String, required: true },
            type: {
                type: String,
                enum: ['text', 'number', 'date', 'currency', 'percentage'],
                default: 'text'
            },
            format: { type: String },
            sortable: { type: Boolean, default: true },
            filterable: { type: Boolean, default: true }
        }],
        pagination: {
            enabled: { type: Boolean, default: true },
            pageSize: { type: Number, default: 10, min: 5, max: 100 }
        },
        styling: {
            striped: { type: Boolean, default: true },
            bordered: { type: Boolean, default: true },
            compact: { type: Boolean, default: false }
        }
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    workplaceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workplace',
        required: true,
        index: true
    },
    isPublic: {
        type: Boolean,
        default: false,
        index: true
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    version: {
        type: Number,
        default: 1,
        min: 1
    },
    tags: [{
        type: String,
        trim: true,
        maxlength: 50
    }],
    category: {
        type: String,
        enum: ['Clinical', 'Financial', 'Operational', 'Quality', 'Compliance', 'Analytics', 'Custom'],
        default: 'Custom',
        index: true
    },
    permissions: {
        view: [{ type: String }],
        edit: [{ type: String }],
        delete: [{ type: String }]
    },
    usage: {
        viewCount: { type: Number, default: 0 },
        lastViewed: { type: Date },
        favoriteCount: { type: Number, default: 0 }
    }
}, {
    timestamps: true,
    collection: 'reporttemplates'
});

// Indexes for performance optimization
ReportTemplateSchema.index({ workplaceId: 1, reportType: 1 });
ReportTemplateSchema.index({ workplaceId: 1, isPublic: 1, isActive: 1 });
ReportTemplateSchema.index({ createdBy: 1, workplaceId: 1 });
ReportTemplateSchema.index({ tags: 1 });
ReportTemplateSchema.index({ category: 1, isActive: 1 });
ReportTemplateSchema.index({ 'usage.viewCount': -1 });
ReportTemplateSchema.index({ createdAt: -1 });

// Text search index
ReportTemplateSchema.index({
    name: 'text',
    description: 'text',
    tags: 'text'
}, {
    weights: {
        name: 10,
        description: 5,
        tags: 3
    }
});

// Virtual for template URL
ReportTemplateSchema.virtual('templateUrl').get(function () {
    return `/api/reports/templates/${this._id}`;
});

// Pre-save middleware for validation
ReportTemplateSchema.pre('save', function (next) {
    // Validate that chart IDs are unique within the template
    const chartIds = this.charts.map(chart => chart.id);
    const uniqueChartIds = [...new Set(chartIds)];
    if (chartIds.length !== uniqueChartIds.length) {
        return next(new Error('Chart IDs must be unique within a template'));
    }

    // Validate that table IDs are unique within the template
    const tableIds = this.tables.map(table => table.id);
    const uniqueTableIds = [...new Set(tableIds)];
    if (tableIds.length !== uniqueTableIds.length) {
        return next(new Error('Table IDs must be unique within a template'));
    }

    // Validate that section IDs are unique within the template
    const sectionIds = this.layout.sections.map(section => section.id);
    const uniqueSectionIds = [...new Set(sectionIds)];
    if (sectionIds.length !== uniqueSectionIds.length) {
        return next(new Error('Section IDs must be unique within a template'));
    }

    next();
});

// Instance methods
ReportTemplateSchema.methods.incrementViewCount = function () {
    this.usage.viewCount += 1;
    this.usage.lastViewed = new Date();
    return this.save();
};

ReportTemplateSchema.methods.clone = function (newName: string, userId: mongoose.Types.ObjectId) {
    const cloned = new (this.constructor as any)({
        ...this.toObject(),
        _id: undefined,
        name: newName,
        createdBy: userId,
        version: 1,
        usage: {
            viewCount: 0,
            lastViewed: undefined,
            favoriteCount: 0
        },
        createdAt: undefined,
        updatedAt: undefined
    });

    return cloned;
};

// Static methods
ReportTemplateSchema.statics.findByReportType = function (reportType: string, workplaceId: string) {
    return this.find({
        reportType,
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
        isActive: true
    }).sort({ 'usage.viewCount': -1, createdAt: -1 });
};

ReportTemplateSchema.statics.findPublicTemplates = function (reportType?: string) {
    const query: any = { isPublic: true, isActive: true };
    if (reportType) {
        query.reportType = reportType;
    }
    return this.find(query).sort({ 'usage.viewCount': -1, createdAt: -1 });
};

ReportTemplateSchema.statics.searchTemplates = function (searchTerm: string, workplaceId: string) {
    return this.find({
        $and: [
            { workplaceId: new mongoose.Types.ObjectId(workplaceId) },
            { isActive: true },
            {
                $or: [
                    { isPublic: true },
                    { workplaceId: new mongoose.Types.ObjectId(workplaceId) }
                ]
            },
            { $text: { $search: searchTerm } }
        ]
    }, {
        score: { $meta: 'textScore' }
    }).sort({ score: { $meta: 'textScore' } });
};

export default mongoose.model<IReportTemplate>('ReportTemplate', ReportTemplateSchema);