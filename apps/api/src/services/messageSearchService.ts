import mongoose from "mongoose";
import Message, { IMessage } from "../models/Message";
import Conversation, { IConversation } from "../models/Conversation";
import User from "../models/User";
import logger from "../utils/logger";

export interface AdvancedSearchFilters {
  query?: string;
  conversationId?: string;
  senderId?: string;
  participantId?: string;
  messageType?:
    | "text"
    | "file"
    | "image"
    | "clinical_note"
    | "system"
    | "voice_note";
  fileType?: string;
  priority?: "normal" | "high" | "urgent";
  hasAttachments?: boolean;
  hasMentions?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: "relevance" | "date" | "sender";
  sortOrder?: "asc" | "desc";
}

export interface SearchResult {
  message: IMessage;
  conversation: IConversation;
  highlights?: {
    content?: string;
    title?: string;
  };
  score?: number;
}

export interface SearchStats {
  totalResults: number;
  searchTime: number;
  facets: {
    messageTypes: { type: string; count: number }[];
    senders: { userId: string; name: string; count: number }[];
    conversations: { conversationId: string; title: string; count: number }[];
    dateRanges: { range: string; count: number }[];
  };
}

/**
 * Enhanced message search service with advanced filtering and performance optimization
 */
export class MessageSearchService {
  /**
   * Perform advanced message search with faceted results
   */
  async searchMessages(
    workplaceId: string,
    userId: string,
    filters: AdvancedSearchFilters,
  ): Promise<{ results: SearchResult[]; stats: SearchStats }> {
    const startTime = Date.now();

    try {
      // Get user's accessible conversations
      const userConversations = await this.getUserConversations(
        workplaceId,
        userId,
      );
      const conversationIds = userConversations.map((c) => c._id);

      // Build search pipeline
      const pipeline = this.buildSearchPipeline(conversationIds, filters);

      // Execute search
      const [searchResults, facetResults] = await Promise.all([
        Message.aggregate(pipeline),
        this.getFacetedResults(conversationIds, filters, workplaceId),
      ]);

      // Process results with highlighting
      const processedResults = await this.processSearchResults(
        searchResults,
        filters.query,
      );

      const searchTime = Date.now() - startTime;

      return {
        results: processedResults,
        stats: {
          totalResults: processedResults.length,
          searchTime,
          facets: facetResults,
        },
      };
    } catch (error) {
      logger.error("Error in advanced message search:", error);
      throw error;
    }
  }

  /**
   * Search conversations with advanced filtering
   */
  async searchConversations(
    workplaceId: string,
    userId: string,
    filters: Omit<
      AdvancedSearchFilters,
      "messageType" | "hasAttachments" | "hasMentions"
    >,
  ): Promise<{ results: IConversation[]; stats: Partial<SearchStats> }> {
    const startTime = Date.now();

    try {
      const pipeline = this.buildConversationSearchPipeline(
        workplaceId,
        userId,
        filters,
      );
      const results = await Conversation.aggregate(pipeline);

      const searchTime = Date.now() - startTime;

      return {
        results,
        stats: {
          totalResults: results.length,
          searchTime,
        },
      };
    } catch (error) {
      logger.error("Error in conversation search:", error);
      throw error;
    }
  }

  /**
   * Get search suggestions based on user's history and popular searches
   */
  async getSearchSuggestions(
    workplaceId: string,
    userId: string,
    query?: string,
  ): Promise<{
    suggestions: string[];
    popularSearches: string[];
    recentSearches: string[];
  }> {
    try {
      // Get user's accessible conversations for context
      const userConversations = await this.getUserConversations(
        workplaceId,
        userId,
      );
      const conversationIds = userConversations.map((c) => c._id);

      // Get popular terms from messages
      const popularTerms = await this.getPopularSearchTerms(conversationIds);

      // Get recent searches from user's search history (would be stored separately)
      const recentSearches = await this.getUserRecentSearches(userId);

      // Generate suggestions based on query
      const suggestions = query
        ? await this.generateQuerySuggestions(query, conversationIds)
        : [];

      return {
        suggestions,
        popularSearches: popularTerms,
        recentSearches,
      };
    } catch (error) {
      logger.error("Error getting search suggestions:", error);
      return {
        suggestions: [],
        popularSearches: [],
        recentSearches: [],
      };
    }
  }

