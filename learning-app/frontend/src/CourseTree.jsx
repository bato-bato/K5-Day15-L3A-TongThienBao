import React, { useEffect, useMemo, useRef, useState } from 'react';

const MIN_ZOOM = 0.45;
const MAX_ZOOM = 1.45;
const clampZoom = value => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(value.toFixed(2))));

export const COURSE_LEVELS = [
  {
    id: 'lv1',
    title: 'Cấp độ 1: Nền tảng & Bài toán AI',
    badge: 'Cơ bản',
    bg: '#B5D3FA',
    edge: '#3B82F6',
    mini: 'bg-blue-400',
    days: [1, 2, 3],
  },
  {
    id: 'lv2',
    title: 'Cấp độ 2: Prompt, UX, Data & RAG',
    badge: 'Trung cấp',
    bg: '#C4B5FD',
    edge: '#7C3AED',
    mini: 'bg-purple-400',
    days: [4, 5, 6, 7],
  },
  {
    id: 'lv3',
    title: 'Cấp độ 3: Agent, Eval & Safety',
    badge: 'Nâng cao',
    bg: '#6EE7B7',
    edge: '#10B981',
    mini: 'bg-emerald-400',
    days: [8, 9, 10, 11],
  },
  {
    id: 'lv4',
    title: 'Cấp độ 4: Deploy, Kinh tế & Lab',
    badge: 'Production',
    bg: '#FCD34D',
    edge: '#F59E0B',
    mini: 'bg-amber-400',
    days: [12, 13, 14],
  },
];

const TYPE_COLORS = {
  concept: { bg: '#DBEAFE', edge: '#3B82F6', mini: 'bg-blue-400' },
  pattern: { bg: '#EDE9FE', edge: '#7C3AED', mini: 'bg-purple-400' },
  checkpoint: { bg: '#E0E7FF', edge: '#4F46E5', mini: 'bg-indigo-400' },
  metric: { bg: '#D1FAE5', edge: '#10B981', mini: 'bg-emerald-400' },
  trap: { bg: '#FCE7F3', edge: '#EC4899', mini: 'bg-pink-400' },
  case_study: { bg: '#FEF3C7', edge: '#F59E0B', mini: 'bg-amber-400' },
  code_ref: { bg: '#CCFBF1', edge: '#14B8A6', mini: 'bg-teal-400' },
  note: { bg: '#FFEDD5', edge: '#F97316', mini: 'bg-orange-400' },
};

function getDayShortTitle(workspace, day) {
  const root = workspace?.mindmaps?.[day]?.nodes?.find(n => n.node_type === 'day_root');
  if (!root?.text) return `Ngày ${day}`;
  const firstLine = root.text.split('\n')[0].replace(/^Ngày\s+\d+:\s*/i, '').trim();
  return firstLine || `Ngày ${day}`;
}

function getConceptShortLabel(node) {
  const line = (node?.text || '').split('\n')[0] || '';
  return line.replace(/^\[[^\]]+\]\s*/, '').trim() || 'Ý tưởng mới';
}

