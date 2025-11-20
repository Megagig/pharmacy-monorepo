import React, { useState, useEffect } from 'react';
import { auditApi } from '../../services/api/auditApi';

interface AuditLog {
  _id: string;
  action: string;
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  targetType: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  complianceCategory: string;
  success: boolean;
  ipAddress: string;
  timestamp: string;
  details: any;
}

export const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<{
    action?: string;
    riskLevel?: string;
    startDate?: string;
    endDate?: string;
    success?: boolean;
  }>({});

  useEffect(() => {
    loadAuditLogs();
  }, [filters]);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const data = await auditApi.getAuditLogs(filters);
      setLogs(data);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      await auditApi.exportAuditLogs(filters);
    } catch (error) {
      console.error('Failed to export audit logs:', error);
    }
  };

  const getRiskLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800',
    };
    return colors[level] || colors.low;
  };

  const filteredLogs = (logs || []).filter(log => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      log.action.toLowerCase().includes(searchLower) ||
      `${log.userId.firstName} ${log.userId.lastName}`.toLowerCase().includes(searchLower) ||
      log.ipAddress.includes(searchLower)
    );
  });

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
        <h1 className="text-2xl font-bold text-gray-900">Audit Log Viewer</h1>
        <p className="mt-1 text-sm text-gray-600">
          View and export communication audit logs for compliance
        </p>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Action
            </label>
            <select
              value={filters.action || ''}
              onChange={(e) => setFilters({ ...filters, action: e.target.value || undefined })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">All Actions</option>
              <option value="message_sent">Message Sent</option>
              <option value="message_edited">Message Edited</option>
              <option value="message_deleted">Message Deleted</option>
              <option value="conversation_created">Conversation Created</option>
              <option value="conversation_updated">Conversation Updated</option>
              <option value="participant_added">Participant Added</option>
              <option value="participant_removed">Participant Removed</option>
              <option value="file_uploaded">File Uploaded</option>
              <option value="file_downloaded">File Downloaded</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Risk Level
            </label>
            <select
              value={filters.riskLevel || ''}
              onChange={(e) => setFilters({ ...filters, riskLevel: e.target.value || undefined })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">All Levels</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value || undefined })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value || undefined })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setFilters({})}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Clear Filters
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredLogs.length === 0 ? (
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No audit logs found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your filters or search term.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Risk Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP Address
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.action.replace(/_/g, ' ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.userId.firstName} {log.userId.lastName}
                      <span className="text-xs text-gray-500 ml-1">({log.userId.role})</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRiskLevelColor(log.riskLevel)}`}>
                        {log.riskLevel}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        log.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {log.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.ipAddress}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500">Total Logs</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900">{filteredLogs.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500">High Risk</div>
          <div className="mt-1 text-2xl font-semibold text-orange-600">
            {filteredLogs.filter(l => ['high', 'critical'].includes(l.riskLevel)).length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500">Failed Actions</div>
          <div className="mt-1 text-2xl font-semibold text-red-600">
            {filteredLogs.filter(l => !l.success).length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500">Success Rate</div>
          <div className="mt-1 text-2xl font-semibold text-green-600">
            {filteredLogs.length > 0
              ? Math.round((filteredLogs.filter(l => l.success).length / filteredLogs.length) * 100)
              : 0}%
          </div>
        </div>
      </div>
    </div>
  );
};
