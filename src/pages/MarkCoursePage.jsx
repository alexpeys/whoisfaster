import { useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { computeMetrics, computeYawRate, findCompBounds, computeTimeDelta } from '../utils/analysis';

export default function MarkCoursePage() {
  const { yourVideo, compVideo, startTime, setStartTime, finishTime, setFinishTime, setAnalysis } = useApp();
  const videoRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [processing, setProcessing] = useState(false);
  const navigate = useNavigate();

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  }, []);

  function formatTime(s) {
    if (s == null) return '--:--:--';
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(2);
    return `${m}:${sec.padStart(5, '0')}`;
  }

  // Convert video time (seconds) to telemetry cts (ms).
  // GoPro GPS cts is ms from start of video.
  function videoTimeToCts(videoTimeSec) {
    return videoTimeSec * 1000;
  }

  async function handleAnalyze() {
    if (startTime == null || finishTime == null) return;
    setProcessing(true);

    try {
      const yourGps = yourVideo.telemetry.gps;
      const compGps = compVideo.telemetry.gps;
      const startCts = videoTimeToCts(startTime);
      const finishCts = videoTimeToCts(finishTime);

      // Compute metrics for your video
      const yourMetrics = computeMetrics(yourGps, startCts, finishCts);

      // Find where comparison crosses start/finish
      const startGps = yourMetrics[0];
      const finishGps = yourMetrics[yourMetrics.length - 1];
      const compBounds = findCompBounds(compGps, startGps, finishGps);
      const compMetrics = computeMetrics(compGps, compBounds.startCts, compBounds.finishCts);

      // Compute yaw rate from gyro
      const yourYawRate = computeYawRate(yourVideo.telemetry.gyro, startCts, finishCts);
      const compYawRate = computeYawRate(compVideo.telemetry.gyro, compBounds.startCts, compBounds.finishCts);

      // Compute time delta
      const timeDelta = computeTimeDelta(yourMetrics, compMetrics);

      setAnalysis({
        yourMetrics,
        compMetrics,
        yourYawRate,
        compYawRate,
        compBounds,
        timeDelta,
        startCts,
        finishCts,
        yourTotalTime: yourMetrics[yourMetrics.length - 1].raceTime,
        compTotalTime: compMetrics[compMetrics.length - 1].raceTime,
      });

      navigate('/analysis');
    } catch (err) {
      console.error(err);
      alert('Error analyzing: ' + err.message);
    }
    setProcessing(false);
  }

  if (!yourVideo?.url) {
    return (
      <div className="page">
        <h1>Mark Course</h1>
        <p className="subtitle">Please upload videos first.</p>
        <button onClick={() => navigate('/')}>← Back to Upload</button>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Mark the Course</h1>
      <p className="subtitle">Scrub through your video. Mark the start and finish line.</p>

      <div className="card">
        <video
          ref={videoRef}
          src={yourVideo.url}
          controls
          onTimeUpdate={handleTimeUpdate}
        />
        <div className="time-display" style={{ marginTop: 12 }}>
          Current: {formatTime(currentTime)}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className={`marker-btn ${startTime != null ? 'set' : ''}`}
            onClick={() => setStartTime(currentTime)}
          >
            🏁 Set Start Line {startTime != null ? `(${formatTime(startTime)})` : ''}
          </button>
          <button
            className={`marker-btn ${finishTime != null ? 'set' : ''}`}
            onClick={() => setFinishTime(currentTime)}
          >
            🏁 Set Finish Line {finishTime != null ? `(${formatTime(finishTime)})` : ''}
          </button>
        </div>
        {startTime != null && finishTime != null && (
          <p style={{ marginTop: 12, color: 'var(--green)', fontSize: 14 }}>
            Lap duration: {formatTime(finishTime - startTime)}
          </p>
        )}
      </div>

      <div className="step-nav">
        <button onClick={() => navigate('/')} style={{ background: 'var(--bg3)' }}>
          ← Back
        </button>
        <button
          disabled={startTime == null || finishTime == null || processing}
          onClick={handleAnalyze}
        >
          {processing ? 'Analyzing...' : 'Analyze Race →'}
        </button>
      </div>

      {processing && (
        <div className="loading-overlay">
          <div className="spinner" />
          <p>Crunching telemetry data...</p>
        </div>
      )}
    </div>
  );
}