  /**
   * Save user search for history tracking
   */
  async saveSearchHistory(
    userId: string,
    query: string,
    filters: AdvancedSearchFilters,
    resultCount: number,
  ): Promise<void> {
    try {
      // This would typically save to a SearchHistory model
      // For now, we'll use a simple in-memory approach or Redis
      logger.info(
        `Saving search history for user ${userId}: "${query}" (${resultCount} results)`,
      );
    } catch (error) {
      logger.error("Error saving search history:", error);
    }
  }

  /**
   * Get user's accessible conversations
   */
  private async getUserConversations(
    workplaceId: string,
    userId: string,
  ): Promise<IConversation[]> {
    return await Conversation.find({
      workplaceId,
      "participants.userId": userId,
      "participants.leftAt": { $exists: false },
      status: { $ne: "closed" },
    }).select("_id title type");
  }

  /**
   * Build MongoDB aggregation pipeline for message search
   */
  private buildSearchPipeline(
    conversationIds: mongoose.Types.ObjectId[],
    filters: AdvancedSearchFilters,
  ): any[] {
    const pipeline: any[] = [];

    // Match stage - basic filtering
    const matchStage: any = {
      conversationId: { $in: conversationIds },
    };

    if (filters.query) {
      matchStage.$text = { $search: filters.query };
    }

    if (filters.conversationId) {
      matchStage.conversationId = new mongoose.Types.ObjectId(
        filters.conversationId,
      );
    }

    if (filters.senderId) {
      matchStage.senderId = new mongoose.Types.ObjectId(filters.senderId);
    }

    if (filters.messageType) {
      matchStage["content.type"] = filters.messageType;
    }

    if (filters.priority) {
      matchStage.priority = filters.priority;
    }

    if (filters.hasAttachments !== undefined) {
      if (filters.hasAttachments) {
        matchStage["content.attachments"] = { $exists: true, $ne: [] };
      } else {
        matchStage["content.attachments"] = { $exists: false };
      }
    }

    if (filters.hasMentions !== undefined) {
      if (filters.hasMentions) {
        matchStage.mentions = { $exists: true, $ne: [] };
      } else {
        matchStage.mentions = { $exists: false };
      }
    }

    if (filters.dateFrom || filters.dateTo) {
      matchStage.createdAt = {};
      if (filters.dateFrom) {
        matchStage.createdAt.$gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        matchStage.createdAt.$lte = filters.dateTo;
      }
    }

    if (filters.fileType && filters.messageType === "file") {
      matchStage["content.attachments.mimeType"] = {
        $regex: filters.fileType,
        $options: "i",
      };
    }

    pipeline.push({ $match: matchStage });

    // Add text score for relevance sorting
    if (filters.query) {
      pipeline.push({
        $addFields: {
          score: { $meta: "textScore" },
        },
      });
    }

    // Lookup conversation details
    pipeline.push({
      $lookup: {
        from: "conversations",
        localField: "conversationId",
        foreignField: "_id",
        as: "conversation",
      },
    });

    pipeline.push({
      $unwind: "$conversation",
    });

    // Lookup sender details
    pipeline.push({
      $lookup: {
        from: "users",
        localField: "senderId",
        foreignField: "_id",
        as: "sender",
      },
    });

    pipeline.push({
      $unwind: "$sender",
    });

    // Filter by participant if specified
    if (filters.participantId) {
      pipeline.push({
        $match: {
          "conversation.participants.userId": new mongoose.Types.ObjectId(
            filters.participantId,
          ),
        },
      });
    }

    // Filter by conversation tags if specified
    if (filters.tags && filters.tags.length > 0) {
      pipeline.push({
        $match: {
          "conversation.tags": { $in: filters.tags },
        },
      });
    }

    // Sort stage
    const sortStage: any = {};
    if (filters.sortBy === "relevance" && filters.query) {
      sortStage.score = { $meta: "textScore" };
    } else if (filters.sortBy === "sender") {
      sortStage["sender.firstName"] = filters.sortOrder === "desc" ? -1 : 1;
    } else {
      // Default to date sorting
      sortStage.createdAt = filters.sortOrder === "asc" ? 1 : -1;
    }

    pipeline.push({ $sort: sortStage });

    // Pagination
    if (filters.offset) {
      pipeline.push({ $skip: filters.offset });
    }

    if (filters.limit) {
      pipeline.push({ $limit: filters.limit });
    }

    // Project final fields
    pipeline.push({
      $project: {
        _id: 1,
        conversationId: 1,
        senderId: 1,
        content: 1,
        mentions: 1,
        priority: 1,
        status: 1,
        createdAt: 1,
        updatedAt: 1,
        score: { $ifNull: ["$score", 0] },
        conversation: {
          _id: "$conversation._id",
          title: "$conversation.title",
          type: "$conversation.type",
          status: "$conversation.status",
        },
        sender: {
          _id: "$sender._id",
          firstName: "$sender.firstName",
          lastName: "$sender.lastName",
          role: "$sender.role",
        },
      },
    });

    return pipeline;
  }

