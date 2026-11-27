import React, { useRef } from 'react';

const MAX_POSITION = 4096;
const MAX_NODES = 100;
const clamp = value => Math.max(0, Math.min(MAX_POSITION, Math.round(value)));

const TYPE_LABELS = {
  day_root: 'Ngày học',
  concept: 'Khái niệm',
  pattern: 'Kiến trúc',
  metric: 'Chỉ số',
  trap: 'Bẫy / Lỗi',
  case_study: 'Case Study',
  checkpoint: 'Checkpoint',
  code_ref: 'Code Lab',
  note: 'Ghi chú',
};

function formatBadge(node) {
  const parts = [];
  if (node.node_type && TYPE_LABELS[node.node_type]) {
    parts.push(TYPE_LABELS[node.node_type]);
  }
  if (node.source_ref?.day) {
    const pages = node.source_ref.pdf_pages?.join(',');
    parts.push(pages ? `D${node.source_ref.day}·tr.${pages}` : `D${node.source_ref.day}`);
  } else if (node.code_link?.file_path) {
    const shortFile = node.code_link.file_path.split('/').slice(-1)[0];
    parts.push(shortFile);
  }
  if (node.verification_status === 'verified') {
    parts.push('✓');
  }
  return parts.join(' · ');
}

export function Mindmap({ nodes, selectedId, onSelect, onChange, onOpenMapper, onReset }) {
  const viewport = useRef(null);
  const drag = useRef(null);
  const pan = useRef(null);
  const newNode = useRef(null);
  const byId = new Map(nodes.map(node => [node.id, node]));

  function update(id, changes) {
    onChange(nodes.map(node => node.id === id ? { ...node, ...changes } : node));
  }

  function add(x, y) {
    if (nodes.length >= MAX_NODES) return;
    const id = globalThis.crypto?.randomUUID?.() ?? makeId();
    newNode.current = id;
    onChange([...nodes, {
      id,
      text: '',
      x: clamp(x),
      y: clamp(y),
      parent_id: null,
      node_type: 'note',
      source_ref: null,
      code_link: null,
      verification_status: 'user_note',
    }]);
    onSelect?.(id);
  }

  function addInView() {
    const { scrollLeft, scrollTop, clientWidth } = viewport.current;
    const columns = Math.max(1, Math.floor((clientWidth - 48) / 280));
    const slots = Array.from({ length: MAX_NODES }, (_, index) => ({
      x: clamp(scrollLeft + 24 + index % columns * 280),
      y: clamp(scrollTop + 24 + Math.floor(index / columns) * 160),
    }));
    const { x, y } = slots.find(slot => !nodes.some(node => (
      Math.abs(node.x - slot.x) < 230 && Math.abs(node.y - slot.y) < 130
    ))) ?? slots[0];
    add(x, y);
  }

  function addAtPointer(event) {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    add(event.clientX - bounds.left, event.clientY - bounds.top);
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
  }

  function remove(id) {
    if (selectedId === id) onSelect?.(null);
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
    if (event.button !== 0) return;
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
      x: clamp(start.x + event.clientX - start.startX),
      y: clamp(start.y + event.clientY - start.startY),
    });
  }

  return (
    <section className="map-panel" aria-label="Sơ đồ tư duy">
      <div className="map-tools">
        <button type="button" onClick={addInView} disabled={nodes.length >= MAX_NODES}>+ Thêm ý</button>
        <button type="button" className="accent-btn" onClick={onOpenMapper}>AI Lecture-to-Lab Map</button>
        <button type="button" onClick={onReset} title="Khôi phục bản Knowledge Graph chuẩn của ngày này">
          Khôi phục KG chuẩn
        </button>
        <span className="node-count">{nodes.length}/{MAX_NODES} nút</span>
      </div>
      <div className="map-scroll" ref={viewport} tabIndex={0} aria-label="Canvas sơ đồ tư duy">
        <div className="map-board" onDoubleClick={addAtPointer} onPointerDown={startPan}
          onPointerMove={movePan} onLostPointerCapture={event => {
            if (event.target === event.currentTarget) pan.current = null;
          }}>
          <svg className="connections" aria-hidden="true">
            {nodes.map(node => {
              const parent = byId.get(node.parent_id);
              return parent && (
                <line key={node.id} x1={parent.x + 125} y1={parent.y + 52}
                  x2={node.x + 125} y2={node.y + 52} />
              );
            })}
          </svg>
          {nodes.map((node, index) => {
            const typeClass = `node-type-${node.node_type || 'note'}`;
            const isSelected = selectedId === node.id;
            const badge = formatBadge(node);
            return (
              <div
                key={node.id}
                className={`node ${typeClass}${isSelected ? ' is-selected' : ''}`}
                style={{ left: node.x, top: node.y }}
                onClick={() => onSelect?.(node.id)}
              >
                {badge && (
                  <div className="node-badge">
                    <span>{badge}</span>
                  </div>
                )}
                <div className="node-top">
                  <span className="drag-handle" aria-hidden="true" onPointerDown={event => startDrag(event, node)}
                    onPointerMove={event => moveDrag(event, node)}
                    onLostPointerCapture={() => { drag.current = null; }}>⠿</span>
                  <textarea aria-label={`Nội dung ý ${index + 1}`} placeholder="Nhập ý tưởng"
                    rows={node.text.length > 100 || node.text.includes('\n') ? 3 : 2}
                    ref={input => {
                      if (input && newNode.current === node.id) {
                        newNode.current = null;
                        input.focus();
                      }
                    }}
                    maxLength={20000} value={node.text}
                    onChange={event => update(node.id, { text: event.target.value })} />
                  <button type="button" className="remove" aria-label={`Xóa ý ${index + 1}`}
                    onClick={e => { e.stopPropagation(); remove(node.id); }}>×</button>
                </div>
                <select aria-label={`Nối ý ${index + 1} với`} value={node.parent_id ?? ''}
                  onChange={event => update(node.id, { parent_id: event.target.value || null })}>
                  <option value="">Nối với…</option>
                  {nodes.map((target, targetIndex) => (
                    canLink(node, target) && <option key={target.id} value={target.id}>
                      {target.text.trim().slice(0, 60) || `Ý ${targetIndex + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
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
