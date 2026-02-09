import { useRef, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { computeMetrics, computeYawRate, findCompBounds, computeTimeDelta } from '../utils/analysis';

export default function MarkCourseStep({ onNext }) {
  const { yourVideo, compVideo, startTime, setStartTime, finishTime, setFinishTime, setAnalysis } = useApp();
  const videoRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [processing, setProcessing] = useState(false);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  }, []);

  function formatTime(s) {
    if (s == null) return '--:--:--';
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(2);
    return `${m}:${sec.padStart(5, '0')}`;
  }

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

      const yourMetrics = computeMetrics(yourGps, startCts, finishCts);
      const startGps = yourMetrics[0];
      const finishGps = yourMetrics[yourMetrics.length - 1];
      const compBounds = findCompBounds(compGps, startGps, finishGps);
      const compMetrics = computeMetrics(compGps, compBounds.startCts, compBounds.finishCts);

      const yourYawRate = computeYawRate(yourVideo.telemetry.gyro, startCts, finishCts);
      const compYawRate = computeYawRate(compVideo.telemetry.gyro, compBounds.startCts, compBounds.finishCts);

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

      onNext();
    } catch (err) {
      console.error(err);
      alert('Error analyzing: ' + err.message);
    }
    setProcessing(false);
  }

  return (
    <div className="wizard-screen">
      <h1 className="hero-title" style={{ fontSize: 28, marginBottom: 8 }}>Mark the Course</h1>
      <p className="hero-sub" style={{ marginBottom: 24 }}>Scrub through your video. Mark the start and finish line.</p>

      <div style={{ maxWidth: '80%', margin: '0 auto' }}>
        <video
          ref={videoRef}
          src={yourVideo?.url}
          controls
          onTimeUpdate={handleTimeUpdate}
          style={{ maxHeight: '60vh', width: '100%', objectFit: 'contain' }}
        />
        <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
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
          <button
            className={`marker-btn ${startTime != null && finishTime != null ? 'set' : ''}`}
            disabled={startTime == null || finishTime == null || processing}
            onClick={handleAnalyze}
          >
            {processing ? 'Analyzing...' : '🏎 Analyze Race'}
          </button>
        </div>
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

