import { Resend } from 'resend';
import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

interface User {
  email: string;
  firstName: string;
  pharmacyName: string;
}

interface Subscription {
  plan: string;
  endDate: Date;
}

// Lazy initialize Resend
let resend: Resend | null = null;

const getResendClient = (): Resend => {
  if (!resend && hasValidResendConfig()) {
    resend = new Resend(process.env.RESEND_API_KEY!);
  }
  return resend!;
};

// Check if we have valid Resend configuration
const hasValidResendConfig = () => {
  return (
    process.env.RESEND_API_KEY &&
    process.env.SENDER_EMAIL &&
    process.env.RESEND_API_KEY.startsWith('re_')
  );
};

// Check if we have valid SMTP configuration
const hasValidSMTPConfig = () => {
  return (
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.SMTP_HOST !== 'smtp.gmail.com' &&
    process.env.SMTP_USER !== 'your-email@gmail.com'
  );
};

// Create SMTP transporter for fallback
const createSMTPTransporter = () => {
  if (hasValidSMTPConfig()) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return null;
};

const smtpTransporter = createSMTPTransporter();

// Send email using Resend
const sendWithResend = async (options: EmailOptions): Promise<any> => {
  try {
    const resendClient = getResendClient();
    const { data, error } = await resendClient.emails.send({
      from: `${process.env.SENDER_NAME || 'PharmacyCopilot Hub'} <${process.env.SENDER_EMAIL}>`,
      to: [options.to],
      subject: options.subject,
      html: options.html || options.text || '',
      text: options.text,
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }

    console.log('✅ Email sent successfully via Resend:', data?.id);
    return {
      messageId: data?.id,
      service: 'resend',
      response: 'Email sent via Resend'
    };
  } catch (error) {
    console.error('❌ Resend email failed:', error);
    throw error;
  }
};

// Send email using SMTP fallback
const sendWithSMTP = async (options: EmailOptions): Promise<any> => {
  if (!smtpTransporter) {
    throw new Error('SMTP transporter not configured');
  }

  try {
    const message = {
      from: `${process.env.FROM_NAME || 'PharmacyCopilot Hub'} <${process.env.FROM_EMAIL || process.env.SENDER_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    };

    const info = await smtpTransporter.sendMail(message);
    console.log('✅ Email sent successfully via SMTP:', info.messageId);
    return {
      messageId: info.messageId,
      service: 'smtp',
      response: info.response
    };
  } catch (error) {
    console.error('❌ SMTP email failed:', error);
    throw error;
  }
};

// Development mode email simulation
const simulateEmail = (options: EmailOptions): any => {
  console.log('📧 EMAIL SIMULATION (Development Mode)');
  console.log('To:', options.to);
  console.log('Subject:', options.subject);
  console.log('Content:', options.text || options.html);
  console.log('---');

  return {
    messageId: 'dev-' + Date.now(),
    service: 'simulation',
    response: 'Email simulated in development mode'
  };
};

export const sendEmail = async (options: EmailOptions): Promise<any> => {
  try {
    // Try Resend first if configured
    if (hasValidResendConfig()) {
      try {
        return await sendWithResend(options);
      } catch (resendError) {
        console.warn('⚠️ Resend failed, trying SMTP fallback:', resendError);

        // Try SMTP fallback
        if (hasValidSMTPConfig()) {
          return await sendWithSMTP(options);
        }
      }
    }

    // Try SMTP if Resend is not configured
    if (hasValidSMTPConfig()) {
      return await sendWithSMTP(options);
    }

    // In development without proper email config, simulate
    if (process.env.NODE_ENV === 'development') {
      return simulateEmail(options);
    }

    throw new Error('No email service configured');

  } catch (error) {
    console.error('❌ All email services failed:', error);

    // In development, don't throw error - just simulate
    if (process.env.NODE_ENV === 'development') {
      console.log('📧 EMAIL FALLBACK (Development Mode)');
      return simulateEmail(options);
    }

    throw error;
  }
};

export const sendWelcomeEmail = async (user: User): Promise<any> => {
  const message: EmailOptions = {
    to: user.email,
    subject: 'Welcome to PharmacyCopilot SaaS',
    text: `Welcome ${user.firstName}! Your pharmaceutical care management account is ready.`,
    html: `
      <h1>Welcome to PharmacyCopilot SaaS, ${user.firstName}!</h1>
      <p>Your account for ${user.pharmacyName} is now active.</p>
      <p>You can now start managing your patients and clinical notes.</p>
    `
  };

  return await sendEmail(message);
};

export const sendSubscriptionReminder = async (user: User, subscription: Subscription): Promise<any> => {
  const message: EmailOptions = {
    to: user.email,
    subject: 'Subscription Renewal Reminder',
    text: `Your PharmacyCopilot subscription expires on ${subscription.endDate}`,
    html: `
      <h2>Subscription Renewal Reminder</h2>
      <p>Hi ${user.firstName},</p>
      <p>Your PharmacyCopilot subscription (${subscription.plan}) expires on ${subscription.endDate}.</p>
      <p>Renew now to continue accessing all features.</p>
    `
  };

  return await sendEmail(message);
};