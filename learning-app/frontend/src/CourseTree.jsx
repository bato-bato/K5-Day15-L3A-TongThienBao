import React, { useEffect, useMemo, useRef, useState } from 'react';
import { sizeMindmap } from './mindmapSizing.js';
import { useMindmapViewport } from './useMindmapViewport.js';

export const COURSE_LEVELS = [
  { id: 'lv1', title: 'Cấp độ 1: Nền tảng & Bài toán AI', badge: 'Cơ bản', days: [1, 2, 3] },
  { id: 'lv2', title: 'Cấp độ 2: Prompt, UX, Data & RAG', badge: 'Trung cấp', days: [4, 5, 6, 7] },
  { id: 'lv3', title: 'Cấp độ 3: Agent, Eval & Safety', badge: 'Nâng cao', days: [8, 9, 10, 11] },
  { id: 'lv4', title: 'Cấp độ 4: Deploy, Kinh tế & Lab', badge: 'Production', days: [12, 13, 14] },
];

export const LEFT_THEMES = [
  { solid: '#1D63B8', tint: '#EFF6FF', tintBorder: '#93C5FD', tintText: '#1E40AF', mini: 'bg-blue-600' },
  { solid: '#00897B', tint: '#F0FDFA', tintBorder: '#5EEAD4', tintText: '#0F766E', mini: 'bg-teal-600' },
  { solid: '#7C3AED', tint: '#F5F3FF', tintBorder: '#C4B5FD', tintText: '#5B21B6', mini: 'bg-purple-600' },
  { solid: '#C2591A', tint: '#FFF7ED', tintBorder: '#FDBA74', tintText: '#9A3412', mini: 'bg-orange-600' },
];

export const RIGHT_THEMES = [
  { solid: '#0284C7', tint: '#F0F9FF', tintBorder: '#7DD3FC', tintText: '#0369A1', mini: 'bg-sky-600' },
  { solid: '#A2256E', tint: '#FDF2F8', tintBorder: '#F9A8D4', tintText: '#9D174D', mini: 'bg-pink-700' },
  { solid: '#3D7A38', tint: '#F0FDF4', tintBorder: '#86EFAC', tintText: '#166534', mini: 'bg-green-700' },
  { solid: '#B93848', tint: '#FEF2F2', tintBorder: '#FCA5A5', tintText: '#991B1B', mini: 'bg-rose-700' },
];

function splitTopLevelBy(str, sep) {
  const items = [];
  let buf = '';
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '(') depth++;
    else if (ch === ')' && depth > 0) depth--;
    if (depth === 0 && str.slice(i, i + sep.length) === sep) {
      if (buf.trim()) items.push(buf.trim());
      buf = '';
      i += sep.length - 1;
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) items.push(buf.trim());
  return items;
}

function getDayShortTitle(mindmapsByDay, day) {
  const root = mindmapsByDay?.[day]?.nodes?.find(n => n.node_type === 'day_root');
  if (!root?.text) return `Ngày ${day}`;
  const firstLine = root.text.split('\n')[0].replace(/^Ngày\s+\d+:\s*/i, '').trim();
  return firstLine || `Ngày ${day}`;
}

export function getNodeTitle(node) {
  const line = (node?.text || '').split('\n')[0] || '';
  return line.replace(/^\[[^\]]+\]\s*/, '').trim() || 'Ý tưởng mới';
}

function cleanGroupLabel(rawLabel) {
  if (!rawLabel) return 'Khái niệm';
  const cleaned = rawLabel
    .replace(/^\(\d+\)\s*/, '')
    .replace(/\([^)]*\)/g, '')
    .trim();
  return cleaned || 'Khái niệm';
}

