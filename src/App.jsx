import { useState } from 'react';
import { AppProvider } from './context/AppContext';
import WelcomeStep from './steps/WelcomeStep';
import UploadCompStep from './steps/UploadCompStep';
import ExtractingStep from './steps/ExtractingStep';
import MarkCourseStep from './steps/MarkCourseStep';
import AnalysisStep from './steps/AnalysisStep';

function Wizard() {
  const [step, setStep] = useState('welcome');
  return (
    <div className="app">
      {step === 'welcome' && <WelcomeStep onNext={() => setStep('uploadComp')} />}
      {step === 'uploadComp' && <UploadCompStep onNext={() => setStep('extracting')} />}
      {step === 'extracting' && <ExtractingStep onNext={() => setStep('mark')} />}
      {step === 'mark' && <MarkCourseStep onNext={() => setStep('analysis')} />}
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
