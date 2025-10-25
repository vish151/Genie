
export interface Flashcard {
  term: string;
  definition: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export enum StudyTool {
  Summary = 'Summary',
  Flashcards = 'Flashcards',
  Quiz = 'Quiz',
  Chat = 'Chat',
  ConceptExplainer = 'Explain'
}