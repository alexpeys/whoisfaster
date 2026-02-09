import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { extractTelemetry } from '../utils/telemetry';

function UploadColumn({ label, icon, video, onSelect, loading, progress, status }) {
  const inputRef = useRef(null);
  return (
    <div>
      <div
        className={`upload-zone ${video ? 'has-file' : ''}`}
        onClick={() => !loading && inputRef.current?.click()}
        style={{ opacity: loading ? 0.7 : 1, pointerEvents: loading ? 'none' : 'auto' }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/*"
          onChange={(e) => e.target.files[0] && onSelect(e.target.files[0])}
        />
        <div className="icon">{icon}</div>
        <div className="label">{label}</div>
        <div className="hint">Click to select a GoPro MP4 file</div>
        {video && <div className="filename">✓ {video.file.name}</div>}
      </div>
      {status && (
        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text2)' }}>
          <p>{status}</p>
          {loading && (
            <div className="progress-bar" style={{ marginTop: 8 }}>
              <div className="fill" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function UploadPage() {
  const { yourVideo, setYourVideo, compVideo, setCompVideo } = useApp();
  const [yourLoading, setYourLoading] = useState(false);
  const [yourStatus, setYourStatus] = useState('');
  const [yourProgress, setYourProgress] = useState(0);
  const [compLoading, setCompLoading] = useState(false);
  const [compStatus, setCompStatus] = useState('');
  const [compProgress, setCompProgress] = useState(0);
  const navigate = useNavigate();

  async function handleFile(file, setter, setLoading, setStatus, setProgress, label) {
    const url = URL.createObjectURL(file);
    setter({ file, url, telemetry: null });
    setStatus(`Extracting telemetry...`);
    setLoading(true);
    setProgress(0);
    try {
      const telemetry = await extractTelemetry(file, (p) => setProgress(p));
      setter({ file, url, telemetry });
      setStatus(`✓ ${telemetry.gps.length} GPS pts, ${telemetry.accel.length} accel, ${telemetry.gyro.length} gyro`);
    } catch (err) {
      console.error(err);
      setStatus(`⚠ Failed: ${err?.message || 'No GoPro telemetry found — file may have been re-encoded by AirDrop/iCloud'}`);
    }
    setLoading(false);
  }

  const canProceed = yourVideo?.telemetry?.gps?.length > 0 && compVideo?.telemetry?.gps?.length > 0;

  return (
    <div className="page">
      <h1>🏁 Who Did It Better?</h1>
      <p className="subtitle">Upload two GoPro race videos to compare lap performance</p>

      <div className="grid-2">
        <UploadColumn
          label="Your Video"
          icon="🏎️"
          video={yourVideo}
          loading={yourLoading}
          progress={yourProgress}
          status={yourStatus}
          onSelect={(f) => handleFile(f, setYourVideo, setYourLoading, setYourStatus, setYourProgress, 'Your Video')}
        />
        <UploadColumn
          label="Comparison Video (Coach)"
          icon="🏆"
          video={compVideo}
          loading={compLoading}
          progress={compProgress}
          status={compStatus}
          onSelect={(f) => handleFile(f, setCompVideo, setCompLoading, setCompStatus, setCompProgress, 'Comparison Video')}
        />
      </div>

      <div className="step-nav">
        <div />
        <button disabled={!canProceed} onClick={() => navigate('/mark')}>
          Next: Mark Course →
        </button>
      </div>
    </div>
  );
}

