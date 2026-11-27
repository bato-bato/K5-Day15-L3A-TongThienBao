import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CourseTree } from './CourseTree.jsx';
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

function getDayShortTitle(workspace, day) {
  const root = workspace?.mindmaps?.[day]?.nodes?.find(n => n.node_type === 'day_root');
  if (!root?.text) return `Ngày ${day}`;
  const firstLine = root.text.split('\n')[0].replace(/^Ngày\s+\d+:\s*/i, '').trim();
  return firstLine || `Ngày ${day}`;
}

const NODE_TYPE_LABELS = {
  day_root: 'Chủ đề ngày học',
  concept: 'Khái niệm cốt lõi',
  pattern: 'Mẫu kiến trúc',
  metric: 'Chỉ số & Công thức',
  trap: 'Bẫy & Sai lầm cần tránh',
  case_study: 'Case Study thực tế',
  checkpoint: 'Hackathon Checkpoint',
  code_ref: 'Mã nguồn Code Lab',
  note: 'Ghi chú cá nhân',
};

const INSPECTOR_THEMES = {
  day_root: {
    hero: 'from-blue-600 to-indigo-600 text-white',
    badge: 'bg-white/20 text-white border-white/30',
    accent: 'bg-blue-500',
    icon: '◈',
  },
  concept: {
    hero: 'from-sky-600 to-blue-600 text-white',
    badge: 'bg-white/20 text-white border-white/30',
    accent: 'bg-sky-500',
    icon: '◆',
  },
  pattern: {
    hero: 'from-violet-600 to-purple-600 text-white',
    badge: 'bg-white/20 text-white border-white/30',
    accent: 'bg-violet-500',
    icon: '❖',
  },
  metric: {
    hero: 'from-emerald-600 to-teal-600 text-white',
    badge: 'bg-white/20 text-white border-white/30',
    accent: 'bg-emerald-500',
    icon: '◎',
  },
  trap: {
    hero: 'from-rose-600 to-pink-600 text-white',
    badge: 'bg-white/20 text-white border-white/30',
    accent: 'bg-rose-500',
    icon: '▲',
  },
  case_study: {
    hero: 'from-amber-500 to-orange-600 text-white',
    badge: 'bg-white/20 text-white border-white/30',
    accent: 'bg-amber-500',
    icon: '★',
  },
  checkpoint: {
    hero: 'from-indigo-600 to-blue-700 text-white',
    badge: 'bg-white/20 text-white border-white/30',
    accent: 'bg-indigo-500',
    icon: '⚑',
  },
  code_ref: {
    hero: 'from-teal-600 to-cyan-700 text-white',
    badge: 'bg-white/20 text-white border-white/30',
    accent: 'bg-teal-500',
    icon: '‹›',
  },
  note: {
    hero: 'from-slate-700 to-slate-800 text-white',
    badge: 'bg-white/20 text-white border-white/30',
    accent: 'bg-slate-500',
    icon: '✎',
  },
};

function splitTopLevelCommas(str) {
  const items = [];
  let buf = '';
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '(') depth++;
    else if (ch === ')' && depth > 0) depth--;
    if (ch === ',' && depth === 0) {
      if (buf.trim()) items.push(buf.trim());
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) items.push(buf.trim());
  return items;
}

