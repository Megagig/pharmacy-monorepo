import mongoose from 'mongoose';
import RoleHierarchyService from '../../services/RoleHierarchyService';
import Role, { IRole } from '../../models/Role';
import RolePermission, { IRolePermission } from '../../models/RolePermission';
import UserRole, { IUserRole } from '../../models/UserRole';

// Mock the models
jest.mock('../../models/Role');
jest.mock('../../models/RolePermission');
jest.mock('../../models/UserRole');

describe('RoleHierarchyService', () => {
    let roleHierarchyService: RoleHierarchyService;

    const mockRole: Partial<IRole> = {
        _id: new mongoose.Types.ObjectId(),
        name: 'pharmacist',
        displayName: 'Pharmacist',
        description: 'Licensed pharmacist role',
        category: 'workplace',
        permissions: ['patient.read', 'patient.create'],
        isActive: true,
        isSystemRole: true,
        hierarchyLevel: 1,
        parentRole: null,
        childRoles: [],
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const mockParentRole: Partial<IRole> = {
        _id: new mongoose.Types.ObjectId(),
        name: 'pharmacy_owner',
        displayName: 'Pharmacy Owner',
        description: 'Pharmacy owner with full access',
        category: 'workplace',
        permissions: ['patient.read', 'patient.create', 'patient.update', 'patient.delete'],
        isActive: true,
        isSystemRole: true,
        hierarchyLevel: 0,
        parentRole: null,
        childRoles: [mockRole._id as mongoose.Types.ObjectId],
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const mockChildRole: Partial<IRole> = {
        _id: new mongoose.Types.ObjectId(),
        name: 'pharmacy_assistant',
        displayName: 'Pharmacy Assistant',
        description: 'Assistant with limited access',
        category: 'workplace',
        permissions: ['patient.read'],
        isActive: true,
        isSystemRole: true,
        hierarchyLevel: 2,
        parentRole: mockRole._id as mongoose.Types.ObjectId,
        childRoles: [],
        createdAt: new Date(),
        updatedAt: new Date()
    };

    beforeEach(() => {
        jest.clearAllMocks();
        roleHierarchyService = RoleHierarchyService.getInstance();
    });

    describe('getAllRolePermissions', () => {
        it('should return permissions for role without parent', async () => {
            (Role.findById as jest.Mock).mockResolvedValue(mockRole);
            (RolePermission.find as jest.Mock).mockResolvedValue([]);

            const result = await roleHierarchyService.getAllRolePermissions(
                mockRole._id as mongoose.Types.ObjectId
            );

            expect(result.permissions).toEqual(['patient.read', 'patient.create']);
            expect(result.conflicts).toHaveLength(0);
            expect(result.sources['patient.read']).toEqual({
                roleId: mockRole._id,
                roleName: mockRole.name,
                source: 'direct',
                level: 1
            });
        });
    });
});
it('should return inherited permissions from parent role', async () => {
    const roleWithParent = {
        ...mockRole,
        parentRole: mockParentRole._id
    };

    (Role.findById as jest.Mock)
        .mockResolvedValueOnce(roleWithParent)
        .mockResolvedValueOnce(mockParentRole);
    (RolePermission.find as jest.Mock).mockResolvedValue([]);

    const result = await roleHierarchyService.getAllRolePermissions(
        roleWithParent._id as mongoose.Types.ObjectId
    );

    expect(result.permissions).toContain('patient.read');
    expect(result.permissions).toContain('patient.create');
    expect(result.permissions).toContain('patient.update');
    expect(result.permissions).toContain('patient.delete');

    // Check that inherited permissions are marked correctly
    expect(result.sources['patient.update']).toEqual({
        roleId: mockParentRole._id,
        roleName: mockParentRole.name,
        source: 'inherited',
        level: 0
    });
});

it('should detect circular dependency in role hierarchy', async () => {
    const circularRole = {
        ...mockRole,
        parentRole: mockChildRole._id
    };
    const circularChild = {
        ...mockChildRole,
        parentRole: mockRole._id
    };

    (Role.findById as jest.Mock)
        .mockResolvedValueOnce(circularRole)
        .mockResolvedValueOnce(circularChild);

    const result = await roleHierarchyService.getAllRolePermissions(
        circularRole._id as mongoose.Types.ObjectId
    );

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].type).toBe('circular_dependency');
    expect(result.conflicts[0].severity).toBe('critical');
});

