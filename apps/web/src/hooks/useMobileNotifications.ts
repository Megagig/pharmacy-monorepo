import { useEffect, useState, useCallback } from 'react';
import { useIsTouchDevice } from './useResponsive';

interface NotificationPermission {
    granted: boolean;
    denied: boolean;
    default: boolean;
}

interface PushNotificationOptions {
    title: string;
    body?: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: any;
    requireInteraction?: boolean;
    silent?: boolean;
    vibrate?: number[];
}

export const useMobileNotifications = () => {
    const [permission, setPermission] = useState<NotificationPermission>({
        granted: false,
        denied: false,
        default: true,
    });
    const [isSupported, setIsSupported] = useState(false);
    const [serviceWorkerRegistration, setServiceWorkerRegistration] = useState<ServiceWorkerRegistration | null>(null);

    const isTouchDevice = useIsTouchDevice();

    // Check notification support and permission
    useEffect(() => {
        const checkSupport = () => {
            const supported = 'Notification' in window && 'serviceWorker' in navigator;
            setIsSupported(supported);

            if (supported) {
                const currentPermission = Notification.permission;
                setPermission({
                    granted: currentPermission === 'granted',
                    denied: currentPermission === 'denied',
                    default: currentPermission === 'default',
                });
            }
        };

        checkSupport();
    }, []);

    // Register service worker for push notifications
    useEffect(() => {
        const registerServiceWorker = async () => {
            if ('serviceWorker' in navigator) {
                try {
                    const registration = await navigator.serviceWorker.register('/sw.js');
                    setServiceWorkerRegistration(registration);

                    // Listen for service worker updates
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    // New service worker is available

                                }
                            });
                        }
                    });
                } catch (error) {
                    console.error('Service worker registration failed:', error);
                }
            }
        };

        if (isSupported) {
            registerServiceWorker();
        }
    }, [isSupported]);

    // Request notification permission
    const requestPermission = useCallback(async (): Promise<boolean> => {
        if (!isSupported) {
            console.warn('Notifications not supported');
            return false;
        }

        try {
            const result = await Notification.requestPermission();
            const newPermission = {
                granted: result === 'granted',
                denied: result === 'denied',
                default: result === 'default',
            };

            setPermission(newPermission);
            return newPermission.granted;
        } catch (error) {
            console.error('Failed to request notification permission:', error);
            return false;
        }
    }, [isSupported]);

    // Show local notification
    const showNotification = useCallback(async (options: PushNotificationOptions): Promise<boolean> => {
        if (!permission.granted) {
            console.warn('Notification permission not granted');
            return false;
        }

        try {
            // Use service worker for better mobile support
            if (serviceWorkerRegistration) {
                await serviceWorkerRegistration.showNotification(options.title, {
                    body: options.body,
                    icon: options.icon || '/icons/icon-192x192.png',
                    badge: options.badge || '/icons/badge-72x72.png',
                    tag: options.tag,
                    data: options.data,
                    requireInteraction: options.requireInteraction || false,
                    silent: options.silent || false,
                    vibrate: options.vibrate || (isTouchDevice ? [200, 100, 200] : undefined),
                    actions: [
                        {
                            action: 'reply',
                            title: 'Reply',
                            icon: '/icons/reply-icon.png',
                        },
                        {
                            action: 'view',
                            title: 'View',
                            icon: '/icons/view-icon.png',
                        },
                    ],
                });
            } else {
                // Fallback to regular notification
                const notification = new Notification(options.title, {
                    body: options.body,
                    icon: options.icon || '/icons/icon-192x192.png',
                    tag: options.tag,
                    data: options.data,
                    requireInteraction: options.requireInteraction || false,
                    silent: options.silent || false,
                });

                // Handle notification click
                notification.onclick = () => {
                    window.focus();
                    notification.close();

                    // Handle notification data
                    if (options.data?.conversationId) {
                        // Navigate to conversation
                        window.location.hash = `#/communication/${options.data.conversationId}`;
                    }
                };

                // Auto-close after delay (mobile battery optimization)
                if (isTouchDevice && !options.requireInteraction) {
                    setTimeout(() => {
                        notification.close();
                    }, 5000);
                }
            }

            return true;
        } catch (error) {
            console.error('Failed to show notification:', error);
            return false;
        }
    }, [permission.granted, serviceWorkerRegistration, isTouchDevice]);

    // Handle push notification events
    useEffect(() => {
        const handlePushMessage = (event: MessageEvent) => {
            if (event.data?.type === 'push-notification') {
                const { title, body, data } = event.data.payload;
                showNotification({
                    title,
                    body,
                    data,
                    requireInteraction: data?.priority === 'urgent',
                });
            }
        };

        const handleNotificationClick = (event: MessageEvent) => {
            if (event.data?.type === 'notification-click') {
                const { action, data } = event.data;

                switch (action) {
                    case 'reply':
                        // Open reply interface
                        window.location.hash = `#/communication/${data.conversationId}?reply=true`;
                        break;
                    case 'view':
                        // Open conversation
                        window.location.hash = `#/communication/${data.conversationId}`;
                        break;
                    default:
                        // Default click action
                        if (data?.conversationId) {
                            window.location.hash = `#/communication/${data.conversationId}`;
                        }
                }
            }
        };

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', handlePushMessage);
            navigator.serviceWorker.addEventListener('message', handleNotificationClick);

            return () => {
                navigator.serviceWorker.removeEventListener('message', handlePushMessage);
                navigator.serviceWorker.removeEventListener('message', handleNotificationClick);
            };
        }
    }, [showNotification]);

    // Vibration support for mobile
    const vibrate = useCallback((pattern: number[] = [200, 100, 200]) => {
        if ('vibrate' in navigator && isTouchDevice) {
            navigator.vibrate(pattern);
        }
    }, [isTouchDevice]);

    // Clear all notifications
    const clearAllNotifications = useCallback(async () => {
        if (serviceWorkerRegistration) {
            const notifications = await serviceWorkerRegistration.getNotifications();
            notifications.forEach(notification => notification.close());
        }
    }, [serviceWorkerRegistration]);

    // Get active notifications
    const getActiveNotifications = useCallback(async () => {
        if (serviceWorkerRegistration) {
            return await serviceWorkerRegistration.getNotifications();
        }
        return [];
    }, [serviceWorkerRegistration]);

    return {
        isSupported,
        permission,
        requestPermission,
        showNotification,
        vibrate,
        clearAllNotifications,
        getActiveNotifications,
        serviceWorkerRegistration,
    };
};

