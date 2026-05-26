import React, { useEffect, useState } from 'react';
import apiService from '../../services/api';

const FIELD_TYPES = [
  { type: 'text', label: 'Text Input' },
  { type: 'number', label: 'Number Input' },
  { type: 'rating', label: 'Rating Scale' },
  { type: 'choice', label: 'Multiple Choice' },
  { type: 'checkbox', label: 'Checkboxes' }
];

const getEntityId = (item, fallbackKeys = []) => {
  if (!item || typeof item !== 'object') return null;
  if (item.id != null) return item.id;
  for (const key of fallbackKeys) {
    if (item[key] != null) return item[key];
  }
  return null;
};

const getEntityLabel = (item, fallbackKeys = []) => {
  if (!item || typeof item !== 'object') return '';
  for (const key of fallbackKeys) {
    if (item[key]) return item[key];
  }
  return String(getEntityId(item) || 'Unknown');
};

const FeedbackFormBuilder = ({ onSave }) => {
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [fields, setFields] = useState([]);
  const [audienceScope, setAudienceScope] = useState('all');
  const [targetCampus, setTargetCampus] = useState('');
  const [targetCollege, setTargetCollege] = useState('');
  const [targetDepartment, setTargetDepartment] = useState('');
  const [targetUserIds, setTargetUserIds] = useState([]);
  const [targetUserSearchRegex, setTargetUserSearchRegex] = useState('');
  const [campuses, setCampuses] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);

  const normalizedCampuses = campuses
    .map((campus) => ({
      id: getEntityId(campus, ['campus_id']),
      label: getEntityLabel(campus, ['campus_name', 'name']),
    }))
    .filter((campus) => campus.id != null);

  const normalizedColleges = colleges
    .map((college) => ({
      id: getEntityId(college, ['college_id']),
      label: getEntityLabel(college, ['college_name', 'name']),
    }))
    .filter((college) => college.id != null);

  const normalizedDepartments = departments
    .map((department) => ({
      id: getEntityId(department, ['department_id']),
      label: getEntityLabel(department, ['department_name', 'name']),
    }))
    .filter((department) => department.id != null);

  const normalizedUsers = users
    .map((user) => ({
      id: String(getEntityId(user, ['user_id'])),
      label: (user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Unknown User').trim(),
      email: user.email || '',
    }))
    .filter((user) => user.id !== 'null');

  let filteredUsers = normalizedUsers;
  let regexSearchError = '';
  if (targetUserSearchRegex.trim()) {
    try {
      const regex = new RegExp(targetUserSearchRegex.trim(), 'i');
      filteredUsers = normalizedUsers.filter((user) => regex.test(`${user.label} ${user.email}`.trim()));
    } catch {
      regexSearchError = 'Invalid regex pattern. Example: Abebe|@school\.edu';
      filteredUsers = [];
    }
  }

  useEffect(() => {
    const loadTargetOptions = async () => {
      const [campusesResult, collegesResult, departmentsResult, usersResult] = await Promise.allSettled([
        apiService.getCampuses(),
        apiService.getColleges(),
        apiService.getDepartments(),
        apiService.getFeedbackTargetUsers(),
      ]);

      if (campusesResult.status === 'fulfilled') {
        setCampuses(campusesResult.value.results || campusesResult.value || []);
      } else {
        console.error('Failed to load campuses:', campusesResult.reason);
        setCampuses([]);
      }

      if (collegesResult.status === 'fulfilled') {
        setColleges(collegesResult.value.results || collegesResult.value || []);
      } else {
        console.error('Failed to load colleges:', collegesResult.reason);
        setColleges([]);
      }

      if (departmentsResult.status === 'fulfilled') {
        setDepartments(departmentsResult.value.results || departmentsResult.value || []);
      } else {
        console.error('Failed to load departments:', departmentsResult.reason);
        setDepartments([]);
      }

      if (usersResult.status === 'fulfilled') {
        const fetchedUsers = usersResult.value.results || usersResult.value || [];
        // Some API responses omit is_active; keep users selectable unless explicitly inactive.
        setUsers(fetchedUsers.filter((user) => user.is_active !== false));
      } else {
        console.error('Failed to load feedback target users, trying fallback accounts API:', usersResult.reason);
        try {
          const fallbackUsers = await apiService.getAllUsers();
          const fetchedUsers = fallbackUsers.results || fallbackUsers || [];
          setUsers(fetchedUsers.filter((user) => user.is_active !== false));
        } catch (fallbackError) {
          console.error('Failed to load users for targeting:', fallbackError);
          setUsers([]);
        }
      }
    };

    loadTargetOptions();
  }, []);

  const addField = (fieldType) => {
    const newField = {
      id: Date.now().toString(),
      label: `New ${fieldType} field`,
      field_type: fieldType,
      is_required: false,
      options: fieldType === 'choice' || fieldType === 'checkbox' ? ['Option 1'] : [],
      order: fields.length
    };
    if (fieldType === 'number') {
      newField.min = '';
      newField.max = '';
    }
    setFields([...fields, newField]);
  };

  const updateField = (fieldId, updates) => {
    setFields(fields.map(field =>
      field.id === fieldId ? { ...field, ...updates } : field
    ));
  };

  const removeField = (fieldId) => {
    setFields(fields.filter(field => field.id !== fieldId));
  };

  const moveField = (fieldId, direction) => {
    const currentIndex = fields.findIndex(f => f.id === fieldId);
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === fields.length - 1)
    ) return;

    const newFields = [...fields];
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    [newFields[currentIndex], newFields[targetIndex]] = [newFields[targetIndex], newFields[currentIndex]];

    const updatedFields = newFields.map((field, index) => ({
      ...field,
      order: index
    }));

    setFields(updatedFields);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) {
      alert('Please enter a form title');
      return;
    }

    // Validate number fields have min and max
    for (const field of fields) {
      if (field.field_type === 'number') {
        if (field.min_value === null || field.min_value === undefined || field.min_value === '') {
          alert(`Field "${field.label}" is a number field. Minimum value is required.`);
          return;
        }
        if (field.max_value === null || field.max_value === undefined || field.max_value === '') {
          alert(`Field "${field.label}" is a number field. Maximum value is required.`);
          return;
        }
        if (Number(field.min_value) >= Number(field.max_value)) {
          alert(`Field "${field.label}": Minimum value must be less than maximum value.`);
          return;
        }
      }
    }

    if (audienceScope === 'campus' && !targetCampus) {
      alert('Please select a target campus');
      return;
    }
    if (audienceScope === 'college' && !targetCollege) {
      alert('Please select a target college');
      return;
    }
    if (audienceScope === 'department' && !targetDepartment) {
      alert('Please select a target department');
      return;
    }
    if (audienceScope === 'users' && targetUserIds.length === 0) {
      alert('Please select at least one target user');
      return;
    }

    const normalizedTargetUserIds = targetUserIds
      .map((id) => Number.parseInt(id, 10))
      .filter((id) => Number.isInteger(id) && id > 0);

    const templateData = {
      title: formTitle,
      description: formDescription,
      audience_scope: audienceScope,
      target_campus: targetCampus || null,
      target_college: targetCollege || null,
      target_department: targetDepartment || null,
      target_user_ids: audienceScope === 'users' ? normalizedTargetUserIds : [],
      fields: fields.map(({ id: _id, ...field }) => field)
    };

    try {
      await apiService.createFeedbackTemplate(templateData);
      onSave && onSave();
      alert('Feedback form created successfully!');
    } catch (error) {
      console.error('Error saving form:', error);
      alert(error.message || 'Failed to create form');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-5">
      <div className="mb-8">
        <input
          type="text"
          placeholder="Form Title"
          value={formTitle}
          onChange={(e) => setFormTitle(e.target.value)}
          className="w-full text-2xl font-bold p-3 border-2 border-gray-300 rounded-lg mb-3"
        />
        <textarea
          placeholder="Form Description"
          value={formDescription}
          onChange={(e) => setFormDescription(e.target.value)}
          className="w-full min-h-20 p-3 border-2 border-gray-300 rounded-lg resize-y"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Audience Scope</label>
            <select
              value={audienceScope}
              onChange={(e) => {
                const nextScope = e.target.value;
                setAudienceScope(nextScope);
                if (nextScope !== 'campus') setTargetCampus('');
                if (nextScope !== 'college') setTargetCollege('');
                if (nextScope !== 'department') setTargetDepartment('');
                if (nextScope !== 'users') {
                  setTargetUserIds([]);
                  setTargetUserSearchRegex('');
                }
              }}
              className="w-full p-2 border-2 border-gray-300 rounded-lg"
            >
              <option value="all">All Users</option>
              <option value="campus">Campus</option>
              <option value="college">College</option>
              <option value="department">Department</option>
              <option value="users">Specific Users</option>
            </select>
          </div>

          {audienceScope === 'campus' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Campus</label>
              <select value={targetCampus} onChange={(e) => setTargetCampus(e.target.value)} className="w-full p-2 border-2 border-gray-300 rounded-lg">
                <option value="">Select campus</option>
                {normalizedCampuses.map((campus) => (
                  <option key={campus.id} value={campus.id}>{campus.label}</option>
                ))}
              </select>
            </div>
          )}

          {audienceScope === 'college' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target College</label>
              <select value={targetCollege} onChange={(e) => setTargetCollege(e.target.value)} className="w-full p-2 border-2 border-gray-300 rounded-lg">
                <option value="">Select college</option>
                {normalizedColleges.map((college) => (
                  <option key={college.id} value={college.id}>{college.label}</option>
                ))}
              </select>
            </div>
          )}

          {audienceScope === 'department' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Department</label>
              <select value={targetDepartment} onChange={(e) => setTargetDepartment(e.target.value)} className="w-full p-2 border-2 border-gray-300 rounded-lg">
                <option value="">Select department</option>
                {normalizedDepartments.map((department) => (
                  <option key={department.id} value={department.id}>{department.label}</option>
                ))}
              </select>
            </div>
          )}

          {audienceScope === 'users' && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Users</label>
              <input
                type="text"
                value={targetUserSearchRegex}
                onChange={(e) => setTargetUserSearchRegex(e.target.value)}
                placeholder="Search users (regex), e.g. john|mary|@school.edu"
                className="w-full p-2 mb-2 border-2 border-gray-300 rounded-lg"
              />
              {regexSearchError && (
                <p className="text-sm text-red-600 mb-2">{regexSearchError}</p>
              )}
              <div className="max-h-40 overflow-y-auto border-2 border-gray-300 rounded-lg p-3 bg-white">
                {filteredUsers.map((user) => (
                  <label key={user.id} className="flex items-center gap-2 text-sm mb-1">
                    <input
                      type="checkbox"
                      checked={targetUserIds.includes(user.id)}
                      onChange={(e) => {
                        const userId = user.id;
                        if (e.target.checked) {
                          setTargetUserIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
                        } else {
                          setTargetUserIds((prev) => prev.filter((id) => id !== userId));
                        }
                      }}
                    />
                    <span>{user.label}{user.email ? ` (${user.email})` : ''}</span>
                  </label>
                ))}
                {filteredUsers.length === 0 && !regexSearchError && (
                  <p className="text-sm text-gray-500">No active users available for targeting.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-8">
        <div className="flex-none w-64 bg-gray-50 p-5 rounded-lg h-fit">
          <h3 className="mt-0 text-gray-800 mb-4">Field Types</h3>
          {FIELD_TYPES.map(fieldType => (
            <button
              key={fieldType.type}
              onClick={() => addField(fieldType.type)}
              className="block w-full p-3 mb-3 bg-white border-2 border-blue-500 rounded-lg cursor-pointer transition-all hover:bg-blue-500 hover:text-white"
            >
              {fieldType.label}
            </button>
          ))}
        </div>

        <div className="flex-1 bg-white p-5 border-2 border-gray-300 rounded-lg min-h-96">
          <h3 className="mb-5">Form Preview</h3>
          <div className="space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="bg-gray-50 border-2 border-gray-300 rounded-lg p-4"
              >
                <FieldEditor
                  field={field}
                  index={index}
                  totalFields={fields.length}
                  onUpdate={(updates) => updateField(field.id, updates)}
                  onRemove={() => removeField(field.id)}
                  onMove={(direction) => moveField(field.id, direction)}
                />
              </div>
            ))}
            {fields.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                Click on field types to add them to your form
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <button
          onClick={handleSave}
          className="bg-green-500 text-white px-8 py-4 text-lg font-semibold rounded-lg hover:bg-green-600 transition-colors"
        >
          Save Feedback Form
        </button>
      </div>
    </div>
  );
};

