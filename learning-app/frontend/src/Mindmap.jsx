import React, { useMemo, useRef, useState } from 'react';
import {
  LEFT_THEMES,
  RIGHT_THEMES,
  truncateText,
  getNodeTitle,
  extractSubBranches,
} from './CourseTree.jsx';
import { useMindmapViewport } from './useMindmapViewport.js';

const MAX_POSITION = 4096;
const MAX_NODES = 100;
const clamp = value => Math.max(0, Math.min(MAX_POSITION, Math.round(value)));

const XMIND_THEMES = [...LEFT_THEMES, ...RIGHT_THEMES];

function makeId() {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

function layoutDaySide(branches, side, defaultThemes, startX, nodeColors) {
  const LEAF_W = 220;
  const LEAF_H = 26;
  const LEAF_GAP = 4;
  const L2_W = 148;
  const L2_H = 30;
  const L2_GAP = 14;
  const L1_W = 180;
  const L1_H = 36;
  const L1_GAP = 26;

  const l1X = side === 'left' ? startX - 180 - L1_W : startX + 180;
  const l2X = side === 'left' ? l1X - 58 - L2_W : l1X + L1_W + 58;
  const l3X = side === 'left' ? l2X - 52 - LEAF_W : l2X + L2_W + 52;

  const placedNodes = [];
  const placedEdges = [];
  let cursorY = 0;

  branches.forEach((branch, bIdx) => {
    const customIdx = nodeColors[branch.nodeId];
    const theme = customIdx !== undefined && XMIND_THEMES[customIdx]
      ? XMIND_THEMES[customIdx]
      : defaultThemes[bIdx % defaultThemes.length];
    const l1Id = `l1:${branch.nodeId}`;
    const l2Centers = [];
    const l1StartY = cursorY;

    branch.subGroups.forEach((sg, sgIdx) => {
      const l2Id = `l2:${branch.nodeId}:${sgIdx}`;
      const leaves = sg.leaves?.length ? sg.leaves : [];
      const leafCount = Math.max(1, leaves.length);
      const leavesBlockH = leaves.length ? leafCount * LEAF_H + (leafCount - 1) * LEAF_GAP : L2_H;
      const l2StartY = cursorY;

      leaves.forEach((leaf, lIdx) => {
        const l3Id = `l3:${branch.nodeId}:${sgIdx}:${lIdx}`;
        const ly = l2StartY + lIdx * (LEAF_H + LEAF_GAP);
        placedNodes.push({
          id: l3Id,
          kind: 'l3',
          side,
          nodeId: leaf.nodeId,
          rawNode: leaf.rawNode,
          text: leaf.text,
          theme,
          x: l3X,
          y: ly,
          width: LEAF_W,
          height: LEAF_H,
        });
        placedEdges.push({
          id: `e:${l2Id}->${l3Id}`,
          fromId: l2Id,
          toId: l3Id,
          side,
          theme,
          nodeId: leaf.nodeId,
        });
      });

      const l2Y = Math.round(l2StartY + (leavesBlockH - L2_H) / 2);
      placedNodes.push({
        id: l2Id,
        kind: 'l2',
        side,
        nodeId: sg.nodeId,
        rawNode: sg.rawNode,
        text: sg.label,
        theme,
        x: l2X,
        y: l2Y,
        width: L2_W,
        height: L2_H,
      });
      placedEdges.push({
        id: `e:${l1Id}->${l2Id}`,
        fromId: l1Id,
        toId: l2Id,
        side,
        theme,
        nodeId: sg.nodeId,
      });

      l2Centers.push(l2Y + L2_H / 2);
      cursorY += Math.max(L2_H, leavesBlockH) + L2_GAP;
    });

    const l1EndY = cursorY - L2_GAP;
    const l1CenterY = l2Centers.length
      ? (l2Centers[0] + l2Centers[l2Centers.length - 1]) / 2
      : (l1StartY + l1EndY) / 2;
    const l1Y = Math.round(l1CenterY - L1_H / 2);

    placedNodes.push({
      id: l1Id,
      kind: 'l1',
      side,
      nodeId: branch.nodeId,
      rawNode: branch.rawNode,
      text: branch.label,
      verified: branch.verified,
      theme,
      x: l1X,
      y: l1Y,
      width: L1_W,
      height: L1_H,
    });
    placedEdges.push({
      id: `e:root->${l1Id}`,
      fromId: 'root',
      toId: l1Id,
      side,
      theme,
      nodeId: branch.nodeId,
    });

    cursorY += L1_GAP - L2_GAP;
  });

  const totalHeight = branches.length ? Math.max(120, cursorY - L1_GAP) : 0;
  return { nodes: placedNodes, edges: placedEdges, height: totalHeight };
}

function computeDayXMindLayout({ nodes, day, tab, nodeColors, filterType, searchQuery }) {
  const CENTER_X = 980;
  const ROOT_W = 196;
  const ROOT_H = 114;
  const ROOT_X = CENTER_X - ROOT_W / 2;
  const qLower = searchQuery.trim().toLowerCase();

  const byId = new Map(nodes.map(n => [n.id, n]));
  const rootNode = nodes.find(n => n.node_type === 'day_root') || null;
  const childrenByParent = new Map();

  for (const n of nodes) {
    if (n.parent_id && byId.has(n.parent_id)) {
      const list = childrenByParent.get(n.parent_id) || [];
      list.push(n);
      childrenByParent.set(n.parent_id, list);
    }
  }

  let l1Nodes = [];
  if (rootNode) {
    const direct = childrenByParent.get(rootNode.id) || [];
    const orphans = nodes.filter(
      n => n.id !== rootNode.id && (!n.parent_id || !byId.has(n.parent_id)),
    );
    l1Nodes = [...direct, ...orphans];
  } else {
    l1Nodes = nodes.filter(n => !n.parent_id || !byId.has(n.parent_id));
  }

  const rawBranches = l1Nodes.map(b => {
    const explicitKids = childrenByParent.get(b.id) || [];
    let subGroups;

    if (explicitKids.length > 0) {
      subGroups = explicitKids.map(c => {
        const grandKids = childrenByParent.get(c.id) || [];
        let leaves;
        if (grandKids.length > 0) {
          leaves = grandKids.map(gc => ({
            text: truncateText(getNodeTitle(gc), 36),
            nodeId: gc.id,
            rawNode: gc,
          }));
        } else {
          const flatLeaves = extractSubBranches(c).flatMap(sg => sg.leaves).slice(0, 4);
          leaves = (flatLeaves.length ? flatLeaves : [truncateText(getNodeTitle(c), 36)]).map(t => ({
            text: t,
            nodeId: c.id,
            rawNode: c,
          }));
        }
        return {
          label: truncateText(getNodeTitle(c), 24),
          nodeId: c.id,
          rawNode: c,
          leaves,
        };
      });
    } else {
      subGroups = extractSubBranches(b).map(sg => ({
        label: sg.label,
        nodeId: b.id,
        rawNode: b,
        leaves: sg.leaves.map(t => ({
          text: t,
          nodeId: b.id,
          rawNode: b,
        })),
      }));
    }

    return {
      nodeId: b.id,
      rawNode: b,
      label: truncateText(getNodeTitle(b), 26),
      verified: b.verification_status === 'verified',
      subGroups,
    };
  });

  function isDimmed(rawNode) {
    if (!rawNode) return false;
    const typeKey = rawNode.node_type || 'note';
    const matchesFilter = !filterType
      || typeKey === filterType
      || (filterType === 'pattern' && typeKey === 'checkpoint')
      || (filterType === 'trap' && typeKey === 'case_study');
    const matchesSearch = !qLower
      || (rawNode.text || '').toLowerCase().includes(qLower)
      || (rawNode.source_ref?.concept_id || '').toLowerCase().includes(qLower);
    return !matchesFilter || !matchesSearch;
  }

  const half = Math.ceil(rawBranches.length / 2);
  const leftBranches = rawBranches.slice(0, half);
  const rightBranches = rawBranches.slice(half);

  const leftLayout = layoutDaySide(leftBranches, 'left', LEFT_THEMES, CENTER_X, nodeColors);
  const rightLayout = layoutDaySide(rightBranches, 'right', RIGHT_THEMES, CENTER_X, nodeColors);

  const maxH = Math.max(leftLayout.height, rightLayout.height, ROOT_H + 80);
  const topPad = 64;
  const leftOffsetY = topPad + Math.round((maxH - leftLayout.height) / 2);
  const rightOffsetY = topPad + Math.round((maxH - rightLayout.height) / 2);
  const rootY = topPad + Math.round((maxH - ROOT_H) / 2);

  const shortTitle = rootNode
    ? getNodeTitle(rootNode).replace(/^Ngày\s+\d+:\s*/i, '').trim()
    : `Ngày ${day}`;
  const rootTitle = tab === 'lab' ? `Lab · Ngày ${day}` : `AI20K · Ngày ${day}`;
  const rootLines = [
    truncateText(shortTitle, 24),
    tab === 'lab' ? 'Lab Mapping' : 'Knowledge Graph',
  ];

  const allNodes = [
    {
      id: 'root',
      kind: 'root',
      nodeId: rootNode?.id || null,
      rawNode: rootNode,
      title: rootTitle,
      lines: rootLines,
      x: ROOT_X,
      y: rootY,
      width: ROOT_W,
      height: ROOT_H,
      dimmed: rootNode ? isDimmed(rootNode) : false,
    },
    ...leftLayout.nodes.map(n => ({
      ...n,
      y: n.y + leftOffsetY,
      dimmed: isDimmed(n.rawNode),
    })),
    ...rightLayout.nodes.map(n => ({
      ...n,
      y: n.y + rightOffsetY,
      dimmed: isDimmed(n.rawNode),
    })),
  ];

  const allEdges = [...leftLayout.edges, ...rightLayout.edges];
  const canvasW = 1960;
  const canvasH = Math.max(760, maxH + topPad * 2 + 90);
  return { nodes: allNodes, edges: allEdges, canvasW, canvasH };
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
  onSwitchView,
}) {
  const newNode = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [nodeColors, setNodeColors] = useState({});
  const [filterType, setFilterType] = useState(null);

  const byId = useMemo(() => new Map(nodes.map(node => [node.id, node])), [nodes]);
  const selectedNode = nodes.find(n => n.id === selectedId) || null;
  const rootNode = nodes.find(n => n.node_type === 'day_root') || null;

  const layout = useMemo(
    () => computeDayXMindLayout({ nodes, day, tab, nodeColors, filterType, searchQuery }),
    [nodes, day, tab, nodeColors, filterType, searchQuery],
  );
  const placedById = useMemo(() => new Map(layout.nodes.map(n => [n.id, n])), [layout.nodes]);

  const { zoom, stepZoom, fitToView, centerView, viewportProps, layerStyle, minimapStyle } =
    useMindmapViewport(layout, {
      viewKey: `${day}:${tab}`,
      layoutTrigger,
      bottomInset: 60,
      onBackgroundPointerDown: () => {
        onSelect?.(null);
        setPaletteOpen(false);
      },
    });

  function update(id, changes) {
    onChange(nodes.map(node => (node.id === id ? { ...node, ...changes } : node)));
  }

  function add(x, y, parentId = null) {
    if (nodes.length >= MAX_NODES) return;
    const id = globalThis.crypto?.randomUUID?.() ?? makeId();
    newNode.current = id;
    setEditingId(id);
    onChange([
      ...nodes,
      {
        id,
        text: '',
        x: clamp(x),
        y: clamp(y),
        parent_id: parentId,
        node_type: 'note',
        source_ref: null,
        code_link: null,
        verification_status: 'user_note',
      },
    ]);
    onSelect?.(id);
  }

  function addChild(parent) {
    add(clamp(parent.x + 280), clamp(parent.y + 80), parent.id);
  }

  function addInView() {
    add(980, 380, rootNode?.id ?? null);
  }

  function remove(id) {
    if (selectedId === id) {
      onSelect?.(null);
      setPaletteOpen(false);
    }
    if (editingId === id) setEditingId(null);
    onChange(
      nodes
        .filter(node => node.id !== id)
        .map(node => (node.parent_id === id ? { ...node, parent_id: null } : node)),
    );
  }

  function canLink(node, target) {
    let ancestor = target;
    while (ancestor) {
      if (ancestor.id === node.id) return false;
      ancestor = byId.get(ancestor.parent_id);
    }
    return true;
  }

  function buildSymmetricEdge(edge) {
    const from = placedById.get(edge.fromId);
    const to = placedById.get(edge.toId);
    if (!from || !to) return null;

    const isLeft = edge.side === 'left';
    const x1 = isLeft ? from.x : from.x + from.width;
    const y1 = from.y + from.height / 2;
    const x2 = isLeft ? to.x + to.width : to.x;
    const y2 = to.y + to.height / 2;

    const dx = Math.abs(x2 - x1);
    const c1 = isLeft ? x1 - dx * 0.55 : x1 + dx * 0.55;
    const c2 = isLeft ? x2 + dx * 0.45 : x2 - dx * 0.45;
    return `M ${x1} ${y1} C ${c1} ${y1}, ${c2} ${y2}, ${x2} ${y2}`;
  }

  const editingNode = editingId ? byId.get(editingId) : null;
  const editingAnchor = editingId
    ? layout.nodes.find(n => n.nodeId === editingId && n.kind === 'l1')
      || layout.nodes.find(n => n.nodeId === editingId && n.kind === 'l2')
      || layout.nodes.find(n => n.nodeId === editingId)
      || layout.nodes[0]
    : null;

  const selectedTheme = selectedNode
    ? layout.nodes.find(n => n.nodeId === selectedNode.id)?.theme || XMIND_THEMES[0]
    : XMIND_THEMES[0];

  return (
    <section className="flex-1 relative overflow-hidden flex" aria-label="Sơ đồ tư duy XMind">
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
          Loại
        </div>
        {[
          ['concept', 'bg-blue-500 ring-blue-200', 'Khái niệm'],
          ['pattern', 'bg-purple-500 ring-purple-200', 'Kiến trúc / CP'],
          ['metric', 'bg-emerald-500 ring-emerald-200', 'Chỉ số'],
          ['trap', 'bg-pink-600 ring-pink-200', 'Bẫy / Lỗi'],
          ['code_ref', 'bg-teal-500 ring-teal-200', 'Code Lab'],
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

      {/* Floating Contextual Toolbar */}
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
              title="Đổi màu nhánh XMind"
            >
              <span
                className="w-4 h-4 rounded-full border border-slate-300 shadow-inner"
                style={{ backgroundColor: selectedTheme.solid }}
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
              {XMIND_THEMES.map((theme, idx) => {
                const isActive = nodeColors[selectedNode.id] === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    title={`Màu nhánh ${idx + 1}`}
                    onClick={() => {
                      setNodeColors(prev => ({ ...prev, [selectedNode.id]: idx }));
                      setPaletteOpen(false);
                    }}
                    className={`w-6 h-6 rounded-full transition transform hover:scale-110 ${
                      isActive ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'border border-slate-200'
                    }`}
                    style={{ backgroundColor: theme.solid }}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Interactive XMind Canvas */}
      <div
        id="canvas-container"
        {...viewportProps}
        tabIndex={0}
        aria-label="Canvas sơ đồ tư duy XMind"
        className={`mindmap-viewport flex-1 h-full w-full relative ${showGrid ? 'bg-dot-grid' : 'bg-plain-canvas'}`}
      >
        <div className="mindmap-layer" data-mindmap-layer style={layerStyle}>
          {/* Color-matched Smooth Bezier Branches */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" xmlns="http://www.w3.org/2000/svg">
            {layout.edges.map(edge => {
              const d = buildSymmetricEdge(edge);
              if (!d) return null;
              const isSelected = edge.nodeId && edge.nodeId === selectedId;
              return (
                <path
                  key={edge.id}
                  d={d}
                  fill="none"
                  stroke={edge.theme.solid}
                  strokeWidth={isSelected ? 2.4 : 1.5}
                  strokeLinecap="round"
                  opacity={isSelected ? 1 : 0.72}
                />
              );
            })}
          </svg>

          {/* Symmetric 3-Level XMind Nodes */}
          {layout.nodes.map(node => {
            const isSelected = node.nodeId && node.nodeId === selectedId;

            if (node.kind === 'root') {
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    if (node.nodeId) onSelect?.(node.nodeId);
                  }}
                  onDoubleClick={e => {
                    e.stopPropagation();
                    if (node.nodeId) setEditingId(node.nodeId);
                  }}
                  style={{ position: 'absolute', left: node.x, top: node.y, width: node.width, height: node.height }}
                  className={`mindmap-node rounded-2xl bg-[#111E38] text-white shadow-xl hover:shadow-2xl px-4 py-3 flex flex-col items-center justify-center text-center z-10 border border-slate-700 cursor-pointer ${
                    isSelected ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                  } ${node.dimmed ? 'opacity-25' : ''}`}
                  title="Bấm chọn · Bấm đúp để chỉnh sửa"
                >
                  <div className="text-[13.5px] font-bold tracking-tight text-white mb-1.5">
                    {node.title}
                  </div>
                  {node.lines.map((line, i) => (
                    <div key={i} className="text-[11px] text-slate-300 leading-snug truncate max-w-full">
                      {line}
                    </div>
                  ))}
                </button>
              );
            }

            if (node.kind === 'l1') {
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    if (node.nodeId) onSelect?.(node.nodeId);
                  }}
                  onDoubleClick={e => {
                    e.stopPropagation();
                    if (node.nodeId) setEditingId(node.nodeId);
                  }}
                  style={{
                    position: 'absolute',
                    left: node.x,
                    top: node.y,
                    width: node.width,
                    height: node.height,
                    backgroundColor: node.theme.solid,
                  }}
                  className={`mindmap-node rounded-lg px-3 flex items-center justify-center text-center text-white font-bold text-[12px] shadow-md hover:brightness-105 z-10 cursor-pointer ${
                    isSelected ? 'ring-2 ring-offset-2 ring-slate-900' : ''
                  } ${node.dimmed ? 'opacity-25' : ''}`}
                  title={`${node.text} — Bấm để xem · Bấm đúp để sửa`}
                >
                  <span className="truncate">{node.text}</span>
                </button>
              );
            }

            if (node.kind === 'l2') {
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    if (node.nodeId) onSelect?.(node.nodeId);
                  }}
                  onDoubleClick={e => {
                    e.stopPropagation();
                    if (node.nodeId) setEditingId(node.nodeId);
                  }}
                  style={{
                    position: 'absolute',
                    left: node.x,
                    top: node.y,
                    width: node.width,
                    height: node.height,
                    backgroundColor: node.theme.tint,
                    borderColor: node.theme.tintBorder,
                    color: node.theme.tintText,
                  }}
                  className={`mindmap-node rounded-md border px-2.5 flex items-center justify-center text-center font-semibold text-[11.5px] shadow-2xs hover:shadow-sm z-10 cursor-pointer ${
                    isSelected ? 'ring-2 ring-blue-500' : ''
                  } ${node.dimmed ? 'opacity-25' : ''}`}
                  title={`${node.text} — Bấm để xem · Bấm đúp để sửa`}
                >
                  <span className="truncate">{node.text}</span>
                </button>
              );
            }

            return (
              <button
                key={node.id}
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  if (node.nodeId) onSelect?.(node.nodeId);
                }}
                onDoubleClick={e => {
                  e.stopPropagation();
                  if (node.nodeId) setEditingId(node.nodeId);
                }}
                style={{ position: 'absolute', left: node.x, top: node.y, width: node.width, height: node.height }}
                className={`mindmap-node rounded-md bg-white px-2.5 flex items-center justify-center text-center text-[11px] font-medium text-slate-700 border shadow-2xs hover:border-slate-400 z-10 cursor-pointer ${
                  isSelected ? 'border-blue-600 ring-1 ring-blue-300' : 'border-slate-300/85'
                } ${node.dimmed ? 'opacity-25' : ''}`}
                title={`${node.text} — Bấm để xem · Bấm đúp để sửa`}
              >
                <span className="truncate">{node.text}</span>
              </button>
            );
          })}

          {/* Inline Editor Popover */}
          {editingNode && editingAnchor && (
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute',
                left: Math.max(16, Math.min(layout.canvasW - 300, editingAnchor.x)),
                top: Math.max(16, editingAnchor.y + editingAnchor.height + 8),
              }}
              className="bg-white rounded-2xl shadow-2xl border-2 border-blue-600 p-3 space-y-2 w-[280px] z-40"
            >
              <textarea
                rows={3}
                ref={input => {
                  if (input && newNode.current === editingNode.id) {
                    newNode.current = null;
                    input.focus();
                  }
                }}
                value={editingNode.text}
                maxLength={20000}
                placeholder="Nhập nội dung nút..."
                onChange={e => update(editingNode.id, { text: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500"
              />
              <div className="flex items-center gap-1.5">
                <select
                  aria-label="Nối ý với"
                  value={editingNode.parent_id ?? ''}
                  onChange={e => update(editingNode.id, { parent_id: e.target.value || null })}
                  className="flex-1 min-w-0 text-[11px] border border-slate-300 rounded-md py-1 px-2 bg-white"
                >
                  <option value="">Nút gốc (không nối)</option>
                  {nodes.map((target, tIdx) => (
                    canLink(editingNode, target) && (
                      <option key={target.id} value={target.id}>
                        ↳ {getNodeTitle(target).slice(0, 42) || `Ý ${tIdx + 1}`}
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
          )}
        </div>
      </div>

      {/* FloatingCanvasControls (Bottom center) */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 bg-white/95 backdrop-blur-sm border border-slate-200 shadow-xl rounded-xl px-3 py-1.5 flex items-center space-x-2 max-w-[calc(100vw-2rem)] overflow-x-auto">
        <button
          type="button"
          onClick={() => stepZoom(-1)}
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
          onClick={() => stepZoom(1)}
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
          onClick={() => centerView(placedById.get('root'))}
          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition"
          title="Căn giữa màn hình"
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
            className="px-2 py-1 text-[11px] rounded-md font-semibold text-slate-600 hover:text-slate-900 transition"
          >
            Cây khóa học
          </button>
          <button
            type="button"
            onClick={() => onSwitchTab?.('mindmaps')}
            className={`px-2 py-1 text-[11px] rounded-md font-semibold transition ${
              tab === 'mindmaps' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mindmap ngày
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
        <div className="w-full h-20 bg-slate-100 rounded relative overflow-hidden border border-slate-200">
          {layout.nodes
            .filter(n => n.kind === 'root' || n.kind === 'l1')
            .map(n => (
              <div
                key={n.id}
                className={`absolute rounded ${n.kind === 'root' ? 'bg-slate-900 w-3 h-2.5' : `${n.theme?.mini || 'bg-slate-400'} w-3 h-1`}`}
                style={{
                  left: `${Math.max(0, Math.min(92, (n.x / layout.canvasW) * 100))}%`,
                  top: `${Math.max(0, Math.min(90, (n.y / layout.canvasH) * 100))}%`,
                }}
              />
            ))}
          <div
            className="absolute border border-blue-600 bg-blue-500/10 rounded pointer-events-none"
            style={minimapStyle}
          />
        </div>
      </div>
    </section>
  );
}
