import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { Resend } from 'resend';
import { IInvitation } from '../models/Invitation';
import { emailDeliveryService, EmailDeliveryResult } from '../services/emailDeliveryService';
import mongoose from 'mongoose';

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;
  private resend: Resend | null = null;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Initialize Resend if API key is provided
    if (process.env.RESEND_API_KEY) {
      this.resend = new Resend(process.env.RESEND_API_KEY);
    }
  }

  async loadTemplate(
    templateName: string,
    variables: Record<string, any>
  ): Promise<EmailTemplate> {
    try {
      const templatePath = path.join(
        process.cwd(),
        'src',
        'templates',
        'email',
        `${templateName}.html`
      );
      let html = fs.readFileSync(templatePath, 'utf-8');

      // Replace variables in template
      Object.keys(variables).forEach((key) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        html = html.replace(regex, variables[key]);
      });

      // Extract text content (basic implementation)
      const text = html
        .replace(/<[^>]*>/g, '')
        .replace(/\\s+/g, ' ')
        .trim();

      // Extract subject from template (assuming it's in a comment at the top)
      const subjectMatch = html.match(/<!--\\s*SUBJECT:\\s*(.+?)\\s*-->/);
      const subject: string = subjectMatch?.[1] || 'PharmacyCopilot Notification';

      return { subject, html, text };
    } catch (error) {
      console.error(`Error loading email template ${templateName}:`, error);
      return this.getDefaultTemplate(templateName, variables);
    }
  }

  private getDefaultTemplate(
    templateName: string,
    variables: Record<string, any>
  ): EmailTemplate {
    // Fallback templates
    const templates = {
      licenseApproval: {
        subject: 'License Approved - PharmacyCopilot',
        html: `
          <h2>License Approved!</h2>
          <p>Dear ${variables.firstName},</p>
          <p>Your pharmacist license has been approved and verified.</p>
          <p>License Number: <strong>${variables.licenseNumber}</strong></p>
          <p>You now have full access to all features in your account.</p>
          <br>
          <p>Best regards,<br>PharmacyCopilot Team</p>
        `,
        text: `License Approved! Dear ${variables.firstName}, Your pharmacist license has been approved and verified. License Number: ${variables.licenseNumber}. You now have full access to all features in your account.`,
      },
      licenseRejection: {
        subject: 'License Review Update - PharmacyCopilot',
        html: `
          <h2>License Review Update</h2>
          <p>Dear ${variables.firstName},</p>
          <p>We've reviewed your license submission and need additional information.</p>
          <p><strong>Reason:</strong> ${variables.reason}</p>
          <p>Please log in to your account and resubmit your license documentation.</p>
          <p>If you have questions, contact us at ${variables.supportEmail}</p>
          <br>
          <p>Best regards,<br>PharmacyCopilot Team</p>
        `,
        text: `License Review Update. Dear ${variables.firstName}, We've reviewed your license submission and need additional information. Reason: ${variables.reason}. Please log in to your account and resubmit your license documentation.`,
      },
      roleUpdate: {
        subject: 'Account Role Updated - PharmacyCopilot',
        html: `
          <h2>Account Role Updated</h2>
          <p>Dear ${variables.firstName},</p>
          <p>Your account role has been updated to: <strong>${variables.newRole}</strong></p>
          <p>Updated by: ${variables.updatedBy}</p>
          <p>This change affects your access permissions and available features.</p>
          <br>
          <p>Best regards,<br>PharmacyCopilot Team</p>
        `,
        text: `Account Role Updated. Dear ${variables.firstName}, Your account role has been updated to: ${variables.newRole}. Updated by: ${variables.updatedBy}.`,
      },
      subscriptionConfirmation: {
        subject: 'Subscription Confirmed - PharmacyCopilot',
        html: `
          <h2>Subscription Confirmed!</h2>
          <p>Dear ${variables.firstName},</p>
          <p>Thank you for subscribing to PharmacyCopilot <strong>${variables.planName}</strong> plan.</p>
          <p><strong>Amount:</strong> ₦${variables.amount}</p>
          <p><strong>Billing:</strong> ${variables.billingInterval}</p>
          <p><strong>Valid from:</strong> ${variables.startDate} to ${variables.endDate}</p>
          <p>You now have access to all premium features!</p>
          <br>
          <p>Best regards,<br>PharmacyCopilot Team</p>
        `,
        text: `Subscription Confirmed! Dear ${variables.firstName}, Thank you for subscribing to PharmacyCopilot ${variables.planName} plan. Amount: ₦${variables.amount}, Billing: ${variables.billingInterval}.`,
      },
    };

    return (
      templates[templateName as keyof typeof templates] || {
        subject: 'PharmacyCopilot Notification',
        html: '<p>This is a notification from PharmacyCopilot.</p>',
        text: 'This is a notification from PharmacyCopilot.',
      }
    );
  }

  /**
   * Send tracked email with delivery monitoring
   */
  async sendTrackedEmail(
    options: {
      to: string;
      subject: string;
      html: string;
      text?: string;
      templateName?: string;
      workspaceId?: mongoose.Types.ObjectId;
      userId?: mongoose.Types.ObjectId;
      relatedEntity?: {
        type: 'invitation' | 'subscription' | 'user' | 'workspace';
        id: mongoose.Types.ObjectId;
      };
      metadata?: Record<string, any>;
    }
  ): Promise<EmailDeliveryResult> {
    return await emailDeliveryService.sendTrackedEmail(
      {
        to: options.to,
        subject: options.subject,
        templateName: options.templateName,
        workspaceId: options.workspaceId,
        userId: options.userId,
        relatedEntity: options.relatedEntity,
        metadata: options.metadata,
      },
      {
        html: options.html,
        text: options.text,
      }
    );
  }

  async sendEmail(
    toOrOptions:
      | string
      | { to: string; subject: string; text: string; html: string },
    templateOrAttachments?: EmailTemplate | any[],
    attachments?: any[]
  ) {
    try {
      let mailOptions: any;

      // Handle object format
      if (typeof toOrOptions === 'object') {
        mailOptions = {
          from: `\"PharmacyCopilot\" <${process.env.SMTP_FROM || process.env.SMTP_USER
            }>`,
          ...toOrOptions,
          attachments: templateOrAttachments as any[],
        };
      }
      // Handle original parameter format
      else {
        mailOptions = {
          from: `\"PharmacyCopilot\" <${process.env.SMTP_FROM || process.env.SMTP_USER
            }>`,
          to: toOrOptions,
          subject: (templateOrAttachments as EmailTemplate).subject,
          text: (templateOrAttachments as EmailTemplate).text,
          html: (templateOrAttachments as EmailTemplate).html,
          attachments,
        };
      }

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Error sending email:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  // License-related emails
  async sendLicenseApprovalNotification(
    email: string,
    data: { firstName: string; licenseNumber: string; notes?: string }
  ) {
    const template = await this.loadTemplate('licenseApproval', data);
    return this.sendEmail(email, template);
  }

  async sendLicenseRejectionNotification(
    email: string,
    data: { firstName: string; reason: string; supportEmail?: string }
  ) {
    const template = await this.loadTemplate('licenseRejection', {
      ...data,
      supportEmail:
        data.supportEmail ||
        process.env.SUPPORT_EMAIL ||
        'support@PharmacyCopilot.com',
    });
    return this.sendEmail(email, template);
  }

  async sendLicenseSubmissionNotification(data: {
    userEmail: string;
    userName: string;
    licenseNumber: string;
    submittedAt: Date;
  }) {
    // Send to admin
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [
      'admin@PharmacyCopilot.com',
    ];

    const template = {
      subject: 'New License Submission - PharmacyCopilot Admin',
      html: `
        <h2>New License Submission</h2>
        <p><strong>User:</strong> ${data.userName} (${data.userEmail})</p>
        <p><strong>License Number:</strong> ${data.licenseNumber}</p>
        <p><strong>Submitted:</strong> ${data.submittedAt.toLocaleString()}</p>
        <p>Please review and approve/reject in the admin panel.</p>
      `,
      text: `New License Submission from ${data.userName} (${data.userEmail
        }). License Number: ${data.licenseNumber
        }. Submitted: ${data.submittedAt.toLocaleString()}.`,
    };

    const results = [];
    for (const adminEmail of adminEmails) {
      results.push(await this.sendEmail(adminEmail.trim(), template));
    }
    return results;
  }

  // Role and permission emails
  async sendRoleUpdateNotification(
    email: string,
    data: { firstName: string; newRole: string; updatedBy: string }
  ) {
    const template = await this.loadTemplate('roleUpdate', data);
    return this.sendEmail(email, template);
  }

  async sendAccountSuspensionNotification(
    email: string,
    data: { 
      firstName: string; 
      reason: string; 
      workspaceName: string;
      suspendedDate?: Date;
      supportEmail?: string;
      privacyUrl?: string;
    }
  ) {
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const supportUrl = data.supportEmail || `${frontendUrl}/support`;
      const privacyUrl = data.privacyUrl || `${frontendUrl}/privacy`;

      const templateVariables = {
        firstName: data.firstName,
        workspaceName: data.workspaceName,
        reason: data.reason,
        suspendedDate: (data.suspendedDate || new Date()).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        supportUrl,
        privacyUrl,
      };

      const template = await this.loadTemplate('memberSuspension', templateVariables);
      return this.sendEmail(email, template);
    } catch (error) {
      console.error('Error sending suspension notification:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async sendAccountReactivationNotification(
    email: string,
    data: { firstName: string }
  ) {
    const template = {
      subject: 'Account Reactivated - PharmacyCopilot',
      html: `
        <h2>Account Reactivated</h2>
        <p>Dear ${data.firstName},</p>
        <p>Your PharmacyCopilot account has been reactivated. You can now log in and access all your features.</p>
        <p>Welcome back!</p>
        <br>
        <p>Best regards,<br>PharmacyCopilot Team</p>
      `,
      text: `Account Reactivated. Dear ${data.firstName}, Your PharmacyCopilot account has been reactivated. You can now log in and access all your features.`,
    };
    return this.sendEmail(email, template);
  }

  // Subscription-related emails
  async sendSubscriptionConfirmation(
    email: string,
    data: {
      firstName: string;
      planName: string;
      amount: number;
      billingInterval: string;
      startDate: Date;
      endDate: Date;
    }
  ) {
    const template = await this.loadTemplate('subscriptionConfirmation', {
      ...data,
      startDate: data.startDate.toLocaleDateString(),
      endDate: data.endDate.toLocaleDateString(),
    });
    return this.sendEmail(email, template);
  }

  async sendSubscriptionCancellation(
    email: string,
    data: {
      firstName: string;
      planName: string;
      gracePeriodEnd: Date;
      reason?: string;
    }
  ) {
    const template = {
      subject: 'Subscription Cancelled - PharmacyCopilot',
      html: `
        <h2>Subscription Cancelled</h2>
        <p>Dear ${data.firstName},</p>
        <p>Your ${data.planName
        } subscription has been cancelled as requested.</p>
        <p>You'll continue to have access until: <strong>${data.gracePeriodEnd.toLocaleDateString()}</strong></p>
        ${data.reason ? `<p>Reason: ${data.reason}</p>` : ''}
        <p>You can reactivate your subscription anytime before the grace period ends.</p>
        <br>
        <p>Best regards,<br>PharmacyCopilot Team</p>
      `,
      text: `Subscription Cancelled. Dear ${data.firstName}, Your ${data.planName
        } subscription has been cancelled. Access until: ${data.gracePeriodEnd.toLocaleDateString()}.`,
    };
    return this.sendEmail(email, template);
  }

  async sendPaymentConfirmation(
    email: string,
    data: { firstName: string; amount: number; nextBillingDate: Date }
  ) {
    const template = {
      subject: 'Payment Confirmed - PharmacyCopilot',
      html: `
        <h2>Payment Confirmed</h2>
        <p>Dear ${data.firstName},</p>
        <p>We've successfully processed your payment of <strong>₦${data.amount
        }</strong>.</p>
        <p>Your subscription is active until: <strong>${data.nextBillingDate.toLocaleDateString()}</strong></p>
        <p>Thank you for continuing with PharmacyCopilot!</p>
        <br>
        <p>Best regards,<br>PharmacyCopilot Team</p>
      `,
      text: `Payment Confirmed. Dear ${data.firstName
        }, We've successfully processed your payment of ₦${data.amount
        }. Your subscription is active until: ${data.nextBillingDate.toLocaleDateString()}.`,
    };
    return this.sendEmail(email, template);
  }

  async sendPaymentFailedNotification(
    email: string,
    data: { firstName: string; attemptNumber: number; nextAttempt: Date }
  ) {
    const template = {
      subject: 'Payment Failed - PharmacyCopilot',
      html: `
        <h2>Payment Failed</h2>
        <p>Dear ${data.firstName},</p>
        <p>We couldn't process your subscription payment (Attempt ${data.attemptNumber
        }).</p>
        <p>We'll try again on: <strong>${data.nextAttempt.toLocaleDateString()}</strong></p>
        <p>Please ensure your payment method is valid and has sufficient funds.</p>
        <p>You can update your payment method in your account settings.</p>
        <br>
        <p>Best regards,<br>PharmacyCopilot Team</p>
      `,
      text: `Payment Failed. Dear ${data.firstName
        }, We couldn't process your subscription payment (Attempt ${data.attemptNumber
        }). We'll try again on: ${data.nextAttempt.toLocaleDateString()}.`,
    };
    return this.sendEmail(email, template);
  }

  async sendSubscriptionUpgrade(
    email: string,
    data: {
      firstName: string;
      oldPlanName: string;
      newPlanName: string;
      upgradeAmount: number;
      effectiveDate: Date;
    }
  ) {
    const template = {
      subject: 'Subscription Upgraded - PharmacyCopilot',
      html: `
        <h2>Subscription Upgraded!</h2>
        <p>Dear ${data.firstName},</p>
        <p>Your subscription has been successfully upgraded from <strong>${data.oldPlanName
        }</strong> to <strong>${data.newPlanName}</strong>.</p>
        <p><strong>Upgrade Amount:</strong> ₦${data.upgradeAmount.toLocaleString()}</p>
        <p><strong>Effective Date:</strong> ${data.effectiveDate.toLocaleDateString()}</p>
        <p>You now have access to all the enhanced features of your new plan!</p>
        <br>
        <p>Best regards,<br>PharmacyCopilot Team</p>
      `,
      text: `Subscription Upgraded! Dear ${data.firstName
        }, Your subscription has been upgraded from ${data.oldPlanName} to ${data.newPlanName
        }. Upgrade Amount: ₦${data.upgradeAmount.toLocaleString()}. Effective Date: ${data.effectiveDate.toLocaleDateString()}.`,
    };
    return this.sendEmail(email, template);
  }

  async sendSubscriptionDowngrade(
    email: string,
    data: {
      firstName: string;
      currentPlanName: string;
      newPlanName: string;
      effectiveDate: Date;
    }
  ) {
    const template = {
      subject: 'Subscription Downgrade Scheduled - PharmacyCopilot',
      html: `
        <h2>Subscription Downgrade Scheduled</h2>
        <p>Dear ${data.firstName},</p>
        <p>Your subscription downgrade from <strong>${data.currentPlanName
        }</strong> to <strong>${data.newPlanName
        }</strong> has been scheduled.</p>
        <p><strong>Effective Date:</strong> ${data.effectiveDate.toLocaleDateString()}</p>
        <p>You'll continue to have access to your current plan features until the effective date.</p>
        <p>You can cancel this downgrade anytime before the effective date in your account settings.</p>
        <br>
        <p>Best regards,<br>PharmacyCopilot Team</p>
      `,
      text: `Subscription Downgrade Scheduled. Dear ${data.firstName
        }, Your downgrade from ${data.currentPlanName} to ${data.newPlanName
        } is scheduled for ${data.effectiveDate.toLocaleDateString()}.`,
    };
    return this.sendEmail(email, template);
  }



  async sendInvitationAcceptedNotification(
    inviterEmail: string,
    data: {
      inviterName: string;
      acceptedUserName: string;
      acceptedUserEmail: string;
      workspaceName: string;
      role: string;
      acceptedDate?: Date;
    }
  ) {
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const workspaceUrl = `${frontendUrl}/workspace/settings/team`;
      const supportUrl = `${frontendUrl}/support`;

      const templateVariables = {
        inviterName: data.inviterName,
        acceptedUserName: data.acceptedUserName,
        acceptedUserEmail: data.acceptedUserEmail,
        workspaceName: data.workspaceName,
        role: data.role,
        acceptedDate: (data.acceptedDate || new Date()).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        workspaceUrl,
        supportUrl,
      };

      const template = await this.loadTemplate('invitationAccepted', templateVariables);

      if (this.resend) {
        const result = await this.resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'PharmacyCopilot <noreply@PharmacyCopilot.com>',
          to: inviterEmail,
          subject: template.subject,
          html: template.html,
        });
        console.log('Invitation accepted notification sent via Resend:', result.data?.id);
        return { success: true, messageId: result.data?.id, provider: 'resend' };
      } else {
        const result = await this.sendEmail(inviterEmail, template);
        return { ...result, provider: 'nodemailer' };
      }
    } catch (error) {
      console.error('Error sending invitation accepted notification:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async sendInvitationExpiredNotification(
    inviterEmail: string,
    data: {
      inviterName: string;
      invitedEmail: string;
      workspaceName: string;
      role: string;
      expiryDate?: Date;
    }
  ) {
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const workspaceUrl = `${frontendUrl}/workspace/settings/team`;
      const supportUrl = `${frontendUrl}/support`;

      const templateVariables = {
        inviterName: data.inviterName,
        invitedEmail: data.invitedEmail,
        workspaceName: data.workspaceName,
        role: data.role,
        expiryDate: (data.expiryDate || new Date()).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        workspaceUrl,
        supportUrl,
      };

      const template = {
        subject: 'Workspace Invitation Expired - PharmacyCopilot',
        html: `
          <h2>Invitation Expired</h2>
          <p>Dear ${data.inviterName},</p>
          <p>Your invitation to <strong>${data.invitedEmail}</strong> to join <strong>${data.workspaceName}</strong> as a <strong>${data.role}</strong> has expired on ${templateVariables.expiryDate}.</p>
          <p>If you still want to invite this person, you can send a new invitation from your workspace settings.</p>
          <p style="margin: 30px 0;">
            <a href="${workspaceUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Send New Invitation</a>
          </p>
          <br>
          <p>Best regards,<br>PharmacyCopilot Team</p>
        `,
        text: `Invitation Expired. Dear ${data.inviterName}, Your invitation to ${data.invitedEmail} to join ${data.workspaceName} as a ${data.role} has expired on ${templateVariables.expiryDate}.`,
      };

      if (this.resend) {
        const result = await this.resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'PharmacyCopilot <noreply@PharmacyCopilot.com>',
          to: inviterEmail,
          subject: template.subject,
          html: template.html,
        });
        console.log('Invitation expired notification sent via Resend:', result.data?.id);
        return { success: true, messageId: result.data?.id, provider: 'resend' };
      } else {
        const result = await this.sendEmail(inviterEmail, template);
        return { ...result, provider: 'nodemailer' };
      }
    } catch (error) {
      console.error('Error sending invitation expired notification:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async sendInvitationExpiredToInvitee(invitation: IInvitation) {
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const contactUrl = `${frontendUrl}/contact`;
      const supportUrl = `${frontendUrl}/support`;
      const unsubscribeUrl = `${frontendUrl}/unsubscribe`;

      const templateVariables = {
        inviterName: invitation.metadata.inviterName,
        workspaceName: invitation.metadata.workspaceName,
        workspaceType: 'Pharmacy', // Default type, could be enhanced
        role: invitation.role,
        expiryDate: invitation.expiresAt.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        expiryTime: invitation.expiresAt.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short',
        }),
        contactUrl,
        supportUrl,
        unsubscribeUrl,
      };

      const template = await this.loadTemplate('invitationExpired', templateVariables);

      if (this.resend) {
        const result = await this.resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'PharmacyCopilot <noreply@PharmacyCopilot.com>',
          to: invitation.email,
          subject: template.subject,
          html: template.html,
        });
        console.log('Invitation expired email sent to invitee via Resend:', result.data?.id);
        return { success: true, messageId: result.data?.id, provider: 'resend' };
      } else {
        const result = await this.sendEmail(invitation.email, template);
        return { ...result, provider: 'nodemailer' };
      }
    } catch (error) {
      console.error('Error sending invitation expired email to invitee:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  // Workspace invitation emails
  async sendInvitationEmail(invitation: IInvitation): Promise<EmailDeliveryResult> {
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const acceptUrl = `${frontendUrl}/accept-invitation/${invitation.code}`;
      const supportUrl = `${frontendUrl}/support`;
      const unsubscribeUrl = `${frontendUrl}/unsubscribe`;

      const templateVariables = {
        inviterName: invitation.metadata.inviterName,
        workspaceName: invitation.metadata.workspaceName,
        workspaceType: 'Pharmacy', // Default type, could be enhanced
        role: invitation.role,
        customMessage: invitation.metadata.customMessage,
        invitationCode: invitation.code,
        acceptUrl,
        expiryDate: invitation.expiresAt.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        expiryTime: invitation.expiresAt.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short',
        }),
        supportUrl,
        unsubscribeUrl,
      };

      const template = await this.loadTemplate('workspaceInvitation', templateVariables);

      // Use tracked email sending
      const result = await this.sendTrackedEmail({
        to: invitation.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
        templateName: 'workspaceInvitation',
        workspaceId: invitation.workspaceId,
        relatedEntity: {
          type: 'invitation',
          id: invitation._id,
        },
        metadata: {
          invitationCode: invitation.code,
          inviterName: invitation.metadata.inviterName,
          workspaceName: invitation.metadata.workspaceName,
          role: invitation.role,
        },
      });

      console.log('Invitation email sent with tracking:', result.messageId);
      return result;
    } catch (error) {
      console.error('Error sending invitation email:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async sendInvitationReminderEmail(invitation: IInvitation) {
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const acceptUrl = `${frontendUrl}/accept-invitation/${invitation.code}`;
      const supportUrl = `${frontendUrl}/support`;
      const unsubscribeUrl = `${frontendUrl}/unsubscribe`;

      const templateVariables = {
        inviterName: invitation.metadata.inviterName,
        workspaceName: invitation.metadata.workspaceName,
        workspaceType: 'Pharmacy', // Default type, could be enhanced
        role: invitation.role,
        invitationCode: invitation.code,
        acceptUrl,
        expiryDate: invitation.expiresAt.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        expiryTime: invitation.expiresAt.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short',
        }),
        supportUrl,
        unsubscribeUrl,
      };

      const template = await this.loadTemplate('invitationReminder', templateVariables);

      if (this.resend) {
        const result = await this.resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'PharmacyCopilot <noreply@PharmacyCopilot.com>',
          to: invitation.email,
          subject: template.subject,
          html: template.html,
        });
        console.log('Invitation reminder email sent via Resend:', result.data?.id);
        return { success: true, messageId: result.data?.id, provider: 'resend' };
      } else {
        const result = await this.sendEmail(invitation.email, template);
        return { ...result, provider: 'nodemailer' };
      }
    } catch (error) {
      console.error('Error sending invitation reminder email:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  // Workspace subscription-related emails
  async sendTrialActivation(
    email: string,
    data: {
      firstName: string;
      workspaceName: string;
      trialEndDate: Date;
      trialDurationDays: number;
    }
  ) {
    const template = {
      subject: 'Free Trial Activated - PharmacyCopilot',
      html: `
        <h2>Free Trial Activated!</h2>
        <p>Dear ${data.firstName},</p>
        <p>Your <strong>${data.trialDurationDays}-day free trial</strong> for <strong>${data.workspaceName}</strong> has been activated!</p>
        <p>You now have access to all PharmacyCopilot features until <strong>${data.trialEndDate.toLocaleDateString()}</strong>.</p>
        <p>During your trial, you can:</p>
        <ul>
          <li>Manage unlimited patients</li>
          <li>Create clinical notes and assessments</li>
          <li>Generate reports and analytics</li>
          <li>Invite team members to your workspace</li>
          <li>Access all premium features</li>
        </ul>
        <p>Make sure to explore all features and consider upgrading before your trial expires!</p>
        <br>
        <p>Best regards,<br>PharmacyCopilot Team</p>
      `,
      text: `Free Trial Activated! Dear ${data.firstName}, Your ${data.trialDurationDays}-day free trial for ${data.workspaceName} has been activated until ${data.trialEndDate.toLocaleDateString()}.`,
    };
    return this.sendEmail(email, template);
  }

  async sendWorkspaceSubscriptionConfirmation(
    email: string,
    data: {
      firstName: string;
      workspaceName: string;
      planName: string;
      amount: number;
      billingInterval: string;
      startDate: Date;
      endDate: Date;
    }
  ) {
    const template = {
      subject: 'Workspace Subscription Confirmed - PharmacyCopilot',
      html: `
        <h2>Workspace Subscription Confirmed!</h2>
        <p>Dear ${data.firstName},</p>
        <p>Thank you for subscribing to PharmacyCopilot <strong>${data.planName}</strong> plan for your workspace <strong>${data.workspaceName}</strong>.</p>
        <p><strong>Subscription Details:</strong></p>
        <ul>
          <li><strong>Plan:</strong> ${data.planName}</li>
          <li><strong>Amount:</strong> ₦${data.amount.toLocaleString()}</li>
          <li><strong>Billing:</strong> ${data.billingInterval}</li>
          <li><strong>Valid from:</strong> ${data.startDate.toLocaleDateString()}</li>
          <li><strong>Valid until:</strong> ${data.endDate.toLocaleDateString()}</li>
        </ul>
        <p>Your entire workspace team now has access to all premium features!</p>
        <p>You can manage your subscription and team members in your workspace settings.</p>
        <br>
        <p>Best regards,<br>PharmacyCopilot Team</p>
      `,
      text: `Workspace Subscription Confirmed! Dear ${data.firstName}, Thank you for subscribing to PharmacyCopilot ${data.planName} plan for ${data.workspaceName}. Amount: ₦${data.amount.toLocaleString()}, Billing: ${data.billingInterval}.`,
    };
    return this.sendEmail(email, template);
  }

  async sendSubscriptionPastDue(
    email: string,
    data: {
      firstName: string;
      workspaceName: string;
      gracePeriodEnd: Date;
    }
  ) {
    const template = {
      subject: 'Subscription Payment Past Due - PharmacyCopilot',
      html: `
        <h2>Subscription Payment Past Due</h2>
        <p>Dear ${data.firstName},</p>
        <p>Your subscription payment for <strong>${data.workspaceName}</strong> is past due.</p>
        <p>You have until <strong>${data.gracePeriodEnd.toLocaleDateString()}</strong> to update your payment method and avoid service interruption.</p>
        <p>Please log in to your account and update your payment information to continue enjoying all PharmacyCopilot features.</p>
        <p style="margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/workspace/subscription" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Update Payment Method</a>
        </p>
        <p>If you have any questions, please contact our support team.</p>
        <br>
        <p>Best regards,<br>PharmacyCopilot Team</p>
      `,
      text: `Subscription Payment Past Due. Dear ${data.firstName}, Your subscription payment for ${data.workspaceName} is past due. Please update your payment method by ${data.gracePeriodEnd.toLocaleDateString()}.`,
    };
    return this.sendEmail(email, template);
  }

  async sendSubscriptionExpired(
    email: string,
    data: {
      firstName: string;
      workspaceName: string;
    }
  ) {
    const template = {
      subject: 'Subscription Expired - PharmacyCopilot',
      html: `
        <h2>Subscription Expired</h2>
        <p>Dear ${data.firstName},</p>
        <p>Your subscription for <strong>${data.workspaceName}</strong> has expired.</p>
        <p>Your workspace is now in read-only mode. To restore full access:</p>
        <ul>
          <li>Update your payment method</li>
          <li>Choose a new subscription plan</li>
          <li>Reactivate your subscription</li>
        </ul>
        <p style="margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/workspace/subscription" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Reactivate Subscription</a>
        </p>
        <p>All your data is safe and will be restored once you reactivate your subscription.</p>
        <br>
        <p>Best regards,<br>PharmacyCopilot Team</p>
      `,
      text: `Subscription Expired. Dear ${data.firstName}, Your subscription for ${data.workspaceName} has expired. Please reactivate to restore full access.`,
    };
    return this.sendEmail(email, template);
  }

  async sendSubscriptionCanceled(
    email: string,
    data: {
      firstName: string;
      workspaceName: string;
    }
  ) {
    const template = {
      subject: 'Subscription Canceled - PharmacyCopilot',
      html: `
        <h2>Subscription Canceled</h2>
        <p>Dear ${data.firstName},</p>
        <p>Your subscription for <strong>${data.workspaceName}</strong> has been canceled.</p>
        <p>We're sorry to see you go! Your workspace will remain accessible in read-only mode.</p>
        <p>If you change your mind, you can reactivate your subscription anytime.</p>
        <p style="margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/workspace/subscription" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Reactivate Subscription</a>
        </p>
        <p>Thank you for using PharmacyCopilot. We hope to serve you again in the future!</p>
        <br>
        <p>Best regards,<br>PharmacyCopilot Team</p>
      `,
      text: `Subscription Canceled. Dear ${data.firstName}, Your subscription for ${data.workspaceName} has been canceled. You can reactivate anytime.`,
    };
    return this.sendEmail(email, template);
  }

  // Trial expiry warning emails
  async sendTrialExpiryWarning(
    email: string,
    data: {
      firstName: string;
      workspaceName: string;
      trialStartDate: Date;
      trialEndDate: Date;
      daysLeft: number;
    }
  ) {
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const upgradeUrl = `${frontendUrl}/workspace/subscription/upgrade`;
      const workspaceUrl = `${frontendUrl}/workspace/settings`;
      const supportUrl = `${frontendUrl}/support`;

      const templateVariables = {
        firstName: data.firstName,
        workspaceName: data.workspaceName,
        trialStartDate: data.trialStartDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        trialEndDate: data.trialEndDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        daysLeft: data.daysLeft,
        upgradeUrl,
        workspaceUrl,
        supportUrl,
      };

      const template = await this.loadTemplate('trialExpiryWarning', templateVariables);

      if (this.resend) {
        const result = await this.resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'PharmacyCopilot <noreply@PharmacyCopilot.com>',
          to: email,
          subject: template.subject,
          html: template.html,
        });
        console.log('Trial expiry warning sent via Resend:', result.data?.id);
        return { success: true, messageId: result.data?.id, provider: 'resend' };
      } else {
        const result = await this.sendEmail(email, template);
        return { ...result, provider: 'nodemailer' };
      }
    } catch (error) {
      console.error('Error sending trial expiry warning:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  // Usage limit warning emails
  async sendUsageLimitWarning(
    email: string,
    data: {
      firstName: string;
      workspaceName: string;
      currentPlan: string;
      resourceType: string;
      currentUsage: number;
      limit: number;
      usagePercentage: number;
      recommendedPlan?: string;
      recommendedLimit?: number;
      currentPlanPrice?: number;
      recommendedPlanPrice?: number;
    }
  ) {
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const upgradeUrl = `${frontendUrl}/workspace/subscription/upgrade`;
      const workspaceUrl = `${frontendUrl}/workspace/settings`;
      const supportUrl = `${frontendUrl}/support`;

      const templateVariables = {
        firstName: data.firstName,
        workspaceName: data.workspaceName,
        currentPlan: data.currentPlan,
        resourceType: data.resourceType,
        currentUsage: data.currentUsage,
        limit: data.limit,
        usagePercentage: data.usagePercentage,
        recommendedPlan: data.recommendedPlan || 'Professional',
        recommendedLimit: data.recommendedLimit || 'Unlimited',
        currentPlanPrice: data.currentPlanPrice || 0,
        recommendedPlanPrice: data.recommendedPlanPrice || 0,
        upgradeUrl,
        workspaceUrl,
        supportUrl,
      };

      const template = await this.loadTemplate('usageLimitWarning', templateVariables);

      if (this.resend) {
        const result = await this.resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'PharmacyCopilot <noreply@PharmacyCopilot.com>',
          to: email,
          subject: template.subject,
          html: template.html,
        });
        console.log('Usage limit warning sent via Resend:', result.data?.id);
        return { success: true, messageId: result.data?.id, provider: 'resend' };
      } else {
        const result = await this.sendEmail(email, template);
        return { ...result, provider: 'nodemailer' };
      }
    } catch (error) {
      console.error('Error sending usage limit warning:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  // Subscription status change notifications
  async sendSubscriptionStatusChange(
    email: string,
    data: {
      firstName: string;
      workspaceName: string;
      planName: string;
      oldStatus: string;
      newStatus: string;
      effectiveDate?: Date;
      nextBillingDate?: Date;
      gracePeriodEnd?: Date;
      actionRequired?: boolean;
      actionMessage?: string;
    }
  ) {
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const workspaceUrl = `${frontendUrl}/workspace/settings`;
      const supportUrl = `${frontendUrl}/support`;

      // Status-specific configurations
      const statusConfig = {
        active: {
          title: 'Subscription Activated',
          color: '#059669',
          titleColor: '#059669',
          ctaText: 'Manage Subscription',
          ctaClass: 'cta-primary',
          messageIcon: '✅',
          messageTitle: 'All systems go!',
          messageBackground: '#f0fdf4',
          messageBorderColor: '#059669',
          messageTextColor: '#065f46',
        },
        expired: {
          title: 'Subscription Expired',
          color: '#dc2626',
          titleColor: '#dc2626',
          ctaText: 'Reactivate Subscription',
          ctaClass: 'cta-warning',
          messageIcon: '⚠️',
          messageTitle: 'Immediate action required',
          messageBackground: '#fef2f2',
          messageBorderColor: '#dc2626',
          messageTextColor: '#991b1b',
        },
        past_due: {
          title: 'Payment Past Due',
          color: '#f59e0b',
          titleColor: '#f59e0b',
          ctaText: 'Update Payment Method',
          ctaClass: 'cta-warning',
          messageIcon: '⏰',
          messageTitle: 'Payment required',
          messageBackground: '#fef3c7',
          messageBorderColor: '#f59e0b',
          messageTextColor: '#92400e',
        },
        canceled: {
          title: 'Subscription Canceled',
          color: '#6b7280',
          titleColor: '#6b7280',
          ctaText: 'Reactivate Subscription',
          ctaClass: 'cta-primary',
          messageIcon: 'ℹ️',
          messageTitle: 'Subscription canceled',
          messageBackground: '#f9fafb',
          messageBorderColor: '#6b7280',
          messageTextColor: '#374151',
        },
      };

      const config = statusConfig[data.newStatus as keyof typeof statusConfig] || statusConfig.active;

      const templateVariables = {
        firstName: data.firstName,
        workspaceName: data.workspaceName,
        planName: data.planName,
        oldStatus: data.oldStatus,
        oldStatusDisplay: data.oldStatus.replace('_', ' ').toUpperCase(),
        newStatus: data.newStatus,
        newStatusDisplay: data.newStatus.replace('_', ' ').toUpperCase(),
        statusTitle: config.title,
        statusColor: config.color,
        titleColor: config.titleColor,
        effectiveDate: data.effectiveDate?.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        nextBillingDate: data.nextBillingDate?.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        gracePeriodEnd: data.gracePeriodEnd?.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        actionRequired: data.actionRequired,
        actionMessage: data.actionMessage,
        ctaUrl: workspaceUrl,
        ctaText: config.ctaText,
        ctaClass: config.ctaClass,
        statusMessage: data.actionMessage,
        messageIcon: config.messageIcon,
        messageTitle: config.messageTitle,
        messageBackground: config.messageBackground,
        messageBorderColor: config.messageBorderColor,
        messageTextColor: config.messageTextColor,
        workspaceUrl,
        supportUrl,
      };

      const template = await this.loadTemplate('subscriptionStatusChange', templateVariables);

      if (this.resend) {
        const result = await this.resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'PharmacyCopilot <noreply@PharmacyCopilot.com>',
          to: email,
          subject: template.subject,
          html: template.html,
        });
        console.log('Subscription status change notification sent via Resend:', result.data?.id);
        return { success: true, messageId: result.data?.id, provider: 'resend' };
      } else {
        const result = await this.sendEmail(email, template);
        return { ...result, provider: 'nodemailer' };
      }
    } catch (error) {
      console.error('Error sending subscription status change notification:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async sendSubscriptionSuspended(
    email: string,
    data: {
      firstName: string;
      workspaceName: string;
    }
  ) {
    const template = {
      subject: 'Subscription Suspended - PharmacyCopilot',
      html: `
        <h2>Subscription Suspended</h2>
        <p>Dear ${data.firstName},</p>
        <p>Your subscription for <strong>${data.workspaceName}</strong> has been temporarily suspended.</p>
        <p>This may be due to:</p>
        <ul>
          <li>Payment issues</li>
          <li>Terms of service violations</li>
          <li>Account verification requirements</li>
        </ul>
        <p>Please contact our support team to resolve this issue and restore your access.</p>
        <p style="margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/support" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Contact Support</a>
        </p>
        <br>
        <p>Best regards,<br>PharmacyCopilot Team</p>
      `,
      text: `Subscription Suspended. Dear ${data.firstName}, Your subscription for ${data.workspaceName} has been suspended. Please contact support to resolve this issue.`,
    };
    return this.sendEmail(email, template);
  }

  async sendTrialExtension(
    email: string,
    data: {
      firstName: string;
      workspaceName: string;
      extensionDays: number;
      newEndDate: Date;
    }
  ) {
    const template = {
      subject: 'Trial Period Extended - PharmacyCopilot',
      html: `
        <h2>Trial Period Extended!</h2>
        <p>Dear ${data.firstName},</p>
        <p>Great news! Your trial period for <strong>${data.workspaceName}</strong> has been extended by <strong>${data.extensionDays} days</strong>.</p>
        <p>Your new trial end date is: <strong>${data.newEndDate.toLocaleDateString()}</strong></p>
        <p>Continue exploring all PharmacyCopilot features and consider upgrading before your extended trial expires!</p>
        <p style="margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/workspace/subscription" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Subscription Plans</a>
        </p>
        <br>
        <p>Best regards,<br>PharmacyCopilot Team</p>
      `,
      text: `Trial Period Extended! Dear ${data.firstName}, Your trial period for ${data.workspaceName} has been extended by ${data.extensionDays} days until ${data.newEndDate.toLocaleDateString()}.`,
    };
    return this.sendEmail(email, template);
  }

  async sendTrialExpired(
    email: string,
    data: {
      firstName: string;
      workspaceName: string;
      trialEndDate: Date;
    }
  ) {
    const template = {
      subject: 'Trial Period Expired - PharmacyCopilot',
      html: `
        <h2>Trial Period Expired</h2>
        <p>Dear ${data.firstName},</p>
        <p>Your 14-day free trial for <strong>${data.workspaceName}</strong> has expired on ${data.trialEndDate.toLocaleDateString()}.</p>
        <p>To continue using all PharmacyCopilot features, please choose a subscription plan that fits your needs.</p>
        <p>Your workspace is now in read-only mode, but all your data is safe and will be restored once you subscribe.</p>
        <p style="margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/workspace/subscription" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Choose a Plan</a>
        </p>
        <p>Thank you for trying PharmacyCopilot. We hope you'll continue your journey with us!</p>
        <br>
        <p>Best regards,<br>PharmacyCopilot Team</p>
      `,
      text: `Trial Period Expired. Dear ${data.firstName}, Your trial for ${data.workspaceName} has expired on ${data.trialEndDate.toLocaleDateString()}. Please choose a subscription plan to continue.`,
    };
    return this.sendEmail(email, template);
  }



  async sendSubscriptionExpiryWarning(
    email: string,
    data: {
      firstName: string;
      workspaceName: string;
      daysRemaining: number;
      endDate: Date;
    }
  ) {
    const template = {
      subject: `Subscription Expires in ${data.daysRemaining} Days - PharmacyCopilot`,
      html: `
        <h2>Subscription Expiring Soon</h2>
        <p>Dear ${data.firstName},</p>
        <p>Your subscription for <strong>${data.workspaceName}</strong> expires in <strong>${data.daysRemaining} days</strong> on ${data.endDate.toLocaleDateString()}.</p>
        <p>To avoid any interruption to your service, please ensure your payment method is up to date.</p>
        <p>If you have auto-renewal enabled, we'll automatically charge your payment method. Otherwise, you can manually renew your subscription.</p>
        <p style="margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/workspace/subscription" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Manage Subscription</a>
        </p>
        <p>Need to update your payment method or have questions? Contact our support team.</p>
        <br>
        <p>Best regards,<br>PharmacyCopilot Team</p>
      `,
      text: `Subscription Expiring Soon. Dear ${data.firstName}, Your subscription for ${data.workspaceName} expires in ${data.daysRemaining} days on ${data.endDate.toLocaleDateString()}.`,
    };
    return this.sendEmail(email, template);
  }

  async sendSubscriptionDowngradeApplied(
    email: string,
    data: {
      firstName: string;
      workspaceName: string;
      newPlanName: string;
      effectiveDate: Date;
    }
  ) {
    const template = {
      subject: 'Subscription Downgrade Applied - PharmacyCopilot',
      html: `
        <h2>Subscription Downgrade Applied</h2>
        <p>Dear ${data.firstName},</p>
        <p>Your scheduled subscription downgrade for <strong>${data.workspaceName}</strong> has been applied.</p>
        <p><strong>New Plan:</strong> ${data.newPlanName}</p>
        <p><strong>Effective Date:</strong> ${data.effectiveDate.toLocaleDateString()}</p>
        <p>Your workspace now has access to the features included in your new plan. If you need additional features, you can upgrade anytime.</p>
        <p style="margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/workspace/subscription" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Current Plan</a>
        </p>
        <br>
        <p>Best regards,<br>PharmacyCopilot Team</p>
      `,
      text: `Subscription Downgrade Applied. Dear ${data.firstName}, Your downgrade for ${data.workspaceName} to ${data.newPlanName} has been applied on ${data.effectiveDate.toLocaleDateString()}.`,
    };
    return this.sendEmail(email, template);
  }

  // User approval/rejection emails
  async sendUserApprovalNotification(
    email: string,
    data: { firstName: string; lastName: string; workspaceName?: string }
  ) {
    const template = {
      subject: 'Account Approved - Welcome to PharmacyCopilot!',
      html: `
        <h2>Account Approved!</h2>
        <p>Dear ${data.firstName} ${data.lastName},</p>
        <p>Great news! Your PharmacyCopilot account has been approved and activated.</p>
        ${data.workspaceName ? `<p>You now have access to <strong>${data.workspaceName}</strong>.</p>` : ''}
        <p>You can now log in and start using all the features available to you.</p>
        <p style="margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/login" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Log In Now</a>
        </p>
        <p>If you have any questions, feel free to reach out to our support team.</p>
        <br>
        <p>Best regards,<br>PharmacyCopilot Team</p>
      `,
      text: `Account Approved! Dear ${data.firstName} ${data.lastName}, Your PharmacyCopilot account has been approved and activated. You can now log in at ${process.env.FRONTEND_URL}/login`,
    };
    return this.sendEmail(email, template);
  }

  async sendUserRejectionNotification(
    email: string,
    data: { firstName: string; lastName: string; reason?: string }
  ) {
    const template = {
      subject: 'Account Registration Update - PharmacyCopilot',
      html: `
        <h2>Account Registration Update</h2>
        <p>Dear ${data.firstName} ${data.lastName},</p>
        <p>Thank you for your interest in PharmacyCopilot. Unfortunately, we are unable to approve your account registration at this time.</p>
        ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ''}
        <p>If you believe this is an error or would like to discuss this decision, please contact our support team at ${process.env.SUPPORT_EMAIL || 'support@PharmacyCopilot.com'}.</p>
        <br>
        <p>Best regards,<br>PharmacyCopilot Team</p>
      `,
      text: `Account Registration Update. Dear ${data.firstName} ${data.lastName}, We are unable to approve your account registration at this time. ${data.reason ? `Reason: ${data.reason}` : ''} Contact support at ${process.env.SUPPORT_EMAIL || 'support@PharmacyCopilot.com'} for more information.`,
    };
    return this.sendEmail(email, template);
  }

  async sendRoleAssignmentNotification(
    email: string,
    data: { firstName: string; lastName: string; newRole: string; workspaceName?: string }
  ) {
    const roleDisplayNames: Record<string, string> = {
      super_admin: 'Super Administrator',
      pharmacy_outlet: 'Pharmacy Owner',
      pharmacist: 'Pharmacist',
      intern_pharmacist: 'Intern Pharmacist',
      pharmacy_team: 'Pharmacy Team Member'
    };

    const roleDisplay = roleDisplayNames[data.newRole] || data.newRole;

    const template = {
      subject: 'Role Updated - PharmacyCopilot',
      html: `
        <h2>Your Role Has Been Updated</h2>
        <p>Dear ${data.firstName} ${data.lastName},</p>
        <p>Your role in PharmacyCopilot has been updated.</p>
        <p><strong>New Role:</strong> ${roleDisplay}</p>
        ${data.workspaceName ? `<p><strong>Workspace:</strong> ${data.workspaceName}</p>` : ''}
        <p>This change may affect your access permissions and available features. Please log in to see your updated capabilities.</p>
        <p style="margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/login" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Log In</a>
        </p>
        <p>If you have questions about your new role, please contact your administrator or our support team.</p>
        <br>
        <p>Best regards,<br>PharmacyCopilot Team</p>
      `,
      text: `Your Role Has Been Updated. Dear ${data.firstName} ${data.lastName}, Your role in PharmacyCopilot has been updated to ${roleDisplay}. ${data.workspaceName ? `Workspace: ${data.workspaceName}` : ''} Log in at ${process.env.FRONTEND_URL}/login to see your updated capabilities.`,
    };
    return this.sendEmail(email, template);
  }

  async sendUserSuspensionNotification(
    email: string,
    data: { firstName: string; lastName: string; reason: string }
  ) {
    const template = {
      subject: 'Account Suspended - PharmacyCopilot',
      html: `
        <h2>Account Suspended</h2>
        <p>Dear ${data.firstName} ${data.lastName},</p>
        <p>Your PharmacyCopilot account has been suspended.</p>
        <p><strong>Reason:</strong> ${data.reason}</p>
        <p>You will not be able to log in until your account is reactivated.</p>
        <p>If you believe this is an error or would like to appeal this decision, please contact our support team at ${process.env.SUPPORT_EMAIL || 'support@PharmacyCopilot.com'}.</p>
        <br>
        <p>Best regards,<br>PharmacyCopilot Team</p>
      `,
      text: `Account Suspended. Dear ${data.firstName} ${data.lastName}, Your PharmacyCopilot account has been suspended. Reason: ${data.reason}. Contact support at ${process.env.SUPPORT_EMAIL || 'support@PharmacyCopilot.com'} for assistance.`,
    };
    return this.sendEmail(email, template);
  }

  async sendUserCreatedNotification(
    email: string,
    data: { firstName: string; lastName: string; tempPassword: string; workspaceName?: string }
  ) {
    const template = {
      subject: 'Welcome to PharmacyCopilot - Account Created',
      html: `
        <h2>Welcome to PharmacyCopilot!</h2>
        <p>Dear ${data.firstName} ${data.lastName},</p>
        <p>An account has been created for you on PharmacyCopilot.</p>
        ${data.workspaceName ? `<p><strong>Workspace:</strong> ${data.workspaceName}</p>` : ''}
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Temporary Password:</strong> <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px;">${data.tempPassword}</code></p>
        <p style="color: #dc2626; font-weight: 600;">⚠️ Please change your password after your first login for security.</p>
        <p style="margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/login" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Log In Now</a>
        </p>
        <p>If you have any questions, feel free to reach out to our support team.</p>
        <br>
        <p>Best regards,<br>PharmacyCopilot Team</p>
      `,
      text: `Welcome to PharmacyCopilot! Dear ${data.firstName} ${data.lastName}, An account has been created for you. Email: ${email}, Temporary Password: ${data.tempPassword}. Please change your password after your first login. Log in at ${process.env.FRONTEND_URL}/login`,
    };
    return this.sendEmail(email, template);
  }

  // Workspace team invite emails
  async sendWorkspaceInviteEmail(
    email: string,
    data: {
      inviterName: string;
      workspaceName: string;
      role: string;
      inviteUrl: string;
      expiresAt: Date;
      personalMessage?: string;
      requiresApproval?: boolean;
    }
  ) {
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const supportUrl = `${frontendUrl}/support`;
      const privacyUrl = `${frontendUrl}/privacy`;

      const templateVariables = {
        inviterName: data.inviterName,
        workspaceName: data.workspaceName,
        role: data.role,
        inviteUrl: data.inviteUrl,
        expiresAt: data.expiresAt.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        personalMessage: data.personalMessage || '',
        requiresApproval: data.requiresApproval || false,
        supportUrl,
        privacyUrl,
      };

      const template = await this.loadTemplate('workspaceTeamInvite', templateVariables);
      return this.sendEmail(email, template);
    } catch (error) {
      console.error('Error sending workspace invite email:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async sendMemberApprovalNotification(
    email: string,
    data: {
      firstName: string;
      workspaceName: string;
      role: string;
    }
  ) {
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const loginUrl = `${frontendUrl}/login`;
      const supportUrl = `${frontendUrl}/support`;
      const helpUrl = `${frontendUrl}/help`;
      const privacyUrl = `${frontendUrl}/privacy`;

      const templateVariables = {
        firstName: data.firstName,
        workspaceName: data.workspaceName,
        role: data.role,
        loginUrl,
        supportUrl,
        helpUrl,
        privacyUrl,
      };

      const template = await this.loadTemplate('memberApproval', templateVariables);
      return this.sendEmail(email, template);
    } catch (error) {
      console.error('Error sending member approval notification:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async sendMemberRejectionNotification(
    email: string,
    data: {
      firstName: string;
      workspaceName: string;
      reason: string;
      requestDate?: Date;
    }
  ) {
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const contactAdminUrl = `${frontendUrl}/contact`;
      const supportUrl = `${frontendUrl}/support`;
      const helpUrl = `${frontendUrl}/help`;
      const privacyUrl = `${frontendUrl}/privacy`;

      const templateVariables = {
        firstName: data.firstName,
        workspaceName: data.workspaceName,
        reason: data.reason || '',
        requestDate: (data.requestDate || new Date()).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        contactAdminUrl,
        supportUrl,
        helpUrl,
        privacyUrl,
      };

      const template = await this.loadTemplate('memberRejection', templateVariables);
      return this.sendEmail(email, template);
    } catch (error) {
      console.error('Error sending member rejection notification:', error);
      return { success: false, error: (error as Error).message };
    }
  }
}

export const emailService = new EmailService();
export default emailService;
