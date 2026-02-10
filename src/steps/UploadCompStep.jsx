import { useRef, useState } from 'react';
import { useApp } from '../context/AppContext';

export default function UploadCompStep({ onNext, goBack }) {
  const { startCompExtraction } = useApp();
  const inputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  function handleFile(file) {
    if (file && file.type.startsWith('video/')) {
      startCompExtraction(file);
      onNext();
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }

  return (
    <div className="wizard-screen center-screen">
      <h1 className="hero-title">Got Your Video!</h1>

      <div
        className={`upload-zone ${isDragOver ? 'drag-over' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/*"
          onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
        />
        <div className="upload-label">📹 Upload Comparison Video</div>
        <div className="upload-hint">GoPro MP4 from coach or friend</div>
      </div>

      {goBack && (
        <button className="back-btn" onClick={goBack}>
          ← Back
        </button>
      )}
    </div>
  );
}

