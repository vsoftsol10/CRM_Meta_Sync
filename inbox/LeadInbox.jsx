import { useEffect, useState } from 'react';

// Minimal inbox: lists leads captured by the webhook server (GET /api/local-leads),
// shows the message thread for the selected one (GET /api/leads/:id/messages),
// and lets you send a reply (POST /api/reply). Point API_BASE at wherever
// server.js is running (localhost while testing, your Render/VPS URL once deployed).

const API_BASE = 'http://localhost:3000';

export default function LeadInbox() {
  const [leads, setLeads] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/local-leads`)
      .then((r) => r.json())
      .then(setLeads)
      .catch(() => setLeads([]));
  }, []);

  useEffect(() => {
    if (!selected) return;
    fetch(`${API_BASE}/api/leads/${selected.id}/messages`)
      .then((r) => r.json())
      .then(setMessages)
      .catch(() => setMessages([]));
  }, [selected]);

  async function handleSend() {
    if (!draft.trim() || !selected) return;
    setSending(true);
    try {
      await fetch(`${API_BASE}/api/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selected.id,
          channel: selected.channel,
          channelUserId: selected.channelUserId,
          text: draft,
        }),
      });
      setMessages((prev) => [...prev, { direction: 'out', text: draft, at: new Date().toISOString() }]);
      setDraft('');
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ width: 280, borderRight: '1px solid #ddd', overflowY: 'auto' }}>
        <h3 style={{ padding: '12px 16px', margin: 0, borderBottom: '1px solid #ddd' }}>Leads</h3>
        {leads.map((lead) => (
          <div
            key={lead.id}
            onClick={() => setSelected(lead)}
            style={{
              padding: '10px 16px',
              cursor: 'pointer',
              background: selected?.id === lead.id ? '#f0f4ff' : 'transparent',
              borderBottom: '1px solid #eee',
            }}
          >
            <div style={{ fontWeight: 600 }}>{lead.fullName}</div>
            <div style={{ fontSize: 12, color: '#666' }}>{lead.channel}</div>
          </div>
        ))}
        {leads.length === 0 && <div style={{ padding: 16, color: '#888' }}>No leads yet.</div>}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!selected ? (
          <div style={{ margin: 'auto', color: '#888' }}>Select a lead to view the conversation</div>
        ) : (
          <>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #ddd' }}>
              <strong>{selected.fullName}</strong> · {selected.channel}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {messages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    textAlign: m.direction === 'out' ? 'right' : 'left',
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '8px 12px',
                      borderRadius: 12,
                      background: m.direction === 'out' ? '#daf1da' : '#f1f1f1',
                      maxWidth: '70%',
                    }}
                  >
                    {m.text}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', padding: 12, borderTop: '1px solid #ddd', gap: 8 }}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type a reply..."
                style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
              />
              <button onClick={handleSend} disabled={sending}>
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}