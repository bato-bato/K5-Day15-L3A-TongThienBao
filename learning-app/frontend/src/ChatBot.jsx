import React, { useEffect, useRef, useState } from 'react';

const LEVELS = [
  { id: 'eli5', label: 'Siêu dễ', icon: '🧒', hint: 'So sánh đời thường, không thuật ngữ' },
  { id: 'standard', label: 'Chuẩn', icon: '📘', hint: 'Định nghĩa → cơ chế → ví dụ' },
  { id: 'deep', label: 'Chuyên sâu', icon: '🔬', hint: 'Trade-off, lỗi thường gặp, code lab' },
];
const STORAGE_KEY = 'kg_tutor_chat_v1';
const MAX_HISTORY = 6;

function loadStored(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStored(key, messages) {
  try {
    sessionStorage.setItem(key, JSON.stringify(messages.slice(-30)));
  } catch {
    /* storage unavailable: chat still works in-memory */
  }
}

/* ---------- minimal, XSS-safe markdown renderer (React elements only) ---------- */
function renderInline(text, citeMap, onCite, keyBase) {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_|\[[A-Z][A-Z0-9_]*(?::[^\]\s]+)?\])/g);
  return tokens.map((tok, i) => {
    const k = `${keyBase}-${i}`;
    if (!tok) return null;
    if (tok.startsWith('**') && tok.endsWith('**')) return <strong key={k} className="font-semibold text-slate-900">{tok.slice(2, -2)}</strong>;
    if (tok.startsWith('`') && tok.endsWith('`')) return <code key={k} className="px-1 py-0.5 rounded bg-slate-100 text-[11px] text-rose-700">{tok.slice(1, -1)}</code>;
    if (tok.startsWith('_') && tok.endsWith('_') && tok.length > 2) return <em key={k} className="text-slate-500">{tok.slice(1, -1)}</em>;
    const cite = tok.match(/^\[([A-Z][A-Z0-9_]*(?::[^\]\s]+)?)\]$/);
    if (cite) {
      const c = citeMap[cite[1]];
      return (
        <button
          key={k}
          type="button"
          title={c ? `${c.label} · Ngày ${c.day} · tr.${(c.pdf_pages || []).join(',')}` : cite[1]}
          onClick={() => c && onCite(c)}
          className="mx-0.5 align-middle inline-flex items-center px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80 text-[10px] font-semibold hover:bg-indigo-100 transition"
        >
          {c ? `N${c.day}` : '↗'}
        </button>
      );
    }
    return <React.Fragment key={k}>{tok}</React.Fragment>;
  });
}

