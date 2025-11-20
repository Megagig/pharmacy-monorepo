import { Types } from 'mongoose';

/**
 * Safely converts a string or ObjectId to ObjectId
 * @param id The ID to convert (string or ObjectId)
 * @returns ObjectId or undefined if conversion fails
 */
export function toObjectId(id: string | Types.ObjectId | undefined): Types.ObjectId | undefined {
    if (!id) return undefined;

    if (id instanceof Types.ObjectId) {
        return id;
    }

    try {
        return new Types.ObjectId(id);
    } catch (error) {
        console.warn(`Failed to convert to ObjectId: ${id}`, error);
        return undefined;
    }
}

/**
 * Safely converts an array of string/ObjectIds to ObjectIds
 * @param ids Array of IDs to convert
 * @returns Array of ObjectIds, filtering out invalid ones
 */
export function toObjectIds(ids: (string | Types.ObjectId)[] | undefined): Types.ObjectId[] {
    if (!ids) return [];

    return ids
        .map(id => toObjectId(id))
        .filter((id): id is Types.ObjectId => id !== undefined);
}

/**
 * Safely converts a string or ObjectId to string
 * @param id The ID to convert
 * @returns String representation of the ID
 */
export function toStringId(id: string | Types.ObjectId | undefined): string | undefined {
    if (!id) return undefined;

    if (typeof id === 'string') {
        return id;
    }

    return id.toString();
}

/**
 * Checks if a value is a valid ObjectId string
 * @param id The ID to validate
 * @returns True if valid ObjectId string
 */
export function isValidObjectId(id: string): boolean {
    try {
        new Types.ObjectId(id);
        return true;
    } catch {
        return false;
    }
}

/**
 * Creates an ObjectId or returns undefined if invalid
 * @param id The ID to create
 * @returns ObjectId or undefined
 */
export function createObjectId(id: string | Types.ObjectId | undefined): Types.ObjectId | undefined {
    return toObjectId(id);
}
