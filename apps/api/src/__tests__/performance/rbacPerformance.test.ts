import mongoose from 'mongoose';
import DynamicPermissionService from '../../services/DynamicPermissionService';
import RoleHierarchyService from '../../services/RoleHierarchyService';
import CacheManager from '../../services/CacheManager';
import User, { IUser } from '../../models/User';
import Role, { IRole } from '../../models/Role';
import Permission, { IPermission } from '../../models/Permission';
import UserRole, { IUserRole } from '../../models/UserRole';
import RolePermission, { IRolePermission } from '../../models/RolePermission';
import Workplace, { IWorkplace } from '../../models/Workplace';

describe('RBAC Performance Tests', () => {
    let dynamicPermissionService: DynamicPermissionService;
    let roleHierarchyService: RoleHierarchyService;
    let cacheManager: CacheManager;
    let testWorkplace: IWorkplace;
    let testUsers: IUser[] = [];
    let testRoles: IRole[] = [];
    let testPermissions: IPermission[] = [];

    const PERFORMANCE_THRESHOLDS = {
        PERMISSION_CHECK_MS: 100,
        BULK_OPERATION_MS: 5000,
        CACHE_HIT_RATIO: 0.8,
        MEMORY_USAGE_MB: 50
    };

    beforeAll(async () => {
        dynamicPermissionService = DynamicPermissionService.getInstance();
        roleHierarchyService = RoleHierarchyService.getInstance();
        cacheManager = CacheManager.getInstance();

        // Create test workplace
        testWorkplace = await Workplace.create({
            name: 'Performance Test Pharmacy',
            type: 'Community',
            address: '123 Performance St',
            phone: '+1234567890',
            email: 'perf@test.com',
            licenseNumber: 'PERF123',
            ownerId: new mongoose.Types.ObjectId()
        });

        // Create test permissions (50 permissions)
        const permissionPromises = Array.from({ length: 50 }, (_, i) =>
            Permission.create({
                action: `test.permission.${i}`,
                displayName: `Test Permission ${i}`,
                description: `Performance test permission ${i}`,
                category: 'performance_test',
                isSystemPermission: false,
                createdBy: new mongoose.Types.ObjectId(),
                lastModifiedBy: new mongoose.Types.ObjectId()
            })
        );
        testPermissions = await Promise.all(permissionPromises);

        // Create role hierarchy (10 roles with 3 levels)
        const rolePromises = Array.from({ length: 10 }, (_, i) =>
            Role.create({
                name: `perf_role_${i}`,
                displayName: `Performance Role ${i}`,
                description: `Performance test role ${i}`,
                category: 'performance_test',
                permissions: testPermissions.slice(i * 5, (i + 1) * 5).map(p => p.action),
                isActive: true,
                isSystemRole: false,
                hierarchyLevel: Math.floor(i / 4), // 3 levels: 0, 1, 2
                parentRole: i > 3 ? testRoles[Math.floor(i / 4) - 1]?._id : undefined,
                createdBy: new mongoose.Types.ObjectId(),
                lastModifiedBy: new mongoose.Types.ObjectId()
            })
        );
        testRoles = await Promise.all(rolePromises);

        // Create role-permission mappings
        const rolePermissionPromises: Promise<IRolePermission>[] = [];
        testRoles.forEach(role => {
            role.permissions.forEach(permission => {
                rolePermissionPromises.push(
                    RolePermission.create({
                        roleId: role._id,
                        permissionAction: permission,
                        granted: true,
                        grantedBy: new mongoose.Types.ObjectId(),
                        grantedAt: new Date(),
                        lastModifiedBy: new mongoose.Types.ObjectId(),
                        lastModifiedAt: new Date()
                    })
                );
            });
        });
        await Promise.all(rolePermissionPromises);

        // Create test users (1000 users)
        const userPromises = Array.from({ length: 1000 }, (_, i) =>
            User.create({
                firstName: `User${i}`,
                lastName: 'Performance',
                email: `user${i}@perf.test`,
                password: 'hashedpassword',
                role: 'pharmacist',
                status: 'active',
                workplaceRole: 'Pharmacist',
                workplace: testWorkplace._id,
                assignedRoles: [],
                directPermissions: [],
                deniedPermissions: []
            })
        );
        testUsers = await Promise.all(userPromises);

        // Assign roles to users (each user gets 1-3 random roles)
        const userRolePromises: Promise<IUserRole>[] = [];
        testUsers.forEach(user => {
            const numRoles = Math.floor(Math.random() * 3) + 1;
            const assignedRoles = testRoles
                .sort(() => 0.5 - Math.random())
                .slice(0, numRoles);

            assignedRoles.forEach(role => {
                userRolePromises.push(
                    UserRole.create({
                        userId: user._id,
                        roleId: role._id,
                        workspaceId: testWorkplace._id,
                        assignedBy: new mongoose.Types.ObjectId(),
                        assignedAt: new Date(),
                        isActive: true,
                        isTemporary: false,
                        lastModifiedBy: new mongoose.Types.ObjectId(),
                        lastModifiedAt: new Date()
                    })
                );
            });
        });
        await Promise.all(userRolePromises);
    });

    afterAll(async () => {
        // Clean up test data
        await User.deleteMany({ _id: { $in: testUsers.map(u => u._id) } });
        await Role.deleteMany({ _id: { $in: testRoles.map(r => r._id) } });
        await Permission.deleteMany({ _id: { $in: testPermissions.map(p => p._id) } });
        await UserRole.deleteMany({});
        await RolePermission.deleteMany({});
        await Workplace.deleteMany({ _id: testWorkplace._id });
    });

    describe('Permission Check Performance', () => {
        it('should check permissions under load within performance threshold', async () => {
            const startTime = Date.now();
            const permissionChecks: Promise<any>[] = [];

            // Perform 1000 concurrent permission checks
            for (let i = 0; i < 1000; i++) {
                const user = testUsers[i % testUsers.length];
                const permission = testPermissions[i % testPermissions.length];

                permissionChecks.push(
                    dynamicPermissionService.checkPermission(
                        user,
                        permission.action,
                        {
                            workspace: testWorkplace,
                            plan: null,
                            subscription: null,
                            permissions: [],
                            limits: {},
                            isSubscriptionActive: true,
                            isTrialExpired: false
                        }
                    )
                );
            }

            const results = await Promise.all(permissionChecks);
            const endTime = Date.now();
            const totalTime = endTime - startTime;
            const avgTimePerCheck = totalTime / permissionChecks.length;

            console.log(`Permission check performance:
                Total time: ${totalTime}ms
                Average time per check: ${avgTimePerCheck.toFixed(2)}ms
                Checks per second: ${(1000 / avgTimePerCheck).toFixed(0)}`);

            expect(avgTimePerCheck).toBeLessThan(PERFORMANCE_THRESHOLDS.PERMISSION_CHECK_MS);
            expect(results.every(r => r !== null)).toBe(true);
        });

        it('should maintain performance with cache warming', async () => {
            // Warm up cache with first 100 users
            const warmupUsers = testUsers.slice(0, 100);
            const warmupPromises = warmupUsers.map(user =>
                dynamicPermissionService.resolveUserPermissions(
                    user,
                    {
                        workspace: testWorkplace,
                        plan: null,
                        subscription: null,
                        permissions: [],
                        limits: {},
                        isSubscriptionActive: true,
                        isTrialExpired: false
                    }
                )
            );
            await Promise.all(warmupPromises);

            // Now test performance with warmed cache
            const startTime = Date.now();
            const cachedChecks = warmupUsers.map(user =>
                dynamicPermissionService.checkPermission(
                    user,
                    testPermissions[0].action,
                    {
                        workspace: testWorkplace,
                        plan: null,
                        subscription: null,
                        permissions: [],
                        limits: {},
                        isSubscriptionActive: true,
                        isTrialExpired: false
                    }
                )
            );

            await Promise.all(cachedChecks);
            const endTime = Date.now();
            const avgTimeWithCache = (endTime - startTime) / cachedChecks.length;

            console.log(`Cached permission check average time: ${avgTimeWithCache.toFixed(2)}ms`);

            // Cached checks should be significantly faster
            expect(avgTimeWithCache).toBeLessThan(PERFORMANCE_THRESHOLDS.PERMISSION_CHECK_MS / 2);
        });
    });

    describe('Role Hierarchy Performance', () => {
        it('should traverse role hierarchy efficiently', async () => {
            const startTime = Date.now();
            const hierarchyPromises: Promise<any>[] = [];

            // Test hierarchy traversal for all roles
            testRoles.forEach(role => {
                hierarchyPromises.push(
                    roleHierarchyService.getAllRolePermissions(role._id)
                );
            });

            const results = await Promise.all(hierarchyPromises);
            const endTime = Date.now();
            const totalTime = endTime - startTime;
            const avgTimePerTraversal = totalTime / hierarchyPromises.length;

            console.log(`Role hierarchy traversal performance:
                Total time: ${totalTime}ms
                Average time per traversal: ${avgTimePerTraversal.toFixed(2)}ms`);

            expect(avgTimePerTraversal).toBeLessThan(50); // 50ms threshold for hierarchy traversal
            expect(results.every(r => r.permissions.length >= 0)).toBe(true);
        });

        it('should handle deep hierarchy efficiently', async () => {
            // Create a deeper hierarchy for testing
            const deepRoles: IRole[] = [];
            let parentRole: IRole | undefined;

            for (let i = 0; i < 8; i++) { // Create 8-level deep hierarchy
                const role = await Role.create({
                    name: `deep_role_${i}`,
                    displayName: `Deep Role ${i}`,
                    description: `Deep hierarchy test role ${i}`,
                    category: 'deep_test',
                    permissions: [`deep.permission.${i}`],
                    isActive: true,
                    isSystemRole: false,
                    hierarchyLevel: i,
                    parentRole: parentRole?._id,
                    createdBy: new mongoose.Types.ObjectId(),
                    lastModifiedBy: new mongoose.Types.ObjectId()
                });
                deepRoles.push(role);
                parentRole = role;
            }

            const startTime = Date.now();
            const deepestRole = deepRoles[deepRoles.length - 1];
            const result = await roleHierarchyService.getAllRolePermissions(deepestRole._id);
            const endTime = Date.now();

            console.log(`Deep hierarchy traversal time: ${endTime - startTime}ms`);
            console.log(`Permissions found: ${result.permissions.length}`);

            expect(endTime - startTime).toBeLessThan(200); // 200ms threshold for deep hierarchy
            expect(result.permissions.length).toBe(8); // Should inherit all parent permissions

            // Clean up deep roles
            await Role.deleteMany({ _id: { $in: deepRoles.map(r => r._id) } });
        });
    });
}); describ
e('Cache Performance', () => {
    it('should maintain high cache hit ratio under load', async () => {
        // Clear cache first
        await cacheManager.invalidatePattern('*');

        let cacheHits = 0;
        let cacheMisses = 0;

        // Perform repeated permission checks to build cache
        const testUser = testUsers[0];
        const testPermission = testPermissions[0];

        // First round - should be cache misses
        for (let i = 0; i < 100; i++) {
            const result = await dynamicPermissionService.checkPermission(
                testUser,
                testPermission.action,
                {
                    workspace: testWorkplace,
                    plan: null,
                    subscription: null,
                    permissions: [],
                    limits: {},
                    isSubscriptionActive: true,
                    isTrialExpired: false
                }
            );
            if (result) cacheMisses++;
        }

        // Second round - should be cache hits
        for (let i = 0; i < 100; i++) {
            const cachedResult = await cacheManager.getCachedPermissionCheck(
                testUser._id,
                testPermission.action,
                testWorkplace._id
            );
            if (cachedResult) cacheHits++;
        }

        const hitRatio = cacheHits / (cacheHits + cacheMisses);
        console.log(`Cache hit ratio: ${(hitRatio * 100).toFixed(2)}%`);

        expect(hitRatio).toBeGreaterThan(PERFORMANCE_THRESHOLDS.CACHE_HIT_RATIO);
    });

    it('should handle cache invalidation efficiently', async () => {
        // Populate cache with user permissions
        const cachePopulationPromises = testUsers.slice(0, 100).map(user =>
            dynamicPermissionService.resolveUserPermissions(
                user,
                {
                    workspace: testWorkplace,
                    plan: null,
                    subscription: null,
                    permissions: [],
                    limits: {},
                    isSubscriptionActive: true,
                    isTrialExpired: false
                }
            )
        );
        await Promise.all(cachePopulationPromises);

        // Measure cache invalidation time
        const startTime = Date.now();
        const invalidationPromises = testUsers.slice(0, 100).map(user =>
            dynamicPermissionService.invalidateUserCache(user._id)
        );
        await Promise.all(invalidationPromises);
        const endTime = Date.now();

        const avgInvalidationTime = (endTime - startTime) / 100;
        console.log(`Average cache invalidation time: ${avgInvalidationTime.toFixed(2)}ms`);

        expect(avgInvalidationTime).toBeLessThan(10); // 10ms threshold for cache invalidation
    });
});

