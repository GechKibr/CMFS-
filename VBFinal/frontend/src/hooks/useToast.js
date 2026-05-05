import { useState, useCallback, useMemo } from 'react';

let _id = 0;

const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ type = 'info', title, message, duration = 4000 }) => {
    const id = ++_id;
    setToasts(prev => [...prev, { id, type, title, message, duration }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const success = useCallback((message, title) => addToast({ type: 'success', message, title }), [addToast]);
  const error = useCallback((message, title) => addToast({ type: 'error', message, title }), [addToast]);
  const info = useCallback((message, title) => addToast({ type: 'info', message, title }), [addToast]);
  const warning = useCallback((message, title) => addToast({ type: 'warning', message, title }), [addToast]);

  const toast = useMemo(() => ({ success, error, info, warning }), [success, error, info, warning]);

  return { toasts, toast, removeToast };
};

export default useToast;
