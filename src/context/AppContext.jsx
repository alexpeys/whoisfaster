import { createContext, useContext, useState, useRef } from 'react';
import { extractTelemetry } from '../utils/telemetry';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [yourVideo, setYourVideo] = useState(null); // { file, url, telemetry }
  const [compVideo, setCompVideo] = useState(null);
  const [startTime, setStartTime] = useState(null); // seconds into your video
  const [finishTime, setFinishTime] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [raceMode, setRaceMode] = useState(null); // 'point2point' or 'circuit'
  const [yourSelectedLap, setYourSelectedLap] = useState(null); // { startCts, finishCts } for circuit mode
  const [compSelectedLap, setCompSelectedLap] = useState(null); // { startCts, finishCts } for circuit mode
  const [yourSelectedRun, setYourSelectedRun] = useState(null); // { startCts, finishCts } for point2point mode
  const [compSelectedRun, setCompSelectedRun] = useState(null); // { startCts, finishCts } for point2point mode

  // Background extraction tracking
  const [yourExtracting, setYourExtracting] = useState(false);
  const [compExtracting, setCompExtracting] = useState(false);
  const [extractError, setExtractError] = useState(null);
  const yourPromiseRef = useRef(null);
  const compPromiseRef = useRef(null);

  // FAQ state
  const [faqOpen, setFaqOpen] = useState(false);
  const [faqInitialQuestion, setFaqInitialQuestion] = useState(null);

  function startYourExtraction(file) {
    // Revoke old URL if it exists
    if (yourVideo?.url) {
      URL.revokeObjectURL(yourVideo.url);
    }
    const url = URL.createObjectURL(file);
    setYourVideo({ file, url, telemetry: null });
    setYourExtracting(true);
    setExtractError(null);
    const p = extractTelemetry(file, () => {})
      .then((telemetry) => {
        setYourVideo((prev) => ({ ...prev, telemetry }));
        setYourExtracting(false);
        return telemetry;
      })
      .catch((err) => {
        console.error('Telemetry extraction failed:', err);
        setYourExtracting(false);
        setExtractError('No GPS telemetry found. Make sure you\'re using an original GoPro file — re-encoding (e.g. via AirDrop or iCloud) strips the telemetry data.');
        throw err;
      });
    yourPromiseRef.current = p;
    return p;
  }

  function startCompExtraction(file) {
    // Revoke old URL if it exists
    if (compVideo?.url) {
      URL.revokeObjectURL(compVideo.url);
    }
    const url = URL.createObjectURL(file);
    setCompVideo({ file, url, telemetry: null });
    setCompExtracting(true);
    setExtractError(null);
    const p = extractTelemetry(file, () => {})
      .then((telemetry) => {
        setCompVideo((prev) => ({ ...prev, telemetry }));
        setCompExtracting(false);
        return telemetry;
      })
      .catch((err) => {
        console.error('Telemetry extraction failed:', err);
        setCompExtracting(false);
        setExtractError('No GPS telemetry found. Make sure you\'re using an original GoPro file — re-encoding (e.g. via AirDrop or iCloud) strips the telemetry data.');
        throw err;
      });
    compPromiseRef.current = p;
    return p;
  }

  async function waitForBothExtractions() {
    const promises = [];
    if (yourPromiseRef.current) promises.push(yourPromiseRef.current);
    if (compPromiseRef.current) promises.push(compPromiseRef.current);
    await Promise.all(promises);
  }

  function openFaq(questionId) {
    setFaqInitialQuestion(questionId);
    setFaqOpen(true);
  }

  function closeFaq() {
    setFaqOpen(false);
    setFaqInitialQuestion(null);
  }

  return (
    <AppContext.Provider value={{
      yourVideo, setYourVideo,
      compVideo, setCompVideo,
      startTime, setStartTime,
      finishTime, setFinishTime,
      analysis, setAnalysis,
      raceMode, setRaceMode,
      yourSelectedLap, setYourSelectedLap,
      compSelectedLap, setCompSelectedLap,
      yourSelectedRun, setYourSelectedRun,
      compSelectedRun, setCompSelectedRun,
      yourExtracting, compExtracting, extractError,
      startYourExtraction, startCompExtraction, waitForBothExtractions,
      faqOpen, faqInitialQuestion, openFaq, closeFaq,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}

