import { useEffect, useState, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/api';
import { ToastContainer } from '../UI/Toast';
import useToast from '../../hooks/useToast';

const STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  completed: 'bg-gray-100 text-gray-700',
  canceled: 'bg-orange-100 text-orange-800',
};

const StatusBadge = ({ status }) => (
  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[status] || STATUS_STYLES.pending}`}>
    {status}
  </span>
);

const RejectModal = ({ isDark, onConfirm, onClose }) => {
  const [reason, setReason] = useState('');
  const inputCls = `mt-1 block w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
    }`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className={`w-full max-w-md rounded-2xl shadow-xl p-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <h3 className={`text-base font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Reject Appointment</h3>
        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Reason <span className="text-red-500">*</span>
        </label>
        <textarea
          rows={3}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Explain why you are rejecting this request..."
          className={inputCls}
        />
        <div className="flex gap-3 mt-4 justify-end">
          <button
            onClick={onClose}
            className={`px-4 py-2 text-sm rounded-lg border ${isDark ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-600'}`}
          >
            Cancel
          </button>
          <button
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason)}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
};

const SlotForm = ({ isDark, onCreated, onClose }) => {
  const [form, setForm] = useState({ available_date: '', start_time: '', end_time: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const addMinutes = (timeValue, minutes) => {
    if (!timeValue) return '';
    const [h, m] = timeValue.split(':').map(v => parseInt(v, 10));
    const total = (h * 60) + m + minutes;
    const endH = Math.floor(total / 60) % 24;
    const endM = total % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  };

  const applyDuration = (minutes) => {
    if (!form.start_time) {
      setError('Select a start time first.');
      return;
    }
    setError('');
    setForm(p => ({ ...p, end_time: addMinutes(p.start_time, minutes) }));
  };

  const inputCls = `mt-1 block w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
    }`;
  const labelCls = `block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.available_date || !form.start_time || !form.end_time) {
      setError('All fields are required.');
      return;
    }
    if (form.end_time <= form.start_time) {
      setError('End time must be after start time.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const created = await apiService.createAvailabilitySlot(form);
      onCreated(created);
    } catch (err) {
      const raw = err.message || '';
      const idx = raw.indexOf('{');
      const parsed = idx !== -1 ? (() => { try { return JSON.parse(raw.slice(idx)); } catch { return null; } })() : null;
      setError(parsed?.non_field_errors?.[0] || parsed?.detail || 'Failed to create slot.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`relative overflow-hidden rounded-2xl border p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className={`pointer-events-none absolute -right-24 -top-16 h-56 w-56 rounded-full blur-3xl ${isDark ? 'bg-blue-600/20' : 'bg-blue-500/20'}`} />
      <div className={`pointer-events-none absolute -left-16 -bottom-20 h-44 w-44 rounded-full blur-3xl ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-400/20'}`} />
      <div className="relative">
        <h3 className={`text-base font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Create Free Slot</h3>
        <p className={`text-xs mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Add a date and time window. Quick durations can help you fill your calendar faster.
        </p>
        {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Date</label>
            <input
              type="date"
              min={new Date().toISOString().split('T')[0]}
              value={form.available_date}
              onChange={e => setForm(p => ({ ...p, available_date: e.target.value }))}
              className={inputCls}
              required
            />
          </div>
          <div>
            <label className={labelCls}>Start Time</label>
            <input
              type="time"
              value={form.start_time}
              onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
              className={inputCls}
              required
            />
          </div>
          <div>
            <label className={labelCls}>End Time</label>
            <input
              type="time"
              value={form.end_time}
              onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))}
              className={inputCls}
              required
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Quick duration:</span>
          {[15, 30, 45, 60].map(minutes => (
            <button
              key={minutes}
              type="button"
              onClick={() => applyDuration(minutes)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}`}
            >
              {minutes} min
            </button>
          ))}
        </div>
        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 text-sm rounded-lg border ${isDark ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-600'}`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg"
          >
            {submitting ? 'Saving...' : 'Add Slot'}
          </button>
        </div>
      </div>
    </form>
  );
};

const OfficerSchedule = () => {
  const { isDark } = useTheme();
  const { toasts, toast, removeToast } = useToast();
  const [appointments, setAppointments] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [rejectingId, setRejectingId] = useState(null);
  const [filter, setFilter] = useState('pending');

  const load = useCallback(async () => {
    try {
      const [aptsData, slotsData] = await Promise.all([
        apiService.getAppointments(),
        apiService.getAvailabilitySlots(),
      ]);
      setAppointments(aptsData.results ?? aptsData ?? []);
      setSlots(slotsData.results ?? slotsData ?? []);
    } catch {
      setAppointments([]);
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleConfirm = async (id) => {
    try {
      const updated = await apiService.updateAppointmentStatus(id, 'confirmed');
      setAppointments(prev => prev.map(a => a.id === id ? updated : a));
      toast.success('Appointment confirmed.', 'Success');
    } catch {
      toast.error('Failed to confirm appointment.', 'Error');
    }
  };

  const handleReject = async (id, reason) => {
    try {
      const updated = await apiService.updateAppointmentStatus(id, 'rejected', { rejection_reason: reason });
      setAppointments(prev => prev.map(a => a.id === id ? updated : a));
      setRejectingId(null);
      toast.info('Appointment rejected.', 'Rejected');
    } catch {
      toast.error('Failed to reject appointment.', 'Error');
    }
  };

  const handleComplete = async (id) => {
    try {
      const updated = await apiService.updateAppointmentStatus(id, 'completed');
      setAppointments(prev => prev.map(a => a.id === id ? updated : a));
      toast.success('Appointment marked completed.', 'Completed');
    } catch {
      toast.error('Failed to mark appointment completed.', 'Error');
    }
  };

  const handleSlotCreated = (created) => {
    setSlots(prev => [created, ...prev]);
    setShowSlotForm(false);
    toast.success('Availability slot added.', 'Slot Created');
  };

  const filtered = appointments.filter(a => filter === 'all' || a.status === filter);
  const totalSlots = slots.length;
  const freeSlots = slots.filter(slot => slot.is_free).length;
  const bookedSlots = totalSlots - freeSlots;
  const cardCls = `${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl border shadow-sm p-5`;

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Availability Management */}
      <div className="space-y-4">
        <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gray-800/80 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Availability Studio</h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Create free slots and keep your day balanced.
              </p>
            </div>
            {!showSlotForm && (
              <button
                onClick={() => setShowSlotForm(true)}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                + Add Slot
              </button>
            )}
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Total slots', value: totalSlots },
              { label: 'Free slots', value: freeSlots },
              { label: 'Booked slots', value: bookedSlots },
            ].map(item => (
              <div key={item.label} className={`rounded-xl border px-4 py-3 ${isDark ? 'border-gray-700 bg-gray-900/40' : 'border-gray-200 bg-gray-50'}`}>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.label}</p>
                <p className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {showSlotForm && <SlotForm isDark={isDark} onCreated={handleSlotCreated} onClose={() => setShowSlotForm(false)} />}
        {slots.length === 0 ? (
          <div className={`${cardCls} text-center py-8`}>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No availability slots yet. Add one to accept appointments.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {slots.map(slot => (
              <div key={slot.id} className={cardCls}>
                <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {new Date(slot.available_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
                <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {slot.start_time?.slice(0, 5)} – {slot.end_time?.slice(0, 5)}
                </p>
                <p className={`text-xs mt-1 ${slot.is_free ? (isDark ? 'text-green-400' : 'text-green-600') : (isDark ? 'text-red-400' : 'text-red-600')}`}>
                  {slot.is_free ? '✓ Free' : '✗ Booked'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Appointment Requests */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Appointment Requests</h3>
        </div>
        <div className="flex gap-2 flex-wrap">
          {['pending', 'confirmed', 'completed', 'rejected', 'all'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors capitalize ${filter === s
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
        {filtered.length === 0 ? (
          <div className={`${cardCls} text-center py-8`}>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No {filter === 'all' ? 'appointments' : `${filter} appointments`}.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(appt => (
              <div key={appt.id} className={cardCls}>
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
                      <span>👤 {appt.requested_by?.first_name} {appt.requested_by?.last_name}</span>
                      {appt.availability_slot && (
                        <span>📅 {new Date(appt.availability_slot.available_date + 'T00:00:00').toLocaleDateString()} {appt.availability_slot.start_time?.slice(0, 5)}</span>
                      )}
                    </div>
                  </div>
                  {appt.status === 'pending' && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleConfirm(appt.id)}
                        className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setRejectingId(appt.id)}
                        className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {appt.status === 'confirmed' && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleComplete(appt.id)}
                        className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                      >
                        Complete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {rejectingId && (
        <RejectModal
          isDark={isDark}
          onConfirm={reason => handleReject(rejectingId, reason)}
          onClose={() => setRejectingId(null)}
        />
      )}
    </div>
  );
};

export default OfficerSchedule;
