import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';

const FAQ_ITEMS = {
  'no-gps': {
    question: 'Why is my GoPro video not being recognized?',
    answer: 'Your GoPro video needs to have GPS telemetry data embedded in it. This happens when you record with GPS enabled on your GoPro. If your video was transferred via AirDrop or iCloud, the telemetry data may have been stripped. Try using a direct file transfer method instead.',
  },
  'file-format': {
    question: 'What file formats are supported?',
    answer: 'We support MP4 and other common video formats. However, the video must contain GoPro telemetry data (GPS, speed, etc.) to be analyzed.',
  },
  'privacy': {
    question: 'Is my data private?',
    answer: 'Yes! All processing happens on your local device. Your videos are never uploaded to any server.',
  },
};

export default function FAQ() {
  const { faqOpen, faqInitialQuestion, closeFaq } = useApp();
  const faqRef = useRef(null);

  useEffect(() => {
    if (faqOpen && faqInitialQuestion) {
      const element = document.getElementById(`faq-${faqInitialQuestion}`);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [faqOpen, faqInitialQuestion]);

  if (!faqOpen) return null;

  return (
    <div className="faq-overlay" onClick={closeFaq}>
      <div className="faq-modal" onClick={(e) => e.stopPropagation()} ref={faqRef}>
        <div className="faq-header">
          <h2>Frequently Asked Questions</h2>
          <button className="faq-close" onClick={closeFaq}>✕</button>
        </div>
        <div className="faq-content">
          {Object.entries(FAQ_ITEMS).map(([key, item]) => (
            <div key={key} id={`faq-${key}`} className="faq-item">
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

