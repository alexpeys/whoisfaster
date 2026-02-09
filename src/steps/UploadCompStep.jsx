import { useRef } from 'react';
import { useApp } from '../context/AppContext';

export default function UploadCompStep({ onNext }) {
  const { startCompExtraction } = useApp();
  const inputRef = useRef(null);

  function handleFile(file) {
    startCompExtraction(file);
    onNext();
  }

  return (
    <div className="wizard-screen center-screen">
      <h1 className="hero-title">Got Your Video!</h1>

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
        <div className="upload-label">Upload Comparison Video</div>
        <div className="upload-hint">GoPro MP4 from coach or friend</div>
      </div>
    </div>
  );
}

