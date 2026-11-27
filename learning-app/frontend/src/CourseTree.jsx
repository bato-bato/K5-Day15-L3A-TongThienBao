import React, { useEffect, useMemo, useRef, useState } from 'react';

const MIN_ZOOM = 0.45;
const MAX_ZOOM = 1.45;
const clampZoom = value => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(value.toFixed(2))));

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

export function truncateText(str, maxLen) {
  const s = (str || '').trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1).trim()}…`;
}

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

function getDayShortTitle(workspace, day) {
  const root = workspace?.mindmaps?.[day]?.nodes?.find(n => n.node_type === 'day_root');
  if (!root?.text) return `Ngày ${day}`;
  const firstLine = root.text.split('\n')[0].replace(/^Ngày\s+\d+:\s*/i, '').trim();
  return firstLine || `Ngày ${day}`;
}

export function getNodeTitle(node) {
  const line = (node?.text || '').split('\n')[0] || '';
  return line.replace(/^\[[^\]]+\]\s*/, '').trim() || 'Ý tưởng mới';
}

  function shortenL2Label(rawLabel) {
    if (!rawLabel) return 'Khái niệm';
    const cleaned = rawLabel
      .replace(/^\(\d+\)\s*/, '')
      .replace(/\([^)]*\)/g, '')
      .trim();
    if (!cleaned) return 'Khái niệm';
    const words = cleaned.split(/\s+/);
    if (words.length <= 4) return truncateText(cleaned, 22);
    return truncateText(words.slice(0, 4).join(' '), 22);
  }

  function inferTopicLabel(chunk, parentTitle) {
    const clean = (chunk || '')
      .replace(/^\(\d+\)\s*/, '')
      .trim();
    const cleanNoParens = clean.replace(/\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').trim();

    // Rule A: Cost / comparison verbs ("Output đắt gấp 3–5 lần Input", "Tiếng Việt..., code, JSON tốn nhiều token...")
    const costMatch = cleanNoParens.match(/^(.{2,30}?)\s+(đắt gấp|rẻ hơn)\b/i);
    if (costMatch) {
      return shortenL2Label(`Giá ${costMatch[1].trim()}`);
    }
    const spendMatch = cleanNoParens.match(/^(.+?)\s+tốn\b/i);
    if (spendMatch) {
      const subj = spendMatch[1].trim();
      if (subj.includes(',')) {
        const firstItem = subj.split(',')[0].trim();
        return firstItem && firstItem.length <= 24 ? shortenL2Label(firstItem) : 'Độ tốn token';
      }
      return subj.length <= 24 ? shortenL2Label(subj) : 'Độ tốn token';
    }

    // Rule B: Leading term followed by parenthetical ("Decoder-only (GPT, Claude, Gemini)...")
    const parenLead = clean.match(/^([^(]{2,34})\s*\(([^)]{2,60})\)/);
    if (parenLead) {
      return shortenL2Label(parenLead[1].trim());
    }

    // Rule C: Subject before common Vietnamese action/state verbs
    const GENERIC_FILLERS = new Set(['luôn', 'chỉ', 'không', 'bắt buộc', 'bắt đầu', 'việc', 'khi', 'để', 'hãy', 'nên']);
    const subjMatch = cleanNoParens.match(
      /^(.{2,34}?)\s+(?:ngăn|giúp|cho phép|ghi nhận|đòi hỏi|bao gồm|gồm có|gồm|tạo ra|dẫn đến|gây ra|thắng thế|hữu hạn|là|dùng|sử dụng|cần|phải|nên|tránh)\b/i,
    );
    if (subjMatch) {
      const subj = subjMatch[1].trim();
      if (!GENERIC_FILLERS.has(subj.toLowerCase())) {
        return shortenL2Label(subj);
      }
    }

    // Rule D: Strip leading imperative/filler phrases and take first 3-4 meaningful words
    const stripped = cleanNoParens
      .replace(
        /^(?:Bắt đầu từ|Luôn ưu tiên|Bắt buộc xác định|Bắt buộc|Ưu tiên|Viết script|Xây dựng|Sử dụng|Dùng|Không|Tránh|Cần|Phải|Nên)\s+/i,
        '',
      )
      .trim();
    if (stripped) {
      const words = stripped.split(/\s+/);
      return truncateText(words.slice(0, Math.min(4, words.length)).join(' '), 22);
    }

    // Rule E: Fallback to parent title segment
    const parentSegment = (parentTitle || '').split(/[&—–:]/)[0].trim();
    return shortenL2Label(parentSegment || 'Khái niệm');
  }

  export function extractSubBranches(node) {
    const raw = (node?.text || '').trim();
    const lines = raw.split('\n').map(l => l.trim()).filter(l => l && l !== '—');
    const body = lines.slice(1).join(' ').trim();
    const parentTitle = getNodeTitle(node);

    if (!body) {
      return [{
        label: node?.source_ref?.pdf_pages?.length ? `Tr.${node.source_ref.pdf_pages.join(',')}` : 'Ghi chú',
        leaves: [truncateText(getNodeTitle(node), 36)],
        leaves: [truncateText(parentTitle, 36)],
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

      // Hierarchy "A > B > C"
      if (chunk.includes(' > ')) {
        const hItems = chunk.split(/\s+>\s+/).map(t => truncateText(t.trim(), 36)).filter(Boolean);
        if (hItems.length >= 3) {
          const parentSegment = (parentTitle || '').split(/[&—–:]/)[0].trim();
          groups.push({
            label: shortenL2Label(parentSegment || hItems[0]),
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
          const terms = rhs.split(/\s+\+\s+/).map(t => truncateText(t.replace(/\([^)]*\)/g, '').trim(), 36)).filter(Boolean);
          if (terms.length >= 2) {
            groups.push({ label: truncateText(lhs, 20), leaves: terms.slice(0, 4) });
            const eqLabel = lhs.length <= 2
              ? truncateText(`${lhs} = ${terms.slice(0, 2).join(' + ')}`, 22)
              : truncateText(lhs, 20);
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
          label: shortenL2Label(label, groups.length + 1),
          label: shortenL2Label(label),
          leaves: commaItems.slice(0, 4).map(it => truncateText(it, 36)),
        });
        continue;
      }

      const arrowSteps = splitTopLevelBy(rest, '→');
      if (arrowSteps.length >= 2) {
        groups.push({
          label: shortenL2Label(label || 'Quy trình', groups.length + 1),
          label: shortenL2Label(label || 'Quy trình'),
          leaves: arrowSteps.slice(0, 4).map(st => truncateText(st, 36)),
        });
        continue;
      }

      const verbMatch = chunk.match(/^(.{6,45}?\b(?:đòi hỏi|bao gồm|gồm|qua \d+ [^:]+))\s+([^:]+)$/i);
      if (verbMatch) {
        const vItems = splitTopLevelBy(verbMatch[2], ',');
        if (vItems.length >= 2) {
          groups.push({
            label: shortenL2Label(verbMatch[1], groups.length + 1),
            label: shortenL2Label(verbMatch[1]),
            leaves: vItems.slice(0, 4).map(it => truncateText(it, 36)),
          });
          continue;
        }
      }

      // Compact fallback leaf
      // Comma list without colon
      if (!hasLabel && commaItems.length >= 2) {
        const hasEndVerb = /\b(?:tốn nhiều|đắt gấp|rẻ hơn|là|giúp|gồm)\b/i.test(chunk);
        const inferredLabel = hasEndVerb
          ? inferTopicLabel(chunk, parentTitle)
          : shortenL2Label((parentTitle || '').split(/[&—–:]/)[0].trim() || inferTopicLabel(chunk, parentTitle));
        groups.push({
          label: inferredLabel,
          leaves: commaItems.slice(0, 4).map(it => truncateText(it, 36)),
        });
        continue;
      }

      // Compact fallback leaf with inferred topic label (never "Ý 1", "Ý 2")
      const fallbackItems = commaItems.length >= 2
        ? commaItems.slice(0, 4).map(it => truncateText(it, 36))
        : [truncateText(rest, 38)];
      groups.push({
        label: shortenL2Label(label || `Ý ${groups.length + 1}`, groups.length + 1),
        label: label ? shortenL2Label(label) : inferTopicLabel(rest, parentTitle),
        leaves: fallbackItems,
      });
    }

    // Ensure distinct labels across groups
    const seenLabels = new Set();
    const deduped = groups.map(g => {
      let lbl = g.label || 'Khái niệm';
      if (seenLabels.has(lbl.toLowerCase()) && g.leaves?.[0]) {
        const alt = g.leaves[0].replace(/\([^)]*\)/g, '').trim().split(/\s+/).slice(0, 3).join(' ');
        if (alt) lbl = truncateText(alt, 22);
      }
      seenLabels.add(lbl.toLowerCase());
      return { ...g, label: lbl };
    });

    // Add provenance / code reference leaf if only 1 group exists
    if (groups.length === 1 && node?.source_ref?.pdf_pages?.length) {
      groups.push({
        if(deduped.length === 1 && node?.source_ref?.pdf_pages?.length) {
        deduped.push({
          label: 'Nguồn PDF',
          leaves: [`Ngày ${node.source_ref.day} · Tr.${node.source_ref.pdf_pages.join(', ')}`],
        });
      } else if (groups.length === 1 && node?.code_link?.file_path) {
        groups.push({
        } else if (deduped.length === 1 && node?.code_link?.file_path) {
          deduped.push({
            label: 'Code Lab',
            leaves: [truncateText(node.code_link.file_path.split('/').slice(-2).join('/'), 36)],
          });
        }

        return groups.slice(0, 3);
        return deduped.slice(0, 3);
      }

      function layoutSideBranches(branches, side, themes, startX, expandedIds, forceExpandAll) {
        const LEAF_W = 214;
        const LEAF_H = 26;
        const LEAF_GAP = 4;
        const L2_W = 136;
        const L2_H = 30;
        const L2_GAP = 14;
        const L1_W = 166;
        const L1_H = 36;
        const L1_GAP = 26;

        // X positions for each column on left vs right side
        const l1X = side === 'left' ? startX - 180 - L1_W : startX + 180;
        const l2X = side === 'left' ? l1X - 58 - L2_W : l1X + L1_W + 58;
        const l3X = side === 'left' ? l2X - 52 - LEAF_W : l2X + L2_W + 52;

        const placedNodes = [];
        const placedEdges = [];
        let cursorY = 0;

        branches.forEach((branch, bIdx) => {
          const theme = themes[bIdx % themes.length];
          const l1Id = `l1:${branch.id}`;
          const hasL1Children = branch.subGroups.length > 0;
          const isL1Expanded = hasL1Children && (forceExpandAll || expandedIds.has(l1Id));

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
              conceptId: branch.conceptId,
            });
            cursorY += L1_H + L1_GAP;
            return;
          }

          const l2Centers = [];
          const l1StartY = cursorY;

          branch.subGroups.forEach((sg, sgIdx) => {
            const l2Id = `l2:${branch.id}:${sgIdx}`;
            const hasL2Children = sg.leaves.length > 0;
            const isL2Expanded = hasL2Children && (forceExpandAll || expandedIds.has(l2Id));

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
                conceptId: branch.conceptId,
              });
              l2Centers.push(l2Y + L2_H / 2);
              cursorY += L2_H + L2_GAP;
              return;
            }

            const leafCount = Math.max(1, sg.leaves.length);
            const leavesBlockH = leafCount * LEAF_H + (leafCount - 1) * LEAF_GAP;
            const l2StartY = cursorY;

            sg.leaves.forEach((leafText, lIdx) => {
              const l3Id = `l3:${branch.id}:${sgIdx}:${lIdx}`;
              const ly = l2StartY + lIdx * (LEAF_H + LEAF_GAP);
              placedNodes.push({
                id: l3Id,
                kind: 'l3',
                side,
                conceptId: branch.conceptId,
                day: sg.dayOverride ?? branch.day,
                text: leafText,
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
                conceptId: branch.conceptId,
              });
            });

            const l2Y = Math.round(l2StartY + (leavesBlockH - L2_H) / 2);
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
              conceptId: branch.conceptId,
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
            conceptId: branch.conceptId,
            day: branch.day,
            text: branch.label,
            verified: branch.verified,
            theme,
            hasChildren: hasL1Children,
            isCollapsed: false,
            hiddenCount: branch.subGroups.length,
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
            conceptId: branch.conceptId,
          });

          cursorY += L1_GAP - L2_GAP;
        });

        const totalHeight = branches.length ? Math.max(120, cursorY - L1_GAP) : 0;
        return { nodes: placedNodes, edges: placedEdges, height: totalHeight };
      }

      function computeSymmetricLayout({ workspace, edits, contentTab, page, searchQuery, expandedIds }) {
        const CENTER_X = 940;
        const ROOT_W = 196;
        const ROOT_H = 114;
        const ROOT_X = CENTER_X - ROOT_W / 2;
        const qLower = searchQuery.trim().toLowerCase();
        const forceExpandAll = Boolean(qLower);

        let rawBranches = [];
        let rootTitle = '';
        let rootLines = [];
        let rootConceptId = null;

        if (page === 'all') {
          rootTitle = 'AI20K · 14 Ngày';
          rootLines = ['4 Cấp độ học', 'Knowledge Graph', 'Lab Mapping'];
          rawBranches = COURSE_LEVELS.map(lvl => ({
            id: lvl.id,
            conceptId: null,
            day: lvl.days[0],
            label: lvl.title.replace(/^Cấp độ \d+:\s*/i, ''),
            verified: true,
            subGroups: lvl.days.map(d => {
              const dNodes = (edits[`${contentTab}/${d}`] ?? workspace?.[contentTab]?.[d])?.nodes || [];
              const concepts = dNodes.filter(n => n.node_type !== 'day_root');
              return {
                label: `D${String(d).padStart(2, '0')} · ${truncateText(getDayShortTitle(workspace, d), 14)}`,
                leaves: concepts.slice(0, 4).map(c => truncateText(getNodeTitle(c), 34)),
                dayOverride: d,
              };
            }),
          }));
        } else {
          const dayNodes = (edits[`${contentTab}/${page}`] ?? workspace?.[contentTab]?.[page])?.nodes || [];
          const rootNode = dayNodes.find(n => n.node_type === 'day_root') || null;
          rootConceptId = rootNode?.id || null;
          rootTitle = `AI20K · Ngày ${page}`;
          const dayShort = getDayShortTitle(workspace, page);
          rootLines = [truncateText(dayShort, 24), contentTab === 'lab' ? 'Lab Mapping' : 'Knowledge Graph'];

          const children = dayNodes.filter(n => n.node_type !== 'day_root');
          if (children.length === 0) {
            rawBranches = [{
              id: 'empty',
              conceptId: rootConceptId,
              day: page,
              label: 'Chưa có nút con',
              verified: false,
              subGroups: [{
                label: 'Gợi ý',
                leaves: ['Chọn ngày khác ở thanh phân trang phía dưới', 'Hoặc dùng AI GraphRAG nạp bài'],
              }],
            }];
          } else {
            rawBranches = children.map(node => ({
              id: node.id,
              conceptId: node.id,
              day: page,
              label: truncateText(getNodeTitle(node), 26),
              verified: node.verification_status === 'verified',
              matchesSearch: !qLower || (node.text || '').toLowerCase().includes(qLower),
              subGroups: extractSubBranches(node),
            }));
          }
        }

        const half = Math.ceil(rawBranches.length / 2);
        const leftBranches = rawBranches.slice(0, half);
        const rightBranches = rawBranches.slice(half);

        const leftLayout = layoutSideBranches(leftBranches, 'left', LEFT_THEMES, CENTER_X, expandedIds, forceExpandAll);
        const rightLayout = layoutSideBranches(rightBranches, 'right', RIGHT_THEMES, CENTER_X, expandedIds, forceExpandAll);

        const maxH = Math.max(leftLayout.height, rightLayout.height, ROOT_H + 80);
        const topPad = 64;
        const leftOffsetY = topPad + Math.round((maxH - leftLayout.height) / 2);
        const rightOffsetY = topPad + Math.round((maxH - rightLayout.height) / 2);
        const rootY = topPad + Math.round((maxH - ROOT_H) / 2);

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
            lines: rootLines,
            hasChildren: false,
            isCollapsed: false,
            hiddenCount: rawBranches.length,
            x: ROOT_X,
            y: rootY,
            width: ROOT_W,
            height: ROOT_H,
          },
          ...leftLayout.nodes.map(n => ({
            ...n,
            y: n.y + leftOffsetY,
            dimmed: qLower ? !rawBranches.find(b => b.id === n.conceptId)?.matchesSearch : false,
          })),
          ...rightLayout.nodes.map(n => ({
            ...n,
            y: n.y + rightOffsetY,
            dimmed: qLower ? !rawBranches.find(b => b.id === n.conceptId)?.matchesSearch : false,
          })),
        ];

        const allEdges = [...leftLayout.edges, ...rightLayout.edges];
        const canvasW = 1880;
        const canvasH = Math.max(760, maxH + topPad * 2 + 90);
        return { nodes: allNodes, edges: allEdges, canvasW, canvasH, allExpandableIds };
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
        onSelectDay,
        onOpenDayCanvas,
        onOpenMapper,
        onSwitchView,
        onSwitchContentTab,
      }) {
        const viewport = useRef(null);
        const pan = useRef(null);
        const clickTimer = useRef(null);
        const [zoom, setZoom] = useState(0.88);
        const [page, setPage] = useState('all');
        const [expandedIds, setExpandedIds] = useState(() => new Set());
        const [vpRect, setVpRect] = useState({ left: 0, top: 0, width: 1200, height: 700 });

        useEffect(() => () => {
          if (clickTimer.current) clearTimeout(clickTimer.current);
        }, []);

        const tree = useMemo(
          () => computeSymmetricLayout({ workspace, edits, contentTab, page, searchQuery, expandedIds }),
          [workspace, edits, contentTab, page, searchQuery, expandedIds],
        );
        const byId = useMemo(() => new Map(tree.nodes.map(n => [n.id, n])), [tree.nodes]);

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
          if (node.hasChildren) {
            if (clickTimer.current) clearTimeout(clickTimer.current);
            clickTimer.current = setTimeout(() => {
              clickTimer.current = null;
              toggleExpand(node.id);
            }, 180);
          }
          if (node.conceptId) {
            onSelectConcept?.(node.day, node.conceptId);
          }
        }

        function handleNodeDoubleClick(node) {
          if (clickTimer.current) {
            clearTimeout(clickTimer.current);
            clickTimer.current = null;
          }
          if (node.conceptId) {
            onSelectConcept?.(node.day, node.conceptId);
          } else if (page === 'all' && node.day) {
            goToPage(node.day);
          }
        }

        function collapseAllBranches() {
          setExpandedIds(new Set());
        }

        function expandAllBranches() {
          setExpandedIds(new Set(tree.allExpandableIds));
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
          const pad = 64;
          const contentW = Math.max(600, maxX - minX + pad * 2);
          const contentH = Math.max(380, maxY - minY + pad * 2);
          const fitZ = clampZoom(Math.min(1.05, (vp.clientWidth - 40) / contentW, (vp.clientHeight - 110) / contentH));
          setZoom(fitZ);

          const cx = (minX + maxX) / 2;
          const cy = (minY + maxY) / 2;
          requestAnimationFrame(() => {
            vp.scrollTo({
              left: Math.max(0, cx * fitZ - vp.clientWidth / 2),
              top: Math.max(0, cy * fitZ - (vp.clientHeight - 70) / 2),
              behavior: 'smooth',
            });
            syncViewportRect();
          });
        }

        function centerView() {
          const vp = viewport.current;
          if (!vp || !tree.nodes.length) return;
          const root = byId.get('root');
          if (!root) return;
          const cx = root.x + root.width / 2;
          const cy = root.y + root.height / 2;
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
          if (page !== 'all' && activeDay && page !== activeDay) {
            setPage(activeDay);
          }
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [activeDay]);

        useEffect(() => {
          setExpandedIds(new Set());
        }, [page, contentTab]);

        useEffect(() => {
          fitToView();
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [page, contentTab, expandedIds]);

        useEffect(() => {
          syncViewportRect();
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [zoom, tree.nodes.length]);

        function goToPage(nextPage) {
          setPage(nextPage);
          if (nextPage !== 'all') {
            onSelectDay?.(nextPage);
          }
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

        return (
          <section className="flex-1 relative overflow-hidden flex" aria-label="Sơ đồ cây đối xứng">
            {/* Left Compact Controls */}
            <aside className="absolute left-4 top-4 z-20 flex flex-col bg-white border border-slate-200/90 rounded-xl shadow-lg shadow-slate-900/5 p-1.5 space-y-1">
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

              <button
                type="button"
                onClick={expandedIds.size > 0 ? collapseAllBranches : expandAllBranches}
                className="p-2 text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition group relative"
                title={expandedIds.size > 0 ? 'Thu gọn tất cả nhánh' : 'Mở tất cả nhánh'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {expandedIds.size > 0 ? (
                    <path d="M4 8h16M8 16h8" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  ) : (
                    <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  )}
                </svg>
                <span className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-[11px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none shadow z-30">
                  {expandedIds.size > 0 ? 'Thu gọn tất cả' : 'Mở tất cả nhánh'}
                </span>
              </button>

              <div className="w-full h-px bg-slate-200" />
              <div className="px-1 py-0.5 text-[9px] font-semibold text-slate-400 uppercase tracking-wider text-center">
                Chế độ
              </div>
              <button
                type="button"
                onClick={() => onSwitchContentTab?.('mindmaps')}
                className={`px-1.5 py-1 rounded text-[10px] font-bold transition ${contentTab === 'mindmaps' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
              >
                KG
              </button>
              <button
                type="button"
                onClick={() => onSwitchContentTab?.('lab')}
                className={`px-1.5 py-1 rounded text-[10px] font-bold transition ${contentTab === 'lab' ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-100'
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
              aria-label="Canvas sơ đồ đối xứng"
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
                  {/* Color-matched Smooth Bezier Branches */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" xmlns="http://www.w3.org/2000/svg">
                    {tree.edges.map(edge => {
                      const d = buildSymmetricEdge(edge);
                      if (!d) return null;
                      const isSelected = edge.conceptId && edge.conceptId === selectedNodeId;
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

                  {/* Symmetric Nodes */}
                  {tree.nodes.map(node => {
                    if (node.kind === 'root') {
                      return (
                        <button
                          key={node.id}
                          type="button"
                          onClick={() => handleNodeDoubleClick(node)}
                          title={page === 'all' ? 'Khóa học AI20K · 14 Ngày' : 'Bấm để xem chi tiết ngày học'}
                          style={{ position: 'absolute', left: node.x, top: node.y, width: node.width, height: node.height }}
                          className="mindmap-node rounded-2xl bg-[#111E38] text-white shadow-xl hover:shadow-2xl px-4 py-3 flex flex-col items-center justify-center text-center z-10 border border-slate-700 cursor-pointer"
                        >
                          <div className="text-[13.5px] font-bold tracking-tight text-white mb-1.5">
                            {node.title}
                          </div>
                          {node.lines.map((line, i) => (
                            <div key={i} className="text-[11px] text-slate-300 leading-snug truncate max-w-full">
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
                    const toggleBadgePos = node.side === 'left' ? '-left-3' : '-right-3';

                    if (node.kind === 'l1') {
                      return (
                        <button
                          key={node.id}
                          type="button"
                          onClick={() => handleNodeClick(node)}
                          onDoubleClick={() => handleNodeDoubleClick(node)}
                          style={{
                            position: 'absolute',
                            left: node.x,
                            top: node.y,
                            width: node.width,
                            height: node.height,
                            backgroundColor: node.theme.solid,
                          }}
                          className={`mindmap-node rounded-lg px-3 flex items-center justify-center text-center text-white font-bold text-[12px] shadow-md hover:brightness-105 z-10 cursor-pointer ${isSelected ? 'ring-2 ring-offset-2 ring-slate-900' : ''
                            } ${node.dimmed ? 'opacity-25' : ''}`}
                          title={`${node.text} — Bấm 1 lần để ${node.isCollapsed ? 'mở thư mục' : 'thu gọn'} · Bấm đúp để xem chi tiết`}
                        >
                          <span className="truncate">{node.text}</span>
                          {node.hasChildren && (
                            <span
                              style={{ borderColor: node.theme.solid, color: node.theme.solid }}
                              className={`absolute ${toggleBadgePos} top-1/2 -translate-y-1/2 min-w-[20px] h-5 px-1 rounded-full bg-white border-2 text-[10px] font-bold flex items-center justify-center shadow-sm leading-none`}
                            >
                              {node.isCollapsed ? `+${node.hiddenCount}` : '−'}
                            </span>
                          )}
                        </button>
                      );
                    }

                    if (node.kind === 'l2') {
                      return (
                        <button
                          key={node.id}
                          type="button"
                          onClick={() => handleNodeClick(node)}
                          onDoubleClick={() => handleNodeDoubleClick(node)}
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
                          className={`mindmap-node rounded-md border px-2.5 flex items-center justify-center text-center font-semibold text-[11.5px] shadow-2xs hover:shadow-sm z-10 cursor-pointer ${isSelected ? 'ring-2 ring-blue-500' : ''
                            } ${node.dimmed ? 'opacity-25' : ''}`}
                          title={`${node.text} — Bấm 1 lần để ${node.isCollapsed ? 'mở' : 'thu gọn'}${page === 'all' ? ' · Bấm đúp để mở ngày này' : ' · Bấm đúp để xem chi tiết'}`}
                        >
                          <span className="truncate">{node.text}</span>
                          {node.hasChildren && (
                            <span
                              style={{ borderColor: node.theme.tintBorder, color: node.theme.tintText }}
                              className={`absolute ${toggleBadgePos} top-1/2 -translate-y-1/2 min-w-[18px] h-[18px] px-1 rounded-full bg-white border text-[9.5px] font-bold flex items-center justify-center shadow-2xs leading-none`}
                            >
                              {node.isCollapsed ? `+${node.hiddenCount}` : '−'}
                            </span>
                          )}
                        </button>
                      );
                    }

                    // Level 3 compact white leaf bar
                    return (
                      <button
                        key={node.id}
                        type="button"
                        onDoubleClick={() => handleNodeDoubleClick(node)}
                        style={{ position: 'absolute', left: node.x, top: node.y, width: node.width, height: node.height }}
                        className={`mindmap-node rounded-md bg-white px-2.5 flex items-center justify-center text-center text-[11px] font-medium text-slate-700 border shadow-2xs hover:border-slate-400 z-10 cursor-pointer ${isSelected ? 'border-blue-600 ring-1 ring-blue-300' : 'border-slate-300/85'
                          } ${node.dimmed ? 'opacity-25' : ''}`}
                        title={`${node.text} — Bấm đúp để xem chi tiết`}
                      >
                        <span className="truncate">{node.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Floating Bottom Controls + 1-to-14 Lesson Pagination */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 max-w-[calc(100vw-2rem)]">
              <div
                className="bg-white/95 backdrop-blur-sm border border-slate-200 shadow-lg rounded-xl px-2.5 py-1 flex items-center gap-1 overflow-x-auto max-w-full"
                aria-label="Phân trang bài học"
              >
                <span className="text-[11px] font-semibold text-slate-500 px-1.5 whitespace-nowrap">
                  {page === 'all' ? 'Tất cả 14 bài' : `Trang ${page}/14`}
                </span>
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
                    title={`Trang ${num}: Ngày ${num}`}
                    className={`w-6 h-6 rounded-md text-[11px] font-mono font-semibold transition shrink-0 ${page === num
                      ? 'bg-blue-600 text-white shadow-sm'
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
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition ${page === 'all'
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

                <div className="h-4 w-px bg-slate-200 shrink-0" />

                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg shrink-0">
                  <button
                    type="button"
                    onClick={() => onSwitchView?.('tree')}
                    className="px-2.5 py-1 text-[11px] rounded-md font-semibold bg-white text-blue-700 shadow-sm"
                  >
                    Mindmap
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
                    className={`absolute rounded ${n.kind === 'root' ? 'bg-slate-900 w-3 h-2.5' : `${n.theme?.mini || 'bg-slate-400'} w-3 h-1`}`}
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
