import NaijaStates from 'naija-state-local-government';

/**
 * Get all Nigerian states
 * @returns Array of Nigerian state names
 */
export const getNigerianStates = (): string[] => {
    try {
        const states = NaijaStates.states();
        return Array.isArray(states) ? states : [];
    } catch (error) {
        console.error('Error fetching Nigerian states:', error);
        return [];
    }
};

/**
 * Get all Local Government Areas (LGAs) for a specific state
 * @param state - The state name (case insensitive)
 * @returns Array of LGA names for the specified state
 */
export const getLGAsForState = (state: string): string[] => {
    if (!state) return [];
    try {
        const result = NaijaStates.lgas(state);
        // The library returns an object with an 'lgas' property, not an array directly
        if (result && typeof result === 'object' && 'lgas' in result && Array.isArray(result.lgas)) {
            return result.lgas;
        }
        // Fallback: check if it's already an array (for backwards compatibility)
        if (Array.isArray(result)) {
            return result;
        }
        console.warn(`LGAs for state "${state}" has unexpected format:`, result);
        return [];
    } catch (error) {
        console.error(`Error fetching LGAs for state: ${state}`, error);
        return [];
    }
};

/**
 * Get all states with their LGAs
 * @returns Object containing all states and their LGAs
 */
export const getAllStatesWithLGAs = () => {
    return NaijaStates.all();
};

// Type definitions
export type NigerianState = string;
export type NigerianLGA = string;
