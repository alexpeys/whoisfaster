export default function StepIndicator({ currentStep }) {
  const steps = [
    { id: 'welcome', label: 'Upload Your Video' },
    { id: 'uploadComp', label: 'Upload Comparison' },
    { id: 'extracting', label: 'Processing' },
    { id: 'modeSelect', label: 'Select Mode' },
    { id: 'mark', label: 'Mark Course' },
    { id: 'analysis', label: 'Results' },
  ];

  const currentIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="step-indicator">
      <div className="step-dots">
        {steps.map((step, idx) => (
          <div key={step.id} className="step-dot-wrapper">
            <div
              className={`step-dot ${idx <= currentIndex ? 'active' : ''} ${currentStep === 'extracting' && step.id === 'extracting' ? 'processing' : ''}`}
            />
            <div className="step-label">{step.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