function computeTreeLayout({
  workspace,
  edits,
  contentTab,
  expandedLevels,
  expandedDays,
  searchQuery,
}) {
  const qLower = searchQuery.trim().toLowerCase();
  const LEAF_H = 66;
  const DAY_H = 74;
  const LEVEL_H = 82;
  const COL_X = { root: 80, level: 340, day: 680, concept: 1030 };
  const WIDTHS = { root: 190, level: 260, day: 270, concept: 275 };

  const nodes = [];
  const edges = [];

  let cursorY = 70;
  const levelCenters = [];

  for (const level of COURSE_LEVELS) {
    const isLevelOpen = qLower ? true : !!expandedLevels[level.id];
    const levelNodeId = `tree:${level.id}`;

    if (!isLevelOpen) {
      const y = cursorY;
      cursorY += LEVEL_H;
      nodes.push({
        id: levelNodeId,
        kind: 'level',
        level,
        x: COL_X.level,
        y,
        width: WIDTHS.level,
        height: 58,
        expanded: false,
        dimmed: false,
      });
      edges.push({
        id: `e:root->${levelNodeId}`,
        fromId: 'tree:root',
        toId: levelNodeId,
        color: level.edge,
      });
      levelCenters.push(y + 29);
      continue;
    }

    const dayCenters = [];
    for (const d of level.days) {
      const dayNodes = (edits[`${contentTab}/${d}`] ?? workspace?.[contentTab]?.[d])?.nodes || [];
      const childConcepts = dayNodes.filter(n => n.node_type !== 'day_root');
      const dayTitle = getDayShortTitle(workspace, d);
      const dayMatches = !qLower
        || dayTitle.toLowerCase().includes(qLower)
        || `d${d}`.includes(qLower)
        || childConcepts.some(c => (c.text || '').toLowerCase().includes(qLower));

      const hasMatchingChild = qLower && childConcepts.some(c => (c.text || '').toLowerCase().includes(qLower));
      const isDayOpen = qLower ? hasMatchingChild : !!expandedDays[d];
      const dayNodeId = `tree:day:${d}`;

      if (!isDayOpen || childConcepts.length === 0) {
        const y = cursorY;
        cursorY += DAY_H;
        nodes.push({
          id: dayNodeId,
          kind: 'day',
          day: d,
          title: dayTitle,
          childCount: childConcepts.length,
          level,
          x: COL_X.day,
          y,
          width: WIDTHS.day,
          height: 54,
          expanded: false,
          dimmed: !dayMatches,
        });
        edges.push({
          id: `e:${levelNodeId}->${dayNodeId}`,
          fromId: levelNodeId,
          toId: dayNodeId,
          color: level.edge,
        });
        dayCenters.push(y + 27);
        continue;
      }

      const conceptStartY = cursorY;
      childConcepts.forEach(cNode => {
        const cLabel = getConceptShortLabel(cNode);
        const cMatch = !qLower
          || (cNode.text || '').toLowerCase().includes(qLower)
          || (cNode.source_ref?.concept_id || '').toLowerCase().includes(qLower);
        const cy = cursorY;
        cursorY += LEAF_H;

        const style = TYPE_COLORS[cNode.node_type] || TYPE_COLORS.concept;
        nodes.push({
          id: cNode.id,
          kind: 'concept',
          day: d,
          rawNode: cNode,
          title: cLabel,
          style,
          x: COL_X.concept,
          y: cy,
          width: WIDTHS.concept,
          height: 50,
          dimmed: !cMatch,
        });
        edges.push({
          id: `e:${dayNodeId}->${cNode.id}`,
          fromId: dayNodeId,
          toId: cNode.id,
          color: style.edge,
        });
      });

      const conceptEndY = cursorY - LEAF_H + 50;
      const dayY = Math.round((conceptStartY + conceptEndY) / 2 - 27);
      nodes.push({
        id: dayNodeId,
        kind: 'day',
        day: d,
        title: dayTitle,
        childCount: childConcepts.length,
        level,
        x: COL_X.day,
        y: dayY,
        width: WIDTHS.day,
        height: 54,
        expanded: true,
        dimmed: !dayMatches,
      });
      edges.push({
        id: `e:${levelNodeId}->${dayNodeId}`,
        fromId: levelNodeId,
        toId: dayNodeId,
        color: level.edge,
      });
      dayCenters.push(dayY + 27);
      cursorY += 14;
    }

    const levelCenterY = dayCenters.length
      ? (dayCenters[0] + dayCenters[dayCenters.length - 1]) / 2
      : cursorY;
    const levelY = Math.round(levelCenterY - 29);
    nodes.push({
      id: levelNodeId,
      kind: 'level',
      level,
      x: COL_X.level,
      y: levelY,
      width: WIDTHS.level,
      height: 58,
      expanded: true,
      dimmed: false,
    });
    edges.push({
      id: `e:root->${levelNodeId}`,
      fromId: 'tree:root',
      toId: levelNodeId,
      color: level.edge,
    });
    levelCenters.push(levelY + 29);
    cursorY += 22;
  }

  const rootCenterY = levelCenters.length
    ? (levelCenters[0] + levelCenters[levelCenters.length - 1]) / 2
    : 320;
  const rootY = Math.round(rootCenterY - 46);
  nodes.unshift({
    id: 'tree:root',
    kind: 'root',
    title: 'Khóa học AI in Action',
    subtitle: '14 ngày · 4 cấp độ',
    x: COL_X.root,
    y: rootY,
    width: WIDTHS.root,
    height: 92,
    dimmed: false,
  });

  const canvasW = 1480;
  const canvasH = Math.max(760, cursorY + 120);
  return { nodes, edges, canvasW, canvasH };
}

