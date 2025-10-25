import { GoogleGenAI, Type, Chat, Modality } from "@google/genai";
import { Flashcard, QuizQuestion } from '../types';

// Per Gemini API guidelines, initialize the client with API_KEY from environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateSpeech = async (text: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
        },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio data received from API.");
    }
    return base64Audio;
  } catch (error) {
    console.error("Error generating speech:", error);
    throw new Error("Failed to generate audio for the text.");
  }
};


export const generateSummary = async (text: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Summarize the following document concisely, highlighting the key points, concepts, and conclusions. Format the summary for readability using paragraphs and bullet points where appropriate. Document: ${text}`,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating summary:", error);
    throw new Error("Failed to generate a summary. The document may be too short or complex.");
  }
};

export const generateFlashcards = async (text: string, count: number): Promise<Flashcard[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Based on the following document, generate a set of ${count} detailed flashcards. Each flashcard should have a "term" (a key concept or name) and a "definition" (a clear explanation of the term). Document: ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              term: {
                type: Type.STRING,
                description: 'The key term, concept, or name.'
              },
              definition: {
                type: Type.STRING,
                description: 'The detailed definition or explanation of the term.'
              },
            },
            required: ["term", "definition"],
          },
        },
      },
    });

    const jsonString = response.text.trim();
    const flashcards: Flashcard[] = JSON.parse(jsonString);
    return flashcards;
  } catch (error) {
    console.error("Error generating flashcards:", error);
    throw new Error("Failed to generate flashcards. The content might be too short or the format is not supported.");
  }
};

export const generateQuiz = async (text: string, count: number): Promise<QuizQuestion[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Based on the following document, generate a ${count}-question multiple-choice quiz. Each question should have a "question", an array of 4 "options", and the "correctAnswer" which must be one of the options. Ensure the questions cover different aspects of the text. Document: ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: {
                type: Type.STRING,
                description: 'The quiz question.'
              },
              options: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING,
                },
                description: 'An array of 4 possible answers.'
              },
              correctAnswer: {
                type: Type.STRING,
                description: 'The correct answer, which must be one of the provided options.'
              },
            },
            required: ["question", "options", "correctAnswer"],
          },
        },
      },
    });

    const jsonString = response.text.trim();
    const quiz: QuizQuestion[] = JSON.parse(jsonString);
    return quiz;
  } catch (error) {
    console.error("Error generating quiz:", error);
    throw new Error("Failed to generate a quiz. Please try with different content.");
  }
};

export const performOcrOnImage = async (base64Image: string, mimeType: string): Promise<string> => {
  try {
    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: mimeType,
      },
    };
    const textPart = {
      text: "Perform OCR on this image. Extract all text from this document page. Preserve the original formatting as much as possible, including paragraphs and line breaks. If the page is blank, return an empty string.",
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [imagePart, textPart] },
    });
    
    return response.text;
// Fix: Corrected a typo in the catch block from 'error)_' to 'error'.
  } catch (error) {
    console.error("Error performing OCR:", error);
    // Check for API key specific error
    if (error instanceof Error && error.message.includes('API key not valid')) {
       throw new Error("Your API Key is not valid. Please check your key and try again.");
    }
    throw new Error("Failed to extract text from the document image using AI.");
  }
};

export const explainConcept = async (documentText: string, concept: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Based on the context of the following document, explain the concept of "${concept}" in a clear, simple, and easy-to-understand way. Use analogies if it helps clarify the topic. Keep the explanation concise but thorough. Document: ${documentText}`,
    });
    return response.text;
  } catch (error) {
    console.error("Error explaining concept:", error);
    throw new Error(`Failed to explain the concept "${concept}". Please try a different term.`);
  }
};

export const createChatSession = (studyContent: string): Chat => {
    return ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: `You are a helpful study assistant called Genie. All your answers must be based on the following document. If the user asks a question that cannot be answered by the document, politely state that the information is not available in the provided text. Do not use outside knowledge. Document: \n\n${studyContent}`
        }
    });
};