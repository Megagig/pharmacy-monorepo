import mongoose from 'mongoose';
import { MessageTemplate, IMessageTemplate } from '../../models/chat/MessageTemplate';
import logger from '../../utils/logger';

/**
 * TemplateService - Message Template Management
 * 
 * Handles CRUD operations for quick message templates
 */

export interface CreateTemplateDTO {
  title: string;
  content: string;
  category: 'medication_instructions' | 'follow_up' | 'side_effects' | 'general';
  variables?: string[];
  workplaceId: string;
  createdBy: string;
  isGlobal?: boolean;
}

export interface UpdateTemplateDTO {
  title?: string;
  content?: string;
  category?: 'medication_instructions' | 'follow_up' | 'side_effects' | 'general';
  variables?: string[];
}

export interface TemplateFilters {
  category?: string;
  search?: string;
  includeGlobal?: boolean;
}

export class TemplateService {
  /**
   * Create a new message template
   */
  async createTemplate(data: CreateTemplateDTO): Promise<IMessageTemplate> {
    try {
      // Extract variables from content ({{variableName}} format)
      const extractedVariables = this.extractVariables(data.content);
      
      const template = new MessageTemplate({
        title: data.title,
        content: data.content,
        category: data.category,
        variables: data.variables || extractedVariables,
        workplaceId: new mongoose.Types.ObjectId(data.workplaceId),
        createdBy: new mongoose.Types.ObjectId(data.createdBy),
        isGlobal: data.isGlobal || false,
      });

      await template.save();

      logger.info('Template created', {
        templateId: template._id,
        workplaceId: data.workplaceId,
      });

      return template;
    } catch (error) {
      logger.error('Error creating template', { error, data });
      throw error;
    }
  }

  /**
   * Get template by ID
   */
  async getTemplateById(templateId: string, workplaceId: string): Promise<IMessageTemplate | null> {
    try {
      const template = await MessageTemplate.findOne({
        _id: new mongoose.Types.ObjectId(templateId),
        $or: [
          { workplaceId: new mongoose.Types.ObjectId(workplaceId) },
          { isGlobal: true },
        ],
      });

      return template;
    } catch (error) {
      logger.error('Error getting template', { error, templateId });
      throw error;
    }
  }

  /**
   * Get templates with filters
   */
  async getTemplates(
    workplaceId: string,
    filters: TemplateFilters = {}
  ): Promise<IMessageTemplate[]> {
    try {
      const query: any = {
        $or: [
          { workplaceId: new mongoose.Types.ObjectId(workplaceId) },
        ],
      };

      // Include global templates if requested
      if (filters.includeGlobal !== false) {
        query.$or.push({ isGlobal: true });
      }

      // Filter by category
      if (filters.category) {
        query.category = filters.category;
      }

      // Search by text
      if (filters.search) {
        query.$text = { $search: filters.search };
      }

      const templates = await MessageTemplate.find(query)
        .sort(filters.search ? { score: { $meta: 'textScore' } } : { usageCount: -1, title: 1 })
        .populate('createdBy', 'firstName lastName')
        .lean();

      return templates as IMessageTemplate[];
    } catch (error) {
      logger.error('Error getting templates', { error, workplaceId, filters });
      throw error;
    }
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(
    category: string,
    workplaceId: string
  ): Promise<IMessageTemplate[]> {
    try {
      const templates = await MessageTemplate.find({
        category,
        $or: [
          { workplaceId: new mongoose.Types.ObjectId(workplaceId) },
          { isGlobal: true },
        ],
      })
        .sort({ usageCount: -1, title: 1 })
        .populate('createdBy', 'firstName lastName')
        .lean();

      return templates as IMessageTemplate[];
    } catch (error) {
      logger.error('Error getting templates by category', { error, category, workplaceId });
      throw error;
    }
  }

  /**
   * Update template
   */
  async updateTemplate(
    templateId: string,
    workplaceId: string,
    updates: UpdateTemplateDTO
  ): Promise<IMessageTemplate | null> {
    try {
      // If content is updated, re-extract variables
      if (updates.content) {
        updates.variables = this.extractVariables(updates.content);
      }

      const template = await MessageTemplate.findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(templateId),
          workplaceId: new mongoose.Types.ObjectId(workplaceId),
        },
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (template) {
        logger.info('Template updated', { templateId, workplaceId });
      }

      return template;
    } catch (error) {
      logger.error('Error updating template', { error, templateId });
      throw error;
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string, workplaceId: string): Promise<boolean> {
    try {
      const result = await MessageTemplate.deleteOne({
        _id: new mongoose.Types.ObjectId(templateId),
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      });

      if (result.deletedCount > 0) {
        logger.info('Template deleted', { templateId, workplaceId });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error deleting template', { error, templateId });
      throw error;
    }
  }

  /**
   * Use template (increment usage count)
   */
  async useTemplate(
    templateId: string,
    workplaceId: string,
    variables?: Record<string, string>
  ): Promise<{ template: IMessageTemplate; renderedContent: string }> {
    try {
      const template = await MessageTemplate.findOne({
        _id: new mongoose.Types.ObjectId(templateId),
        $or: [
          { workplaceId: new mongoose.Types.ObjectId(workplaceId) },
          { isGlobal: true },
        ],
      });

      if (!template) {
        throw new Error('Template not found');
      }

      // Increment usage
      await template.incrementUsage();

      // Render template with variables
      const renderedContent = variables
        ? template.renderTemplate(variables)
        : template.content;

      logger.info('Template used', { templateId, workplaceId });

      return {
        template,
        renderedContent,
      };
    } catch (error) {
      logger.error('Error using template', { error, templateId });
      throw error;
    }
  }

  /**
   * Extract variables from template content
   * Finds all {{variableName}} patterns
   */
  private extractVariables(content: string): string[] {
    const regex = /{{(\w+)}}/g;
    const variables: string[] = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    return variables;
  }

  /**
   * Get popular templates
   */
  async getPopularTemplates(
    workplaceId: string,
    limit: number = 10
  ): Promise<IMessageTemplate[]> {
    try {
      const templates = await MessageTemplate.find({
        $or: [
          { workplaceId: new mongoose.Types.ObjectId(workplaceId) },
          { isGlobal: true },
        ],
      })
        .sort({ usageCount: -1 })
        .limit(limit)
        .populate('createdBy', 'firstName lastName')
        .lean();

      return templates as IMessageTemplate[];
    } catch (error) {
      logger.error('Error getting popular templates', { error, workplaceId });
      throw error;
    }
  }

  /**
   * Get template statistics
   */
  async getTemplateStats(workplaceId: string): Promise<{
    total: number;
    byCategory: Record<string, number>;
    totalUsage: number;
  }> {
    try {
      const templates = await MessageTemplate.find({
        workplaceId: new mongoose.Types.ObjectId(workplaceId),
      });

      const stats = {
        total: templates.length,
        byCategory: {
          medication_instructions: 0,
          follow_up: 0,
          side_effects: 0,
          general: 0,
        },
        totalUsage: 0,
      };

      templates.forEach((template) => {
        stats.byCategory[template.category]++;
        stats.totalUsage += template.usageCount;
      });

      return stats;
    } catch (error) {
      logger.error('Error getting template stats', { error, workplaceId });
      throw error;
    }
  }
}

// Export singleton instance
export const templateService = new TemplateService();
export default templateService;
