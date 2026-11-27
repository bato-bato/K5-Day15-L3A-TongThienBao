import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Mindmap } from './Mindmap.jsx';
import './style.css';

const EMPTY = { nodes: [] };
const TABS = { mindmaps: 'Mindmap (KG)', lab: 'Lab Mapping' };
const DAYS = Array.from({ length: 14 }, (_, index) => index + 1);
const QUICK_QUERIES = ['CP1', 'CP2', 'CP3', 'CP4', 'Lethal Trifecta', 'Cost-of-Pass', 'Rogan-Gladen', 'FTS5'];

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
  const [selectedId, setSelectedId] = useState(null);
  const [mapperOpen, setMapperOpen] = useState(false);
  const [mapQuery, setMapQuery] = useState('CP3');
  const [mapScopeDay, setMapScopeDay] = useState(false);
  const [mapMode, setMapMode] = useState('graphrag');
  const [mapDirection, setMapDirection] = useState('both');
  const [mapLoading, setMapLoading] = useState(false);
  const [mapResult, setMapResult] = useState(null);
  const [ingestOpen, setIngestOpen] = useState(false);
  const [ingestTitle, setIngestTitle] = useState('');
  const [ingestDay, setIngestDay] = useState(14);
  const [ingestContent, setIngestContent] = useState('');
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestStatus, setIngestStatus] = useState(null);

  const key = `${tab}/${day}`;
  const edited = edits[key];
  const draft = edited ?? workspace?.[tab]?.[day] ?? EMPTY;
  const selectedNode = draft.nodes.find(n => n.id === selectedId) || null;

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

  async function resetToSeed() {
    setSaving(current => ({ ...current, [key]: true }));
    try {
      const seeded = await request(`/api/reset/${key}`, { method: 'POST' });
      setWorkspace(current => ({
        ...current,
        [tab]: { ...current[tab], [day]: seeded },
      }));
      setEdits(current => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setSelectedId(null);
      setMessages(current => ({ ...current, [key]: 'Đã khôi phục KG chuẩn' }));
    } catch {
      setMessages(current => ({ ...current, [key]: 'Khôi phục thất bại.' }));
    } finally {
      setSaving(current => ({ ...current, [key]: false }));
    }
  }

  async function runMapping(overrideQuery) {
    const q = (overrideQuery ?? mapQuery).trim();
    if (!q) return;
    if (overrideQuery !== undefined) setMapQuery(overrideQuery);
    setMapLoading(true);
    try {
      const data = await request('/api/map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          day: mapScopeDay ? day : null,
          mode: mapMode,
          direction: mapDirection,
        }),
      });
      setMapResult(data);
    } catch {
      setMapResult({
        blocked: true,
        abstention: true,
        explanation: 'Lỗi kết nối tới API /api/map.',
        knowledge_refs: [],
        code_refs: [],
        trap_warnings: [],
      });
    } finally {
      setMapLoading(false);
    }
  }

  async function runIngest(event) {
    event.preventDefault();
    if (!ingestTitle.trim() || ingestContent.trim().length < 20) return;
    setIngestLoading(true);
    setIngestStatus(null);
    try {
      const res = await request('/api/lectures/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: ingestTitle.trim(),
          content: ingestContent.trim(),
          day: Number(ingestDay) || 14,
          source_file: 'ui_lecture.md',
        }),
      });
      setIngestStatus({ ok: true, data: res });
      setIngestTitle('');
      setIngestContent('');
    } catch {
      setIngestStatus({ ok: false, message: 'Nạp lecture thất bại (kiểm tra độ dài >= 20 ký tự hoặc nội dung hợp lệ).' });
    } finally {
      setIngestLoading(false);
    }
  }

  function insertVerifiedNode(kRef) {
    if (draft.nodes.length >= 100) return;
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
    const newNode = {
      id,
      text: `[D${kRef.day} tr.${kRef.pdf_pages.join(',')}] ${kRef.label}\n${kRef.summary}`,
      x: 60 + (draft.nodes.length % 3) * 320,
      y: 60 + Math.floor(draft.nodes.length / 3) * 190,
      parent_id: draft.nodes[0]?.id ?? null,
      node_type: kRef.type === 'FailureOrTrap' ? 'trap' : 'concept',
      source_ref: {
        concept_id: kRef.concept_id,
        day: kRef.day,
        pdf_pages: kRef.pdf_pages,
        section_ref: kRef.section_ref,
        key_quote: kRef.key_quote,
      },
      code_link: null,
      verification_status: 'verified',
    };
    edit({ nodes: [...draft.nodes, newNode] });
    setSelectedId(id);
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
              : <p role="status">Đang tải Knowledge Graph…</p>}
          </section>
        ) : (
          <Mindmap
            key={key}
            nodes={draft.nodes}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChange={nodes => edit({ nodes })}
            onOpenMapper={() => setMapperOpen(open => !open)}
            onReset={resetToSeed}
          />
        )}

        {selectedNode && (
          <aside className="side-drawer inspector" aria-label="Kiểm chứng nguồn nút">
            <div className="drawer-header">
              <strong>Kiểm chứng Nguồn (Provenance)</strong>
              <button type="button" onClick={() => setSelectedId(null)}>×</button>
            </div>
            <div className="drawer-body">
              <div className="pill-row">
                <span className={`status-pill ${selectedNode.verification_status || 'user_note'}`}>
                  {selectedNode.verification_status === 'verified' ? '✓ Verified Source' : 'Ghi chú cá nhân'}
                </span>
                <span className="type-pill">{selectedNode.node_type || 'note'}</span>
              </div>
              <p className="node-full-text">{selectedNode.text}</p>

              {selectedNode.source_ref && (
                <div className="info-card">
                  <div className="info-title">Tài liệu Lecture Gốc</div>
                  <div><strong>Concept ID:</strong> <code>{selectedNode.source_ref.concept_id}</code></div>
                  <div><strong>Ngày / Trang PDF:</strong> Ngày {selectedNode.source_ref.day} · Trang {selectedNode.source_ref.pdf_pages?.join(', ')}</div>
                  <div><strong>Mục:</strong> {selectedNode.source_ref.section_ref}</div>
                  {selectedNode.source_ref.key_quote && (
                    <blockquote>“{selectedNode.source_ref.key_quote}”</blockquote>
                  )}
                </div>
              )}

              {selectedNode.code_link && (
                <div className="info-card code-card">
                  <div className="info-title">Liên kết Code Lab (Repo Parser AST)</div>
                  <div><strong>File:</strong> <code>{selectedNode.code_link.file_path}</code></div>
                  {selectedNode.code_link.symbol && (
                    <div><strong>Hàm / Lớp:</strong> <code>{selectedNode.code_link.symbol}()</code></div>
                  )}
                  <div><strong>Dòng:</strong> L{selectedNode.code_link.line_start}–L{selectedNode.code_link.line_end}</div>
                </div>
              )}
            </div>
          </aside>
        )}

        {mapperOpen && (
          <aside className="side-drawer mapper-drawer" aria-label="AI Lecture-to-Lab Mapper">
            <div className="drawer-header">
              <strong>AI Lecture-to-Lab Mapping & Guardrails</strong>
              <button type="button" onClick={() => setMapperOpen(false)}>×</button>
            </div>
            <div className="drawer-body">
              <div className="quick-chips">
                {QUICK_QUERIES.map(q => (
                  <button key={q} type="button" className="chip-btn" onClick={() => runMapping(q)}>{q}</button>
                ))}
              </div>
              <form className="mapper-form" onSubmit={e => { e.preventDefault(); runMapping(); }}>
                <input
                  type="text"
                  value={mapQuery}
                  onChange={e => setMapQuery(e.target.value)}
                  placeholder="Nhập Checkpoint, tên hàm hoặc khái niệm (vd: CP3, FTS5, Cost-of-Pass)..."
                />
                <button type="submit" disabled={mapLoading}>
                  {mapLoading ? 'Đang ánh xạ…' : 'Ánh xạ'}
                </button>
              </form>
              <div className="graphrag-controls">
                <div className="segmented-group" role="group" aria-label="Cấp độ Pipeline">
                  {[
                    ['graphrag', 'Lv3 GraphRAG'],
                    ['level2', 'Lv2 Hybrid'],
                    ['level1', 'Lv1 Direct'],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={mapMode === id ? 'seg-btn is-active' : 'seg-btn'}
                      onClick={() => setMapMode(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="segmented-group" role="group" aria-label="Chiều ánh xạ">
                  {[
                    ['both', '2 chiều'],
                    ['theory_to_practice', 'Theory → Practice'],
                    ['practice_to_theory', 'Practice → Theory'],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={mapDirection === id ? 'seg-btn is-active' : 'seg-btn'}
                      onClick={() => setMapDirection(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="scope-toggle">
                <input type="checkbox" checked={mapScopeDay} onChange={e => setMapScopeDay(e.target.checked)} />
                Chỉ tìm trong Ngày {day}
              </label>

              {mapResult && (
                <div className="map-result">
                  <div className={`guard-banner ${mapResult.blocked ? 'is-blocked' : mapResult.abstention ? 'is-abstain' : 'is-pass'}`}>
                    {mapResult.blocked
                      ? '🛑 Input Guardrail: Đã chặn Prompt Injection'
                      : mapResult.abstention
                        ? '⚠️ INSUFFICIENT_EVIDENCE: Ngoài phạm vi tài liệu'
                        : `✅ Source Verifier (${mapResult.mode || 'graphrag'}): Đã kiểm chứng 100% nguồn & Graph`}
                  </div>

                  <p className="map-explanation">{mapResult.explanation}</p>

                  {mapResult.communities?.length > 0 && (
                    <div className="info-card community-card">
                      <div className="info-title">Graph Communities ({mapResult.communities.length})</div>
                      <div className="community-badges">
                        {mapResult.communities.map(c => (
                          <span key={c.community_id} className="comm-badge" title={c.summary}>
                            {c.community_id}: {c.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {mapResult.subgraph?.paths?.length > 0 && (
                    <div className="info-card graph-card">
                      <div className="info-title">
                        GraphRAG Multi-hop Subgraph ({mapResult.subgraph.nodes?.length || 0} nút · {mapResult.subgraph.edges?.length || 0} cạnh)
                      </div>
                      <ul className="graph-paths">
                        {mapResult.subgraph.paths.slice(0, 8).map((p, idx) => (
                          <li key={idx}>
                            <span className="path-node">{p.from_label}</span>
                            <span className="path-rel">[{p.relation}]</span>
                            <span className="path-node">{p.to_label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {mapResult.trap_warnings?.length > 0 && (
                    <div className="info-card trap-card">
                      <div className="info-title">Cảnh báo Bẫy (Guardrail Warnings)</div>
                      <ul>
                        {mapResult.trap_warnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                  )}

                  {mapResult.code_refs?.length > 0 && (
                    <div className="info-card code-card">
                      <div className="info-title">Code Repo Đối chiếu</div>
                      {mapResult.code_refs.map((c, i) => (
                        <div key={i} className="ref-item">
                          <code>{c.file_path}{c.symbol ? `:${c.symbol}()` : ''}</code> (L{c.line_start}–{c.line_end})
                        </div>
                      ))}
                    </div>
                  )}

                  {mapResult.knowledge_refs?.length > 0 && (
                    <div className="info-card">
                      <div className="info-title">Nút Tri thức Lecture ({mapResult.knowledge_refs.length})</div>
                      {mapResult.knowledge_refs.map(k => (
                        <div key={k.concept_id} className="kg-hit">
                          <div>
                            <strong>[Ngày {k.day}{k.pdf_pages?.length ? ` · tr.${k.pdf_pages.join(',')}` : ''}] {k.label}</strong>
                            <p>{k.summary}</p>
                          </div>
                          <button type="button" className="insert-btn" onClick={() => insertVerifiedNode(k)}>
                            + Thêm vào Canvas
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="ingest-section">
                <button
                  type="button"
                  className="ingest-toggle"
                  onClick={() => setIngestOpen(open => !open)}
                >
                  {ingestOpen ? '▾ Ẩn nạp Lecture mới (Multi-Lecture)' : '▸ Nạp Lecture mới (Multi-Lecture GraphRAG)'}
                </button>
                {ingestOpen && (
                  <form className="ingest-form" onSubmit={runIngest}>
                    <div className="ingest-row">
                      <input
                        type="text"
                        value={ingestTitle}
                        onChange={e => setIngestTitle(e.target.value)}
                        placeholder="Tiêu đề Lecture (vd: GraphRAG & Agent Memory)"
                        required
                      />
                      <input
                        type="number"
                        min="1"
                        max="14"
                        value={ingestDay}
                        onChange={e => setIngestDay(e.target.value)}
                        title="Ngày học (1-14)"
                        className="day-input"
                      />
                    </div>
                    <textarea
                      rows={4}
                      value={ingestContent}
                      onChange={e => setIngestContent(e.target.value)}
                      placeholder="Dán nội dung Markdown (# Heading...) để trích Concept & nối vào Graph DB..."
                      required
                    />
                    <button type="submit" disabled={ingestLoading}>
                      {ingestLoading ? 'Đang trích xuất & nối Graph…' : 'Nạp vào GraphRAG DB'}
                    </button>
                    {ingestStatus && (
                      <div className={`guard-banner ${ingestStatus.ok ? 'is-pass' : 'is-blocked'}`}>
                        {ingestStatus.ok
                          ? `✅ Đã nạp ${ingestStatus.data.lecture_id}: +${ingestStatus.data.nodes_added} nút, +${ingestStatus.data.edges_added} cạnh (${ingestStatus.data.cross_links_created} liên kết chéo), ${ingestStatus.data.communities_count} cụm.`
                          : ingestStatus.message}
                      </div>
                    )}
                  </form>
                )}
              </div>
            </div>
          </aside>
        )}
      </main>
      <footer className="navigation">
        <nav className="tabs" aria-label="Chế độ học">
          {Object.entries(TABS).map(([id, label]) => (
            <button type="button" key={id} aria-pressed={tab === id} onClick={() => { setTab(id); setSelectedId(null); }}>
              {label}
            </button>
          ))}
        </nav>
        <nav className="days" aria-label="Ngày học">
          {DAYS.map(number => (
            <button
              type="button" key={number} onClick={() => { setDay(number); setSelectedId(null); }}
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
