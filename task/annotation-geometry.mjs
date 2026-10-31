// Geometry is deliberately independent of image content or answer correctness.
const MAX_POINTS = 128;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const finitePoint = point => point && Number.isFinite(point.x) && Number.isFinite(point.y);
const clamp = value => Math.max(0, Math.min(1, value));

/** Return a bounded copy of a broadly closed freehand loop, never a click/line. */
export function normalizeStroke(points) {
  if (!Array.isArray(points) || points.length < 6 || !points.every(finitePoint)) return null;
  const sampled = points.length <= MAX_POINTS ? points : Array.from({ length: MAX_POINTS },
    (_, i) => points[Math.round(i * (points.length - 1) / (MAX_POINTS - 1))]);
  const clean = [];
  for (const point of sampled) {
    const normalized = { x: clamp(point.x), y: clamp(point.y) };
    if (!clean.length || distance(clean.at(-1), normalized) > .0005) clean.push(normalized);
  }
  if (clean.length < 6) return null;
  let minX = 1, minY = 1, maxX = 0, maxY = 0, length = 0, doubleArea = 0;
  for (let i = 0; i < clean.length; i++) {
    const a = clean[i], b = clean[(i + 1) % clean.length];
    minX = Math.min(minX, a.x); maxX = Math.max(maxX, a.x);
    minY = Math.min(minY, a.y); maxY = Math.max(maxY, a.y);
    doubleArea += a.x * b.y - b.x * a.y;
    if (i + 1 < clean.length) length += distance(a, b);
  }
  const width = maxX - minX, height = maxY - minY;
  const area = Math.abs(doubleArea) / 2;
  // The display closes the endpoint gap; analysis uses these bounded raw samples.
  if (width < .012 || height < .012 || length < .06 || area < .00015 ||
      area / (width * height) < .08) return null;
  return clean;
}
export function smoothPath(points,closed=false){
 if(!points.length)return '';const xy=p=>`${(p.x*1000).toFixed(2)} ${(p.y*1000).toFixed(2)}`;
 let d=`M ${xy(points[0])}`;
 for(let i=0;i<points.length-1;i++){const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(points.length-1,i+2)];
 d+=` C ${xy({x:p1.x+(p2.x-p0.x)/6,y:p1.y+(p2.y-p0.y)/6})} ${xy({x:p2.x-(p3.x-p1.x)/6,y:p2.y-(p3.y-p1.y)/6})} ${xy(p2)}`;}
 return d+(closed?' Z':'');
}

/** Ray casting with boundary points included. The polygon is implicitly closed. */
export function pointInPolygon(point, points) {
  if (!finitePoint(point) || !Array.isArray(points) || points.length < 3 || !points.every(finitePoint)) return false;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[j], b = points[i];
    const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
    if (Math.abs(cross) < 1e-10 && point.x >= Math.min(a.x, b.x) - 1e-10 &&
        point.x <= Math.max(a.x, b.x) + 1e-10 && point.y >= Math.min(a.y, b.y) - 1e-10 &&
        point.y <= Math.max(a.y, b.y) + 1e-10) return true;
    if ((a.y > point.y) !== (b.y > point.y) &&
        point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Unique reference-center hits, not a verified recognition-accuracy measure. */
export function matchRegions(marks = [], regions = []) {
  const polygons = marks.map(mark => normalizeStroke(mark?.points)).filter(Boolean);
  return [...new Set(regions.filter(region => {
    const box = region?.box;
    return box && [box.x, box.y, box.w, box.h].every(Number.isFinite) && box.w >= 0 && box.h >= 0 &&
      polygons.some(points => pointInPolygon({ x: box.x + box.w / 2, y: box.y + box.h / 2 }, points));
  }).map(region => region.id))];
}
