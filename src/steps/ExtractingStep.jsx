import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';

export default function ExtractingStep({ onNext, onReset }) {
  const { yourExtracting, compExtracting, extractError, waitForBothExtractions, openFaq } = useApp();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    waitForBothExtractions()
      .then(() => onNext())
      .catch(() => setFailed(true));
  }, []);

  if (failed || extractError) {
    return (
      <div className="wizard-screen center-screen">
        <h1 className="hero-title">WHO IS FASTER?</h1>
        <p className="error-msg">⚠ {extractError || 'Extraction failed. Files may have been re-encoded by AirDrop/iCloud.'}</p>
        <div className="error-actions" style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={onReset} style={{ background: 'var(--bg3)' }}>
            Start Over
          </button>
          <button onClick={() => openFaq('no-gps')} style={{ background: 'var(--bg3)' }}>
            Why is this happening?
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wizard-screen center-screen">
      <h1 className="hero-title">WHO IS FASTER?</h1>
      <div className="spinner" />
      <p className="extract-msg">Extracting telemetry... this may take a minute</p>
    </div>
  );
}

