import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatBot } from './ChatBot.jsx';
import { CourseTree, getNodeTitle } from './CourseTree.jsx';
import { LabGuide } from './LabGuide.jsx';
import { buildEnrichedMindmaps, resolveCheckpointMindmapNodes } from './LectureReferences.jsx';
import { labs } from '../../../data/lab-mapping/labs.json';
import { checkpoint_views } from '../../../data/lab-mapping/knowledge-graph.json';
import './style.css';

const DAYS = Array.from({ length: 14 }, (_, index) => index + 1);
const QUICK_QUERIES = ['CP1', 'CP2', 'CP3', 'CP4', 'Lethal Trifecta', 'Cost-of-Pass', 'Rogan-Gladen', 'FTS5'];

async function request(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) throw new Error('Yêu cầu thất bại');
  return response.json();
}

function getDayShortTitle(mindmapsByDay, day) {
  const lab = labs.find(item => item.day === day);
  if (lab?.title) return lab.title;
  const root = mindmapsByDay?.[day]?.nodes?.find(n => n.node_type === 'day_root');
  if (!root?.text) return `Ngày ${day}`;
  const firstLine = root.text.split('\n')[0].replace(/^Ngày\s+\d+:\s*/i, '').trim();
  return firstLine || `Ngày ${day}`;
}

function normalizeForSearch(text) {
  return String(text || '')
    .normalize('NFC')
    .toLowerCase();
}

