import { useRef, useEffect, useState, useCallback } from 'react';

function computeDeltaDelta(timeDelta, windowSec = 5) {
  const result = [];
  for (let i = 0; i < timeDelta.length; i++) {
    let j = i;
    while (j > 0 && timeDelta[i].raceTime - timeDelta[j].raceTime < windowSec) j--;
    const dt = timeDelta[i].raceTime - timeDelta[j].raceTime;
    const dd = dt > 0.1 ? (timeDelta[i].delta - timeDelta[j].delta) / dt : 0;
    result.push(dd);
  }
  return result;
}

export default function CourseMap({ timeDelta, yourMetrics, onPointClick, selectedRaceTime }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const pointsRef = useRef([]);
  const deltaDeltaRef = useRef([]);

  // Interpolate speed from yourMetrics at a given raceTime
  function getSpeedAtRaceTime(raceTime) {
    if (!yourMetrics || yourMetrics.length === 0) return null;
    if (raceTime <= yourMetrics[0].raceTime) return yourMetrics[0].speedMph;
    if (raceTime >= yourMetrics[yourMetrics.length - 1].raceTime) return yourMetrics[yourMetrics.length - 1].speedMph;
    for (let i = 1; i < yourMetrics.length; i++) {
      if (yourMetrics[i].raceTime >= raceTime) {
        const m0 = yourMetrics[i - 1], m1 = yourMetrics[i];
        const t = (raceTime - m0.raceTime) / (m1.raceTime - m0.raceTime);
        return m0.speedMph + t * (m1.speedMph - m0.speedMph);
      }
    }
    return yourMetrics[yourMetrics.length - 1].speedMph;
  }

  const getProjection = useCallback((width, height) => {
    if (!timeDelta || timeDelta.length === 0) return null;
    const lats = timeDelta.map(d => d.lat);
    const lngs = timeDelta.map(d => d.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const pad = 40, w = width - pad * 2, h = height - pad * 2;
    const midLat = (minLat + maxLat) / 2;
    const cosLat = Math.cos(midLat * Math.PI / 180);
    const lngRange = (maxLng - minLng) * cosLat;
    const latRange = maxLat - minLat;
    const scale = Math.min(
      lngRange > 0 ? w / lngRange : w,
      latRange > 0 ? h / latRange : h
    );
    const cx = w / 2 + pad, cy = h / 2 + pad;
    const midLng = (minLng + maxLng) / 2;
    return (lat, lng) => [
      cx + (lng - midLng) * cosLat * scale,
      cy - (lat - midLat) * scale,
    ];
  }, [timeDelta]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !timeDelta || timeDelta.length < 2) return;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width, h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    const project = getProjection(w, h);
    if (!project) return;
    const dd = computeDeltaDelta(timeDelta);
    deltaDeltaRef.current = dd;
    const pts = timeDelta.map((d, i) => {
      const [x, y] = project(d.lat, d.lng);
      return { x, y, dd: dd[i], idx: i };
    });
    pointsRef.current = pts;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = 1; i < pts.length; i++) {
      const v = pts[i].dd;
      const intensity = Math.min(Math.abs(v) * 10, 1);
      ctx.strokeStyle = v < 0
        ? `rgba(59, 130, 246, ${0.3 + intensity * 0.7})`
        : `rgba(239, 68, 68, ${0.3 + intensity * 0.7})`;
      ctx.beginPath();
      ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
      ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
    const sp = pts[0], ep = pts[pts.length - 1];
    ctx.fillStyle = '#fff';
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillText('START', sp.x + 8, sp.y - 8);
    ctx.fillText('FINISH', ep.x + 8, ep.y - 8);
    ctx.beginPath(); ctx.arc(sp.x, sp.y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ep.x, ep.y, 5, 0, Math.PI * 2); ctx.fill();
    if (hoveredIdx != null && pts[hoveredIdx]) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(pts[hoveredIdx].x, pts[hoveredIdx].y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (selectedRaceTime != null) {
      let bestIdx = 0, bestDiff = Infinity;
      for (let i = 0; i < timeDelta.length; i++) {
        const diff = Math.abs(timeDelta[i].raceTime - selectedRaceTime);
        if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
      }
      if (pts[bestIdx]) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pts[bestIdx].x, pts[bestIdx].y, 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }, [timeDelta, getProjection, hoveredIdx, selectedRaceTime]);

  function handleMouseMove(e) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const pts = pointsRef.current;
    let bestIdx = null, bestDist = 20;
    for (let i = 0; i < pts.length; i++) {
      const dx = pts[i].x - mx, dy = pts[i].y - my;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    setHoveredIdx(bestIdx);
    canvas.style.cursor = bestIdx != null ? 'pointer' : 'crosshair';
  }

  function handleClick() {
    if (hoveredIdx != null && timeDelta[hoveredIdx]) {
      onPointClick(timeDelta[hoveredIdx]);
    }
  }

  const hd = hoveredIdx != null ? timeDelta[hoveredIdx] : null;
  const hdd = hoveredIdx != null ? deltaDeltaRef.current[hoveredIdx] : null;
  const hdSpeed = hd ? getSpeedAtRaceTime(hd.raceTime) : null;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIdx(null)} onClick={handleClick}
        style={{ display: 'block', width: '100%', height: '100%' }} />
      {hd && (
        <div style={{ position: 'absolute', top: 8, right: 8, background: '#111',
          border: '1px solid #333', borderRadius: 4, padding: '8px 12px',
          color: '#fff', fontSize: 12, pointerEvents: 'none' }}>
          <p style={{ margin: 0 }}>Dist: {(hd.dist * 0.000621371).toFixed(3)} mi</p>
          <p style={{ margin: 0, color: '#888' }}>Time: {hd.raceTime.toFixed(2)}s</p>
          <p style={{ margin: 0, color: '#888' }}>Delta: {hd.delta.toFixed(3)}s</p>
          {hdSpeed != null && <p style={{ margin: 0, color: '#888' }}>Speed: {hdSpeed.toFixed(1)} mph</p>}
          <p style={{ margin: 0, color: hdd < 0 ? '#3b82f6' : '#ef4444' }}>
            {hdd < 0 ? 'Gaining' : 'Losing'} ({Math.abs(hdd || 0).toFixed(3)}s/s)
          </p>
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 8, left: 8,
        display: 'flex', gap: 16, fontSize: 12 }}>
        <span style={{ color: '#3b82f6' }}>■ GAINING</span>
        <span style={{ color: '#ef4444' }}>■ LOSING</span>
      </div>
    </div>
  );
}
