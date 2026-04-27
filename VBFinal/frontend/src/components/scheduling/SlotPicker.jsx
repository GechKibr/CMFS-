import { useEffect, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/api';

const fmt = (time) => {
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${m} ${ampm}`;
};

const SlotPicker = ({ preferredDate, officerId, categoryId, selectedSlot, onSelect, onLoaded }) => {
  const { isDark } = useTheme();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const params = {};
        if (preferredDate) params.preferred_date = preferredDate;
        if (officerId) params.officer_id = officerId;
        if (categoryId) params.category_id = categoryId;
        const data = await apiService.getFreeSlots(params);
        const nextGroups = Array.isArray(data) ? data : [];
        setGroups(nextGroups);
        if (onLoaded) {
          onLoaded(nextGroups);
        }
      } catch {
        setError('Failed to load available slots.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [preferredDate, officerId, categoryId, onLoaded]);

  const cardCls = `${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl border`;

  if (loading) return (
    <div className="flex justify-center py-8">
      <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600" />
    </div>
  );

  if (error) return <p className="text-sm text-red-500 py-4">{error}</p>;

  if (groups.length === 0) return (
    <div className={`${cardCls} p-6 text-center`}>
      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        No available slots{preferredDate ? ` from ${preferredDate}` : ''}. Try a different date.
      </p>
    </div>
  );

  return (
    <div className="space-y-4">
      {groups.map(({ date, slots }) => (
        <div key={date} className={cardCls}>
          <div className={`px-4 py-2 border-b ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-100 bg-gray-50'} rounded-t-xl`}>
            <p className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              {new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="p-3 flex flex-wrap gap-2">
            {slots.map(slot => {
              const isSelected = selectedSlot?.id === slot.id;
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => onSelect(isSelected ? null : slot)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${isSelected
                      ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-105'
                      : isDark
                        ? 'bg-gray-700 border-gray-600 text-gray-200 hover:border-blue-500 hover:bg-gray-600'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-blue-400 hover:bg-blue-50'
                    }`}
                >
                  <span>{fmt(slot.start_time)} – {fmt(slot.end_time)}</span>
                  {slot.officer_name && (
                    <span className={`block text-xs mt-0.5 ${isSelected ? 'text-blue-100' : isDark ? 'text-gray-400' : 'text-gray-400'}`}>
                      {slot.officer_name}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SlotPicker;