function inferTopicLabel(chunk, parentTitle) {
  const clean = (chunk || '').replace(/^\(\d+\)\s*/, '').trim();
  const cleanNoParens = clean.replace(/\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').trim();

  const costMatch = cleanNoParens.match(/^(.{2,30}?)\s+(đắt gấp|rẻ hơn)\b/i);
  if (costMatch) {
    return cleanGroupLabel(`Giá ${costMatch[1].trim()}`);
  }
  const spendMatch = cleanNoParens.match(/^(.+?)\s+tốn\b/i);
  if (spendMatch) {
    const subj = spendMatch[1].trim();
    if (subj.includes(',')) {
      const firstItem = subj.split(',')[0].trim();
      return firstItem && firstItem.length <= 24 ? cleanGroupLabel(firstItem) : 'Độ tốn token';
    }
    return subj.length <= 24 ? cleanGroupLabel(subj) : 'Độ tốn token';
  }

  const parenLead = clean.match(/^([^(]{2,34})\s*\(([^)]{2,60})\)/);
  if (parenLead) {
    return cleanGroupLabel(parenLead[1].trim());
  }

  const GENERIC_FILLERS = new Set(['luôn', 'chỉ', 'không', 'bắt buộc', 'bắt đầu', 'việc', 'khi', 'để', 'hãy', 'nên']);
  const subjMatch = cleanNoParens.match(
    /^(.{2,34}?)\s+(?:ngăn|giúp|cho phép|ghi nhận|đòi hỏi|bao gồm|gồm có|gồm|tạo ra|dẫn đến|gây ra|thắng thế|hữu hạn|là|dùng|sử dụng|cần|phải|nên|tránh)\b/i,
  );
  if (subjMatch) {
    const subj = subjMatch[1].trim();
    if (!GENERIC_FILLERS.has(subj.toLowerCase())) {
      return cleanGroupLabel(subj);
    }
  }

  const stripped = cleanNoParens
    .replace(
      /^(?:Bắt đầu từ|Luôn ưu tiên|Bắt buộc xác định|Bắt buộc|Ưu tiên|Viết script|Xây dựng|Sử dụng|Dùng|Không|Tránh|Cần|Phải|Nên)\s+/i,
      '',
    )
    .trim();
  if (stripped) {
    const words = stripped.split(/\s+/);
    return words.slice(0, 4).join(' ');
  }

  const parentSegment = (parentTitle || '').split(/[&—–:]/)[0].trim();
  return cleanGroupLabel(parentSegment || 'Khái niệm');
}

export function extractSubBranches(node) {
  const raw = (node?.text || '').trim();
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l && l !== '—');
  const body = lines.slice(1).join(' ').trim();
  const parentTitle = getNodeTitle(node);

  if (!body) {
    return [{
      label: node?.source_ref?.pdf_pages?.length ? `Tr.${node.source_ref.pdf_pages.join(',')}` : 'Ghi chú',
      leaves: [parentTitle],
    }];
  }

  const normalized = body.replace(/\s+(?=\(\d+\)\s)/g, '; ');
  const chunks = normalized
    .split(/;\s+|(?<!\d)\.(?!\d)\s+/)
    .map(c => c.replace(/\.$/, '').replace(/->/g, '→').trim())
    .filter(Boolean);

  const groups = [];
  for (let i = 0; i < chunks.length && groups.length < 3; i++) {
    const chunk = chunks[i];

    if (chunk.includes(' > ')) {
      const hItems = chunk.split(/\s+>\s+/).map(t => t.trim()).filter(Boolean);
      if (hItems.length >= 3) {
        const parentSegment = (parentTitle || '').split(/[&—–:]/)[0].trim();
        groups.push({
          label: cleanGroupLabel(parentSegment || hItems[0]),
          leaves: hItems.slice(0, 5),
        });
        continue;
      }
    }

    const eqIdx = chunk.indexOf(' = ');
    if (eqIdx > 0 && eqIdx <= 32 && !chunk.slice(0, eqIdx).includes(':')) {
      const lhs = chunk.slice(0, eqIdx).trim();
      const rhs = chunk.slice(eqIdx + 3).trim();
      if (rhs.includes(' + ')) {
        const terms = rhs.split(/\s+\+\s+/).map(t => t.replace(/\([^)]*\)/g, '').trim()).filter(Boolean);
        if (terms.length >= 2) {
          const eqLabel = lhs.length <= 2 ? `${lhs} = ${terms.slice(0, 2).join(' + ')}` : lhs;
          groups.push({ label: eqLabel, leaves: terms.slice(0, 4) });
          continue;
        }
      }
    }

    const colonIdx = chunk.indexOf(': ');
    const hasLabel = colonIdx > 0 && colonIdx <= 65;
    const label = hasLabel ? chunk.slice(0, colonIdx).trim() : '';
    const rest = hasLabel ? chunk.slice(colonIdx + 2).trim() : chunk;

    const commaItems = splitTopLevelBy(rest, ',');
    if (hasLabel && commaItems.length >= 2) {
      groups.push({
        label: cleanGroupLabel(label),
        leaves: commaItems.slice(0, 4),
      });
      continue;
    }

    const arrowSteps = splitTopLevelBy(rest, '→');
    if (arrowSteps.length >= 2) {
      groups.push({
        label: cleanGroupLabel(label || 'Quy trình'),
        leaves: arrowSteps.slice(0, 4),
      });
      continue;
    }

    const verbMatch = chunk.match(/^(.{6,45}?\b(?:đòi hỏi|bao gồm|gồm|qua \d+ [^:]+))\s+([^:]+)$/i);
    if (verbMatch) {
      const vItems = splitTopLevelBy(verbMatch[2], ',');
      if (vItems.length >= 2) {
        groups.push({
          label: cleanGroupLabel(verbMatch[1]),
          leaves: vItems.slice(0, 4),
        });
        continue;
      }
    }

    if (!hasLabel && commaItems.length >= 2) {
      const hasEndVerb = /\b(?:tốn nhiều|đắt gấp|rẻ hơn|là|giúp|gồm)\b/i.test(chunk);
      const inferredLabel = hasEndVerb
        ? inferTopicLabel(chunk, parentTitle)
        : cleanGroupLabel((parentTitle || '').split(/[&—–:]/)[0].trim() || inferTopicLabel(chunk, parentTitle));
      groups.push({
        label: inferredLabel,
        leaves: commaItems.slice(0, 4),
      });
      continue;
    }

    const fallbackItems = commaItems.length >= 2 ? commaItems.slice(0, 4) : [rest];
    groups.push({
      label: label ? cleanGroupLabel(label) : inferTopicLabel(rest, parentTitle),
      leaves: fallbackItems,
    });
  }

  const seenLabels = new Set();
  const deduped = groups.map(g => {
    let lbl = g.label || 'Khái niệm';
    if (seenLabels.has(lbl.toLowerCase()) && g.leaves?.[0]) {
      const alt = g.leaves[0].replace(/\([^)]*\)/g, '').trim().split(/\s+/).slice(0, 3).join(' ');
      if (alt) lbl = alt;
    }
    seenLabels.add(lbl.toLowerCase());
    return { ...g, label: lbl };
  });

  if (deduped.length === 1 && node?.source_ref?.pdf_pages?.length) {
    deduped.push({
      label: 'Nguồn PDF',
      leaves: [`Ngày ${node.source_ref.day} · Tr.${node.source_ref.pdf_pages.join(', ')}`],
    });
  } else if (deduped.length === 1 && node?.code_link?.file_path) {
    deduped.push({
      label: 'Code Lab',
      leaves: [node.code_link.file_path.split('/').slice(-2).join('/')],
    });
  }

  return deduped.slice(0, 3);
}

