import React, { useState, useCallback, useEffect, useRef } from 'react';
import { StudyTool, Flashcard as FlashcardType, QuizQuestion } from '../types';
import { generateFlashcards, generateQuiz, generateSummary, generateSpeech } from '../services/geminiService';
import Loader from './Loader';
import Flashcard from './StudyTools/Flashcard';
import Quiz from './StudyTools/Quiz';
import Chat from './StudyTools/Chat';
import ConceptExplainer from './StudyTools/ConceptExplainer';
import { FlashcardIcon, QuizIcon, ChatIcon, SummaryIcon, SpeakerIcon, StopIcon, ConceptExplainerIcon } from './icons';

// --- Audio Utility Functions ---
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

let audioContext: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }
  return audioContext;
};

const playAudio = async (base64Audio: string, onEnd: () => void): Promise<void> => {
  if (currentSource) {
    currentSource.stop();
  }
  const ctx = getAudioContext();
  const decodedBytes = decode(base64Audio);
  const audioBuffer = await decodeAudioData(decodedBytes, ctx, 24000, 1);
  
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(ctx.destination);
  source.start();
  currentSource = source;
  
  return new Promise((resolve) => {
    source.onended = () => {
      if (currentSource === source) {
        currentSource = null;
      }
      onEnd();
      resolve();
    };
  });
};

const stopAudio = () => {
  if (currentSource) {
     try {
      currentSource.stop();
      currentSource.disconnect();
    } catch(e) {
      // Ignore errors if source is already stopped
    }
    currentSource = null;
  }
};
// --- End Audio Utility Functions ---


// Updated props to remove onResetKey per Gemini API guidelines on API key management.
interface StudyInterfaceProps {
    studyContent: string;
    fileName: string;
    onReset: () => void;
}

const Summary = ({ summary }: { summary: string }) => {
    const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioDataRef = useRef<string | null>(null);

    useEffect(() => {
      // Clean up on unmount or when summary changes
      return () => {
        stopAudio();
      }
    }, []);

    useEffect(() => {
      // When the summary content changes, stop any playing audio and clear the cache.
      stopAudio();
      setIsPlaying(false);
      audioDataRef.current = null;
    }, [summary]);

    const handlePlay = useCallback(async () => {
        if (isPlaying) {
            stopAudio();
            setIsPlaying(false);
            return;
        }

        if (audioDataRef.current) {
            setIsPlaying(true);
            await playAudio(audioDataRef.current, () => setIsPlaying(false));
        } else {
            setIsGeneratingSpeech(true);
            try {
                const newAudioData = await generateSpeech(summary);
                audioDataRef.current = newAudioData;
                setIsPlaying(true);
                await playAudio(newAudioData, () => setIsPlaying(false));
            } catch (e) {
                console.error("Failed to generate or play audio", e);
                setIsPlaying(false);
            } finally {
                setIsGeneratingSpeech(false);
            }
        }
    }, [summary, isPlaying]);

    if (!summary) {
      return <p className="text-center text-gray-400">No summary generated.</p>;
    }

    return (
      <div className="w-full max-w-3xl mx-auto relative">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-white">Document Summary</h2>
            <button 
                onClick={handlePlay} 
                disabled={isGeneratingSpeech}
                className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={isPlaying ? "Stop reading" : "Read summary aloud"}
            >
                {isGeneratingSpeech ? (
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ) : (isPlaying ? <StopIcon className="w-5 h-5"/> : <SpeakerIcon className="w-5 h-5"/>)}
            </button>
        </div>
        <div className="bg-gray-800/50 p-6 rounded-lg max-h-[60vh] overflow-y-auto">
           <p className="text-gray-200 whitespace-pre-wrap leading-relaxed">{summary}</p>
        </div>
      </div>
    );
};

