import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import apiService from '../../services/api';
import { openRealtimeSocket } from '../../services/realtime';

const statusLabels = {
  pending: 'Pending',
  in_progress: 'In Progress',
  escalated: 'Escalated',
  resolved: 'Resolved',
  closed: 'Closed',
};

const statusColors = {
  pending: 'bg-yellow-500',
  in_progress: 'bg-blue-500',
  escalated: 'bg-orange-500',
  resolved: 'bg-green-500',
  closed: 'bg-gray-500',
};

const normalizeSummary = (data) => ({
  scope: data?.scope || 'admin',
  total: data?.total || 0,
  status_counts: data?.status_counts || {},
  daily_trend: Array.isArray(data?.daily_trend) ? data.daily_trend : [],
  category_breakdown: Array.isArray(data?.category_breakdown) ? data.category_breakdown : [],
  recent_complaints: Array.isArray(data?.recent_complaints) ? data.recent_complaints : [],
  admin_dashboard: data?.admin_dashboard || null,
});

const buildSummaryFromComplaints = (complaints = [], scope = 'officer') => {
  const normalizedList = Array.isArray(complaints) ? complaints : [];
  const statusCounts = Object.keys(statusLabels).reduce((accumulator, key) => {
    accumulator[key] = 0;
    return accumulator;
  }, {});

  normalizedList.forEach((item) => {
    const status = item?.status;
    if (status && Object.prototype.hasOwnProperty.call(statusCounts, status)) {
      statusCounts[status] += 1;
    }
  });

  const today = new Date();
  const dailyTrend = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    const dayKey = day.toISOString().slice(0, 10);

    const dayCount = normalizedList.filter((item) => {
      const createdAt = item?.created_at ? new Date(item.created_at) : null;
      if (!createdAt || Number.isNaN(createdAt.getTime())) return false;
      return createdAt.toISOString().slice(0, 10) === dayKey;
    }).length;

    dailyTrend.push({
      date: dayKey,
      label: day.toLocaleDateString(undefined, { month: 'short', day: '2-digit' }),
      count: dayCount,
    });
  }

  const categoryCountMap = normalizedList.reduce((accumulator, item) => {
    const label = item?.category?.office_name || item?.category?.name || 'Uncategorized';
    accumulator[label] = (accumulator[label] || 0) + 1;
    return accumulator;
  }, {});

  const categoryBreakdown = Object.entries(categoryCountMap)
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 6);

  const recentComplaints = normalizedList
    .slice()
    .sort((left, right) => new Date(right.updated_at || right.created_at) - new Date(left.updated_at || left.created_at))
    .slice(0, 5)
    .map((item) => ({
      complaint_id: item.complaint_id,
      title: item.title,
      status: item.status,
      category: item?.category?.office_name || item?.category?.name || 'Uncategorized',
      created_at: item.created_at,
      updated_at: item.updated_at || item.created_at,
    }));

  return {
    scope,
    total: normalizedList.length,
    status_counts: statusCounts,
    daily_trend: dailyTrend,
    category_breakdown: categoryBreakdown,
    recent_complaints: recentComplaints,
  };
};