function Markdown({ text, citations, onCite }) {
  const citeMap = Object.fromEntries((citations || []).map(c => [c.id, c]));
  const lines = text.split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        if (!/^\s*\|[\s:|-]+\|\s*$/.test(lines[i])) rows.push(lines[i].trim().slice(1, -1).split('|').map(c => c.trim()));
        i += 1;
      }
      blocks.push(
        <div key={`t${i}`} className="overflow-x-auto my-2">
          <table className="text-[11px] border-collapse w-full">
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className={ri === 0 ? 'bg-slate-100 font-semibold' : 'border-t border-slate-200'}>
                  {r.map((cell, ci) => <td key={ci} className="px-1.5 py-1 align-top">{renderInline(cell, citeMap, onCite, `t${i}-${ri}-${ci}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={`u${i}`} className="my-2 space-y-1.5 pl-4 list-disc marker:text-indigo-400 text-[12px] leading-[1.55] text-slate-700">
          {items.map((it, ii) => <li key={ii}>{renderInline(it, citeMap, onCite, `u${i}-${ii}`)}</li>)}
        </ul>,
      );
      continue;
    }
    if (/^>\s?/.test(line)) {
      blocks.push(
        <blockquote key={`q${i}`} className="my-2.5 px-3 py-2 rounded-r-lg bg-amber-50/60 border-l-[3px] border-amber-400 text-[11.5px] leading-relaxed text-slate-600 italic">
          {renderInline(line.replace(/^>\s?/, ''), citeMap, onCite, `q${i}`)}
        </blockquote>,
      );
    } else if (/^#{1,4}\s/.test(line)) {
      const headingClass = blocks.length === 0
        ? 'text-[13px] font-bold text-slate-900 leading-snug pb-2 mb-2 border-b border-slate-100'
        : 'text-[12.5px] font-bold text-slate-900 mt-2.5 mb-1';
      blocks.push(<div key={`h${i}`} className={headingClass}>{renderInline(line.replace(/^#{1,4}\s/, ''), citeMap, onCite, `h${i}`)}</div>);
    } else if (line.trim()) {
      const isRecall = line.trim().startsWith('💡');
      blocks.push(
        <p key={`p${i}`} className={isRecall ? 'mt-2.5 px-2.5 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11.5px]' : 'my-1.5 text-[12px] leading-[1.6] text-slate-700'}>
          {renderInline(line, citeMap, onCite, `p${i}`)}
        </p>,
      );
    }
    i += 1;
  }
  return <div className="leading-relaxed">{blocks}</div>;
}

/* ---------------------------------- component ---------------------------------- */
export function ChatBot({ day, focus, labId, inspectorOpen = false, hasMinimap = false, onJumpToConcept }) {
  const [open, setOpen] = useState(false);
  const storageKey = labId ? STORAGE_KEY + "/" + labId : STORAGE_KEY;
  const [messages, setMessages] = useState(() => loadStored(storageKey));
  const [input, setInput] = useState('');
  const [level, setLevel] = useState('standard');
  const [scopeDay, setScopeDay] = useState(false);
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => saveStored(storageKey, messages), [storageKey, messages]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send(text, overrideLevel) {
    const message = (text ?? input).trim();
    if (!message || loading) return;
    const lastBot = [...messages].reverse().find(m => m.role === 'assistant' && !m.error);
    const history = messages.filter(m => !m.error).slice(-MAX_HISTORY).map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history,
          level: overrideLevel || level,
          day: scopeDay ? day : null,
          lab_id: labId,
          focus_id: focus?.id || null,
          prev_citation_ids: (lastBot?.citations || []).map(c => c.id).slice(0, 4),
        }),
      });
      if (res.status === 429) {
        const errBody = await res.json().catch(() => ({}));
        setMessages(prev => [...prev, {
          role: 'assistant',
          error: true,
          content: `⏳ ${errBody.detail || 'Bạn đang gửi quá nhanh. Vui lòng đợi vài giây rồi thử lại nhé.'}`,
        }]);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages(prev => {
        const updated = data.sanitized_message
          ? prev.map((m, i) => (i === prev.length - 1 && m.role === 'user' ? { ...m, content: data.sanitized_message } : m))
          : prev;
        return [...updated, {
          role: 'assistant',
          content: data.answer,
          citations: data.citations,
          prerequisites: data.prerequisites,
          suggestions: data.suggestions,
          level: data.level,
          intent: data.intent,
          blocked: data.blocked,
          abstained: data.abstained,
          security: data.security,
          llmUsed: data.trace?.llm_used,
        }];
      });
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', error: true, content: `Không gọi được Gia sư AI (${err.message}). Thử lại sau nhé.` }]);
    } finally {
      setLoading(false);
    }
  }

  const starters = focus
    ? [
        `Giải thích "${focus.label}"`,
        `Cho ví dụ thực tế về ${focus.label}`,
        `Quiz 3 câu về ${focus.label}`,
      ]
    : [`Tóm tắt ngày ${day}`, 'RAG là gì?', 'So sánh Generative và Agentic AI', 'Lethal Trifecta là gì?'];

  const pillPositionClass = inspectorOpen
    ? 'right-4 bottom-4'
    : hasMinimap
      ? 'right-4 bottom-5 md:bottom-40'
      : 'right-4 bottom-5';

  const panelPositionClass = inspectorOpen
    ? 'right-4 md:right-[476px] bottom-24 h-[min(580px,calc(100vh-11rem))]'
    : hasMinimap
      ? 'right-4 bottom-5 md:bottom-40 h-[min(640px,calc(100vh-9rem))] md:h-[min(640px,calc(100vh-14rem))]'
      : 'right-4 bottom-5 h-[min(640px,calc(100vh-9rem))] md:h-[min(640px,calc(100vh-11rem))]';

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`fixed ${pillPositionClass} z-40 flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-xs font-semibold shadow-xl shadow-blue-500/30 hover:scale-[1.03] transition-all`}
        aria-label="Mở Gia sư AI"
      >
        <span className="text-base">🎓</span> Gia sư AI
        {focus && <span className="max-w-[120px] truncate bg-white/20 rounded-full px-2 py-0.5 text-[10px]">{focus.label}</span>}
      </button>
    );
  }

  return (
    <aside
      className={`fixed ${panelPositionClass} z-40 w-[min(420px,calc(100vw-2rem))] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs transition-all`}
      aria-label="Gia sư AI KG-RAG"
    >
      <div className="bg-gradient-to-r from-indigo-700 to-blue-700 px-4 py-2.5 text-white shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[13px] font-bold flex items-center gap-1.5">🎓 Gia sư AI <span className="text-[9px] font-semibold bg-white/20 px-1.5 py-0.5 rounded">KG-RAG</span></div>
            <div className="text-[10.5px] text-blue-100">Trả lời dựa trên Knowledge Graph · có trích nguồn</div>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setMessages([])} title="Xóa hội thoại" className="px-2 py-0.5 rounded-lg hover:bg-white/15 text-[11px]">↺</button>
            <button type="button" onClick={() => setOpen(false)} className="px-2 py-0.5 rounded-lg hover:bg-white/15 text-base font-bold">×</button>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex bg-white/15 rounded-lg p-0.5" role="radiogroup" aria-label="Độ khó giải thích">
            {LEVELS.map(l => (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={level === l.id}
                title={l.hint}
                onClick={() => setLevel(l.id)}
                className={`px-2 py-1 rounded-md text-[10.5px] font-medium transition ${level === l.id ? 'bg-white text-indigo-700 shadow' : 'text-white/90 hover:bg-white/10'}`}
              >
                {l.icon} {l.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1 text-[10.5px] text-blue-100 cursor-pointer select-none">
            <input type="checkbox" checked={scopeDay} onChange={e => setScopeDay(e.target.checked)} className="rounded border-white/40 text-indigo-600 w-3 h-3" />
            Chỉ Ngày {day}
          </label>
        </div>
      </div>

      {focus && (
        <div className="px-3 py-1.5 bg-indigo-50 border-b border-indigo-100 text-[10.5px] text-indigo-800 flex items-center gap-1.5 shrink-0">
          <span>📍 Đang xem:</span>
          <span className="font-semibold truncate">{focus.label}</span>
          <span className="text-indigo-400">· Ngày {focus.day}</span>
        </div>
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/60 select-text">
        {messages.length === 0 && (
          <div className="text-slate-500 space-y-2">
            <p>Hỏi mình bất kỳ khái niệm hay bài học nào trong 14 ngày. Mình sẽ giải thích theo độ khó bạn chọn và chỉ ra trang giáo trình tương ứng.</p>
            <div className="flex flex-wrap gap-1.5">
              {starters.map(s => (
                <button key={s} type="button" onClick={() => send(s)} className="px-2 py-1 rounded-full border border-slate-300 bg-white hover:border-indigo-400 hover:text-indigo-700 text-[11px]">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, idx) => (
          m.role === 'user' ? (
            <div key={idx} className="flex justify-end">
              <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-br-sm bg-indigo-600 text-white whitespace-pre-wrap">{m.content}</div>
            </div>
          ) : (
            <div key={idx} className="flex justify-start">
              <div className={`max-w-[92%] px-3.5 py-3 rounded-2xl rounded-bl-sm border shadow-sm ${m.error || m.blocked ? 'bg-rose-50 border-rose-200 text-rose-900' : m.abstained ? 'bg-amber-50 border-amber-200 text-slate-700' : 'bg-white border-slate-200 text-slate-700'}`}>
                {m.blocked && (
                  <div className="mb-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 border border-rose-200 text-rose-800 text-[10.5px] font-semibold">
                    🛡️ Guardrail đã chặn yêu cầu không an toàn
                  </div>
                )}
                {m.security?.redacted_types?.length > 0 && (
                  <div className="mb-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10.5px]">
                    🔒 Đã tự động ẩn thông tin nhạy cảm trước khi xử lý
                  </div>
                )}
                <Markdown text={m.content} citations={m.citations} onCite={c => onJumpToConcept?.(c.id, c.day)} />

                {m.prerequisites?.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-slate-500">🧱 Nên học trước:</span>
                    {m.prerequisites.map(p => (
                      <button key={p.id} type="button" onClick={() => send(`${p.label} là gì?`)} className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 transition">
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}

                {m.citations?.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5">
                    {m.citations.map(c => (
                      <button key={c.id} type="button" onClick={() => onJumpToConcept?.(c.id, c.day)} className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-indigo-50/70 border border-slate-200/70 text-[11px] text-slate-600 hover:text-indigo-700 transition">
                        <span className="shrink-0 px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-[10px] font-semibold">N{c.day}</span>
                        <span className="truncate font-medium">{c.label}</span>
                        {c.pdf_pages?.length > 0 && <span className="ml-auto shrink-0 text-[10px] text-slate-400">tr.{c.pdf_pages.join(',')}</span>}
                      </button>
                    ))}
                  </div>
                )}

                {!m.error && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {m.level !== 'eli5' && !m.abstained && (
                      <button type="button" onClick={() => send('Giải thích đơn giản hơn', 'eli5')} className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 hover:bg-amber-200 text-[10.5px] font-medium transition">🧒 Dễ hơn nữa</button>
                    )}
                    {(m.suggestions || []).filter(s => s !== 'Giải thích đơn giản hơn').map(s => (
                      <button key={s} type="button" onClick={() => send(s)} className="px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50 hover:border-indigo-300 hover:text-indigo-700 text-[10.5px] max-w-full truncate transition">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {m.llmUsed === false && !m.abstained && !m.error && (
                  <div className="mt-2 pt-1.5 border-t border-slate-100 text-[10px] text-slate-400">Chế độ offline · trích trực tiếp từ Knowledge Graph</div>
                )}
              </div>
            </div>
          )
        ))}

        {loading && (
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:120ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:240ms]" />
            Đang tra Knowledge Graph…
          </div>
        )}
      </div>

      <form className="p-2.5 border-t border-slate-200 flex gap-2 shrink-0 bg-white" onSubmit={e => { e.preventDefault(); send(); }}>
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          maxLength={2000}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={focus ? `Hỏi về "${focus.label}"…` : 'Ví dụ: Token Economy là gì?'}
          className="flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:ring-indigo-500"
        />
        <button type="submit" disabled={loading || !input.trim()} className="px-3 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-40 hover:bg-indigo-700">
          Gửi
        </button>
      </form>
    </aside>
  );
}
