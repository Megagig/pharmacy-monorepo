import mongoose from 'mongoose';
import { chatService } from './ChatService';
import { consultationRequestService } from './ConsultationRequestService';
import logger from '../../utils/logger';

/**
 * ChatbotService - AI-Powered Chatbot Integration
 * 
 * Handles chatbot conversations, FAQ responses, and escalation to human agents
 */

export interface ChatbotMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface ChatbotContext {
  sessionId: string;
  userId?: string;
  workplaceId?: string;
  conversationHistory: ChatbotMessage[];
  metadata?: Record<string, any>;
}

export interface ChatbotResponse {
  message: string;
  confidence: number;
  suggestedActions?: Array<{
    type: 'escalate' | 'faq' | 'link' | 'consultation';
    label: string;
    data?: any;
  }>;
  requiresEscalation: boolean;
}

export class ChatbotService {
  private contexts: Map<string, ChatbotContext> = new Map();
  private readonly CONFIDENCE_THRESHOLD = 0.7;
  private readonly MAX_HISTORY_LENGTH = 20;

  // FAQ knowledge base
  private readonly FAQ_RESPONSES: Record<string, { answer: string; keywords: string[] }> = {
    'medication_side_effects': {
      answer: 'Common medication side effects can include nausea, dizziness, headache, or drowsiness. If you experience severe side effects, please contact your pharmacist immediately or seek medical attention.',
      keywords: ['side effect', 'adverse', 'reaction', 'symptom', 'feel sick', 'nausea', 'dizzy'],
    },
    'medication_timing': {
      answer: 'Take your medication at the same time each day as prescribed. If you miss a dose, take it as soon as you remember unless it\'s close to your next scheduled dose. Never double up on doses.',
      keywords: ['when to take', 'timing', 'schedule', 'missed dose', 'forgot', 'time'],
    },
    'medication_storage': {
      answer: 'Store medications in a cool, dry place away from direct sunlight. Keep them out of reach of children. Some medications require refrigeration - check your label or ask your pharmacist.',
      keywords: ['store', 'storage', 'keep', 'refrigerate', 'temperature'],
    },
    'refill_prescription': {
      answer: 'You can request a prescription refill through our patient portal or by calling the pharmacy. Most refills are ready within 24 hours. Make sure to request refills a few days before you run out.',
      keywords: ['refill', 'renewal', 'run out', 'more medication', 'prescription'],
    },
    'pharmacy_hours': {
      answer: 'Our pharmacy hours vary by location. You can find specific hours on our website or by calling your local pharmacy. Many locations offer extended hours and weekend service.',
      keywords: ['hours', 'open', 'closed', 'when', 'time', 'schedule'],
    },
    'insurance_coverage': {
      answer: 'Insurance coverage varies by plan. We can help verify your coverage and find the most cost-effective options. Please have your insurance card ready when you visit or call.',
      keywords: ['insurance', 'coverage', 'cost', 'price', 'pay', 'copay', 'deductible'],
    },
    'consultation_request': {
      answer: 'I can help you request a consultation with a pharmacist. They can answer specific questions about your medications, interactions, and health concerns. Would you like me to set up a consultation?',
      keywords: ['talk to', 'speak with', 'pharmacist', 'consultation', 'question', 'help'],
    },
  };

  /**
   * Process a chatbot message
   */
  async processMessage(
    sessionId: string,
    message: string,
    userId?: string,
    workplaceId?: string
  ): Promise<ChatbotResponse> {
    try {
      logger.info('Processing chatbot message', { sessionId, userId });

      // Get or create context
      let context = this.contexts.get(sessionId);
      if (!context) {
        context = {
          sessionId,
          userId,
          workplaceId,
          conversationHistory: [],
        };
        this.contexts.set(sessionId, context);
      }

      // Add user message to history
      context.conversationHistory.push({
        role: 'user',
        content: message,
        timestamp: new Date(),
      });

      // Trim history if too long
      if (context.conversationHistory.length > this.MAX_HISTORY_LENGTH) {
        context.conversationHistory = context.conversationHistory.slice(-this.MAX_HISTORY_LENGTH);
      }

      // Generate response
      const response = await this.generateResponse(message, context);

      // Add assistant response to history
      context.conversationHistory.push({
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
      });

      logger.info('Chatbot response generated', {
        sessionId,
        confidence: response.confidence,
        requiresEscalation: response.requiresEscalation,
      });

      return response;
    } catch (error) {
      logger.error('Error processing chatbot message', { error, sessionId });
      throw error;
    }
  }

