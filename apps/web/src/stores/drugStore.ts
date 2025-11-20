import { create } from 'zustand';
import { 
  DrugSearchResult, 
  DrugMonograph, 
  DrugInteraction, 
  AdverseEffect, 
  FormularyInfo,
  TherapyPlan,
  Drug
} from '../types/drugTypes';

interface DrugState {
  // Search state
  searchQuery: string;
  searchResults: DrugSearchResult | null;
  isSearching: boolean;
  
  // Selected drug state
  selectedDrug: Drug | null;
  drugMonograph: DrugMonograph | null;
  drugInteractions: DrugInteraction | null;
  adverseEffects: AdverseEffect | null;
  formularyInfo: FormularyInfo | null;
  
  // Therapy plan state
  therapyPlans: TherapyPlan[];
  selectedTherapyPlan: TherapyPlan | null;
  
  // Loading states
  isLoadingMonograph: boolean;
  isLoadingInteractions: boolean;
  isLoadingAdverseEffects: boolean;
  isLoadingFormulary: boolean;
  isLoadingTherapyPlans: boolean;
  
  // Error states
  searchError: string | null;
  monographError: string | null;
  interactionError: string | null;
  adverseEffectsError: string | null;
  formularyError: string | null;
  
  // Actions
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: DrugSearchResult | null) => void;
  setIsSearching: (isSearching: boolean) => void;
  
  setSelectedDrug: (drug: Drug | null) => void;
  setDrugMonograph: (monograph: DrugMonograph | null) => void;
  setDrugInteractions: (interactions: DrugInteraction | null) => void;
  setAdverseEffects: (effects: AdverseEffect | null) => void;
  setFormularyInfo: (info: FormularyInfo | null) => void;
  
  setTherapyPlans: (plans: TherapyPlan[]) => void;
  setSelectedTherapyPlan: (plan: TherapyPlan | null) => void;
  
  setIsLoadingMonograph: (loading: boolean) => void;
  setIsLoadingInteractions: (loading: boolean) => void;
  setIsLoadingAdverseEffects: (loading: boolean) => void;
  setIsLoadingFormulary: (loading: boolean) => void;
  setIsLoadingTherapyPlans: (loading: boolean) => void;
  
  setSearchError: (error: string | null) => void;
  setMonographError: (error: string | null) => void;
  setInteractionError: (error: string | null) => void;
  setAdverseEffectsError: (error: string | null) => void;
  setFormularyError: (error: string | null) => void;
  
  resetDrugData: () => void;
  resetAll: () => void;
}

export const useDrugStore = create<DrugState>()((set) => ({
  // Search state
  searchQuery: '',
  searchResults: null,
  isSearching: false,
  
  // Selected drug state
  selectedDrug: null,
  drugMonograph: null,
  drugInteractions: null,
  adverseEffects: null,
  formularyInfo: null,
  
  // Therapy plan state
  therapyPlans: [],
  selectedTherapyPlan: null,
  
  // Loading states
  isLoadingMonograph: false,
  isLoadingInteractions: false,
  isLoadingAdverseEffects: false,
  isLoadingFormulary: false,
  isLoadingTherapyPlans: false,
  
  // Error states
  searchError: null,
  monographError: null,
  interactionError: null,
  adverseEffectsError: null,
  formularyError: null,
  
  // Actions
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchResults: (results) => set({ searchResults: results }),
  setIsSearching: (isSearching) => set({ isSearching }),
  
  setSelectedDrug: (drug) => set({ selectedDrug: drug }),
  setDrugMonograph: (monograph) => set({ drugMonograph: monograph }),
  setDrugInteractions: (interactions) => set({ drugInteractions: interactions }),
  setAdverseEffects: (effects) => set({ adverseEffects: effects }),
  setFormularyInfo: (info) => set({ formularyInfo: info }),
  
  setTherapyPlans: (plans) => set({ therapyPlans: plans }),
  setSelectedTherapyPlan: (plan) => set({ selectedTherapyPlan: plan }),
  
  setIsLoadingMonograph: (loading) => set({ isLoadingMonograph: loading }),
  setIsLoadingInteractions: (loading) => set({ isLoadingInteractions: loading }),
  setIsLoadingAdverseEffects: (loading) => set({ isLoadingAdverseEffects: loading }),
  setIsLoadingFormulary: (loading) => set({ isLoadingFormulary: loading }),
  setIsLoadingTherapyPlans: (loading) => set({ isLoadingTherapyPlans: loading }),
  
  setSearchError: (error) => set({ searchError: error }),
  setMonographError: (error) => set({ monographError: error }),
  setInteractionError: (error) => set({ interactionError: error }),
  setAdverseEffectsError: (error) => set({ adverseEffectsError: error }),
  setFormularyError: (error) => set({ formularyError: error }),
  
  resetDrugData: () => set({
    selectedDrug: null,
    drugMonograph: null,
    drugInteractions: null,
    adverseEffects: null,
    formularyInfo: null,
    searchResults: null
  }),
  
  resetAll: () => set({
    searchQuery: '',
    searchResults: null,
    isSearching: false,
    selectedDrug: null,
    drugMonograph: null,
    drugInteractions: null,
    adverseEffects: null,
    formularyInfo: null,
    therapyPlans: [],
    selectedTherapyPlan: null,
    isLoadingMonograph: false,
    isLoadingInteractions: false,
    isLoadingAdverseEffects: false,
    isLoadingFormulary: false,
    isLoadingTherapyPlans: false,
    searchError: null,
    monographError: null,
    interactionError: null,
    adverseEffectsError: null,
    formularyError: null
  })
}));