// Hook for handling incoming communication notifications
export const useCommunicationNotifications = () => {
    const { showNotification, vibrate, permission } = useMobileNotifications();

    const showMessageNotification = useCallback(async (message: {
        senderName: string;
        content: string;
        conversationId: string;
        priority?: 'normal' | 'high' | 'urgent';
    }) => {
        if (!permission.granted) return false;

        const isUrgent = message.priority === 'urgent';

        // Vibrate for urgent messages
        if (isUrgent) {
            vibrate([300, 100, 300, 100, 300]);
        }

        return await showNotification({
            title: `New message from ${message.senderName}`,
            body: message.content,
            tag: `message-${message.conversationId}`,
            data: {
                conversationId: message.conversationId,
                priority: message.priority,
            },
            requireInteraction: isUrgent,
            icon: '/icons/message-icon.png',
        });
    }, [showNotification, vibrate, permission.granted]);

    const showMentionNotification = useCallback(async (mention: {
        senderName: string;
        content: string;
        conversationId: string;
    }) => {
        if (!permission.granted) return false;

        // Always vibrate for mentions
        vibrate([200, 100, 200]);

        return await showNotification({
            title: `${mention.senderName} mentioned you`,
            body: mention.content,
            tag: `mention-${mention.conversationId}`,
            data: {
                conversationId: mention.conversationId,
                type: 'mention',
            },
            requireInteraction: true,
            icon: '/icons/mention-icon.png',
        });
    }, [showNotification, vibrate, permission.granted]);

    const showConversationNotification = useCallback(async (conversation: {
        title: string;
        type: 'created' | 'added' | 'updated';
        conversationId: string;
    }) => {
        if (!permission.granted) return false;

        const titles = {
            created: 'New conversation created',
            added: 'Added to conversation',
            updated: 'Conversation updated',
        };

        return await showNotification({
            title: titles[conversation.type],
            body: conversation.title,
            tag: `conversation-${conversation.conversationId}`,
            data: {
                conversationId: conversation.conversationId,
                type: 'conversation',
            },
            icon: '/icons/conversation-icon.png',
        });
    }, [showNotification, permission.granted]);

    return {
        showMessageNotification,
        showMentionNotification,
        showConversationNotification,
    };
};