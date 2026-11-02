import { normalizeStroke, smoothPath } from './annotation-geometry.mjs?v=20261102-rules1';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_CAPTURE_POINTS = 768;
const clamp = value => Math.max(0, Math.min(1, value));
const pathData = points => smoothPath(points,true);

/** Owns only freehand SVG paths and pointer listeners, never reference answers. */
export function mountAnnotationSurface(svg, { marks = [], onStroke = () => {}, onNotice = () => {} } = {}) {
  const doc = svg.ownerDocument;
  const win = doc.defaultView;
  const subscriptions = [];
  const completedPaths = [];
  const previousTouchAction = svg.style.touchAction;
  let retainedMarks = [];
  let active = null;
  let disposed = false;
  svg.setAttribute('viewBox', '0 0 1000 1000');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.style.touchAction = 'none';

  function listen(target, type, handler) {
    target.addEventListener(type, handler);
    subscriptions.push(() => target.removeEventListener(type, handler));
  }
  function createPath(points, draft = false) {
    const path = doc.createElementNS(SVG_NS, 'path');
    path.setAttribute('class', draft ? 'annotation-draft' : 'annotation-mark');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#ffcf33');
    path.setAttribute('stroke-width', '4');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    path.setAttribute('pointer-events', 'none');
    path.setAttribute('d', pathData(points));
    svg.appendChild(path);
    return path;
  }
  function setMarks(nextMarks = []) {
    if (disposed) return;
    retainedMarks = nextMarks.map(mark => ({ ...mark, points: normalizeStroke(mark?.points) })).filter(mark => mark.points);
    completedPaths.splice(0).forEach(path => path.remove());
    retainedMarks.forEach(mark => completedPaths.push(createPath(mark.points)));
  }
  function release(pointerId) {
    try {
      if (svg.hasPointerCapture(pointerId)) svg.releasePointerCapture(pointerId);
    } catch { /* Capture may already have been released by the browser. */ }
  }
  function cancel() {
    if (!active) return;
    const cancelled = active;
    active = null;
    cancelled.path.remove();
    release(cancelled.pointerId);
  }
  function eventPoint(event) {
    const rect = svg.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0) || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null;
    return { x: clamp((event.clientX - rect.left) / rect.width), y: clamp((event.clientY - rect.top) / rect.height) };
  }
  function appendPoint(event) {
    const point = eventPoint(event);
    if (!point) return;
    const last = active.points.at(-1);
    if (last && Math.hypot(last.x - point.x, last.y - point.y) < .0015) return;
    if (active.points.length >= MAX_CAPTURE_POINTS) {
      active.points = active.points.filter((_, index) => index % 2 === 0);
    }
    active.points.push(point);
    active.path.setAttribute('d', pathData(active.points));
  }
  function start(event) {
    if (disposed || active || svg.dataset.ready !== 'true' || event.isPrimary === false || event.button !== 0) return;
    const point = eventPoint(event);
    if (!point || doc.hidden) return;
    event.preventDefault();
    active = { pointerId: event.pointerId, inputMethod: ['mouse', 'touch', 'pen'].includes(event.pointerType) ? event.pointerType : 'mouse',
      startedAt: Number.isFinite(event.timeStamp) ? event.timeStamp : 0, points: [point], path: createPath([point], true) };
    try { svg.setPointerCapture(event.pointerId); } catch { cancel(); }
  }
  function move(event) {
    if (!active || event.pointerId !== active.pointerId) return;
    if (svg.dataset.ready !== 'true' || event.isPrimary === false || doc.hidden) { cancel(); return; }
    event.preventDefault();
    appendPoint(event);
  }
  function finish(event) {
    if (!active || event.pointerId !== active.pointerId) return;
    if (svg.dataset.ready !== 'true' || event.isPrimary === false || doc.hidden || event.button !== 0) { cancel(); return; }
    event.preventDefault();
    appendPoint(event);
    const completed = active;
    active = null;
    completed.path.remove();
    release(completed.pointerId);
    const points = normalizeStroke(completed.points);
    if (!points) { onNotice('请按住并拖动，画出大致闭合的圈；点击或线段不计为圈画。'); return; }
    const mark = { points, inputMethod: completed.inputMethod,
      durationMs: Math.max(0, (Number.isFinite(event.timeStamp) ? event.timeStamp : completed.startedAt) - completed.startedAt) };
    setMarks([...retainedMarks, mark]);
    onStroke(mark);
  }
  listen(svg, 'pointerdown', start);
  listen(svg, 'pointermove', move);
  listen(svg, 'pointerup', finish);
  for (const type of ['pointercancel', 'lostpointercapture']) listen(svg, type, event => {
    if (active && event.pointerId === active.pointerId) cancel();
  });
  listen(win, 'blur', cancel);
  listen(doc, 'visibilitychange', () => { if (doc.hidden || doc.visibilityState === 'hidden') cancel(); });
  listen(doc, 'keydown', event => { if (event.key === 'Escape') cancel(); });
  setMarks(marks);
  return { setMarks, cancel, dispose() {
    if (disposed) return;
    cancel();
    disposed = true;
    subscriptions.splice(0).forEach(unsubscribe => unsubscribe());
    completedPaths.splice(0).forEach(path => path.remove());
    retainedMarks = [];
    svg.style.touchAction = previousTouchAction;
  } };
}
