/**
 * useFeedbackTimer - Managed feedback timer with automatic cleanup
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export function useFeedbackTimer() {
  const [feedback, setFeedback] = useState<string | null>(null);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  const setFeedbackWithTimeout = useCallback((message: string, duration: number = 3000): void => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }

    setFeedback(message);

    feedbackTimerRef.current = setTimeout(() => {
      setFeedback(null);
      feedbackTimerRef.current = null;
    }, duration);
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  return { feedback, setFeedback, setFeedbackWithTimeout };
}

