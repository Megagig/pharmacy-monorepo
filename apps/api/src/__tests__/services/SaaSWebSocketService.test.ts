import { SaaSWebSocketService } from '../../services/SaaSWebSocketService';
import { Server as SocketIOServer } from 'socket.io';
import { RedisCacheService } from '../../services/RedisCacheService';

// Mock dependencies
jest.mock('socket.io');
jest.mock('../../services/RedisCacheService');
jest.mock('../../utils/logger');

describe('SaaSWebSocketService', () => {
  let service: SaaSWebSocketService;
  let mockIo: jest.Mocked<SocketIOServer>;
  let mockCacheService: jest.Mocked<RedisCacheService>;
  let mockSocket: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSocket = {
      id: 'socket123',
      userId: 'user123',
      tenantId: 'tenant123',
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      on: jest.fn(),
      disconnect: jest.fn(),
      handshake: {
        auth: {
          token: 'valid-token',
          userId: 'user123',
          tenantId: 'tenant123'
        }
      }
    };

    mockIo = {
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      sockets: {
        sockets: new Map([['socket123', mockSocket]])
      }
    } as any;

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delPattern: jest.fn(),
    } as any;

    (RedisCacheService.getInstance as jest.Mock).mockReturnValue(mockCacheService);
    service = SaaSWebSocketService.getInstance();
    (service as any).io = mockIo;
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = SaaSWebSocketService.getInstance();
      const instance2 = SaaSWebSocketService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should initialize socket server with authentication', () => {
      const mockServer = {} as any;
      service.initialize(mockServer);

      expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });

  describe('handleConnection', () => {
    it('should handle valid socket connection', async () => {
      mockCacheService.get.mockResolvedValue('valid-session');

      await (service as any).handleConnection(mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith('tenant:tenant123');
      expect(mockSocket.join).toHaveBeenCalledWith('user:user123');
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });

    it('should reject invalid authentication', async () => {
      mockCacheService.get.mockResolvedValue(null);

      await (service as any).handleConnection(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('auth_error', 'Invalid authentication');
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should handle missing auth token', async () => {
      const invalidSocket = {
        ...mockSocket,
        handshake: { auth: {} }
      };

      await (service as any).handleConnection(invalidSocket);

      expect(invalidSocket.emit).toHaveBeenCalledWith('auth_error', 'Authentication required');
      expect(invalidSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('broadcastToTenant', () => {
    it('should broadcast message to tenant room', () => {
      const tenantId = 'tenant123';
      const event = 'tenant_update';
      const data = { message: 'Tenant updated' };

      service.broadcastToTenant(tenantId, event, data);

      expect(mockIo.to).toHaveBeenCalledWith(`tenant:${tenantId}`);
      expect(mockIo.emit).toHaveBeenCalledWith(event, data);
    });

    it('should handle broadcast errors gracefully', () => {
      const tenantId = 'tenant123';
      const event = 'tenant_update';
      const data = { message: 'Test' };

      mockIo.to.mockImplementation(() => {
        throw new Error('Broadcast error');
      });

      expect(() => service.broadcastToTenant(tenantId, event, data)).not.toThrow();
    });
  });

  describe('broadcastToUser', () => {
    it('should broadcast message to specific user', () => {
      const userId = 'user123';
      const event = 'user_notification';
      const data = { message: 'New notification' };

      service.broadcastToUser(userId, event, data);

      expect(mockIo.to).toHaveBeenCalledWith(`user:${userId}`);
      expect(mockIo.emit).toHaveBeenCalledWith(event, data);
    });

    it('should handle broadcast errors gracefully', () => {
      const userId = 'user123';
      const event = 'user_notification';
      const data = { message: 'Test' };

      mockIo.to.mockImplementation(() => {
        throw new Error('Broadcast error');
      });

      expect(() => service.broadcastToUser(userId, event, data)).not.toThrow();
    });
  });

  describe('broadcastSystemAlert', () => {
    it('should broadcast system alert to all connected clients', () => {
      const alert = {
        type: 'maintenance',
        message: 'System maintenance scheduled',
        severity: 'info'
      };

      service.broadcastSystemAlert(alert);

      expect(mockIo.emit).toHaveBeenCalledWith('system_alert', alert);
    });

    it('should handle broadcast errors gracefully', () => {
      const alert = {
        type: 'maintenance',
        message: 'Test',
        severity: 'info'
      };

      mockIo.emit.mockImplementation(() => {
        throw new Error('Broadcast error');
      });

      expect(() => service.broadcastSystemAlert(alert)).not.toThrow();
    });
  });

  describe('getConnectedUsers', () => {
    it('should return list of connected users for tenant', async () => {
      const tenantId = 'tenant123';
      
      // Mock connected sockets
      const mockSockets = new Map([
        ['socket1', { userId: 'user1', tenantId: 'tenant123' }],
        ['socket2', { userId: 'user2', tenantId: 'tenant123' }],
        ['socket3', { userId: 'user3', tenantId: 'tenant456' }]
      ]);

      (service as any).connectedUsers = mockSockets;

      const result = await service.getConnectedUsers(tenantId);

      expect(result).toEqual(['user1', 'user2']);
    });

    it('should return empty array if no users connected', async () => {
      const tenantId = 'tenant123';
      (service as any).connectedUsers = new Map();

      const result = await service.getConnectedUsers(tenantId);

      expect(result).toEqual([]);
    });
  });

  describe('disconnectUser', () => {
    it('should disconnect specific user', async () => {
      const userId = 'user123';
      
      // Mock finding socket by userId
      const mockSockets = new Map([
        ['socket123', mockSocket]
      ]);
      (service as any).connectedUsers = mockSockets;
      mockSocket.userId = userId;

      await service.disconnectUser(userId);

      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    });

    it('should handle user not found gracefully', async () => {
      const userId = 'nonexistent';
      (service as any).connectedUsers = new Map();

      await expect(service.disconnectUser(userId)).resolves.not.toThrow();
    });
  });

  describe('sendNotificationToUser', () => {
    it('should send notification to specific user', async () => {
      const userId = 'user123';
      const notification = {
        id: 'notif123',
        title: 'Test Notification',
        message: 'This is a test',
        type: 'info'
      };

      service.sendNotificationToUser(userId, notification);

      expect(mockIo.to).toHaveBeenCalledWith(`user:${userId}`);
      expect(mockIo.emit).toHaveBeenCalledWith('notification', notification);
    });
  });

  describe('sendTenantUpdate', () => {
    it('should send tenant update to all tenant users', async () => {
      const tenantId = 'tenant123';
      const update = {
        type: 'settings_changed',
        data: { branding: { logo: 'new-logo.png' } }
      };

      service.sendTenantUpdate(tenantId, update);

      expect(mockIo.to).toHaveBeenCalledWith(`tenant:${tenantId}`);
      expect(mockIo.emit).toHaveBeenCalledWith('tenant_update', update);
    });
  });

  describe('handleDisconnection', () => {
    it('should clean up user data on disconnect', async () => {
      const mockConnectedUsers = new Map([
        ['socket123', { userId: 'user123', tenantId: 'tenant123' }]
      ]);
      (service as any).connectedUsers = mockConnectedUsers;

      await (service as any).handleDisconnection(mockSocket);

      expect(mockConnectedUsers.has('socket123')).toBe(false);
    });
  });

  describe('validateSocketAuth', () => {
    it('should validate socket authentication successfully', async () => {
      const auth = {
        token: 'valid-token',
        userId: 'user123',
        tenantId: 'tenant123'
      };

      mockCacheService.get.mockResolvedValue('valid-session');

      const result = await (service as any).validateSocketAuth(auth);

      expect(result).toBe(true);
      expect(mockCacheService.get).toHaveBeenCalledWith(`session:${auth.token}`);
    });

    it('should reject invalid token', async () => {
      const auth = {
        token: 'invalid-token',
        userId: 'user123',
        tenantId: 'tenant123'
      };

      mockCacheService.get.mockResolvedValue(null);

      const result = await (service as any).validateSocketAuth(auth);

      expect(result).toBe(false);
    });

    it('should reject missing auth fields', async () => {
      const auth = {
        token: 'valid-token'
        // missing userId and tenantId
      };

      const result = await (service as any).validateSocketAuth(auth);

      expect(result).toBe(false);
    });
  });

  describe('getConnectionStats', () => {
    it('should return connection statistics', async () => {
      const mockConnectedUsers = new Map([
        ['socket1', { userId: 'user1', tenantId: 'tenant1' }],
        ['socket2', { userId: 'user2', tenantId: 'tenant1' }],
        ['socket3', { userId: 'user3', tenantId: 'tenant2' }]
      ]);
      (service as any).connectedUsers = mockConnectedUsers;

      const result = await service.getConnectionStats();

      expect(result).toEqual({
        totalConnections: 3,
        uniqueUsers: 3,
        tenantConnections: {
          tenant1: 2,
          tenant2: 1
        }
      });
    });

    it('should return zero stats when no connections', async () => {
      (service as any).connectedUsers = new Map();

      const result = await service.getConnectionStats();

      expect(result).toEqual({
        totalConnections: 0,
        uniqueUsers: 0,
        tenantConnections: {}
      });
    });
  });
});