import React, { useRef } from 'react';

const MAX_POSITION = 4096;
const MAX_NODES = 20;
const clamp = value => Math.max(0, Math.min(MAX_POSITION, Math.round(value)));

export function Mindmap({ nodes, onChange }) {
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
    }]);
  }

  function addInView() {
    const { scrollLeft, scrollTop, clientWidth } = viewport.current;
    const columns = Math.max(1, Math.floor((clientWidth - 48) / 184));
    const slots = Array.from({ length: MAX_NODES }, (_, index) => ({
      x: clamp(scrollLeft + 24 + index % columns * 184),
      y: clamp(scrollTop + 24 + Math.floor(index / columns) * 104),
    }));
    const { x, y } = slots.find(slot => !nodes.some(node => (
      Math.abs(node.x - slot.x) < 164 && Math.abs(node.y - slot.y) < 98
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
                <line key={node.id} x1={parent.x + 82} y1={parent.y + 44}
                  x2={node.x + 82} y2={node.y + 44} />
              );
            })}
          </svg>
          {nodes.map((node, index) => (
            <div key={node.id} className="node" style={{ left: node.x, top: node.y }}>
              <div className="node-top">
                <span className="drag-handle" aria-hidden="true" onPointerDown={event => startDrag(event, node)}
                  onPointerMove={event => moveDrag(event, node)}
                  onLostPointerCapture={() => { drag.current = null; }}>⠿</span>
                <textarea aria-label={`Nội dung ý ${index + 1}`} placeholder="Nhập ý tưởng"
                  rows={node.text.length > 120 || node.text.includes('\n') ? 3 : 1}
                  ref={input => {
                    if (input && newNode.current === node.id) {
                      newNode.current = null;
                      input.focus();
                    }
                  }}
                  maxLength={20000} value={node.text}
                  onChange={event => update(node.id, { text: event.target.value })} />
                <button type="button" className="remove" aria-label={`Xóa ý ${index + 1}`}
                  onClick={() => remove(node.id)}>×</button>
              </div>
              <select aria-label={`Nối ý ${index + 1} với`} value={node.parent_id ?? ''}
                onChange={event => update(node.id, { parent_id: event.target.value || null })}>
                <option value="">Nối với…</option>
                {nodes.map((target, targetIndex) => (
                  canLink(node, target) && <option key={target.id} value={target.id}>
                    {target.text.trim().slice(0, 80) || `Ý ${targetIndex + 1}`}
                  </option>
                ))}
              </select>
            </div>
          ))}
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
