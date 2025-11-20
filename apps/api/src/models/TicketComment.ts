import mongoose, { Document, Schema } from 'mongoose';

export interface ITicketComment extends Document {
  ticketId: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
  authorName: string;
  authorEmail: string;
  authorType: 'customer' | 'agent' | 'system';
  
  content: string;
  isInternal: boolean; // Internal notes not visible to customer
  
  attachments: {
    filename: string;
    url: string;
    uploadedAt: Date;
  }[];
  
  // Metadata
  editedAt?: Date;
  editedBy?: mongoose.Types.ObjectId;
  
  createdAt: Date;
  updatedAt: Date;
}

const ticketCommentSchema = new Schema<ITicketComment>(
  {
    ticketId: {
      type: Schema.Types.ObjectId,
      ref: 'SupportTicket',
      required: true,
      index: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
    },
    authorEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    authorType: {
      type: String,
      enum: ['customer', 'agent', 'system'],
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    isInternal: {
      type: Boolean,
      default: false,
      index: true,
    },
    attachments: [{
      filename: {
        type: String,
        required: true,
      },
      url: {
        type: String,
        required: true,
      },
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    }],
    editedAt: {
      type: Date,
    },
    editedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    collection: 'ticketcomments',
  }
);

// Indexes
ticketCommentSchema.index({ ticketId: 1, createdAt: 1 });
ticketCommentSchema.index({ authorId: 1, createdAt: -1 });
ticketCommentSchema.index({ ticketId: 1, isInternal: 1 });

// Methods
ticketCommentSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

export const TicketComment = mongoose.model<ITicketComment>('TicketComment', ticketCommentSchema);