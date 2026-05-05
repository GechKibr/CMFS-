import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/api';
import { ToastContainer } from '../UI/Toast';
import useToast from '../../hooks/useToast';

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const VIEW_START_HOUR = 8;
const VIEW_END_HOUR = 18;
const SLOT_STEP_MINUTES = 15;
const ROW_HEIGHT = 24;
const TIME_GUTTER_WIDTH = 84;

const SLOT_STYLE = {
  available: {
    chip: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    block: 'bg-emerald-500/15 border-emerald-400 text-emerald-900',
    dot: 'bg-emerald-500',
    label: 'Available',
  },
  booked: {
    chip: 'bg-red-100 text-red-800 border-red-200',
    block: 'bg-red-500/15 border-red-400 text-red-900',
    dot: 'bg-red-500',
    label: 'Booked',
  },
  pending: {
    chip: 'bg-amber-100 text-amber-800 border-amber-200',
    block: 'bg-amber-500/15 border-amber-400 text-amber-900',
    dot: 'bg-amber-500',
    label: 'Pending',
  },
};

const APPOINTMENT_STATUS_STYLE = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  completed: 'bg-blue-100 text-blue-800 border-blue-200',
  canceled: 'bg-gray-100 text-gray-700 border-gray-200',
};

const pad = (value) => String(value).padStart(2, '0');
const dateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const parseDateKey = (value) => new Date(`${value}T00:00:00`);
const isSameDay = (first, second) => dateKey(first) === dateKey(second);
const startOfWeek = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date;
};
const addDays = (value, days) => {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
};
const toMinutes = (timeValue) => {
  if (!timeValue) return 0;
  const [hours, minutes] = timeValue.split(':').map(Number);
  return (hours * 60) + minutes;
};
const fromMinutes = (minutes) => {
  const normalized = ((Math.round(minutes / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES) + 24 * 60) % (24 * 60);
  return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`;
};
const formatTime = (timeValue) => new Date(`1970-01-01T${timeValue || '00:00'}:00`).toLocaleTimeString([], {
  hour: '2-digit',
  minute: '2-digit',
});
const formatShortDate = (value) => new Date(value).toLocaleDateString(undefined, {
  month: 'short',
  day: 'numeric',
});
const formatLongDate = (value) => new Date(value).toLocaleDateString(undefined, {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
});
const normalizeArray = (response) => response?.results ?? response ?? [];
const viewStartMinutes = VIEW_START_HOUR * 60;
const viewEndMinutes = VIEW_END_HOUR * 60;
const rowsCount = (viewEndMinutes - viewStartMinutes) / SLOT_STEP_MINUTES;

const buildWeekDays = (anchorDate) => {
  const firstDay = startOfWeek(anchorDate);
  return Array.from({ length: 7 }, (_, index) => addDays(firstDay, index));
};

const buildMonthDays = (anchorDate) => {
  const firstOfMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const gridStart = startOfWeek(firstOfMonth);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
};

const slotStatusFromAppointment = (appointment) => {
  if (!appointment) return 'available';
  if (appointment.status === 'pending') return 'pending';
  if (appointment.status === 'confirmed' || appointment.status === 'completed') return 'booked';
  return 'available';
};


const buildDraftFromSelection = ({ date, startMinutes, endMinutes, notes = '' }) => ({
  available_date: dateKey(date),
  start_time: fromMinutes(startMinutes),
  end_time: fromMinutes(endMinutes),
  notes,
  repeatWeekly: false,
  recurrenceWeekdays: [new Date(date).getDay() || 7],
  recurrenceEndDate: '',
});

const buildRecurringDates = (draft) => {
  if (!draft.repeatWeekly) return [draft.available_date];
  if (!draft.recurrenceEndDate) return [];

  const start = parseDateKey(draft.available_date);
  const end = parseDateKey(draft.recurrenceEndDate);
  if (Number.isNaN(end.getTime()) || end < start) return [];

  const selectedDays = new Set((draft.recurrenceWeekdays || []).map(Number));
  const dates = [];
  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    const dayValue = cursor.getDay() || 7;
    if (selectedDays.has(dayValue)) {
      dates.push(dateKey(cursor));
    }
  }
  return [...new Set(dates)];
};

const overlaps = (candidate, slot) => {
  if (candidate.available_date !== slot.available_date) return false;
  return candidate.start_minutes < slot.end_minutes && candidate.end_minutes > slot.start_minutes;
};

const SlotModal = ({
  isDark,
  mode,
  draft,
  slots,
  onClose,
  onSubmit,
}) => {
  const todayKey = dateKey(new Date());
  const [form, setForm] = useState(draft);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(draft);
    setError('');
  }, [draft]);

  const validate = () => {
    if (!form.available_date || !form.start_time || !form.end_time) {
      return 'Date, start time, and end time are required.';
    }
    if (form.end_time <= form.start_time) {
      return 'End time must be after start time.';
    }
    if (form.available_date < todayKey) {
      return 'Past dates are disabled.';
    }
    if (form.available_date === todayKey) {
      const now = new Date();
      const currentMinutes = (now.getHours() * 60) + now.getMinutes();
      if (toMinutes(form.start_time) < currentMinutes) {
        return 'Past time selection is disabled.';
      }
    }

    if (form.repeatWeekly) {
      if (!form.recurrenceEndDate) {
        return 'Set an end date for the recurring slot.';
      }
      if (!form.recurrenceWeekdays || form.recurrenceWeekdays.length === 0) {
        return 'Select at least one weekday for recurrence.';
      }
    }

    const dates = buildRecurringDates(form);
    if (form.repeatWeekly && dates.length === 0) {
      return 'No recurring dates match the selected weekdays and end date.';
    }

    const candidateSlots = dates.map((slotDate) => ({
      available_date: slotDate,
      start_minutes: toMinutes(form.start_time),
      end_minutes: toMinutes(form.end_time),
    }));

    for (const candidate of candidateSlots) {
      const conflict = slots.find((slot) => {
        if (!slot.is_active) return false;
        if (mode === 'edit' && slot.id === form.id) return false;
        return overlaps(candidate, slot);
      });
      if (conflict) {
        return 'This time overlaps with an existing slot.';
      }
    }

    return '';
  };

  const submit = async (event) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err?.message || 'Failed to save slot.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = `mt-1 block w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'}`;
  const labelCls = `block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
      <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border p-5 shadow-2xl ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {mode === 'edit' ? 'Edit Slot' : 'Create Slot'}
            </h3>
            <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {mode === 'edit'
                ? 'Adjust the selected slot time, date, or notes.'
                : 'Drag in the calendar or use the quick form to create availability.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-xl px-3 py-2 text-sm ${isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Close
          </button>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>Date</label>
              <input
                type="date"
                min={todayKey}
                value={form.available_date}
                onChange={(event) => setForm((current) => ({ ...current, available_date: event.target.value }))}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Start Time</label>
              <input
                type="time"
                step={SLOT_STEP_MINUTES * 60}
                value={form.start_time}
                onChange={(event) => setForm((current) => ({ ...current, start_time: event.target.value }))}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className={labelCls}>End Time</label>
              <input
                type="time"
                step={SLOT_STEP_MINUTES * 60}
                value={form.end_time}
                onChange={(event) => setForm((current) => ({ ...current, end_time: event.target.value }))}
                className={inputCls}
                required
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              className={inputCls}
              placeholder="Optional notes for this slot"
            />
          </div>

          {mode !== 'edit' && (
            <div className={`rounded-2xl border p-4 ${isDark ? 'border-gray-700 bg-gray-800/60' : 'border-gray-100 bg-gray-50'}`}>
              <div className="flex items-center gap-3">
                <input
                  id="repeatWeekly"
                  type="checkbox"
                  checked={form.repeatWeekly}
                  onChange={(event) => setForm((current) => ({ ...current, repeatWeekly: event.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="repeatWeekly" className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                  Repeat weekly
                </label>
              </div>

              {form.repeatWeekly && (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className={`text-xs font-medium uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Repeat on
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {WEEKDAY_NAMES.map((dayName, index) => {
                        const dayValue = index + 1;
                        const checked = form.recurrenceWeekdays.includes(dayValue);
                        return (
                          <button
                            key={dayName}
                            type="button"
                            onClick={() => setForm((current) => {
                              const exists = current.recurrenceWeekdays.includes(dayValue);
                              return {
                                ...current,
                                recurrenceWeekdays: exists
                                  ? current.recurrenceWeekdays.filter((day) => day !== dayValue)
                                  : [...current.recurrenceWeekdays, dayValue],
                              };
                            })}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${checked
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : isDark
                                ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                                : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                              }`}
                          >
                            {dayName}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className={labelCls}>End Date</label>
                      <input
                        type="date"
                        min={form.available_date}
                        value={form.recurrenceEndDate}
                        onChange={(event) => setForm((current) => ({ ...current, recurrenceEndDate: event.target.value }))}
                        className={inputCls}
                      />
                    </div>
                    <div className={`rounded-xl border px-4 py-3 text-sm ${isDark ? 'border-gray-700 bg-gray-900/60 text-gray-300' : 'border-gray-200 bg-white text-gray-600'}`}>
                      The calendar will create one slot per matching weekday until the selected end date.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className={`rounded-xl border px-4 py-2 text-sm ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving...' : mode === 'edit' ? 'Update Slot' : 'Create Slot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const SlotDetails = ({ isDark, slot, appointment, onEdit, onDelete }) => {
  if (!slot) {
    return (
      <div className={`rounded-3xl border p-5 ${isDark ? 'border-gray-700 bg-gray-900/80' : 'border-gray-200 bg-white'}`}>
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Select a slot to see details, notes, and actions.</p>
      </div>
    );
  }

  const status = slot.status || slotStatusFromAppointment(appointment);
  const style = SLOT_STYLE[status];
  const duration = Math.max(0, toMinutes(slot.end_time) - toMinutes(slot.start_time));

  return (
    <div className={`rounded-3xl border p-5 ${isDark ? 'border-gray-700 bg-gray-900/80' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.3em] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Slot Details</p>
          <h4 className={`mt-1 text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatLongDate(slot.available_date)}</h4>
          <p className={`mt-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
          </p>
        </div>
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${style.chip}`}>{style.label}</span>
      </div>

      {slot.notes && (
        <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${isDark ? 'border-gray-700 bg-gray-800/70 text-gray-300' : 'border-gray-200 bg-gray-50 text-gray-700'}`}>
          {slot.notes}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className={`rounded-xl border px-3 py-2 ${isDark ? 'border-gray-700 bg-gray-800/50 text-gray-300' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
          <p className="text-xs uppercase tracking-wide opacity-75">Duration</p>
          <p className="mt-1 font-semibold">{duration} min</p>
        </div>
        <div className={`rounded-xl border px-3 py-2 ${isDark ? 'border-gray-700 bg-gray-800/50 text-gray-300' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
          <p className="text-xs uppercase tracking-wide opacity-75">Status</p>
          <p className="mt-1 font-semibold">{style.label}</p>
        </div>
      </div>

      {appointment && (
        <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${isDark ? 'border-gray-700 bg-gray-800/60 text-gray-300' : 'border-gray-200 bg-white text-gray-700'}`}>
          <p className="text-xs uppercase tracking-wide opacity-75">Appointment</p>
          <p className="mt-1 font-semibold capitalize">{appointment.status}</p>
          <p className="mt-1 opacity-90">{appointment.description}</p>
          <p className="mt-1 text-xs opacity-75">
            Requester: {appointment.requested_by?.first_name || appointment.requested_by?.username || 'User'} {appointment.requested_by?.last_name || ''}
          </p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Delete
        </button>
      </div>
    </div>
  );
};

const RejectReasonModal = ({ isDark, reason, setReason, onClose, onSubmit, saving }) => {
  const inputCls = `mt-1 block w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 ${isDark ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'}`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
      <div className={`w-full max-w-md rounded-3xl border p-5 shadow-2xl ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Reject Appointment</h3>
        <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Please provide a reason for rejection.</p>
        <label className={`mt-4 block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Reason</label>
        <textarea
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className={inputCls}
          placeholder="Reason is required"
        />
        <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className={`rounded-xl border px-4 py-2 text-sm ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!reason.trim() || saving}
            onClick={onSubmit}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Submitting...' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
};

const OfficerSchedule = () => {
  const { isDark } = useTheme();
  const { toasts, toast, removeToast } = useToast();
  const weekScrollRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [slots, setSlots] = useState([]);
  const [viewMode, setViewMode] = useState('week');
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [modalMode, setModalMode] = useState(null);
  const [modalDraft, setModalDraft] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [appointmentFilter, setAppointmentFilter] = useState('pending');
  const [rejectTargetId, setRejectTargetId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const toastRef = useRef(toast);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const load = useCallback(async () => {
    try {
      const [appointmentsRes, slotsRes] = await Promise.all([
        apiService.getAppointments(),
        apiService.getAvailabilitySlots(),
      ]);
      setAppointments(normalizeArray(appointmentsRes));
      setSlots(normalizeArray(slotsRes));
    } catch (error) {
      console.error(error);
      toastRef.current.error('Failed to load calendar data.', 'Calendar');
      setAppointments([]);
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const appointmentMap = useMemo(() => {
    const map = new Map();
    appointments.forEach((appointment) => {
      const slotId = appointment?.availability_slot?.id;
      if (!slotId) return;
      const current = map.get(slotId);
      if (!current || (appointment.status === 'pending' && current.status !== 'pending')) {
        map.set(slotId, appointment);
      }
    });
    return map;
  }, [appointments]);

  const weekDays = useMemo(() => buildWeekDays(anchorDate), [anchorDate]);
  const monthDays = useMemo(() => buildMonthDays(anchorDate), [anchorDate]);
  const slotsByDay = useMemo(() => {
    const map = new Map();
    slots.forEach((slot) => {
      const appointment = appointmentMap.get(slot.id);
      const status = slotStatusFromAppointment(appointment);
      const entry = {
        ...slot,
        status,
        appointment,
        start_minutes: toMinutes(slot.start_time),
        end_minutes: toMinutes(slot.end_time),
      };
      if (!map.has(slot.available_date)) {
        map.set(slot.available_date, []);
      }
      map.get(slot.available_date).push(entry);
    });
    map.forEach((daySlots) => daySlots.sort((a, b) => a.start_minutes - b.start_minutes));
    return map;
  }, [slots, appointmentMap]);

  const stats = useMemo(() => {
    const sourceDays = viewMode === 'month' ? monthDays : weekDays;
    return sourceDays.reduce((acc, day) => {
      const daySlots = slotsByDay.get(dateKey(day)) || [];
      acc.total += daySlots.length;
      acc.available += daySlots.filter((slot) => slot.status === 'available').length;
      acc.booked += daySlots.filter((slot) => slot.status === 'booked').length;
      acc.pending += daySlots.filter((slot) => slot.status === 'pending').length;
      return acc;
    }, { total: 0, available: 0, booked: 0, pending: 0 });
  }, [monthDays, weekDays, slotsByDay, viewMode]);

  const userAppointments = useMemo(() => {
    return [...appointments]
      .filter((item) => {
        const role = item?.requested_by?.role;
        if (!role) return true;
        return role !== 'officer' && role !== 'admin';
      })
      .sort((first, second) => new Date(second.created_at || 0) - new Date(first.created_at || 0));
  }, [appointments]);

  const visibleAppointments = useMemo(() => {
    if (appointmentFilter === 'all') return userAppointments;
    return userAppointments.filter((item) => item.status === appointmentFilter);
  }, [appointmentFilter, userAppointments]);

  const selectedDay = useMemo(() => (
    selectedSlot ? parseDateKey(selectedSlot.available_date) : anchorDate
  ), [anchorDate, selectedSlot]);

  const selectedDaySlots = useMemo(() => slotsByDay.get(dateKey(selectedDay)) || [], [selectedDay, slotsByDay]);

  useEffect(() => {
    if (viewMode !== 'week' || !weekScrollRef.current) return;
    const now = new Date();
    if (!weekDays.some((day) => isSameDay(day, now))) return;

    const currentMinutes = (now.getHours() * 60) + now.getMinutes();
    if (currentMinutes < viewStartMinutes || currentMinutes > viewEndMinutes) return;

    const targetRow = ((currentMinutes - viewStartMinutes) / SLOT_STEP_MINUTES) * ROW_HEIGHT;
    weekScrollRef.current.scrollTo({ top: Math.max(0, targetRow - 120), behavior: 'smooth' });
  }, [viewMode, weekDays]);

  useEffect(() => {
    if (!dragState) return undefined;
    const handleMouseUp = () => {
      setDragState((current) => {
        if (!current) return null;
        current.finalize?.();
        return null;
      });
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [dragState]);

  const closeModal = () => {
    setModalMode(null);
    setModalDraft(null);
  };

  const openCreateModal = (draft) => {
    setModalMode('create');
    setModalDraft(draft);
    setSelectedSlot(null);
  };

  const openEditModal = (slot) => {
    setModalMode('edit');
    setModalDraft({
      id: slot.id,
      available_date: slot.available_date,
      start_time: slot.start_time,
      end_time: slot.end_time,
      notes: slot.notes || '',
      repeatWeekly: false,
      recurrenceWeekdays: [new Date(`${slot.available_date}T00:00:00`).getDay() || 7],
      recurrenceEndDate: '',
    });
  };

  const submitDraft = async (draft) => {
    setLoadingAction(true);
    try {
      if (modalMode === 'edit') {
        await apiService.updateAvailabilitySlot(draft.id, {
          available_date: draft.available_date,
          start_time: draft.start_time,
          end_time: draft.end_time,
          notes: draft.notes || '',
          is_active: true,
        });
        toast.success('Slot updated.', 'Calendar');
      } else {
        const dates = buildRecurringDates(draft);
        const created = [];
        for (const occurrenceDate of dates) {
          const payload = {
            available_date: occurrenceDate,
            start_time: draft.start_time,
            end_time: draft.end_time,
            notes: draft.notes || '',
            is_active: true,
          };
          created.push(await apiService.createAvailabilitySlot(payload));
        }
        toast.success(created.length > 1 ? `${created.length} recurring slots created.` : 'Slot created.', 'Calendar');
      }

      await load();
      closeModal();
    } catch (error) {
      console.error(error);
      let message = 'Unable to save slot.';

      // Check for API response errors
      if (error?.response?.data) {
        const data = error.response.data;
        // Handle validation errors
        if (data.__all__ && Array.isArray(data.__all__)) {
          message = data.__all__[0];
        } else if (data.non_field_errors && Array.isArray(data.non_field_errors)) {
          message = data.non_field_errors[0];
        } else if (typeof data === 'string') {
          message = data;
        }
      }

      // Fallback to message parsing
      if (message === 'Unable to save slot.') {
        const raw = error?.message || '';
        if (raw.includes('overlaps')) {
          message = 'This time overlaps with an existing slot.';
        } else if (raw.includes('already exists')) {
          message = 'A slot with these exact times already exists. Please delete it first or choose different times.';
        } else if (raw.includes('after start time')) {
          message = 'End time must be after start time.';
        }
      }

      toast.error(message, 'Calendar');
      throw new Error(message);
    } finally {
      setLoadingAction(false);
    }
  };

  const deleteSelected = async () => {
    if (!selectedSlot) return;
    if (!window.confirm('Delete this availability slot?')) return;

    setLoadingAction(true);
    try {
      await apiService.deleteAvailabilitySlot(selectedSlot.id);
      toast.info('Slot deleted.', 'Calendar');
      setSelectedSlot(null);
      await load();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete the slot.', 'Calendar');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleAppointmentStatusUpdate = async (id, statusValue, extra = {}) => {
    setLoadingAction(true);
    try {
      const updated = await apiService.updateAppointmentStatus(id, statusValue, extra);
      setAppointments((current) => current.map((item) => (item.id === id ? updated : item)));
      const statusLabel = statusValue.charAt(0).toUpperCase() + statusValue.slice(1);
      toast.success(`Appointment ${statusLabel.toLowerCase()}.`, 'Requests');
    } catch (error) {
      console.error(error);
      toast.error('Unable to update appointment status.', 'Requests');
    } finally {
      setLoadingAction(false);
    }
  };

  const submitRejection = async () => {
    if (!rejectTargetId || !rejectionReason.trim()) return;
    await handleAppointmentStatusUpdate(rejectTargetId, 'rejected', { rejection_reason: rejectionReason.trim() });
    setRejectTargetId(null);
    setRejectionReason('');
  };

  const renderAppointmentRequestsSection = () => (
    <div className={`${panelCls} space-y-4`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Appointment Requests</h3>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Requests sent by users to this officer.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
          {['pending', 'confirmed', 'completed', 'rejected', 'all'].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setAppointmentFilter(status)}
              className={`rounded-full border px-3 py-1.5 font-medium capitalize ${appointmentFilter === status
                ? 'border-blue-600 bg-blue-600 text-white'
                : isDark
                  ? 'border-gray-700 text-gray-300 hover:bg-gray-800'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {visibleAppointments.length === 0 ? (
        <div className={`rounded-2xl border p-5 text-sm ${isDark ? 'border-gray-700 bg-gray-900/50 text-gray-400' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
          No appointment requests in this filter.
        </div>
      ) : (
        <div className="space-y-3">
          {visibleAppointments.map((appointment) => {
            const chipStyle = APPOINTMENT_STATUS_STYLE[appointment.status] || APPOINTMENT_STATUS_STYLE.pending;
            return (
              <div
                key={appointment.id}
                className={`rounded-2xl border p-4 ${isDark ? 'border-gray-700 bg-gray-900/60' : 'border-gray-200 bg-white'}`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${chipStyle}`}>
                        {appointment.status}
                      </span>
                      <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                        #{appointment.id}
                      </span>
                    </div>
                    <p className={`mt-2 text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {appointment.issue_type_display || appointment.issue_type || 'Appointment request'}
                    </p>
                    <p className={`mt-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {appointment.description || 'No description provided.'}
                    </p>
                    <div className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      <span>
                        User: {appointment.requested_by?.first_name || appointment.requested_by?.username || 'User'} {appointment.requested_by?.last_name || ''}
                      </span>
                      {appointment.availability_slot && (
                        <span>
                          Slot: {formatLongDate(appointment.availability_slot.available_date)} {formatTime(appointment.availability_slot.start_time)} - {formatTime(appointment.availability_slot.end_time)}
                        </span>
                      )}
                      {appointment.created_at && (
                        <span>Created: {new Date(appointment.created_at).toLocaleString()}</span>
                      )}
                    </div>
                    {appointment.rejection_reason && (
                      <p className={`mt-2 text-xs ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                        Rejection reason: {appointment.rejection_reason}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 md:justify-end">
                    {appointment.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAppointmentStatusUpdate(appointment.id, 'confirmed')}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectTargetId(appointment.id);
                            setRejectionReason('');
                          }}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {appointment.status === 'confirmed' && (
                      <button
                        type="button"
                        onClick={() => handleAppointmentStatusUpdate(appointment.id, 'completed')}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const movePeriod = (direction) => {
    setAnchorDate((current) => (viewMode === 'month'
      ? new Date(current.getFullYear(), current.getMonth() + direction, 1)
      : addDays(current, direction * 7)));
  };

  const jumpToToday = () => {
    setAnchorDate(new Date());
    setViewMode('week');
  };

  const beginSelection = (day, rowIndex) => {
    const startMinutes = viewStartMinutes + (rowIndex * SLOT_STEP_MINUTES);
    const endMinutes = Math.min(viewEndMinutes, startMinutes + 60);
    const dayKey = dateKey(day);
    setDragState({
      dayKey,
      startRow: rowIndex,
      endRow: rowIndex,
      finalize: () => openCreateModal(buildDraftFromSelection({ date: day, startMinutes, endMinutes })),
    });
  };

  const extendSelection = (rowIndex) => {
    setDragState((current) => {
      if (!current) return current;
      const next = { ...current, endRow: rowIndex };
      next.finalize = () => {
        const startRow = Math.min(current.startRow, rowIndex);
        const endRow = Math.max(current.startRow, rowIndex) + 1;
        const startMinutes = viewStartMinutes + (startRow * SLOT_STEP_MINUTES);
        const endMinutes = Math.min(viewEndMinutes, viewStartMinutes + (endRow * SLOT_STEP_MINUTES));
        const day = parseDateKey(current.dayKey);
        if (startRow === rowIndex) {
          openCreateModal(buildDraftFromSelection({ date: day, startMinutes, endMinutes: startMinutes + 60 }));
        } else {
          openCreateModal(buildDraftFromSelection({ date: day, startMinutes, endMinutes }));
        }
      };
      return next;
    });
  };

  const renderDayColumn = (day) => {
    const dayKey = dateKey(day);
    const daySlots = slotsByDay.get(dayKey) || [];
    const currentMinutes = (new Date().getHours() * 60) + new Date().getMinutes();
    const showCurrentLine = isSameDay(day, new Date()) && currentMinutes >= viewStartMinutes && currentMinutes <= viewEndMinutes;
    const currentLineTop = ((currentMinutes - viewStartMinutes) / SLOT_STEP_MINUTES) * ROW_HEIGHT;
    const selectedRange = dragState?.dayKey === dayKey
      ? [Math.min(dragState.startRow, dragState.endRow), Math.max(dragState.startRow, dragState.endRow)]
      : null;

    return (
      <div key={dayKey} className="relative border-r last:border-r-0">
        <div className="relative min-h-[960px]">
          {Array.from({ length: rowsCount }, (_, rowIndex) => {
            const rowMinutes = viewStartMinutes + (rowIndex * SLOT_STEP_MINUTES);
            const isHour = rowMinutes % 60 === 0;
            const inSelection = selectedRange && rowIndex >= selectedRange[0] && rowIndex <= selectedRange[1];
            return (
              <div
                key={`${dayKey}-${rowIndex}`}
                className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} ${inSelection ? 'bg-blue-500/15' : ''}`}
                style={{ height: `${ROW_HEIGHT}px` }}
                onMouseDown={() => beginSelection(day, rowIndex)}
                onMouseEnter={() => dragState?.dayKey === dayKey && extendSelection(rowIndex)}
              >
                {isHour && <span className="sr-only">{formatTime(fromMinutes(rowMinutes))}</span>}
              </div>
            );
          })}

          {showCurrentLine && (
            <div className="pointer-events-none absolute left-0 right-0 z-20 flex items-center" style={{ top: `${currentLineTop}px` }}>
              <div className="h-0.5 flex-1 bg-red-500" />
              <div className="ml-[-6px] h-3 w-3 rounded-full bg-red-500" />
            </div>
          )}

          {daySlots.map((slot) => {
            if (slot.end_minutes <= viewStartMinutes || slot.start_minutes >= viewEndMinutes) return null;
            const style = SLOT_STYLE[slot.status];
            const top = Math.max(0, ((slot.start_minutes - viewStartMinutes) / SLOT_STEP_MINUTES) * ROW_HEIGHT);
            const height = Math.max(ROW_HEIGHT, ((slot.end_minutes - slot.start_minutes) / SLOT_STEP_MINUTES) * ROW_HEIGHT);

            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => setSelectedSlot(slot)}
                className={`group absolute z-10 mx-1 overflow-hidden rounded-xl border px-3 py-2 text-left text-xs shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-md ${style.block}`}
                style={{ top: `${top}px`, height: `${height}px`, left: '6px', right: '6px' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                    </p>
                    <p className="mt-0.5 inline-flex items-center rounded-full bg-white/75 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-700">
                      {style.label}
                    </p>
                  </div>
                  <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
                </div>
                {slot.notes && <p className="mt-2 line-clamp-2 text-[11px] text-gray-700/90">{slot.notes}</p>}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className={`rounded-3xl border shadow-sm ${isDark ? 'border-gray-700 bg-gray-900/80' : 'border-gray-200 bg-white'}`}>
        <div className={`flex items-center justify-between border-b px-4 py-3 ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
          <div>
            <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Weekly Time Grid</p>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Drag to create, click to inspect, hover for quick editing.
            </p>
          </div>
          <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Snap: {SLOT_STEP_MINUTES} minutes</div>
        </div>

        <div ref={weekScrollRef} className="max-h-[72vh] overflow-auto">
          <div className="min-w-[1060px]">
            <div className="grid border-b" style={{ gridTemplateColumns: `${TIME_GUTTER_WIDTH}px repeat(7, minmax(130px, 1fr))` }}>
              <div className={`border-r px-3 py-3 text-xs font-semibold uppercase tracking-wide ${isDark ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-500'}`}>
                Time
              </div>
              {weekDays.map((day) => {
                const daySlots = slotsByDay.get(dateKey(day)) || [];
                const occupied = daySlots.filter((slot) => slot.status !== 'available').length;
                return (
                  <button
                    key={dateKey(day)}
                    type="button"
                    onClick={() => {
                      setSelectedSlot(null);
                      setAnchorDate(day);
                    }}
                    className={`border-r px-3 py-3 text-left ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
                  >
                    <p className={`text-xs font-medium uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {WEEKDAY_NAMES[day.getDay() === 0 ? 6 : day.getDay() - 1]}
                    </p>
                    <p className={`text-sm font-semibold ${isSameDay(day, new Date()) ? 'text-blue-600' : isDark ? 'text-white' : 'text-gray-900'}`}>
                      {formatShortDate(day)}
                    </p>
                    <p className={`mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{daySlots.length} slots · {occupied} occupied</p>
                  </button>
                );
              })}
            </div>

            <div className="grid" style={{ gridTemplateColumns: `${TIME_GUTTER_WIDTH}px repeat(7, minmax(130px, 1fr))` }}>
              <div className={`border-r ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                {Array.from({ length: rowsCount }, (_, rowIndex) => {
                  const minutes = viewStartMinutes + (rowIndex * SLOT_STEP_MINUTES);
                  return (
                    <div key={minutes} className={`border-b px-2 py-1 text-[11px] ${isDark ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-400'}`} style={{ height: `${ROW_HEIGHT}px` }}>
                      {minutes % 60 === 0 ? formatTime(fromMinutes(minutes)) : ''}
                    </div>
                  );
                })}
              </div>
              {weekDays.map(renderDayColumn)}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className={`rounded-3xl border p-5 ${isDark ? 'border-gray-700 bg-gray-900/80' : 'border-gray-200 bg-white'}`}>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Week Summary</h3>
          <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            A fast glance at your current calendar load.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              { label: 'Total', value: stats.total },
              { label: 'Available', value: stats.available },
              { label: 'Booked', value: stats.booked },
              { label: 'Pending', value: stats.pending },
            ].map((item) => (
              <div key={item.label} className={`rounded-xl border px-4 py-3 ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.label}</p>
                <p className={`mt-1 text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.value}</p>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => openCreateModal(buildDraftFromSelection({ date: anchorDate, startMinutes: viewStartMinutes + 60, endMinutes: viewStartMinutes + 120 }))}
            className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Create Slot
          </button>
        </div>

        <SlotDetails
          isDark={isDark}
          slot={selectedSlot}
          appointment={selectedSlot ? appointmentMap.get(selectedSlot.id) : null}
          onEdit={() => selectedSlot && openEditModal(selectedSlot)}
          onDelete={deleteSelected}
        />

        <div className={`rounded-3xl border p-5 ${isDark ? 'border-gray-700 bg-gray-900/80' : 'border-gray-200 bg-white'}`}>
          <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Selected Day</h3>
          <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{formatLongDate(selectedDay)}</p>
          <div className="mt-3 space-y-2">
            {selectedDaySlots.length === 0 ? (
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No slots for this day.</p>
            ) : (
              selectedDaySlots.slice(0, 5).map((slot) => {
                const style = SLOT_STYLE[slot.status];
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                    className={`flex w-full items-start justify-between rounded-xl border px-4 py-3 text-left ${isDark ? 'border-gray-700 bg-gray-800/50 hover:bg-gray-800' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}
                  >
                    <div>
                      <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatTime(slot.start_time)} - {formatTime(slot.end_time)}</p>
                      <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{slot.notes || 'No notes'}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${style.chip}`}>{style.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderMonthView = () => (
    <div className="space-y-4">
      <div className={`rounded-3xl border p-5 shadow-sm ${isDark ? 'border-gray-700 bg-gray-900/80' : 'border-gray-200 bg-white'}`}>
        <div className="grid grid-cols-7 gap-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
          {WEEKDAY_NAMES.map((day) => <div key={day}>{day}</div>)}
        </div>
        <div className="mt-3 grid grid-cols-7 gap-3">
          {monthDays.map((day) => {
            const daySlots = slotsByDay.get(dateKey(day)) || [];
            const counts = daySlots.reduce((acc, slot) => {
              acc.total += 1;
              acc[slot.status] += 1;
              return acc;
            }, { total: 0, available: 0, booked: 0, pending: 0 });
            const inMonth = day.getMonth() === anchorDate.getMonth();

            return (
              <button
                key={dateKey(day)}
                type="button"
                onClick={() => {
                  setAnchorDate(day);
                  setViewMode('week');
                }}
                className={`min-h-[118px] rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${inMonth ? '' : 'opacity-45'} ${isSameDay(day, new Date())
                  ? 'border-blue-500 bg-blue-50'
                  : isDark
                    ? 'border-gray-700 bg-gray-800/50 hover:bg-gray-800'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`text-sm font-semibold ${isSameDay(day, new Date()) ? 'text-blue-700' : isDark ? 'text-white' : 'text-gray-900'}`}>{day.getDate()}</p>
                    <p className={`mt-0.5 text-[11px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{formatShortDate(day)}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-600'}`}>{counts.total}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {counts.available > 0 && <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" title="Available" />}
                  {counts.booked > 0 && <span className="h-2.5 w-2.5 rounded-full bg-red-500" title="Booked" />}
                  {counts.pending > 0 && <span className="h-2.5 w-2.5 rounded-full bg-amber-500" title="Pending" />}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1 text-[10px] font-medium uppercase tracking-wide">
                  <span className={`rounded-md px-2 py-1 ${isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-600'}`}>A {counts.available}</span>
                  <span className={`rounded-md px-2 py-1 ${isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-600'}`}>B {counts.booked}</span>
                  <span className={`rounded-md px-2 py-1 ${isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-600'}`}>P {counts.pending}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className={`rounded-3xl border p-5 ${isDark ? 'border-gray-700 bg-gray-900/80' : 'border-gray-200 bg-white'}`}>
          <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Monthly Overview</h3>
          <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Click a day to switch back to its detailed weekly view.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Total slots', value: stats.total },
              { label: 'Available', value: stats.available },
              { label: 'Booked', value: stats.booked },
              { label: 'Pending', value: stats.pending },
            ].map((item) => (
              <div key={item.label} className={`rounded-xl border px-4 py-3 ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.label}</p>
                <p className={`mt-1 text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={`rounded-3xl border p-5 ${isDark ? 'border-gray-700 bg-gray-900/80' : 'border-gray-200 bg-white'}`}>
          <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Legend</h3>
          <div className="mt-4 space-y-3 text-sm">
            {Object.entries(SLOT_STYLE).map(([key, style]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`h-3 w-3 rounded-full ${style.dot}`} />
                  <span className={`${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{style.label}</span>
                </div>
                <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${style.chip}`}>{key}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const pageCls = `${isDark ? 'bg-gray-950' : 'bg-slate-50'} min-h-screen`;
  const panelCls = `${isDark ? 'border-gray-800 bg-gray-900/70' : 'border-gray-200 bg-white'} rounded-3xl border p-5 shadow-sm`;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  const viewLabel = viewMode === 'month'
    ? anchorDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : `${formatShortDate(weekDays[0])} - ${formatShortDate(weekDays[6])}`;

  return (
    <div className={pageCls}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="space-y-6 p-4 sm:p-6 xl:p-8">
        <div className={`${panelCls} flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between`}>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-[0.35em] ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>Officer Calendar</p>
            <h2 className={`mt-2 text-2xl font-bold sm:text-3xl ${isDark ? 'text-white' : 'text-gray-900'}`}>Scheduling studio</h2>

          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${viewMode === 'week' ? 'bg-blue-600 text-white' : isDark ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${viewMode === 'month' ? 'bg-blue-600 text-white' : isDark ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => movePeriod(-1)}
              className={`rounded-xl border px-4 py-2 text-sm font-medium ${isDark ? 'border-gray-700 text-gray-200 hover:bg-gray-800' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={jumpToToday}
              className={`rounded-xl border px-4 py-2 text-sm font-medium ${isDark ? 'border-gray-700 text-gray-200 hover:bg-gray-800' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => movePeriod(1)}
              className={`rounded-xl border px-4 py-2 text-sm font-medium ${isDark ? 'border-gray-700 text-gray-200 hover:bg-gray-800' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => openCreateModal(buildDraftFromSelection({ date: anchorDate, startMinutes: viewStartMinutes + 60, endMinutes: viewStartMinutes + 120 }))}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Create Slot
            </button>
          </div>
        </div>

        <div className={`${panelCls} flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between`}>
          <div>
            <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{viewLabel}</p>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Drag inside the weekly grid to create slots in 15-minute increments.</p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className={`rounded-full border px-3 py-1 ${SLOT_STYLE.available.chip}`}>Available {stats.available}</span>
            <span className={`rounded-full border px-3 py-1 ${SLOT_STYLE.booked.chip}`}>Booked {stats.booked}</span>
            <span className={`rounded-full border px-3 py-1 ${SLOT_STYLE.pending.chip}`}>Pending {stats.pending}</span>
          </div>
        </div>

        {viewMode === 'week' ? renderWeekView() : renderMonthView()}

        {renderAppointmentRequestsSection()}
      </div>

      {modalMode && modalDraft && (
        <SlotModal
          isDark={isDark}
          mode={modalMode}
          draft={modalDraft}
          slots={slots}
          onClose={closeModal}
          onSubmit={submitDraft}
        />
      )}

      {loadingAction && (
        <div className="fixed bottom-6 right-6 z-50 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-xl">
          Saving calendar changes...
        </div>
      )}

      {rejectTargetId && (
        <RejectReasonModal
          isDark={isDark}
          reason={rejectionReason}
          setReason={setRejectionReason}
          saving={loadingAction}
          onClose={() => {
            setRejectTargetId(null);
            setRejectionReason('');
          }}
          onSubmit={submitRejection}
        />
      )}
    </div>
  );
};

export default OfficerSchedule;