  /**
   * Build conversation search pipeline
   */
  private buildConversationSearchPipeline(
    workplaceId: string,
    userId: string,
    filters: Omit<
      AdvancedSearchFilters,
      "messageType" | "hasAttachments" | "hasMentions"
    >,
  ): any[] {
    const pipeline: any[] = [];

    const matchStage: any = {
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      "participants.userId": new mongoose.Types.ObjectId(userId),
      "participants.leftAt": { $exists: false },
    };

    if (filters.query) {
      matchStage.$text = { $search: filters.query };
    }

    if (filters.priority) {
      matchStage.priority = filters.priority;
    }

    if (filters.tags && filters.tags.length > 0) {
      matchStage.tags = { $in: filters.tags };
    }

    if (filters.dateFrom || filters.dateTo) {
      matchStage.createdAt = {};
      if (filters.dateFrom) {
        matchStage.createdAt.$gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        matchStage.createdAt.$lte = filters.dateTo;
      }
    }

    pipeline.push({ $match: matchStage });

    // Add text score for relevance
    if (filters.query) {
      pipeline.push({
        $addFields: {
          score: { $meta: "textScore" },
        },
      });
    }

    // Lookup participants
    pipeline.push({
      $lookup: {
        from: "users",
        localField: "participants.userId",
        foreignField: "_id",
        as: "participantDetails",
      },
    });

    // Sort and paginate
    const sortStage: any = {};
    if (filters.query) {
      sortStage.score = { $meta: "textScore" };
    }
    sortStage.lastMessageAt = -1;

    pipeline.push({ $sort: sortStage });

    if (filters.offset) {
      pipeline.push({ $skip: filters.offset });
    }

    if (filters.limit) {
      pipeline.push({ $limit: filters.limit });
    }

    return pipeline;
  }

