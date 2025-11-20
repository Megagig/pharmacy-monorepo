import { Request } from 'express';
import { IUser } from '../models/User';
import { IWorkplace } from '../models/Workplace';
import { ISubscription } from '../models/Subscription';
import { ISubscriptionPlan } from '../models/SubscriptionPlan';
import { IPricingPlan } from '../models/PricingPlan';
import { Types } from 'mongoose';

// Define system roles
export type UserRole =
  | 'pharmacist'
  | 'pharmacy_team'
  | 'pharmacy_outlet'
  | 'intern_pharmacist'
  | 'lab_technician'
  | 'super_admin'
  | 'owner';

// Define workplace roles
export type WorkplaceRole =
  | 'Owner'
  | 'Staff'
  | 'Pharmacist'
  | 'Cashier'
  | 'Technician'
  | 'Assistant'
  | 'pharmacy_outlet'
  | 'intern_pharmacist';

// Define subscription tiers
export type SubscriptionTier =
  | 'free_trial'
  | 'basic'
  | 'pro'
  | 'pharmily'
  | 'network'
  | 'enterprise';

// Permission matrix interface
export interface PermissionMatrix {
  [action: string]: {
    systemRoles?: UserRole[];
    workplaceRoles?: WorkplaceRole[];
    features?: string[];
    planTiers?: SubscriptionTier[];
    requiresActiveSubscription?: boolean;
    allowTrialAccess?: boolean;
  };
}

export interface WorkspaceContext {
  workspace: IWorkplace | null;
  subscription: ISubscription | null;
  plan: ISubscriptionPlan | IPricingPlan | null; // Support both plan model types
  permissions: string[];
  limits: PlanLimits;
  isTrialExpired: boolean;
  isSubscriptionActive: boolean;
}

export interface PlanLimits {
  patients: number | null;
  users: number | null;
  locations: number | null;
  storage: number | null;
  apiCalls: number | null;
  interventions?: number | null;
}

// Base user type for Express compatibility - enhanced with optional IUser properties
interface BaseUser {
  id?: string;
  _id?: string;
  workplaceId?: string | Types.ObjectId;

  // Optional properties from IUser for type safety
  role?: UserRole;
  workplaceRole?: WorkplaceRole;
  status?: string;
  assignedRoles?: Types.ObjectId[];
  permissions?: string[];
  directPermissions?: string[];
  deniedPermissions?: string[];
  cachedPermissions?: {
    permissions: string[];
    lastUpdated: Date;
    expiresAt: Date;
    workspaceId?: Types.ObjectId;
  };
  lastPermissionCheck?: Date;
  subscriptionTier?: SubscriptionTier;
  features?: string[];
  email?: string;
  firstName?: string;
  lastName?: string;
  emailVerified?: boolean;
}

// Extended user type with full IUser properties
interface ExtendedUser extends IUser {
  currentUsage?: number;
  usageLimit?: number;
  lastPermissionCheck?: Date;
}

// Enhanced type guard to check if user is ExtendedUser
export function isExtendedUser(user: BaseUser | ExtendedUser | undefined): user is ExtendedUser {
  return user !== undefined &&
    typeof user === 'object' &&
    'email' in user &&
    'passwordHash' in user &&
    'firstName' in user &&
    'lastName' in user;
}

// Type guard to check if user has role property
export function hasUserRole(user: BaseUser | ExtendedUser | undefined): user is BaseUser & { role: UserRole } {
  return user !== undefined && typeof user.role === 'string';
}

// Type guard to check if user has workplaceRole property
export function hasWorkplaceRole(user: BaseUser | ExtendedUser | undefined): user is BaseUser & { workplaceRole: WorkplaceRole } {
  return user !== undefined && typeof user.workplaceRole === 'string';
}

// Type guard to check if user has status property
export function hasUserStatus(user: BaseUser | ExtendedUser | undefined): user is BaseUser & { status: string } {
  return user !== undefined && typeof user.status === 'string';
}

// Type guard to check if user has assignedRoles property
export function hasAssignedRoles(user: BaseUser | ExtendedUser | undefined): user is BaseUser & { assignedRoles: Types.ObjectId[] } {
  return user !== undefined && Array.isArray(user.assignedRoles);
}

// Type guard to check if user has permissions property
export function hasPermissions(user: BaseUser | ExtendedUser | undefined): user is BaseUser & { permissions: string[] } {
  return user !== undefined && Array.isArray(user.permissions);
}

