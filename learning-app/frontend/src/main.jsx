import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Mindmap } from './Mindmap.jsx';
import './style.css';

const EMPTY = { nodes: [] };
const TABS = { mindmaps: 'Mindmap', lab: 'Lab' };
const DAYS = Array.from({ length: 14 }, (_, index) => index + 1);

async function request(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) throw new Error('Yêu cầu thất bại');
  return response.json();
}

function App() {
  const [day, setDay] = useState(1);
  const [tab, setTab] = useState('mindmaps');
  const [workspace, setWorkspace] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState({});
  const [messages, setMessages] = useState({});
  const key = `${tab}/${day}`;
  const edited = edits[key];
  const draft = edited ?? workspace?.[tab]?.[day] ?? EMPTY;

  async function load() {
    setLoadError(false);
    try {
      setWorkspace(await request('/api/workspace'));
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => { load(); }, []);

  function edit(value) {
    setEdits(current => ({ ...current, [key]: value }));
    setMessages(current => ({ ...current, [key]: '' }));
  }

  async function save() {
    setSaving(current => ({ ...current, [key]: true }));
    setMessages(current => ({ ...current, [key]: '' }));
    try {
      const saved = await request(`/api/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      setWorkspace(current => ({
        ...current,
        [tab]: { ...current[tab], [day]: saved },
      }));
      setEdits(current => {
        if (current[key] !== edited) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
      setMessages(current => ({ ...current, [key]: 'Đã lưu' }));
    } catch {
      setMessages(current => ({ ...current, [key]: 'Lưu chưa thành công. Hãy thử lại.' }));
    } finally {
      setSaving(current => ({ ...current, [key]: false }));
    }
  }

  return (
    <div className="shell">
      <main aria-label={`${TABS[tab]} · Ngày ${day}`}>
        <div className="save-area">
          <span role="status">{messages[key] || (edited ? 'Chưa lưu' : '')}</span>
          <button type="button" onClick={save} disabled={!edited || saving[key]}>
            {saving[key] ? 'Đang lưu…' : 'Lưu'}
          </button>
        </div>
        {!workspace ? (
          <section className="load-state">
            {loadError
              ? <><p>Chưa kết nối được với máy chủ.</p><button type="button" onClick={load}>Thử lại</button></>
              : <p role="status">Đang tải bản nháp…</p>}
          </section>
        ) : (
          <Mindmap key={key} nodes={draft.nodes} onChange={nodes => edit({ nodes })} />
        )}
      </main>
      <footer className="navigation">
        <nav className="tabs" aria-label="Chế độ học">
          {Object.entries(TABS).map(([id, label]) => (
            <button type="button" key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        <nav className="days" aria-label="Ngày học">
          {DAYS.map(number => (
            <button
              type="button" key={number} onClick={() => setDay(number)}
              aria-label={`Ngày ${number}`} aria-current={day === number ? 'step' : undefined}
            >
              {String(number).padStart(2, '0')}
            </button>
          ))}
        </nav>
      </footer>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
