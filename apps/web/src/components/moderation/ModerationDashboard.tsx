import React, { useState, useEffect } from 'react';
import { moderationApi } from '../../services/api/moderationApi';

interface FlaggedMessage {
  _id: string;
  content: {
    text: string;
    type: string;
  };
  senderId: {
    _id: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  conversationId: {
    _id: string;
    title: string;
    type: string;
  };
  flags: Array<{
    _id: string;
    reportedBy: {
      firstName: string;
      lastName: string;
    };
    reportedAt: string;
    reason: string;
    description?: string;
    status: 'pending' | 'reviewed' | 'dismissed';
  }>;
  createdAt: string;
}

export const ModerationDashboard: React.FC = () => {
  const [messages, setMessages] = useState<FlaggedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{
    status?: 'pending' | 'reviewed' | 'dismissed';
    reason?: string;
  }>({});
  const [selectedMessage, setSelectedMessage] = useState<FlaggedMessage | null>(null);

  useEffect(() => {
    loadModerationQueue();
  }, [filter]);

  const loadModerationQueue = async () => {
    try {
      setLoading(true);
      const data = await moderationApi.getModerationQueue(filter);
      setMessages(data);
    } catch (error) {
      console.error('Failed to load moderation queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismissFlag = async (messageId: string, flagId: string) => {
    try {
      await moderationApi.dismissFlag(messageId, flagId, 'Reviewed and dismissed');
      loadModerationQueue();
      setSelectedMessage(null);
    } catch (error) {
      console.error('Failed to dismiss flag:', error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!window.confirm('Are you sure you want to delete this message?')) return;
    
    try {
      await moderationApi.deleteMessage(messageId);
      loadModerationQueue();
      setSelectedMessage(null);
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  const getReasonBadgeColor = (reason: string) => {
    const colors: Record<string, string> = {
      inappropriate: 'bg-red-100 text-red-800',
      spam: 'bg-yellow-100 text-yellow-800',
      harassment: 'bg-orange-100 text-orange-800',
      privacy_violation: 'bg-purple-100 text-purple-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[reason] || colors.other;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Moderation Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Review and manage flagged messages
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={filter.status || ''}
              onChange={(e) => setFilter({ ...filter, status: e.target.value as any })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="reviewed">Reviewed</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason
            </label>
            <select
              value={filter.reason || ''}
              onChange={(e) => setFilter({ ...filter, reason: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">All Reasons</option>
              <option value="inappropriate">Inappropriate</option>
              <option value="spam">Spam</option>
              <option value="harassment">Harassment</option>
              <option value="privacy_violation">Privacy Violation</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setFilter({})}
              className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Message List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No flagged messages</h3>
            <p className="mt-1 text-sm text-gray-500">
              All messages have been reviewed or there are no reports.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {messages.map((message) => (
              <li
                key={message._id}
                className="p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedMessage(message)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        {message.senderId.firstName} {message.senderId.lastName}
                      </span>
                      <span className="text-xs text-gray-500">
                        in {message.conversationId.title}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-700 line-clamp-2 mb-2">
                      {message.content.text}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {message.flags.map((flag) => (
                        <span
                          key={flag._id}
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getReasonBadgeColor(flag.reason)}`}
                        >
                          {flag.reason.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="ml-4 flex-shrink-0">
                    <span className="text-xs text-gray-500">
                      {new Date(message.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Message Detail Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Message Details</h2>
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Message Content */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Message</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-gray-900">
                      {selectedMessage.senderId.firstName} {selectedMessage.senderId.lastName}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({selectedMessage.senderId.role})
                    </span>
                  </div>
                  <p className="text-gray-700">{selectedMessage.content.text}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(selectedMessage.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Flags */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Reports</h3>
                <div className="space-y-3">
                  {selectedMessage.flags.map((flag) => (
                    <div key={flag._id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getReasonBadgeColor(flag.reason)}`}>
                            {flag.reason.replace('_', ' ')}
                          </span>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${
                          flag.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          flag.status === 'dismissed' ? 'bg-gray-100 text-gray-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {flag.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">
                        Reported by {flag.reportedBy.firstName} {flag.reportedBy.lastName}
                      </p>
                      {flag.description && (
                        <p className="text-sm text-gray-600 italic">"{flag.description}"</p>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(flag.reportedAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                {selectedMessage.flags.some(f => f.status === 'pending') && (
                  <>
                    <button
                      onClick={() => handleDismissFlag(selectedMessage._id, selectedMessage.flags[0]._id)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Dismiss Flag
                    </button>
                    <button
                      onClick={() => handleDeleteMessage(selectedMessage._id)}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700"
                    >
                      Delete Message
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
