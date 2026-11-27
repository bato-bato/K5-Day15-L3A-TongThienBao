import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 1.2;
const clampZoom = zoom => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));

function moveCamera(camera, from, to, zoomFactor = 1) {
  const zoom = clampZoom(camera.zoom * zoomFactor);
  const ratio = zoom / camera.zoom;
  return {
    x: to.x - (from.x - camera.x) * ratio,
    y: to.y - (from.y - camera.y) * ratio,
    zoom,
  };
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function useMindmapViewport(layout, { viewKey, layoutTrigger, bottomInset, onBackgroundPointerDown }) {
  const viewport = useRef(null);
  const pointers = useRef(new Map());
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 0.88 });
  const [size, setSize] = useState({ width: 0, height: 0 });

  function fitToView() {
    const { clientWidth, clientHeight } = viewport.current;
    if (!layout.nodes.length || !clientWidth || !clientHeight) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of layout.nodes) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    }
    const contentWidth = Math.max(600, maxX - minX + 128);
    const contentHeight = Math.max(380, maxY - minY + 128);
    const zoom = clampZoom(Math.min(1.05, (clientWidth - 40) / contentWidth, (clientHeight - 110) / contentHeight));
    setCamera({
      x: (clientWidth - (minX + maxX) * zoom) / 2,
      y: (clientHeight - bottomInset - (minY + maxY) * zoom) / 2,
      zoom,
    });
  }

  function centerView(root) {
    if (!root) return;
    const { clientWidth, clientHeight } = viewport.current;
    setCamera(current => ({
      x: clientWidth / 2 - (root.x + root.width / 2) * current.zoom,
      y: clientHeight / 2 - (root.y + root.height / 2) * current.zoom,
      zoom: current.zoom,
    }));
  }

  useLayoutEffect(() => {
    fitToView();
    // Refitting on node edits would pull the canvas away from the current branch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey, layoutTrigger]);

  useEffect(() => {
    const element = viewport.current;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();

    function handleWheel(event) {
      event.preventDefault();
      const bounds = element.getBoundingClientRect();
      const anchor = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1;
      const factor = Math.exp(-event.deltaY * unit * (event.ctrlKey ? 0.01 : 0.002));
      setCamera(current => moveCamera(current, anchor, anchor, factor));
    }

    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      observer.disconnect();
      element.removeEventListener('wheel', handleWheel);
    };
  }, []);

  function stepZoom(direction) {
    const { clientWidth, clientHeight } = viewport.current;
    const center = { x: clientWidth / 2, y: clientHeight / 2 };
    setCamera(current => moveCamera(current, center, center, ZOOM_STEP ** direction));
  }

  function onPointerDown(event) {
    const background = event.target === event.currentTarget || event.target.hasAttribute('data-mindmap-layer');
    const touch = event.pointerType === 'touch';
    const active = pointers.current;
    if (event.button !== 0 || (!background && !touch) || active.size >= 2) return;

    const element = event.currentTarget;
    active.set(event.pointerId, { x: event.clientX, y: event.clientY, pan: background });
    if (active.size === 2) {
      for (const [id, point] of active) {
        point.pan = true;
        element.setPointerCapture(id);
      }
    } else if (background) {
      onBackgroundPointerDown?.();
      element.focus({ preventScroll: true });
      element.setPointerCapture(event.pointerId);
    }
    if (background || active.size === 2) element.dataset.panning = 'true';
  }

  function onPointerMove(event) {
    const active = pointers.current;
    const previous = active.get(event.pointerId);
    if (!previous) return;
    const next = { x: event.clientX, y: event.clientY, pan: previous.pan };
    active.set(event.pointerId, next);
    if (!next.pan) return;

    if (active.size === 1) {
      const dx = next.x - previous.x;
      const dy = next.y - previous.y;
      setCamera(current => ({ ...current, x: current.x + dx, y: current.y + dy }));
      return;
    }

    const other = [...active.entries()].find(([id]) => id !== event.pointerId)[1];
    const bounds = event.currentTarget.getBoundingClientRect();
    const from = midpoint(previous, other);
    const to = midpoint(next, other);
    for (const point of [from, to]) {
      point.x -= bounds.left;
      point.y -= bounds.top;
    }
    const oldDistance = Math.hypot(previous.x - other.x, previous.y - other.y);
    const newDistance = Math.hypot(next.x - other.x, next.y - other.y);
    const factor = newDistance / Math.max(1, oldDistance);
    setCamera(current => moveCamera(current, from, to, factor));
  }

  function endPointer(event) {
    if (event.type === 'lostpointercapture' && event.target !== event.currentTarget) return;
    pointers.current.delete(event.pointerId);
    if (!pointers.current.size) delete event.currentTarget.dataset.panning;
  }

  function onKeyDown(event) {
    if (event.target !== event.currentTarget) return;
    if (event.key === '+' || event.key === '=' || event.key === '-') {
      event.preventDefault();
      stepZoom(event.key === '-' ? -1 : 1);
      return;
    }
    const shifts = { ArrowUp: [0, 48], ArrowDown: [0, -48], ArrowLeft: [48, 0], ArrowRight: [-48, 0] };
    const shift = shifts[event.key];
    if (!shift) return;
    event.preventDefault();
    setCamera(current => ({ ...current, x: current.x + shift[0], y: current.y + shift[1] }));
  }

  function onFocus(event) {
    const element = event.currentTarget;
    if (event.target === element || !event.target.matches(':focus-visible')) return;
    const frame = element.getBoundingClientRect();
    const node = event.target.getBoundingClientRect();
    if (node.right > frame.left && node.left < frame.right && node.bottom > frame.top && node.top < frame.bottom) return;
    const dx = (frame.left + frame.right - node.left - node.right) / 2;
    const dy = (frame.top + frame.bottom - node.top - node.bottom) / 2;
    setCamera(current => ({ ...current, x: current.x + dx, y: current.y + dy }));
  }

  const { x, y, zoom } = camera;
  return {
    zoom,
    stepZoom,
    fitToView,
    centerView,
    viewportProps: {
      ref: viewport,
      style: { backgroundPosition: `${x}px ${y}px` },
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
      onLostPointerCapture: endPointer,
      onKeyDown,
      onFocus,
    },
    layerStyle: {
      width: layout.canvasW,
      height: layout.canvasH,
      transform: `translate(${x}px, ${y}px) scale(${zoom})`,
    },
    minimapStyle: {
      left: `${(-x / zoom / layout.canvasW) * 100}%`,
      top: `${(-y / zoom / layout.canvasH) * 100}%`,
      width: `${(size.width / zoom / layout.canvasW) * 100}%`,
      height: `${(size.height / zoom / layout.canvasH) * 100}%`,
    },
  };
}
