import { useApp } from '../context/AppContext';

export default function ModeSelectStep({ onNext, goBack }) {
  const { setRaceMode } = useApp();

  function handleModeSelect(mode) {
    setRaceMode(mode);
    onNext();
  }

  return (
    <div className="wizard-screen center-screen">
      <h1 className="hero-title">Select Race Mode</h1>
      <p className="hero-sub">How is your race course configured?</p>

      <div className="mode-cards-container">
        {/* Point-to-Point Card */}
        <div
          className="mode-card"
          onClick={() => handleModeSelect('point2point')}
        >
          <div className="mode-icon">🏁</div>
          <h2 className="mode-title">Point-to-Point</h2>
          <p className="mode-subtitle">Autocross, Bike Trail, Stage Rally</p>
          <p className="mode-description">Start and finish at different locations</p>
        </div>

        {/* Circuit Card */}
        <div
          className="mode-card"
          onClick={() => handleModeSelect('circuit')}
        >
          <div className="mode-icon">🏎️</div>
          <h2 className="mode-title">Circuit</h2>
          <p className="mode-subtitle">Track Day, Road Course, Karting</p>
          <p className="mode-description">Start and finish at the same location</p>
        </div>
      </div>

      {goBack && (
        <button className="back-btn" onClick={goBack} style={{ marginTop: '24px' }}>
          ← Back
        </button>
      )}
    </div>
  );
}

