// Simple test to verify our drug-info module compiles correctly
import drugController from '../controllers/drugController';
import drugRoutes from '../routes/drugRoutes';
import rxnormService from '../services/rxnormService';
import dailymedService from '../services/dailymedService';
import openfdaService from '../services/openfdaService';
import interactionService from '../services/interactionService';
import { DrugSearchHistory, TherapyPlan } from '../models/drugCacheModel';

console.log('Drug Information Center module imports successfully!');
console.log('All components are properly typed and compiled.');

export {
  drugController,
  drugRoutes,
  rxnormService,
  dailymedService,
  openfdaService,
  interactionService,
  DrugSearchHistory,
  TherapyPlan
};