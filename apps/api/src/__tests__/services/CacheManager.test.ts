import mongoose from 'mongoose';
import CacheManager from '../../services/CacheManager';
import Redis from 'ioredis';

// Mock Redis
jest.mock('ioredis');

describe('CacheManager', () => {
    let cacheManager: CacheManager;
    let mockRedis: jest.Mocked<Redis>;

    const mockUserId = new mongoose.Types.ObjectId();
    const mockWorkspaceId = new mongoose.Types.ObjectId();
    const mockRoleId = new mongoose.Types.ObjectId();

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock Redis instance
        mockRedis = {
            get: jest.fn(),
            set: jest.fn(),
            setex: jest.fn(),
            del: jest.fn(),
            keys: jest.fn(),
            exists: jest.fn(),
            ttl: jest.fn(),
            memory: jest.fn(),
            dbsize: jest.fn(),
            on: jest.fn(),
            connect: jest.fn(),
            disconnect: jest.fn(),
            status: 'ready'
        } as any;

        (Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedis);

        cacheManager = CacheManager.getInstance();
    });

    describe('Permission Caching', () => {
        describe('cachePermissionCheck', () => {
            it('should cache permission check result', async () => {
                const action = 'patient.create';
                const allowed = true;
                const source = 'role';
                const ttl = 300;

                mockRedis.setex.mockResolvedValue('OK');

                await cacheManager.cachePermissionCheck(
                    mockUserId,
                    action,
                    allowed,
                    source,
                    mockWorkspaceId,
                    ttl
                );

                const expectedKey = `perm_check:${mockUserId}:${action}:${mockWorkspaceId}`;
                const expectedData = JSON.stringify({
                    allowed,
                    source,
                    userId: mockUserId.toString(),
                    workspaceId: mockWorkspaceId.toString(),
                    cachedAt: expect.any(String),
                    expiresAt: expect.any(String)
                });

                expect(mockRedis.setex).toHaveBeenCalledWith(expectedKey, ttl, expectedData);
            });

            it('should handle caching without workspace ID', async () => {
                const action = 'admin.access';
                const allowed = true;
                const source = 'super_admin';
                const ttl = 300;

                mockRedis.setex.mockResolvedValue('OK');

                await cacheManager.cachePermissionCheck(
                    mockUserId,
                    action,
                    allowed,
                    source,
                    undefined,
                    ttl
                );

                const expectedKey = `perm_check:${mockUserId}:${action}:global`;
                expect(mockRedis.setex).toHaveBeenCalledWith(expectedKey, ttl, expect.any(String));
            });
        });

        describe('getCachedPermissionCheck', () => {
            it('should retrieve cached permission check result', async () => {
                const action = 'patient.create';
                const cachedData = {
                    allowed: true,
                    source: 'role',
                    userId: mockUserId.toString(),
                    workspaceId: mockWorkspaceId.toString(),
                    cachedAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 300000).toISOString()
                };

                mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

                const result = await cacheManager.getCachedPermissionCheck(
                    mockUserId,
                    action,
                    mockWorkspaceId
                );

                expect(result).toEqual({
                    allowed: true,
                    source: 'role'
                });

                const expectedKey = `perm_check:${mockUserId}:${action}:${mockWorkspaceId}`;
                expect(mockRedis.get).toHaveBeenCalledWith(expectedKey);
            });

            it('should return null for expired cache', async () => {
                const action = 'patient.create';
                const expiredData = {
                    allowed: true,
                    source: 'role',
                    userId: mockUserId.toString(),
                    workspaceId: mockWorkspaceId.toString(),
                    cachedAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() - 1000).toISOString() // Expired
                };

                mockRedis.get.mockResolvedValue(JSON.stringify(expiredData));

                const result = await cacheManager.getCachedPermissionCheck(
                    mockUserId,
                    action,
                    mockWorkspaceId
                );

                expect(result).toBeNull();
            });

            it('should return null for non-existent cache', async () => {
                mockRedis.get.mockResolvedValue(null);

                const result = await cacheManager.getCachedPermissionCheck(
                    mockUserId,
                    'patient.create',
                    mockWorkspaceId
                );

                expect(result).toBeNull();
            });
        });
    });

    describe('User Permission Caching', () => {
        describe('cacheUserPermissions', () => {
            it('should cache user permissions with sources and denied permissions', async () => {
                const permissions = ['patient.create', 'patient.read'];
                const sources = { 'patient.create': 'role', 'patient.read': 'direct' };
                const deniedPermissions = ['patient.delete'];
                const ttl = 300;

                mockRedis.setex.mockResolvedValue('OK');

                await cacheManager.cacheUserPermissions(
                    mockUserId,
                    permissions,
                    sources,
                    deniedPermissions,
                    mockWorkspaceId,
                    ttl
                );

                const expectedKey = `user_perms:${mockUserId}:${mockWorkspaceId}`;
                const expectedData = JSON.stringify({
                    permissions,
                    sources,
                    deniedPermissions,
                    userId: mockUserId.toString(),
                    workspaceId: mockWorkspaceId.toString(),
                    lastUpdated: expect.any(Number),
                    expiresAt: expect.any(Number)
                });

                expect(mockRedis.setex).toHaveBeenCalledWith(expectedKey, ttl, expectedData);
            });
        });

        describe('getCachedUserPermissions', () => {
            it('should retrieve cached user permissions', async () => {
                const cachedData = {
                    permissions: ['patient.create', 'patient.read'],
                    sources: { 'patient.create': 'role', 'patient.read': 'direct' },
                    deniedPermissions: ['patient.delete'],
                    userId: mockUserId.toString(),
                    workspaceId: mockWorkspaceId.toString(),
                    lastUpdated: Date.now(),
                    expiresAt: Date.now() + 300000
                };

                mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

                const result = await cacheManager.getCachedUserPermissions(
                    mockUserId,
                    mockWorkspaceId
                );

                expect(result).toEqual({
                    permissions: cachedData.permissions,
                    sources: cachedData.sources,
                    deniedPermissions: cachedData.deniedPermissions
                });
            });

            it('should return null for expired user permissions cache', async () => {
                const expiredData = {
                    permissions: ['patient.create'],
                    sources: { 'patient.create': 'role' },
                    deniedPermissions: [],
                    userId: mockUserId.toString(),
                    workspaceId: mockWorkspaceId.toString(),
                    lastUpdated: Date.now(),
                    expiresAt: Date.now() - 1000 // Expired
                };

                mockRedis.get.mockResolvedValue(JSON.stringify(expiredData));

                const result = await cacheManager.getCachedUserPermissions(
                    mockUserId,
                    mockWorkspaceId
                );

                expect(result).toBeNull();
            });
        });
    });
});
describe('Role Permission Caching', () => {
    describe('cacheRolePermissions', () => {
        it('should cache role permissions with hierarchy information', async () => {
            const permissions = ['patient.create', 'patient.read'];
            const inheritedPermissions = ['patient.update'];
            const hierarchyLevel = 1;
            const parentRoleId = new mongoose.Types.ObjectId();
            const ttl = 300;

            mockRedis.setex.mockResolvedValue('OK');

            await cacheManager.cacheRolePermissions(
                mockRoleId,
                permissions,
                inheritedPermissions,
                hierarchyLevel,
                parentRoleId,
                ttl
            );

            const expectedKey = `role_perms:${mockRoleId}`;
            const expectedData = JSON.stringify({
                roleId: mockRoleId.toString(),
                permissions,
                inheritedPermissions,
                hierarchyLevel,
                parentRoleId: parentRoleId.toString(),
                lastUpdated: expect.any(Number),
                expiresAt: expect.any(Number)
            });

            expect(mockRedis.setex).toHaveBeenCalledWith(expectedKey, ttl, expectedData);
        });
    });

    describe('getCachedRolePermissions', () => {
        it('should retrieve cached role permissions', async () => {
            const cachedData = {
                roleId: mockRoleId.toString(),
                permissions: ['patient.create', 'patient.read'],
                inheritedPermissions: ['patient.update'],
                hierarchyLevel: 1,
                parentRoleId: new mongoose.Types.ObjectId().toString(),
                lastUpdated: Date.now(),
                expiresAt: Date.now() + 300000
            };

            mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

            const result = await cacheManager.getCachedRolePermissions(mockRoleId);

            expect(result).toEqual({
                permissions: cachedData.permissions,
                inheritedPermissions: cachedData.inheritedPermissions,
                hierarchyLevel: cachedData.hierarchyLevel,
                parentRoleId: cachedData.parentRoleId
            });
        });

        it('should return null for expired role permissions cache', async () => {
            const expiredData = {
                roleId: mockRoleId.toString(),
                permissions: ['patient.create'],
                inheritedPermissions: [],
                hierarchyLevel: 0,
                lastUpdated: Date.now(),
                expiresAt: Date.now() - 1000 // Expired
            };

            mockRedis.get.mockResolvedValue(JSON.stringify(expiredData));

            const result = await cacheManager.getCachedRolePermissions(mockRoleId);

            expect(result).toBeNull();
        });
    });
});

