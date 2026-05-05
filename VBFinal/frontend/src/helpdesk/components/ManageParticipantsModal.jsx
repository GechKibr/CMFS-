import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import helpdeskApi from '../services/helpdeskApi';

const ManageParticipantsModal = ({
  session = null,
  isOpen = false,
  onClose = null,
  onSuccess = null,
  candidates = [],
}) => {
  const { isDark } = useTheme();
  const [participants, setParticipants] = useState([]);
  const [availableCandidates, setAvailableCandidates] = useState([]);
  const [selectedToAdd, setSelectedToAdd] = useState([]);
  const [selectedToRemove, setSelectedToRemove] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen && session) {
      setParticipants(session.participants || []);
      // Filter candidates to show only those not already in the session
      const participantIds = new Set((session.participants || []).map((p) => p.user_id));
      setAvailableCandidates((candidates || []).filter((c) => !participantIds.has(c.id)));
      setSelectedToAdd([]);
      setSelectedToRemove([]);
      setError('');
      setSuccess('');
    }
  }, [isOpen, session, candidates]);

  const handleAddParticipant = (candidate) => {
    if (!selectedToAdd.includes(candidate.id)) {
      setSelectedToAdd([...selectedToAdd, candidate.id]);
    }
  };

  const handleRemoveAddSelection = (candidateId) => {
    setSelectedToAdd(selectedToAdd.filter((id) => id !== candidateId));
  };

  const handleSelectRemoveParticipant = (participantId) => {
    if (!selectedToRemove.includes(participantId)) {
      setSelectedToRemove([...selectedToRemove, participantId]);
    }
  };

  const handleRemoveRemoveSelection = (participantId) => {
    setSelectedToRemove(selectedToRemove.filter((id) => id !== participantId));
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    if (selectedToAdd.length === 0 && selectedToRemove.length === 0) {
      setError('Please select participants to add or remove.');
      return;
    }

    setLoading(true);

    try {
      // Add participants
      if (selectedToAdd.length > 0) {
        await helpdeskApi.addParticipants(session.id, selectedToAdd);
      }

      // Remove participants
      if (selectedToRemove.length > 0) {
        await helpdeskApi.removeParticipants(session.id, selectedToRemove);
      }

      setSuccess(
        `Successfully ${selectedToAdd.length > 0 ? 'added' : ''}${selectedToAdd.length > 0 && selectedToRemove.length > 0 ? ' and ' : ''}${selectedToRemove.length > 0 ? 'removed' : ''} participants.`
      );

      // Reset selections
      setSelectedToAdd([]);
      setSelectedToRemove([]);

      // Call onSuccess callback if provided
      if (typeof onSuccess === 'function') {
        onSuccess();
      }

      // Close modal after success
      setTimeout(() => {
        if (typeof onClose === 'function') {
          onClose();
        }
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to update participants.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !session) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className={`w-full max-w-2xl rounded-2xl shadow-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        {/* Header */}
        <div className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} px-6 py-4`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Manage Participants
            </h2>
            <button
              onClick={() => typeof onClose === 'function' && onClose()}
              className={`text-2xl font-bold ${isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}
            >
              ×
            </button>
          </div>
          <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {session.title || 'Untitled Session'}
          </p>
        </div>

        {/* Content */}
        <div className={`max-h-96 overflow-y-auto px-6 py-4 ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
          {error && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {success}
            </div>
          )}

          {/* Add Participants Section */}
          {availableCandidates.length > 0 && (
            <div className="mb-6">
              <h3 className={`mb-3 font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Add Participants
              </h3>
              <div className={`space-y-2 rounded-lg border ${isDark ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-white'} p-3`}>
                {availableCandidates.map((candidate) => (
                  <label
                    key={candidate.id}
                    className={`flex cursor-pointer items-center rounded p-2 transition ${selectedToAdd.includes(candidate.id)
                        ? isDark
                          ? 'bg-cyan-900'
                          : 'bg-cyan-50'
                        : isDark
                          ? 'hover:bg-gray-600'
                          : 'hover:bg-gray-100'
                      }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedToAdd.includes(candidate.id)}
                      onChange={() => {
                        if (selectedToAdd.includes(candidate.id)) {
                          handleRemoveAddSelection(candidate.id);
                        } else {
                          handleAddParticipant(candidate);
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className={`ml-3 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                      {candidate.full_name || candidate.email}
                      <span className={`ml-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        ({candidate.role})
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Remove Participants Section */}
          {participants.length > 1 && (
            <div>
              <h3 className={`mb-3 font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Current Participants {`(${participants.length})`}
              </h3>
              <div className={`space-y-2 rounded-lg border ${isDark ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-white'} p-3`}>
                {participants.map((participant) => (
                  <label
                    key={participant.user_id}
                    className={`flex cursor-pointer items-center rounded p-2 transition ${selectedToRemove.includes(participant.user_id)
                        ? isDark
                          ? 'bg-rose-900'
                          : 'bg-rose-50'
                        : isDark
                          ? 'hover:bg-gray-600'
                          : 'hover:bg-gray-100'
                      }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedToRemove.includes(participant.user_id)}
                      disabled={participants.length === 1}
                      onChange={() => {
                        if (selectedToRemove.includes(participant.user_id)) {
                          handleRemoveRemoveSelection(participant.user_id);
                        } else {
                          handleSelectRemoveParticipant(participant.user_id);
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <span className={`ml-3 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                      {participant.full_name}
                      {participant.role === 'host' && (
                        <span className="ml-2 rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-semibold text-cyan-800">
                          Host
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {availableCandidates.length === 0 && participants.length <= 1 && (
            <div className={`rounded-lg border-2 border-dashed ${isDark ? 'border-gray-600' : 'border-gray-300'} p-6 text-center`}>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                No participants available to add.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} flex justify-end gap-3 px-6 py-4`}>
          <button
            onClick={() => typeof onClose === 'function' && onClose()}
            disabled={loading}
            className={`rounded-lg px-4 py-2 font-semibold transition ${isDark
                ? 'border border-gray-600 text-gray-300 hover:bg-gray-700'
                : 'border border-gray-300 text-gray-700 hover:bg-gray-100'
              } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || (selectedToAdd.length === 0 && selectedToRemove.length === 0)}
            className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Participants'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManageParticipantsModal;