function layoutSideBranches(branches, side, themes, nodeBox, expandedIds, hasSearch) {
  const LEAF_GAP = 4;
  const L2_GAP = 14;
  const L1_GAP = 26;

  const placedNodes = [];
  const placedEdges = [];
  let cursorY = 0;

  branches.forEach((branch, bIdx) => {
    const theme = themes[bIdx % themes.length];
    const l1Id = `l1:${branch.id}`;
    const l1 = nodeBox(branch.label, 'l1', side);
    const hasL1Children = branch.subGroups.length > 0;
    const isL1Expanded = hasL1Children && ((hasSearch && branch.matchesSearch) || expandedIds.has(l1Id));
    const l1Dimmed = hasSearch && !branch.matchesSearch;

    if (!isL1Expanded) {
      const l1Y = cursorY;
      placedNodes.push({
        id: l1Id,
        kind: 'l1',
        side,
        conceptId: branch.conceptId,
        day: branch.day,
        text: branch.label,
        verified: branch.verified,
        theme,
        hasChildren: hasL1Children,
        isCollapsed: hasL1Children,
        hiddenCount: branch.subGroups.length,
        dimmed: l1Dimmed,
        ...l1,
        y: l1Y,
      });
      placedEdges.push({
        id: `e:root->${l1Id}`,
        fromId: 'root',
        toId: l1Id,
        side,
        theme,
        conceptId: branch.conceptId,
      });
      cursorY += l1.height + L1_GAP;
      return;
    }

    const l1StartY = cursorY;
    const firstChildIndex = placedNodes.length;

    branch.subGroups.forEach((sg, sgIdx) => {
      const l2Id = `l2:${branch.id}:${sgIdx}`;
      const l2 = nodeBox(sg.label, 'l2', side);
      const hasL2Children = sg.leaves.length > 0;
      const sgMatches = sg.matchesSearch ?? branch.matchesSearch;
      const isL2Expanded = hasL2Children && ((hasSearch && sgMatches) || expandedIds.has(l2Id));
      const l2Dimmed = hasSearch && !sgMatches;

      if (!isL2Expanded) {
        const l2Y = cursorY;
        placedNodes.push({
          id: l2Id,
          kind: 'l2',
          side,
          conceptId: branch.conceptId,
          day: sg.dayOverride ?? branch.day,
          text: sg.label,
          theme,
          hasChildren: hasL2Children,
          isCollapsed: hasL2Children,
          hiddenCount: sg.leaves.length,
          dimmed: l2Dimmed,
          ...l2,
          y: l2Y,
        });
        placedEdges.push({
          id: `e:${l1Id}->${l2Id}`,
          fromId: l1Id,
          toId: l2Id,
          side,
          theme,
          conceptId: branch.conceptId,
        });
        cursorY += l2.height + L2_GAP;
        return;
      }

      const leaves = sg.leaves.map(text => nodeBox(text, 'l3', side));
      const leavesHeight = leaves.reduce((total, leaf) => total + leaf.height, 0) + (leaves.length - 1) * LEAF_GAP;
      const groupHeight = Math.max(l2.height, leavesHeight);
      let leafY = cursorY + (groupHeight - leavesHeight) / 2;

      sg.leaves.forEach((leafText, lIdx) => {
        const l3Id = `l3:${branch.id}:${sgIdx}:${lIdx}`;
        const leaf = leaves[lIdx];
        const leafDimmed = hasSearch && (sg.leafMatches ? !sg.leafMatches[lIdx] : !sgMatches);
        placedNodes.push({
          id: l3Id,
          kind: 'l3',
          side,
          conceptId: branch.conceptId,
          day: sg.dayOverride ?? branch.day,
          text: leafText,
          theme,
          dimmed: leafDimmed,
          ...leaf,
          y: leafY,
        });
        leafY += leaf.height + LEAF_GAP;
        placedEdges.push({
          id: `e:${l2Id}->${l3Id}`,
          fromId: l2Id,
          toId: l3Id,
          side,
          theme,
          conceptId: branch.conceptId,
        });
      });

      const l2Y = cursorY + (groupHeight - l2.height) / 2;
      placedNodes.push({
        id: l2Id,
        kind: 'l2',
        side,
        conceptId: branch.conceptId,
        day: sg.dayOverride ?? branch.day,
        text: sg.label,
        theme,
        hasChildren: hasL2Children,
        isCollapsed: false,
        hiddenCount: sg.leaves.length,
        dimmed: l2Dimmed,
        ...l2,
        y: l2Y,
      });
      placedEdges.push({
        id: `e:${l1Id}->${l2Id}`,
        fromId: l1Id,
        toId: l2Id,
        side,
        theme,
        conceptId: branch.conceptId,
      });

      cursorY += groupHeight + L2_GAP;
    });

    const childrenHeight = cursorY - L2_GAP - l1StartY;
    const branchHeight = Math.max(l1.height, childrenHeight);
    const childOffset = (branchHeight - childrenHeight) / 2;
    for (let i = firstChildIndex; i < placedNodes.length; i++) placedNodes[i].y += childOffset;
    const l1Y = l1StartY + (branchHeight - l1.height) / 2;

    placedNodes.push({
      id: l1Id,
      kind: 'l1',
      side,
      conceptId: branch.conceptId,
      day: branch.day,
      text: branch.label,
      verified: branch.verified,
      theme,
      hasChildren: hasL1Children,
      isCollapsed: false,
      hiddenCount: branch.subGroups.length,
      dimmed: l1Dimmed,
      ...l1,
      y: l1Y,
    });
    placedEdges.push({
      id: `e:root->${l1Id}`,
      fromId: 'root',
      toId: l1Id,
      side,
      theme,
      conceptId: branch.conceptId,
    });

    cursorY = l1StartY + branchHeight + L1_GAP;
  });

  const totalHeight = branches.length ? Math.max(120, cursorY - L1_GAP) : 0;
  return { nodes: placedNodes, edges: placedEdges, height: totalHeight };
}

