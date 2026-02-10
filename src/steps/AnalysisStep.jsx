import { useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import CourseMap from '../components/CourseMap';

export default function AnalysisStep() {
  const { yourVideo, compVideo, analysis, startTime, finishTime } = useApp();
  const videoRef = useRef(null);
  const [activeTab, setActiveTab] = useState('map');
  const [videoMode, setVideoMode] = useState('you'); // 'you' or 'comp'
  const [seekPoint, setSeekPoint] = useState(null); // { you: sec, comp: sec }
  const [showVideo, setShowVideo] = useState(false);
  const hoveredPoint = useRef(null);

  if (!analysis) return null;

  const { yourMetrics, compMetrics, yourYawRate, compYawRate, timeDelta, yourTotalTime, compTotalTime, compBounds } = analysis;
  const finalDelta = timeDelta.length > 0 ? timeDelta[timeDelta.length - 1].delta : 0;
  const compStartSec = compBounds.startCts / 1000;

  function seekVideo(videoEl, timeSec) {
    if (!videoEl) return;
    videoEl.currentTime = timeSec;
    videoEl.pause();
  }

  // Custom tooltip — captures hovered data point
  function renderTooltip({ active, payload, label }) {
    if (active && payload && payload.length > 0) {
      hoveredPoint.current = payload[0].payload;
      const pt = payload[0].payload;
      return (
        <div style={{ background: '#111', border: '1px solid #333', borderRadius: 4, padding: '8px 12px', color: '#fff' }}>
          <p style={{ margin: 0, fontSize: 12 }}>Distance: {label} mi</p>
          {pt.raceTime != null && <p style={{ margin: 0, fontSize: 12, color: '#888' }}>Race Time: {pt.raceTime}s</p>}
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

    let closest = timeDelta[0];
    let minDiff = Infinity;
    for (const d of timeDelta) {
      const diff = Math.abs(d.raceTime - raceTime);
      if (diff < minDiff) { minDiff = diff; closest = d; }
    }

    const youTime = startTime + closest.raceTime;
    const compTime = closest.compCts / 1000;
    setSeekPoint({ you: youTime, comp: compTime });
    setShowVideo(true);

    // Seek whichever video is currently showing
    setTimeout(() => {
      seekVideo(videoRef.current, videoMode === 'you' ? youTime : compTime);
    }, 100);
  }

  function handleToggle(newMode) {
    setVideoMode(newMode);
    if (seekPoint) {
      setTimeout(() => {
        seekVideo(videoRef.current, newMode === 'you' ? seekPoint.you : seekPoint.comp);
      }, 50);
    }
  }

  // Meters to miles
  const M_TO_MI = 0.000621371;

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

  // Chart data
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

  const yawStep = Math.max(1, Math.floor(yourYawRate.length / 500));
  const yawData = [];
  for (let i = 0; i < yourYawRate.length; i += yawStep) {
    const yr = yourYawRate[i];
    const dMi = distAtRaceTime(yourMetrics, yr.raceTime);
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

  // Compute acceleration from speed data with moving average smoothing
  function computeAcceleration(metrics) {
    if (metrics.length < 2) return [];
    const accel = [];
    for (let i = 0; i < metrics.length - 1; i++) {
      const dt = metrics[i + 1].raceTime - metrics[i].raceTime;
      const dv = metrics[i + 1].speedMph - metrics[i].speedMph;
      accel.push(dt > 0.01 ? dv / dt : 0);
    }
    accel.push(accel[accel.length - 1] || 0);
    // Apply moving average (window=5)
    const smoothed = [];
    for (let i = 0; i < accel.length; i++) {
      let sum = 0, count = 0;
      for (let j = Math.max(0, i - 2); j <= Math.min(accel.length - 1, i + 2); j++) {
        sum += accel[j];
        count++;
      }
      smoothed.push(sum / count);
    }
    return smoothed;
  }

  const yourAccel = computeAcceleration(yourMetrics);
  const compAccel = computeAcceleration(compMetrics);

  const accelData = yourMetrics.map((ym, i) => ({
    distMi: +(ym.dist * M_TO_MI).toFixed(3),
    raceTime: +ym.raceTime.toFixed(2),
    yourAccel: +yourAccel[i].toFixed(2),
    compAccel: compMetrics[Math.min(i, compMetrics.length - 1)]
      ? +compAccel[Math.min(i, compMetrics.length - 1)].toFixed(2)
      : 0,
  }));

  const tabs = [
    { key: 'map', label: 'Course Map' },
    { key: 'delta', label: 'Time Delta' },
    { key: 'speed', label: 'Speed' },
    { key: 'accel', label: 'Accel' },
    { key: 'yaw', label: 'Yaw Rate' },
  ];

  // Handle map point click — same as chart click
  function handleMapPointClick(point) {
    let closest = timeDelta[0];
    let minDiff = Infinity;
    for (const d of timeDelta) {
      const diff = Math.abs(d.raceTime - point.raceTime);
      if (diff < minDiff) { minDiff = diff; closest = d; }
    }
    const youTime = startTime + closest.raceTime;
    const compTime = closest.compCts / 1000;
    setSeekPoint({ you: youTime, comp: compTime });
    setShowVideo(true);
    setTimeout(() => {
      seekVideo(videoRef.current, videoMode === 'you' ? youTime : compTime);
    }, 100);
  }

  // Determine video src + trimming
  const yourSrc = `${yourVideo?.url}#t=${startTime},${finishTime}`;
  const compFinishSec = compBounds.finishCts / 1000;
  const compSrc = `${compVideo?.url}#t=${compStartSec},${compFinishSec}`;
  const currentSrc = videoMode === 'you' ? yourSrc : compSrc;
  const currentSeek = seekPoint ? (videoMode === 'you' ? seekPoint.you : seekPoint.comp) : null;

  return (
    <div className="wizard-screen" style={{ padding: '24px 24px 48px' }}>
      {/* Stats bar */}
      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-lbl">Your Lap Time</span>
          <span className="stat-val">{yourTotalTime.toFixed(2)}s</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-lbl">Their Lap Time</span>
          <span className="stat-val">{compTotalTime.toFixed(2)}s</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-lbl">You are</span>
          <span className="stat-val" style={{ color: finalDelta > 0 ? 'var(--red)' : '#22c55e' }}>
            {finalDelta > 0 ? '+' : ''}{finalDelta.toFixed(2)}s {finalDelta > 0 ? 'slower' : 'faster'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Legend — only for speed/accel/yaw */}
      {(activeTab === 'speed' || activeTab === 'accel' || activeTab === 'yaw') && (
        <div className="chart-legend">
          <span className="legend-you">● YOU</span>
          <span className="legend-comp">● COMPARISON</span>
        </div>
      )}

      {/* Course Map */}
      {activeTab === 'map' && (
        <div style={{ cursor: 'crosshair' }}>
          <div className="chart-container" style={{ height: 400 }}>
            <CourseMap
              timeDelta={timeDelta}
              yourMetrics={yourMetrics}
              onPointClick={handleMapPointClick}
              selectedRaceTime={seekPoint ? (seekPoint.you - startTime) : null}
            />
          </div>
          <div className="chart-cta">
            👆 CLICK ANYWHERE ON THE MAP TO SEE THIS MOMENT ON VIDEO
          </div>
        </div>
      )}

      {/* Charts */}
      {activeTab !== 'map' && (
        <div className="chart-card" onClick={handleChartWrapperClick} style={{ cursor: 'crosshair' }}>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              {activeTab === 'delta' ? (
                <LineChart data={deltaData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis dataKey="distMi" stroke="#555" fontSize={11} label={{ value: 'Distance (mi)', position: 'bottom', fill: '#555' }} />
                  <YAxis stroke="#555" fontSize={11} label={{ value: 'Delta (s)', angle: -90, position: 'left', fill: '#555' }} />
                  <Tooltip content={renderTooltip} />
                  <ReferenceLine y={0} stroke="#444" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="delta" stroke="#fff" strokeWidth={2} dot={false} name="Time Delta (s)" />
                </LineChart>
              ) : activeTab === 'speed' ? (
                <LineChart data={speedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis dataKey="distMi" stroke="#555" fontSize={11} label={{ value: 'Distance (mi)', position: 'bottom', fill: '#555' }} />
                  <YAxis stroke="#555" fontSize={11} />
                  <Tooltip content={renderTooltip} />
                  <Line type="monotone" dataKey="yourSpeed" stroke="var(--blue)" strokeWidth={2} dot={false} name="You (mph)" />
                  <Line type="monotone" dataKey="compSpeed" stroke="var(--red)" strokeWidth={2} dot={false} name="Comparison (mph)" />
                </LineChart>
              ) : activeTab === 'accel' ? (
                <LineChart data={accelData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis dataKey="distMi" stroke="#555" fontSize={11} label={{ value: 'Distance (mi)', position: 'bottom', fill: '#555' }} />
                  <YAxis stroke="#555" fontSize={11} label={{ value: 'Acceleration (mph/s)', angle: -90, position: 'left', fill: '#555' }} />
                  <Tooltip content={renderTooltip} />
                  <ReferenceLine y={0} stroke="#444" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="yourAccel" stroke="var(--blue)" strokeWidth={2} dot={false} name="You (mph/s)" />
                  <Line type="monotone" dataKey="compAccel" stroke="var(--red)" strokeWidth={2} dot={false} name="Comparison (mph/s)" />
                </LineChart>
              ) : (
                <LineChart data={yawData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis dataKey="distMi" stroke="#555" fontSize={11} label={{ value: 'Distance (mi)', position: 'bottom', fill: '#555' }} />
                  <YAxis stroke="#555" fontSize={11} />
                  <Tooltip content={renderTooltip} />
                  <ReferenceLine y={0} stroke="#444" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="yourYaw" stroke="var(--blue)" strokeWidth={2} dot={false} name="You (°/s)" />
                  <Line type="monotone" dataKey="compYaw" stroke="var(--red)" strokeWidth={2} dot={false} name="Comparison (°/s)" />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
          <div className="chart-cta">
            👆 CLICK ANYWHERE ON THE GRAPH TO SEE THIS MOMENT ON VIDEO
          </div>
        </div>
      )}

      {/* Video popup — only shown after clicking a chart point */}
      {showVideo && (
        <div className="video-popup">
          <div className="video-popup-inner">
            <div className="video-popup-header">
              <div className="video-toggle">
                <button
                  className={`toggle-btn ${videoMode === 'you' ? 'active you' : ''}`}
                  onClick={() => handleToggle('you')}
                >
                  YOU
                </button>
                <button
                  className={`toggle-btn ${videoMode === 'comp' ? 'active comp' : ''}`}
                  onClick={() => handleToggle('comp')}
                >
                  COMPARISON
                </button>
              </div>
              <button className="close-btn" onClick={() => setShowVideo(false)}>✕</button>
            </div>
            <video
              key={videoMode}
              ref={videoRef}
              src={currentSrc}
              controls
              onLoadedMetadata={() => {
                if (videoRef.current && currentSeek != null) {
                  videoRef.current.currentTime = currentSeek;
                }
              }}
            />
          </div>
        </div>
      )}

    </div>
  );
}

