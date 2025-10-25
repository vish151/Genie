
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { explainConcept, generateSpeech } from '../../services/geminiService';
import Loader from '../Loader';
import { SpeakerIcon, StopIcon } from '../icons';

// --- Audio Utility Functions (copied for self-containment) ---
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


interface ConceptExplainerProps {
  studyContent: string;
}

const ConceptExplainer = ({ studyContent }: ConceptExplainerProps) => {
  const [concept, setConcept] = useState('');
  const [explanation, setExplanation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioDataRef = useRef<string | null>(null);

  // Stop audio when component unmounts
  useEffect(() => {
    return () => stopAudio();
  }, []);

  const handleExplain = async () => {
    if (!concept.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setExplanation('');
    // Reset audio state for new explanation
    stopAudio();
    setIsPlaying(false);
    audioDataRef.current = null;

    try {
      const result = await explainConcept(studyContent, concept);
      setExplanation(result);
    } catch (e: any) {
      setError(e.message || 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleExplain();
    }
  };
  
  const handlePlay = useCallback(async () => {
    if (isPlaying) {
        stopAudio();
        setIsPlaying(false);
        return;
    }

    if (audioDataRef.current) {
        setIsPlaying(true);
        await playAudio(audioDataRef.current, () => setIsPlaying(false));
    } else if (explanation) {
        setIsGeneratingSpeech(true);
        try {
            const newAudioData = await generateSpeech(explanation);
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
  }, [explanation, isPlaying]);


  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center">
      <h2 className="text-2xl font-bold text-white mb-4">Concept Explainer</h2>
      <p className="text-gray-400 mb-6 text-center">Enter a term or concept from your document to get a simple explanation.</p>

      <div className="flex w-full">
        <input
          type="text"
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="e.g., Photosynthesis, The Cold War, Quantum Mechanics..."
          disabled={isLoading}
          className="flex-grow bg-gray-900 border border-gray-600 rounded-l-lg py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
        />
        <button
          onClick={handleExplain}
          disabled={isLoading || !concept.trim()}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-r-lg text-white font-semibold transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          {isLoading ? '...' : 'Explain'}
        </button>
      </div>
      
      <div className="w-full mt-8 min-h-[200px]">
        {isLoading && <Loader text={`Explaining "${concept}"...`} />}
        {error && <div className="text-center text-red-400 bg-red-900/50 p-4 rounded-md">{error}</div>}
        {explanation && !isLoading && (
            <div className="relative">
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Explanation</h3>
                    <button 
                        onClick={handlePlay} 
                        disabled={isGeneratingSpeech}
                        className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={isPlaying ? "Stop reading" : "Read explanation aloud"}
                    >
                        {isGeneratingSpeech ? (
                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (isPlaying ? <StopIcon className="w-5 h-5"/> : <SpeakerIcon className="w-5 h-5"/>)}
                    </button>
                </div>
                <div className="bg-gray-800/50 p-6 rounded-lg max-h-[50vh] overflow-y-auto">
                    <p className="text-gray-200 whitespace-pre-wrap leading-relaxed">{explanation}</p>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default ConceptExplainer;