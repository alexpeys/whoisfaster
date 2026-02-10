import { useRef, useState, useCallback, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { computeMetrics, computeYawRate, findCompBounds, computeTimeDelta, detectLapCrossings, findLaps, detectRuns } from '../utils/analysis';

export default function MarkCourseStep({ onNext, goBack }) {
  const {
    yourVideo, compVideo, startTime, setStartTime, finishTime, setFinishTime, setAnalysis,
    raceMode, yourSelectedLap, setYourSelectedLap, compSelectedLap, setCompSelectedLap,
    yourSelectedRun, setYourSelectedRun, compSelectedRun, setCompSelectedRun
  } = useApp();
  const videoRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [processing, setProcessing] = useState(false);

  // Circuit mode state
  const [circuitStartPoint, setCircuitStartPoint] = useState(null); // { lat, lng, cts }
  const [yourLaps, setYourLaps] = useState([]);
  const [compLaps, setCompLaps] = useState([]);
  const [selectedLapNumber, setSelectedLapNumber] = useState(null);
  const [includedLaps, setIncludedLaps] = useState(new Set()); // Set of lap numbers to include

  // Point-to-point mode state
  const [yourRuns, setYourRuns] = useState([]);
  const [compRuns, setCompRuns] = useState([]);
  const [selectedRunNumber, setSelectedRunNumber] = useState(null);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  }, []);

  // Frame step helper
  const stepFrame = useCallback((direction) => {
    if (videoRef.current) {
      const frameTime = 0.033; // ~30fps
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime + (direction * frameTime));
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't capture if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const key = e.key.toLowerCase();

      if (key === 'arrowleft') {
        e.preventDefault();
        stepFrame(-1);
      } else if (key === 'arrowright') {
        e.preventDefault();
        stepFrame(1);
      } else if (key === 's') {
        e.preventDefault();
        if (raceMode !== 'circuit') {
          setStartTime(currentTime);
        } else {
          handleSetCircuitStartPoint();
        }
      } else if (key === 'f') {
        e.preventDefault();
        if (raceMode !== 'circuit') {
          setFinishTime(currentTime);
        }
      } else if (key === ' ') {
        e.preventDefault();
        if (videoRef.current) {
          if (videoRef.current.paused) {
            videoRef.current.play();
          } else {
            videoRef.current.pause();
          }
        }
      } else if (key === 'enter') {
        e.preventDefault();
        if (raceMode !== 'circuit' && startTime != null && finishTime != null) {
          handleAnalyze();
        } else if (raceMode === 'circuit' && selectedLapNumber != null) {
          const yourLap = yourLaps.find(l => l.lapNumber === selectedLapNumber);
          const compLap = compLaps.find(l => l.lapNumber === selectedLapNumber);
          if (yourLap && compLap) {
            setYourSelectedLap({ startCts: yourLap.startCts, finishCts: yourLap.finishCts });
            setCompSelectedLap({ startCts: compLap.startCts, finishCts: compLap.finishCts });
            handleAnalyze();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, raceMode, startTime, finishTime, selectedLapNumber, yourLaps, compLaps, stepFrame]);

  function formatTime(s) {
    if (s == null) return '--:--:--';
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(2);
    return `${m}:${sec.padStart(5, '0')}`;
  }

  function videoTimeToCts(videoTimeSec) {
    return videoTimeSec * 1000;
  }

  function handleSetCircuitStartPoint() {
    if (!yourVideo?.telemetry?.gps) return;

    const cts = videoTimeToCts(currentTime);
    // Find GPS sample closest to current time
    const gps = yourVideo.telemetry.gps;
    let closest = gps[0];
    let minDiff = Math.abs(gps[0].cts - cts);

    for (let i = 1; i < gps.length; i++) {
      const diff = Math.abs(gps[i].cts - cts);
      if (diff < minDiff) {
        minDiff = diff;
        closest = gps[i];
      }
    }

    setCircuitStartPoint({ lat: closest.lat, lng: closest.lng, cts: closest.cts });

    // Auto-detect laps for both videos
    const yourCrossings = detectLapCrossings(yourVideo.telemetry.gps, closest.lat, closest.lng);
    const compCrossings = detectLapCrossings(compVideo.telemetry.gps, closest.lat, closest.lng);

    const yourLapsData = findLaps(yourVideo.telemetry.gps, yourCrossings);
    const compLapsData = findLaps(compVideo.telemetry.gps, compCrossings);

    setYourLaps(yourLapsData);
    setCompLaps(compLapsData);

    // By default, exclude first and last laps (warmup/cooldown)
    const defaultIncluded = new Set();
    for (let i = 1; i < yourLapsData.length - 1; i++) {
      defaultIncluded.add(i + 1); // lap numbers are 1-indexed
    }
    setIncludedLaps(defaultIncluded);

    // Auto-select first included lap
    if (defaultIncluded.size > 0) {
      setSelectedLapNumber(Math.min(...defaultIncluded));
    }
  }

  function toggleLapInclusion(lapNumber) {
    const newIncluded = new Set(includedLaps);
    if (newIncluded.has(lapNumber)) {
      newIncluded.delete(lapNumber);
    } else {
      newIncluded.add(lapNumber);
    }
    setIncludedLaps(newIncluded);

    // If selected lap was removed, pick another
    if (!newIncluded.has(selectedLapNumber) && newIncluded.size > 0) {
      setSelectedLapNumber(Math.min(...newIncluded));
    }
  }

  async function handleAnalyze() {
    // Point-to-point mode
    if (raceMode !== 'circuit') {
      if (startTime == null || finishTime == null) return;

      // If runs haven't been detected yet, detect them first
      if (yourRuns.length === 0 && compRuns.length === 0) {
        try {
          const yourGps = yourVideo.telemetry.gps;
          const compGps = compVideo.telemetry.gps;
          const startCts = videoTimeToCts(startTime);
          const finishCts = videoTimeToCts(finishTime);

          // Get start/finish GPS coordinates from your video
          const yourMetrics = computeMetrics(yourGps, startCts, finishCts);
          const startGps = yourMetrics[0];
          const finishGps = yourMetrics[yourMetrics.length - 1];

          // Detect runs in both videos
          const detectedYourRuns = detectRuns(yourGps, startGps.lat, startGps.lng, finishGps.lat, finishGps.lng);
          const detectedCompRuns = detectRuns(compGps, startGps.lat, startGps.lng, finishGps.lat, finishGps.lng);

          setYourRuns(detectedYourRuns);
          setCompRuns(detectedCompRuns);

          // If multiple runs detected, show selector UI (don't proceed to analysis yet)
          if (detectedYourRuns.length > 1 || detectedCompRuns.length > 1) {
            // Default to fastest run (shortest duration)
            const fastestYourRun = detectedYourRuns.reduce((min, run) =>
              run.durationSec < min.durationSec ? run : min
            );
            const fastestCompRun = detectedCompRuns.reduce((min, run) =>
              run.durationSec < min.durationSec ? run : min
            );
            setSelectedRunNumber(fastestYourRun.runNumber);
            setYourSelectedRun({ startCts: fastestYourRun.startCts, finishCts: fastestYourRun.finishCts });
            setCompSelectedRun({ startCts: fastestCompRun.startCts, finishCts: fastestCompRun.finishCts });
            return; // Show UI for user to select runs
          }

          // Single run detected, proceed with analysis
          if (detectedYourRuns.length === 1 && detectedCompRuns.length === 1) {
            setSelectedRunNumber(1);
            setYourSelectedRun({ startCts: detectedYourRuns[0].startCts, finishCts: detectedYourRuns[0].finishCts });
            setCompSelectedRun({ startCts: detectedCompRuns[0].startCts, finishCts: detectedCompRuns[0].finishCts });
            // Fall through to analysis below
          }
        } catch (err) {
          console.error(err);
          alert('Error detecting runs: ' + err.message);
          return;
        }
      }

      // Proceed with analysis using selected run bounds
      if (!yourSelectedRun || !compSelectedRun) return;
      setProcessing(true);

      try {
        const yourGps = yourVideo.telemetry.gps;
        const compGps = compVideo.telemetry.gps;
        const startCts = yourSelectedRun.startCts;
        const finishCts = yourSelectedRun.finishCts;

        const yourMetrics = computeMetrics(yourGps, startCts, finishCts);
        const compMetrics = computeMetrics(compGps, compSelectedRun.startCts, compSelectedRun.finishCts);

        const yourYawRate = computeYawRate(yourVideo.telemetry.gyro, startCts, finishCts);
        const compYawRate = computeYawRate(compVideo.telemetry.gyro, compSelectedRun.startCts, compSelectedRun.finishCts);

        const timeDelta = computeTimeDelta(yourMetrics, compMetrics);

        setAnalysis({
          yourMetrics,
          compMetrics,
          yourYawRate,
          compYawRate,
          compBounds: { startCts: compSelectedRun.startCts, finishCts: compSelectedRun.finishCts },
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
      return;
    }

    // Circuit mode
    if (!selectedLapNumber || !yourSelectedLap || !compSelectedLap) return;
    setProcessing(true);

    try {
      const yourGps = yourVideo.telemetry.gps;
      const compGps = compVideo.telemetry.gps;
      const startCts = yourSelectedLap.startCts;
      const finishCts = yourSelectedLap.finishCts;

      const yourMetrics = computeMetrics(yourGps, startCts, finishCts);
      const compMetrics = computeMetrics(compGps, compSelectedLap.startCts, compSelectedLap.finishCts);

      const yourYawRate = computeYawRate(yourVideo.telemetry.gyro, startCts, finishCts);
      const compYawRate = computeYawRate(compVideo.telemetry.gyro, compSelectedLap.startCts, compSelectedLap.finishCts);

      const timeDelta = computeTimeDelta(yourMetrics, compMetrics);

      setAnalysis({
        yourMetrics,
        compMetrics,
        yourYawRate,
        compYawRate,
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

  // Point-to-point mode UI
  if (raceMode !== 'circuit') {
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
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', justifyContent: 'center' }}>
            <button className="frame-btn" onClick={() => stepFrame(-1)}>◀ Frame</button>
            <button className="frame-btn" onClick={() => stepFrame(1)}>Frame ▶</button>
          </div>
          <div className="keyboard-hint">Keyboard: ← → frame step | S start | F finish | Space play/pause | Enter analyze</div>
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

          {/* Run selector UI - shown when multiple runs detected */}
          {yourRuns.length > 1 && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ marginBottom: 16, fontSize: 18 }}>Multiple Runs Detected</h3>

              <div style={{ marginBottom: 24 }}>
                <h4 style={{ marginBottom: 12, fontSize: 14, fontWeight: 600 }}>Your Video</h4>
                <div className="lap-list">
                  {yourRuns.map((run) => (
                    <div key={run.runNumber} className="lap-item">
                      <label className="lap-checkbox-label">
                        <input
                          type="radio"
                          name="your-run"
                          value={run.runNumber}
                          checked={selectedRunNumber === run.runNumber}
                          onChange={() => {
                            setSelectedRunNumber(run.runNumber);
                            setYourSelectedRun({ startCts: run.startCts, finishCts: run.finishCts });
                          }}
                          className="lap-checkbox"
                        />
                        <span className="lap-text">
                          Run {run.runNumber}: {Math.floor(run.durationSec / 60)}:{(run.durationSec % 60).toFixed(2).padStart(5, '0')}
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <h4 style={{ marginBottom: 12, fontSize: 14, fontWeight: 600 }}>Comparison Video</h4>
                <div className="lap-list">
                  {compRuns.map((run) => (
                    <div key={run.runNumber} className="lap-item">
                      <label className="lap-checkbox-label">
                        <input
                          type="radio"
                          name="comp-run"
                          value={run.runNumber}
                          checked={compRuns.findIndex(r => r.runNumber === run.runNumber) === compRuns.findIndex(r => r.startCts === compSelectedRun?.startCts)}
                          onChange={() => {
                            setCompSelectedRun({ startCts: run.startCts, finishCts: run.finishCts });
                          }}
                          className="lap-checkbox"
                        />
                        <span className="lap-text">
                          Run {run.runNumber}: {Math.floor(run.durationSec / 60)}:{(run.durationSec % 60).toFixed(2).padStart(5, '0')}
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  className="marker-btn"
                  onClick={() => {
                    setYourRuns([]);
                    setCompRuns([]);
                    setSelectedRunNumber(null);
                    setYourSelectedRun(null);
                    setCompSelectedRun(null);
                  }}
                >
                  ← Change Start/Finish
                </button>
                <button
                  className={`marker-btn ${selectedRunNumber != null ? 'set' : ''}`}
                  disabled={selectedRunNumber == null || processing}
                  onClick={handleAnalyze}
                >
                  {processing ? 'Analyzing...' : '🏎 Analyze Race'}
                </button>
              </div>
            </div>
          )}

          {goBack && (
            <button className="back-btn" onClick={goBack} style={{ marginTop: 24 }}>
              ← Back
            </button>
          )}
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

  // Circuit mode UI
  return (
    <div className="wizard-screen">
      <h1 className="hero-title" style={{ fontSize: 28, marginBottom: 8 }}>Mark the Circuit</h1>
      <p className="hero-sub" style={{ marginBottom: 24 }}>Scrub through your video. Mark the start/finish line.</p>

      <div style={{ maxWidth: '80%', margin: '0 auto' }}>
        <video
          ref={videoRef}
          src={yourVideo?.url}
          controls
          onTimeUpdate={handleTimeUpdate}
          style={{ maxHeight: '60vh', width: '100%', objectFit: 'contain' }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', justifyContent: 'center' }}>
          <button className="frame-btn" onClick={() => stepFrame(-1)}>◀ Frame</button>
          <button className="frame-btn" onClick={() => stepFrame(1)}>Frame ▶</button>
        </div>
        <div className="keyboard-hint">Keyboard: ← → frame step | S set start/finish | Space play/pause | Enter analyze</div>

        {!circuitStartPoint ? (
          <div style={{ marginTop: 12 }}>
            <button
              className="marker-btn set"
              onClick={handleSetCircuitStartPoint}
            >
              🏁 Set Start/Finish Line
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ marginBottom: 16, fontSize: 18 }}>Detected Laps</h3>
            <div className="lap-list">
              {yourLaps.map((lap) => (
                <div key={lap.lapNumber} className="lap-item">
                  <label className="lap-checkbox-label">
                    <input
                      type="checkbox"
                      checked={includedLaps.has(lap.lapNumber)}
                      onChange={() => toggleLapInclusion(lap.lapNumber)}
                      className="lap-checkbox"
                    />
                    <span className="lap-text">
                      Lap {lap.lapNumber}: {Math.floor(lap.durationSec / 60)}:{(lap.durationSec % 60).toFixed(2).padStart(5, '0')}
                    </span>
                  </label>
                  <input
                    type="radio"
                    name="selected-lap"
                    value={lap.lapNumber}
                    checked={selectedLapNumber === lap.lapNumber}
                    onChange={() => setSelectedLapNumber(lap.lapNumber)}
                    disabled={!includedLaps.has(lap.lapNumber)}
                    className="lap-radio"
                  />
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                className="marker-btn"
                onClick={() => setCircuitStartPoint(null)}
              >
                ← Change Start/Finish
              </button>
              <button
                className={`marker-btn ${selectedLapNumber != null ? 'set' : ''}`}
                disabled={selectedLapNumber == null || processing}
                onClick={() => {
                  // Set selected lap bounds for both videos
                  const yourLap = yourLaps.find(l => l.lapNumber === selectedLapNumber);
                  const compLap = compLaps.find(l => l.lapNumber === selectedLapNumber);
                  if (yourLap && compLap) {
                    setYourSelectedLap({ startCts: yourLap.startCts, finishCts: yourLap.finishCts });
                    setCompSelectedLap({ startCts: compLap.startCts, finishCts: compLap.finishCts });
                    handleAnalyze();
                  }
                }}
              >
                {processing ? 'Analyzing...' : '🏎 Analyze Lap'}
              </button>
            </div>
          </div>
        )}

        {goBack && (
          <button className="back-btn" onClick={goBack} style={{ marginTop: 24 }}>
            ← Back
          </button>
        )}
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

