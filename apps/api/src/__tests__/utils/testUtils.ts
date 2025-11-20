import mongoose from 'mongoose';

/**
 * Test utilities for generating test data and IDs
 */
export const testUtils = {
    /**
     * Create a valid MongoDB ObjectId
     */
    createObjectId(): mongoose.Types.ObjectId {
        return new mongoose.Types.ObjectId();
    },

    /**
     * Create a valid ObjectId string
     */
    createObjectIdString(): string {
        return new mongoose.Types.ObjectId().toString();
    },

    /**
     * Generate a random email address
     */
    generateEmail(prefix = 'test'): string {
        return `${prefix}${Date.now()}@example.com`;
    },

    /**
     * Generate a random string
     */
    generateRandomString(length = 10): string {
        return Math.random().toString(36).substring(2, length + 2);
    },

    /**
     * Create a mock date
     */
    createMockDate(daysFromNow = 0): Date {
        const date = new Date();
        date.setDate(date.getDate() + daysFromNow);
        return date;
    },

    /**
     * Create expired date
     */
    createExpiredDate(): Date {
        const date = new Date();
        date.setDate(date.getDate() - 1);
        return date;
    }
};

export default testUtils;