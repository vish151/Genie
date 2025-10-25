import React, { useState } from 'react';

interface ApiKeySetupProps {
  onKeySubmit: (key: string) => void;
}

const ApiKeySetup = ({ onKeySubmit }: ApiKeySetupProps) => {
  const [apiKey, setApiKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      onKeySubmit(apiKey.trim());
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center text-white px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-4xl font-bold tracking-tighter mb-4">Welcome to Genie</h1>
        <p className="text-gray-400 mb-8">
          To start studying, please enter your Google Gemini API key.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your Gemini API Key"
            className="w-full bg-gray-900 border border-gray-600 rounded-lg py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            aria-label="Gemini API Key"
          />
          <button
            type="submit"
            disabled={!apiKey.trim()}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-semibold transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            Start Studying
          </button>
        </form>
        <div className="mt-6 text-sm text-gray-500">
          <p>
            You can get your free API key from{' '}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:underline"
            >
              Google AI Studio
            </a>.
          </p>
          <p className="mt-2">
            Your key is stored securely in your browser and is never shared.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ApiKeySetup;
