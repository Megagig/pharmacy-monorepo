import { Request, Response } from "express";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import Message from "../models/Message";
import Conversation from "../models/Conversation";
import { AuditLog } from "../models/AuditLog";
import logger from "../utils/logger";
import { FileUploadService } from "../services/fileUploadService";
import { AuthenticatedRequest } from "../types/auth";

interface FileUploadData {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  secureUrl: string;
  publicId: string;
  uploadedAt: Date;
}

export class CommunicationFileController {
  /**
   * Upload file for communication
   */
  static async uploadFile(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const { conversationId } = req.body;
      const userId = req.user?._id;
      const workplaceId = req.user?.workplaceId;

      if (!userId || !workplaceId) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      if (!conversationId) {
        res.status(400).json({ error: "Conversation ID is required" });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      // Verify user has access to the conversation
      const conversation = await Conversation.findOne({
        _id: conversationId,
        workplaceId,
        "participants.userId": userId,
      });

      if (!conversation) {
        res.status(403).json({ error: "Access denied to this conversation" });
        return;
      }

      // Process the uploaded file with security validation
      const processResult = await FileUploadService.processUploadedFile(
        req.file,
      );

      if (!processResult.success) {
        res.status(400).json({ error: processResult.error });
        return;
      }

      // Upload to Cloudinary for secure storage
      const cloudinaryResult = await cloudinary.uploader.upload(req.file.path, {
        folder: `communication-files/${workplaceId}`,
        resource_type: "auto",
        access_mode: "authenticated",
        type: "authenticated",
        secure: true,
        transformation: [{ quality: "auto" }, { fetch_format: "auto" }],
      });

      // Clean up local file
      await FileUploadService.deleteFile(req.file.path);

      // Create file data
      const fileData: FileUploadData = {
        fileName: cloudinaryResult.public_id,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: cloudinaryResult.url,
        secureUrl: cloudinaryResult.secure_url,
        publicId: cloudinaryResult.public_id,
        uploadedAt: new Date(),
      };

      // Log file upload for audit
      await AuditLog.create({
        action: "file_uploaded",
        userId,
        targetId: conversationId,
        targetType: "conversation",
        details: {
          conversationId,
          fileName: fileData.originalName,
          fileSize: fileData.size,
          mimeType: fileData.mimeType,
          publicId: fileData.publicId,
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent") || "",
        workplaceId,
        timestamp: new Date(),
      });

      logger.info("File uploaded successfully", {
        userId,
        conversationId,
        fileName: fileData.originalName,
        fileSize: fileData.size,
      });

      res.status(201).json({
        success: true,
        message: "File uploaded successfully",
        file: {
          id: fileData.publicId,
          fileName: fileData.fileName,
          originalName: fileData.originalName,
          mimeType: fileData.mimeType,
          size: fileData.size,
          secureUrl: fileData.secureUrl,
          uploadedAt: fileData.uploadedAt,
        },
      });
    } catch (error: any) {
      logger.error("File upload failed", {
        error: error.message,
        userId: req.user?._id,
        conversationId: req.body.conversationId,
      });

      // Clean up file on error
      if (req.file?.path) {
        try {
          await FileUploadService.deleteFile(req.file.path);
        } catch (cleanupError) {
          logger.error("Failed to cleanup file after error", {
            error: cleanupError,
          });
        }
      }

      res.status(500).json({
        error: "File upload failed",
        message: error.message,
      });
    }
  }

  /**
   * Download file with access control
   */
  static async downloadFile(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const { fileId } = req.params;

      if (!fileId || typeof fileId !== "string") {
        res.status(400).json({ error: "Valid file ID is required" });
        return;
      }
      const userId = req.user?._id;
      const workplaceId = req.user?.workplaceId;

      if (!userId || !workplaceId) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      // Find message containing this file
      const message = await Message.findOne({
        "content.attachments.fileId": fileId,
      }).populate("conversationId");

      if (!message) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      // Verify user has access to the conversation
      const conversation = await Conversation.findOne({
        _id: message.conversationId,
        workplaceId,
        "participants.userId": userId,
      });

      if (!conversation) {
        res.status(403).json({ error: "Access denied to this file" });
        return;
      }

      // Find the specific attachment
      const attachment = message.content.attachments?.find(
        (att) => att.fileId === fileId,
      );
      if (!attachment) {
        res.status(404).json({ error: "File attachment not found" });
        return;
      }

      // Generate secure download URL from Cloudinary
      const downloadUrl = cloudinary.url(fileId, {
        resource_type: "auto",
        type: "authenticated",
        sign_url: true,
        secure: true,
      });

      // Log file download for audit
      await AuditLog.create({
        action: "file_downloaded",
        userId,
        targetId: message._id,
        targetType: "message",
        details: {
          conversationId: message.conversationId,
          messageId: message._id,
          fileName: attachment.fileName,
          fileId,
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent") || "",
        workplaceId,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        downloadUrl,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        size: attachment.fileSize,
      });
    } catch (error: any) {
      logger.error("File download failed", {
        error: error.message,
        userId: req.user?._id,
        fileId: req.params.fileId,
      });

      res.status(500).json({
        error: "File download failed",
        message: error.message,
      });
    }
  }

  /**
   * Delete file with access control
   */
  static async deleteFile(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const { fileId } = req.params;
      const userId = req.user?._id;
      const workplaceId = req.user?.workplaceId;

      if (!userId || !workplaceId) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      // Find message containing this file
      const message = await Message.findOne({
        "content.attachments.fileId": fileId,
      });

      if (!message) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      // Verify user is the sender or has admin permissions
      if (
        message.senderId.toString() !== userId &&
        req.user?.role !== "super_admin"
      ) {
        res.status(403).json({
          error: "Access denied. Only file owner or admin can delete files",
        });
        return;
      }

      // Verify user has access to the conversation
      const conversation = await Conversation.findOne({
        _id: message.conversationId,
        workplaceId,
        "participants.userId": userId,
      });

      if (!conversation) {
        res.status(403).json({ error: "Access denied to this conversation" });
        return;
      }

      // Find the specific attachment
      const attachmentIndex = message.content.attachments?.findIndex(
        (att) => att.fileId === fileId,
      );
      if (attachmentIndex === -1 || attachmentIndex === undefined) {
        res.status(404).json({ error: "File attachment not found" });
        return;
      }

      const attachment = message.content.attachments![attachmentIndex];

      // Delete from Cloudinary
      if (!fileId || typeof fileId !== "string") {
        res.status(400).json({ error: "Valid file ID is required" });
        return;
      }

      await cloudinary.uploader.destroy(fileId, { resource_type: "auto" });

      // Remove attachment from message
      message.content.attachments!.splice(attachmentIndex, 1);
      await message.save();

      // Log file deletion for audit
      await AuditLog.create({
        action: "file_deleted",
        userId,
        targetId: message._id,
        targetType: "message",
        details: {
          conversationId: message.conversationId,
          messageId: message._id,
          fileName: attachment?.fileName || "unknown",
          fileId,
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent") || "",
        workplaceId,
        timestamp: new Date(),
      });

      logger.info("File deleted successfully", {
        userId,
        fileId,
        fileName: attachment?.fileName || "unknown",
      });

      res.json({
        success: true,
        message: "File deleted successfully",
      });
    } catch (error: any) {
      logger.error("File deletion failed", {
        error: error.message,
        userId: req.user?._id,
        fileId: req.params.fileId,
      });

      res.status(500).json({
        error: "File deletion failed",
        message: error.message,
      });
    }
  }

  /**
   * Get file metadata
   */
  static async getFileMetadata(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const { fileId } = req.params;
      const userId = req.user?._id;
      const workplaceId = req.user?.workplaceId;

      if (!userId || !workplaceId) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      // Find message containing this file
      const message = await Message.findOne({
        "content.attachments.fileId": fileId,
      }).populate("senderId", "firstName lastName role");

      if (!message) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      // Verify user has access to the conversation
      const conversation = await Conversation.findOne({
        _id: message.conversationId,
        workplaceId,
        "participants.userId": userId,
      });

      if (!conversation) {
        res.status(403).json({ error: "Access denied to this file" });
        return;
      }

      // Find the specific attachment
      const attachment = message.content.attachments?.find(
        (att) => att.fileId === fileId,
      );
      if (!attachment) {
        res.status(404).json({ error: "File attachment not found" });
        return;
      }

      res.json({
        success: true,
        file: {
          id: attachment.fileId,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          size: attachment.fileSize,
          uploadedAt: message.createdAt,
          uploadedBy: message.senderId,
          conversationId: message.conversationId,
          messageId: message._id,
        },
      });
    } catch (error: any) {
      logger.error("Get file metadata failed", {
        error: error.message,
        userId: req.user?._id,
        fileId: req.params.fileId,
      });

      res.status(500).json({
        error: "Failed to get file metadata",
        message: error.message,
      });
    }
  }

