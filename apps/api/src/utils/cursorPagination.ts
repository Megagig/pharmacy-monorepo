import mongoose, { Model, Document, FilterQuery, SortOrder } from 'mongoose';
import logger from './logger';

export interface CursorPaginationOptions {
  limit?: number;
  cursor?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: FilterQuery<any>;
}

export interface CursorPaginationResult<T> {
  items: T[];
  nextCursor: string | null;
  prevCursor: string | null;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  totalCount?: number;
  pageInfo: {
    startCursor: string | null;
    endCursor: string | null;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface CursorInfo {
  id: string;
  sortValue: any;
  direction: 'forward' | 'backward';
}

/**
 * Cursor-based pagination utility for MongoDB collections
 * Provides efficient pagination for large datasets without skip/limit performance issues
 */
export class CursorPagination {
  /**
   * Paginate a MongoDB collection using cursor-based pagination
   */
  static async paginate<T extends Document>(
    model: Model<T>,
    options: CursorPaginationOptions = {}
  ): Promise<CursorPaginationResult<T>> {
    const {
      limit = 20,
      cursor,
      sortField = 'createdAt',
      sortOrder = 'desc',
      filters = {},
    } = options;

    try {
      // Parse cursor if provided
      const cursorInfo = cursor ? this.parseCursor(cursor) : null;

      // Build query
      let query = model.find(filters);

      // Apply cursor-based filtering
      if (cursorInfo) {
        query = this.applyCursorFilter(query, cursorInfo, sortField, sortOrder);
      }

      // Apply sorting
      const sortDirection: SortOrder = sortOrder === 'asc' ? 1 : -1;
      query = query.sort({ [sortField]: sortDirection, _id: sortDirection });

      // Fetch one extra item to determine if there's a next page
      const items = await query.limit(limit + 1).lean<T[]>();

      // Determine pagination info
      const hasNextPage = items.length > limit;
      const hasPrevPage = !!cursorInfo;

      // Remove the extra item if it exists
      const resultItems = hasNextPage ? items.slice(0, limit) : items;

      // Generate cursors
      const startCursor = resultItems.length > 0
        ? this.generateCursor(resultItems[0], sortField, 'forward')
        : null;

      const endCursor = resultItems.length > 0
        ? this.generateCursor(resultItems[resultItems.length - 1], sortField, 'forward')
        : null;

      const nextCursor = hasNextPage ? endCursor : null;
      const prevCursor = hasPrevPage ? startCursor : null;

      return {
        items: resultItems,
        nextCursor,
        prevCursor,
        hasNextPage,
        hasPrevPage,
        pageInfo: {
          startCursor,
          endCursor,
          hasNextPage,
          hasPrevPage,
        },
      };

    } catch (error) {
      logger.error('Error in cursor pagination:', error);
      throw error;
    }
  }

  /**
   * Paginate with total count (more expensive but sometimes needed)
   */
  static async paginateWithCount<T extends Document>(
    model: Model<T>,
    options: CursorPaginationOptions = {}
  ): Promise<CursorPaginationResult<T>> {
    const result = await this.paginate(model, options);

    try {
      // Get total count (expensive operation)
      const totalCount = await model.countDocuments(options.filters || {});
      result.totalCount = totalCount;
    } catch (error) {
      logger.warn('Failed to get total count for pagination:', error);
    }

    return result;
  }

  /**
   * Generate a cursor string from a document
   */
  private static generateCursor(
    document: any,
    sortField: string,
    direction: 'forward' | 'backward'
  ): string {
    const cursorInfo: CursorInfo = {
      id: document._id.toString(),
      sortValue: document[sortField],
      direction,
    };

    // Base64 encode the cursor info
    return Buffer.from(JSON.stringify(cursorInfo)).toString('base64');
  }

  /**
   * Parse a cursor string back to cursor info
   */
  private static parseCursor(cursor: string): CursorInfo {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      return JSON.parse(decoded);
    } catch (error) {
      throw new Error('Invalid cursor format');
    }
  }

  /**
   * Apply cursor-based filtering to a query
   */
  private static applyCursorFilter<T extends Document>(
    query: any,
    cursorInfo: CursorInfo,
    sortField: string,
    sortOrder: 'asc' | 'desc'
  ): any {
    const { id, sortValue, direction } = cursorInfo;

    if (direction === 'forward') {
      // Moving forward in pagination
      if (sortOrder === 'desc') {
        // For descending order, we want items with sortValue less than cursor
        query = query.where({
          $or: [
            { [sortField]: { $lt: sortValue } },
            { [sortField]: sortValue, _id: { $lt: new mongoose.Types.ObjectId(id) } }
          ]
        });
      } else {
        // For ascending order, we want items with sortValue greater than cursor
        query = query.where({
          $or: [
            { [sortField]: { $gt: sortValue } },
            { [sortField]: sortValue, _id: { $gt: new mongoose.Types.ObjectId(id) } }
          ]
        });
      }
    } else {
      // Moving backward in pagination (for prev page)
      if (sortOrder === 'desc') {
        query = query.where({
          $or: [
            { [sortField]: { $gt: sortValue } },
            { [sortField]: sortValue, _id: { $gt: new mongoose.Types.ObjectId(id) } }
          ]
        });
      } else {
        query = query.where({
          $or: [
            { [sortField]: { $lt: sortValue } },
            { [sortField]: sortValue, _id: { $lt: new mongoose.Types.ObjectId(id) } }
          ]
        });
      }
    }

    return query;
  }

  /**
   * Create a paginated response for API endpoints
   */
  static createPaginatedResponse<T>(
    result: CursorPaginationResult<T>,
    baseUrl: string,
    queryParams: Record<string, any> = {}
  ) {
    const { nextCursor, prevCursor, pageInfo, totalCount } = result;

    // Build next/prev URLs
    const nextUrl = nextCursor
      ? `${baseUrl}?${new URLSearchParams({ ...queryParams, cursor: nextCursor }).toString()}`
      : null;

    const prevUrl = prevCursor
      ? `${baseUrl}?${new URLSearchParams({ ...queryParams, cursor: prevCursor }).toString()}`
      : null;

    return {
      data: result.items,
      pagination: {
        pageInfo,
        totalCount,
        cursors: {
          next: nextCursor,
          prev: prevCursor,
        },
        links: {
          next: nextUrl,
          prev: prevUrl,
        },
      },
    };
  }
}

/**
 * Middleware to add cursor pagination to request object
 */
export const cursorPaginationMiddleware = (req: any, res: any, next: any) => {
  req.paginate = async <T extends Document>(
    model: Model<T>,
    options: Partial<CursorPaginationOptions> = {}
  ) => {
    const paginationOptions: CursorPaginationOptions = {
      limit: parseInt(req.query.limit as string) || 20,
      cursor: req.query.cursor as string,
      sortField: req.query.sortField as string || 'createdAt',
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      filters: options.filters || {},
      ...options,
    };

    return CursorPagination.paginate(model, paginationOptions);
  };

  req.paginateWithCount = async <T extends Document>(
    model: Model<T>,
    options: Partial<CursorPaginationOptions> = {}
  ) => {
    const paginationOptions: CursorPaginationOptions = {
      limit: parseInt(req.query.limit as string) || 20,
      cursor: req.query.cursor as string,
      sortField: req.query.sortField as string || 'createdAt',
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      filters: options.filters || {},
      ...options,
    };

    return CursorPagination.paginateWithCount(model, paginationOptions);
  };

  next();
};

/**
 * Helper function to convert skip/limit pagination to cursor pagination
 */
export const convertSkipLimitToCursor = (
  page: number,
  limit: number,
  sortField: string = 'createdAt'
): { limit: number; skip?: number } => {
  // This is a transitional helper - in practice, you'd want to eliminate skip entirely
  // But this can help during migration from skip/limit to cursor-based pagination

  logger.warn('Using skip/limit pagination - consider migrating to cursor-based pagination for better performance');

  return {
    limit,
    skip: (page - 1) * limit,
  };
};

export default CursorPagination;