function stripVietnameseDiacritics(text) {
  return normalizeForSearch(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function matchesAllTokens(haystack, query) {
  const tokens = normalizeForSearch(query)
    .split(/\s+/)
    .map(t => t.trim())
    .filter(Boolean);
  if (!tokens.length) return false;
  const normHaystack = normalizeForSearch(haystack);
  const plainHaystack = stripVietnameseDiacritics(haystack);
  return tokens.every(tok => {
    const plainTok = stripVietnameseDiacritics(tok);
    return normHaystack.includes(tok) || plainHaystack.includes(plainTok);
  });
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

function splitTopLevelCommas(str) {
  return splitTopLevelBy(str, ',');
}

function splitTopLevelArrows(str) {
  return splitTopLevelBy(str, '→');
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
      const inner = part.slice(1, -1).trim();
      return (
        <span key={idx} className="text-slate-700 font-medium bg-slate-100 border border-slate-200/80 px-1.5 py-0.5 rounded-md mx-0.5 text-[11px]">
          {inner}
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

    const colonIdx = clean.indexOf(': ');
    const hasLabel = colonIdx > 0 && colonIdx <= 120;
    const label = hasLabel ? clean.slice(0, colonIdx).trim() : '';
    const rest = hasLabel ? clean.slice(colonIdx + 2).trim() : clean;

    if (hasLabel) {
      const items = splitTopLevelCommas(rest);
      if (items.length >= 2 && items.every(i => i.length <= 80)) {
        return { kind: 'list', label, items };
      }
    }

    const flowSteps = splitTopLevelArrows(rest);
    if (flowSteps.length >= 2) {
      return { kind: 'flow', label, steps: flowSteps };
    }

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

const RELATION_LABELS = {
  APPLIED_IN: { label: 'Áp dụng tại', cls: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  IS_PART_OF: { label: 'Thuộc phần', cls: 'bg-sky-100 text-sky-800 border-sky-200' },
  IMPLEMENTED_BY: { label: 'Cài đặt bởi', cls: 'bg-teal-100 text-teal-800 border-teal-200' },
  WARNS_ABOUT: { label: 'Cảnh báo bẫy', cls: 'bg-rose-100 text-rose-800 border-rose-200' },
  TRAP_IN: { label: 'Cảnh báo bẫy', cls: 'bg-rose-100 text-rose-800 border-rose-200' },
  DEPENDS_ON: { label: 'Nền tảng của', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  PREREQ_OF: { label: 'Nền tảng của', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
};

function getRelationBadge(rel) {
  const key = String(rel || '').toUpperCase();
  if (RELATION_LABELS[key]) return RELATION_LABELS[key];
  return {
    label: String(rel || '').replace(/_/g, ' '),
    cls: 'bg-purple-100 text-purple-800 border-purple-200',
  };
}

function parseExplanationSummary(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const hasStructured = /Kiến thức trọng tâm:|Mã nguồn đối chiếu:|GraphRAG mở rộng/i.test(raw);
  if (!hasStructured) return { raw };

  const headlineMatch = raw.match(/^(.*?)(?=\s*(?:Kiến thức trọng tâm:|Mã nguồn đối chiếu:|GraphRAG mở rộng))/i);
  const headline = headlineMatch ? headlineMatch[1].replace(/\.$/, '').trim() : '';

  const conceptsMatch = raw.match(/Kiến thức trọng tâm:\s*(.+?)(?=\.\s*(?:Mã nguồn đối chiếu:|GraphRAG mở rộng)|$)/i);
  const concepts = conceptsMatch ? splitTopLevelCommas(conceptsMatch[1]) : [];

  const codeMatch = raw.match(/Mã nguồn đối chiếu:\s*(.+?)(?=\.\s*GraphRAG mở rộng|$)/i);
  const codeFiles = codeMatch ? splitTopLevelCommas(codeMatch[1]) : [];

  const statsMatch = raw.match(/(GraphRAG mở rộng[^.]+)\.?/i);
  const stats = statsMatch ? statsMatch[1].trim() : '';

  return { headline, concepts, codeFiles, stats };
}

function NodeInspector({ selectedNode, day, className = '', titleId, onClose, onRelatedConcept, onOpenCheckpoint }) {
  const conceptId = selectedNode.source_ref?.concept_id;
  const [nodeGraph, setNodeGraph] = useState(null);

  useEffect(() => {
    if (!conceptId || conceptId.startsWith('DAY_')) return;
    let cancelled = false;
    request(`/api/graph/subgraph?node_id=${encodeURIComponent(conceptId)}&hops=2&direction=both`)
      .then(data => {
        if (!cancelled) setNodeGraph({ conceptId, data });
      })
      .catch(() => {
        if (!cancelled) setNodeGraph({ conceptId, data: null });
      });
    return () => { cancelled = true; };
  }, [conceptId]);

  const study = parseStudySections(selectedNode.text);
  const typeKey = selectedNode.node_type || 'note';
  const typeLabel = NODE_TYPE_LABELS[typeKey] || typeKey;
  const theme = INSPECTOR_THEMES[typeKey] || INSPECTOR_THEMES.note;
  const gData = nodeGraph?.conceptId === conceptId ? nodeGraph?.data : null;
  const selfGraphNode = gData?.nodes?.find(n => n.id === conceptId);
  const keywords = selfGraphNode?.keywords || [];
  const relatedConcepts = (gData?.nodes || []).filter(
    n => n.node_kind === 'concept' && n.id !== conceptId && n.type !== 'DayModule',
  ).slice(0, 4);
  const appliedTargets = (gData?.nodes || []).filter(
    n => n.node_kind === 'checkpoint' || n.node_kind === 'code_symbol',
  ).slice(0, 4);
  const topCommunity = gData?.communities?.[0] || null;
  const labCheckpoints = selectedNode.lab_topic?.checkpoints ?? [];

  return (
    <aside className={`node-inspector ${className}`} aria-label="Thông tin tri thức nút">
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
            aria-label="Đóng chi tiết nút"
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/15 px-1.5 py-0.5 rounded-md text-sm font-bold"
          >
            ×
          </button>
        </div>
        <h3 id={titleId} className="text-[15.5px] font-bold leading-snug text-white">
          {study.title}
        </h3>
        {selectedNode.source_ref?.section_ref && (
          <div className="mt-1 text-[11px] text-white/80 truncate" title={selectedNode.source_ref.section_ref}>
            📖 {selectedNode.source_ref.section_ref}
          </div>
        )}
      </div>

      <div className="p-4 overflow-y-auto space-y-3.5 text-xs select-text">
        {/* Key Quote Callout */}
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

        {/* Linked Lab Checkpoints */}
        {labCheckpoints.length > 0 && (
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 space-y-2">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-blue-800">
              Áp dụng trong bài Lab Ngày {day}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {labCheckpoints.map(cp => (
                <button
                  key={cp.id}
                  type="button"
                  onClick={() => onOpenCheckpoint?.(day, cp.id)}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-100 border border-blue-200 text-blue-800 font-semibold text-[11px] flex items-center gap-1.5 transition"
                >
                  <span className="font-mono font-bold text-blue-700">{cp.label}</span>
                  <span className="truncate max-w-[220px] text-slate-700">{cp.title}</span>
                </button>
              ))}
            </div>
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
                      onClick={() => onRelatedConcept(rc.id, rc.day)}
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
      </div>
    </aside>
  );
}

function App() {
  const [view, setView] = useState('lab');
  const [day, setDay] = useState(1);
  const [workspace, setWorkspace] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [labCheckpoint, setLabCheckpoint] = useState(null);
  const [focusedCheckpoint, setFocusedCheckpoint] = useState(null);

  const [dayMenuOpen, setDayMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);

  const [mapperOpen, setMapperOpen] = useState(false);
  const [mapQuery, setMapQuery] = useState('CP3');
  const [mapScopeDay, setMapScopeDay] = useState(false);
  const [mapMode, setMapMode] = useState('graphrag');
  const [mapDirection, setMapDirection] = useState('both');
  const [mapLoading, setMapLoading] = useState(false);
  const [mapResult, setMapResult] = useState(null);
  const [showAllPaths, setShowAllPaths] = useState(false);

  const [ingestOpen, setIngestOpen] = useState(false);
  const [ingestTitle, setIngestTitle] = useState('');
  const [ingestDay, setIngestDay] = useState(14);
  const [ingestContent, setIngestContent] = useState('');
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestStatus, setIngestStatus] = useState(null);

  const searchInputRef = useRef(null);
  const searchBoxRef = useRef(null);
  const dropdownRef = useRef(null);

  const enrichedMindmaps = useMemo(() => buildEnrichedMindmaps(workspace), [workspace]);
  const currentNodes = enrichedMindmaps?.[day]?.nodes ?? [];
  const selectedNode = currentNodes.find(n => n.id === selectedId) || null;
  const activeTitle = getDayShortTitle(enrichedMindmaps, day);

  const currentLab = useMemo(() => labs.find(item => item.day === day), [day]);
  const activeCheckpoint = useMemo(
    () => currentLab?.checkpoints.find(cp => cp.id === labCheckpoint) ?? null,
    [currentLab, labCheckpoint],
  );

  // Concept or Lab section currently focused -> ChatBot context
  const chatFocus = selectedNode?.source_ref?.concept_id
    ? {
        id: selectedNode.source_ref.concept_id,
        day: selectedNode.source_ref.day ?? day,
        label: getNodeTitle(selectedNode).slice(0, 80),
      }
    : null;
  const currentLabFocusId = activeCheckpoint ? activeCheckpoint.id : currentLab?.id;
  const currentLabFocus = currentLab
    ? {
        day,
        label: activeCheckpoint ? `${activeCheckpoint.label} · ${activeCheckpoint.title}` : currentLab.title,
      }
    : null;

  // Deterministic Search Results across Lab Checkpoints & Mindmap Concepts
  const searchResults = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return { labHits: [], conceptHits: [] };

    const labHits = [];
    for (const lab of labs) {
      for (const cp of lab.checkpoints) {
        const viewData = checkpoint_views?.[cp.id];
        const haystack = [
          `Ngày ${lab.day}`,
          `D${lab.day}`,
          lab.title,
          cp.label,
          cp.title,
          cp.requirement,
          viewData?.explanation || '',
        ].join(' ');
        if (matchesAllTokens(haystack, q)) {
          labHits.push({
            day: lab.day,
            labTitle: lab.title,
            cpId: cp.id,
            label: cp.label,
            title: cp.title,
          });
        }
      }
    }

    const conceptHits = [];
    for (const d of DAYS) {
      const nodes = enrichedMindmaps?.[d]?.nodes ?? [];
      for (const node of nodes) {
        if (node.node_type === 'day_root') continue;
        const haystack = [
          `Ngày ${d}`,
          `D${d}`,
          node.text || '',
          node.source_ref?.concept_id || '',
          node.source_ref?.section_ref || '',
          node.lab_topic?.id || '',
        ].join(' ');
        if (matchesAllTokens(haystack, q)) {
          conceptHits.push({
            day: d,
            nodeId: node.id,
            title: getNodeTitle(node),
            pages: node.source_ref?.pdf_pages || [],
            isTrap: node.node_type === 'trap',
          });
        }
      }
    }

    return {
      labHits: labHits.slice(0, 6),
      conceptHits: conceptHits.slice(0, 8),
    };
  }, [searchQuery, enrichedMindmaps]);

  function openMindmapFromLab(targetDay, nodeId, checkpoint) {
    const nextDay = targetDay || day;
    setDay(nextDay);
    setView('mindmap');
    setSelectedId(nodeId || null);
    if (checkpoint) {
      const guide = checkpoint_views?.[checkpoint.id];
      const linked = resolveCheckpointMindmapNodes(checkpoint, guide, enrichedMindmaps, nextDay);
      setFocusedCheckpoint({
        day: nextDay,
        id: checkpoint.id,
        label: checkpoint.label,
        title: checkpoint.title,
        nodeIds: linked.map(item => item.node.id),
      });
    } else {
      setFocusedCheckpoint(null);
    }
  }

  function jumpToConcept(conceptId, targetDay) {
    if (!targetDay) return;
    const nodes = enrichedMindmaps?.[targetDay]?.nodes ?? [];
    const target = nodes.find(
      n => n.source_ref?.concept_id === conceptId || n.lab_topic?.id === conceptId,
    );
    setView('mindmap');
    setDay(targetDay);
    setFocusedCheckpoint(null);
    setSelectedId(target ? target.id : null);
  }

  function selectRelatedConcept(conceptId, targetDay) {
    if (!targetDay || targetDay < 1 || targetDay > 14) return;
    setDay(targetDay);
    setFocusedCheckpoint(null);
    const targetNodes = enrichedMindmaps?.[targetDay]?.nodes ?? [];
    const node = targetNodes.find(item => item.source_ref?.concept_id === conceptId);
    setSelectedId(node ? node.id : null);
  }

  function selectDay(nextDay) {
    setDay(nextDay);
    setSelectedId(null);
    setLabCheckpoint(null);
    setFocusedCheckpoint(null);
  }

  function switchView(nextView) {
    const normalized = nextView === 'lab' ? 'lab' : 'mindmap';
    setView(normalized);
    setSelectedId(null);
    setMapperOpen(false);
    if (normalized === 'lab') {
      setFocusedCheckpoint(null);
    }
  }

  async function load() {
    try {
      setWorkspace(await request('/api/workspace'));
    } catch {
      /* Labs & Mindmap bridge remain usable offline from static curriculum catalogs */
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        setSearchDropdownOpen(true);
      } else if (event.key === 'Escape') {
        setSearchDropdownOpen(false);
        setDayMenuOpen(false);
      }
    }
    function onClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDayMenuOpen(false);
      }
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target)) {
        setSearchDropdownOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onClickOutside);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onClickOutside);
    };
  }, []);

  async function runMapping(overrideQuery, targetDay = day) {
    const q = (overrideQuery ?? mapQuery).trim();
    if (!q) return;
    if (overrideQuery !== undefined) setMapQuery(overrideQuery);
    setMapLoading(true);
    setShowAllPaths(false);
    try {
      const data = await request('/api/map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          day: mapScopeDay ? targetDay : null,
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

  const hasSearchQuery = searchQuery.trim().length > 0;
  const totalSearchMatches = searchResults.labHits.length + searchResults.conceptHits.length;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50 text-slate-800">
      {/* Unified Header (identical in both Lab and Mindmap) */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-3 z-30 shrink-0 shadow-sm">
        {/* Left: Logo, View Tabs & Unified Day Selector */}
        <div className="flex items-center space-x-3 min-w-0">
          <div className="flex items-center space-x-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm shadow-blue-500/30">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </div>
            <span className="font-bold text-slate-800 tracking-tight text-sm hidden sm:inline">AI20K</span>
          </div>

          <nav className="workspace-view-tabs shrink-0" aria-label="Khu vực học">
            <button
              type="button"
              aria-current={view === 'lab' ? 'page' : undefined}
              onClick={() => switchView('lab')}
            >
              Lab
            </button>
            <button
              type="button"
              aria-current={view === 'mindmap' ? 'page' : undefined}
              onClick={() => switchView('mindmap')}
            >
              Mindmap
            </button>
          </nav>

          <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block shrink-0" />

          {/* Unified Day Selector Dropdown */}
          <div className="relative hidden md:block" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDayMenuOpen(o => !o)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-slate-100 text-xs font-medium text-slate-700 border border-slate-200 transition"
            >
              <span className={`w-2 h-2 rounded-full ${view === 'lab' ? 'bg-teal-600' : 'bg-blue-600'}`} />
              <span className="truncate max-w-[230px] sm:max-w-[280px]">
                {`D${String(day).padStart(2, '0')} · ${activeTitle}`}
              </span>
              <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </button>

            {dayMenuOpen && (
              <div className="absolute left-0 mt-1.5 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2">
                <div className="px-2 py-1 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                  Chọn ngày học (1–14)
                </div>
                <div className="max-h-80 overflow-y-auto space-y-0.5">
                  {DAYS.map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        selectDay(d);
                        setDayMenuOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 transition ${
                        day === d ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`w-7 text-center font-mono text-[11px] px-1 py-0.5 rounded shrink-0 ${
                          day === d ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        D{String(d).padStart(2, '0')}
                      </span>
                      <span className="truncate">{getDayShortTitle(enrichedMindmaps, d)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Unified Deterministic Search */}
        <div className="hidden lg:flex items-center relative" ref={searchBoxRef}>
          <form
            className="relative"
            onSubmit={e => {
              e.preventDefault();
              if (!hasSearchQuery) return;
              if (searchResults.labHits.length > 0) {
                const first = searchResults.labHits[0];
                setDay(first.day);
                setLabCheckpoint(first.cpId);
                setView('lab');
                setSearchDropdownOpen(false);
              } else if (searchResults.conceptHits.length > 0) {
                const first = searchResults.conceptHits[0];
                setDay(first.day);
                setSelectedId(first.nodeId);
                setFocusedCheckpoint(null);
                setView('mindmap');
                setSearchDropdownOpen(false);
              } else {
                setSearchDropdownOpen(true);
              }
            }}
          >
            <input
              ref={searchInputRef}
              value={searchQuery}
              onFocus={() => setSearchDropdownOpen(true)}
              onChange={e => {
                setSearchQuery(e.target.value);
                setSearchDropdownOpen(true);
              }}
              className="w-80 pl-8 pr-12 py-1.5 text-xs bg-slate-100 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-700 transition"
              placeholder="Tìm checkpoint, khái niệm... (Ctrl+K)"
              type="text"
            />
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchDropdownOpen(false);
                }}
                aria-label="Xóa từ khóa tìm kiếm"
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

          {searchDropdownOpen && hasSearchQuery && (
            <div className="absolute left-0 top-full mt-1.5 w-[420px] max-h-[70vh] overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-2xl z-50 p-2 space-y-2 text-xs">
              {totalSearchMatches === 0 ? (
                <div className="px-3 py-4 text-center text-slate-500 space-y-2">
                  <div>Không tìm thấy kết quả phù hợp cho “{searchQuery.trim()}”.</div>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchDropdownOpen(false);
                      setMapperOpen(true);
                      runMapping(searchQuery.trim());
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold transition"
                  >
                    Tra cứu bằng AI GraphRAG →
                  </button>
                </div>
              ) : (
                <>
                  {searchResults.labHits.length > 0 && (
                    <div className="space-y-1">
                      <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Phần bài Lab ({searchResults.labHits.length})
                      </div>
                      {searchResults.labHits.map(hit => (
                        <button
                          key={hit.cpId}
                          type="button"
                          onClick={() => {
                            setDay(hit.day);
                            setLabCheckpoint(hit.cpId);
                            setFocusedCheckpoint(null);
                            setSelectedId(null);
                            setView('lab');
                            setSearchDropdownOpen(false);
                          }}
                          className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-blue-50 flex items-center justify-between gap-2 transition"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-800 truncate">
                              <span className="font-mono text-blue-700 mr-1.5">{hit.label}</span>
                              {hit.title}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">{hit.labTitle}</div>
                          </div>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] shrink-0">
                            D{String(hit.day).padStart(2, '0')}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchResults.conceptHits.length > 0 && (
                    <div className="space-y-1">
                      <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Tri thức Mindmap ({searchResults.conceptHits.length})
                      </div>
                      {searchResults.conceptHits.map(hit => (
                        <button
                          key={`${hit.day}:${hit.nodeId}`}
                          type="button"
                          onClick={() => {
                            setDay(hit.day);
                            setSelectedId(hit.nodeId);
                            setFocusedCheckpoint(null);
                            setView('mindmap');
                            setSearchDropdownOpen(false);
                          }}
                          className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-purple-50 flex items-center justify-between gap-2 transition"
                        >
                          <span className="font-semibold text-slate-800 truncate">
                            {hit.isTrap ? '▲ ' : '◆ '}{hit.title}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-mono text-[10px] shrink-0">
                            D{String(hit.day).padStart(2, '0')}{hit.pages.length ? ` · Tr.${hit.pages.join(',')}` : ''}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: AI GraphRAG & Avatar (clean & identical across views) */}
        <div className="flex items-center space-x-2 shrink-0">
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
      <main className="flex-1 relative overflow-hidden flex" aria-label={`${view === 'lab' ? 'Lab' : 'Mindmap'} · Ngày ${day}`}>
        {view === 'lab' ? (
          <LabGuide
            day={day}
            selection={labCheckpoint}
            onSelect={setLabCheckpoint}
            enrichedMindmaps={enrichedMindmaps}
            onOpenMindmap={openMindmapFromLab}
          />
        ) : (
          <CourseTree
            mindmapsByDay={enrichedMindmaps}
            activeDay={day}
            selectedNodeId={selectedId}
            focusedCheckpoint={focusedCheckpoint}
            searchQuery={searchQuery}
            onSelectConcept={(targetDay, nodeId) => {
              setDay(targetDay);
              setSelectedId(nodeId);
            }}
            onSelectDay={selectDay}
            onBackToLab={() => {
              if (focusedCheckpoint) {
                setDay(focusedCheckpoint.day);
                setLabCheckpoint(focusedCheckpoint.id);
              }
              switchView('lab');
            }}
          />
        )}

        {view !== 'lab' && selectedNode && (
          <NodeInspector
            selectedNode={selectedNode}
            day={day}
            className="node-inspector-drawer"
            onClose={() => setSelectedId(null)}
            onRelatedConcept={selectRelatedConcept}
            onOpenCheckpoint={(targetDay, cpId) => {
              setDay(targetDay);
              setLabCheckpoint(cpId);
              switchView('lab');
            }}
          />
        )}

        {/* AI Lecture-to-Lab GraphRAG Mapper Drawer (Left) */}
        {mapperOpen && (() => {
          const summaryData = mapResult ? parseExplanationSummary(mapResult.explanation) : null;
          const paths = mapResult?.subgraph?.paths || [];
          const visiblePaths = showAllPaths ? paths : paths.slice(0, 5);

          return (
            <aside
              className="fixed top-16 left-4 bottom-20 w-[min(470px,calc(100vw-2rem))] bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-2xl z-30 flex flex-col overflow-hidden"
              aria-label="AI Lecture-to-Lab Mapper"
            >
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 px-4 py-3 text-white flex items-center justify-between shrink-0">
                <div>
                  <div className="text-[13px] font-bold tracking-tight flex items-center gap-1.5">
                    <span>⚡</span> AI GraphRAG Mapper
                  </div>
                  <div className="text-[10.5px] text-slate-300">
                    Ánh xạ Lý thuyết ↔ Code Lab · Guardrails
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMapperOpen(false)}
                  className="text-white/80 hover:text-white px-2 py-0.5 rounded-lg hover:bg-white/15 text-base font-bold transition"
                >
                  ×
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-3.5 text-xs select-text">
                <form className="flex gap-2" onSubmit={e => { e.preventDefault(); runMapping(); }}>
                  <input
                    type="text"
                    value={mapQuery}
                    onChange={e => setMapQuery(e.target.value)}
                    className="flex-1 min-w-0 border border-slate-300 rounded-xl px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                    placeholder="Nhập Checkpoint, hàm hoặc khái niệm..."
                  />
                  <button
                    type="submit"
                    disabled={mapLoading}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50 shadow-sm shrink-0 transition"
                  >
                    {mapLoading ? 'Đang ánh xạ…' : 'Ánh xạ'}
                  </button>
                </form>

                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Gợi ý nhanh
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_QUERIES.map(q => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => runMapping(q)}
                        className={`px-2.5 py-1 rounded-full border text-[11px] font-medium transition ${
                          mapQuery === q
                            ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10.5px] font-semibold text-slate-500 shrink-0">Chế độ:</span>
                    <div className="flex gap-1 bg-slate-200/70 p-0.5 rounded-lg">
                      {[
                        ['graphrag', 'Lv3 GraphRAG'],
                        ['level2', 'Lv2 Hybrid'],
                        ['level1', 'Lv1 Direct'],
                      ].map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setMapMode(id)}
                          className={`px-2 py-1 rounded-md text-[10.5px] font-semibold transition ${
                            mapMode === id
                              ? 'bg-white text-blue-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10.5px] font-semibold text-slate-500 shrink-0">Chiều:</span>
                    <div className="flex gap-1 bg-slate-200/70 p-0.5 rounded-lg">
                      {[
                        ['both', '2 chiều'],
                        ['theory_to_practice', 'Lý thuyết → Code'],
                        ['practice_to_theory', 'Code → Lý thuyết'],
                      ].map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setMapDirection(id)}
                          className={`px-2 py-1 rounded-md text-[10.5px] font-semibold transition ${
                            mapDirection === id
                              ? 'bg-white text-indigo-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-[11px] text-slate-600 pt-0.5 border-t border-slate-200/70">
                    <input
                      type="checkbox"
                      checked={mapScopeDay}
                      onChange={e => setMapScopeDay(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Chỉ tìm trong Ngày {day}
                  </label>
                </div>

                {mapResult && (
                  <div className="space-y-3">
                    <div className={`px-3 py-2.5 rounded-xl border space-y-2 ${mapResult.blocked
                      ? 'bg-red-50 text-red-800 border-red-200'
                      : mapResult.abstention
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}
                    >
                      <div className="font-bold text-[12px]">
                        {mapResult.blocked
                          ? '🛑 Input Guardrail: Đã chặn Prompt Injection'
                          : mapResult.abstention
                            ? '⚠️ INSUFFICIENT_EVIDENCE: Ngoài phạm vi tài liệu'
                            : `✅ Source Verifier (${mapResult.mode || 'graphrag'}): Kiểm chứng 100%`}
                      </div>
                      {!mapResult.blocked && (
                        <div className="flex flex-wrap gap-1.5 text-[10.5px] font-semibold">
                          <span className="px-2 py-0.5 rounded-full bg-white/85 border border-current/15 text-slate-700">
                            {mapResult.knowledge_refs?.length || 0} kiến thức
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-white/85 border border-current/15 text-slate-700">
                            {mapResult.code_refs?.length || 0} code
                          </span>
                          {mapResult.subgraph && (
                            <span className="px-2 py-0.5 rounded-full bg-white/85 border border-current/15 text-slate-700">
                              {mapResult.subgraph.nodes?.length || 0} nút · {mapResult.subgraph.edges?.length || 0} cạnh
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {summaryData && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                        <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                          Tóm tắt ánh xạ
                        </div>
                        {summaryData.raw ? (
                          <p className="text-slate-700 leading-relaxed">{summaryData.raw}</p>
                        ) : (
                          <>
                            {summaryData.headline && (
                              <div className="font-bold text-slate-900 text-[12.5px]">
                                {summaryData.headline}
                              </div>
                            )}
                            {summaryData.concepts?.length > 0 && (
                              <div className="space-y-1">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-700">
                                  Kiến thức trọng tâm
                                </div>
                                <ul className="space-y-1">
                                  {summaryData.concepts.map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-slate-700 leading-snug">
                                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {summaryData.codeFiles?.length > 0 && (
                              <div className="space-y-1 pt-1">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-teal-700">
                                  Mã nguồn đối chiếu
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {summaryData.codeFiles.map((file, idx) => (
                                    <code key={idx} className="px-2 py-0.5 rounded-md bg-white border border-teal-200 text-teal-900 font-mono text-[10.5px]">
                                      {file}
                                    </code>
                                  ))}
                                </div>
                              </div>
                            )}
                            {summaryData.stats && (
                              <div className="text-[10.5px] text-slate-500 pt-1 border-t border-slate-200/70">
                                {summaryData.stats}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {mapResult.trap_warnings?.length > 0 && (
                      <div className="bg-rose-50 border border-rose-200 border-l-4 border-l-rose-500 rounded-xl p-3 text-rose-900 space-y-1.5">
                        <div className="font-bold text-[11.5px] flex items-center gap-1.5">
                          <span>⚠️</span> Cảnh báo Bẫy (Guardrails)
                        </div>
                        <ul className="space-y-1 text-[11.5px]">
                          {mapResult.trap_warnings.map((w, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                              <span>{w}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {mapResult.knowledge_refs?.length > 0 && (
                      <div className="bg-blue-50/50 border border-blue-200/80 rounded-xl p-3 space-y-2">
                        <div className="font-bold text-slate-900 text-[12px]">
                          Nút Tri thức Lecture ({mapResult.knowledge_refs.length})
                        </div>
                        <div className="space-y-2">
                          {mapResult.knowledge_refs.map(k => (
                            <div key={k.concept_id} className="bg-white border border-slate-200/90 rounded-xl p-2.5 space-y-1.5 shadow-2xs">
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-bold text-slate-900 text-[12px] leading-snug">
                                  {k.label}
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono text-[10px] font-semibold shrink-0">
                                  D{k.day}{k.pdf_pages?.length ? ` · Tr.${k.pdf_pages.join(',')}` : ''}
                                </span>
                              </div>
                              <p className="text-slate-600 leading-relaxed text-[11.5px]">{k.summary}</p>
                              <button
                                type="button"
                                onClick={() => {
                                  jumpToConcept(k.concept_id, k.day);
                                  setMapperOpen(false);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold text-[11px] transition"
                              >
                                Xem trên Mindmap →
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {mapResult.code_refs?.length > 0 && (
                      <div className="bg-teal-50/60 border border-teal-200 rounded-xl p-3 space-y-2">
                        <div className="font-bold text-teal-950 text-[12px]">
                          Code Repo Đối chiếu ({mapResult.code_refs.length})
                        </div>
                        <div className="space-y-1.5">
                          {mapResult.code_refs.map((c, i) => (
                            <div key={i} className="bg-white border border-teal-200/80 rounded-lg px-2.5 py-2 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-mono font-bold text-[11px] text-slate-900 truncate">
                                  {c.file_path}
                                </div>
                                {c.symbol && (
                                  <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-teal-100 text-teal-900 font-mono text-[10px] font-semibold">
                                    {c.symbol}()
                                  </span>
                                )}
                              </div>
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 font-mono text-[10px] shrink-0">
                                L{c.line_start}–L{c.line_end}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {mapResult.communities?.length > 0 && (
                      <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3 space-y-2">
                        <div className="font-bold text-indigo-950 text-[12px]">
                          Graph Communities ({mapResult.communities.length})
                        </div>
                        <div className="space-y-1.5">
                          {mapResult.communities.map(c => (
                            <div
                              key={c.community_id}
                              title={c.summary}
                              className="bg-white border border-indigo-200/80 rounded-lg px-2.5 py-1.5 flex items-start gap-2"
                            >
                              <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-mono text-[10px] font-bold shrink-0 mt-0.5">
                                {c.community_id}
                              </span>
                              <span className="text-slate-800 font-medium text-[11.5px] leading-snug">
                                {c.title}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {paths.length > 0 && (
                      <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-purple-950 text-[12px]">
                            GraphRAG Multi-hop ({mapResult.subgraph.nodes?.length || 0} nút · {mapResult.subgraph.edges?.length || 0} cạnh)
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          {visiblePaths.map((p, idx) => {
                            const rel = getRelationBadge(p.relation);
                            return (
                              <div key={idx} className="bg-white border border-purple-200/80 rounded-lg p-2 space-y-1">
                                <div className="font-semibold text-slate-800 text-[11.5px] leading-snug">
                                  {p.from_label}
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap pl-1">
                                  <span className="text-slate-400 text-[11px]">↳</span>
                                  <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${rel.cls}`}>
                                    {rel.label}
                                  </span>
                                  <span className="font-semibold text-slate-900 text-[11.5px] leading-snug">
                                    {p.to_label}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {paths.length > 5 && (
                          <button
                            type="button"
                            onClick={() => setShowAllPaths(v => !v)}
                            className="w-full py-1.5 rounded-lg bg-white hover:bg-purple-100/60 border border-purple-200 text-purple-800 font-semibold text-[11px] transition"
                          >
                            {showAllPaths ? 'Thu gọn' : `Xem tất cả ${paths.length} liên kết`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <button
                    type="button"
                    onClick={() => setIngestOpen(o => !o)}
                    className="w-full text-left px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/70 font-semibold text-slate-700 transition"
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
                          className="flex-1 min-w-0 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
                          required
                        />
                        <input
                          type="number"
                          min="1"
                          max="14"
                          value={ingestDay}
                          onChange={e => setIngestDay(e.target.value)}
                          className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                        />
                      </div>
                      <textarea
                        rows={3}
                        value={ingestContent}
                        onChange={e => setIngestContent(e.target.value)}
                        placeholder="Dán nội dung Markdown (# Heading...) để trích Concept & nối Graph..."
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
                        required
                      />
                      <button
                        type="submit"
                        disabled={ingestLoading}
                        className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                      >
                        {ingestLoading ? 'Đang trích xuất & nối Graph…' : 'Nạp vào GraphRAG DB'}
                      </button>
                      {ingestStatus && (
                        <div className={`px-2.5 py-1.5 rounded-lg font-medium ${ingestStatus.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
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
          );
        })()}
      </main>

      <ChatBot
        key={view === 'lab' ? `lab:${currentLabFocusId}` : `mindmap:${day}`}
        day={day}
        labId={view === 'lab' ? currentLabFocusId : undefined}
        focus={view === 'lab' ? currentLabFocus : chatFocus}
        inspectorOpen={view !== 'lab' && Boolean(selectedNode)}
        hasMinimap={view === 'mindmap' && !selectedNode}
        onJumpToConcept={jumpToConcept}
      />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
