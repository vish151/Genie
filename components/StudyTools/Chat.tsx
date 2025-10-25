import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Chat as ChatSession } from '@google/genai';
import { ChatMessage } from '../../types';
import { createChatSession } from '../../services/geminiService';
import { SendIcon } from '../icons';

const Chat = ({ studyContent }: { studyContent: string }) => {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const chat = createChatSession(studyContent);
    setSession(chat);
    setMessages([
      {
        role: 'model',
        content: "Hi! I'm Genie. Ask me anything about your document."
      }
    ]);
  }, [studyContent]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSendMessage = useCallback(async () => {
    if (!userInput.trim() || !session || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: userInput.trim() };
    setMessages(prev => [...prev, userMessage, { role: 'model', content: '' }]);
    const currentInput = userInput.trim();
    setUserInput('');
    setIsLoading(true);

    try {
      const stream = await session.sendMessageStream({ message: currentInput });
      
      for await (const chunk of stream) {
        const chunkText = chunk.text;
        setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage.role === 'model') {
                lastMessage.content += chunkText;
            }
            return newMessages;
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: ChatMessage = { role: 'model', content: "Sorry, I encountered an error. Please try again." };
      setMessages(prev => {
          const newMessages = [...prev];
          const lastMessageIndex = newMessages.length - 1;
          if(lastMessageIndex >= 0 && newMessages[lastMessageIndex].role === 'model' && newMessages[lastMessageIndex].content === ''){
            newMessages[lastMessageIndex] = errorMessage;
          } else {
            newMessages.push(errorMessage);
          }
          return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  }, [userInput, session, isLoading]);
  
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };


  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col h-[70vh] bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
      <div className="flex-1 p-6 overflow-y-auto space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-md p-3 rounded-lg ${msg.role === 'user' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.content === '' && (
          <div className="flex justify-start">
            <div className="max-w-md p-3 rounded-lg bg-gray-700 text-gray-200">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t border-gray-700">
        <div className="relative">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question about your document..."
            disabled={isLoading}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg py-3 pl-4 pr-12 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !userInput.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full text-white bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            <SendIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;