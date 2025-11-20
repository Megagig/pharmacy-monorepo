import React from 'react';
import {
  Palette,
  Monitor,
  Sun,
  Moon,
  User,
  Bell,
  Shield,
  Database,
} from 'lucide-react';
import ThemeToggle from '../components/common/ThemeToggle';
import { useTheme } from '../stores/themeStore';

/**
 * Settings page with theme configuration section
 */
const SettingsPage: React.FC = () => {
  const { theme, setTheme, resolvedTheme, systemTheme } = useTheme();

  const themeOptions = [
    {
      value: 'light' as const,
      label: 'Light',
      icon: Sun,
      description: 'Always use light theme',
    },
    {
      value: 'dark' as const,
      label: 'Dark',
      icon: Moon,
      description: 'Always use dark theme',
    },
    {
      value: 'system' as const,
      label: 'System',
      icon: Monitor,
      description: 'Follow system preference',
    },
  ];

  const settingsSections = [
    {
      title: 'Appearance',
      icon: Palette,
      items: ['Theme', 'Font Size', 'Language'],
    },
    {
      title: 'Profile',
      icon: User,
      items: ['Personal Info', 'Account Security', 'Privacy'],
    },
    {
      title: 'Notifications',
      icon: Bell,
      items: ['Email Notifications', 'Push Notifications', 'SMS Alerts'],
    },
    {
      title: 'Security',
      icon: Shield,
      items: ['Two-Factor Auth', 'Login History', 'API Keys'],
    },
    {
      title: 'Data',
      icon: Database,
      items: ['Export Data', 'Import Data', 'Data Retention'],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 transition-colors">
      {/* Header */}
      <div className="bg-white dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Settings
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-300">
              Manage your account settings and preferences
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <nav className="space-y-2">
              {settingsSections.map((section) => (
                <div key={section.title} className="mb-6">
                  <div className="flex items-center mb-3">
                    <section.icon
                      size={20}
                      className="text-gray-500 dark:text-gray-400 mr-2"
                    />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                      {section.title}
                    </h3>
                  </div>
                  <ul className="space-y-1 ml-7">
                    {section.items.map((item, index) => (
                      <li key={item}>
                        <button
                          className={`
                            w-full text-left px-3 py-2 text-sm rounded-md transition-colors
                            ${
                              section.title === 'Appearance' && index === 0
                                ? 'bg-primary-100 text-primary-700 dark:bg-accent-900/20 dark:text-accent-300'
                                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-dark-700'
                            }
                          `}
                        >
                          {item}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-dark-800 rounded-lg shadow-sm border border-gray-200 dark:border-dark-700">
              {/* Theme Settings */}
              <div className="p-6 border-b border-gray-200 dark:border-dark-700">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      Theme Settings
                    </h2>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      Customize the appearance of your application
                    </p>
                  </div>
                  <ThemeToggle variant="dropdown" showLabel />
                </div>

                {/* Theme Options */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Theme Mode
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {themeOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setTheme(option.value)}
                        className={`
                          relative p-4 rounded-lg border-2 transition-all duration-200
                          ${
                            theme === option.value
                              ? 'border-primary-500 dark:border-accent-500 bg-primary-50 dark:bg-accent-900/20'
                              : 'border-gray-200 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500 bg-white dark:bg-dark-700'
                          }
                        `}
                      >
                        <div className="flex flex-col items-center text-center">
                          <option.icon
                            size={24}
                            className={`
                              mb-2
                              ${
                                theme === option.value
                                  ? 'text-primary-600 dark:text-accent-400'
                                  : 'text-gray-500 dark:text-gray-400'
                              }
                            `}
                          />
                          <h4
                            className={`
                              font-medium
                              ${
                                theme === option.value
                                  ? 'text-primary-900 dark:text-accent-100'
                                  : 'text-gray-900 dark:text-gray-100'
                              }
                            `}
                          >
                            {option.label}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {option.description}
                          </p>
                        </div>
                        {theme === option.value && (
                          <div className="absolute top-2 right-2 w-4 h-4 bg-primary-500 dark:bg-accent-500 rounded-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Current Theme Status */}
                <div className="mt-6 p-4 bg-gray-50 dark:bg-dark-700 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Current Status
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">
                        Theme Mode:
                      </span>
                      <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                        {theme}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">
                        Active Theme:
                      </span>
                      <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                        {resolvedTheme}
                      </span>
                    </div>
                    {theme === 'system' && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-300">
                          System Preference:
                        </span>
                        <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                          {systemTheme}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Theme Preview */}
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                    Preview
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Light Preview */}
                    <div className="bg-white border-2 border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="text-sm font-medium text-gray-900">
                          Light Theme
                        </h5>
                        {resolvedTheme === 'light' && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="h-2 bg-blue-500 rounded"></div>
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>

                    {/* Dark Preview */}
                    <div className="bg-slate-900 border-2 border-slate-700 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="text-sm font-medium text-white">
                          Dark Theme
                        </h5>
                        {resolvedTheme === 'dark' && (
                          <span className="text-xs bg-green-900/50 text-green-300 px-2 py-1 rounded">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="h-2 bg-purple-500 rounded"></div>
                      <div className="space-y-2">
                        <div className="h-3 bg-slate-700 rounded w-3/4"></div>
                        <div className="h-3 bg-slate-700 rounded w-1/2"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Settings Placeholder */}
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                  Other Appearance Settings
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Font Size
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Adjust the default font size
                      </p>
                    </div>
                    <select className="block w-32 px-3 py-2 bg-white dark:bg-dark-700 border border-gray-300 dark:border-dark-600 rounded-md text-sm text-gray-900 dark:text-gray-100">
                      <option>Small</option>
                      <option selected>Medium</option>
                      <option>Large</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        High Contrast
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Increase contrast for better visibility
                      </p>
                    </div>
                    <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 dark:bg-dark-600 transition-colors">
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-1" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
