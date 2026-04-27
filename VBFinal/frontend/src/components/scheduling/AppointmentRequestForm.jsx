import { useEffect, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/api';
import SlotPicker from './SlotPicker';

const ISSUE_TYPES = [
  { value: 'complaint', label: 'Complaint' },
  { value: 'support', label: 'Support' },
  { value: 'inquiry', label: 'Inquiry' },
  { value: 'service_request', label: 'Service Request' },
  { value: 'other', label: 'Other' },
];

const STEPS = ['Request Details', 'Select Slot', 'Confirm'];

const AppointmentRequestForm = ({ onSuccess, onCancel }) => {
  const { isDark } = useTheme();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    issue_type: 'complaint',
    description: '',
    preferred_date: '',
    category_id: '',
    officer_id: '',
  });
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [loadingOfficers, setLoadingOfficers] = useState(false);
  const [slotGroups, setSlotGroups] = useState([]);

  const inputCls = `mt-1 block w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900'
    }`;
  const labelCls = `block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`;

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await apiService.getAllCategories();
        const items = data?.results ?? data ?? [];
        setCategories(items.filter(item => item.is_active !== false));
      } catch {
        setCategories([]);
      }
    };
    loadCategories();
  }, []);

  useEffect(() => {
    const loadOfficers = async () => {
      if (!form.category_id) {
        setOfficers([]);
        return;
      }
      setLoadingOfficers(true);
      try {
        const data = await apiService.getCategoryOfficers(form.category_id);
        setOfficers(Array.isArray(data) ? data : []);
      } catch {
        setOfficers([]);
      } finally {
        setLoadingOfficers(false);
      }
    };
    loadOfficers();
  }, [form.category_id]);

  const selectedCategory = categories.find(item => String(item.category_id) === String(form.category_id));
  const selectedOfficer = officers.find(item => String(item.id) === String(form.officer_id));

  const buildOfficerDirectory = () => {
    const directory = new Map();
    slotGroups.forEach(group => {
      (group.slots || []).forEach(slot => {
        const officer = slot.officer || {};
        const key = officer.id ?? slot.officer_id ?? slot.officer_name;
        if (!key) return;
        const entry = directory.get(key) || {
          id: officer.id ?? key,
          name: `${officer.first_name || ''} ${officer.last_name || ''}`.trim() || slot.officer_name || officer.email || 'Officer',
          email: officer.email || '',
          count: 0,
        };
        entry.count += 1;
        directory.set(key, entry);
      });
    });
    return Array.from(directory.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  };

  const officerDirectory = buildOfficerDirectory();
  const formatInitials = (name, email) => {
    const source = name || email || '';
    const parts = source.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'OF';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  };

  const handleSubmit = async () => {
    if (!selectedSlot) { setError('Please select a time slot.'); return; }
    if (!form.description.trim()) { setError('Please enter a description.'); return; }
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        issue_type: form.issue_type,
        description: form.description,
        availability_slot_id: selectedSlot.id,
        ...(form.preferred_date ? { preferred_date: form.preferred_date } : {}),
      };
      const created = await apiService.createAppointment(payload);
      onSuccess?.(created);
    } catch (err) {
      const msg = err.message || '';
      const parsed = msg.includes('{') ? (() => { try { return JSON.parse(msg.slice(msg.indexOf('{'))); } catch { return null; } })() : null;
      setError(parsed?.detail?.[0] || parsed?.non_field_errors?.[0] || 'Failed to create appointment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`rounded-2xl border shadow-lg ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      {/* Step indicator */}
      <div className={`px-6 pt-5 pb-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
        <h2 className={`text-lg font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Request an Appointment</h2>
        <div className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${i < step ? 'bg-green-500 text-white' : i === step ? 'bg-blue-600 text-white' : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-400'
                }`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-xs hidden sm:block ${i === step ? (isDark ? 'text-white font-medium' : 'text-gray-900 font-medium') : isDark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</span>
              {i < STEPS.length - 1 && <div className={`w-8 h-px ${isDark ? 'bg-gray-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-4">
        {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}

        {/* Step 0: Request Details */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Office</label>
              <select
                value={form.category_id}
                onChange={e => {
                  setForm(p => ({ ...p, category_id: e.target.value, officer_id: '' }));
                  setSelectedSlot(null);
                }}
                className={inputCls}
              >
                <option value="">Select an office</option>
                {categories.map(cat => (
                  <option key={cat.category_id} value={cat.category_id}>
                    {cat.office_name || cat.name}
                  </option>
                ))}
              </select>
              {!form.category_id && (
                <p className={`mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  Choose an office to see officers and available slots.
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>Officer <span className={`text-xs font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>(optional)</span></label>
              <select
                value={form.officer_id}
                onChange={e => {
                  setForm(p => ({ ...p, officer_id: e.target.value }));
                  setSelectedSlot(null);
                }}
                className={inputCls}
                disabled={!form.category_id || loadingOfficers}
              >
                <option value="">Any officer</option>
                {officers.map(officer => (
                  <option key={officer.id} value={officer.id}>
                    {`${officer.first_name || ''} ${officer.last_name || ''}`.trim() || officer.email}
                  </option>
                ))}
              </select>
              {form.category_id && !loadingOfficers && officers.length === 0 && (
                <p className="mt-1 text-xs text-amber-500">
                  No officers are assigned to this office yet.
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>Issue Type</label>
              <select value={form.issue_type} onChange={e => setForm(p => ({ ...p, issue_type: e.target.value }))} className={inputCls}>
                {ISSUE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Description <span className="text-red-500">*</span></label>
              <textarea
                rows={4}
                placeholder="Describe your issue or reason for the appointment..."
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Preferred Date <span className={`text-xs font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>(optional)</span></label>
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={form.preferred_date}
                onChange={e => setForm(p => ({ ...p, preferred_date: e.target.value }))}
                className={inputCls}
              />
            </div>
          </div>
        )}

        {/* Step 1: Slot Selection */}
        {step === 1 && (
          <div className="space-y-3">
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Select an available time slot below.
              {form.preferred_date && ` Showing slots from ${form.preferred_date}.`}
            </p>
            <SlotPicker
              preferredDate={form.preferred_date}
              officerId={form.officer_id}
              categoryId={form.category_id}
              selectedSlot={selectedSlot}
              onSelect={setSelectedSlot}
              onLoaded={setSlotGroups}
            />
            {form.category_id && officerDirectory.length > 0 && (
              <div className={`rounded-xl border p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Officer Directory</h4>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Tap an officer to filter slots by availability.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setForm(p => ({ ...p, officer_id: '' }));
                      setSelectedSlot(null);
                    }}
                    className={`text-xs px-2.5 py-1 rounded-full border ${isDark ? 'border-gray-600 text-gray-300' : 'border-gray-200 text-gray-600'}`}
                  >
                    Any officer
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {officerDirectory.map(entry => {
                    const isSelected = String(form.officer_id) === String(entry.id);
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => {
                          setForm(p => ({ ...p, officer_id: String(entry.id) }));
                          setSelectedSlot(null);
                        }}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${isSelected
                          ? 'border-blue-500 bg-blue-50/60'
                          : isDark
                            ? 'border-gray-700 hover:bg-gray-700/60'
                            : 'border-gray-200 hover:bg-gray-50'
                          }`}
                      >
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-semibold ${isSelected
                          ? 'bg-blue-600 text-white'
                          : isDark
                            ? 'bg-gray-700 text-gray-200'
                            : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {formatInitials(entry.name, entry.email)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{entry.name}</p>
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{entry.count} slots available</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {selectedSlot && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Selected: {new Date(selectedSlot.available_date + 'T00:00:00').toLocaleDateString()} &nbsp;
                {selectedSlot.start_time?.slice(0, 5)} – {selectedSlot.end_time?.slice(0, 5)}
                {selectedSlot.officer_name && ` · ${selectedSlot.officer_name}`}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Confirm */}
        {step === 2 && (
          <div className={`space-y-3 rounded-xl p-4 ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
            <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Review your request</h3>
            <dl className="space-y-2 text-sm">
              {[
                ['Issue Type', ISSUE_TYPES.find(t => t.value === form.issue_type)?.label],
                ['Office', selectedCategory?.office_name || selectedCategory?.name || '—'],
                ['Description', form.description],
                ['Date', selectedSlot ? new Date(selectedSlot.available_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '—'],
                ['Time', selectedSlot ? `${selectedSlot.start_time?.slice(0, 5)} – ${selectedSlot.end_time?.slice(0, 5)}` : '—'],
                ['Officer', selectedOfficer?.first_name || selectedOfficer?.last_name
                  ? `${selectedOfficer?.first_name || ''} ${selectedOfficer?.last_name || ''}`.trim()
                  : (selectedOfficer?.email || selectedSlot?.officer_name || 'Any officer')],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className={`w-28 shrink-0 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{k}</dt>
                  <dd className={`${isDark ? 'text-gray-200' : 'text-gray-800'} break-words`}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className={`px-6 pb-5 flex justify-between gap-3`}>
        <button
          type="button"
          onClick={() => step === 0 ? onCancel?.() : setStep(s => s - 1)}
          className={`px-4 py-2 text-sm rounded-lg border transition-colors ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
        >
          {step === 0 ? 'Cancel' : '← Back'}
        </button>
        {step < 2 ? (
          <button
            type="button"
            disabled={step === 0 && !form.description.trim()}
            onClick={() => {
              if (step === 0 && !form.description.trim()) { setError('Description is required.'); return; }
              if (step === 0 && !form.category_id) { setError('Please select an office.'); return; }
              if (step === 1 && !selectedSlot) { setError('Please select a time slot.'); return; }
              setError('');
              setStep(s => s + 1);
            }}
            className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            Next →
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="px-5 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        )}
      </div>
    </div>
  );
};

export default AppointmentRequestForm;
