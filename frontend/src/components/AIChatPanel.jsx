import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './AIChatPanel.css';

const IconSparkle = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
    <path d="M19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8L16.5 17.5l1.8-.7z" />
  </svg>
);

const IconSend = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const IconClose = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconNewChat = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const SESSION_KEY = 'glance_ai_session';

export default function AIChatPanel() {
  const { apiFetch } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(SESSION_KEY));
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || !sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch(`/ai/sessions/${sessionId}/messages`);
        if (!cancelled) {
          setMessages(data.messages || []);
        }
      } catch (err) {
        if (!cancelled) {
          setSessionId(null);
          localStorage.removeItem(SESSION_KEY);
          setMessages([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [open, sessionId]);

  const handleNewChat = () => {
    setSessionId(null);
    localStorage.removeItem(SESSION_KEY);
    setMessages([]);
    setError(null);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const message = input.trim();
    if (!message || loading) return;

    setMessages(prev => [...prev, { role: 'user', content: message }]);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const data = await apiFetch('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message, session_id: sessionId })
      });
      if (data.session_id) {
        setSessionId(String(data.session_id));
        localStorage.setItem(SESSION_KEY, String(data.session_id));
      }
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        className="ai-launcher"
        onClick={() => setOpen(o => !o)}
        title="AI Assistant"
        aria-label="Toggle AI assistant"
      >
        {open ? <IconClose /> : <IconSparkle />}
      </button>

      <div className={`ai-panel ${open ? 'open' : ''}`}>
        <div className="ai-panel-header">
          <span className="ai-panel-title">
            <IconSparkle /> AI Assistant
          </span>
          <button className="ai-panel-new" onClick={handleNewChat} title="New chat" aria-label="New chat">
            <IconNewChat />
          </button>
          <button className="ai-panel-close" onClick={() => setOpen(false)} aria-label="Close">
            <IconClose />
          </button>
        </div>

        <div className="ai-messages" ref={listRef}>
          {messages.length === 0 && !loading && (
            <div className="ai-empty">
              Ask me anything about your projects, tasks, and comments.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`ai-bubble ${m.role}`}>
              {m.content}
            </div>
          ))}
          {loading && (
            <div className="ai-bubble assistant ai-typing">
              <span className="ai-dot" />
              <span className="ai-dot" />
              <span className="ai-dot" />
            </div>
          )}
        </div>

        {error && <div className="ai-error">{error}</div>}

        <form className="ai-input-row" onSubmit={handleSend}>
          <input
            ref={inputRef}
            type="text"
            className="ai-input"
            placeholder="Ask a question..."
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            className="ai-send"
            disabled={loading || !input.trim()}
            aria-label="Send"
          >
            <IconSend />
          </button>
        </form>
      </div>
    </>
  );
}
