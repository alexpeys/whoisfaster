import { useRef, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { computeMetrics, computeYawRate, findCompBounds, computeTimeDelta, detectLapCrossings, findLaps } from '../utils/analysis';

export default function MarkCourseStep({ onNext, goBack }) {
  const {
    yourVideo, compVideo, startTime, setStartTime, finishTime, setFinishTime, setAnalysis,
    raceMode, yourSelectedLap, setYourSelectedLap, compSelectedLap, setCompSelectedLap
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