  /**
   * Generate chatbot response
   */
  private async generateResponse(
    message: string,
    context: ChatbotContext
  ): Promise<ChatbotResponse> {
    const messageLower = message.toLowerCase();

    // Check for FAQ matches
    const faqMatch = this.findFAQMatch(messageLower);
    if (faqMatch) {
      return {
        message: faqMatch.answer,
        confidence: 0.9,
        suggestedActions: this.getSuggestedActions(faqMatch.category),
        requiresEscalation: false,
      };
    }

    // Check for greeting
    if (this.isGreeting(messageLower)) {
      return {
        message: 'Hello! I\'m your pharmacy assistant. I can help you with medication questions, prescription refills, and connecting you with a pharmacist. How can I assist you today?',
        confidence: 1.0,
        suggestedActions: [
          { type: 'faq', label: 'Common Questions', data: { category: 'faq' } },
          { type: 'consultation', label: 'Talk to Pharmacist', data: { type: 'consultation' } },
        ],
        requiresEscalation: false,
      };
    }

    // Check for consultation request
    if (this.isConsultationRequest(messageLower)) {
      return {
        message: 'I\'d be happy to connect you with a pharmacist for a consultation. They can provide personalized advice about your medications and health concerns. Would you like me to set up a consultation request?',
        confidence: 0.95,
        suggestedActions: [
          { type: 'consultation', label: 'Request Consultation', data: { type: 'consultation' } },
        ],
        requiresEscalation: false,
      };
    }

    // Check for emergency/urgent situations
    if (this.isEmergency(messageLower)) {
      return {
        message: '⚠️ This sounds like it may require immediate medical attention. If you\'re experiencing a medical emergency, please call 911 or go to the nearest emergency room. For urgent medication questions, I can connect you with a pharmacist right away.',
        confidence: 1.0,
        suggestedActions: [
          { type: 'escalate', label: 'Connect with Pharmacist Now', data: { priority: 'urgent' } },
        ],
        requiresEscalation: true,
      };
    }

    // Default response for unrecognized queries
    return {
      message: 'I\'m not sure I fully understand your question. Let me connect you with a pharmacist who can provide you with accurate information. Would you like to request a consultation?',
      confidence: 0.3,
      suggestedActions: [
        { type: 'consultation', label: 'Talk to Pharmacist', data: { type: 'consultation' } },
        { type: 'faq', label: 'Browse FAQs', data: { category: 'faq' } },
      ],
      requiresEscalation: true,
    };
  }

  /**
   * Find FAQ match
   */
  private findFAQMatch(message: string): { answer: string; category: string } | null {
    for (const [category, faq] of Object.entries(this.FAQ_RESPONSES)) {
      const matchCount = faq.keywords.filter(keyword => message.includes(keyword)).length;
      if (matchCount >= 2 || (matchCount === 1 && faq.keywords.some(k => message.includes(k) && k.length > 5))) {
        return { answer: faq.answer, category };
      }
    }
    return null;
  }

  /**
   * Check if message is a greeting
   */
  private isGreeting(message: string): boolean {
    const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'greetings'];
    return greetings.some(greeting => message.startsWith(greeting));
  }

  /**
   * Check if message is a consultation request
   */
  private isConsultationRequest(message: string): boolean {
    const consultationKeywords = [
      'talk to pharmacist',
      'speak with pharmacist',
      'consultation',
      'need help',
      'have a question',
      'ask pharmacist',
    ];
    return consultationKeywords.some(keyword => message.includes(keyword));
  }

  /**
   * Check if message indicates an emergency
   */
  private isEmergency(message: string): boolean {
    const emergencyKeywords = [
      'emergency',
      'urgent',
      'severe pain',
      'can\'t breathe',
      'chest pain',
      'allergic reaction',
      'overdose',
      'poisoning',
      'severe bleeding',
    ];
    return emergencyKeywords.some(keyword => message.includes(keyword));
  }

  /**
   * Get suggested actions based on category
   */
  private getSuggestedActions(category: string): Array<{
    type: 'escalate' | 'faq' | 'link' | 'consultation';
    label: string;
    data?: any;
  }> {
    const actions: any[] = [];

    if (category === 'consultation_request') {
      actions.push({
        type: 'consultation',
        label: 'Request Consultation',
        data: { type: 'consultation' },
      });
    } else {
      actions.push({
        type: 'consultation',
        label: 'Talk to Pharmacist',
        data: { type: 'consultation' },
      });
    }

    return actions;
  }

  /**
   * Escalate to human pharmacist
   */
  async escalateToHuman(
    sessionId: string,
    reason: string,
    patientId: string,
    workplaceId: string
  ): Promise<any> {
    try {
      logger.info('Escalating chatbot conversation to human', { sessionId, patientId });

      const context = this.contexts.get(sessionId);
      if (!context) {
        throw new Error('Session context not found');
      }

      // Create consultation request
      const consultationRequest = await consultationRequestService.createRequest({
        patientId,
        reason: `Chatbot escalation: ${reason}`,
        priority: reason.toLowerCase().includes('urgent') ? 'urgent' : 'normal',
        workplaceId,
      });

      // Clear context after escalation
      this.contexts.delete(sessionId);

      logger.info('Chatbot conversation escalated successfully', {
        sessionId,
        consultationRequestId: consultationRequest._id,
      });

      return {
        consultationRequest,
        message: 'I\'ve connected you with a pharmacist. They will respond to your request shortly.',
      };
    } catch (error) {
      logger.error('Error escalating chatbot conversation', { error, sessionId });
      throw error;
    }
  }

  /**
   * Get chatbot analytics
   */
  async getAnalytics(workplaceId: string, startDate?: Date, endDate?: Date): Promise<any> {
    try {
      // In a production system, you'd track these metrics in a database
      // For now, return mock analytics
      return {
        totalSessions: 0,
        totalMessages: 0,
        averageConfidence: 0,
        escalationRate: 0,
        topQueries: [],
        satisfactionRate: 0,
      };
    } catch (error) {
      logger.error('Error getting chatbot analytics', { error, workplaceId });
      throw error;
    }
  }

  /**
   * Clear session context
   */
  clearSession(sessionId: string): void {
    this.contexts.delete(sessionId);
    logger.debug('Chatbot session cleared', { sessionId });
  }

  /**
   * Get session context
   */
  getSessionContext(sessionId: string): ChatbotContext | undefined {
    return this.contexts.get(sessionId);
  }
}

// Export singleton instance
export const chatbotService = new ChatbotService();
export default chatbotService;