it('should handle inactive roles', async () => {
    const inactiveRole = {
        ...mockRole,
        isActive: false
    };

    (Role.findById as jest.Mock).mockResolvedValue(inactiveRole);

    const result = await roleHierarchyService.getAllRolePermissions(
        inactiveRole._id as mongoose.Types.ObjectId
    );

    expect(result.permissions).toHaveLength(0);
    expect(result.sources).toEqual({});
});

it('should return cached result when available', async () => {
    // First call - should cache the result
    (Role.findById as jest.Mock).mockResolvedValue(mockRole);
    (RolePermission.find as jest.Mock).mockResolvedValue([]);

    const result1 = await roleHierarchyService.getAllRolePermissions(
        mockRole._id as mongoose.Types.ObjectId
    );

    // Second call - should use cached result
    const result2 = await roleHierarchyService.getAllRolePermissions(
        mockRole._id as mongoose.Types.ObjectId
    );

    expect(result1).toEqual(result2);
    expect(Role.findById).toHaveBeenCalledTimes(1); // Should only be called once due to caching
});

describe('createRoleHierarchy', () => {
    it('should create role without parent successfully', async () => {
        const roleData = {
            name: 'new_role',
            displayName: 'New Role',
            description: 'A new test role',
            permissions: ['test.permission']
        };
        const createdBy = new mongoose.Types.ObjectId();

        const mockCreatedRole = {
            ...roleData,
            _id: new mongoose.Types.ObjectId(),
            hierarchyLevel: 0,
            isActive: true,
            isSystemRole: false,
            createdBy,
            lastModifiedBy: createdBy,
            save: jest.fn().mockResolvedValue(true)
        };

        (Role as any).mockImplementation(() => mockCreatedRole);

        const result = await roleHierarchyService.createRoleHierarchy(roleData, createdBy);

        expect(result).toEqual(mockCreatedRole);
        expect(mockCreatedRole.save).toHaveBeenCalled();
    });

    it('should create role with parent and update parent children', async () => {
        const roleData = {
            name: 'child_role',
            displayName: 'Child Role',
            description: 'A child role',
            parentRoleId: mockParentRole._id as mongoose.Types.ObjectId,
            permissions: ['child.permission']
        };
        const createdBy = new mongoose.Types.ObjectId();

        // Mock wouldCreateCycle to return false
        jest.spyOn(roleHierarchyService as any, 'wouldCreateCycle').mockResolvedValue(false);
        jest.spyOn(roleHierarchyService as any, 'calculateHierarchyLevel').mockResolvedValue(0);

        const mockCreatedRole = {
            ...roleData,
            _id: new mongoose.Types.ObjectId(),
            hierarchyLevel: 1,
            parentRole: roleData.parentRoleId,
            save: jest.fn().mockResolvedValue(true)
        };

        (Role as any).mockImplementation(() => mockCreatedRole);
        (Role.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockParentRole);

        const result = await roleHierarchyService.createRoleHierarchy(roleData, createdBy);

        expect(result.parentRole).toEqual(roleData.parentRoleId);
        expect(Role.findByIdAndUpdate).toHaveBeenCalledWith(
            roleData.parentRoleId,
            { $addToSet: { childRoles: mockCreatedRole._id } }
        );
    });

    it('should prevent creation of circular dependency', async () => {
        const roleData = {
            name: 'circular_role',
            displayName: 'Circular Role',
            description: 'Would create circular dependency',
            parentRoleId: mockRole._id as mongoose.Types.ObjectId,
            permissions: []
        };
        const createdBy = new mongoose.Types.ObjectId();

        // Mock wouldCreateCycle to return true
        jest.spyOn(roleHierarchyService as any, 'wouldCreateCycle').mockResolvedValue(true);

        await expect(
            roleHierarchyService.createRoleHierarchy(roleData, createdBy)
        ).rejects.toThrow('Role hierarchy would create a circular dependency');
    });
});