// Type guard to check if user has cachedPermissions property
export function hasCachedPermissions(user: BaseUser | ExtendedUser | undefined): user is BaseUser & { cachedPermissions: { permissions: string[]; lastUpdated: Date; expiresAt: Date; workspaceId?: Types.ObjectId; } } {
  return user !== undefined &&
    typeof user.cachedPermissions === 'object' &&
    user.cachedPermissions !== null &&
    Array.isArray(user.cachedPermissions.permissions);
}

// Type guard to check if user has lastPermissionCheck property
export function hasLastPermissionCheck(user: BaseUser | ExtendedUser | undefined): user is BaseUser & { lastPermissionCheck: Date } {
  return user !== undefined && user.lastPermissionCheck instanceof Date;
}

// Safe property access utilities
export function getUserRole(user: BaseUser | ExtendedUser | undefined): UserRole | undefined {
  return hasUserRole(user) ? user.role : undefined;
}

export function getUserWorkplaceRole(user: BaseUser | ExtendedUser | undefined): WorkplaceRole | undefined {
  return hasWorkplaceRole(user) ? user.workplaceRole : undefined;
}

export function getUserStatus(user: BaseUser | ExtendedUser | undefined): string | undefined {
  return hasUserStatus(user) ? user.status : undefined;
}

export function getUserAssignedRoles(user: BaseUser | ExtendedUser | undefined): Types.ObjectId[] | undefined {
  return hasAssignedRoles(user) ? user.assignedRoles : undefined;
}

export function getUserPermissions(user: BaseUser | ExtendedUser | undefined): string[] | undefined {
  return hasPermissions(user) ? user.permissions : undefined;
}

export function getUserCachedPermissions(user: BaseUser | ExtendedUser | undefined): { permissions: string[]; lastUpdated: Date; expiresAt: Date; workspaceId?: Types.ObjectId; } | undefined {
  return hasCachedPermissions(user) ? user.cachedPermissions : undefined;
}

export function getUserLastPermissionCheck(user: BaseUser | ExtendedUser | undefined): Date | undefined {
  return hasLastPermissionCheck(user) ? user.lastPermissionCheck : undefined;
}

// Utility to safely get user ID as string
export function getUserId(user: BaseUser | ExtendedUser | undefined): string | undefined {
  if (!user) return undefined;
  return user.id || user._id?.toString();
}

// Utility to safely get workplace ID as ObjectId
export function getWorkplaceId(user: BaseUser | ExtendedUser | undefined): Types.ObjectId | undefined {
  if (!user?.workplaceId) return undefined;
  if (typeof user.workplaceId === 'string') {
    return new Types.ObjectId(user.workplaceId);
  }
  return user.workplaceId;
}

export interface AuthRequest extends Request {
  user?: ExtendedUser | BaseUser;
  subscription?: ISubscription | null;
  workspace?: IWorkplace | null;
  workspaceContext?: WorkspaceContext;
  usageInfo?: UsageLimitResult | { [resource: string]: UsageLimitResult };
  interventionData?: any; // For storing intervention data in middleware
  patient?: any; // Patient data set by middleware
  clinicalNotes?: any[]; // Clinical notes set by middleware
  permissionContext?: {
    action: string;
    source: string;
    roleId?: any;
    roleName?: string;
    inheritedFrom?: string;
  };
  sessionId?: string;
  file?: any; // Multer single file upload
  files?: any; // Multer multiple files upload
}

// Alias for AuthenticatedRequest (used in some controllers)
export interface AuthenticatedRequest extends AuthRequest { }

export interface UsageLimitResult {
  allowed: boolean;
  currentUsage: number;
  limit: number | null;
  warningThreshold?: number;
  isAtWarning: boolean;
  isAtLimit: boolean;
  upgradeRequired?: boolean;
  suggestedPlan?: string;
}

export interface AcceptInvitationData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role?: string;
}

export interface AcceptResult {
  success: boolean;
  user?: IUser;
  workspace?: IWorkplace;
  message: string;
}

export interface CreateInvitationData {
  email: string;
  workspaceId: string;
  role: string;
  customMessage?: string;
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  requiredPermissions?: string[];
  requiredRoles?: string[];
  requiredFeatures?: string[];
  upgradeRequired?: boolean;
}