function nodeMatchesQuery(node, qLower) {
  if (!qLower) return true;
  return (
    (node.text || '').toLowerCase().includes(qLower)
    || (node.source_ref?.concept_id || '').toLowerCase().includes(qLower)
    || (node.lab_topic?.id || '').toLowerCase().includes(qLower)
  );
}

function computeSymmetricLayout({ mindmapsByDay, page, searchQuery, expandedIds }) {
  const qLower = searchQuery.trim().toLowerCase();
  const hasSearch = Boolean(qLower);

  let rawBranches = [];
  let rootTitle = '';
  let rootLines = [];
  let rootConceptId = null;

  if (page === 'all') {
    rootTitle = 'AI20K · 14 Ngày';
    rootLines = ['4 Cấp độ học', 'Knowledge Graph', 'Lab Mapping'];
    rawBranches = COURSE_LEVELS.map(lvl => {
      const subGroups = lvl.days.map(d => {
        const dNodes = mindmapsByDay?.[d]?.nodes || [];
        const concepts = dNodes.filter(n => n.node_type !== 'day_root');
        const dayTitle = getDayShortTitle(mindmapsByDay, d);
        const dayLabel = `D${String(d).padStart(2, '0')} · ${dayTitle}`;
        const matchingConcepts = qLower ? concepts.filter(c => nodeMatchesQuery(c, qLower)) : concepts;
        const dayLabelMatches = !qLower || dayLabel.toLowerCase().includes(qLower);
        const shownConcepts = (qLower && matchingConcepts.length > 0 ? matchingConcepts : concepts).slice(0, 4);
        const sgMatches = !qLower || dayLabelMatches || matchingConcepts.length > 0;

        return {
          label: dayLabel,
          leaves: shownConcepts.map(c => getNodeTitle(c)),
          dayOverride: d,
          matchesSearch: sgMatches,
          leafMatches: shownConcepts.map(c => !qLower || dayLabelMatches || nodeMatchesQuery(c, qLower)),
        };
      });

      const lvlTitle = lvl.title.replace(/^Cấp độ \d+:\s*/i, '');
      const lvlMatches = !qLower || lvlTitle.toLowerCase().includes(qLower) || subGroups.some(sg => sg.matchesSearch);

      return {
        id: lvl.id,
        conceptId: null,
        day: lvl.days[0],
        label: lvlTitle,
        verified: true,
        matchesSearch: lvlMatches,
        subGroups,
      };
    });
  } else {
    const dayNodes = mindmapsByDay?.[page]?.nodes || [];
    const rootNode = dayNodes.find(n => n.node_type === 'day_root') || null;
    rootConceptId = rootNode?.id || null;
    rootTitle = `AI20K · Ngày ${String(page).padStart(2, '0')}`;
    const dayShort = getDayShortTitle(mindmapsByDay, page);
    rootLines = [dayShort, 'Mindmap Tri thức'];

    const children = dayNodes.filter(n => n.node_type !== 'day_root');
    if (children.length === 0) {
      rawBranches = [{
        id: 'empty',
        conceptId: rootConceptId,
        day: page,
        label: 'Chưa có nút con',
        verified: false,
        matchesSearch: true,
        subGroups: [{
          label: 'Gợi ý',
          leaves: ['Chọn ngày khác ở thanh phân trang phía dưới', 'Hoặc dùng ô tìm kiếm trên thanh tiêu đề'],
          matchesSearch: true,
        }],
      }];
    } else {
      rawBranches = children.map(node => ({
        id: node.id,
        conceptId: node.id,
        day: page,
        label: getNodeTitle(node),
        verified: node.verification_status === 'verified',
        matchesSearch: nodeMatchesQuery(node, qLower),
        subGroups: extractSubBranches(node),
      }));
    }
  }

  const half = Math.ceil(rawBranches.length / 2);
  const leftBranches = rawBranches.slice(0, half);
  const rightBranches = rawBranches.slice(half);

  const { nodeBox, centerX, rootWidth, rootHeight, rootLabels, canvasW } =
    sizeMindmap(rawBranches, rootLines, text => text);
  const leftLayout = layoutSideBranches(leftBranches, 'left', LEFT_THEMES, nodeBox, expandedIds, hasSearch);
  const rightLayout = layoutSideBranches(rightBranches, 'right', RIGHT_THEMES, nodeBox, expandedIds, hasSearch);

  const maxH = Math.max(leftLayout.height, rightLayout.height, rootHeight + 80);
  const topPad = 64;
  const leftOffsetY = topPad + Math.round((maxH - leftLayout.height) / 2);
  const rightOffsetY = topPad + Math.round((maxH - rightLayout.height) / 2);
  const rootY = topPad + Math.round((maxH - rootHeight) / 2);

  const allExpandableIds = [];
  rawBranches.forEach(b => {
    if (b.subGroups.length > 0) {
      allExpandableIds.push(`l1:${b.id}`);
      b.subGroups.forEach((sg, idx) => {
        if (sg.leaves.length > 0) {
          allExpandableIds.push(`l2:${b.id}:${idx}`);
        }
      });
    }
  });

  const allNodes = [
    {
      id: 'root',
      kind: 'root',
      conceptId: rootConceptId,
      day: page === 'all' ? 1 : page,
      title: rootTitle,
      lines: rootLabels,
      hasChildren: false,
      isCollapsed: false,
      hiddenCount: rawBranches.length,
      x: centerX - rootWidth / 2,
      y: rootY,
      width: rootWidth,
      height: rootHeight,
      dimmed: false,
    },
    ...leftLayout.nodes.map(n => ({ ...n, y: n.y + leftOffsetY })),
    ...rightLayout.nodes.map(n => ({ ...n, y: n.y + rightOffsetY })),
  ];

  const allEdges = [...leftLayout.edges, ...rightLayout.edges];
  const canvasH = Math.max(760, maxH + topPad * 2 + 90);
  return { nodes: allNodes, edges: allEdges, canvasW, canvasH, allExpandableIds };
}

