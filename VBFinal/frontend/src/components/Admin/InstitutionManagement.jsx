import { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/api';
import { CategoryManagement } from './CategoryManagement';
import CategoryResolverManagement from './CategoryResolverManagement';
import OfficersManagement from './OfficersManagement';

const CrudSection = ({ isDark, title, items, columns, onAdd, onEdit, onDelete, loading, showAddButton = true, addButtonLabel = '+ Add' }) => {
  const thCls = 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
  const tdCls = 'px-4 py-3 whitespace-nowrap text-sm';
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-700'}`}>{title}</h3>
        {showAddButton && (
          <button onClick={onAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm w-full sm:w-auto">
            {addButtonLabel}
          </button>
        )}
      </div>
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow overflow-hidden`}>
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full divide-y divide-gray-200">
              <thead className={isDark ? 'bg-gray-700' : 'bg-gray-50'}>
                <tr>
                  {columns.map(c => <th key={c.key} className={thCls}>{c.label}</th>)}
                  <th className={thCls}>Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-gray-500">
                      No records found.
                    </td>
                  </tr>
                ) : items.map(item => (
                  <tr key={item.id} className={isDark ? 'bg-gray-800' : 'hover:bg-gray-50'}>
                    {columns.map(c => (
                      <td key={c.key} className={`${tdCls} ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                        {c.render ? c.render(item) : item[c.key] ?? '—'}
                      </td>
                    ))}
                    <td className={`${tdCls} space-x-3`}>
                      <button onClick={() => onEdit(item)} className="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                      <button onClick={() => onDelete(item.id)} className="text-red-600 hover:text-red-800 font-medium">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const BackButton = ({ isDark, onClick, label = 'Back' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${isDark ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
      }`}
  >
    <span>←</span>
    <span>{label}</span>
  </button>
);

const SubTabLanding = ({ isDark, title, onView, onAdd }) => (
  <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6`}>
    <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h3>

    <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button
        type="button"
        onClick={onView}
        className="px-4 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
      >
        View {title}
      </button>
      <button
        type="button"
        onClick={onAdd}
        className={`px-4 py-3 rounded-lg border font-medium ${isDark ? 'border-gray-600 text-gray-100 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
      >
        Add {title}
      </button>
    </div>
  </div>
);

const EntityFormPage = ({ isDark, title, fields, formData, onChange, onSubmit, onBack, editing }) => (
  <div className="space-y-4">
    <BackButton isDark={isDark} onClick={onBack} />
    <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6`}>
      <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
        {editing ? `Edit ${title}` : `Add ${title}`}
      </h3>
      <form onSubmit={onSubmit} className="space-y-4 mt-4">
        {fields.map((f) => (
          <div key={f.key}>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {f.label}
              {f.required ? ' *' : ''}
            </label>
            {f.type === 'select' ? (
              <select
                required={f.required}
                value={formData[f.key] || ''}
                onChange={(e) => onChange(f.key, e.target.value)}
                className={`mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                  }`}
              >
                <option value="">Select {f.label}</option>
                {(f.options || []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o[f.displayKey]}
                  </option>
                ))}
              </select>
            ) : f.type === 'checkbox' ? (
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!formData[f.key]}
                  onChange={(e) => onChange(f.key, e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Enabled</span>
              </div>
            ) : (
              <input
                type="text"
                required={f.required}
                value={formData[f.key] || ''}
                onChange={(e) => onChange(f.key, e.target.value)}
                placeholder={f.placeholder}
                className={`mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                  }`}
              />
            )}
          </div>
        ))}
        <div className="flex justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            className={`px-4 py-2 border rounded-lg ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
          >
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            {editing ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  </div>
);

