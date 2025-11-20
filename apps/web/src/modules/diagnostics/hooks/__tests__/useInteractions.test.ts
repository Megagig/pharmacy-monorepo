import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import {
    useCheckInteractions,
    useDrugInfo,
    useSearchDrugs,
    useAllergyCheck,
} from '../useInteractions';
import { interactionApi } from '../../api/interactionApi';

// Mock the API
vi.mock('../../api/interactionApi');
vi.mock('../../../../stores', () => ({
    useUIStore: () => ({
        addNotification: vi.fn(),
    }),
}));

const mockedInteractionApi = vi.mocked(interactionApi);

// Test wrapper with QueryClient
const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
            mutations: {
                retry: false,
            },
        },
    });

    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client= { queryClient } > { children } </QueryClientProvider>
    );
};

describe('useInteractions hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('useCheckInteractions', () => {
        it('should check drug interactions successfully', async () => {
            const mockInteractionResult = {
                interactions: [
                    {
                        drug1: 'Warfarin',
                        drug2: 'Aspirin',
                        severity: 'major' as const,
                        description: 'Increased bleeding risk',
                        clinicalEffect: 'Enhanced anticoagulation',
                        mechanism: 'Additive effect',
                        management: 'Monitor INR closely',
                    },
                ],
                allergicReactions: [],
                contraindications: [],
            };

            mockedInteractionApi.checkInteractions.mockResolvedValue({
                success: true,
                data: mockInteractionResult,
            });

            const wrapper = createWrapper();
            const { result } = renderHook(
                () => useCheckInteractions(['Warfarin', 'Aspirin'], [], {
                    debounceMs: 0, // Disable debouncing for tests
                }),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data?.data).toEqual(mockInteractionResult);
            expect(mockedInteractionApi.checkInteractions).toHaveBeenCalledWith({
                medications: ['Warfarin', 'Aspirin'],
                patientAllergies: [],
            });
        });

        it('should not check interactions with less than 2 medications', async () => {
            const wrapper = createWrapper();
            const { result } = renderHook(
                () => useCheckInteractions(['Warfarin'], [], { debounceMs: 0 }),
                { wrapper }
            );

            // Should not make API call
            expect(result.current.fetchStatus).toBe('idle');
            expect(mockedInteractionApi.checkInteractions).not.toHaveBeenCalled();
        });

        it('should handle allergy checking', async () => {
            const mockResult = {
                interactions: [],
                allergicReactions: [
                    {
                        drug: 'Penicillin',
                        allergy: 'Penicillin allergy',
                        severity: 'severe' as const,
                        reaction: 'Anaphylaxis',
                    },
                ],
                contraindications: [],
            };

            mockedInteractionApi.checkInteractions.mockResolvedValue({
                success: true,
                data: mockResult,
            });

            const wrapper = createWrapper();
            const { result } = renderHook(
                () => useCheckInteractions(['Penicillin', 'Amoxicillin'], ['Penicillin'], {
                    debounceMs: 0,
                }),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data?.data).toEqual(mockResult);
            expect(mockedInteractionApi.checkInteractions).toHaveBeenCalledWith({
                medications: ['Penicillin', 'Amoxicillin'],
                patientAllergies: ['Penicillin'],
            });
        });
    });

    describe('useDrugInfo', () => {
        it('should fetch drug information successfully', async () => {
            const mockDrugInfo = {
                rxcui: '11289',
                name: 'Warfarin',
                brandNames: ['Coumadin', 'Jantoven'],
                genericName: 'Warfarin Sodium',
                drugClass: 'Anticoagulant',
                indications: ['Atrial fibrillation', 'Deep vein thrombosis'],
                contraindications: ['Active bleeding', 'Pregnancy'],
                sideEffects: ['Bleeding', 'Bruising'],
                dosageForm: 'Tablet',
                strength: '5mg',
                route: 'Oral',
            };

            mockedInteractionApi.getDrugInfo.mockResolvedValue({
                success: true,
                data: mockDrugInfo,
            });

            const wrapper = createWrapper();
            const { result } = renderHook(() => useDrugInfo('Warfarin'), { wrapper });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data?.data).toEqual(mockDrugInfo);
            expect(mockedInteractionApi.getDrugInfo).toHaveBeenCalledWith('Warfarin');
        });

        it('should not fetch drug info for short queries', async () => {
            const wrapper = createWrapper();
            const { result } = renderHook(() => useDrugInfo('W'), { wrapper });

            // Should not make API call for short queries
            expect(result.current.fetchStatus).toBe('idle');
            expect(mockedInteractionApi.getDrugInfo).not.toHaveBeenCalled();
        });
    });

    describe('useSearchDrugs', () => {
        it('should search drugs successfully', async () => {
            const mockSearchResults = [
                {
                    rxcui: '11289',
                    name: 'Warfarin',
                    synonym: 'Warfarin Sodium',
                    tty: 'IN',
                },
                {
                    rxcui: '855332',
                    name: 'Warfarin Sodium 1 MG Oral Tablet',
                    synonym: 'Coumadin 1 MG Oral Tablet',
                    tty: 'SCD',
                },
            ];

            mockedInteractionApi.searchDrugs.mockResolvedValue({
                success: true,
                data: mockSearchResults,
            });

            const wrapper = createWrapper();
            const { result } = renderHook(
                () => useSearchDrugs('Warfarin', 10, 0), // Disable debouncing for tests
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data?.data).toEqual(mockSearchResults);
            expect(mockedInteractionApi.searchDrugs).toHaveBeenCalledWith('Warfarin', 10);
        });

        it('should not search with short queries', async () => {
            const wrapper = createWrapper();
            const { result } = renderHook(() => useSearchDrugs('W', 10, 0), { wrapper });

            // Should not make API call for short queries
            expect(result.current.fetchStatus).toBe('idle');
            expect(mockedInteractionApi.searchDrugs).not.toHaveBeenCalled();
        });
    });

    describe('useAllergyCheck', () => {
        it('should check allergies successfully', async () => {
            const mockAllergyResults = [
                {
                    drug: 'Penicillin',
                    allergy: 'Penicillin allergy',
                    severity: 'severe' as const,
                    reaction: 'Anaphylaxis',
                },
            ];

            mockedInteractionApi.checkAllergies.mockResolvedValue({
                success: true,
                data: mockAllergyResults,
            });

            const wrapper = createWrapper();
            const { result } = renderHook(
                () => useAllergyCheck(['Penicillin', 'Amoxicillin'], ['Penicillin']),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data?.data).toEqual(mockAllergyResults);
            expect(mockedInteractionApi.checkAllergies).toHaveBeenCalledWith({
                medications: ['Penicillin', 'Amoxicillin'],
                allergies: ['Penicillin'],
            });
        });

        it('should not check allergies when no medications or allergies provided', async () => {
            const wrapper = createWrapper();
            const { result } = renderHook(() => useAllergyCheck([], []), { wrapper });

            // Should not make API call when no data provided
            expect(result.current.fetchStatus).toBe('idle');
            expect(mockedInteractionApi.checkAllergies).not.toHaveBeenCalled();
        });
    });
});