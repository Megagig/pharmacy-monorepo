import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Joi from "joi";
import { AuthRequest } from "../types/auth";
import logger from "../utils/logger";
import Conversation from "../models/Conversation";
import Message from "../models/Message";

// Validation schemas for communication models
export const conversationValidationSchema = Joi.object({
  title: Joi.string().trim().max(200).optional(),
  type: Joi.string()
    .valid("direct", "group", "patient_query", "clinical_consultation")
    .required(),
  participants: Joi.array()
    .items(
      Joi.object({
        userId: Joi.string()
          .pattern(/^[0-9a-fA-F]{24}$/)
          .required(),
        role: Joi.string()
          .valid(
            "pharmacist",
            "doctor",
            "patient",
            "pharmacy_team",
            "intern_pharmacist",
          )
          .required(),
        permissions: Joi.array()
          .items(
            Joi.string().valid(
              "read_messages",
              "send_messages",
              "add_participants",
              "remove_participants",
              "edit_conversation",
              "delete_conversation",
              "upload_files",
              "view_patient_data",
              "manage_clinical_context",
            ),
          )
          .optional(),
      }),
    )
    .min(1)
    .max(50)
    .required(),
  patientId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional(),
  caseId: Joi.string().trim().max(100).optional(),
  status: Joi.string()
    .valid("active", "archived", "resolved", "closed")
    .optional(),
  priority: Joi.string().valid("low", "normal", "high", "urgent").optional(),
  tags: Joi.array().items(Joi.string().trim().max(50)).optional(),
  metadata: Joi.object({
    isEncrypted: Joi.boolean().default(true),
    encryptionKeyId: Joi.string().optional(),
    clinicalContext: Joi.object({
      diagnosis: Joi.string().trim().max(500).optional(),
      medications: Joi.array()
        .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
        .optional(),
      conditions: Joi.array().items(Joi.string().trim().max(200)).optional(),
      interventionIds: Joi.array()
        .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
        .optional(),
    }).optional(),
  }).optional(),
});