const InstitutionManagement = () => {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('departments');
  const [tabMode, setTabMode] = useState('home');

  // Academic units list (served by backend via /colleges/ compatibility endpoint)
  const [colleges, setColleges] = useState([]);

  // Departments
  const [departments, setDepartments] = useState([]);
  const [deptLoading, setDeptLoading] = useState(false);
  const [deptEditing, setDeptEditing] = useState(null);
  const [deptForm, setDeptForm] = useState({ department_name: '', department_code: '', department_college: '', description: '', is_active: true });

  const load = async (tab) => {
    if (tab === 'departments') {
      setDeptLoading(true);
      try {
        const [col, dept] = await Promise.all([apiService.getColleges(), apiService.getDepartments()]);
        setColleges(col.results ?? col);
        setDepartments(dept.results ?? dept);
      } catch { }
      finally { setDeptLoading(false); }
    }
  };

  useEffect(() => { load('departments'); }, []);
  useEffect(() => { load(activeTab); }, [activeTab]);
  useEffect(() => { setTabMode('home'); }, [activeTab]);

  // Generic submit/delete helpers
  const handleSubmit = async (e, editing, form, createFn, updateFn, reloadTab) => {
    e.preventDefault();
    try {
      if (editing) await updateFn(editing.id, form);
      else await createFn(form);
      load(reloadTab);
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id, deleteFn, reloadTab) => {
    if (!confirm('Delete this record?')) return;
    try { await deleteFn(id); load(reloadTab); } catch (err) { console.error(err); }
  };

  const tabs = [
    { id: 'departments', label: 'Departments', icon: '🏢' },
    { id: 'categories', label: 'Offices', icon: '📂' },
    { id: 'resolvers', label: 'Assignments', icon: '🔁' },
    { id: 'officers', label: 'Officers', icon: '👥' },
  ];

  const renderContent = () => {
    const isPageTab = ['departments'].includes(activeTab);

    if (isPageTab && tabMode === 'home') {
      const titleMap = {
        departments: 'Departments',
      };
      return (
        <SubTabLanding
          isDark={isDark}
          title={titleMap[activeTab]}
          onView={() => setTabMode('view')}
          onAdd={() => {
            if (activeTab === 'departments') {
              setDeptEditing(null);
              setDeptForm({ department_name: '', department_code: '', department_college: '', description: '', is_active: true });
            }
            setTabMode('add');
          }}
        />
      );
    }

    switch (activeTab) {
      case 'departments':
        if (tabMode === 'add' || tabMode === 'edit') {
          return (
            <EntityFormPage
              isDark={isDark}
              title="Department"
              editing={deptEditing}
              formData={deptForm}
              onChange={(k, v) => setDeptForm((p) => ({ ...p, [k]: v }))}
              onBack={() => setTabMode('home')}
              onSubmit={(e) => {
                handleSubmit(
                  e,
                  deptEditing,
                  deptForm,
                  apiService.createDepartment.bind(apiService),
                  apiService.updateDepartment.bind(apiService),
                  'departments'
                );
                setTabMode('view');
              }}
              fields={[
                { key: 'department_name', label: 'Department Name', required: true, placeholder: 'e.g. Computer Science' },
                { key: 'department_code', label: 'Code', placeholder: 'e.g. CS' },
                { key: 'department_college', label: 'College', required: true, type: 'select', options: colleges, displayKey: 'college_name' },
                { key: 'description', label: 'Description', placeholder: 'Brief description...' },
                { key: 'is_active', label: 'Active', type: 'checkbox' },
              ]}
            />
          );
        }
        return (
          <div className="space-y-4">
            <BackButton isDark={isDark} onClick={() => setTabMode('home')} />
            <CrudSection
              isDark={isDark} title="Departments" items={departments} loading={deptLoading}
              columns={[
                { key: 'department_name', label: 'Name' },
                { key: 'department_code', label: 'Code' },
                { key: 'college_name', label: 'College', render: d => d.college_name || '—' },
                { key: 'is_active', label: 'Active', render: d => d.is_active ? '✅' : '❌' },
              ]}
              onAdd={() => {
                setDeptEditing(null);
                setDeptForm({ department_name: '', department_code: '', department_college: '', description: '', is_active: true });
                setTabMode('add');
              }}
              onEdit={i => {
                setDeptEditing(i);
                setDeptForm({ department_name: i.department_name, department_code: i.department_code, department_college: i.department_college, description: i.description, is_active: i.is_active });
                setTabMode('edit');
              }}
              onDelete={id => handleDelete(id, apiService.deleteDepartment.bind(apiService), 'departments')}
              addButtonLabel="+ Add Department"
            />
          </div>
        );

      case 'categories':
        return <CategoryManagement />;

      case 'resolvers':
        return <CategoryResolverManagement />;

      case 'officers':
        return <OfficersManagement />;

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow`}>
        <div className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <nav className="-mb-px flex space-x-1 px-2 sm:px-4 overflow-x-auto scrollbar-thin">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm flex items-center gap-1.5 transition-colors ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : `border-transparent ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`
                  }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
      {renderContent()}
    </div>
  );
};

export default InstitutionManagement;
