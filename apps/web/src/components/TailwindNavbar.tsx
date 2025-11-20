import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, User, LogOut, Settings, CreditCard, Shield } from 'lucide-react';
import ThemeToggle from './common/ThemeToggle';
import { useAuth } from '../hooks/useAuth';
import { useSubscriptionStatus } from '../hooks/useSubscription';
import { useNotificationStore } from '../stores/notificationStore';
import { formatDistanceToNow } from 'date-fns';

/**
 * Modern Tailwind-based navigation bar with theme support
 */
const TailwindNavbar: React.FC = () => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const { user, logout } = useAuth();
  const { tier } = useSubscriptionStatus();
  const navigate = useNavigate();

  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
  } = useNotificationStore();

  // Fetch notifications on mount and periodically
  useEffect(() => {
    fetchNotifications({ limit: 10 });
    fetchUnreadCount();

    // Poll for new notifications every 30 seconds
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchNotifications, fetchUnreadCount]);

  const handleNotificationClick = async (notificationId: string, isRead: boolean) => {
    if (!isRead) {
      await markAsRead(notificationId);
    }
    setShowNotificationMenu(false);
  };

  const handleNotificationMenuOpen = () => {
    setShowNotificationMenu(!showNotificationMenu);
    // Refresh notifications when opening the menu
    fetchNotifications({ limit: 10 });
  };

  const handleLogout = async () => {
    setShowProfileMenu(false);
    await logout();
    navigate('/login');
  };

  const getSubscriptionBadgeColor = () => {
    switch (tier) {
      case 'enterprise':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'pro':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300';
      case 'basic':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'free_trial':
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  if (!user) return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-dark-900 border-b border-gray-200 dark:border-dark-700 shadow-sm">
      <div className="max-w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <Link
              to="/dashboard"
              className="text-xl font-bold text-primary-600 dark:text-accent-400 hover:text-primary-700 dark:hover:text-accent-300 transition-colors"
            >
              PharmacyCopilot
            </Link>
          </div>

          {/* Right side items */}
          <div className="flex items-center space-x-4">
            {/* Subscription Tier Badge */}
            {tier && (
              <span
                className={`
                  px-2 py-1 text-xs font-medium rounded-full
                  ${getSubscriptionBadgeColor()}
                `}
              >
                {tier.replace('_', ' ').toUpperCase()}
              </span>
            )}

            {/* Theme Toggle */}
            <ThemeToggle size="sm" />

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={handleNotificationMenuOpen}
                className="
                  relative p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
                  hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors
                  focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-500 focus:ring-offset-2
                "
                aria-label="Notifications"
              >
                <Bell size={20} />
                {/* Notification badge */}
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotificationMenu && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-dark-800 rounded-lg shadow-lg border border-gray-200 dark:border-dark-600 py-2 z-10">
                  <div className="px-4 py-2 border-b border-gray-200 dark:border-dark-600">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Notifications
                    </h3>
                    {unreadCount > 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {unreadCount} unread
                      </p>
                    )}
                  </div>

                  {loading && (
                    <div className="flex justify-center py-6">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 dark:border-accent-400"></div>
                    </div>
                  )}

                  {!loading && notifications.length === 0 && (
                    <div className="px-4 py-6 text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No notifications
                      </p>
                    </div>
                  )}

                  <div className="max-h-64 overflow-y-auto">
                    {!loading &&
                      notifications.slice(0, 5).map((notification) => (
                        <button
                          key={notification._id}
                          onClick={() => handleNotificationClick(notification._id, notification.isRead)}
                          className={`
                            w-full px-4 py-3 text-left transition-colors
                            ${notification.isRead
                              ? 'hover:bg-gray-50 dark:hover:bg-dark-700'
                              : 'bg-blue-50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/20 border-l-3 border-primary-500 dark:border-accent-400'
                            }
                          `}
                        >
                          <p
                            className={`text-sm ${notification.isRead
                                ? 'text-gray-900 dark:text-gray-100'
                                : 'text-gray-900 dark:text-gray-100 font-semibold'
                              }`}
                          >
                            {notification.title}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {notification.content}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                          </p>
                        </button>
                      ))}
                  </div>

                  {notifications.length > 0 && (
                    <div className="border-t border-gray-200 dark:border-dark-600 px-4 py-2">
                      <button
                        onClick={() => {
                          setShowNotificationMenu(false);
                          navigate('/notifications');
                        }}
                        className="text-sm text-primary-600 dark:text-accent-400 hover:text-primary-700 dark:hover:text-accent-300 font-medium"
                      >
                        View all notifications
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Profile Menu */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="
                  flex items-center p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
                  hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors
                  focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-500 focus:ring-offset-2
                "
                aria-label="Profile menu"
              >
                <User size={20} />
              </button>

              {/* Profile Dropdown */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-dark-800 rounded-lg shadow-lg border border-gray-200 dark:border-dark-600 py-2 z-10">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-dark-600">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {user.email}
                    </p>
                  </div>

                  <Link
                    to="/profile"
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                  >
                    <User size={16} className="mr-3" />
                    Profile
                  </Link>

                  <Link
                    to="/subscription-management"
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                  >
                    <CreditCard size={16} className="mr-3" />
                    Subscription
                  </Link>

                  {user.role === 'super_admin' && (
                    <Link
                      to="/admin"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                    >
                      <Shield size={16} className="mr-3" />
                      Admin Dashboard
                    </Link>
                  )}

                  <Link
                    to="/settings"
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                  >
                    <Settings size={16} className="mr-3" />
                    Settings
                  </Link>

                  <div className="border-t border-gray-200 dark:border-dark-600 mt-2 pt-2">
                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <LogOut size={16} className="mr-3" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Click outside to close dropdowns */}
      {(showProfileMenu || showNotificationMenu) && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => {
            setShowProfileMenu(false);
            setShowNotificationMenu(false);
          }}
        />
      )}
    </nav>
  );
};

export default TailwindNavbar;
