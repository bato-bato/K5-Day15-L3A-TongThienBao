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

function NodeSources({ selectedNode, detail, readings, onClearDetail, day, onRelatedConcept, onOpenCheckpoint }) {
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
  const labCheckpoints = selectedNode.lab_topic?.checkpoints ?? [];

  return (
    <section className="tutor-node-sources space-y-3" aria-label="Tài liệu từ Graph">
      <h3 className="font-semibold text-base">{detail?.title || study.title}</h3>
      {selectedNode.verification_status === 'verified' && <span className="text-teal-800">Đã xác minh</span>}
      {selectedNode.source_ref?.section_ref && (
        <p className="text-slate-600">
          {selectedNode.source_ref.section_ref}
          {selectedNode.source_ref.pdf_pages?.length > 0 && ` · Trang ${selectedNode.source_ref.pdf_pages.join(', ')}`}
        </p>
      )}
        {detail && (
          <section aria-label="Chi tiết nhánh" className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-sm">
            <button type="button" onClick={onClearDetail} className="font-semibold text-indigo-700">← Xem nhánh cha</button>
            {detail.kind === 'l2' ? (
              <ul className="list-disc space-y-2 pl-4">
                {detail.items.map(item => <li key={item}>{item}</li>)}
              </ul>
            ) : (
              <dl className="space-y-2">
                {[
                  ['Vấn đề', detail.problem], ['Cơ chế', detail.mechanism],
                  ['Ví dụ', detail.example], ['Nguồn đối chiếu', detail.source],
                ].filter(([, value]) => value).map(([label, value]) => (
                  <div key={label}><dt className="font-semibold">{label}</dt><dd>{value}</dd></div>
                ))}
              </dl>
            )}
          </section>
        )}
        {readings.length > 0 && (
          <section className="space-y-2" aria-label="Tài liệu bổ sung Day 07">
            <h4 className="font-semibold text-teal-900">Đọc sâu Day 07 · M03</h4>
            {readings.map(item => (
              <details key={item.id} open={readings.length <= 2} className="rounded-lg border border-teal-100 bg-white p-3">
                <summary className="cursor-pointer font-semibold">{item.label}</summary>
                <p className="mt-2 leading-relaxed">{item.summary}</p>
                <a href={item.url} target="_blank" rel="noreferrer" className="mt-2 inline-block font-medium text-teal-800 underline">Mở nguồn</a>
              </details>
            ))}
          </section>
        )}
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

        {/* Linked Checkpoints, Code & Related Concepts */}
        {(appliedTargets.length > 0 || relatedConcepts.length > 0) && (
          <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-purple-950 text-[12px]">
                Liên kết tri thức Lec ↔ Lab
              </span>
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

    </section>
  );
}

function App() {
  const [view, setView] = useState('lab');
  const [day, setDay] = useState(1);
  const [showAllDays, setShowAllDays] = useState(false);
  const [workspace, setWorkspace] = useState(null);
  const [selectedId, setConceptId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  function setSelectedId(id, detail = null) {
    setConceptId(id);
    setSelectedDetail(detail);
  }
  const tutorDraft = useRef(null);
  const [labCheckpoint, setLabCheckpoint] = useState(null);
  const [focusedCheckpoint, setFocusedCheckpoint] = useState(null);

  const [dayMenuOpen, setDayMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);

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
  const graphConcept = selectedNode?.source_ref?.concept_id;
  const m03 = checkpoint_views['day07-m03'];
  const graphTopic = selectedDetail?.title ?? '';
  const graphGroup = selectedDetail?.groupLabel ?? graphTopic;
  const topicKey = /cross.encoder|rerank/i.test(graphTopic) && selectedDetail?.kind === 'l3' ? 'rerank'
    : /\brrf\b/i.test(graphTopic) && selectedDetail?.kind === 'l3' ? 'rrf'
    : /bm25/i.test(graphTopic) && selectedDetail?.kind === 'l3' ? 'bm25'
    : /dense/i.test(graphTopic) && selectedDetail?.kind === 'l3' ? 'dense' : null;
  const graphReadingKeys = topicKey ? [topicKey]
    : /tìm kiếm lai/i.test(graphGroup) ? ['bm25', 'dense', 'rrf']
    : /gộp hạng/i.test(graphGroup) ? ['rrf', 'rerank']
    : !selectedDetail && graphConcept === 'PAT_D7_RETRIEVAL' ? ['bm25', 'dense', 'rrf']
    : !selectedDetail && graphConcept === 'PAT_D7_POST_RETRIEVAL_AUGMENT' ? ['rrf', 'rerank'] : [];
  const graphReadings = day === 7
    ? (m03.deep_reading_guides ?? []).filter(item => graphReadingKeys.some(key => item.id === `day07-m03-${key}`))
    : [];
  const chatFocus = selectedNode ? {
    id: topicKey && graphReadings.length ? `LAB:day07-m03-${topicKey}` : graphConcept,
    day,
    label: selectedDetail?.title || getNodeTitle(selectedNode),
  } : null;
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
    setShowAllDays(false);
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
    setShowAllDays(false);
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
    setShowAllDays(false);
    setSelectedId(null);
    setLabCheckpoint(null);
    setFocusedCheckpoint(null);
  }

  function switchView(nextView) {
    const normalized = nextView === 'lab' ? 'lab' : 'mindmap';
    setView(normalized);
    setSelectedId(null);
    if (normalized === 'lab') {
      setShowAllDays(false);
      setFocusedCheckpoint(null);
    }
  }

  function openLabResult(hit) {
    selectDay(hit.day);
    setLabCheckpoint(hit.cpId);
    setView('lab');
    setSearchDropdownOpen(false);
  }

  function openConceptResult(hit) {
    setDay(hit.day);
    setShowAllDays(false);
    setSelectedId(hit.nodeId);
    setFocusedCheckpoint(null);
    setView('mindmap');
    setSearchDropdownOpen(false);
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

  const hasSearchQuery = searchQuery.trim().length > 0;
  const totalSearchMatches = searchResults.labHits.length + searchResults.conceptHits.length;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50 text-slate-800">
      {/* Unified Header (identical in both Lab and Mindmap) */}
      <header className="workspace-header">
          <div className="workspace-brand flex items-center space-x-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm shadow-blue-500/30">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </div>
            <span className="font-bold text-slate-800 tracking-tight text-sm hidden sm:inline">AI20K</span>
          </div>

        <div className="workspace-header-controls">
        <div className="workspace-header-nav">
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
              Lec
            </button>
          </nav>

          {/* Unified Day Selector Dropdown */}
          <div className="workspace-day-picker" ref={dropdownRef}>
            <button
              type="button"
              aria-label={`Chọn ngày học, hiện tại ngày ${day}: ${activeTitle}`}
              aria-expanded={dayMenuOpen}
              onClick={() => setDayMenuOpen(o => !o)}
              className="workspace-day-button"
            >
              <span className="shrink-0 font-semibold">D{String(day).padStart(2, '0')}</span>
              <span className="truncate">· {activeTitle}</span>
              <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </button>

            {dayMenuOpen && (
              <div className="workspace-day-menu bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2">
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
          {view === 'mindmap' && (
            <button
              type="button"
              className="workspace-all-days"
              aria-pressed={showAllDays}
              onClick={() => {
                setShowAllDays(current => !current);
                setSelectedId(null);
              }}
            >
              Tất cả
            </button>
          )}
        </div>

        {/* Center: Unified Deterministic Search */}
        <div className="workspace-search" ref={searchBoxRef}>
          <form
            className="workspace-search-form"
            role="search"
            onSubmit={e => {
              e.preventDefault();
              if (!hasSearchQuery) return;
              if (searchResults.labHits.length > 0) {
                openLabResult(searchResults.labHits[0]);
              } else if (searchResults.conceptHits.length > 0) {
                openConceptResult(searchResults.conceptHits[0]);
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
              className="workspace-search-input"
              aria-label="Tìm checkpoint, khái niệm"
              placeholder="Tìm checkpoint, khái niệm…"
              type="text"
            />
            <svg className="workspace-search-icon" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchDropdownOpen(false);
                }}
                aria-label="Xóa từ khóa tìm kiếm"
                className="workspace-search-accessory hover:bg-slate-200"
              >
                ×
              </button>
            )}
          </form>

          {searchDropdownOpen && hasSearchQuery && (
            <div className="workspace-search-results bg-white border border-slate-200 rounded-xl shadow-2xl z-50 p-2 space-y-2 text-xs">
              {totalSearchMatches === 0 ? (
                <div className="px-3 py-4 text-center text-slate-500">
                  Không tìm thấy kết quả phù hợp cho “{searchQuery.trim()}”. Hãy thử từ khóa khác.
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
                          onClick={() => openLabResult(hit)}
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
                          onClick={() => openConceptResult(hit)}
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

        </div>

        {/* Right: Avatar (clean & identical across views) */}
        <div className="workspace-avatar">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white text-[11px] font-bold border border-white shadow-sm ring-1 ring-slate-200">
            AI
          </div>
        </div>
      </header>

      {/* MainWorkspace */}
      <main className="flex-1 relative overflow-hidden flex" aria-label={view === 'lab' ? `Lab · Ngày ${day}` : showAllDays ? 'Lec · Tất cả các ngày' : `Lec · Ngày ${day}`}>
        {view === 'lab' ? (
          <LabGuide
            day={day}
            selection={labCheckpoint}
            onSelect={setLabCheckpoint}
            onAskTutor={question => tutorDraft.current?.openDraft(question)}
            enrichedMindmaps={enrichedMindmaps}
            onOpenMindmap={openMindmapFromLab}
          />
        ) : (
          <CourseTree
            mindmapsByDay={enrichedMindmaps}
            page={showAllDays ? 'all' : day}
            selectedNodeId={selectedId}
            focusedCheckpoint={focusedCheckpoint}
            searchQuery={searchQuery}
            onSelectConcept={(targetDay, nodeId, detail) => {
              setDay(targetDay);
              setSelectedId(nodeId, detail);
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

      </main>

      <ChatBot
        key={view === 'lab' ? `lab:${currentLabFocusId}` : `mindmap:${day}`}
        day={day}
        draftRef={tutorDraft}
        isLab={view === 'lab'}
        labId={view === 'lab' ? currentLabFocusId : graphReadings.length ? 'day07-m03' : undefined}
        focus={view === 'lab' ? currentLabFocus : chatFocus}
        labContent={view === 'lab' && activeCheckpoint ? (
          <section className="tutor-node-sources space-y-2" aria-label="Tài liệu checkpoint">
            <h3 className="text-base font-semibold">{activeCheckpoint.label} · {activeCheckpoint.title}</h3>
            <p className="leading-relaxed">{checkpoint_views[activeCheckpoint.id]?.explanation || activeCheckpoint.requirement}</p>
            <a href={activeCheckpoint.definition_source.url} target="_blank" rel="noreferrer" className="inline-block font-medium text-teal-800 underline">Mở đề checkpoint</a>
          </section>
        ) : null}
        graphContent={view !== 'lab' && selectedNode ? (
          <NodeSources
            selectedNode={selectedNode}
            detail={selectedDetail}
            onClearDetail={() => setSelectedDetail(null)}
            day={day}
            readings={graphReadings}
            onRelatedConcept={selectRelatedConcept}
            onOpenCheckpoint={(targetDay, cpId) => {
              setDay(targetDay);
              setLabCheckpoint(cpId);
              switchView('lab');
            }}
          />
        ) : null}
        onCloseGraph={() => setSelectedId(null)}
        onJumpToConcept={jumpToConcept}
      />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
