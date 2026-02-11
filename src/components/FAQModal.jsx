import { useState, useEffect } from 'react';

const FAQ_ITEMS = [
  {
    id: 'what-is-this',
    question: 'What is Who Is Faster?',
    answer: 'Who Is Faster lets you compare lap times between yourself and a friend or coach on any autocross course, race track, bike trail, or rally stage — using nothing but GoPro footage. Upload two videos, mark the course, and instantly see where you\'re gaining or losing time.',
  },
  {
    id: 'data-privacy',
    question: 'Do you collect or upload my data?',
    answer: 'No. All video processing and telemetry extraction happens entirely in your browser. Your videos never leave your device — there\'s no server, no upload, no tracking.',
  },
  {
    id: 'gps-accuracy',
    question: 'How accurate is GoPro GPS?',
    answer: 'GoPro GPS isn\'t the most accurate GPS out there, but it should be more than sufficient for basic coaching and comparisons. You\'ll get a clear picture of where you\'re gaining or losing time — just don\'t expect survey-grade precision.',
  },
  {
    id: 'no-gps',
    question: 'Why does it say "No GPS telemetry found"?',
    answer: 'This usually means the GPS data was stripped from your video. Common causes:\n\n• GPS was off on the GoPro — Make sure GPS is enabled in your GoPro settings before recording.\n• Imported via iPhone Photos — iOS strips GoPro telemetry when you save to the Photos app. This is an iOS limitation.\n• Transferred via AirDrop — AirDrop can also strip metadata during transfer.\n\nHow to fix it: Use an SD card reader (Lightning or USB-C) plugged into your phone, then upload the video directly from the Files app — not from Photos. On desktop, copy the .MP4 file directly from the SD card.',
  },
];

export default function FAQModal({ isOpen, onClose, initialQuestion }) {
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (isOpen && initialQuestion) {
      setExpandedId(initialQuestion);
      // Scroll to the question after a brief delay to ensure DOM is ready
      setTimeout(() => {
        const element = document.getElementById(`faq-item-${initialQuestion}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [isOpen, initialQuestion]);

  if (!isOpen) return null;

  return (
    <div className="faq-modal-overlay" onClick={onClose}>
      <div className="faq-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="faq-modal-header">
          <h2>Frequently Asked Questions</h2>
          <button className="faq-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="faq-accordion">
          {FAQ_ITEMS.map((item) => (
            <div key={item.id} id={`faq-item-${item.id}`} className="faq-item">
              <button
                className={`faq-question ${expandedId === item.id ? 'expanded' : ''}`}
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
              >
                <span>{item.question}</span>
                <span className="faq-toggle">▼</span>
              </button>
              {expandedId === item.id && (
                <div className="faq-answer">
                  {item.answer.split('\n').map((line, idx) => (
                    <p key={idx}>{line}</p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