  /**
   * Get faceted search results for filtering
   */
  private async getFacetedResults(
    conversationIds: mongoose.Types.ObjectId[],
    filters: AdvancedSearchFilters,
    workplaceId: string,
  ): Promise<SearchStats["facets"]> {
    try {
      const facetPipeline: any[] = [
        {
          $match: {
            conversationId: { $in: conversationIds },
          },
        },
        {
          $facet: {
            messageTypes: [
              { $group: { _id: "$content.type", count: { $sum: 1 } } },
              { $project: { type: "$_id", count: 1, _id: 0 } },
              { $sort: { count: -1 } },
            ],
            senders: [
              { $group: { _id: "$senderId", count: { $sum: 1 } } },
              {
                $lookup: {
                  from: "users",
                  localField: "_id",
                  foreignField: "_id",
                  as: "user",
                },
              },
              { $unwind: "$user" },
              {
                $project: {
                  userId: "$_id",
                  name: { $concat: ["$user.firstName", " ", "$user.lastName"] },
                  count: 1,
                  _id: 0,
                },
              },
              { $sort: { count: -1 } },
              { $limit: 10 },
            ],
            conversations: [
              { $group: { _id: "$conversationId", count: { $sum: 1 } } },
              {
                $lookup: {
                  from: "conversations",
                  localField: "_id",
                  foreignField: "_id",
                  as: "conversation",
                },
              },
              { $unwind: "$conversation" },
              {
                $project: {
                  conversationId: "$_id",
                  title: "$conversation.title",
                  count: 1,
                  _id: 0,
                },
              },
              { $sort: { count: -1 } },
              { $limit: 10 },
            ],
          },
        },
      ];

      const [facetResults] = await Message.aggregate(facetPipeline);

      return {
        messageTypes: facetResults.messageTypes || [],
        senders: facetResults.senders || [],
        conversations: facetResults.conversations || [],
        dateRanges: [], // Would implement date range faceting
      };
    } catch (error) {
      logger.error("Error getting faceted results:", error);
      return {
        messageTypes: [],
        senders: [],
        conversations: [],
        dateRanges: [],
      };
    }
  }

  /**
   * Process search results with highlighting
   */
  private async processSearchResults(
    results: any[],
    query?: string,
  ): Promise<SearchResult[]> {
    return results.map((result) => {
      const searchResult: SearchResult = {
        message: result,
        conversation: result.conversation,
        score: result.score || 0,
      };

      // Add highlighting if query exists
      if (query && result.content?.text) {
        searchResult.highlights = {
          content: this.highlightText(result.content.text, query),
        };
      }

      return searchResult;
    });
  }

  /**
   * Highlight search terms in text
   */
  private highlightText(text: string, query: string): string {
    if (!text || !query) return text;

    const terms = query.split(" ").filter((term) => term.length > 2);
    let highlightedText = text;

    terms.forEach((term) => {
      const regex = new RegExp(`(${term})`, "gi");
      highlightedText = highlightedText.replace(regex, "<mark>$1</mark>");
    });

    return highlightedText;
  }

  /**
   * Get popular search terms from message content
   */
  private async getPopularSearchTerms(
    conversationIds: mongoose.Types.ObjectId[],
  ): Promise<string[]> {
    try {
      // This would typically analyze message content to extract popular terms
      // For now, return some common healthcare-related terms
      return [
        "medication",
        "prescription",
        "dosage",
        "side effects",
        "patient",
        "treatment",
        "diagnosis",
        "therapy",
      ];
    } catch (error) {
      logger.error("Error getting popular search terms:", error);
      return [];
    }
  }

  /**
   * Get user's recent searches
   */
  private async getUserRecentSearches(userId: string): Promise<string[]> {
    try {
      // This would fetch from a SearchHistory model or Redis
      // For now, return empty array
      return [];
    } catch (error) {
      logger.error("Error getting user recent searches:", error);
      return [];
    }
  }

  /**
   * Generate query suggestions based on partial input
   */
  private async generateQuerySuggestions(
    query: string,
    conversationIds: mongoose.Types.ObjectId[],
  ): Promise<string[]> {
    try {
      // This would use text analysis to suggest completions
      // For now, return simple suggestions
      const suggestions = [
        `${query} medication`,
        `${query} patient`,
        `${query} prescription`,
        `${query} side effects`,
      ];

      return suggestions.filter((s) => s !== query);
    } catch (error) {
      logger.error("Error generating query suggestions:", error);
      return [];
    }
  }
}

export const messageSearchService = new MessageSearchService();
export default messageSearchService;
