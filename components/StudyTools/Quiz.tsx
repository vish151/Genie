
import React, { useState, useMemo } from 'react';
import { QuizQuestion } from '../../types';

interface QuizProps {
  questions: QuizQuestion[];
}

const Quiz = ({ questions }: QuizProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showResults, setShowResults] = useState(false);

  const currentQuestion = useMemo(() => questions[currentIndex], [questions, currentIndex]);

  const handleAnswerSelect = (option: string) => {
    if (isAnswered) return;
    setSelectedAnswer(option);
  };

  const handleCheckAnswer = () => {
    if (selectedAnswer === null) return;

    setIsAnswered(true);
    if (selectedAnswer === currentQuestion.correctAnswer) {
      setScore(prev => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    setIsAnswered(false);
    setSelectedAnswer(null);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setShowResults(true);
    }
  };

  const restartQuiz = () => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setScore(0);
    setShowResults(false);
  };

  if (!questions || questions.length === 0) {
    return <p className="text-center text-gray-400">No quiz questions generated.</p>;
  }

  if (showResults) {
    return (
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-4">Quiz Complete!</h2>
        <p className="text-xl text-gray-300 mb-6">
          You scored {score} out of {questions.length}
        </p>
        <button
          onClick={restartQuiz}
          className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-semibold transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="mb-4 text-sm text-gray-400">
        Question {currentIndex + 1} of {questions.length}
      </div>
      <h2 className="text-2xl font-semibold mb-6 text-white">{currentQuestion.question}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {currentQuestion.options.map((option, index) => {
          const isCorrect = option === currentQuestion.correctAnswer;
          const isSelected = option === selectedAnswer;
          
          let buttonClass = 'p-4 rounded-lg text-left transition-colors border-2 w-full ';
          if (isAnswered) {
            if (isCorrect) {
              buttonClass += 'bg-green-800 border-green-500 text-white';
            } else if (isSelected && !isCorrect) {
              buttonClass += 'bg-red-800 border-red-500 text-white';
            } else {
              buttonClass += 'bg-gray-700 border-gray-600 text-gray-300';
            }
          } else {
            if (isSelected) {
              buttonClass += 'bg-purple-700 border-purple-500 text-white';
            } else {
              buttonClass += 'bg-gray-800 border-gray-700 hover:bg-gray-700/50 hover:border-purple-500 text-gray-200';
            }
          }
          
          return (
            <button
              key={index}
              onClick={() => handleAnswerSelect(option)}
              disabled={isAnswered}
              className={buttonClass}
            >
              {option}
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex justify-end">
        {!isAnswered ? (
          <button
            onClick={handleCheckAnswer}
            disabled={selectedAnswer === null}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-semibold transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            Check Answer
          </button>
        ) : (
          <button
            onClick={handleNextQuestion}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition-colors"
          >
            {currentIndex < questions.length - 1 ? 'Next Question' : 'View Results'}
          </button>
        )}
      </div>
    </div>
  );
};

export default Quiz;
