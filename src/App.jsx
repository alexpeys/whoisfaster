import { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import StepIndicator from './components/StepIndicator';
import WelcomeStep from './steps/WelcomeStep';
import UploadCompStep from './steps/UploadCompStep';
import ExtractingStep from './steps/ExtractingStep';
import MarkCourseStep from './steps/MarkCourseStep';
import AnalysisStep from './steps/AnalysisStep';
import FAQModal from './components/FAQModal';

function Wizard() {
  const [step, setStep] = useState('welcome');
  const { faqOpen, faqInitialQuestion, openFaq, closeFaq } = useApp();

  const goBack = (targetStep) => {
    setStep(targetStep);
  };

  return (
    <div className="app">
      <StepIndicator currentStep={step} />
      {step === 'welcome' && <WelcomeStep onNext={() => setStep('uploadComp')} />}
      {step === 'uploadComp' && <UploadCompStep onNext={() => setStep('extracting')} goBack={() => goBack('welcome')} />}
      {step === 'extracting' && <ExtractingStep onNext={() => setStep('mark')} onReset={() => setStep('welcome')} />}
      {step === 'mark' && <MarkCourseStep onNext={() => setStep('analysis')} goBack={() => goBack('uploadComp')} />}
      {step === 'analysis' && <AnalysisStep />}

      {/* Floating FAQ button - visible on all screens except welcome */}
      {step !== 'welcome' && (
        <button className="faq-floating-btn" onClick={() => openFaq(null)} title="FAQ">
          ❓
        </button>
      )}

      {/* FAQ Modal */}
      <FAQModal isOpen={faqOpen} onClose={closeFaq} initialQuestion={faqInitialQuestion} />
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