export const messageValidationSchema = Joi.object({
  conversationId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required(),
  content: Joi.object({
    text: Joi.string().trim().max(10000).when("type", {
      is: "text",
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    type: Joi.string()
      .valid("text", "file", "image", "clinical_note", "system", "voice_note")
      .required(),
    attachments: Joi.array()
      .items(
        Joi.object({
          fileId: Joi.string().required(),
          fileName: Joi.string().trim().max(255).required(),
          fileSize: Joi.number()
            .min(0)
            .max(100 * 1024 * 1024)
            .required(), // 100MB max
          mimeType: Joi.string()
            .valid(
              "image/jpeg",
              "image/png",
              "image/gif",
              "image/webp",
              "application/pdf",
              "application/msword",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              "application/vnd.ms-excel",
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "text/plain",
              "text/csv",
              "audio/mpeg",
              "audio/wav",
              "audio/ogg",
              "video/mp4",
              "video/webm",
            )
            .required(),
          secureUrl: Joi.string().uri().required(),
          thumbnailUrl: Joi.string().uri().optional(),
        }),
      )
      .when("type", {
        is: Joi.string().valid("file", "image"),
        then: Joi.array().required().min(1),
        otherwise: Joi.optional(),
      }),
    metadata: Joi.object({
      originalText: Joi.string().optional(),
      clinicalData: Joi.object({
        patientId: Joi.string()
          .pattern(/^[0-9a-fA-F]{24}$/)
          .optional(),
        interventionId: Joi.string()
          .pattern(/^[0-9a-fA-F]{24}$/)
          .optional(),
        medicationId: Joi.string()
          .pattern(/^[0-9a-fA-F]{24}$/)
          .optional(),
      }).optional(),
      systemAction: Joi.object({
        action: Joi.string()
          .valid(
            "participant_added",
            "participant_removed",
            "conversation_created",
            "conversation_archived",
            "conversation_resolved",
            "priority_changed",
            "clinical_context_updated",
            "file_shared",
            "intervention_linked",
          )
          .required(),
        performedBy: Joi.string()
          .pattern(/^[0-9a-fA-F]{24}$/)
          .required(),
        timestamp: Joi.date().required(),
      }).when("..type", {
        is: "system",
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
    }).optional(),
  }).required(),
  threadId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional(),
  parentMessageId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional(),
  mentions: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .optional(),
  priority: Joi.string().valid("normal", "high", "urgent").optional(),
});

export const notificationValidationSchema = Joi.object({
  userId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required(),
  type: Joi.string()
    .valid(
      "new_message",
      "mention",
      "therapy_update",
      "clinical_alert",
      "conversation_invite",
      "file_shared",
      "intervention_assigned",
      "patient_query",
      "urgent_message",
      "system_notification",
    )
    .required(),
  title: Joi.string().trim().max(200).required(),
  content: Joi.string().trim().max(1000).required(),
  data: Joi.object({
    conversationId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional(),
    messageId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional(),
    senderId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional(),
    patientId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional(),
    interventionId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional(),
    actionUrl: Joi.string().uri({ relativeOnly: true }).optional(),
    metadata: Joi.object().optional(),
  }).required(),
  priority: Joi.string()
    .valid("low", "normal", "high", "urgent", "critical")
    .optional(),
  deliveryChannels: Joi.object({
    inApp: Joi.boolean().default(true),
    email: Joi.boolean().default(false),
    sms: Joi.boolean().default(false),
    push: Joi.boolean().default(true),
  }).required(),
  scheduledFor: Joi.date().min("now").optional(),
  expiresAt: Joi.date().greater("now").optional(),
  groupKey: Joi.string().max(100).optional(),
  batchId: Joi.string().max(100).optional(),
});

export const auditLogValidationSchema = Joi.object({
  action: Joi.string()
    .valid(
      "message_sent",
      "message_read",
      "message_edited",
      "message_deleted",
      "conversation_created",
      "conversation_updated",
      "conversation_archived",
      "participant_added",
      "participant_removed",
      "participant_left",
      "file_uploaded",
      "file_downloaded",
      "file_deleted",
      "notification_sent",
      "notification_read",
      "encryption_key_rotated",
      "conversation_exported",
      "bulk_message_delete",
      "conversation_search",
      "message_search",
      "clinical_context_updated",
      "priority_changed",
    )
    .required(),
  targetId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required(),
  targetType: Joi.string()
    .valid("conversation", "message", "user", "file", "notification")
    .required(),
  details: Joi.object({
    conversationId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional(),
    messageId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional(),
    patientId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional(),
    participantIds: Joi.array()
      .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
      .optional(),
    fileId: Joi.string().optional(),
    fileName: Joi.string().max(255).optional(),
    oldValues: Joi.object().optional(),
    newValues: Joi.object().optional(),
    metadata: Joi.object().optional(),
  }).required(),
  riskLevel: Joi.string().valid("low", "medium", "high", "critical").optional(),
  complianceCategory: Joi.string()
    .valid(
      "communication_security",
      "data_access",
      "patient_privacy",
      "message_integrity",
      "file_security",
      "audit_trail",
      "encryption_compliance",
      "notification_delivery",
    )
    .optional(),
  success: Joi.boolean().default(true),
  errorMessage: Joi.string().max(1000).optional(),
  duration: Joi.number().min(0).max(300000).optional(), // 5 minutes max
});

// Middleware functions
export const validateConversation = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const { error } = conversationValidationSchema.validate(req.body, {
    abortEarly: false,
  });

  if (error) {
    res.status(400).json({
      success: false,
      message: "Validation error",
      errors: error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      })),
    });
    return;
  }

  // Additional business logic validation
  const { type, patientId, participants } = req.body;

  // Patient ID is required for patient_query and clinical_consultation
  if (["patient_query", "clinical_consultation"].includes(type) && !patientId) {
    res.status(400).json({
      success: false,
      message:
        "Patient ID is required for patient queries and clinical consultations",
    });
    return;
  }

  // Validate participant roles for patient conversations
  if (type === "patient_query") {
    const hasPatient = participants.some((p: any) => p.role === "patient");
    const hasHealthcareProvider = participants.some((p: any) =>
      ["pharmacist", "doctor"].includes(p.role),
    );

    if (!hasPatient || !hasHealthcareProvider) {
      res.status(400).json({
        success: false,
        message:
          "Patient queries must include both a patient and a healthcare provider",
      });
      return;
    }
  }

  next();
};

export const validateMessage = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const { error } = messageValidationSchema.validate(req.body, {
    abortEarly: false,
  });

  if (error) {
    res.status(400).json({
      success: false,
      message: "Validation error",
      errors: error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      })),
    });
    return;
  }

  // Additional validation for mentions
  const { mentions, content } = req.body;
  if (mentions && mentions.length > 0) {
    // Validate that mentioned users are referenced in the message text
    if (content.type === "text" && content.text) {
      const mentionPattern = /@\w+/g;
      const textMentions = content.text.match(mentionPattern) || [];

      if (textMentions.length !== mentions.length) {
        res.status(400).json({
          success: false,
          message: "Number of @mentions in text must match mentions array",
        });
        return;
      }
    }
  }

  next();
};

export const validateNotification = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const { error } = notificationValidationSchema.validate(req.body, {
    abortEarly: false,
  });

  if (error) {
    res.status(400).json({
      success: false,
      message: "Validation error",
      errors: error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      })),
    });
    return;
  }

  // Validate delivery channels - at least one must be enabled
  const { deliveryChannels } = req.body;
  const hasEnabledChannel = Object.values(deliveryChannels).some(
    (enabled) => enabled,
  );

  if (!hasEnabledChannel) {
    res.status(400).json({
      success: false,
      message: "At least one delivery channel must be enabled",
    });
    return;
  }

  next();
};