function renderHighlightedText(text) {
  if (!text) return null;
  const pattern = /(\b(?:Not Yet|No-Go|Go|PASS|FAIL|HITL|VERIFIED|INSUFFICIENT_EVIDENCE)\b|\([^)]{2,60}\))/g;
  const parts = String(text).split(pattern);
  return parts.map((part, idx) => {
    if (!part) return null;
    if (part === 'Go' || part === 'PASS' || part === 'VERIFIED') {
      return (
        <span key={idx} className="inline-block px-1.5 py-0.5 mx-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[11px]">
          {part}
        </span>
      );
    }
    if (part === 'Not Yet') {
      return (
        <span key={idx} className="inline-block px-1.5 py-0.5 mx-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[11px]">
          {part}
        </span>
      );
    }
    if (part === 'No-Go' || part === 'FAIL' || part === 'INSUFFICIENT_EVIDENCE') {
      return (
        <span key={idx} className="inline-block px-1.5 py-0.5 mx-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[11px]">
          {part}
        </span>
      );
    }
    if (part === 'HITL') {
      return (
        <span key={idx} className="inline-block px-1.5 py-0.5 mx-0.5 rounded bg-indigo-100 text-indigo-800 font-bold text-[11px]">
          {part}
        </span>
      );
    }
    if (part.startsWith('(') && part.endsWith(')')) {
      return (
        <span key={idx} className="text-slate-600 font-medium bg-slate-100 px-1 py-0.5 rounded mx-0.5">
          {part}
        </span>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function parseStudySections(rawText) {
  const raw = (rawText || '').trim();
  if (!raw) return { title: '(Chưa có nội dung)', tag: '', blocks: [] };

  const lines = raw.split('\n').map(l => l.trim()).filter(l => l && l !== '—');
  let title = lines[0] || '';
  let tag = '';
  const tagMatch = title.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (tagMatch) {
    tag = tagMatch[1];
    title = tagMatch[2].trim() || title;
  }

  const body = lines.slice(1).join(' ').trim();
  if (!body) return { title, tag, blocks: [] };

  const normalized = body.replace(/\s+(?=\(\d+\)\s)/g, '; ');
  const chunks = normalized
    .split(/;\s+|(?<!\d)\.(?!\d)\s+/)
    .map(c => c.replace(/\.$/, '').trim())
    .filter(Boolean);

  const blocks = chunks.map(chunk => {
    const clean = chunk.replace(/->/g, '→');

    // 1. Formula: "LHS = A + B + C"
    const eqIdx = clean.indexOf(' = ');
    if (eqIdx > 0 && eqIdx <= 42 && !clean.slice(0, eqIdx).includes(':')) {
      const lhs = clean.slice(0, eqIdx).trim();
      const rhs = clean.slice(eqIdx + 3).trim();
      if (rhs.includes(' + ')) {
        const terms = rhs.split(/\s+\+\s+/).map(t => t.trim()).filter(Boolean);
        if (terms.length >= 2) {
          return { kind: 'formula', lhs, terms };
        }
      }
    }

    // Extract "Label: rest" (allow longer descriptive lead-ins up to 120 chars)
    const colonIdx = clean.indexOf(': ');
    const hasLabel = colonIdx > 0 && colonIdx <= 120;
    const label = hasLabel ? clean.slice(0, colonIdx).trim() : '';
    const rest = hasLabel ? clean.slice(colonIdx + 2).trim() : clean;

    // 2. Step Flow: contains arrows "→"
    if (rest.includes('→')) {
      const steps = rest.split(/\s*→\s*/).map(s => s.trim()).filter(Boolean);
      if (steps.length >= 2) {
        return { kind: 'flow', label, steps };
      }
    }

    // 3. Colon-separated List: "Label: item1, item2, item3" (top-level commas)
    if (hasLabel) {
      const items = splitTopLevelCommas(rest);
      if (items.length >= 2 && items.every(i => i.length <= 75)) {
        return { kind: 'list', label, items };
      }
    }

    // 4. Implicit Vietnamese Pillar List: "... đòi hỏi A, B, C, D" or "... gồm A, B, C"
    const verbMatch = clean.match(/^(.{6,60}?\b(?:đòi hỏi|bao gồm|gồm|gồm có|qua \d+ [^:]+))\s+([^:]+)$/i);
    if (verbMatch) {
      const items = splitTopLevelCommas(verbMatch[2]);
      if (items.length >= 3 && items.every(i => i.length <= 40)) {
        return { kind: 'pillars', label: verbMatch[1].trim(), items };
      }
    }

    return { kind: 'point', label, text: rest };
  });

  return { title, tag, blocks };
}

function App() {
  const [view, setView] = useState('tree');
  const [day, setDay] = useState(2);
  const [tab, setTab] = useState('mindmaps');
  const [workspace, setWorkspace] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState({});
  const [messages, setMessages] = useState({});
  const [selectedId, setSelectedId] = useState(null);

  const [dayMenuOpen, setDayMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showGrid, setShowGrid] = useState(true);
  const [layoutTrigger, setLayoutTrigger] = useState(0);

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
  const [nodeGraph, setNodeGraph] = useState({ loading: false, data: null });

  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);

  const key = `${tab}/${day}`;
  const edited = edits[key];
  const draft = edited ?? workspace?.[tab]?.[day] ?? EMPTY;
  const selectedNode = draft.nodes.find(n => n.id === selectedId) || null;
  const activeTitle = getDayShortTitle(workspace, day);

  function selectDay(nextDay) {
    setDay(nextDay);
    setSelectedId(null);
  }

  function switchView(nextView) {
    setView(nextView);
    if (nextView === 'mindmaps' || nextView === 'lab') {
      setTab(nextView);
    }
    setSelectedId(null);
  }

  async function load() {
    setLoadError(false);
    try {
      setWorkspace(await request('/api/workspace'));
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const conceptId = selectedNode?.source_ref?.concept_id;
    if (!conceptId) {
      setNodeGraph({ loading: false, data: null });
      return;
    }
    let cancelled = false;
    setNodeGraph({ loading: true, data: null });
    request(`/api/graph/subgraph?node_id=${encodeURIComponent(conceptId)}&hops=2&direction=both`)
      .then(data => {
        if (!cancelled) setNodeGraph({ loading: false, data });
      })
      .catch(() => {
        if (!cancelled) setNodeGraph({ loading: false, data: null });
      });
    return () => { cancelled = true; };
  }, [selectedNode?.id, selectedNode?.source_ref?.concept_id]);

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    function onClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDayMenuOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onClickOutside);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onClickOutside);
    };
  }, []);

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
      setMessages(current => ({ ...current, [key]: 'Lưu thất bại' }));
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
      setMessages(current => ({ ...current, [key]: 'Đã khôi phục KG' }));
    } catch {
      setMessages(current => ({ ...current, [key]: 'Khôi phục lỗi' }));
    } finally {
      setSaving(current => ({ ...current, [key]: false }));
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-mindmap-d${day}-${tab}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
      setIngestStatus({ ok: false, message: 'Nạp lecture thất bại (kiểm tra nội dung >= 20 ký tự).' });
    } finally {
      setIngestLoading(false);
    }
  }

  function insertVerifiedNode(kRef) {
    if (draft.nodes.length >= 100) return;
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
    const newNode = {
      id,
      text: `[D${kRef.day}${kRef.pdf_pages?.length ? ` tr.${kRef.pdf_pages.join(',')}` : ''}] ${kRef.label}\n${kRef.summary}`,
      x: 160 + (draft.nodes.length % 3) * 370,
      y: 280 + Math.floor(draft.nodes.length / 3) * 210,
      parent_id: draft.nodes[0]?.id ?? null,
      node_type: kRef.type === 'FailureOrTrap' ? 'trap' : 'concept',
      source_ref: {
        concept_id: kRef.concept_id,
        day: kRef.day,
        pdf_pages: kRef.pdf_pages || [],
        section_ref: kRef.section_ref || '',
        key_quote: kRef.key_quote || '',
      },
      code_link: null,
      verification_status: 'verified',
    };
    edit({ nodes: [...draft.nodes, newNode] });
    setSelectedId(id);
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50 text-slate-800">
      {/* TopNavigationBar */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-30 shrink-0 shadow-sm">
        {/* Left: Logo, Project Name, View & Day Dropdown */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm shadow-blue-500/30">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-800 tracking-tight text-sm hidden sm:inline">Sơ đồ Cây Khóa Học AI</span>
              <span className="bg-blue-100 text-blue-700 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-blue-200">
                AI Mindmap
              </span>
            </div>
          </div>

          <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block" />

          {/* Active Topic / Day Selector Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDayMenuOpen(o => !o)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-slate-100 text-xs font-medium text-slate-700 border border-slate-200 transition"
            >
              <span className={`w-2 h-2 rounded-full ${view === 'tree' ? 'bg-blue-600' : tab === 'mindmaps' ? 'bg-emerald-500' : 'bg-purple-500'}`} />
              <span className="truncate max-w-[230px] sm:max-w-[280px]">
                {view === 'tree'
                  ? 'Cây khóa học · 4 Cấp độ · 14 Ngày'
                  : `D${day} · ${tab === 'lab' ? `Lab: ${activeTitle}` : activeTitle}`}
              </span>
              <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </button>

            {dayMenuOpen && (
              <div className="absolute left-0 mt-1.5 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2">
                <div className="flex gap-1 p-1 bg-slate-100 rounded-lg mb-2">
                  {[
                    ['tree', 'Cây khóa học'],
                    ['mindmaps', 'Mindmap'],
                    ['lab', 'Lab'],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => switchView(id)}
                      className={`flex-1 py-1 text-xs font-semibold rounded-md transition ${view === id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="max-h-72 overflow-y-auto space-y-0.5">
                  {DAYS.map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        selectDay(d);
                        if (view === 'tree') setView('mindmaps');
                        setDayMenuOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 transition ${day === d ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                    >
                      <span className={`w-6 text-center font-mono text-[11px] px-1 py-0.5 rounded ${day === d ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                        D{d}
                      </span>
                      <span className="truncate">{getDayShortTitle(workspace, d)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Search Quick Action */}
        <div className="hidden lg:flex items-center">
          <form
            className="relative"
            onSubmit={e => {
              e.preventDefault();
              if (searchQuery.trim()) {
                setMapperOpen(true);
                runMapping(searchQuery.trim());
              }
            }}
          >
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-72 pl-8 pr-12 py-1.5 text-xs bg-slate-100 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-700 transition"
              placeholder="Tìm kiếm khái niệm, tr. sách... (Ctrl+K)"
              type="text"
            />
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1.5 text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-600 px-1.5 py-0.5 rounded font-mono"
              >
                ×
              </button>
            ) : (
              <span className="absolute right-2 top-1.5 text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-mono">
                ⌘K
              </span>
            )}
          </form>
        </div>

        {/* Right: Canvas Controls, Save, Export, AI GraphRAG, Avatar */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowGrid(g => !g)}
            className={`p-1.5 rounded-md transition text-xs flex items-center gap-1 ${showGrid ? 'text-blue-600 bg-blue-50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            title="Bật/Tắt Lưới"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setLayoutTrigger(t => t + 1)}
            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-md transition text-xs flex items-center gap-1"
            title="Tự động căn chỉnh sơ đồ"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </button>

          <div className="h-4 w-px bg-slate-300" />

          {(messages[key] || edited) && (
            <span role="status" className="text-[11px] font-medium text-slate-500 hidden md:inline">
              {messages[key] || 'Chưa lưu'}
            </span>
          )}
          <button
            type="button"
            onClick={save}
            disabled={!edited || saving[key]}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md border border-slate-200 disabled:opacity-45 transition"
          >
            {saving[key] ? 'Đang lưu…' : 'Lưu'}
          </button>

          <button
            type="button"
            onClick={exportJson}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md border border-slate-200 hidden sm:flex items-center gap-1.5 transition"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
            Xuất file
          </button>

          <button
            type="button"
            onClick={() => setMapperOpen(open => !open)}
            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
            AI GraphRAG
          </button>

          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-indigo-600 hidden sm:flex items-center justify-center text-white text-[11px] font-bold border border-white shadow-sm ring-1 ring-slate-200">
            AI
          </div>
        </div>
      </header>

      {/* MainWorkspace */}
      <main className="flex-1 relative overflow-hidden flex" aria-label={`${TABS[tab]} · Ngày ${day}`}>
        {!workspace ? (
          <section className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-slate-500">
            {loadError ? (
              <>
                <p>Chưa kết nối được với máy chủ.</p>
                <button
                  type="button"
                  onClick={load}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                >
                  Thử lại
                </button>
              </>
            ) : (
              <p role="status">Đang tải Knowledge Graph…</p>
            )}
          </section>
        ) : view === 'tree' ? (
          <CourseTree
            workspace={workspace}
            edits={edits}
            contentTab={tab}
            activeDay={day}
            selectedNodeId={selectedId}
            showGrid={showGrid}
            searchQuery={searchQuery}
            layoutTrigger={layoutTrigger}
            onSelectConcept={(targetDay, nodeId) => {
              setDay(targetDay);
              setSelectedId(nodeId);
            }}
            onOpenDayCanvas={targetDay => {
              setDay(targetDay);
              setView(tab);
              setSelectedId(null);
            }}
            onOpenMapper={() => setMapperOpen(open => !open)}
            onSwitchView={switchView}
            onSwitchContentTab={t => { setTab(t); setSelectedId(null); }}
          />
        ) : (
          <Mindmap
            key={key}
            nodes={draft.nodes}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChange={nodes => edit({ nodes })}
            onOpenMapper={() => setMapperOpen(open => !open)}
            onReset={resetToSeed}
            showGrid={showGrid}
            searchQuery={searchQuery}
            layoutTrigger={layoutTrigger}
            day={day}
            tab={tab}
            onSwitchDay={selectDay}
            onSwitchTab={t => { setTab(t); setView(t); setSelectedId(null); }}
            onSwitchView={switchView}
          />
        )}

        {/* Provenance & Structured Study Inspector Drawer (Right) */}
        {selectedNode && (() => {
          const study = parseStudySections(selectedNode.text);
          const typeKey = selectedNode.node_type || 'note';
          const typeLabel = NODE_TYPE_LABELS[typeKey] || typeKey;
          const theme = INSPECTOR_THEMES[typeKey] || INSPECTOR_THEMES.note;
          const conceptId = selectedNode.source_ref?.concept_id;
          const gData = nodeGraph.data;
          const selfGraphNode = gData?.nodes?.find(n => n.id === conceptId);
          const keywords = selfGraphNode?.keywords || [];
          const relatedConcepts = (gData?.nodes || []).filter(
            n => n.node_kind === 'concept' && n.id !== conceptId && n.type !== 'DayModule'
          ).slice(0, 4);
          const appliedTargets = (gData?.nodes || []).filter(
            n => n.node_kind === 'checkpoint' || n.node_kind === 'code_symbol'
          ).slice(0, 4);
          const topCommunity = gData?.communities?.[0] || null;

          return (
            <aside
              className="fixed top-16 right-4 bottom-20 w-[min(450px,calc(100vw-2rem))] bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-2xl z-30 flex flex-col overflow-hidden"
              aria-label="Kiểm chứng nguồn nút"
            >
              {/* Colored Hero Header */}
              <div className={`bg-gradient-to-r ${theme.hero} px-4 py-3.5 shrink-0`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${theme.badge}`}>
                      {theme.icon} {typeLabel}
                    </span>
                    {selectedNode.verification_status === 'verified' && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-400/25 border border-emerald-200/40 text-white text-[10.5px] font-semibold">
                        ✓ Verified
                      </span>
                    )}
                    {selectedNode.source_ref?.pdf_pages?.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-black/20 text-white text-[10.5px] font-mono">
                        D{selectedNode.source_ref.day} · Tr.{selectedNode.source_ref.pdf_pages.join(',')}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="text-white/80 hover:text-white hover:bg-white/15 px-1.5 py-0.5 rounded-md text-sm font-bold"
                  >
                    ×
                  </button>
                </div>
                <h3 className="text-[15.5px] font-bold leading-snug text-white">
                  {study.title}
                </h3>
              </div>

              <div className="p-4 overflow-y-auto space-y-3.5 text-xs select-text">
                {/* Key Quote Callout (prominent at top when available) */}
                {selectedNode.source_ref?.key_quote && (
                  <div className="bg-amber-50/90 border border-amber-200 border-l-4 border-l-amber-500 rounded-xl p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">
                      💡 Điểm cốt lõi cần nhớ
                    </div>
                    <blockquote className="text-[12.5px] font-medium text-slate-800 leading-relaxed">
                      “{selectedNode.source_ref.key_quote.replace(/->/g, '→')}”
                    </blockquote>
                  </div>
                )}

                {/* Parsed Study Blocks */}
                {study.blocks.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                      Nội dung trọng tâm ({study.blocks.length} ý)
                    </div>
                    {study.blocks.map((blk, idx) => {
                      if (blk.kind === 'formula') {
                        return (
                          <div key={idx} className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-3 space-y-2">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                              Công thức / Cấu trúc
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-[11.5px]">
                                {blk.lhs}
                              </span>
                              <span className="text-indigo-500 font-bold">=</span>
                              {blk.terms.map((term, tIdx) => (
                                <React.Fragment key={tIdx}>
                                  {tIdx > 0 && <span className="text-indigo-400 font-bold">+</span>}
                                  <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-slate-800 font-semibold text-[11.5px] shadow-sm">
                                    {term}
                                  </span>
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      if (blk.kind === 'flow') {
                        return (
                          <div key={idx} className="bg-sky-50/80 border border-sky-200 rounded-xl p-3 space-y-2">
                            {blk.label && (
                              <div className="text-[11.5px] font-bold text-sky-900">{renderHighlightedText(blk.label)}</div>
                            )}
                            <div className="flex flex-wrap items-center gap-1.5">
                              {blk.steps.map((step, sIdx) => (
                                <React.Fragment key={sIdx}>
                                  {sIdx > 0 && <span className="text-sky-500 font-bold">→</span>}
                                  <span className="px-2.5 py-1 rounded-lg bg-white border border-sky-200 text-slate-800 font-semibold text-[11.5px] shadow-sm">
                                    {step}
                                  </span>
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      if (blk.kind === 'pillars') {
                        return (
                          <div key={idx} className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 space-y-2">
                            <div className="text-[11.5px] font-bold text-emerald-950">
                              {renderHighlightedText(blk.label)}
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              {blk.items.map((item, iIdx) => (
                                <div
                                  key={iIdx}
                                  className="flex items-center gap-2 bg-white border border-emerald-200/80 rounded-lg px-2.5 py-1.5 shadow-sm"
                                >
                                  <span className="w-5 h-5 rounded-md bg-emerald-600 text-white font-mono text-[10px] font-bold grid place-items-center shrink-0">
                                    0{iIdx + 1}
                                  </span>
                                  <span className="font-semibold text-slate-800 text-[11.5px] leading-tight">
                                    {item}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      if (blk.kind === 'list') {
                        return (
                          <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                            <div className="text-[11.5px] font-bold text-slate-900 leading-snug">
                              {renderHighlightedText(blk.label)}
                            </div>
                            <div className="space-y-1.5">
                              {blk.items.map((item, iIdx) => (
                                <div
                                  key={iIdx}
                                  className="flex items-start gap-2 bg-white border border-slate-200/90 rounded-lg px-2.5 py-1.5"
                                >
                                  <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] grid place-items-center shrink-0 mt-0.5">
                                    {iIdx + 1}
                                  </span>
                                  <span className="text-slate-800 font-medium text-[11.5px] leading-snug">
                                    {renderHighlightedText(item)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={idx} className="flex items-start gap-2.5 bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
                          <span className={`mt-1.5 w-2 h-2 rounded-full ${theme.accent} shrink-0`} />
                          <div className="text-slate-700 leading-relaxed text-[12px]">
                            {blk.label && (
                              <strong className="text-slate-900 mr-1">{renderHighlightedText(blk.label)}:</strong>
                            )}
                            <span>{renderHighlightedText(blk.text)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Keywords from Graph DB */}
                {keywords.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                      Từ khóa cần nắm
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {keywords.map(kw => (
                        <span
                          key={kw}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[10.5px]"
                        >
                          #{kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Live GraphRAG Links: Applied Checkpoints, Code & Related Concepts */}
                {(appliedTargets.length > 0 || relatedConcepts.length > 0 || topCommunity) && (
                  <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-purple-950 text-[12px]">
                        Mạng tri thức GraphRAG (Lý thuyết ↔ Thực hành)
                      </span>
                      {topCommunity && (
                        <span className="px-2 py-0.5 rounded-full bg-white border border-purple-200 text-purple-700 text-[10px] font-semibold">
                          {topCommunity.community_id}
                        </span>
                      )}
                    </div>

                    {appliedTargets.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
                          Áp dụng trong Checkpoint & Code Lab
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {appliedTargets.map(t => (
                            <span
                              key={t.id}
                              className={`px-2 py-1 rounded-lg border text-[11px] font-medium ${t.node_kind === 'checkpoint'
                                  ? 'bg-indigo-100/80 border-indigo-200 text-indigo-900 font-semibold'
                                  : 'bg-teal-50 border-teal-200 text-teal-900 font-mono text-[10.5px]'
                                }`}
                            >
                              {t.node_kind === 'checkpoint' ? `⚑ ${t.id}` : `‹› ${t.label}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {relatedConcepts.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
                          Khái niệm liên kết ({relatedConcepts.length})
                        </div>
                        <div className="space-y-1">
                          {relatedConcepts.map(rc => (
                            <button
                              key={rc.id}
                              type="button"
                              onClick={() => {
                                if (rc.day >= 1 && rc.day <= 14) {
                                  selectDay(rc.day);
                                  const targetNodes = (edits[`${tab}/${rc.day}`] ?? workspace?.[tab]?.[rc.day])?.nodes || [];
                                  const match = targetNodes.find(n => n.source_ref?.concept_id === rc.id);
                                  if (match) setSelectedId(match.id);
                                }
                              }}
                              className="w-full text-left px-2.5 py-1.5 rounded-lg bg-white hover:bg-purple-100/60 border border-purple-200/80 flex items-center justify-between gap-2 transition"
                            >
                              <span className="truncate font-medium text-slate-800 text-[11.5px]">
                                → {rc.label}
                              </span>
                              <span className="text-[10px] font-mono text-purple-700 shrink-0">
                                D{rc.day}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Lecture Provenance Metadata */}
                {selectedNode.source_ref && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700 text-[11.5px]">Truy vết Nguồn (Provenance)</span>
                      <code className="bg-white px-2 py-0.5 rounded-md border border-slate-200 text-blue-700 text-[10.5px] font-semibold">
                        {selectedNode.source_ref.concept_id}
                      </code>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="bg-white rounded-lg px-2.5 py-1.5 border border-slate-200/80">
                        <div className="text-[9.5px] uppercase tracking-wider text-slate-400 font-semibold">Trang PDF</div>
                        <div className="font-semibold text-slate-800">
                          Ngày {selectedNode.source_ref.day} · Tr. {selectedNode.source_ref.pdf_pages?.join(', ') || '—'}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg px-2.5 py-1.5 border border-slate-200/80">
                        <div className="text-[9.5px] uppercase tracking-wider text-slate-400 font-semibold">Mục giáo trình</div>
                        <div className="font-semibold text-slate-800 truncate" title={selectedNode.source_ref.section_ref}>
                          {selectedNode.source_ref.section_ref}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedNode.code_link && (
                  <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-3.5 space-y-1.5">
                    <div className="font-bold text-teal-900">Liên kết Code Lab (Repo Parser AST)</div>
                    <div><strong>File:</strong> <code className="bg-white px-1.5 py-0.5 rounded border border-teal-100">{selectedNode.code_link.file_path}</code></div>
                    {selectedNode.code_link.symbol && (
                      <div><strong>Hàm / Lớp:</strong> <code className="bg-white px-1.5 py-0.5 rounded border border-teal-100">{selectedNode.code_link.symbol}()</code></div>
                    )}
                    <div><strong>Dòng:</strong> L{selectedNode.code_link.line_start}–L{selectedNode.code_link.line_end}</div>
                  </div>
                )}

                {study.title && (
                  <button
                    type="button"
                    onClick={() => {
                      setMapperOpen(true);
                      runMapping(study.title);
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
                  >
                    <span>⚡</span> Khám phá GraphRAG & Code Lab cho nút này →
                  </button>
                )}
              </div>
            </aside>
          );
        })()}

        {/* AI Lecture-to-Lab GraphRAG Mapper Drawer (Left) */}
        {mapperOpen && (
          <aside
            className="fixed top-16 left-16 bottom-20 w-[min(430px,calc(100vw-5rem))] bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-2xl z-30 flex flex-col overflow-hidden"
            aria-label="AI Lecture-to-Lab Mapper"
          >
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <strong className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                AI Lecture-to-Lab GraphRAG & Guardrails
              </strong>
              <button
                type="button"
                onClick={() => setMapperOpen(false)}
                className="text-slate-400 hover:text-slate-700 px-1.5 py-0.5 rounded hover:bg-slate-200/60"
              >
                ×
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3 text-xs select-text">
              <div className="flex flex-wrap gap-1.5">
                {QUICK_QUERIES.map(q => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => runMapping(q)}
                    className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[11px] font-medium transition"
                  >
                    {q}
                  </button>
                ))}
              </div>

              <form className="flex gap-2" onSubmit={e => { e.preventDefault(); runMapping(); }}>
                <input
                  type="text"
                  value={mapQuery}
                  onChange={e => setMapQuery(e.target.value)}
                  className="flex-1 min-w-0 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Nhập Checkpoint, hàm hoặc khái niệm..."
                />
                <button
                  type="submit"
                  disabled={mapLoading}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50"
                >
                  {mapLoading ? 'Đang ánh xạ…' : 'Ánh xạ'}
                </button>
              </form>

              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-1">
                  {[
                    ['graphrag', 'Lv3 GraphRAG'],
                    ['level2', 'Lv2 Hybrid'],
                    ['level1', 'Lv1 Direct'],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setMapMode(id)}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium border transition ${mapMode === id
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  {[
                    ['both', '2 chiều'],
                    ['theory_to_practice', 'Theory → Practice'],
                    ['practice_to_theory', 'Practice → Theory'],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setMapDirection(id)}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium border transition ${mapDirection === id
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-slate-600">
                <input
                  type="checkbox"
                  checked={mapScopeDay}
                  onChange={e => setMapScopeDay(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Chỉ tìm trong Ngày {day}
              </label>

              {mapResult && (
                <div className="space-y-2.5">
                  <div className={`px-3 py-2 rounded-lg font-semibold ${mapResult.blocked
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : mapResult.abstention
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                    {mapResult.blocked
                      ? '🛑 Input Guardrail: Đã chặn Prompt Injection'
                      : mapResult.abstention
                        ? '⚠️ INSUFFICIENT_EVIDENCE: Ngoài phạm vi tài liệu'
                        : `✅ Source Verifier (${mapResult.mode || 'graphrag'}): Kiểm chứng 100%`}
                  </div>

                  <p className="text-slate-700 leading-relaxed">{mapResult.explanation}</p>

                  {mapResult.communities?.length > 0 && (
                    <div className="bg-indigo-50/70 border border-indigo-200 rounded-lg p-2.5 space-y-1.5">
                      <div className="font-bold text-indigo-900">Graph Communities ({mapResult.communities.length})</div>
                      <div className="flex flex-wrap gap-1">
                        {mapResult.communities.map(c => (
                          <span
                            key={c.community_id}
                            title={c.summary}
                            className="px-2 py-0.5 rounded-full bg-white border border-indigo-200 text-indigo-800 text-[11px]"
                          >
                            {c.community_id}: {c.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {mapResult.subgraph?.paths?.length > 0 && (
                    <div className="bg-purple-50/60 border border-purple-200 rounded-lg p-2.5 space-y-1.5">
                      <div className="font-bold text-purple-900">
                        GraphRAG Multi-hop ({mapResult.subgraph.nodes?.length || 0} nút · {mapResult.subgraph.edges?.length || 0} cạnh)
                      </div>
                      <ul className="space-y-1 pl-3 list-disc text-[11px]">
                        {mapResult.subgraph.paths.slice(0, 8).map((p, idx) => (
                          <li key={idx}>
                            <span className="font-semibold text-slate-800">{p.from_label}</span>
                            <span className="mx-1 px-1 py-0.5 rounded bg-purple-100 text-purple-800 font-mono text-[10px]">
                              [{p.relation}]
                            </span>
                            <span className="font-semibold text-slate-800">{p.to_label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {mapResult.trap_warnings?.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-red-800 space-y-1">
                      <div className="font-bold">Cảnh báo Bẫy (Guardrails)</div>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {mapResult.trap_warnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                  )}

                  {mapResult.code_refs?.length > 0 && (
                    <div className="bg-teal-50/70 border border-teal-200 rounded-lg p-2.5 space-y-1">
                      <div className="font-bold text-teal-900">Code Repo Đối chiếu</div>
                      {mapResult.code_refs.map((c, i) => (
                        <div key={i} className="font-mono text-[11px] text-teal-900">
                          {c.file_path}{c.symbol ? `:${c.symbol}()` : ''} (L{c.line_start}–{c.line_end})
                        </div>
                      ))}
                    </div>
                  )}

                  {mapResult.knowledge_refs?.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-2">
                      <div className="font-bold text-slate-800">Nút Tri thức Lecture ({mapResult.knowledge_refs.length})</div>
                      {mapResult.knowledge_refs.map(k => (
                        <div key={k.concept_id} className="pt-2 border-t border-slate-200 space-y-1">
                          <div className="font-semibold text-slate-900">
                            [Ngày {k.day}{k.pdf_pages?.length ? ` · tr.${k.pdf_pages.join(',')}` : ''}] {k.label}
                          </div>
                          <p className="text-slate-600 leading-snug">{k.summary}</p>
                          <button
                            type="button"
                            onClick={() => insertVerifiedNode(k)}
                            className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold text-[11px]"
                          >
                            + Thêm vào Canvas
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Multi-Lecture Ingestion */}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <button
                  type="button"
                  onClick={() => setIngestOpen(o => !o)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/70 font-semibold text-slate-700"
                >
                  {ingestOpen ? '▾ Ẩn nạp Lecture mới (Multi-Lecture)' : '▸ Nạp Lecture mới (Multi-Lecture GraphRAG)'}
                </button>
                {ingestOpen && (
                  <form className="space-y-2" onSubmit={runIngest}>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={ingestTitle}
                        onChange={e => setIngestTitle(e.target.value)}
                        placeholder="Tiêu đề Lecture..."
                        className="flex-1 min-w-0 border border-slate-300 rounded-lg px-2 py-1 text-xs"
                        required
                      />
                      <input
                        type="number"
                        min="1"
                        max="14"
                        value={ingestDay}
                        onChange={e => setIngestDay(e.target.value)}
                        className="w-16 border border-slate-300 rounded-lg px-2 py-1 text-xs"
                      />
                    </div>
                    <textarea
                      rows={3}
                      value={ingestContent}
                      onChange={e => setIngestContent(e.target.value)}
                      placeholder="Dán nội dung Markdown (# Heading...) để trích Concept & nối Graph..."
                      className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                      required
                    />
                    <button
                      type="submit"
                      disabled={ingestLoading}
                      className="w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    >
                      {ingestLoading ? 'Đang trích xuất & nối Graph…' : 'Nạp vào GraphRAG DB'}
                    </button>
                    {ingestStatus && (
                      <div className={`px-2.5 py-1.5 rounded-lg font-medium ${ingestStatus.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                        {ingestStatus.ok
                          ? `✅ Đã nạp ${ingestStatus.data.lecture_id}: +${ingestStatus.data.nodes_added} nút, +${ingestStatus.data.edges_added} cạnh (${ingestStatus.data.cross_links_created} liên kết chéo).`
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
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