describe('Cache Invalidation', () => {
    describe('invalidatePattern', () => {
        it('should delete all keys matching pattern', async () => {
            const pattern = `user_perms:${mockUserId}:*`;
            const matchingKeys = [
                `user_perms:${mockUserId}:${mockWorkspaceId}`,
                `user_perms:${mockUserId}:global`
            ];

            mockRedis.keys.mockResolvedValue(matchingKeys);
            mockRedis.del.mockResolvedValue(2);

            await cacheManager.invalidatePattern(pattern);

            expect(mockRedis.keys).toHaveBeenCalledWith(pattern);
            expect(mockRedis.del).toHaveBeenCalledWith(...matchingKeys);
        });

        it('should handle empty key list gracefully', async () => {
            const pattern = 'non_existent:*';
            mockRedis.keys.mockResolvedValue([]);

            await cacheManager.invalidatePattern(pattern);

            expect(mockRedis.keys).toHaveBeenCalledWith(pattern);
            expect(mockRedis.del).not.toHaveBeenCalled();
        });
    });

    describe('invalidateUserPermissions', () => {
        it('should invalidate all user permission caches', async () => {
            const pattern = `user_perms:${mockUserId}:*`;
            const permCheckPattern = `perm_check:${mockUserId}:*`;

            mockRedis.keys.mockResolvedValue([]);

            await cacheManager.invalidateUserPermissions(mockUserId);

            expect(mockRedis.keys).toHaveBeenCalledWith(pattern);
            expect(mockRedis.keys).toHaveBeenCalledWith(permCheckPattern);
        });

        it('should invalidate specific workspace user permissions', async () => {
            const pattern = `user_perms:${mockUserId}:${mockWorkspaceId}`;
            const permCheckPattern = `perm_check:${mockUserId}:*:${mockWorkspaceId}`;

            mockRedis.keys.mockResolvedValue([]);

            await cacheManager.invalidateUserPermissions(mockUserId, mockWorkspaceId);

            expect(mockRedis.keys).toHaveBeenCalledWith(pattern);
            expect(mockRedis.keys).toHaveBeenCalledWith(permCheckPattern);
        });
    });

    describe('invalidateRolePermissions', () => {
        it('should invalidate role permission cache', async () => {
            const pattern = `role_perms:${mockRoleId}`;
            const hierarchyPattern = `role_hier:${mockRoleId}:*`;

            mockRedis.keys.mockResolvedValue([]);

            await cacheManager.invalidateRolePermissions(mockRoleId);

            expect(mockRedis.keys).toHaveBeenCalledWith(pattern);
            expect(mockRedis.keys).toHaveBeenCalledWith(hierarchyPattern);
        });
    });
});

