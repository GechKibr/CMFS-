import { useState } from 'react';
import Modal from '../UI/Modal';

const AdminSettings = () => {
  const [aiSettings, setAiSettings] = useState({
    autoCategoryDetection: true,
    autoOfficerAssignment: false,
    assignmentStrategy: 'workload-based'
  });
  const [showModal, setShowModal] = useState(false);

  const handleSettingChange = (setting, value) => {
    setAiSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">AI Settings</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Automatic Category Detection</label>
              <p className="text-xs text-gray-500">Use AI to automatically categorize complaints</p>
            </div>
            <button
              onClick={() => handleSettingChange('autoCategoryDetection', !aiSettings.autoCategoryDetection)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                aiSettings.autoCategoryDetection ? 'bg-blue-700' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  aiSettings.autoCategoryDetection ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Automatic Officer Assignment</label>
              <p className="text-xs text-gray-500">Automatically assign complaints to officers</p>
            </div>
            <button
              onClick={() => handleSettingChange('autoOfficerAssignment', !aiSettings.autoOfficerAssignment)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                aiSettings.autoOfficerAssignment ? 'bg-blue-700' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  aiSettings.autoOfficerAssignment ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Assignment Strategy</label>
            <select
              value={aiSettings.assignmentStrategy}
              onChange={(e) => handleSettingChange('assignmentStrategy', e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-700 focus:border-blue-700"
            >
              <option value="random">Random</option>
              <option value="round-robin">Round Robin</option>
              <option value="workload-based">Workload Based</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex space-x-3">
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-700 text-white px-4 py-2 rounded-md hover:bg-blue-600"
          >
            Re-encode Categories
          </button>
          <button className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600">
            View Audit Logs
          </button>
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Re-encode Category Embeddings"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This will regenerate AI embeddings for all categories. This process may take a few minutes.
          </p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button className="px-4 py-2 bg-blue-700 text-white rounded-md hover:bg-blue-600">
              Start Re-encoding
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminSettings;
