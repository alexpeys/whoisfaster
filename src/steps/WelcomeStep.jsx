import { useRef, useState } from 'react';
import { useApp } from '../context/AppContext';

export default function WelcomeStep({ onNext }) {
  const { startYourExtraction, openFaq } = useApp();
  const inputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  function handleFile(file) {
    if (file && file.type.startsWith('video/')) {
      startYourExtraction(file);
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
      <h1 className="hero-title">WHO IS FASTER?</h1>
      <p className="hero-sub">Compare your GoPro race video against a coach or friend</p>

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
        <div className="upload-label">📹 Attach Your GoPro Video</div>
        <div className="upload-hint">All processing is performed on your local device — videos are never uploaded anywhere</div>
      </div>

      <button
        className="faq-welcome-btn"
        onClick={() => openFaq(null)}
        style={{ marginTop: '24px' }}
      >
        ❓ FAQ
      </button>
    </div>
  );
}