export function CourseTree({
  workspace,
  edits,
  contentTab,
  activeDay,
  selectedNodeId,
  showGrid = true,
  searchQuery = '',
  layoutTrigger = 0,
  onSelectConcept,
  onOpenDayCanvas,
  onOpenMapper,
  onSwitchView,
  onSwitchContentTab,
}) {
  const viewport = useRef(null);
  const pan = useRef(null);
  const [zoom, setZoom] = useState(0.95);
  const [expandedLevels, setExpandedLevels] = useState(() => {
    const activeLvl = COURSE_LEVELS.find(l => l.days.includes(activeDay))?.id || 'lv1';
    return { lv1: activeLvl === 'lv1', lv2: activeLvl === 'lv2', lv3: activeLvl === 'lv3', lv4: activeLvl === 'lv4' };
  });
  const [expandedDays, setExpandedDays] = useState(() => ({ [activeDay]: true }));
  const [vpRect, setVpRect] = useState({ left: 0, top: 0, width: 1000, height: 600 });

  const tree = useMemo(
    () => computeTreeLayout({ workspace, edits, contentTab, expandedLevels, expandedDays, searchQuery }),
    [workspace, edits, contentTab, expandedLevels, expandedDays, searchQuery],
  );
  const byId = useMemo(() => new Map(tree.nodes.map(n => [n.id, n])), [tree.nodes]);

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

  function fitToView() {
    const vp = viewport.current;
    if (!vp || !tree.nodes.length) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of tree.nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }
    const pad = 70;
    const contentW = Math.max(460, maxX - minX + pad * 2);
    const contentH = Math.max(320, maxY - minY + pad * 2);
    const fitZ = clampZoom(Math.min(1.02, (vp.clientWidth - 40) / contentW, (vp.clientHeight - 90) / contentH));
    setZoom(fitZ);

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    requestAnimationFrame(() => {
      vp.scrollTo({
        left: Math.max(0, cx * fitZ - vp.clientWidth / 2),
        top: Math.max(0, cy * fitZ - (vp.clientHeight - 40) / 2),
        behavior: 'smooth',
      });
      syncViewportRect();
    });
  }

  function centerView() {
    const vp = viewport.current;
    if (!vp || !tree.nodes.length) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of tree.nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    vp.scrollTo({
      left: Math.max(0, cx * zoom - vp.clientWidth / 2),
      top: Math.max(0, cy * zoom - vp.clientHeight / 2),
      behavior: 'smooth',
    });
  }

  useEffect(() => {
    fitToView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (layoutTrigger > 0) fitToView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutTrigger]);

  useEffect(() => {
    const lvl = COURSE_LEVELS.find(l => l.days.includes(activeDay))?.id;
    if (lvl) {
      setExpandedLevels(prev => (prev[lvl] ? prev : { ...prev, [lvl]: true }));
    }
    setExpandedDays(prev => (prev[activeDay] ? prev : { ...prev, [activeDay]: true }));
  }, [activeDay]);

  useEffect(() => {
    syncViewportRect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, tree.nodes.length]);

  function expandAll() {
    setExpandedLevels({ lv1: true, lv2: true, lv3: true, lv4: true });
    const allDays = {};
    for (let d = 1; d <= 14; d++) allDays[d] = true;
    setExpandedDays(allDays);
  }

  function collapseToLevels() {
    setExpandedLevels({ lv1: true, lv2: true, lv3: true, lv4: true });
    setExpandedDays({});
  }

  function startPan(event) {
    if (event.target !== event.currentTarget || event.button !== 0 || event.pointerType === 'touch') return;
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

  return (
    <section className="flex-1 relative overflow-hidden flex" aria-label="Cây rẽ nhánh khóa học">
      {/* Left Floating Tree Controls */}
      <aside className="absolute left-4 top-4 z-20 flex flex-col bg-white border border-slate-200/90 rounded-xl shadow-lg shadow-slate-900/5 p-1.5 space-y-1">
        <button
          type="button"
          onClick={expandAll}
          className="p-2 text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition group relative"
          title="Mở rộng toàn bộ cây"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
          <span className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-[11px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none shadow z-30">
            Mở rộng tất cả
          </span>
        </button>

        <button
          type="button"
          onClick={collapseToLevels}
          className="p-2 text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition group relative"
          title="Thu gọn về 4 cấp độ"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M20 12H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
          <span className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-[11px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none shadow z-30">
            Thu gọn nhánh con
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenMapper}
          className="p-2 text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition group relative"
          title="AI Lecture-to-Lab GraphRAG"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
          <span className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-[11px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none shadow z-30">
            AI GraphRAG Mapper
          </span>
        </button>

        <div className="w-full h-px bg-slate-200" />
        <div className="px-1 py-0.5 text-[9px] font-semibold text-slate-400 uppercase tracking-wider text-center">
          Chế độ
        </div>
        <button
          type="button"
          onClick={() => onSwitchContentTab?.('mindmaps')}
          className={`px-1.5 py-1 rounded text-[10px] font-bold transition ${
            contentTab === 'mindmaps' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          KG
        </button>
        <button
          type="button"
          onClick={() => onSwitchContentTab?.('lab')}
          className={`px-1.5 py-1 rounded text-[10px] font-bold transition ${
            contentTab === 'lab' ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Lab
        </button>
      </aside>

      {/* Canvas */}
      <div
        ref={viewport}
        onScroll={syncViewportRect}
        tabIndex={0}
        aria-label="Canvas cây khóa học"
        className={`flex-1 h-full w-full relative overflow-auto ${showGrid ? 'bg-dot-grid' : 'bg-plain-canvas'}`}
      >
        <div style={{ width: Math.round(tree.canvasW * zoom), height: Math.round(tree.canvasH * zoom) }} className="relative">
          <div
            className="relative"
            style={{
              width: tree.canvasW,
              height: tree.canvasH,
              transform: `scale(${zoom})`,
              transformOrigin: '0 0',
            }}
            onPointerDown={startPan}
            onPointerMove={movePan}
            onLostPointerCapture={event => {
              if (event.target === event.currentTarget) pan.current = null;
            }}
          >
            {/* Curved Bezier Branches */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <marker id="tree-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                  <path d="M 1 1.5 L 9 5 L 1 8.5 z" fill="#94a3b8" />
                </marker>
                <marker id="tree-arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto">
                  <path d="M 1 1.5 L 9 5 L 1 8.5 z" fill="#2563eb" />
                </marker>
              </defs>
              {tree.edges.map(edge => {
                const from = byId.get(edge.fromId);
                const to = byId.get(edge.toId);
                if (!from || !to) return null;
                const x1 = from.x + from.width;
                const y1 = from.y + from.height / 2;
                const x2 = to.x;
                const y2 = to.y + to.height / 2;
                const dist = Math.max(40, (x2 - x1) * 0.5);
                const d = `M ${x1} ${y1} C ${x1 + dist} ${y1}, ${x2 - dist} ${y2}, ${x2} ${y2}`;
                const isSelectedEdge = to.id === selectedNodeId || (to.kind === 'day' && to.day === activeDay);
                return (
                  <path
                    key={edge.id}
                    d={d}
                    fill="none"
                    stroke={isSelectedEdge ? '#2563eb' : edge.color}
                    strokeWidth={isSelectedEdge ? 2.5 : 1.8}
                    opacity={to.dimmed ? 0.2 : isSelectedEdge ? 0.95 : 0.65}
                    markerEnd={isSelectedEdge ? 'url(#tree-arrow-active)' : 'url(#tree-arrow)'}
                  />
                );
              })}
            </svg>

            {/* Tree Nodes */}
            {tree.nodes.map(node => {
              if (node.kind === 'root') {
                return (
                  <div
                    key={node.id}
                    style={{ position: 'absolute', left: node.x, top: node.y, width: node.width, height: node.height }}
                    className="mindmap-node rounded-full bg-[#B5D3FA] border-2 border-blue-600 shadow-md flex flex-col items-center justify-center text-center px-4 z-10"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/75 text-blue-800 mb-1">
                      Khóa học AI
                    </span>
                    <div className="text-[13px] font-bold text-slate-900 leading-tight">{node.title}</div>
                    <div className="text-[10.5px] font-medium text-slate-700 mt-0.5">{node.subtitle}</div>
                  </div>
                );
              }

              if (node.kind === 'level') {
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setExpandedLevels(prev => ({ ...prev, [node.level.id]: !prev[node.level.id] }))}
                    style={{
                      position: 'absolute',
                      left: node.x,
                      top: node.y,
                      width: node.width,
                      height: node.height,
                      backgroundColor: node.level.bg,
                    }}
                    className="mindmap-node rounded-full shadow-sm hover:shadow-md border border-white/60 px-4 flex items-center justify-between gap-2 text-left z-10"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9.5px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-white/70 text-slate-800">
                          {node.level.badge}
                        </span>
                        <span className="text-[10px] font-mono text-slate-700">
                          D{node.level.days[0]}–D{node.level.days[node.level.days.length - 1]}
                        </span>
                      </div>
                      <div className="text-[12px] font-bold text-slate-900 truncate mt-0.5">
                        {node.level.title.replace(/^Cấp độ \d+:\s*/i, '')}
                      </div>
                    </div>
                    <span className="w-6 h-6 rounded-full bg-white/75 text-slate-800 font-bold text-xs grid place-items-center shrink-0">
                      {node.expanded ? '▾' : '▸'}
                    </span>
                  </button>
                );
              }

              if (node.kind === 'day') {
                const isActive = node.day === activeDay;
                return (
                  <div
                    key={node.id}
                    style={{ position: 'absolute', left: node.x, top: node.y, width: node.width, height: node.height }}
                    className={`mindmap-node rounded-full bg-white shadow-sm hover:shadow-md px-3 flex items-center gap-2 z-10 ${
                      isActive ? 'border-2 border-blue-600 ring-2 ring-blue-100' : 'border border-slate-300'
                    } ${node.dimmed ? 'opacity-25' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedDays(prev => ({ ...prev, [node.day]: !prev[node.day] }))}
                      className="flex-1 min-w-0 flex items-center gap-2 text-left"
                    >
                      <span className={`px-2 py-0.5 rounded-full font-mono text-[10.5px] font-bold shrink-0 ${
                        isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                      }`}>
                        D{String(node.day).padStart(2, '0')}
                      </span>
                      <span className="text-[12px] font-semibold text-slate-900 truncate flex-1">
                        {node.title}
                      </span>
                      <span className="text-[10.5px] font-mono text-slate-400 shrink-0">
                        {node.childCount} {node.expanded ? '▾' : '▸'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenDayCanvas?.(node.day)}
                      className="w-6 h-6 rounded-full bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white text-xs font-bold grid place-items-center shrink-0 transition"
                      title={`Mở sơ đồ riêng của Ngày ${node.day}`}
                    >
                      ↗
                    </button>
                  </div>
                );
              }

              // Concept leaf pill
              const isSelected = node.id === selectedNodeId;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onSelectConcept?.(node.day, node.id)}
                  style={{
                    position: 'absolute',
                    left: node.x,
                    top: node.y,
                    width: node.width,
                    height: node.height,
                    backgroundColor: node.style.bg,
                  }}
                  className={`mindmap-node rounded-full px-4 flex items-center justify-between gap-2 text-left shadow-sm hover:shadow-md z-10 ${
                    isSelected
                      ? 'border-2 border-blue-600 ring-2 ring-blue-200'
                      : 'border border-white/70'
                  } ${node.dimmed ? 'opacity-25' : ''}`}
                >
                  <span className="text-[11.5px] font-semibold text-slate-900 truncate flex-1">
                    {node.title}
                  </span>
                  {node.rawNode?.verification_status === 'verified' && (
                    <span className="w-4 h-4 rounded-full bg-white text-emerald-600 text-[9px] font-bold grid place-items-center shrink-0">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating Bottom Controls */}
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
          onClick={centerView}
          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition"
          title="Căn giữa cây"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </button>
        <button
          type="button"
          onClick={fitToView}
          className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition font-medium whitespace-nowrap"
        >
          Vừa khung hình
        </button>

        <div className="h-4 w-px bg-slate-200 shrink-0" />

        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => onSwitchView?.('tree')}
            className="px-2.5 py-1 text-[11px] rounded-md font-semibold bg-white text-blue-700 shadow-sm"
          >
            Cây khóa học
          </button>
          <button
            type="button"
            onClick={() => onSwitchView?.('mindmaps')}
            className="px-2.5 py-1 text-[11px] rounded-md font-semibold text-slate-600 hover:text-slate-900"
          >
            Mindmap ngày
          </button>
          <button
            type="button"
            onClick={() => onSwitchView?.('lab')}
            className="px-2.5 py-1 text-[11px] rounded-md font-semibold text-slate-600 hover:text-slate-900"
          >
            Lab
          </button>
        </div>
      </div>

      {/* Live Minimap */}
      <div className="absolute bottom-5 right-5 z-20 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl p-2 shadow-lg hidden md:block w-48 h-32">
        <div className="flex items-center justify-between pb-1 border-b border-slate-100 mb-1.5">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Bản đồ thu nhỏ
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        </div>
        <div className="w-full h-20 bg-slate-100 rounded relative overflow-hidden border border-slate-200">
          {tree.nodes.map(n => (
            <div
              key={n.id}
              className={`absolute rounded-full ${n.kind === 'level' ? n.level.mini : n.kind === 'concept' ? n.style.mini : 'bg-blue-500'} w-3.5 h-1.5`}
              style={{
                left: `${Math.max(0, Math.min(92, (n.x / tree.canvasW) * 100))}%`,
                top: `${Math.max(0, Math.min(90, (n.y / tree.canvasH) * 100))}%`,
              }}
            />
          ))}
          <div
            className="absolute border border-blue-600 bg-blue-500/10 rounded pointer-events-none"
            style={{
              left: `${Math.max(0, Math.min(95, (vpRect.left / tree.canvasW) * 100))}%`,
              top: `${Math.max(0, Math.min(95, (vpRect.top / tree.canvasH) * 100))}%`,
              width: `${Math.max(10, Math.min(100, (vpRect.width / tree.canvasW) * 100))}%`,
              height: `${Math.max(10, Math.min(100, (vpRect.height / tree.canvasH) * 100))}%`,
            }}
          />
        </div>
      </div>
    </section>
  );
}
