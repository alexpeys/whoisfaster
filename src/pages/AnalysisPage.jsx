import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';

export default function AnalysisPage() {
  const { yourVideo, compVideo, analysis, startTime, finishTime } = useApp();
  const yourVidRef = useRef(null);
  const compVidRef = useRef(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [activeTab, setActiveTab] = useState('delta');
  const navigate = useNavigate();

  // Ref to track the currently hovered chart data point
  const hoveredPoint = useRef(null);

  if (!analysis) {
    return (
      <div className="page">
        <h1>Analysis</h1>
        <p className="subtitle">No analysis data yet.</p>
        <button onClick={() => navigate('/mark')}>← Mark Course First</button>
      </div>
    );
  }

  const { yourMetrics, compMetrics, yourYawRate, compYawRate, timeDelta, yourTotalTime, compTotalTime, compBounds } = analysis;
  const finalDelta = timeDelta.length > 0 ? timeDelta[timeDelta.length - 1].delta : 0;

  // Comp video start/finish in seconds
  const compStartSec = compBounds.startCts / 1000;
  const compFinishSec = compBounds.finishCts / 1000;

  function seekVideo(videoEl, timeSec) {
    if (!videoEl) return;
    videoEl.currentTime = timeSec;
    videoEl.pause();
  }

  // Custom tooltip that captures the hovered data point into our ref
  function renderTooltip({ active, payload, label }) {
    if (active && payload && payload.length > 0) {
      hoveredPoint.current = payload[0].payload;
      const pt = payload[0].payload;
      return (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)' }}>
          <p style={{ margin: 0, fontSize: 12 }}>Distance: {label} mi</p>
          {pt.raceTime != null && <p style={{ margin: 0, fontSize: 12, color: 'var(--text2)' }}>Race Time: {pt.raceTime}s</p>}
          {payload.map((p, i) => (
            <p key={i} style={{ margin: 0, fontSize: 12, color: p.color }}>{p.name}: {p.value}</p>
          ))}
        </div>
      );
    }
    return null;
  }

  function handleChartWrapperClick() {
    const point = hoveredPoint.current;
    if (!point) return;
    const raceTime = point.raceTime;

    // Find the closest delta entry for this race time
    let closest = timeDelta[0];
    let minDiff = Infinity;
    for (const d of timeDelta) {
      const diff = Math.abs(d.raceTime - raceTime);
      if (diff < minDiff) { minDiff = diff; closest = d; }
    }
    setSelectedPoint(closest);

    // Your video: startTime (seconds) + raceTime (seconds) = absolute video time
    seekVideo(yourVidRef.current, startTime + closest.raceTime);
    // Comp video: compCts is absolute CTS in ms
    seekVideo(compVidRef.current, closest.compCts / 1000);
  }

  // Meters to miles conversion
  const M_TO_MI = 0.000621371;

  // Helper: interpolate distance (miles) for a given raceTime from GPS metrics
  function distAtRaceTime(metrics, raceTime) {
    if (metrics.length === 0) return 0;
    if (raceTime <= metrics[0].raceTime) return metrics[0].dist * M_TO_MI;
    if (raceTime >= metrics[metrics.length - 1].raceTime) return metrics[metrics.length - 1].dist * M_TO_MI;
    for (let i = 1; i < metrics.length; i++) {
      if (metrics[i].raceTime >= raceTime) {
        const m0 = metrics[i - 1], m1 = metrics[i];
        const t = (raceTime - m0.raceTime) / (m1.raceTime - m0.raceTime);
        return (m0.dist + t * (m1.dist - m0.dist)) * M_TO_MI;
      }
    }
    return metrics[metrics.length - 1].dist * M_TO_MI;
  }

  // Prepare chart data — X axis is distance in miles
  const deltaData = timeDelta.map((d) => ({
    ...d,
    distMi: +(d.dist * M_TO_MI).toFixed(3),
    raceTime: +d.raceTime.toFixed(2),
    delta: +d.delta.toFixed(3),
  }));

  const speedData = yourMetrics.map((ym, i) => ({
    distMi: +(ym.dist * M_TO_MI).toFixed(3),
    raceTime: +ym.raceTime.toFixed(2),
    yourSpeed: +ym.speedMph.toFixed(1),
    compSpeed: compMetrics[Math.min(i, compMetrics.length - 1)]
      ? +compMetrics[Math.min(i, compMetrics.length - 1)].speedMph.toFixed(1)
      : 0,
  }));

  // Build yaw rate data — gyro samples are much denser than GPS,
  // so downsample to ~500 points for a readable chart
  const yawStep = Math.max(1, Math.floor(yourYawRate.length / 500));
  const yawData = [];
  for (let i = 0; i < yourYawRate.length; i += yawStep) {
    const yr = yourYawRate[i];
    // Interpolate distance from GPS metrics for this gyro sample's raceTime
    const dMi = distAtRaceTime(yourMetrics, yr.raceTime);
    // Find closest comp yaw rate by race time
    let compVal = 0;
    if (compYawRate.length > 0) {
      let best = 0, bestDiff = Infinity;
      for (let j = 0; j < compYawRate.length; j++) {
        const diff = Math.abs(compYawRate[j].raceTime - yr.raceTime);
        if (diff < bestDiff) { bestDiff = diff; best = j; }
      }
      compVal = compYawRate[best].yawRate;
    }
    yawData.push({
      distMi: +dMi.toFixed(3),
      raceTime: +yr.raceTime.toFixed(2),
      yourYaw: +yr.yawRate.toFixed(1),
      compYaw: +compVal.toFixed(1),
    });
  }

  const tabs = [
    { key: 'delta', label: '⏱ Time Delta' },
    { key: 'speed', label: '💨 Speed' },
    { key: 'yaw', label: '🔄 Yaw Rate' },
  ];

  return (
    <div className="page">
      <h1>Race Analysis</h1>
      <p className="subtitle">Click on any chart point to compare videos at that moment</p>

      {/* Summary stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Your Lap Time</div>
          <div className="stat-value">{yourTotalTime.toFixed(2)}s</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Coach Lap Time</div>
          <div className="stat-value">{compTotalTime.toFixed(2)}s</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Gap</div>
          <div className="stat-value" style={{ color: finalDelta > 0 ? 'var(--accent2)' : 'var(--green)' }}>
            {finalDelta > 0 ? '+' : ''}{finalDelta.toFixed(3)}s
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Max Speed (You)</div>
          <div className="stat-value">
            {Math.max(...yourMetrics.map((m) => m.speedMph)).toFixed(1)} mph
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              background: activeTab === t.key ? 'var(--accent)' : 'var(--bg3)',
              fontSize: 13, padding: '8px 16px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Charts — click anywhere on the chart to seek videos */}
      <div className="card" onClick={handleChartWrapperClick} style={{ cursor: 'crosshair' }}>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            {activeTab === 'delta' ? (
              <LineChart data={deltaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="distMi" stroke="var(--text2)" fontSize={11} label={{ value: 'Distance (mi)', position: 'bottom', fill: 'var(--text2)' }} />
                <YAxis stroke="var(--text2)" fontSize={11} label={{ value: 'Delta (s)', angle: -90, position: 'left', fill: 'var(--text2)' }} />
                <Tooltip content={renderTooltip} />
                <ReferenceLine y={0} stroke="var(--text2)" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="delta" stroke="var(--accent2)" strokeWidth={2} dot={false} name="Time Delta (s)" />
              </LineChart>
            ) : activeTab === 'speed' ? (
              <LineChart data={speedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="distMi" stroke="var(--text2)" fontSize={11} label={{ value: 'Distance (mi)', position: 'bottom', fill: 'var(--text2)' }} />
                <YAxis stroke="var(--text2)" fontSize={11} />
                <Tooltip content={renderTooltip} />
                <Line type="monotone" dataKey="yourSpeed" stroke="var(--accent)" strokeWidth={2} dot={false} name="You (mph)" />
                <Line type="monotone" dataKey="compSpeed" stroke="var(--accent2)" strokeWidth={2} dot={false} name="Coach (mph)" />
              </LineChart>
            ) : (
              <LineChart data={yawData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="distMi" stroke="var(--text2)" fontSize={11} label={{ value: 'Distance (mi)', position: 'bottom', fill: 'var(--text2)' }} />
                <YAxis stroke="var(--text2)" fontSize={11} />
                <Tooltip content={renderTooltip} />
                <ReferenceLine y={0} stroke="var(--text2)" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="yourYaw" stroke="var(--accent)" strokeWidth={2} dot={false} name="You (°/s)" />
                <Line type="monotone" dataKey="compYaw" stroke="var(--accent2)" strokeWidth={2} dot={false} name="Coach (°/s)" />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Selected point info */}
      {selectedPoint && (
        <div className="card" style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>
            Race Time: <strong>{selectedPoint.raceTime?.toFixed(2) || selectedPoint.raceTime}s</strong>
            {selectedPoint.delta != null && (
              <> | Delta: <strong style={{ color: selectedPoint.delta > 0 ? 'var(--accent2)' : 'var(--green)' }}>
                {selectedPoint.delta > 0 ? '+' : ''}{(typeof selectedPoint.delta === 'number' ? selectedPoint.delta : 0).toFixed(3)}s
              </strong></>
            )}
          </p>
        </div>
      )}

      {/* Video comparison */}
      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 16 }}>📹 Video Comparison</h3>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
          Click a point on any chart above to sync both videos to that moment. Your video shows your position; the coach video shows when they were at the same spot.
        </p>
        <div className="video-compare">
          <div>
            <div className="video-label yours">Your Video</div>
            <video
              ref={yourVidRef}
              src={`${yourVideo?.url}#t=${startTime},${finishTime}`}
              controls
              onLoadedMetadata={() => { if (yourVidRef.current) yourVidRef.current.currentTime = startTime; }}
            />
          </div>
          <div>
            <div className="video-label coach">Coach Video</div>
            <video
              ref={compVidRef}
              src={`${compVideo?.url}#t=${compStartSec},${compFinishSec}`}
              controls
              onLoadedMetadata={() => { if (compVidRef.current) compVidRef.current.currentTime = compStartSec; }}
            />
          </div>
        </div>
      </div>

      <div className="step-nav">
        <button onClick={() => navigate('/mark')} style={{ background: 'var(--bg3)' }}>
          ← Back to Course
        </button>
      </div>
    </div>
  );
}