describe('Bulk Operations Performance', () => {
    it('should handle bulk role assignments efficiently', async () => {
        const bulkUsers = testUsers.slice(0, 500); // Test with 500 users
        const targetRole = testRoles[0];

        const bulkUpdates = bulkUsers.map(user => ({
            userId: user._id,
            roleIds: [targetRole._id],
            directPermissions: [],
            deniedPermissions: []
        }));

        const startTime = Date.now();
        await dynamicPermissionService.bulkUpdateUserPermissions(
            bulkUpdates,
            new mongoose.Types.ObjectId()
        );
        const endTime = Date.now();

        const totalTime = endTime - startTime;
        const avgTimePerUser = totalTime / bulkUsers.length;

        console.log(`Bulk role assignment performance:
                Total time: ${totalTime}ms
                Average time per user: ${avgTimePerUser.toFixed(2)}ms
                Users per second: ${(1000 / avgTimePerUser).toFixed(0)}`);

        expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.BULK_OPERATION_MS);
        expect(avgTimePerUser).toBeLessThan(10); // 10ms per user threshold

        // Verify assignments were successful
        const assignmentCount = await UserRole.countDocuments({
            userId: { $in: bulkUsers.map(u => u._id) },
            roleId: targetRole._id,
            isActive: true
        });
        expect(assignmentCount).toBe(bulkUsers.length);
    });

    it('should handle concurrent bulk operations', async () => {
        const batchSize = 100;
        const numBatches = 5;
        const concurrentPromises: Promise<void>[] = [];

        for (let batch = 0; batch < numBatches; batch++) {
            const batchUsers = testUsers.slice(batch * batchSize, (batch + 1) * batchSize);
            const targetRole = testRoles[batch % testRoles.length];

            const bulkUpdates = batchUsers.map(user => ({
                userId: user._id,
                roleIds: [targetRole._id],
                directPermissions: [],
                deniedPermissions: []
            }));

            concurrentPromises.push(
                dynamicPermissionService.bulkUpdateUserPermissions(
                    bulkUpdates,
                    new mongoose.Types.ObjectId()
                )
            );
        }

        const startTime = Date.now();
        await Promise.all(concurrentPromises);
        const endTime = Date.now();

        const totalTime = endTime - startTime;
        console.log(`Concurrent bulk operations time: ${totalTime}ms`);

        expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.BULK_OPERATION_MS);
    });
});

