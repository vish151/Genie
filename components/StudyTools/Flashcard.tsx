
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Flashcard as FlashcardType } from '../../types';
import { ArrowRightIcon, SpeakerIcon, StopIcon } from '../icons';
import { generateSpeech } from '../../services/geminiService';

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


const Flashcard = ({ flashcards }: { flashcards: FlashcardType[] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const [audioCache, setAudioCache] = useState<Record<string, string>>({});
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);

  const currentCard = useMemo(() => flashcards[currentIndex], [flashcards, currentIndex]);

  const flipCard = useCallback(() => {
    setIsFlipped(prev => !prev);
  }, []);

  const goToNextCard = useCallback(() => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % flashcards.length);
    }, 150); // Delay to allow card to flip back
  }, [flashcards.length]);

  const goToPrevCard = useCallback(() => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev - 1 + flashcards.length) % flashcards.length);
    }, 150);
  }, [flashcards.length]);

  useEffect(() => {
    // Stop any playing audio when card flips or changes
    stopAudio();
    setCurrentlyPlaying(null);
  }, [currentIndex, isFlipped]);

  const handlePlayAudio = useCallback(async (text: string) => {
    if (currentlyPlaying) {
      const wasPlayingThisText = currentlyPlaying === text;
      stopAudio();
      setCurrentlyPlaying(null);
      if (wasPlayingThisText) return;
    }
    
    if (audioCache[text]) {
        setCurrentlyPlaying(text);
        await playAudio(audioCache[text], () => setCurrentlyPlaying(null));
    } else {
        setIsGeneratingSpeech(true);
        try {
            const audioData = await generateSpeech(text);
            setAudioCache(prev => ({ ...prev, [text]: audioData }));
            setCurrentlyPlaying(text);
            await playAudio(audioData, () => setCurrentlyPlaying(null));
        } catch (e) {
            console.error("Failed to generate or play speech", e);
            setCurrentlyPlaying(null);
        } finally {
            setIsGeneratingSpeech(false);
        }
    }
  }, [audioCache, currentlyPlaying]);
  
  if (!flashcards || flashcards.length === 0) {
    return <p className="text-center text-gray-400">No flashcards generated.</p>;
  }
  
  const renderAudioButton = (text: string) => {
    const isPlayingThis = currentlyPlaying === text;
    return (
      <button
        onClick={(e) => { e.stopPropagation(); handlePlayAudio(text); }}
        disabled={isGeneratingSpeech && !isPlayingThis}
        className="absolute bottom-4 right-4 p-2 rounded-full bg-gray-700/80 hover:bg-gray-600/80 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={isPlayingThis ? "Stop reading" : "Read text aloud"}
      >
        {isGeneratingSpeech && !isPlayingThis ? (
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        ) : (isPlayingThis ? <StopIcon className="w-5 h-5"/> : <SpeakerIcon className="w-5 h-5"/>)}
      </button>
    );
  };


  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center">
      <div className="w-full h-80 perspective-1000">
        <div
          className={`relative w-full h-full cursor-pointer card-flip ${isFlipped ? 'card-flip-back' : ''}`}
          onClick={flipCard}
        >
          {/* Front of card */}
          <div className="absolute w-full h-full bg-gray-800 border border-gray-700 rounded-xl flex items-center justify-center p-6 backface-hidden">
            <p className="text-2xl font-bold text-center text-white">{currentCard.term}</p>
            {renderAudioButton(currentCard.term)}
          </div>
          {/* Back of card */}
          <div className="absolute w-full h-full bg-gray-800 border border-purple-500 rounded-xl flex items-center justify-center p-6 backface-hidden card-flip-back">
            <p className="text-lg text-center text-gray-200">{currentCard.definition}</p>
            {renderAudioButton(currentCard.definition)}
          </div>
        </div>
      </div>

      <div className="mt-6 text-sm text-gray-400">
        Card {currentIndex + 1} of {flashcards.length}
      </div>

      <div className="flex items-center justify-between w-full max-w-sm mt-4">
        <button onClick={goToPrevCard} className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors text-white">
          <ArrowRightIcon className="w-6 h-6 transform rotate-180" />
        </button>
        <button onClick={flipCard} className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-semibold transition-colors">
          Flip Card
        </button>
        <button onClick={goToNextCard} className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors text-white">
          <ArrowRightIcon className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default Flashcard;