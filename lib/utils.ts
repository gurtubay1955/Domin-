/**
 * @file lib/utils.ts
 * @description Utility functions for robust data handling.
 * @author Antigravity (Google Deepmind)
 */

/**
 * Parsed JSON safely without throwing errors.
 * Returns the defaultValue if parsing fails or input is null/undefined.
 * 
 * @param data The string to parse.
 * @param defaultValue The fallback value if parsing fails.
 */
export const safeParse = <T>(data: string | null | undefined, defaultValue: T): T => {
    if (!data) return defaultValue;
    try {
        return JSON.parse(data);
    } catch (error) {
        console.warn("safeParse: Failed to parse JSON, using default value.", { data, error });
        return defaultValue;
    }
};

/**
 * Generates a unique ID for a match based on its parameters.
 * Prevents duplicate submissions of the same game result.
 */
/**
 * Generates a unique ID for a match based on its parameters.
 * Prevents duplicate submissions of the same game result.
 */
export const generateMatchId = (pairA: number, pairB: number, timestamp: number): string => {
    return `${pairA}-vs-${pairB}-${timestamp}`;
};

/**
 * Robust UUID generator that works in HTTP (non-secure) contexts.
 * Falls back to Math.random if crypto.randomUUID is not available.
 */
export const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for non-secure contexts (LAN via HTTP)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};