const FieldEditor = ({ field, index, totalFields, onUpdate, onRemove, onMove }) => {
  const addOption = () => {
    const newOptions = [...field.options, `Option ${field.options.length + 1}`];
    onUpdate({ options: newOptions });
  };

  const updateOption = (index, value) => {
    const newOptions = [...field.options];
    newOptions[index] = value;
    onUpdate({ options: newOptions });
  };

  const removeOption = (index) => {
    const newOptions = field.options.filter((_, i) => i !== index);
    onUpdate({ options: newOptions });
  };

  const moveOption = (optionIndex, direction) => {
    const targetIndex = direction === 'up' ? optionIndex - 1 : optionIndex + 1;
    if (targetIndex < 0 || targetIndex >= field.options.length) return;

    const newOptions = [...field.options];
    [newOptions[optionIndex], newOptions[targetIndex]] = [newOptions[targetIndex], newOptions[optionIndex]];
    onUpdate({ options: newOptions });
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-3">
        <input
          type="text"
          value={field.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="flex-1 p-2 border border-gray-300 rounded mr-3"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => onMove('up')}
            disabled={index === 0}
            className="px-2 py-1 bg-gray-500 text-white rounded disabled:opacity-50"
          >
            Up
          </button>
          <button
            onClick={() => onMove('down')}
            disabled={index === totalFields - 1}
            className="px-2 py-1 bg-gray-500 text-white rounded disabled:opacity-50"
          >
            Down
          </button>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={field.is_required}
              onChange={(e) => onUpdate({ is_required: e.target.checked })}
              className="mr-2"
            />
            Required
          </label>
          <button
            onClick={onRemove}
            className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Delete
          </button>
        </div>
      </div>

      {(field.field_type === 'choice' || field.field_type === 'checkbox') && (
        <div className="my-4 p-3 bg-white rounded">
          {field.options.map((option, index) => (
            <div key={index} className="flex gap-3 mb-2 items-center">
              <input
                type="text"
                value={option}
                onChange={(e) => updateOption(index, e.target.value)}
                className="flex-1 p-1 border border-gray-300 rounded"
              />
              <button
                onClick={() => moveOption(index, 'up')}
                disabled={index === 0}
                className="px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
              >
                Up
              </button>
              <button
                onClick={() => moveOption(index, 'down')}
                disabled={index === field.options.length - 1}
                className="px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
              >
                Down
              </button>
              <button
                onClick={() => removeOption(index)}
                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            onClick={addOption}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Add Option
          </button>
        </div>
      )}

      {field.field_type === 'number' && (
        <div className="my-4 p-3 bg-blue-50 rounded border-2 border-blue-200 space-y-3">
          <p className="text-sm font-semibold text-blue-900 mb-3">📊 Number Field Configuration (Required)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Value <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={field.min_value !== null && field.min_value !== undefined ? field.min_value : ''}
                onChange={(e) => onUpdate({ min_value: e.target.value ? Number(e.target.value) : null })}
                placeholder="Enter minimum value"
                className={`w-full p-2 border-2 rounded ${
                  field.min_value === null || field.min_value === undefined || field.min_value === ''
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300'
                }`}
              />
              {(field.min_value === null || field.min_value === undefined || field.min_value === '') && (
                <p className="text-xs text-red-600 mt-1">⚠️ Required for number fields</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Value <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={field.max_value !== null && field.max_value !== undefined ? field.max_value : ''}
                onChange={(e) => onUpdate({ max_value: e.target.value ? Number(e.target.value) : null })}
                placeholder="Enter maximum value"
                className={`w-full p-2 border-2 rounded ${
                  field.max_value === null || field.max_value === undefined || field.max_value === ''
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300'
                }`}
              />
              {(field.max_value === null || field.max_value === undefined || field.max_value === '') && (
                <p className="text-xs text-red-600 mt-1">⚠️ Required for number fields</p>
              )}
            </div>
          </div>
          {field.min_value !== null && field.min_value !== undefined && field.max_value !== null && field.max_value !== undefined && (
            <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded">
              <p className="text-xs text-green-800">
                ✓ Valid range: <strong>{field.min_value}</strong> to <strong>{field.max_value}</strong>
              </p>
            </div>
          )}
          {field.min_value !== null && field.min_value !== undefined && field.max_value !== null && field.max_value !== undefined && Number(field.min_value) >= Number(field.max_value) && (
            <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
              <p className="text-xs text-red-800">
                ⚠️ Minimum must be less than maximum
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 p-3 bg-white rounded border border-gray-200">
        <FieldPreview field={field} />
      </div>
    </div>
  );
};

const FieldPreview = ({ field }) => {
  switch (field.field_type) {
    case 'text':
      return <input type="text" placeholder={field.label} disabled className="w-full p-2 border border-gray-300 rounded" />;
    case 'number':
      return (
        <div className="space-y-2">
          <input
            type="number"
            placeholder={field.label}
            disabled
            min={field.min_value || undefined}
            max={field.max_value || undefined}
            className="w-full p-2 border border-gray-300 rounded"
          />
          {(field.min_value != null || field.max_value != null) && (
            <p className="text-xs text-gray-500">
              Range: {field.min_value != null ? field.min_value : '−∞'} to {field.max_value != null ? field.max_value : '+∞'}
            </p>
          )}
        </div>
      );
    case 'rating':
      return (
        <div className="flex">
          {[1, 2, 3, 4, 5].map(star => (
            <span key={star} className="text-2xl"> </span>
          ))}
        </div>
      );
    case 'choice':
      return (
        <div className="space-y-2">
          {field.options.map((option, index) => (
            <label key={index} className="flex items-center">
              <input type="radio" name={field.id} disabled className="mr-2" />
              {option}
            </label>
          ))}
        </div>
      );
    case 'checkbox':
      return (
        <div className="space-y-2">
          {field.options.map((option, index) => (
            <label key={index} className="flex items-center">
              <input type="checkbox" disabled className="mr-2" />
              {option}
            </label>
          ))}
        </div>
      );
    default:
      return <div>Unknown field type</div>;
  }
};

export default FeedbackFormBuilder;
