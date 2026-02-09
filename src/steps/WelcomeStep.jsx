import { useRef } from 'react';
import { useApp } from '../context/AppContext';

export default function WelcomeStep({ onNext }) {
  const { startYourExtraction } = useApp();
  const inputRef = useRef(null);

  function handleFile(file) {
    startYourExtraction(file);
    onNext();
  }

  return (
    <div className="wizard-screen center-screen">
      <h1 className="hero-title">WHO IS FASTER?</h1>
      <p className="hero-sub">Compare your GoPro race video against a coach or friend</p>

      <div
        className="upload-zone"
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/*"
          onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
        />
        <div className="upload-label">Attach Your GoPro Video</div>
        <div className="upload-hint">All processing is performed on your local device — videos are never uploaded anywhere</div>
      </div>
    </div>
  );
}