const ComplaintAnalyticsPanel = ({
  title = 'Complaint Analytics',
  subtitle = '',
  accent = 'blue',
  analyticsScope = null,
  officerId = null,
  _recentComplaintLinkBuilder = null,
}) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connectionState, setConnectionState] = useState('connecting');
  const socketRef = useRef(null);
  const timerRef = useRef(null);

  const loadAnalytics = useCallback(async () => {
    try {
      const hasScopedRequest = Boolean(analyticsScope || officerId);
      const requestOptions = {};
      if (analyticsScope) requestOptions.scope = analyticsScope;
      if (officerId) requestOptions.officerId = officerId;

      let data;
      try {
        data = await apiService.getComplaintAnalytics(requestOptions);
      } catch (scopedError) {
        const shouldFallback = hasScopedRequest && /HTTP 400|HTTP 404/i.test(scopedError?.message || '');
        if (!shouldFallback) {
          throw scopedError;
        }
        data = await apiService.getComplaintAnalytics();
      }

      const normalized = normalizeSummary(data);
      const hasNoCounts = Object.values(normalized.status_counts || {}).every((count) => Number(count || 0) === 0);

      if (analyticsScope === 'officer' && normalized.total === 0 && hasNoCounts) {
        const complaintsData = await apiService.getComplaints();
        const complaintList = Array.isArray(complaintsData?.results)
          ? complaintsData.results
          : Array.isArray(complaintsData)
            ? complaintsData
            : [];
        setSummary(buildSummaryFromComplaints(complaintList, 'officer'));
      } else {
        setSummary(normalized);
      }
      setError('');
    } catch (err) {
      if (analyticsScope === 'officer') {
        try {
          const complaintsData = await apiService.getComplaints();
          const complaintList = Array.isArray(complaintsData?.results)
            ? complaintsData.results
            : Array.isArray(complaintsData)
              ? complaintsData
              : [];
          setSummary(buildSummaryFromComplaints(complaintList, 'officer'));
          setError('');
        } catch {
          setError(err.message || 'Failed to load complaint analytics');
          setSummary(null);
        }
      } else {
        setError(err.message || 'Failed to load complaint analytics');
        setSummary(null);
      }
    } finally {
      setLoading(false);
    }
  }, [analyticsScope, officerId]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    loadAnalytics();

    let socketInstance = null;
    (async () => {
      const maybeSocket = await openRealtimeSocket('/ws/analytics/', {
        onOpen: () => {
          if (mounted) setConnectionState('live');
        },
        onMessage: (event) => {
          if (!mounted) return;
          try {
            const payload = JSON.parse(event.data);
            if (payload.type?.startsWith('analytics.')) {
              loadAnalytics();
            }
          } catch {
            loadAnalytics();
          }
        },
        onClose: () => {
          if (mounted) setConnectionState('polling');
        },
        onError: () => {
          if (mounted) setConnectionState('polling');
        },
      });

      socketInstance = maybeSocket;
      socketRef.current = socketInstance;
    })();
    timerRef.current = setInterval(loadAnalytics, 30000);

    return () => {
      mounted = false;
      if (socketRef.current) socketRef.current.close();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loadAnalytics]);

  const safeSummary = useMemo(() => summary || normalizeSummary({}), [summary]);
  const adminDashboard = safeSummary?.admin_dashboard || null;
  const adminSummary = adminDashboard?.summary || {};
  const statusDistribution = Array.isArray(adminDashboard?.status_distribution)
    ? adminDashboard.status_distribution
    : [];
  const collegePerformance = Array.isArray(adminDashboard?.college_performance)
    ? adminDashboard.college_performance
    : [];
  const departmentPerformance = Array.isArray(adminDashboard?.department_performance)
    ? adminDashboard.department_performance
    : [];
  const campusPerformance = Array.isArray(adminDashboard?.campus_performance)
    ? adminDashboard.campus_performance
    : [];
  const staffPerformance = Array.isArray(adminDashboard?.top_staff)
    ? adminDashboard.top_staff
    : [];
  const adminDailyTrend = useMemo(
    () => (Array.isArray(adminDashboard?.daily_trend) ? adminDashboard.daily_trend : []),
    [adminDashboard],
  );
  const adminMonthlyTrend = useMemo(
    () => (Array.isArray(adminDashboard?.monthly_trend) ? adminDashboard.monthly_trend : []),
    [adminDashboard],
  );
  const adminCategoryStats = Array.isArray(adminDashboard?.category_statistics) ? adminDashboard.category_statistics : [];
  const adminTransparency = adminDashboard?.transparency || null;
  const adminSla = adminDashboard?.sla || null;

  const trendMax = useMemo(() => {
    if (!safeSummary?.daily_trend?.length) return 0;
    return Math.max(...safeSummary.daily_trend.map((item) => item.count), 1);
  }, [safeSummary]);

  const adminTrendMax = useMemo(() => {
    if (!adminDailyTrend.length) return 0;
    return Math.max(...adminDailyTrend.map((item) => item.count), 1);
  }, [adminDailyTrend]);

  const statusTotal = statusDistribution.reduce((sum, item) => sum + Number(item.count || 0), 0) || 1;
  const donutSegments = statusDistribution.map((item) => {
    const accentClass = adminDashboard?.color_map?.[item.key] || statusColors[item.key] || 'bg-gray-500';
    const colorMap = {
      'bg-yellow-500': '#EAB308',
      'bg-blue-500': '#3B82F6',
      'bg-orange-500': '#F97316',
      'bg-green-500': '#22C55E',
      'bg-red-500': '#EF4444',
      'bg-gray-500': '#6B7280',
    };

    return {
      ...item,
      color: colorMap[accentClass] || '#3B82F6',
      percent: (Number(item.count || 0) / statusTotal) * 100,
    };
  });

  const statusEntries = Object.keys(statusLabels).map((key) => ({
    key,
    label: statusLabels[key],
    count: safeSummary?.status_counts?.[key] || 0,
    color: statusColors[key] || 'bg-gray-500',
  }));

  if (loading && !summary) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="text-sm text-gray-500">Loading complaint analytics...</div>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${accent === 'emerald' ? 'text-emerald-600' : 'text-blue-600'}`}>
            {safeSummary?.scope === 'officer' ? 'Assigned Complaints' : 'Campus-wide Complaints'}
          </p>
          <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
        </div>
        <div className={`text-sm ${connectionState === 'live' ? 'text-green-600' : 'text-amber-600'}`}>
          {connectionState === 'live' ? 'Live updates on' : 'Live updates syncing'}
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <MetricCard label="Total" value={safeSummary?.total || 0} accentClass={accent === 'emerald' ? 'bg-emerald-600' : 'bg-blue-600'} />
        {statusEntries.map((entry) => (
          <MetricCard key={entry.key} label={entry.label} value={entry.count} accentClass={entry.color} />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Daily Trend</h4>
            <span className="text-xs text-gray-500">Last 7 days</span>
          </div>
          <div className="flex h-48 items-end gap-2">
            {(safeSummary?.daily_trend || []).map((item) => (
              <div key={item.date} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-36 w-full items-end">
                  <div
                    className={`w-full rounded-t-lg ${accent === 'emerald' ? 'bg-emerald-500' : 'bg-blue-500'}`}
                    style={{ height: `${(item.count / trendMax) * 100}%`, minHeight: item.count > 0 ? '10px' : '2px' }}
                  />
                </div>
                <span className="text-[11px] text-gray-500">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Category Breakdown</h4>
            <span className="text-xs text-gray-500">Top categories</span>
          </div>
          <div className="space-y-3">
            {(safeSummary?.category_breakdown || []).length === 0 ? (
              <p className="text-sm text-gray-500">No category data yet.</p>
            ) : (
              safeSummary.category_breakdown.map((item) => (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">{item.label}</span>
                    <span className="text-gray-500">{item.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={`h-full rounded-full ${accent === 'emerald' ? 'bg-emerald-500' : 'bg-blue-500'}`}
                      style={{ width: `${Math.max((item.count / Math.max(safeSummary.total || 1, 1)) * 100, 8)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {adminDashboard && (
        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>

                <h4 className="mt-1 text-xl font-bold text-gray-900">System-wide statistics</h4>
              </div>
              <p className="text-sm text-gray-500">Realtime metrics for complaints, staff, SLA, and transparency.</p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
              {[

                ['Resolution rate', `${adminSummary.complaint_resolution_rate ?? 0}%`],
                ['Avg resolution', adminSummary.average_resolution_time_label || `${adminSummary.average_resolution_time_hours ?? 0} hrs`],
                ['Students', adminSummary.total_registered_students ?? 0],
                ['Active staff', adminSummary.total_active_staff ?? 0],
                ['Today', adminSummary.complaints_submitted_today ?? 0],
                ['This month', adminSummary.complaints_this_month ?? 0],
                ['This year', adminSummary.complaints_this_year ?? 0],
                ['SLA compliance', `${adminSummary.sla_compliance_rate ?? 0}%`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
                  <p className="mt-2 text-2xl font-black text-gray-900">{value}</p>
                  {label === 'Resolution rate' && (
                    <p className="mt-2 text-xs leading-5 text-gray-500">
                      This is the share of all complaints that are already marked resolved or closed.
                      Formula: resolved complaints ÷ total complaints.
                    </p>
                  )}
                  {label === 'Avg resolution' && (
                    <p className="mt-2 text-xs leading-5 text-gray-500">
                      This shows the average time it takes to resolve a complaint, measured from submission to final resolution.
                      If available, the dashboard shows a human-friendly label like hours or days.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-bold text-gray-900">Complaint status distribution</h4>
                <span className="text-xs text-gray-500">Pie / Donut</span>
              </div>
              <div className="mt-5 flex flex-col items-center gap-6 lg:flex-row lg:items-start">
                <div
                  className="h-48 w-48 rounded-full"
                  style={{
                    background: donutSegments.length
                      ? `conic-gradient(${donutSegments.map((segment, index) => `${segment.color} ${donutSegments.slice(0, index).reduce((sum, item) => sum + item.percent, 0)}% ${donutSegments.slice(0, index + 1).reduce((sum, item) => sum + item.percent, 0)}%`).join(', ')})`
                      : '#E5E7EB',
                  }}
                >
                  <div className="mx-auto mt-12 flex h-24 w-24 items-center justify-center rounded-full bg-white text-center shadow-inner">
                    <div>
                      <div className="text-lg font-black text-gray-900">{statusTotal === 1 ? 0 : adminSummary.total_complaints ?? 0}</div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Total</div>
                    </div>
                  </div>
                </div>
                <div className="grid flex-1 gap-3">
                  {donutSegments.map((segment) => (
                    <div key={segment.key} className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2">
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
                        <span className="text-sm font-medium text-gray-700">{segment.label}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-500">{segment.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-bold text-gray-900">Monthly complaint trend</h4>
                <span className="text-xs text-gray-500">Last 30 days</span>
              </div>
              <div className="mt-5 flex h-56 items-end gap-2 overflow-x-auto pb-2">
                {(adminDailyTrend.length ? adminDailyTrend : safeSummary.daily_trend).map((item) => {
                  const height = Math.max(8, Math.min(100, ((item.count || item.complaints || 0) / (adminTrendMax || trendMax || 1)) * 100));
                  return (
                    <div key={item.date || item.label} className="flex min-w-[24px] flex-1 flex-col items-center gap-2">
                      <div className="flex h-44 w-full items-end">
                        <div className={`w-full rounded-t-lg ${accent === 'emerald' ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ height: `${height}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-500">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-bold text-gray-900">College performance</h4>
                <span className="text-xs text-gray-500">Resolution rank</span>
              </div>
              <div className="mt-4 space-y-3">
                {(collegePerformance.length ? collegePerformance : []).slice(0, 6).map((item) => (
                  <div key={item.label} className="rounded-xl border border-gray-200 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-800">{item.label}</span>
                      <span className="text-gray-500">{item.resolution_rate}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(item.resolution_rate || 0, 8)}%` }} />
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-500">
                      <span>Total: {item.total}</span>
                      <span>Resolved: {item.resolved}</span>
                      <span>Top: {item.most_common_category}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-bold text-gray-900">Campus comparison</h4>
                <span className="text-xs text-gray-500">Fastest vs most active</span>
              </div>
              <div className="mt-4 space-y-3">
                {(campusPerformance.length ? campusPerformance : []).slice(0, 6).map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2">
                    <div>
                      <p className="font-medium text-gray-800">{item.label}</p>
                      <p className="text-xs text-gray-500">Total {item.total} | Avg time {item.average_resolution_time} hrs</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold text-gray-900">{item.resolution_rate}%</p>
                      <p className="text-xs text-gray-500">Resolved</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h4 className="text-lg font-bold text-gray-900">Department performance</h4>
              <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Resolution</th>
                      <th className="px-4 py-3">First response</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {(departmentPerformance.length ? departmentPerformance : []).slice(0, 6).map((item) => (
                      <tr key={item.label}>
                        <td className="px-4 py-3 font-medium text-gray-800">{item.label}</td>
                        <td className="px-4 py-3 text-gray-600">{item.total}</td>
                        <td className="px-4 py-3 text-gray-600">{item.resolution_rate}%</td>
                        <td className="px-4 py-3 text-gray-600">{item.first_response_time} hrs</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h4 className="text-lg font-bold text-gray-900">Top staff performance</h4>
              <div className="mt-4 space-y-3">
                {(staffPerformance.length ? staffPerformance : []).slice(0, 5).map((item, index) => (
                  <div key={item.label} className="rounded-xl border border-gray-200 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800">#{index + 1} {item.label}</p>
                        <p className="text-xs text-gray-500">Overdue {item.overdue} | Escalated {item.escalated}</p>
                      </div>
                      <div className="text-right text-sm text-gray-600">
                        <p>Resolution {item.resolution_rate}%</p>
                        <p>Avg {item.average_resolution_time} hrs</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-gray-900">Monthly comparison</h4>
              <span className="text-xs text-gray-500">Year view</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {adminMonthlyTrend.slice(-6).map((item) => (
                <div key={item.label} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">{item.label}</p>
                  <div className="mt-2 h-24 rounded-lg bg-white p-2">
                    <div
                      className={`h-full rounded-lg ${accent === 'emerald' ? 'bg-emerald-500' : 'bg-blue-500'}`}
                      style={{ height: `${Math.max(10, Math.min(100, (item.count || 0) * 15))}%` }}
                    />
                  </div>
                  <p className="mt-2 text-lg font-black text-gray-900">{item.count}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h4 className="text-lg font-bold text-gray-900">SLA monitoring</h4>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  ['Within deadline', adminSla?.within_deadline ?? 0],
                  ['Overdue', adminSla?.overdue ?? 0],
                  ['Compliance', `${adminSla?.compliance_rate ?? 0}%`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
                    <p className="mt-2 text-2xl font-black text-gray-900">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h4 className="text-lg font-bold text-gray-900">Transparency & accountability</h4>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ['Anonymous', adminTransparency?.anonymous ?? adminSummary.anonymous_complaints ?? 0],
                  ['Identified', adminTransparency?.identified ?? adminSummary.identified_complaints ?? 0],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
                    <p className="mt-2 text-2xl font-black text-gray-900">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-gray-900">Complaint categories</h4>
              <span className="text-xs text-gray-500">Most common</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {adminCategoryStats.slice(0, 8).map((item) => (
                <div key={item.label} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-800">{item.label}</p>
                  <p className="mt-2 text-2xl font-black text-gray-900">{item.count}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

const MetricCard = ({ label, value, accentClass }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="flex items-center gap-3">
      <span className={`h-3 w-3 rounded-full ${accentClass}`} />
      <div>
        <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
      </div>
    </div>
  </div>
);

export default ComplaintAnalyticsPanel;