describe('Cache Metrics', () => {
    describe('getMetrics', () => {
        it('should return current cache metrics', async () => {
            mockRedis.memory.mockResolvedValue(['used_memory', '1048576']);
            mockRedis.dbsize.mockResolvedValue(100);

            const metrics = await cacheManager.getMetrics();

            expect(metrics).toEqual({
                hits: expect.any(Number),
                misses: expect.any(Number),
                sets: expect.any(Number),
                deletes: expect.any(Number),
                hitRate: expect.any(Number),
                totalOperations: expect.any(Number),
                memoryUsage: 1048576,
                keyCount: 100
            });
        });

        it('should handle Redis errors gracefully', async () => {
            mockRedis.memory.mockRejectedValue(new Error('Redis connection error'));
            mockRedis.dbsize.mockRejectedValue(new Error('Redis connection error'));

            const metrics = await cacheManager.getMetrics();

            expect(metrics.memoryUsage).toBe(0);
            expect(metrics.keyCount).toBe(0);
        });
    });

    describe('recordCacheHit', () => {
        it('should increment hit counter and update hit rate', async () => {
            const initialMetrics = await cacheManager.getMetrics();
            const initialHits = initialMetrics.hits;

            await cacheManager.recordCacheHit();

            const updatedMetrics = await cacheManager.getMetrics();
            expect(updatedMetrics.hits).toBe(initialHits + 1);
            expect(updatedMetrics.totalOperations).toBe(initialMetrics.totalOperations + 1);
        });
    });

    describe('recordCacheMiss', () => {
        it('should increment miss counter and update hit rate', async () => {
            const initialMetrics = await cacheManager.getMetrics();
            const initialMisses = initialMetrics.misses;

            await cacheManager.recordCacheMiss();

            const updatedMetrics = await cacheManager.getMetrics();
            expect(updatedMetrics.misses).toBe(initialMisses + 1);
            expect(updatedMetrics.totalOperations).toBe(initialMetrics.totalOperations + 1);
        });
    });
});

