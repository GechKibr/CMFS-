import React, { useState } from 'react';

const ChatComposer = ({ onSend, disabled = false }) => {
  const [text, setText] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || disabled) {
      return;
    }
    await onSend(value);
    setText('');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit(event);
    }
  };

  return (
    <form onSubmit={submit} className="flex max-h-40 flex-shrink-0 items-end gap-3 border-t border-slate-200 bg-white p-4">
      <textarea
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your message..."
        className="max-h-32 min-h-[44px] flex-1 resize-none overflow-y-auto rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Send
      </button>
    </form>
  );
};

export default ChatComposer;