const StudyInterface = ({ studyContent, fileName, onReset }: StudyInterfaceProps) => {
    const [activeTool, setActiveTool] = useState<StudyTool | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [summary, setSummary] = useState<string>('');
    const [flashcards, setFlashcards] = useState<FlashcardType[]>([]);
    const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
    
    const [numFlashcards, setNumFlashcards] = useState(10);
    const [numQuizQuestions, setNumQuizQuestions] = useState(5);


    const handleToolSelect = useCallback(async (tool: StudyTool) => {
        if (tool === activeTool) return;
        
        // Interactive tools don't need pre-fetching.
        if (tool === StudyTool.Chat || tool === StudyTool.ConceptExplainer) {
             setActiveTool(tool);
             return;
        }

        // Prevent re-fetching content that is already generated
        if (tool === StudyTool.Summary && summary) {
            setActiveTool(StudyTool.Summary);
            return;
        }
        if (tool === StudyTool.Flashcards && flashcards.length > 0) {
            setActiveTool(StudyTool.Flashcards);
            return;
        }
        if (tool === StudyTool.Quiz && quizQuestions.length > 0) {
            setActiveTool(StudyTool.Quiz);
            return;
        }

        setActiveTool(tool);
        setIsLoading(true);
        setError(null);
        try {
            if (tool === StudyTool.Summary) {
                const generatedSummary = await generateSummary(studyContent);
                setSummary(generatedSummary);
            } else if (tool === StudyTool.Flashcards) {
                const generatedFlashcards = await generateFlashcards(studyContent, numFlashcards);
                setFlashcards(generatedFlashcards);
            } else if (tool === StudyTool.Quiz) {
                const generatedQuiz = await generateQuiz(studyContent, numQuizQuestions);
                setQuizQuestions(generatedQuiz);
            }
        } catch (e: any) {
            setError(e.message || "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    }, [activeTool, studyContent, numFlashcards, numQuizQuestions, summary, flashcards, quizQuestions]);

    useEffect(() => {
        // Pre-select summary on initial load
        handleToolSelect(StudyTool.Summary);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const renderContent = () => {
        if (isLoading) {
            return <Loader text={`Generating ${activeTool}...`} />;
        }
        if (error) {
            return <div className="text-center text-red-400 bg-red-900/50 p-4 rounded-md">{error}</div>;
        }

        switch (activeTool) {
            case StudyTool.Summary:
                return <Summary summary={summary} />;
            case StudyTool.Flashcards:
                return <Flashcard flashcards={flashcards} />;
            case StudyTool.Quiz:
                return <Quiz questions={quizQuestions} />;
            case StudyTool.Chat:
                return <Chat studyContent={studyContent} />;
            case StudyTool.ConceptExplainer:
                return <ConceptExplainer studyContent={studyContent} />;
            default:
                return <div className="text-center text-gray-400">Select a tool to get started.</div>;
        }
    };
    
    const ToolButton = ({ tool, icon, onClick }: { tool: StudyTool, icon: React.ReactNode, onClick: () => void }) => (
      <button 
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${activeTool === tool ? 'bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
      >
        {icon}
        {tool}
      </button>
    );

    return (
        <div className="min-h-screen text-white w-full max-w-7xl mx-auto px-4 py-8">
            <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Your Study Space</h1>
                    <p className="text-gray-400">File: {fileName}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onReset} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
                        Upload New File
                    </button>
                </div>
            </header>
            
            <div className="flex flex-wrap justify-center items-center gap-4 mb-8">
                 <div className="bg-gray-800 border border-gray-700 rounded-lg p-1">
                    <ToolButton tool={StudyTool.Summary} icon={<SummaryIcon className="w-5 h-5"/>} onClick={() => handleToolSelect(StudyTool.Summary)} />
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-1">
                    <ToolButton tool={StudyTool.ConceptExplainer} icon={<ConceptExplainerIcon className="w-5 h-5"/>} onClick={() => handleToolSelect(StudyTool.ConceptExplainer)} />
                </div>
                <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg p-1">
                    <ToolButton tool={StudyTool.Flashcards} icon={<FlashcardIcon className="w-5 h-5"/>} onClick={() => handleToolSelect(StudyTool.Flashcards)} />
                    <input 
                        type="number"
                        value={numFlashcards}
                        onChange={(e) => setNumFlashcards(Math.max(1, parseInt(e.target.value, 10)))}
                        min="1"
                        max="50"
                        className="w-16 bg-gray-900 text-white text-center rounded-md p-1 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        aria-label="Number of flashcards"
                    />
                </div>
                 <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg p-1">
                    <ToolButton tool={StudyTool.Quiz} icon={<QuizIcon className="w-5 h-5"/>} onClick={() => handleToolSelect(StudyTool.Quiz)} />
                     <input 
                        type="number"
                        value={numQuizQuestions}
                        onChange={(e) => setNumQuizQuestions(Math.max(1, parseInt(e.target.value, 10)))}
                        min="1"
                        max="25"
                        className="w-16 bg-gray-900 text-white text-center rounded-md p-1 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        aria-label="Number of quiz questions"
                    />
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-1">
                    <ToolButton tool={StudyTool.Chat} icon={<ChatIcon className="w-5 h-5"/>} onClick={() => handleToolSelect(StudyTool.Chat)} />
                </div>
            </div>

            <main className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-4 md:p-8 min-h-[500px] flex items-center justify-center">
                {renderContent()}
            </main>
        </div>
    );
};

export default StudyInterface;