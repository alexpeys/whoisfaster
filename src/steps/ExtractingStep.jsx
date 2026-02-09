import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';

export default function ExtractingStep({ onNext }) {
  const { yourExtracting, compExtracting, extractError, waitForBothExtractions } = useApp();
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

