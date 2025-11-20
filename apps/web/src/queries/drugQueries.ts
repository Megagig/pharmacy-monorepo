import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryResult,
  UseMutationResult,
} from '@tanstack/react-query';
import { drugInfoApi } from '../services/drugInfoApi';
import {
  DrugSearchResult,
  DrugMonograph,
  DrugInteraction,
  AdverseEffect,
  FormularyInfo,
  TherapyPlan,
  DrugIndication,
} from '../types/drugTypes';

// Query keys for drug information
export const drugQueryKeys = {
  all: ['drugs'] as const,
  search: (name: string) => [...drugQueryKeys.all, 'search', name] as const,
  monograph: (id: string) => [...drugQueryKeys.all, 'monograph', id] as const,
  interactions: (rxcui?: string, rxcuis?: string[]) =>
    [...drugQueryKeys.all, 'interactions', rxcui, rxcuis] as const,
  indications: (id: string | null) =>
    [...drugQueryKeys.all, 'indications', id] as const,
  adverseEffects: (id: string, limit?: number) =>
    [...drugQueryKeys.all, 'adverseEffects', id, limit] as const,
  formulary: (id: string) => [...drugQueryKeys.all, 'formulary', id] as const,
  therapyPlans: ['drugs', 'therapyPlans'] as const,
  therapyPlan: (id: string) => [...drugQueryKeys.therapyPlans, id] as const,
};

// Drug search hook
export const useDrugSearch = (
  name: string,
  enabled: boolean = true
): UseQueryResult<DrugSearchResult, Error> => {
  return useQuery<DrugSearchResult, Error>({
    queryKey: drugQueryKeys.search(name),
    queryFn: async () => {

      try {
        const result = await drugInfoApi.searchDrugs(name);

        return result;
      } catch (err) {
        console.error('Drug search API error:', err);
        throw err;
      }
    },
    enabled: enabled && name.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

// Drug monograph hook
export const useDrugMonograph = (
  id: string,
  enabled: boolean = true
): UseQueryResult<DrugMonograph, Error> => {
  return useQuery<DrugMonograph, Error>({
    queryKey: drugQueryKeys.monograph(id),
    queryFn: () => drugInfoApi.getMonograph(id),
    enabled: enabled && !!id,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
};

// Drug interactions hook
export const useDrugInteractions = (
  rxcui?: string,
  rxcuis?: string[]
): UseQueryResult<DrugInteraction, Error> => {
  return useQuery<DrugInteraction, Error>({
    queryKey: drugQueryKeys.interactions(rxcui, rxcuis),
    queryFn: () => drugInfoApi.checkInteractions(rxcui, rxcuis),
    enabled: !!rxcui || (!!rxcuis && rxcuis.length > 0),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

// Drug indications hook
export const useDrugIndications = (
  drugId: string | null
): UseQueryResult<DrugIndication, Error> => {
  return useQuery<DrugIndication, Error>({
    queryKey: drugQueryKeys.indications(drugId),
    queryFn: () => drugInfoApi.getIndications(drugId!),
    enabled: !!drugId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
};

// Adverse effects hook
export const useAdverseEffects = (
  id: string,
  limit?: number
): UseQueryResult<AdverseEffect, Error> => {
  return useQuery<AdverseEffect, Error>({
    queryKey: drugQueryKeys.adverseEffects(id, limit),
    queryFn: () => drugInfoApi.getAdverseEffects(id, limit),
    enabled: !!id,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
};

// Formulary info hook
export const useFormularyInfo = (
  id: string,
  enabled: boolean = true
): UseQueryResult<FormularyInfo, Error> => {
  return useQuery<FormularyInfo, Error>({
    queryKey: drugQueryKeys.formulary(id),
    queryFn: () => drugInfoApi.getFormularyInfo(id),
    enabled: enabled && !!id,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
};

// Therapy plans hooks
export const useTherapyPlans = (): UseQueryResult<TherapyPlan[], Error> => {
  return useQuery<TherapyPlan[], Error>({
    queryKey: drugQueryKeys.therapyPlans,
    queryFn: drugInfoApi.getTherapyPlans,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useTherapyPlan = (
  id: string
): UseQueryResult<TherapyPlan, Error> => {
  return useQuery<TherapyPlan, Error>({
    queryKey: drugQueryKeys.therapyPlan(id),
    queryFn: () => drugInfoApi.getTherapyPlan(id),
    enabled: !!id,
  });
};

// Therapy plan mutations
export const useCreateTherapyPlan = (): UseMutationResult<
  TherapyPlan,
  Error,
  Omit<TherapyPlan, '_id' | 'createdAt' | 'updatedAt'>,
  unknown
> => {
  const queryClient = useQueryClient();

  return useMutation<
    TherapyPlan,
    Error,
    Omit<TherapyPlan, '_id' | 'createdAt' | 'updatedAt'>
  >({
    mutationFn: drugInfoApi.createTherapyPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: drugQueryKeys.therapyPlans });
    },
  });
};

export const useUpdateTherapyPlan = (): UseMutationResult<
  TherapyPlan,
  Error,
  { id: string; plan: Partial<TherapyPlan> },
  unknown
> => {
  const queryClient = useQueryClient();

  return useMutation<
    TherapyPlan,
    Error,
    { id: string; plan: Partial<TherapyPlan> }
  >({
    mutationFn: ({ id, plan }) => drugInfoApi.updateTherapyPlan(id, plan),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: drugQueryKeys.therapyPlans });
      queryClient.invalidateQueries({
        queryKey: drugQueryKeys.therapyPlan(data._id!),
      });
    },
  });
};

export const useDeleteTherapyPlan = (): UseMutationResult<
  void,
  Error,
  string,
  unknown
> => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: drugInfoApi.deleteTherapyPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: drugQueryKeys.therapyPlans });
    },
  });
};
