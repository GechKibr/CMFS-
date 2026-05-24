import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/api';
import { openRealtimeSocket } from '../../services/realtime';

const formatMessageTime = (value) => {
  if (!value) return '';
  try {
    const date = new Date(value);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString();
  } catch {
    return value;
  }
};

const normalizeEntryType = (value) => {
  const kind = String(value || '').toLowerCase();
  if (kind === 'response' || kind === 'resolution_note' || kind === 'system' || kind === 'escalation') return kind;
  return 'comment';
};

const ComplaintConversation = ({ complaint, role = 'user' }) => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const complaintId = complaint?.complaint_id;
  const [responses, setResponses] = useState([]);
  const [comments, setComments] = useState([]);
  const [draftMessage, setDraftMessage] = useState('');
  const [draftTitle, setDraftTitle] = useState('Officer Response');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connectionState, setConnectionState] = useState('connecting');
  const [error, setError] = useState('');
  const [editingMessage, setEditingMessage] = useState(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const socketRef = useRef(null);
  const listRef = useRef(null);
  const fallbackTimerRef = useRef(null);
  const messageInputRef = useRef(null);

  const loadThread = useCallback(async () => {
    if (!complaintId) return;

    try {
      const [responsesData, commentsData] = await Promise.all([
        apiService.getComplaintResponses(complaintId),
        apiService.getComplaintComments(complaintId),
      ]);

      const normalizedResponses = (responsesData.results ?? responsesData ?? []).map((response) => ({
        ...response,
        entry_type: normalizeEntryType(response.response_type || response.entry_type || 'response'),
      }));
      const normalizedComments = (commentsData.results ?? commentsData ?? []).map((comment) => ({
        ...comment,
        entry_type: normalizeEntryType(comment.comment_type || comment.entry_type || 'comment'),
      }));

      const filteredComments = normalizedComments.filter((c) => {
        const msg = (c.message || '').toString().trim();
        return msg.length > 0;
      });

      setResponses(normalizedResponses);
      setComments(filteredComments);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load complaint conversation');
      setResponses([]);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [complaintId]);

  useEffect(() => {
    if (!complaintId) return;

    let mounted = true;
    setLoading(true);
    setConnectionState('connecting');
    loadThread();

    let socketInstance = null;
    (async () => {
      const maybeSocket = await openRealtimeSocket(`/ws/complaints/${complaintId}/`, {
        onOpen: () => {
          if (mounted) setConnectionState('live');
        },
        onMessage: (event) => {
          if (!mounted) return;
          try {
            const payload = JSON.parse(event.data);
            if (['thread.snapshot', 'thread.updated', 'chat.created', 'notification.updated'].includes(payload.type)) {
              loadThread();
            }
            if (payload.type === 'error' && payload.message) {
              setError(payload.message);
            }
          } catch {
            loadThread();
          }
        },
        onClose: () => {
          if (mounted) setConnectionState('polling');
        },
        onError: () => {
          if (mounted) setConnectionState('polling');
        },
      });

      socketInstance = maybeSocket;
      socketRef.current = socketInstance;
    })();

    fallbackTimerRef.current = setInterval(loadThread, 15000);

    return () => {
      mounted = false;
      if (socketRef.current) socketRef.current.close();
      if (fallbackTimerRef.current) clearInterval(fallbackTimerRef.current);
    };
  }, [complaintId, loadThread]);

  useEffect(() => {
    if (listRef.current && !editingMessage) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [responses, comments, editingMessage]);

  const handleScroll = () => {
    if (listRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = listRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    }
  };

  const scrollToBottom = () => {
    if (listRef.current) {
      listRef.current.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const threadMessages = useMemo(() => {
    const responseMessages = responses.map((response) => ({
      id: response.id,
      kind: 'response',
      author: response.responder || response.author,
      message: response.message,
      title: response.title,
      response_type: response.response_type,
      created_at: response.created_at,
      updated_at: response.updated_at,
      own: response.responder?.id === user?.id,
    }));

    const commentMessages = comments.map((comment) => ({
      id: comment.id,
      kind: 'comment',
      author: comment.author || comment.responder,
      message: comment.message,
      title: null,
      response_type: comment.comment_type,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      own: comment.author?.id === user?.id,
    }));

    return [...responseMessages, ...commentMessages].sort(
      (left, right) => new Date(left.created_at) - new Date(right.created_at),
    );
  }, [responses, comments, user?.id]);

  const sendOverSocket = useCallback((payload) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    socket.send(JSON.stringify(payload));
    return true;
  }, []);

  const submitMessage = async () => {
    const message = draftMessage.trim();
    if (!message) return;
    if (role === 'user' && responses.length === 0) {
      setError('You can comment after an officer responds to your complaint.');
      return;
    }

    setSending(true);
    try {
      const sent = sendOverSocket({
        type: 'chat.message',
        kind: role === 'user' ? 'comment' : 'response',
        complaint_id: complaintId,
        title: role === 'user' ? undefined : (draftTitle || 'Officer Response'),
        message,
        response_type: 'update',
      });

      if (!sent) {
        if (role === 'user') {
          await apiService.createComment({
            complaint: complaintId,
            message,
            comment_type: 'comment',
          });
        } else {
          await apiService.createResponse({
            complaint: complaintId,
            title: draftTitle || 'Officer Response',
            message,
            response_type: 'update',
            is_public: true,
          });
        }
      }

      setDraftMessage('');
      if (role !== 'user') {
        setDraftTitle('Officer Response');
      }
      await loadThread();

      // Focus back on input after sending
      setTimeout(() => {
        messageInputRef.current?.focus();
      }, 100);
    } catch (err) {
      setError(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitMessage();
    }
  };

  const editMessage = async (item) => {
    setEditingMessage(item);
    const nextMessage = window.prompt('Edit message', item.message);
    if (nextMessage == null) {
      setEditingMessage(null);
      return;
    }
    const trimmed = nextMessage.trim();
    if (!trimmed || trimmed === item.message) {
      setEditingMessage(null);
      return;
    }

    try {
      if (item.kind === 'comment') {
        await apiService.updateComment(item.id, { message: trimmed });
      } else {
        await apiService.updateResponse(item.id, {
          title: item.title || 'Officer Response',
          message: trimmed,
          response_type: item.response_type || 'update',
          is_public: true,
        });
      }
      await loadThread();
    } catch (err) {
      setError(err.message || 'Failed to update message');
    } finally {
      setEditingMessage(null);
    }
  };

  const deleteMessage = async (item) => {
    if (!window.confirm('Delete this message?')) return;

    try {
      if (item.kind === 'comment') {
        await apiService.deleteComment(item.id);
      } else {
        await apiService.deleteResponse(item.id);
      }
      await loadThread();
    } catch (err) {
      setError(err.message || 'Failed to delete message');
    }
  };

  const canComment = role === 'user';
  const canRespond = role === 'officer' || role === 'admin';

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 rounded-xl border ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading conversation...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full rounded-xl border ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} shadow-sm overflow-hidden`}>
      {/* Chat Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`w-2 h-2 rounded-full ${connectionState === 'live' ? 'bg-green-500 animate-pulse' : connectionState === 'polling' ? 'bg-yellow-500' : 'bg-gray-400'}`}></div>
          </div>
          <div>
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Conversation Thread
            </h3>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {threadMessages.length} message{threadMessages.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {error && (
          <div className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-600'}`}>
            {error}
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-[400px] max-h-[500px]"
      >
        {threadMessages.length === 0 ? (
          <div className={`flex flex-col items-center justify-center h-full rounded-lg border border-dashed p-8 ${isDark ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
            <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm">No messages yet</p>
            <p className="text-xs mt-1">Be the first to start the conversation</p>
          </div>
        ) : (
          threadMessages.map((item, index) => {
            const isLastMessage = index === threadMessages.length - 1;
            const isResponse = item.kind === 'response';
            const bubbleAlign = isResponse ? 'justify-end' : 'justify-start';
            const bubbleTone = isResponse
              ? isDark
                ? 'bg-blue-600 text-white'
                : 'bg-blue-500 text-white'
              : isDark
                ? 'bg-gray-700 text-gray-100'
                : 'bg-gray-100 text-gray-800';
            const bubbleRounded = isResponse ? 'rounded-l-2xl rounded-br-2xl' : 'rounded-r-2xl rounded-bl-2xl';

            return (
              <div key={`${item.kind}-${item.id}`} className={`flex ${bubbleAlign} ${isLastMessage ? 'mb-2' : ''}`}>
                <div className={`max-w-[70%] ${bubbleAlign === 'justify-end' ? 'items-end' : 'items-start'} flex flex-col`}>
                  {/* Message bubble */}
                  <div className={`relative px-4 py-2 ${bubbleRounded} ${bubbleTone} shadow-sm`}>
                    {/* Author name for non-response messages */}
                    {!isResponse && item.author && (
                      <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {item.author?.first_name || item.author?.username || 'User'}
                      </p>
                    )}

                    {/* Message content */}
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {item.message}
                    </p>

                    {/* Response title */}
                    {isResponse && item.title && (
                      <p className={`text-xs mt-1 font-medium opacity-80 ${isResponse && isDark ? 'text-blue-200' : isResponse ? 'text-blue-100' : ''}`}>
                        📌 {item.title}
                      </p>
                    )}

                    {/* Time stamp */}
                    <div className={`flex items-center gap-2 mt-1 ${isResponse ? 'justify-end' : 'justify-start'}`}>
                      <p className={`text-[10px] opacity-70 ${isResponse ? 'text-blue-100' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {formatMessageTime(item.created_at)}
                      </p>
                      {item.own && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => editMessage(item)}
                            className={`text-[10px] hover:underline ${isResponse ? 'text-blue-100' : isDark ? 'text-gray-300' : 'text-gray-600'}`}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteMessage(item)}
                            className={`text-[10px] hover:underline ${isResponse ? 'text-blue-100' : isDark ? 'text-red-400' : 'text-red-600'}`}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Avatar/Indicator for messages */}
                  <div className={`flex items-center gap-1 mt-1 ${bubbleAlign === 'justify-end' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isResponse
                        ? 'bg-blue-500 text-white'
                        : isDark
                          ? 'bg-gray-600 text-gray-300'
                          : 'bg-gray-300 text-gray-700'
                      }`}>
                      {isResponse ? 'O' : 'U'}
                    </div>
                    <p className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {isResponse ? 'Officer' : (item.author?.first_name || 'User')}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className={`absolute bottom-24 right-6 p-2 rounded-full shadow-lg transition-all ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-white hover:bg-gray-50 text-gray-700'
            } border ${isDark ? 'border-gray-600' : 'border-gray-200'}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}

      {/* Input Area */}
      <div className={`border-t ${isDark ? 'border-gray-700 bg-gray-800/90' : 'border-gray-200 bg-gray-50'} p-4`}>
        {canComment && responses.length === 0 && (
          <div className={`mb-3 p-2 rounded-lg text-xs text-center ${isDark ? 'bg-yellow-900/20 text-yellow-300' : 'bg-yellow-50 text-yellow-700'}`}>
            💡 You can reply once an officer responds to your complaint.
          </div>
        )}

        {canRespond && (
          <div className="mb-3">
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors ${isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-400'
                } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
              placeholder="Response title (optional)"
            />
          </div>
        )}

        <div className="flex gap-2">
          <textarea
            ref={messageInputRef}
            value={draftMessage}
            onChange={(e) => setDraftMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            rows={3}
            disabled={canComment && responses.length === 0}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm outline-none resize-none transition-colors ${isDark
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-400'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed`}
            placeholder={
              canRespond
                ? 'Write your response... (Press Enter to send, Shift+Enter for new line)'
                : 'Write your reply... (Press Enter to send, Shift+Enter for new line)'
            }
          />

          <button
            onClick={submitMessage}
            disabled={sending || !draftMessage.trim() || (canComment && responses.length === 0)}
            className="self-end rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-all hover:bg-blue-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {sending ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Sending</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <span>Send</span>
              </div>
            )}
          </button>
        </div>

        <div className={`mt-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} flex justify-between`}>
          <span>Press <kbd className={`px-1.5 py-0.5 rounded text-xs font-mono ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}>Enter</kbd> to send, <kbd className={`px-1.5 py-0.5 rounded text-xs font-mono ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}>Shift+Enter</kbd> for new line</span>
          <span>{draftMessage.length} characters</span>
        </div>
      </div>
    </div>
  );
};

export default ComplaintConversation;