export function CourseTree({
  mindmapsByDay,
  activeDay,
  selectedNodeId,
  focusedCheckpoint,
  searchQuery = '',
  onSelectConcept,
  onSelectDay,
  onBackToLab,
}) {
  const [page, setPage] = useState(activeDay || 1);
  const [expandedIds, setExpandedIds] = useState(() => {
    const initial = new Set();
    if (selectedNodeId) initial.add(`l1:${selectedNodeId}`);
    for (const nid of focusedCheckpoint?.nodeIds || []) {
      initial.add(`l1:${nid}`);
    }
    return initial;
  });
  const lastPageRef = useRef(page);

  useEffect(() => {
    if (activeDay) setPage(activeDay);
  }, [activeDay]);

  useEffect(() => {
    const pageChanged = lastPageRef.current !== page;
    lastPageRef.current = page;
    setExpandedIds(prev => {
      const next = pageChanged ? new Set() : new Set(prev);
      if (selectedNodeId) next.add(`l1:${selectedNodeId}`);
      for (const nid of focusedCheckpoint?.nodeIds || []) {
        next.add(`l1:${nid}`);
      }
      return next;
    });
  }, [page, selectedNodeId, focusedCheckpoint]);

  const tree = useMemo(
    () => computeSymmetricLayout({ mindmapsByDay, page, searchQuery, expandedIds }),
    [mindmapsByDay, page, searchQuery, expandedIds],
  );
  const byId = useMemo(() => new Map(tree.nodes.map(n => [n.id, n])), [tree.nodes]);
  const initialFocusNode = useMemo(
    () => (selectedNodeId ? tree.nodes.find(n => n.conceptId === selectedNodeId && n.kind === 'l1') : null),
    [tree.nodes, selectedNodeId],
  );
  const { zoom, stepZoom, fitToView, centerView, viewportProps, layerStyle, minimapStyle } =
    useMindmapViewport(tree, {
      viewKey: `mindmap:${page}`,
      layoutTrigger: 0,
      bottomInset: 76,
      initialFocus: initialFocusNode,
    });

  function toggleExpand(nodeId) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }

  function handleNodeClick(node) {
    if (page === 'all' && node.kind === 'l2' && node.day) {
      goToPage(node.day);
      return;
    }
    if (node.conceptId) {
      onSelectConcept?.(node.day, node.conceptId);
      if (node.hasChildren && node.isCollapsed) {
        setExpandedIds(prev => {
          const next = new Set(prev);
          next.add(node.id);
          return next;
        });
      }
      return;
    }
    if (node.hasChildren) {
      toggleExpand(node.id);
    }
  }

  function collapseAllBranches() {
    setExpandedIds(new Set());
  }

  function expandAllBranches() {
    setExpandedIds(new Set(tree.allExpandableIds));
  }

  function goToPage(nextPage) {
    setPage(nextPage);
    if (nextPage !== 'all') {
      onSelectDay?.(nextPage);
    }
  }

  function buildSymmetricEdge(edge) {
    const from = byId.get(edge.fromId);
    const to = byId.get(edge.toId);
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

  const checkpointNodeSet = useMemo(
    () => new Set(focusedCheckpoint?.nodeIds || []),
    [focusedCheckpoint],
  );

  return (
    <section className="flex-1 relative overflow-hidden flex" aria-label="Sơ đồ Mindmap tri thức">
      {/* Lab Section Context Pill */}
      {focusedCheckpoint && page === focusedCheckpoint.day && (
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-white/95 backdrop-blur-sm border border-blue-200 shadow-lg rounded-xl px-3 py-2 max-w-[calc(100vw-2rem)]">
          <button
            type="button"
            onClick={onBackToLab}
            className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs transition shrink-0"
          >
            ← Quay lại Lab
          </button>
          <div className="min-w-0 text-xs flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white font-mono text-[10.5px] font-bold shrink-0">
              {focusedCheckpoint.label}
            </span>
            <span className="font-medium text-slate-700 truncate max-w-[240px]">
              {focusedCheckpoint.title}
            </span>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div
        {...viewportProps}
        tabIndex={0}
        aria-label="Canvas sơ đồ Mindmap"
        className="mindmap-viewport flex-1 h-full w-full relative bg-dot-grid"
      >
        <div className="mindmap-layer" data-mindmap-layer style={layerStyle}>
          {/* Color-matched Smooth Bezier Branches */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" xmlns="http://www.w3.org/2000/svg">
            {tree.edges.map(edge => {
              const d = buildSymmetricEdge(edge);
              if (!d) return null;
              const isSelected = edge.conceptId && edge.conceptId === selectedNodeId;
              const isHighlighted = edge.conceptId && checkpointNodeSet.has(edge.conceptId);
              return (
                <path
                  key={edge.id}
                  d={d}
                  fill="none"
                  stroke={edge.theme.solid}
                  strokeWidth={isSelected ? 2.6 : isHighlighted ? 2.1 : 1.5}
                  strokeLinecap="round"
                  opacity={isSelected || isHighlighted ? 1 : 0.72}
                />
              );
            })}
          </svg>

          {/* Symmetric Nodes */}
          {tree.nodes.map(node => {
            if (node.kind === 'root') {
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => handleNodeClick(node)}
                  title={page === 'all' ? 'Khóa học AI20K · 14 Ngày' : 'Bấm để xem tổng quan ngày học'}
                  style={{ position: 'absolute', left: node.x, top: node.y, width: node.width, height: node.height }}
                  className="mindmap-node rounded-2xl bg-[#111E38] text-white shadow-xl hover:shadow-2xl px-4 py-3 flex flex-col items-center justify-center text-center z-10 border border-slate-700 cursor-pointer"
                >
                  <div className="text-[13.5px] font-bold tracking-tight text-white mb-1.5">
                    {node.title}
                  </div>
                  {node.lines.map((line, i) => (
                    <div key={i} className="text-[11px] text-slate-300 mindmap-label">
                      {line}
                    </div>
                  ))}
                  <span className="mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/15 text-slate-200">
                    {node.hiddenCount} nhánh
                  </span>
                </button>
              );
            }

            const isSelected = node.conceptId && node.conceptId === selectedNodeId;
            const isCheckpointMatch = node.conceptId && checkpointNodeSet.has(node.conceptId);
            const toggleBadgePos = node.side === 'left' ? '-left-3' : '-right-3';

            if (node.kind === 'l1') {
              return (
                <div
                  key={node.id}
                  style={{ position: 'absolute', left: node.x, top: node.y, width: node.width, height: node.height }}
                  className="z-10"
                >
                  <button
                    type="button"
                    onClick={() => handleNodeClick(node)}
                    style={{ backgroundColor: node.theme.solid, width: '100%', height: '100%' }}
                    className={`mindmap-node rounded-lg px-3 flex items-center justify-center text-center text-white font-bold text-[12px] shadow-md hover:brightness-105 cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-offset-2 ring-slate-900'
                        : isCheckpointMatch
                          ? 'ring-2 ring-offset-2 ring-blue-400'
                          : ''
                    } ${node.dimmed ? 'opacity-25' : ''}`}
                    title={node.conceptId ? `${node.text} — Bấm để xem chi tiết tri thức` : node.text}
                  >
                    <span className="mindmap-label">{node.label}</span>
                  </button>
                  {node.hasChildren && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        toggleExpand(node.id);
                      }}
                      aria-label={node.isCollapsed ? `Mở nhánh ${node.text}` : `Thu gọn nhánh ${node.text}`}
                      style={{ borderColor: node.theme.solid, color: node.theme.solid }}
                      className={`absolute ${toggleBadgePos} top-1/2 -translate-y-1/2 min-w-[20px] h-5 px-1 rounded-full bg-white border-2 text-[10px] font-bold flex items-center justify-center shadow-sm leading-none hover:scale-110 transition`}
                    >
                      {node.isCollapsed ? `+${node.hiddenCount}` : '−'}
                    </button>
                  )}
                </div>
              );
            }

            if (node.kind === 'l2') {
              return (
                <div
                  key={node.id}
                  style={{ position: 'absolute', left: node.x, top: node.y, width: node.width, height: node.height }}
                  className="z-10"
                >
                  <button
                    type="button"
                    onClick={() => handleNodeClick(node)}
                    style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: node.theme.tint,
                      borderColor: node.theme.tintBorder,
                      color: node.theme.tintText,
                    }}
                    className={`mindmap-node rounded-md border px-2.5 flex items-center justify-center text-center font-semibold text-[11.5px] shadow-2xs hover:shadow-sm cursor-pointer ${
                      isSelected ? 'ring-2 ring-blue-500' : ''
                    } ${node.dimmed ? 'opacity-25' : ''}`}
                    title={page === 'all' ? `${node.text} — Bấm để mở ngày học này` : `${node.text} — Bấm để xem chi tiết tri thức`}
                  >
                    <span className="mindmap-label">{node.label}</span>
                  </button>
                  {node.hasChildren && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        toggleExpand(node.id);
                      }}
                      aria-label={node.isCollapsed ? `Mở mục ${node.text}` : `Thu gọn mục ${node.text}`}
                      style={{ borderColor: node.theme.tintBorder, color: node.theme.tintText }}
                      className={`absolute ${toggleBadgePos} top-1/2 -translate-y-1/2 min-w-[18px] h-[18px] px-1 rounded-full bg-white border text-[9.5px] font-bold flex items-center justify-center shadow-2xs leading-none hover:scale-110 transition`}
                    >
                      {node.isCollapsed ? `+${node.hiddenCount}` : '−'}
                    </button>
                  )}
                </div>
              );
            }

            return (
              <button
                key={node.id}
                type="button"
                onClick={() => handleNodeClick(node)}
                style={{ position: 'absolute', left: node.x, top: node.y, width: node.width, height: node.height }}
                className={`mindmap-node rounded-md bg-white px-2.5 flex items-center justify-center text-center text-[11px] font-medium text-slate-700 border shadow-2xs hover:border-blue-400 hover:bg-blue-50/40 z-10 cursor-pointer ${
                  isSelected ? 'border-blue-600 ring-1 ring-blue-300' : 'border-slate-300/85'
                } ${node.dimmed ? 'opacity-25' : ''}`}
                title={`${node.text} — Bấm để xem thông tin tri thức`}
              >
                <span className="mindmap-label">{node.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating Bottom Controls + 1-to-14 Lesson Pagination */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 max-w-[calc(100vw-2rem)]">
        <div
          className="bg-white/95 backdrop-blur-sm border border-slate-200 shadow-lg rounded-xl px-2 py-1 flex items-center gap-1 overflow-x-auto max-w-full"
          aria-label="Phân trang bài học"
        >
          <button
            type="button"
            disabled={page === 'all' || page <= 1}
            onClick={() => goToPage(Math.max(1, (page === 'all' ? activeDay : page) - 1))}
            className="w-6 h-6 rounded-md text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-35"
            title="Bài trước"
          >
            ‹
          </button>
          {Array.from({ length: 14 }, (_, idx) => idx + 1).map(num => (
            <button
              key={num}
              type="button"
              onClick={() => goToPage(num)}
              title={`Ngày ${num}`}
              className={`w-6 h-6 rounded-md text-[11px] font-mono font-semibold transition shrink-0 ${
                page === num
                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300/80'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            disabled={page === 'all' || page >= 14}
            onClick={() => goToPage(Math.min(14, (page === 'all' ? activeDay : page) + 1))}
            className="w-6 h-6 rounded-md text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-35"
            title="Bài tiếp theo"
          >
            ›
          </button>
          <div className="h-3.5 w-px bg-slate-200 mx-0.5 shrink-0" />
          <button
            type="button"
            onClick={() => goToPage(page === 'all' ? activeDay : 'all')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition ${
              page === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Tất cả
          </button>
        </div>

        <div className="bg-white/95 backdrop-blur-sm border border-slate-200 shadow-xl rounded-xl px-3 py-1.5 flex items-center space-x-2 overflow-x-auto max-w-full">
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
            onClick={() => centerView(byId.get('root'))}
            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition"
            title="Căn giữa sơ đồ"
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
          <button
            type="button"
            onClick={expandedIds.size > 0 ? collapseAllBranches : expandAllBranches}
            className="px-2 py-1 text-xs text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded transition font-medium whitespace-nowrap"
            title={expandedIds.size > 0 ? 'Thu gọn tất cả các nhánh con' : 'Mở rộng tất cả các mục'}
          >
            {expandedIds.size > 0 ? 'Thu gọn hết' : 'Mở hết'}
          </button>
        </div>
      </div>

      {/* Live Minimap (hidden when right NodeInspector drawer is open) */}
      {!selectedNodeId && (
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
                className={`absolute rounded ${n.kind === 'root' ? 'bg-slate-900 w-3 h-2.5' : `${n.theme?.mini || 'bg-slate-400'} w-3 h-1`}`}
                style={{
                  left: `${Math.max(0, Math.min(92, (n.x / tree.canvasW) * 100))}%`,
                  top: `${Math.max(0, Math.min(90, (n.y / tree.canvasH) * 100))}%`,
                }}
              />
            ))}
            <div
              className="absolute border border-blue-600 bg-blue-500/10 rounded pointer-events-none"
              style={minimapStyle}
            />
          </div>
        </div>
      )}
    </section>
  );
}
