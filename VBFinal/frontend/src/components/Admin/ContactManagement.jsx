import { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/api';

const ContactManagement = () => {
  const { isDark } = useTheme();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    apiService.request('/contact/')
      .then(d => setMessages(d.results ?? d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('Delete this message?')) return;
    await apiService.request(`/contact/${id}/`, { method: 'DELETE' });
    setMessages(prev => prev.filter(m => m.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const td = 'px-4 py-3 text-sm';
  const th = 'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider';

  return (
    <div className="space-y-4">
      <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>
        Contact Messages <span className={`text-sm font-normal ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>({messages.length})</span>
      </h2>

      <div className={`rounded-lg shadow overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        {loading ? (
          <div className="text-center py-10 text-gray-500">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-10 text-gray-500">No messages yet.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className={isDark ? 'bg-gray-700' : 'bg-gray-50'}>
              <tr>
                {['Name', 'Email', 'Subject', 'Date', 'Actions'].map(h => (
                  <th key={h} className={`${th} ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {messages.map(msg => (
                <tr key={msg.id} className={isDark ? 'bg-gray-800 hover:bg-gray-700' : 'hover:bg-gray-50'}>
                  <td className={`${td} font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{msg.name}</td>
                  <td className={`${td} ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{msg.email}</td>
                  <td className={`${td} ${isDark ? 'text-gray-300' : 'text-gray-600'} max-w-xs truncate`}>{msg.subject}</td>
                  <td className={`${td} ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {new Date(msg.created_at).toLocaleDateString()}
                  </td>
                  <td className={`${td} space-x-3`}>
                    <button onClick={() => setSelected(msg)} className="text-blue-600 hover:text-blue-800 font-medium">View</button>
                    <button onClick={() => handleDelete(msg.id)} className="text-red-600 hover:text-red-800 font-medium">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Message Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex justify-between items-start">
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{selected.subject}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className={`text-sm space-y-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              <p><span className="font-medium">From:</span> {selected.name} &lt;{selected.email}&gt;</p>
              <p><span className="font-medium">Date:</span> {new Date(selected.created_at).toLocaleString()}</p>
            </div>
            <div className={`p-4 rounded-lg text-sm whitespace-pre-wrap ${isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-50 text-gray-800'}`}>
              {selected.message}
            </div>
            <div className="flex justify-end gap-3">
              <a href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject)}`}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                Reply via Email
              </a>
              <button onClick={() => setSelected(null)}
                className={`px-4 py-2 border rounded-lg text-sm ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactManagement;
