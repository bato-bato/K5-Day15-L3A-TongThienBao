import React, { useEffect, useRef, useState } from 'react';

const MAX_POSITION = 4096;
const MAX_NODES = 100;
const CANVAS_W = 2400;
const CANVAS_H = 1400;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.45;
const clamp = value => Math.max(0, Math.min(MAX_POSITION, Math.round(value)));
const clampZoom = value => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(value.toFixed(2))));

const PASTEL_PALETTE = {
  blue: { label: 'Xanh biển', bg: '#B5D3FA', border: '#60A5FA', text: '#0F172A', mini: 'bg-blue-400' },
  pink: { label: 'Hồng phấn', bg: '#F7A1C4', border: '#F472B6', text: '#0F172A', mini: 'bg-pink-400' },
  yellow: { label: 'Vàng nắng', bg: '#FCD34D', border: '#F59E0B', text: '#0F172A', mini: 'bg-amber-400' },
  purple: { label: 'Tím pastel', bg: '#C4B5FD', border: '#A78BFA', text: '#0F172A', mini: 'bg-purple-400' },
  green: { label: 'Xanh lá', bg: '#6EE7B7', border: '#34D399', text: '#0F172A', mini: 'bg-emerald-400' },
  peach: { label: 'Cam đào', bg: '#FDBA74', border: '#FB923C', text: '#0F172A', mini: 'bg-orange-400' },
  teal: { label: 'Xanh ngọc', bg: '#99F6E4', border: '#2DD4BF', text: '#0F172A', mini: 'bg-teal-400' },
};

const TYPE_DEFAULT_COLOR = {
  day_root: 'blue',
  concept: 'blue',
  pattern: 'purple',
  checkpoint: 'purple',
  metric: 'green',
  trap: 'pink',
  case_study: 'yellow',
  code_ref: 'teal',
  note: 'peach',
};

function getNodeSize(node) {
  if (node.node_type === 'day_root') {
    return { width: 156, height: 156 };
  }
  return { width: 230, height: 68 };
}

function parseNodeContent(node) {
  const raw = (node.text || '').trim();
  if (!raw) {
    return { title: 'Ý tưởng mới', body: '', isEmpty: true };
  }
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l && l !== '—');
  const first = (lines[0] || '')
    .replace(/^\[(CoreConcept|ArchitecturePattern|MetricOrFormula|FailureOrTrap|CaseStudy|LabDeliverable|Code|D\d+[^\]]*)\]\s*/i, '')
    .trim();
  const rest = lines.slice(1).join(' ');
  return { title: first || raw, body: rest, isEmpty: false };
}

