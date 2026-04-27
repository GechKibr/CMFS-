import { useEffect, useState, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/api';
import AppointmentRequestForm from '../scheduling/AppointmentRequestForm';
import { ToastContainer } from '../UI/Toast';
import useToast from '../../hooks/useToast';

const STATUS_STYLES = {
  pending:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  rejected:  'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  completed: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  canceled:  'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
};

const StatusBadge = ({ status }) => (
  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[status] || STATUS_STYLES.pending}`}>
    {status}
  </span>
);

const AppointmentCard = ({ appt, onCancel, isDark }) => {
  const [canceling, setCanceling] = useState(false);

  const handleCancel = async () => {
    setCanceling(true);
    await onCancel(appt.id);
    setCanceling(false);
  };

  const slot = appt.availability_slot;
  const dateStr = appt.scheduled_at
    ? new Date(appt.scheduled_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : slot
      ? `${new Date(slot.available_date + 'T00:00:00').toLocaleDateString(undefined, { dateStyle: 'medium' })} · ${slot.start_time?.slice(0, 5)} – ${slot.end_time?.slice(0, 5)}`
      : '—';

  return (
    <div className={`rounded-xl border shadow-sm p-5 transition-all ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
              {appt.issue_type_display || appt.issue_type}
            </span>
            <StatusBadge status={appt.status} />
          </div>
          <p className={`mt-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{appt.description}</p>
          <div className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            <span>📅 {dateStr}</span>
            {appt.officer && <span>👤 {appt.officer.first_name} {appt.officer.last_name}</span>}
            {appt.location && <span>📍 {appt.location}</span>}
          </div>
          {appt.note && (
            <p className={`mt-2 text-xs italic ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{appt.note}</p>
          )}
          {appt.rejection_reason && (
            <p className="mt-2 text-xs text-red-500">Reason: {appt.rejection_reason}</p>
          )}
        </div>
        {appt.status === 'pending' && (
          <button
            disabled={canceling}
            onClick={handleCancel}
            className="shrink-0 px-3 py-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg disabled:opacity-50 transition-colors"
          >
            {canceling ? '...' : 'Cancel'}
          </button>
        )}
      </div>
    </div>
  );
};

const Appointments = () => {
  const { isDark } = useTheme();
  const { toasts, toast, removeToast } = useToast();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      const data = await apiService.getAppointments();
      setAppointments(data.results ?? data ?? []);
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSuccess = (created) => {
    setAppointments(prev => [created, ...prev]);
    setShowForm(false);
    toast.success('Your appointment request has been submitted and is awaiting officer review.', 'Request Submitted');
  };

  const handleCancel = async (id) => {
    try {
      const updated = await apiService.updateAppointmentStatus(id, 'canceled');
      setAppointments(prev => prev.map(a => a.id === id ? updated : a));
      toast.info('Your appointment has been canceled.', 'Appointment Canceled');
    } catch {
      toast.error('Failed to cancel appointment.', 'Error');
    }
  };

  const filtered = filter === 'all' ? appointments : appointments.filter(a => a.status === filter);
  const cardCls = `${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl border shadow-sm p-5`;

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Appointments</h2>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Request and track your appointments with officers
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + New Request
          </button>
        )}
      </div>

      {showForm && (
        <AppointmentRequestForm onSuccess={handleSuccess} onCancel={() => setShowForm(false)} />
      )}

      {!showForm && (
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'confirmed', 'rejected', 'completed', 'canceled'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors capitalize ${
                filter === s
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : isDark
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s}
              {s !== 'all' && appointments.filter(a => a.status === s).length > 0 && (
                <span className="ml-1 opacity-70">({appointments.filter(a => a.status === s).length})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {!showForm && (
        filtered.length === 0 ? (
          <div className={`${cardCls} text-center py-12`}>
            <div className="text-4xl mb-3">📅</div>
            <p className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {filter === 'all' ? 'No appointments yet' : `No ${filter} appointments`}
            </p>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              {filter === 'all' ? 'Click "New Request" to schedule an appointment with an officer.' : 'Try a different filter.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(appt => (
              <AppointmentCard key={appt.id} appt={appt} onCancel={handleCancel} isDark={isDark} />
            ))}
          </div>
        )
      )}
    </div>
  );
};

export default Appointments;