  /**
   * List files in a conversation
   */
  static async listConversationFiles(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const { conversationId } = req.params;
      const userId = req.user?._id;
      const workplaceId = req.user?.workplaceId;
      const { page = 1, limit = 20, fileType } = req.query;

      if (!userId || !workplaceId) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      // Verify user has access to the conversation
      const conversation = await Conversation.findOne({
        _id: conversationId,
        workplaceId,
        "participants.userId": userId,
      });

      if (!conversation) {
        res.status(403).json({ error: "Access denied to this conversation" });
        return;
      }

      // Build query for messages with attachments
      const query: any = {
        conversationId,
        "content.attachments": { $exists: true, $ne: [] },
      };

      // Filter by file type if specified
      if (fileType) {
        query["content.attachments.mimeType"] = new RegExp(
          fileType as string,
          "i",
        );
      }

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const messages = await Message.find(query)
        .populate("senderId", "firstName lastName role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

      const total = await Message.countDocuments(query);

      // Extract file information
      const files = messages.flatMap(
        (message) =>
          message.content.attachments?.map((attachment) => ({
            id: attachment.fileId,
            fileName: attachment.fileName,
            mimeType: attachment.mimeType,
            size: attachment.fileSize,
            secureUrl: attachment.secureUrl,
            uploadedAt: message.createdAt,
            uploadedBy: message.senderId,
            messageId: message._id,
          })) || [],
      );

      res.json({
        success: true,
        files,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (error: any) {
      logger.error("List conversation files failed", {
        error: error.message,
        userId: req.user?._id,
        conversationId: req.params.conversationId,
      });

      res.status(500).json({
        error: "Failed to list conversation files",
        message: error.message,
      });
    }
  }
}

export default CommunicationFileController;