describe('validateHierarchy', () => {
    it('should validate correct hierarchy structure', async () => {
        const hierarchyData = [
            { roleId: mockParentRole._id, parentRoleId: null },
            { roleId: mockRole._id, parentRoleId: mockParentRole._id },
            { roleId: mockChildRole._id, parentRoleId: mockRole._id }
        ];

        (Role.find as jest.Mock).mockResolvedValue([mockParentRole, mockRole, mockChildRole]);

        const result = await roleHierarchyService.validateHierarchy(hierarchyData);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('should detect hierarchy depth violations', async () => {
        const deepHierarchy = Array.from({ length: 12 }, (_, i) => ({
            roleId: new mongoose.Types.ObjectId(),
            parentRoleId: i > 0 ? new mongoose.Types.ObjectId() : null
        }));

        const result = await roleHierarchyService.validateHierarchy(deepHierarchy);

        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.type === 'hierarchy_depth')).toBe(true);
    });

    it('should detect orphaned roles', async () => {
        const hierarchyData = [
            { roleId: mockRole._id, parentRoleId: new mongoose.Types.ObjectId() } // Parent doesn't exist
        ];

        (Role.find as jest.Mock).mockResolvedValue([mockRole]);

        const result = await roleHierarchyService.validateHierarchy(hierarchyData);

        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.type === 'invalid_parent')).toBe(true);
    });
});

describe('getHierarchyTree', () => {
    it('should build complete hierarchy tree', async () => {
        const roles = [mockParentRole, mockRole, mockChildRole];
        (Role.find as jest.Mock).mockResolvedValue(roles);
        (RolePermission.find as jest.Mock).mockResolvedValue([]);

        const tree = await roleHierarchyService.getHierarchyTree();

        expect(tree).toHaveLength(1); // Should have one root node
        expect(tree[0].role.name).toBe(mockParentRole.name);
        expect(tree[0].children).toHaveLength(1);
        expect(tree[0].children[0].role.name).toBe(mockRole.name);
        expect(tree[0].children[0].children).toHaveLength(1);
        expect(tree[0].children[0].children[0].role.name).toBe(mockChildRole.name);
    });

    it('should handle roles without hierarchy', async () => {
        const standaloneRole = {
            ...mockRole,
            parentRole: null,
            childRoles: []
        };

        (Role.find as jest.Mock).mockResolvedValue([standaloneRole]);
        (RolePermission.find as jest.Mock).mockResolvedValue([]);

        const tree = await roleHierarchyService.getHierarchyTree();

        expect(tree).toHaveLength(1);
        expect(tree[0].role.name).toBe(standaloneRole.name);
        expect(tree[0].children).toHaveLength(0);
    });
});

describe('private methods', () => {
    describe('wouldCreateCycle', () => {
        it('should detect potential circular dependency', async () => {
            const parentRoleId = mockRole._id as mongoose.Types.ObjectId;
            const childRoleName = mockParentRole.name as string;

            (Role.findById as jest.Mock)
                .mockResolvedValueOnce(mockRole)
                .mockResolvedValueOnce(mockParentRole);

            const wouldCreateCycle = (roleHierarchyService as any).wouldCreateCycle;
            const result = await wouldCreateCycle(parentRoleId, childRoleName);

            expect(result).toBe(true);
        });

        it('should return false for valid hierarchy', async () => {
            const parentRoleId = mockParentRole._id as mongoose.Types.ObjectId;
            const childRoleName = 'new_child_role';

            (Role.findById as jest.Mock).mockResolvedValue(mockParentRole);

            const wouldCreateCycle = (roleHierarchyService as any).wouldCreateCycle;
            const result = await wouldCreateCycle(parentRoleId, childRoleName);

            expect(result).toBe(false);
        });
    });

    describe('calculateHierarchyLevel', () => {
        it('should calculate correct hierarchy level', async () => {
            (Role.findById as jest.Mock).mockResolvedValue(mockParentRole);

            const calculateHierarchyLevel = (roleHierarchyService as any).calculateHierarchyLevel;
            const level = await calculateHierarchyLevel(mockParentRole._id);

            expect(level).toBe(mockParentRole.hierarchyLevel);
        });

        it('should return 0 for role without parent', async () => {
            (Role.findById as jest.Mock).mockResolvedValue(null);

            const calculateHierarchyLevel = (roleHierarchyService as any).calculateHierarchyLevel;
            const level = await calculateHierarchyLevel(new mongoose.Types.ObjectId());

            expect(level).toBe(0);
        });
    });
});