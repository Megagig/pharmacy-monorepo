import { useQuery } from '@tanstack/react-query';
import medicationManagementService from '../services/medicationManagementService';

// Define query keys
export const medicationAnalyticsKeys = {
  all: ['medicationAnalytics'] as const,
  adherence: () => [...medicationAnalyticsKeys.all, 'adherence'] as const,
  adherenceAnalytics: (patientId: string, period: string) =>
    [...medicationAnalyticsKeys.adherence(), patientId, period] as const,
  prescriptionPatterns: () =>
    [...medicationAnalyticsKeys.all, 'prescriptionPatterns'] as const,
  prescriptionPatternAnalytics: (patientId: string) =>
    [...medicationAnalyticsKeys.prescriptionPatterns(), patientId] as const,
  interactions: () => [...medicationAnalyticsKeys.all, 'interactions'] as const,
  interactionAnalytics: (patientId: string) =>
    [...medicationAnalyticsKeys.interactions(), patientId] as const,
  costs: () => [...medicationAnalyticsKeys.all, 'costs'] as const,
  costAnalytics: (patientId: string) =>
    [...medicationAnalyticsKeys.costs(), patientId] as const,
  summary: () => [...medicationAnalyticsKeys.all, 'summary'] as const,
  patientSummary: (patientId: string) =>
    [...medicationAnalyticsKeys.summary(), patientId] as const,
};

// Enhanced Analytics Hooks with Naira Currency Support

/**
 * Hook for getting enhanced medication adherence analytics
 */
export const useAdherenceAnalytics = (
  patientId: string,
  period: string = '6months'
) => {
  return useQuery({
    queryKey: medicationAnalyticsKeys.adherenceAnalytics(patientId, period),
    queryFn: () =>
      medicationManagementService.getAdherenceAnalytics(patientId, period),
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

/**
 * Hook for getting enhanced prescription pattern analytics with Naira currency
 */
export const usePrescriptionPatternAnalytics = (patientId: string) => {
  return useQuery({
    queryKey: medicationAnalyticsKeys.prescriptionPatternAnalytics(patientId),
    queryFn: () =>
      medicationManagementService.getPrescriptionPatternAnalytics(patientId),
    enabled: !!patientId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

/**
 * Hook for getting enhanced interaction analytics with financial impact
 */
export const useInteractionAnalytics = (patientId: string) => {
  return useQuery({
    queryKey: medicationAnalyticsKeys.interactionAnalytics(patientId),
    queryFn: () =>
      medicationManagementService.getMedicationInteractionAnalytics(patientId),
    enabled: !!patientId,
    staleTime: 15 * 60 * 1000, // 15 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

/**
 * Hook for getting medication cost analytics with Naira currency
 */
export const useMedicationCostAnalytics = (patientId: string) => {
  return useQuery({
    queryKey: medicationAnalyticsKeys.costAnalytics(patientId),
    queryFn: () =>
      medicationManagementService.getMedicationCostAnalytics(patientId),
    enabled: !!patientId,
    staleTime: 20 * 60 * 1000, // 20 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

/**
 * Hook for getting enhanced patient medication summary with Naira currency
 */
export const usePatientMedicationSummary = (patientId: string) => {
  return useQuery({
    queryKey: medicationAnalyticsKeys.patientSummary(patientId),
    queryFn: () =>
      medicationManagementService.getPatientMedicationSummary(patientId),
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 15000),
  });
};
