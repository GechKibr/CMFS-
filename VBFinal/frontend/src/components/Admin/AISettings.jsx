import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const AISettings = () => {
  const { isDark } = useTheme();
  const [aiConfig, setAiConfig] = useState({
    autoCategory: true,
    autoAssignment: false,
    autoPriority: true,
    smartRouting: true,
    assignmentStrategy: 'workload_based',
    confidenceThreshold: 85,
    maxRetries: 3,
    learningMode: true
  });

  const [modelStats, setModelStats] = useState({
    categoryAccuracy: 94,
    priorityAccuracy: 87,
    assignmentAccuracy: 91,
    avgProcessingTime: 2.3,
    totalProcessed: 1247,
    lastTrained: '2024-01-15'
  });

  const [keywords, setKeywords] = useState({
    urgent: ['emergency', 'urgent', 'critical', 'immediate', 'asap'],
    high: ['important', 'high priority', 'serious', 'major'],
    medium: ['moderate', 'standard', 'normal', 'regular'],
    low: ['minor', 'low priority', 'when possible', 'eventually']
  });

  const [newKeyword, setNewKeyword] = useState({ priority: 'urgent', word: '' });

  const toggleSetting = (setting) => {
    setAiConfig(prev => ({ ...prev, [setting]: !prev[setting] }));
  };

  const updateThreshold = (value) => {
    setAiConfig(prev => ({ ...prev, confidenceThreshold: parseInt(value) }));
  };

  const addKeyword = () => {
    if (!newKeyword.word.trim()) return;
    setKeywords(prev => ({
      ...prev,
      [newKeyword.priority]: [...prev[newKeyword.priority], newKeyword.word.trim()]
    }));
    setNewKeyword({ ...newKeyword, word: '' });
  };

  const removeKeyword = (priority, index) => {
    setKeywords(prev => ({
      ...prev,
      [priority]: prev[priority].filter((_, i) => i !== index)
    }));
  };

  const retrainModel = async () => {
    if (!confirm('Retrain AI model? This may take several minutes.')) return;
    alert('Model retraining started. You will be notified when complete.');
  };

  const priorityColors = {
    urgent: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-green-500'
  };

  return (
    <div className="space-y-6">
      {/* AI Model Performance */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          AI Model Performance
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-2xl font-bold text-blue-500">{modelStats.categoryAccuracy}%</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Category Accuracy</div>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-2xl font-bold text-green-500">{modelStats.priorityAccuracy}%</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Priority Accuracy</div>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-2xl font-bold text-purple-500">{modelStats.avgProcessingTime}s</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Avg Processing</div>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="text-2xl font-bold text-indigo-500">{modelStats.totalProcessed}</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Processed</div>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Last trained: {modelStats.lastTrained}
          </span>
          <button
            onClick={retrainModel}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
          >
            Retrain Model
          </button>
        </div>
      </div>

      {/* AI Configuration */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          AI Configuration
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className={`${isDark ? 'text-gray-300' : 'text-gray-700'} font-medium`}>Auto Category Detection</span>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>AI categorizes complaints automatically</p>
            </div>
            <button 
              onClick={() => toggleSetting('autoCategory')}
              className={`px-4 py-2 rounded transition-colors ${
                aiConfig.autoCategory ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-700'
              }`}
            >
              {aiConfig.autoCategory ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className={`${isDark ? 'text-gray-300' : 'text-gray-700'} font-medium`}>Auto Priority Detection</span>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>AI determines complaint priority</p>
            </div>
            <button 
              onClick={() => toggleSetting('autoPriority')}
              className={`px-4 py-2 rounded transition-colors ${
                aiConfig.autoPriority ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-700'
              }`}
            >
              {aiConfig.autoPriority ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className={`${isDark ? 'text-gray-300' : 'text-gray-700'} font-medium`}>Smart Assignment</span>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>AI assigns to best available officer</p>
            </div>
            <button 
              onClick={() => toggleSetting('autoAssignment')}
              className={`px-4 py-2 rounded transition-colors ${
                aiConfig.autoAssignment ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-700'
              }`}
            >
              {aiConfig.autoAssignment ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className={`${isDark ? 'text-gray-300' : 'text-gray-700'} font-medium`}>Learning Mode</span>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>AI learns from manual corrections</p>
            </div>
            <button 
              onClick={() => toggleSetting('learningMode')}
              className={`px-4 py-2 rounded transition-colors ${
                aiConfig.learningMode ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-700'
              }`}
            >
              {aiConfig.learningMode ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Settings */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          Advanced Settings
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className={`${isDark ? 'text-gray-300' : 'text-gray-700'} font-medium`}>Assignment Strategy</span>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>How complaints are assigned</p>
            </div>
            <select 
              value={aiConfig.assignmentStrategy}
              onChange={(e) => setAiConfig(prev => ({...prev, assignmentStrategy: e.target.value}))}
              className={`border rounded px-3 py-2 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            >
              <option value="round_robin">Round Robin</option>
              <option value="workload_based">Workload Based</option>
              <option value="expertise_based">Expertise Based</option>
              <option value="random">Random</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className={`${isDark ? 'text-gray-300' : 'text-gray-700'} font-medium`}>Confidence Threshold</span>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Minimum confidence for auto-processing</p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="50"
                max="99"
                value={aiConfig.confidenceThreshold}
                onChange={(e) => updateThreshold(e.target.value)}
                className="w-24"
              />
              <span className={`${isDark ? 'text-gray-300' : 'text-gray-700'} font-mono`}>
                {aiConfig.confidenceThreshold}%
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className={`${isDark ? 'text-gray-300' : 'text-gray-700'} font-medium`}>Max Retries</span>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Retry attempts for failed processing</p>
            </div>
            <select 
              value={aiConfig.maxRetries}
              onChange={(e) => setAiConfig(prev => ({...prev, maxRetries: parseInt(e.target.value)}))}
              className={`border rounded px-3 py-2 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={5}>5</option>
            </select>
          </div>
        </div>
      </div>

      {/* Priority Keywords Management */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
          Priority Keywords
        </h3>
        
        <div className="mb-4 flex space-x-2">
          <select
            value={newKeyword.priority}
            onChange={(e) => setNewKeyword(prev => ({...prev, priority: e.target.value}))}
            className={`border rounded px-3 py-2 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
          >
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <input
            type="text"
            value={newKeyword.word}
            onChange={(e) => setNewKeyword(prev => ({...prev, word: e.target.value}))}
            placeholder="Add keyword..."
            className={`flex-1 border rounded px-3 py-2 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
          />
          <button
            onClick={addKeyword}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Add
          </button>
        </div>

        <div className="space-y-3">
          {Object.entries(keywords).map(([priority, words]) => (
            <div key={priority}>
              <div className="flex items-center space-x-2 mb-2">
                <span className={`${priorityColors[priority]} text-white px-3 py-1 rounded text-sm font-medium uppercase`}>
                  {priority}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {words.map((word, index) => (
                  <span
                    key={index}
                    className={`inline-flex items-center px-2 py-1 rounded text-sm ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}
                  >
                    {word}
                    <button
                      onClick={() => removeKeyword(priority, index)}
                      className="ml-1 text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AISettings;
