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
export const generateMatchId = (pairA: number, pairB: number, timestamp: number): string => {
    return `${pairA}-vs-${pairB}-${timestamp}`;
};
