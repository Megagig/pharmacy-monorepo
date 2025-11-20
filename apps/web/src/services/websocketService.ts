/**
 * WebSocket Service for Real-time Updates
 * Handles real-time permission and role change notifications
 */

import React from 'react';
import type { PermissionChangeNotification } from '../types/rbac';

export interface WebSocketMessage {
    type: 'permission_change' | 'role_change' | 'user_update' | 'bulk_operation' | 'system_notification';
    data: unknown;
    timestamp: string;
    userId?: string;
}

export interface WebSocketConfig {
    url: string;
    reconnectInterval: number;
    maxReconnectAttempts: number;
    heartbeatInterval: number;
}

export type WebSocketEventHandler = (message: WebSocketMessage) => void;

class WebSocketService {
    private ws: WebSocket | null = null;
    private config: WebSocketConfig;
    private eventHandlers: Map<string, Set<WebSocketEventHandler>> = new Map();
    private reconnectAttempts = 0;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private heartbeatTimer: NodeJS.Timeout | null = null;
    private isConnecting = false;
    private isManuallyDisconnected = false;
    private isDisabled = false; // Flag to completely disable WebSocket

    constructor(config?: Partial<WebSocketConfig>) {
        this.config = {
            url: import.meta.env.VITE_WS_URL || 'wss://PharmaPilot-nttq.onrender.com/ws',
            reconnectInterval: 5000,
            maxReconnectAttempts: 3, // Reduced from 10 to 3
            heartbeatInterval: 30000,
            ...config,
        };
    }

    /**
     * Connect to WebSocket server
     */
    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                resolve();
                return;
            }

            if (this.isConnecting) {
                reject(new Error('Connection already in progress'));
                return;
            }

            this.isConnecting = true;
            this.isManuallyDisconnected = false;

            try {
                this.ws = new WebSocket(this.config.url);

                this.ws.onopen = () => {

                    this.isConnecting = false;
                    this.reconnectAttempts = 0;
                    this.startHeartbeat();
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const message: WebSocketMessage = JSON.parse(event.data);
                        this.handleMessage(message);
                    } catch (error) {
                        console.error('Error parsing WebSocket message:', error);
                    }
                };

                this.ws.onclose = (event) => {

                    this.isConnecting = false;
                    this.stopHeartbeat();

                    // Don't reconnect if it's a connection refused (1006) or server unavailable
                    if (!this.isManuallyDisconnected &&
                        this.reconnectAttempts < this.config.maxReconnectAttempts &&
                        event.code !== 1006) {
                        this.scheduleReconnect();
                    } else if (event.code === 1006) {
                        console.warn('WebSocket server unavailable. Stopping reconnection attempts.');
                        this.reconnectAttempts = this.config.maxReconnectAttempts; // Stop further attempts
                    }
                };

                this.ws.onerror = (error) => {
                    if (this.reconnectAttempts === 0) {
                        console.warn('WebSocket connection failed. Server may not be available.');
                    }
                    this.isConnecting = false;
                    reject(error);
                };

            } catch (error) {
                this.isConnecting = false;
                reject(error);
            }
        });
    }

    /**
     * Disconnect from WebSocket server
     */
    disconnect(): void {
        this.isManuallyDisconnected = true;
        this.stopHeartbeat();
        this.clearReconnectTimer();

        if (this.ws) {
            this.ws.close(1000, 'Manual disconnect');
            this.ws = null;
        }
    }

    /**
     * Subscribe to specific event types
     */
    subscribe(eventType: string, handler: WebSocketEventHandler): () => void {
        if (!this.eventHandlers.has(eventType)) {
            this.eventHandlers.set(eventType, new Set());
        }

        this.eventHandlers.get(eventType)!.add(handler);

        // Return unsubscribe function
        return () => {
            const handlers = this.eventHandlers.get(eventType);
            if (handlers) {
                handlers.delete(handler);
                if (handlers.size === 0) {
                    this.eventHandlers.delete(eventType);
                }
            }
        };
    }

    /**
     * Send message to server
     */
    send(message: Partial<WebSocketMessage>): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            const fullMessage: WebSocketMessage = {
                type: 'system_notification',
                data: null,
                timestamp: new Date().toISOString(),
                ...message,
            };

            this.ws.send(JSON.stringify(fullMessage));
        } else {
            console.warn('WebSocket not connected, message not sent:', message);
        }
    }

    /**
     * Get connection status
     */
    getStatus(): 'connecting' | 'connected' | 'disconnected' | 'error' {
        if (this.isConnecting) return 'connecting';

        switch (this.ws?.readyState) {
            case WebSocket.OPEN:
                return 'connected';
            case WebSocket.CONNECTING:
                return 'connecting';
            case WebSocket.CLOSED:
            case WebSocket.CLOSING:
                return 'disconnected';
            default:
                return 'error';
        }
    }

    /**
     * Handle incoming messages
     */
    private handleMessage(message: WebSocketMessage): void {
        // Emit to specific event type handlers
        const handlers = this.eventHandlers.get(message.type);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(message);
                } catch (error) {
                    console.error('Error in WebSocket event handler:', error);
                }
            });
        }

        // Emit to global handlers
        const globalHandlers = this.eventHandlers.get('*');
        if (globalHandlers) {
            globalHandlers.forEach(handler => {
                try {
                    handler(message);
                } catch (error) {
                    console.error('Error in global WebSocket event handler:', error);
                }
            });
        }
    }

    /**
     * Schedule reconnection attempt
     */
    private scheduleReconnect(): void {
        this.clearReconnectTimer();

        // Exponential backoff: increase delay with each attempt
        const delay = Math.min(this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts), 30000);

        this.reconnectTimer = setTimeout(() => {
            this.reconnectAttempts++;
            if (this.reconnectAttempts <= 3) {
            }

            this.connect().catch(error => {
                if (this.reconnectAttempts <= 3) {
                    console.warn('Reconnection failed. WebSocket server may not be available.');
                }
            });
        }, delay);
    }

    /**
     * Clear reconnection timer
     */
    private clearReconnectTimer(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    /**
     * Start heartbeat to keep connection alive
     */
    private startHeartbeat(): void {
        this.stopHeartbeat();

        this.heartbeatTimer = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.send({
                    type: 'system_notification',
                    data: { type: 'heartbeat' },
                });
            }
        }, this.config.heartbeatInterval);
    }

    /**
     * Stop heartbeat
     */
    private stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
}

// Create singleton instance
export const websocketService = new WebSocketService();

/**
 * React Hook for WebSocket connection
 */
export const useWebSocket = () => {
    const [status, setStatus] = React.useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');

    React.useEffect(() => {
        const updateStatus = () => {
            setStatus(websocketService.getStatus());
        };

        // Update status initially
        updateStatus();

        // Update status periodically
        const interval = setInterval(updateStatus, 1000);

        return () => {
            clearInterval(interval);
        };
    }, []);

    const connect = React.useCallback(() => {
        return websocketService.connect();
    }, []);

    const disconnect = React.useCallback(() => {
        websocketService.disconnect();
    }, []);

    const subscribe = React.useCallback((eventType: string, handler: WebSocketEventHandler) => {
        return websocketService.subscribe(eventType, handler);
    }, []);

    const send = React.useCallback((message: Partial<WebSocketMessage>) => {
        websocketService.send(message);
    }, []);

    return {
        status,
        connect,
        disconnect,
        subscribe,
        send,
    };
};

export default websocketService;