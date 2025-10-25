import React, { useState, useCallback } from 'react';
import LandingPage from './components/LandingPage';
import StudyInterface from './components/StudyInterface';
// Removed API key management from the UI to adhere to Gemini API guidelines.

const App = () => {
  const [studyContent, setStudyContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [appError, setAppError] = useState<string | null>(null);

  const handleFileSelect = useCallback((content: string, name: string) => {
    setStudyContent(content);
    setFileName(name);
    setAppError(null);
  }, []);
  
  const handleReset = useCallback(() => {
    setStudyContent(null);
    setFileName('');
    setAppError(null);
  }, []);


  const clearError = () => {
    setAppError(null);
  }

  const renderContent = () => {
    if (studyContent) {
        return <StudyInterface studyContent={studyContent} fileName={fileName} onReset={handleReset} />;
    }
    return <LandingPage onFileSelect={handleFileSelect} setAppError={setAppError} />;
  }

  return (
    <div className="relative min-h-screen bg-[#0A0A0A] overflow-x-hidden">
      <div className="gradient-bg"></div>
      <div className="relative z-10">
        {appError && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-4">
            <p>{appError}</p>
            <button onClick={clearError} className="font-bold text-lg">&times;</button>
          </div>
        )}
        {renderContent()}
      </div>
    </div>
  );
};

export default App;