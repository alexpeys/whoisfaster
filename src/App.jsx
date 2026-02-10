import { useState } from 'react';
import { AppProvider } from './context/AppContext';
import StepIndicator from './components/StepIndicator';
import WelcomeStep from './steps/WelcomeStep';
import UploadCompStep from './steps/UploadCompStep';
import ExtractingStep from './steps/ExtractingStep';
import MarkCourseStep from './steps/MarkCourseStep';
import AnalysisStep from './steps/AnalysisStep';
import FAQ from './components/FAQ';

function Wizard() {
  const [step, setStep] = useState('welcome');

  const goBack = (targetStep) => {
    setStep(targetStep);
  };

  return (
    <div className="app">
      <StepIndicator currentStep={step} />
      {step === 'welcome' && <WelcomeStep onNext={() => setStep('uploadComp')} />}
      {step === 'uploadComp' && <UploadCompStep onNext={() => setStep('extracting')} goBack={() => goBack('welcome')} />}
      {step === 'extracting' && <ExtractingStep onNext={() => setStep('mark')} />}
      {step === 'mark' && <MarkCourseStep onNext={() => setStep('analysis')} goBack={() => goBack('uploadComp')} />}
      {step === 'analysis' && <AnalysisStep />}
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <Wizard />
    </AppProvider>
  );
}

export default App;