describe('Connection Management', () => {
    describe('isConnected', () => {
        it('should return true when Redis is connected', () => {
            mockRedis.status = 'ready';
            expect(cacheManager.isConnected()).toBe(true);
        });

        it('should return false when Redis is disconnected', () => {
            mockRedis.status = 'close';
            expect(cacheManager.isConnected()).toBe(false);
        });
    });

    describe('disconnect', () => {
        it('should disconnect from Redis', async () => {
            mockRedis.disconnect.mockResolvedValue(undefined);

            await cacheManager.disconnect();

            expect(mockRedis.disconnect).toHaveBeenCalled();
        });

        it('should handle disconnect errors gracefully', async () => {
            mockRedis.disconnect.mockRejectedValue(new Error('Disconnect failed'));

            await expect(cacheManager.disconnect()).resolves.not.toThrow();
        });
    });
});

describe('Error Handling', () => {
    it('should handle Redis connection errors in cache operations', async () => {
        mockRedis.get.mockRejectedValue(new Error('Redis connection lost'));

        const result = await cacheManager.getCachedPermissionCheck(
            mockUserId,
            'patient.create',
            mockWorkspaceId
        );

        expect(result).toBeNull();
    });

    it('should handle Redis errors in cache set operations', async () => {
        mockRedis.setex.mockRejectedValue(new Error('Redis write failed'));

        await expect(
            cacheManager.cachePermissionCheck(
                mockUserId,
                'patient.create',
                true,
                'role',
                mockWorkspaceId,
                300
            )
        ).resolves.not.toThrow();
    });

    it('should handle malformed cache data gracefully', async () => {
        mockRedis.get.mockResolvedValue('invalid json data');

        const result = await cacheManager.getCachedPermissionCheck(
            mockUserId,
            'patient.create',
            mockWorkspaceId
        );

        expect(result).toBeNull();
    });
});

describe('Cache Warming', () => {
    describe('warmUserPermissions', () => {
        it('should pre-load user permissions into cache', async () => {
            const permissions = ['patient.create', 'patient.read'];
            const sources = { 'patient.create': 'role', 'patient.read': 'direct' };
            const deniedPermissions = ['patient.delete'];

            mockRedis.setex.mockResolvedValue('OK');

            await cacheManager.warmUserPermissions(
                mockUserId,
                permissions,
                sources,
                deniedPermissions,
                mockWorkspaceId
            );

            expect(mockRedis.setex).toHaveBeenCalled();
        });
    });

    describe('warmRolePermissions', () => {
        it('should pre-load role permissions into cache', async () => {
            const permissions = ['patient.create', 'patient.read'];
            const inheritedPermissions = ['patient.update'];

            mockRedis.setex.mockResolvedValue('OK');

            await cacheManager.warmRolePermissions(
                mockRoleId,
                permissions,
                inheritedPermissions,
                1,
                new mongoose.Types.ObjectId()
            );

            expect(mockRedis.setex).toHaveBeenCalled();
        });
    });
});