function buildRadialBezierPath(parent, child) {
  const pSize = getNodeSize(parent);
  const cSize = getNodeSize(child);
  const pCx = parent.x + pSize.width / 2;
  const pCy = parent.y + pSize.height / 2;
  const cCx = child.x + cSize.width / 2;
  const cCy = child.y + cSize.height / 2;
  const dx = cCx - pCx;
  const dy = cCy - pCy;

  // Vertical fallback when stacked directly above/below
  if (Math.abs(dx) < 55) {
    const goingDown = dy >= 0;
    const x1 = pCx;
    const y1 = goingDown ? parent.y + pSize.height : parent.y;
    const x2 = cCx;
    const y2 = goingDown ? child.y : child.y + cSize.height;
    const off = Math.max(36, Math.abs(y2 - y1) * 0.45);
    return `M ${x1} ${y1} C ${x1} ${goingDown ? y1 + off : y1 - off}, ${x2} ${goingDown ? y2 - off : y2 + off}, ${x2} ${y2}`;
  }

  const goingRight = dx >= 0;
  let x1;
  let y1;
  if (parent.node_type === 'day_root') {
    // Anchor neatly along the perimeter of the central circle
    const angle = Math.atan2(dy, dx);
    const radius = pSize.width / 2;
    x1 = pCx + Math.cos(angle) * radius;
    y1 = pCy + Math.sin(angle) * radius;
  } else {
    x1 = goingRight ? parent.x + pSize.width : parent.x;
    y1 = pCy;
  }

  const x2 = goingRight ? child.x : child.x + cSize.width;
  const y2 = cCy;
  const dist = Math.max(48, Math.abs(x2 - x1) * 0.5);
  const cx1 = goingRight ? x1 + dist : x1 - dist;
  const cx2 = goingRight ? x2 - dist : x2 + dist;
  return `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
}

export function Mindmap({
  nodes,
  selectedId,
  onSelect,
  onChange,
  onOpenMapper,
  onReset,
  showGrid = true,
  searchQuery = '',
  layoutTrigger = 0,
  day = 1,
  tab = 'mindmaps',
  onSwitchDay,
  onSwitchTab,
}) {
  const viewport = useRef(null);
  const drag = useRef(null);
  const pan = useRef(null);
  const newNode = useRef(null);
  const [zoom, setZoom] = useState(0.95);
  const [editingId, setEditingId] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [nodeColors, setNodeColors] = useState({});
  const [filterType, setFilterType] = useState(null);
  const [vpRect, setVpRect] = useState({ left: 0, top: 0, width: 1000, height: 600 });
  const byId = new Map(nodes.map(node => [node.id, node]));
  const selectedNode = nodes.find(n => n.id === selectedId) || null;

  function getSwatch(node) {
    const key = nodeColors[node.id] || TYPE_DEFAULT_COLOR[node.node_type] || 'blue';
    return PASTEL_PALETTE[key] || PASTEL_PALETTE.blue;
  }

  function syncViewportRect() {
    const vp = viewport.current;
    if (!vp) return;
    setVpRect({
      left: vp.scrollLeft / zoom,
      top: vp.scrollTop / zoom,
      width: vp.clientWidth / zoom,
      height: vp.clientHeight / zoom,
    });
  }

  function centerView(targetNodes = nodes) {
    const vp = viewport.current;
    if (!vp || !targetNodes.length) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of targetNodes) {
      const s = getNodeSize(n);
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + s.width);
      maxY = Math.max(maxY, n.y + s.height);
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    vp.scrollTo({
      left: Math.max(0, cx * zoom - vp.clientWidth / 2),
      top: Math.max(0, cy * zoom - vp.clientHeight / 2),
      behavior: 'smooth',
    });
  }

  function fitToView(targetNodes = nodes) {
    const vp = viewport.current;
    if (!vp) return;
    if (!targetNodes.length) {
      setZoom(1);
      vp.scrollTo({ left: 0, top: 0 });
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of targetNodes) {
      const s = getNodeSize(n);
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + s.width);
      maxY = Math.max(maxY, n.y + s.height);
    }
    const pad = 90;
    const contentW = Math.max(460, maxX - minX + pad * 2);
    const contentH = Math.max(320, maxY - minY + pad * 2);
    const fitZ = clampZoom(Math.min(1.05, (vp.clientWidth - 40) / contentW, (vp.clientHeight - 90) / contentH));
    setZoom(fitZ);

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    requestAnimationFrame(() => {
      vp.scrollTo({
        left: Math.max(0, cx * fitZ - vp.clientWidth / 2),
        top: Math.max(0, cy * fitZ - (vp.clientHeight - 40) / 2),
        behavior: 'auto',
      });
      syncViewportRect();
    });
  }

  useEffect(() => {
    fitToView(nodes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (layoutTrigger > 0) {
      autoLayout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutTrigger]);

  useEffect(() => {
    syncViewportRect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, nodes.length]);

  function update(id, changes) {
    onChange(nodes.map(node => node.id === id ? { ...node, ...changes } : node));
  }

  function add(x, y, parentId = null) {
    if (nodes.length >= MAX_NODES) return;
    const id = globalThis.crypto?.randomUUID?.() ?? makeId();
    newNode.current = id;
    setEditingId(id);
    onChange([...nodes, {
      id,
      text: '',
      x: clamp(x),
      y: clamp(y),
      parent_id: parentId,
      node_type: 'note',
      source_ref: null,
      code_link: null,
      verification_status: 'user_note',
    }]);
    onSelect?.(id);
  }

  function addChild(parent) {
    const siblings = nodes.filter(n => n.parent_id === parent.id);
    const root = nodes.find(n => n.node_type === 'day_root') || nodes[0];
    const onLeft = parent.node_type === 'day_root'
      ? siblings.length % 2 === 1
      : root && parent.x < root.x;
    const stepY = (siblings.length - Math.floor(siblings.length / 2)) * 96;
    const nextX = onLeft ? parent.x - 320 : parent.x + (parent.node_type === 'day_root' ? 280 : 300);
    const nextY = parent.y + (siblings.length % 2 === 0 ? stepY : -stepY);
    add(clamp(nextX), clamp(nextY), parent.id);
  }

  function addInView() {
    const vp = viewport.current;
    const cx = (vp.scrollLeft + vp.clientWidth / 2) / zoom - 115;
    const cy = (vp.scrollTop + vp.clientHeight / 2) / zoom - 34;
    add(clamp(cx + (nodes.length % 4) * 35), clamp(cy + (nodes.length % 3) * 35), null);
  }

  function addAtPointer(event) {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    add((event.clientX - bounds.left) / zoom - 115, (event.clientY - bounds.top) / zoom - 34, null);
  }

  function autoLayout() {
    if (!nodes.length) return;
    const childrenMap = new Map();
    const roots = [];
    for (const n of nodes) {
      if (n.parent_id && byId.has(n.parent_id)) {
        const list = childrenMap.get(n.parent_id) || [];
        list.push(n);
        childrenMap.set(n.parent_id, list);
      } else {
        roots.push(n);
      }
    }

    const posMap = new Map();
    const isLabFlow = roots.some(r => r.node_type === 'checkpoint');

    if (isLabFlow) {
      let cursorY = 120;
      for (const root of roots) {
        const kids = childrenMap.get(root.id) || [];
        const codeKids = kids.filter(k => k.node_type === 'code_ref');
        const kgKids = kids.filter(k => k.node_type !== 'code_ref');
        const rows = Math.max(1, codeKids.length, kgKids.length);
        const blockH = rows * 100;
        posMap.set(root.id, { x: 220, y: clamp(cursorY + (blockH - 68) / 2) });
        codeKids.forEach((k, idx) => posMap.set(k.id, { x: 590, y: clamp(cursorY + idx * 100) }));
        kgKids.forEach((k, idx) => posMap.set(k.id, { x: 960, y: clamp(cursorY + idx * 100) }));
        cursorY += blockH + 75;
      }
    } else {
      const centerX = 920;
      let cursorCenterY = 460;
      for (const root of roots) {
        posMap.set(root.id, { x: centerX, y: clamp(cursorCenterY) });
        const kids = childrenMap.get(root.id) || [];
        const half = Math.ceil(kids.length / 2);
        const leftKids = kids.slice(0, half);
        const rightKids = kids.slice(half);

        leftKids.forEach((kid, idx) => {
          const ky = clamp(cursorCenterY + 44 + (idx - (leftKids.length - 1) / 2) * 125);
          posMap.set(kid.id, { x: 510, y: ky });
          const gKids = childrenMap.get(kid.id) || [];
          gKids.forEach((gk, gIdx) => {
            posMap.set(gk.id, { x: 180, y: clamp(ky + (gIdx - (gKids.length - 1) / 2) * 90) });
          });
        });

        rightKids.forEach((kid, idx) => {
          const ky = clamp(cursorCenterY + 44 + (idx - (rightKids.length - 1) / 2) * 125);
          posMap.set(kid.id, { x: 1270, y: ky });
          const gKids = childrenMap.get(kid.id) || [];
          gKids.forEach((gk, gIdx) => {
            posMap.set(gk.id, { x: 1600, y: clamp(ky + (gIdx - (gKids.length - 1) / 2) * 90) });
          });
        });

        cursorCenterY += Math.max(leftKids.length, rightKids.length, 2) * 130 + 120;
      }
    }

    const updated = nodes.map(n => {
      const p = posMap.get(n.id);
      return p ? { ...n, x: p.x, y: p.y } : n;
    });
    onChange(updated);
    fitToView(updated);
  }

  function startPan(event) {
    if (event.target !== event.currentTarget || event.button !== 0 || event.pointerType === 'touch') return;
    onSelect?.(null);
    setPaletteOpen(false);
    const { scrollLeft, scrollTop } = viewport.current;
    pan.current = { scrollLeft, scrollTop, x: event.clientX, y: event.clientY, pointer: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePan(event) {
    const start = pan.current;
    if (start?.pointer !== event.pointerId) return;
    viewport.current.scrollTo(
      start.scrollLeft + start.x - event.clientX,
      start.scrollTop + start.y - event.clientY,
    );
    syncViewportRect();
  }

  function remove(id) {
    if (selectedId === id) {
      onSelect?.(null);
      setPaletteOpen(false);
    }
    if (editingId === id) setEditingId(null);
    onChange(nodes.filter(node => node.id !== id).map(node => (
      node.parent_id === id ? { ...node, parent_id: null } : node
    )));
  }

  function canLink(node, target) {
    let ancestor = target;
    while (ancestor) {
      if (ancestor.id === node.id) return false;
      ancestor = byId.get(ancestor.parent_id);
    }
    return true;
  }

  function startDrag(event, node) {
    if (event.button !== 0 || event.target.closest('button, textarea, select')) return;
    onSelect?.(node.id);
    drag.current = {
      pointer: event.pointerId, x: node.x, y: node.y,
      startX: event.clientX, startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event, node) {
    const start = drag.current;
    if (start?.pointer !== event.pointerId) return;
    update(node.id, {
      x: clamp(start.x + (event.clientX - start.startX) / zoom),
      y: clamp(start.y + (event.clientY - start.startY) / zoom),
    });
  }

  function handleMinimapClick(event) {
    const vp = viewport.current;
    if (!vp) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const relX = (event.clientX - rect.left) / rect.width;
    const relY = (event.clientY - rect.top) / rect.height;
    vp.scrollTo({
      left: Math.max(0, relX * CANVAS_W * zoom - vp.clientWidth / 2),
      top: Math.max(0, relY * CANVAS_H * zoom - vp.clientHeight / 2),
      behavior: 'smooth',
    });
  }

  const qLower = searchQuery.trim().toLowerCase();

  return (
    <section className="flex-1 relative overflow-hidden flex" aria-label="Sơ đồ tư duy">
      {/* Left Floating Quick Toolbar */}
      <aside className="absolute left-4 top-4 z-20 flex flex-col bg-white border border-slate-200/90 rounded-xl shadow-lg shadow-slate-900/5 p-1.5 space-y-1">
        <button
          type="button"
          onClick={addInView}
          disabled={nodes.length >= MAX_NODES}
          className="p-2 text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition group relative disabled:opacity-40"
          title="Thêm Node mới"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
          <span className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-[11px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none shadow z-30">
            Thêm thẻ mới ({nodes.length}/{MAX_NODES})
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenMapper}
          className="p-2 text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition group relative"
          title="AI Lecture-to-Lab GraphRAG"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
          <span className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-[11px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none shadow z-30">
            AI GraphRAG Mapper
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilterType(null)}
          className={`p-2 rounded-lg transition group relative ${
            filterType ? 'text-blue-600 bg-blue-50' : 'text-slate-700 hover:text-blue-600 hover:bg-blue-50'
          }`}
          title="Bộ lọc danh mục"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
          <span className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-[11px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none shadow z-30">
            {filterType ? 'Bỏ lọc màu' : 'Bộ lọc màu'}
          </span>
        </button>

        <button
          type="button"
          onClick={onReset}
          className="p-2 text-slate-700 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition group relative"
          title="Khôi phục KG chuẩn"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
          <span className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-[11px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none shadow z-30">
            Khôi phục KG chuẩn
          </span>
        </button>

        <div className="w-full h-px bg-slate-200" />
        <div className="px-1 py-1 text-[9px] font-semibold text-slate-400 uppercase tracking-wider text-center">
          Màu nút
        </div>
        {[
          ['concept', 'bg-blue-400 ring-blue-200', 'Khái niệm'],
          ['pattern', 'bg-purple-400 ring-purple-200', 'Kiến trúc / CP'],
          ['metric', 'bg-emerald-400 ring-emerald-200', 'Chỉ số'],
          ['trap', 'bg-pink-400 ring-pink-200', 'Bẫy / Lỗi'],
          ['code_ref', 'bg-teal-400 ring-teal-200', 'Code Lab'],
        ].map(([typeKey, cls, title]) => (
          <button
            key={typeKey}
            type="button"
            onClick={() => setFilterType(cur => (cur === typeKey ? null : typeKey))}
            className={`w-3.5 h-3.5 rounded-full mx-auto transition ring-2 ${cls.split(' ')[0]} ${
              filterType === typeKey ? `${cls.split(' ')[1]} scale-125` : 'ring-transparent hover:scale-110'
            }`}
            title={title}
          />
        ))}
      </aside>

      {/* Floating Contextual Toolbar (appears when a node is selected, like Miro/Mockup) */}
      {selectedNode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center">
          <div className="bg-white border border-slate-200 shadow-xl rounded-xl px-2 py-1.5 flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => addChild(selectedNode)}
              className="px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-medium flex items-center gap-1 transition"
              title="Thêm nhánh con từ nút đang chọn"
            >
              <span className="text-sm font-bold leading-none">+</span> Nhánh con
            </button>

            <button
              type="button"
              onClick={() => setEditingId(editingId === selectedNode.id ? null : selectedNode.id)}
              className={`px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1 transition ${
                editingId === selectedNode.id ? 'bg-slate-900 text-white' : 'hover:bg-slate-100 text-slate-700'
              }`}
              title="Chỉnh sửa chữ và liên kết"
            >
              <span>✎</span> Sửa chữ
            </button>

            <div className="h-4 w-px bg-slate-200 mx-0.5" />

            <button
              type="button"
              onClick={() => setPaletteOpen(o => !o)}
              className={`p-1.5 rounded-lg transition flex items-center gap-1 ${
                paletteOpen ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'hover:bg-slate-100 text-slate-700'
              }`}
              title="Đổi màu thẻ"
            >
              <span
                className="w-4 h-4 rounded-full border border-slate-300 shadow-inner"
                style={{ backgroundColor: getSwatch(selectedNode).bg }}
              />
              <span className="text-[11px] font-medium pr-0.5">Màu</span>
            </button>

            <div className="h-4 w-px bg-slate-200 mx-0.5" />

            <button
              type="button"
              onClick={() => remove(selectedNode.id)}
              className="px-2 py-1.5 rounded-lg hover:bg-red-50 text-slate-500 hover:text-red-600 font-medium transition"
              title="Xóa thẻ"
            >
              ✕
            </button>
          </div>

          {paletteOpen && (
            <div className="mt-2 bg-white border border-slate-200 shadow-2xl rounded-xl p-2.5 flex items-center gap-2">
              {Object.entries(PASTEL_PALETTE).map(([colorKey, sw]) => {
                const isActive = (nodeColors[selectedNode.id] || TYPE_DEFAULT_COLOR[selectedNode.node_type] || 'blue') === colorKey;
                return (
                  <button
                    key={colorKey}
                    type="button"
                    title={sw.label}
                    onClick={() => {
                      setNodeColors(prev => ({ ...prev, [selectedNode.id]: colorKey }));
                      setPaletteOpen(false);
                    }}
                    className={`w-6 h-6 rounded-full transition transform hover:scale-110 ${
                      isActive ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'border border-slate-200'
                    }`}
                    style={{ backgroundColor: sw.bg }}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Interactive Canvas Area */}
      <div
        id="canvas-container"
        ref={viewport}
        onScroll={syncViewportRect}
        tabIndex={0}
        aria-label="Canvas sơ đồ tư duy"
        className={`flex-1 h-full w-full relative overflow-auto ${showGrid ? 'bg-dot-grid' : 'bg-plain-canvas'}`}
      >
        <div
          className="relative"
          style={{ width: Math.round(CANVAS_W * zoom), height: Math.round(CANVAS_H * zoom) }}
        >
          <div
            className="relative"
            style={{
              width: CANVAS_W,
              height: CANVAS_H,
              transform: `scale(${zoom})`,
              transformOrigin: '0 0',
            }}
            onDoubleClick={addAtPointer}
            onPointerDown={startPan}
            onPointerMove={movePan}
            onLostPointerCapture={event => {
              if (event.target === event.currentTarget) pan.current = null;
            }}
          >
            {/* Organic Curved Bezier Arrow Connectors */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <marker id="mm-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
                  <path d="M 1 1.5 L 9 5 L 1 8.5 z" fill="#64748b" />
                </marker>
                <marker id="mm-arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 1 1.5 L 9 5 L 1 8.5 z" fill="#2563eb" />
                </marker>
              </defs>
              {nodes.map(node => {
                const parent = byId.get(node.parent_id);
                if (!parent) return null;
                const d = buildRadialBezierPath(parent, node);
                const isHighlighted = selectedId === node.id || selectedId === parent.id;
                return (
                  <path
                    key={node.id}
                    d={d}
                    fill="none"
                    stroke={isHighlighted ? '#2563eb' : '#64748b'}
                    strokeLinecap="round"
                    strokeWidth={isHighlighted ? 2.6 : 1.9}
                    opacity={isHighlighted ? 1 : 0.8}
                    markerEnd={isHighlighted ? 'url(#mm-arrow-active)' : 'url(#mm-arrow)'}
                  />
                );
              })}
            </svg>

            {/* Radial Pastel Pill Nodes */}
            {nodes.map((node, index) => {
              const typeKey = node.node_type || 'note';
              const isRoot = typeKey === 'day_root';
              const isSelected = selectedId === node.id;
              const isEditing = editingId === node.id;
              const parsed = parseNodeContent(node);
              const swatch = getSwatch(node);

              const matchesFilter = !filterType
                || typeKey === filterType
                || (filterType === 'pattern' && typeKey === 'checkpoint')
                || (filterType === 'trap' && typeKey === 'case_study');
              const matchesSearch = !qLower || (node.text || '').toLowerCase().includes(qLower)
                || (node.source_ref?.concept_id || '').toLowerCase().includes(qLower);
              const dimmed = !matchesFilter || !matchesSearch;

              return (
                <div
                  key={node.id}
                  style={{
                    position: 'absolute',
                    left: node.x,
                    top: node.y,
                    width: isRoot ? 156 : 230,
                    height: isRoot ? 156 : undefined,
                    minHeight: isRoot ? 156 : 64,
                  }}
                  onClick={e => {
                    e.stopPropagation();
                    onSelect?.(node.id);
                  }}
                  onDoubleClick={e => {
                    e.stopPropagation();
                    setEditingId(node.id);
                  }}
                  onPointerDown={event => !isEditing && startDrag(event, node)}
                  onPointerMove={event => !isEditing && moveDrag(event, node)}
                  onLostPointerCapture={() => { drag.current = null; }}
                  className={`z-10 transition-opacity ${dimmed ? 'opacity-25' : ''}`}
                >
                  {/* Selection Frame with 4 Corner Handles (exact Image 1 aesthetic) */}
                  {isSelected && !isEditing && (
                    <div className="absolute -inset-1.5 border-2 border-sky-600 pointer-events-none z-20 rounded-2xl">
                      <span className="absolute -top-1 -left-1 w-2 h-2 bg-white border border-sky-600" />
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-white border border-sky-600" />
                      <span className="absolute -bottom-1 -left-1 w-2 h-2 bg-white border border-sky-600" />
                      <span className="absolute -bottom-1 -right-1 w-2 h-2 bg-white border border-sky-600" />
                    </div>
                  )}

                  {isEditing ? (
                    <div
                      onClick={e => e.stopPropagation()}
                      className="bg-white rounded-2xl shadow-2xl border-2 border-blue-600 p-3 space-y-2 w-[270px] -ml-5 z-30 relative"
                    >
                      <textarea
                        rows={3}
                        ref={input => {
                          if (input && newNode.current === node.id) {
                            newNode.current = null;
                            input.focus();
                          }
                        }}
                        value={node.text}
                        maxLength={20000}
                        placeholder="Nhập nội dung nút..."
                        onChange={e => update(node.id, { text: e.target.value })}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500"
                      />
                      <div className="flex items-center gap-1.5">
                        <select
                          aria-label={`Nối ý ${index + 1} với`}
                          value={node.parent_id ?? ''}
                          onChange={e => update(node.id, { parent_id: e.target.value || null })}
                          className="flex-1 min-w-0 text-[11px] border border-slate-300 rounded-md py-1 px-2 bg-white"
                        >
                          <option value="">Nút gốc (không nối)</option>
                          {nodes.map((target, tIdx) => (
                            canLink(node, target) && (
                              <option key={target.id} value={target.id}>
                                ↳ {parseNodeContent(target).title.slice(0, 42) || `Ý ${tIdx + 1}`}
                              </option>
                            )
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-2.5 py-1 text-xs font-semibold bg-blue-600 text-white rounded-md shrink-0"
                        >
                          Xong
                        </button>
                      </div>
                    </div>
                  ) : isRoot ? (
                    <div
                      style={{ backgroundColor: swatch.bg, color: swatch.text }}
                      className="mindmap-node w-full h-full rounded-full shadow-md flex flex-col items-center justify-center text-center px-4 cursor-grab active:cursor-grabbing border border-white/60 hover:scale-[1.02]"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/65 text-slate-800 mb-1">
                        Ngày {day}
                      </span>
                      <div className="text-[13px] font-bold leading-snug line-clamp-3">
                        {parsed.title.replace(/^Ngày\s+\d+:\s*/i, '')}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{ backgroundColor: swatch.bg, color: swatch.text }}
                      className="mindmap-node w-full min-h-[64px] rounded-full shadow-sm hover:shadow-md px-5 py-2.5 flex items-center justify-center text-center cursor-grab active:cursor-grabbing border border-white/50 hover:scale-[1.02] relative group"
                    >
                      <span className="text-[12.5px] font-semibold leading-snug line-clamp-2">
                        {parsed.title}
                      </span>
                      {node.verification_status === 'verified' && (
                        <span
                          className="absolute -top-1.5 -right-1 w-5 h-5 rounded-full bg-white text-emerald-600 border border-slate-200 shadow-sm text-[10px] font-bold grid place-items-center"
                          title="Nguồn đã kiểm chứng"
                        >
                          ✓
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* FloatingCanvasControls (Bottom center) */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 bg-white/95 backdrop-blur-sm border border-slate-200 shadow-xl rounded-xl px-3 py-1.5 flex items-center space-x-2 max-w-[calc(100vw-2rem)] overflow-x-auto">
        <button
          type="button"
          onClick={() => setZoom(z => clampZoom(z - 0.1))}
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
          title="Thu nhỏ"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M20 12H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </button>

        <span className="text-xs font-semibold text-slate-700 px-1 min-w-[42px] text-center font-mono">
          {Math.round(zoom * 100)}%
        </span>

        <button
          type="button"
          onClick={() => setZoom(z => clampZoom(z + 0.1))}
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
          title="Phóng to"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </button>

        <div className="h-4 w-px bg-slate-200 shrink-0" />

        <button
          type="button"
          onClick={() => centerView(nodes)}
          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition"
          title="Căn giữa màn hình"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => fitToView(nodes)}
          className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition font-medium whitespace-nowrap"
        >
          Vừa khung hình
        </button>

        <div className="h-4 w-px bg-slate-200 shrink-0" />

        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => onSwitchTab?.('mindmaps')}
            className={`px-2 py-1 text-[11px] rounded-md font-semibold transition ${
              tab === 'mindmaps' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mindmap
          </button>
          <button
            type="button"
            onClick={() => onSwitchTab?.('lab')}
            className={`px-2 py-1 text-[11px] rounded-md font-semibold transition ${
              tab === 'lab' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Lab
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={day <= 1}
            onClick={() => onSwitchDay?.(Math.max(1, day - 1))}
            className="px-1.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded disabled:opacity-35"
            title="Ngày trước"
          >
            ‹
          </button>
          <span className="text-xs font-mono font-semibold text-slate-700 px-1">
            D{String(day).padStart(2, '0')}
          </span>
          <button
            type="button"
            disabled={day >= 14}
            onClick={() => onSwitchDay?.(Math.min(14, day + 1))}
            className="px-1.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded disabled:opacity-35"
            title="Ngày tiếp"
          >
            ›
          </button>
        </div>
      </div>

      {/* Live CanvasMinimap (Bottom Right) */}
      <div className="absolute bottom-5 right-5 z-20 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl p-2 shadow-lg hidden md:block w-48 h-32">
        <div className="flex items-center justify-between pb-1 border-b border-slate-100 mb-1.5">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Bản đồ thu nhỏ
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        </div>
        <div
          onClick={handleMinimapClick}
          className="w-full h-20 bg-slate-100 rounded relative overflow-hidden border border-slate-200 cursor-pointer"
          title="Bấm để di chuyển tới vùng tương ứng"
        >
          {nodes.map(node => {
            const swatch = getSwatch(node);
            const leftPct = Math.max(0, Math.min(92, (node.x / CANVAS_W) * 100));
            const topPct = Math.max(0, Math.min(88, (node.y / CANVAS_H) * 100));
            return (
              <div
                key={node.id}
                className={`absolute rounded-full ${swatch.mini} ${node.node_type === 'day_root' ? 'w-4 h-4' : 'w-4 h-2'}`}
                style={{ left: `${leftPct}%`, top: `${topPct}%` }}
              />
            );
          })}
          <div
            className="absolute border border-blue-600 bg-blue-500/10 rounded pointer-events-none"
            style={{
              left: `${Math.max(0, Math.min(95, (vpRect.left / CANVAS_W) * 100))}%`,
              top: `${Math.max(0, Math.min(95, (vpRect.top / CANVAS_H) * 100))}%`,
              width: `${Math.max(10, Math.min(100, (vpRect.width / CANVAS_W) * 100))}%`,
              height: `${Math.max(10, Math.min(100, (vpRect.height / CANVAS_H) * 100))}%`,
            }}
          />
        </div>
      </div>
    </section>
  );
}

function makeId() {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}