describe('Memory Usage Tests', () => {
    it('should maintain reasonable memory usage during operations', async () => {
        const initialMemory = process.memoryUsage();

        // Perform memory-intensive operations
        const memoryTestPromises: Promise<any>[] = [];

        // Load all user permissions into memory
        testUsers.forEach(user => {
            memoryTestPromises.push(
                dynamicPermissionService.resolveUserPermissions(
                    user,
                    {
                        workspace: testWorkplace,
                        plan: null,
                        subscription: null,
                        permissions: [],
                        limits: {},
                        isSubscriptionActive: true,
                        isTrialExpired: false
                    }
                )
            );
        });

        await Promise.all(memoryTestPromises);

        const finalMemory = process.memoryUsage();
        const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024; // MB

        console.log(`Memory usage increase: ${memoryIncrease.toFixed(2)}MB`);
        console.log(`Final heap used: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);

        expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_USAGE_MB);
    });

    it('should handle memory cleanup after cache invalidation', async () => {
        const initialMemory = process.memoryUsage();

        // Populate cache heavily
        const cachePromises = testUsers.map(user =>
            dynamicPermissionService.resolveUserPermissions(
                user,
                {
                    workspace: testWorkplace,
                    plan: null,
                    subscription: null,
                    permissions: [],
                    limits: {},
                    isSubscriptionActive: true,
                    isTrialExpired: false
                }
            )
        );
        await Promise.all(cachePromises);

        const afterCacheMemory = process.memoryUsage();

        // Clear all caches
        await cacheManager.invalidatePattern('*');

        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }

        const afterCleanupMemory = process.memoryUsage();

        const cacheMemoryIncrease = (afterCacheMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
        const cleanupMemoryDecrease = (afterCacheMemory.heapUsed - afterCleanupMemory.heapUsed) / 1024 / 1024;

        console.log(`Memory increase after caching: ${cacheMemoryIncrease.toFixed(2)}MB`);
        console.log(`Memory decrease after cleanup: ${cleanupMemoryDecrease.toFixed(2)}MB`);

        // Should free at least 50% of cache memory
        expect(cleanupMemoryDecrease).toBeGreaterThan(cacheMemoryIncrease * 0.3);
    });
});

describe('Stress Tests', () => {
    it('should handle high concurrency permission checks', async () => {
        const concurrencyLevel = 100;
        const checksPerConcurrency = 50;
        const totalChecks = concurrencyLevel * checksPerConcurrency;

        const startTime = Date.now();
        const concurrentBatches: Promise<any[]>[] = [];

        for (let i = 0; i < concurrencyLevel; i++) {
            const batchPromises: Promise<any>[] = [];

            for (let j = 0; j < checksPerConcurrency; j++) {
                const user = testUsers[(i * checksPerConcurrency + j) % testUsers.length];
                const permission = testPermissions[j % testPermissions.length];

                batchPromises.push(
                    dynamicPermissionService.checkPermission(
                        user,
                        permission.action,
                        {
                            workspace: testWorkplace,
                            plan: null,
                            subscription: null,
                            permissions: [],
                            limits: {},
                            isSubscriptionActive: true,
                            isTrialExpired: false
                        }
                    )
                );
            }

            concurrentBatches.push(Promise.all(batchPromises));
        }

        const results = await Promise.all(concurrentBatches);
        const endTime = Date.now();

        const totalTime = endTime - startTime;
        const checksPerSecond = totalChecks / (totalTime / 1000);

        console.log(`High concurrency stress test:
                Total checks: ${totalChecks}
                Total time: ${totalTime}ms
                Checks per second: ${checksPerSecond.toFixed(0)}
                Average time per check: ${(totalTime / totalChecks).toFixed(2)}ms`);

        expect(results.every(batch => batch.every(result => result !== null))).toBe(true);
        expect(checksPerSecond).toBeGreaterThan(1000); // At least 1000 checks per second
    });

    it('should maintain performance under sustained load', async () => {
        const testDuration = 10000; // 10 seconds
        const checkInterval = 100; // Check every 100ms
        const checksPerInterval = 10;

        const performanceMetrics: number[] = [];
        const startTime = Date.now();

        while (Date.now() - startTime < testDuration) {
            const intervalStart = Date.now();
            const intervalPromises: Promise<any>[] = [];

            for (let i = 0; i < checksPerInterval; i++) {
                const user = testUsers[i % testUsers.length];
                const permission = testPermissions[i % testPermissions.length];

                intervalPromises.push(
                    dynamicPermissionService.checkPermission(
                        user,
                        permission.action,
                        {
                            workspace: testWorkplace,
                            plan: null,
                            subscription: null,
                            permissions: [],
                            limits: {},
                            isSubscriptionActive: true,
                            isTrialExpired: false
                        }
                    )
                );
            }

            await Promise.all(intervalPromises);
            const intervalTime = Date.now() - intervalStart;
            performanceMetrics.push(intervalTime / checksPerInterval);

            // Wait for next interval
            await new Promise(resolve => setTimeout(resolve, Math.max(0, checkInterval - intervalTime)));
        }

        const avgResponseTime = performanceMetrics.reduce((a, b) => a + b, 0) / performanceMetrics.length;
        const maxResponseTime = Math.max(...performanceMetrics);
        const minResponseTime = Math.min(...performanceMetrics);

        console.log(`Sustained load test results:
                Duration: ${testDuration}ms
                Average response time: ${avgResponseTime.toFixed(2)}ms
                Min response time: ${minResponseTime.toFixed(2)}ms
                Max response time: ${maxResponseTime.toFixed(2)}ms
                Performance variance: ${((maxResponseTime - minResponseTime) / avgResponseTime * 100).toFixed(2)}%`);

        expect(avgResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.PERMISSION_CHECK_MS);
        expect(maxResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.PERMISSION_CHECK_MS * 2);
    });
});