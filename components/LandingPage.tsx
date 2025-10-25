import React, { useRef, useState } from 'react';
import { UploadIcon, FlashcardIcon, QuizIcon, ChatIcon } from './icons';
import { performOcrOnImage } from '../services/geminiService';

interface LandingPageProps {
  onFileSelect: (fileContent: string, fileName: string) => void;
  setAppError: (error: string | null) => void;
}

const LandingPage = ({ onFileSelect, setAppError }: LandingPageProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setAppError("Please upload a PDF file. Other formats are not yet supported.");
      return;
    }
    
    setAppError(null);
    setIsProcessing(true);
    setProgressMessage('Reading file...');

    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        setProgressMessage('Parsing PDF structure...');
        const arrayBuffer = e.target?.result as ArrayBuffer;
        
        const pdfjsLib = (window as any).pdfjsLib;
        if (!pdfjsLib) {
          throw new Error('pdf.js library is not loaded.');
        }
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;
        
        setProgressMessage('Extracting text...');
        let pageTextPromises = [];
        for (let i = 1; i <= numPages; i++) {
          const pagePromise = pdf.getPage(i).then((page: any) => {
            return page.getTextContent().then((textContent: any) => {
              return textContent.items.map((item: any) => item.str).join(' ');
            });
          });
          pageTextPromises.push(pagePromise);
        }

        let pagesText = await Promise.all(pageTextPromises);
        let fullText = pagesText.join('\n\n');
        
        // --- OCR Fallback Logic ---
        if (!fullText.trim()) {
           console.log("No text found, attempting OCR...");
           const ocrTextPromises = [];
           const canvas = document.createElement('canvas');
           const context = canvas.getContext('2d');
           
           if (!context) {
             throw new Error("Could not create canvas context for OCR.");
           }

           for (let i = 1; i <= numPages; i++) {
             setProgressMessage(`Performing OCR on page ${i} of ${numPages}...`);
             const page = await pdf.getPage(i);
             const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR quality
             canvas.height = viewport.height;
             canvas.width = viewport.width;

             await page.render({ canvasContext: context, viewport: viewport }).promise;
             
             const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
             const base64Image = imageDataUrl.split(',')[1];
             
             ocrTextPromises.push(performOcrOnImage(base64Image, 'image/jpeg'));
           }
           
           pagesText = await Promise.all(ocrTextPromises);
           fullText = pagesText.join('\n\n');
           canvas.remove();
        }
        // --- End OCR Fallback Logic ---

        if (!fullText.trim()) {
           throw new Error("Could not extract text from the PDF, even after attempting OCR. The document may be empty or unreadable.");
        }

        onFileSelect(fullText, file.name);

      } catch (error: any) {
        console.error("Error processing PDF:", error);
        setAppError(error.message || "Failed to process the PDF. It may be corrupted or unsupported.");
      } finally {
        setIsProcessing(false);
        setProgressMessage('');
        if (event.target) {
            event.target.value = '';
        }
      }
    };
    
    reader.onerror = () => {
      setAppError("Failed to read the file.");
      setIsProcessing(false);
      setProgressMessage('');
    };
    
    reader.readAsArrayBuffer(file);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="text-white">
      <header className="absolute top-0 left-0 right-0 p-4">
        <nav className="max-w-7xl mx-auto flex justify-start items-center">
          <h1 className="text-2xl font-bold tracking-tighter">Genie</h1>
        </nav>
      </header>

      <main className="pt-32 pb-16">
        {/* Hero Section */}
        <section className="text-center px-4">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400">
            AI-powered study tools
            <br />
            for students
          </h1>
          <p className="max-w-2xl mx-auto mt-6 text-lg text-gray-400">
            Create flashcards, generate quizzes, and ask questions about your notes with Genie.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf"
              disabled={isProcessing}
            />
            <button
              onClick={handleUploadClick}
              disabled={isProcessing}
              className="group flex items-center gap-3 px-8 py-4 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-transform hover:scale-105 disabled:bg-gray-300 disabled:cursor-wait"
            >
              <UploadIcon className="w-6 h-6" />
              {isProcessing ? progressMessage : 'Upload a PDF to start'}
            </button>
            <p className="text-sm text-gray-500">Join over 100,000 students using Genie to ace their exams.</p>
          </div>
        </section>

        {/* Features Section */}
        <section className="max-w-7xl mx-auto mt-24 px-4">
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<FlashcardIcon className="w-8 h-8 text-purple-400" />}
              title="Generate flashcards in seconds"
              description="Automatically create flashcards from your notes to reinforce key concepts."
            />
            <FeatureCard
              icon={<QuizIcon className="w-8 h-8 text-blue-400" />}
              title="Quiz yourself on any topic"
              description="Test your knowledge with custom quizzes generated from your study material."
            />
            <FeatureCard
              icon={<ChatIcon className="w-8 h-8 text-pink-400" />}
              title="Ask questions, get answers"
              description="Get instant, context-aware answers to your questions without leaving your notes."
            />
          </div>
        </section>
      </main>
      
      <footer className="text-center p-8 text-gray-500 text-sm">
        <p>&copy; {new Date().getFullYear()} Genie. All rights reserved.</p>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
  <div className="bg-gray-900/50 border border-gray-700/50 p-6 rounded-xl">
    <div className="mb-4">{icon}</div>
    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
    <p className="text-gray-400">{description}</p>
  </div>
);

export default LandingPage;