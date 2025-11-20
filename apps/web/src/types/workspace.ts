/**
 * Workspace Team Management Types
 * Types for workspace team management features
 */

export type ObjectId = string;

// Member Types
export interface Member {
  _id: ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  workplaceRole: WorkplaceRole;
  status: MemberStatus;
  joinedAt: Date;
  lastLoginAt?: Date;
  permissions: string[];
  suspensionReason?: string;
  suspendedAt?: Date;
  suspendedBy?: ObjectId;
}

export type WorkplaceRole =
  | 'Owner'
  | 'Staff'
  | 'Pharmacist'
  | 'Cashier'
  | 'Technician'
  | 'Assistant';

export type MemberStatus = 'pending' | 'active' | 'suspended' | 'inactive';

// Invite Types
export interface WorkspaceInvite {
  _id: ObjectId;
  workplaceId: ObjectId;
  inviteToken: string;
  inviteUrl?: string; // Full invite URL from backend
  email: string;
  workplaceRole: WorkplaceRole;
  status: InviteStatus;
  invitedBy: ObjectId;
  expiresAt: Date;
  acceptedAt?: Date;
  acceptedBy?: ObjectId;
  rejectedAt?: Date;
  rejectedBy?: ObjectId;
  rejectionReason?: string;
  revokedAt?: Date;
  revokedBy?: ObjectId;
  maxUses: number;
  usedCount: number;
  requiresApproval: boolean;
  personalMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type InviteStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'revoked';

// Audit Log Types
export interface WorkspaceAuditLog {
  _id: ObjectId;
  workplaceId: ObjectId;
  actorId: {
    _id: ObjectId;
    firstName: string;
    lastName: string;
  };
  targetId?: {
    _id: ObjectId;
    firstName: string;
    lastName: string;
  };
  action: string;
  category: AuditCategory;
  details: {
    before?: unknown;
    after?: unknown;
    reason?: string;
    metadata?: Record<string, unknown>;
  };
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  severity: AuditSeverity;
}

export type AuditCategory = 'member' | 'role' | 'permission' | 'invite' | 'auth' | 'settings';
export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';

// Filter Types
export interface MemberFilters {
  search?: string;
  role?: WorkplaceRole;
  status?: MemberStatus;
}

export interface AuditFilters {
  startDate?: string;
  endDate?: string;
  actorId?: string;
  category?: AuditCategory;
  action?: string;
}

export interface InviteFilters {
  status?: InviteStatus;
}

// Pagination Types
export interface Pagination {
  page: number;
  limit: number;
}

export interface PaginationResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// API Response Types
export interface GetMembersResponse {
  members: Member[];
  pagination: PaginationResponse;
}

export interface GetInvitesResponse {
  invites: WorkspaceInvite[];
}

export interface GetPendingMembersResponse {
  pendingMembers: Member[];
}

export interface GetAuditLogsResponse {
  logs: WorkspaceAuditLog[];
  pagination: PaginationResponse;
}

export interface GenerateInviteResponse {
  invite: {
    _id: ObjectId;
    inviteToken: string;
    inviteUrl: string;
    expiresAt: Date;
  };
}

// Request Types
export interface UpdateMemberRoleRequest {
  workplaceRole: WorkplaceRole;
  reason?: string;
}

export interface SuspendMemberRequest {
  reason: string;
}

export interface RemoveMemberRequest {
  reason?: string;
}

export interface GenerateInviteRequest {
  email: string;
  workplaceRole: WorkplaceRole;
  expiresInDays: number;
  maxUses: number;
  requiresApproval: boolean;
  personalMessage?: string;
}

export interface ApproveMemberRequest {
  workplaceRole?: WorkplaceRole;
}

export interface RejectMemberRequest {
  reason?: string;
}

// Statistics Types
export interface WorkspaceStats {
  totalMembers: number;
  activeMembers: number;
  pendingApprovals: number;
  activeInvites: number;
}

// License Approval Types
export interface PendingLicense {
  _id: ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  licenseNumber: string;
  licenseStatus: string;
  licenseDocument?: string;
  workplaceRole: WorkplaceRole;
  createdAt: string;
  updatedAt: string;
}