export const validateAuditLog = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const { error } = auditLogValidationSchema.validate(req.body, {
    abortEarly: false,
  });

  if (error) {
    res.status(400).json({
      success: false,
      message: "Validation error",
      errors: error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      })),
    });
    return;
  }

  next();
};

// Conversation access validation middleware
export const validateConversationAccess = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const userId = req.user?.id;
    const workplaceId = req.user?.workplaceId;

    if (!userId || !workplaceId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
      res.status(400).json({
        success: false,
        message: "Invalid conversation ID",
      });
      return;
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      workplaceId,
      "participants.userId": userId,
      "participants.leftAt": { $exists: false },
    });

    if (!conversation) {
      res.status(404).json({
        success: false,
        message: "Conversation not found or access denied",
      });
      return;
    }

    // Add conversation to request for use in controllers
    (req as any).conversation = conversation;
    next();
  } catch (error) {
    logger.error("Conversation access validation error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Message access validation middleware
export const validateMessageAccess = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { messageId } = req.params;
    const userId = req.user?.id;
    const workplaceId = req.user?.workplaceId;

    if (!userId || !workplaceId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) {
      res.status(400).json({
        success: false,
        message: "Invalid message ID",
      });
      return;
    }

    const message =
      await Message.findById(messageId).populate("conversationId");

    if (!message) {
      res.status(404).json({
        success: false,
        message: "Message not found",
      });
      return;
    }

    // Check if user has access to the conversation
    const conversation = await Conversation.findOne({
      _id: message.conversationId,
      workplaceId,
      "participants.userId": userId,
      "participants.leftAt": { $exists: false },
    });

    if (!conversation) {
      res.status(403).json({
        success: false,
        message: "Access denied to this message",
      });
      return;
    }

    // Add message and conversation to request
    (req as any).message = message;
    (req as any).conversation = conversation;
    next();
  } catch (error) {
    logger.error("Message access validation error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// File upload validation middleware
export const validateFileUpload = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const files = req.files as any[] | undefined;
    const file = req.file as any | undefined;

    // Check if any files were uploaded
    if (!files && !file) {
      res.status(400).json({
        success: false,
        message: "No files uploaded",
      });
      return;
    }

    const filesToValidate = files || (file ? [file] : []);

    // Validate each file
    for (const uploadedFile of filesToValidate) {
      // File size validation (100MB max)
      if (uploadedFile.size > 100 * 1024 * 1024) {
        res.status(400).json({
          success: false,
          message: `File ${uploadedFile.originalname} exceeds maximum size of 100MB`,
        });
        return;
      }

      // MIME type validation
      const allowedMimeTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain",
        "text/csv",
        "audio/mpeg",
        "audio/wav",
        "audio/ogg",
        "video/mp4",
        "video/webm",
      ];

      if (!allowedMimeTypes.includes(uploadedFile.mimetype)) {
        res.status(400).json({
          success: false,
          message: `File type ${uploadedFile.mimetype} is not allowed`,
        });
        return;
      }

      // Filename validation
      if (uploadedFile.originalname.length > 255) {
        res.status(400).json({
          success: false,
          message: `Filename ${uploadedFile.originalname} is too long`,
        });
        return;
      }

      // Security: Check for malicious file extensions
      const dangerousExtensions = [
        ".exe",
        ".bat",
        ".cmd",
        ".scr",
        ".pif",
        ".com",
      ];
      const fileExtension = uploadedFile.originalname
        .toLowerCase()
        .substr(uploadedFile.originalname.lastIndexOf("."));

      if (dangerousExtensions.includes(fileExtension)) {
        res.status(400).json({
          success: false,
          message: `File extension ${fileExtension} is not allowed`,
        });
        return;
      }
    }

    next();
  } catch (error) {
    logger.error("File upload validation error:", error);
    res.status(500).json({
      success: false,
      message: "File validation failed",
    });
  }
};

// Rate limiting validation for messages
export const validateMessageRateLimit = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const workplaceId = req.user?.workplaceId;

    if (!userId || !workplaceId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // Check message count in last minute
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const messageCount = await Message.countDocuments({
      senderId: userId,
      workplaceId,
      createdAt: { $gte: oneMinuteAgo },
    });

    // Allow max 30 messages per minute per user
    if (messageCount >= 30) {
      res.status(429).json({
        success: false,
        message:
          "Rate limit exceeded. Please wait before sending more messages.",
        retryAfter: 60,
      });
      return;
    }

    next();
  } catch (error) {
    logger.error("Message rate limit validation error:", error);
    res.status(500).json({
      success: false,
      message: "Rate limit validation failed",
    });
  }
};
