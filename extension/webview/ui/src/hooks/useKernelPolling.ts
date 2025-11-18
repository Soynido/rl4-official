/**
 * useKernelPolling - Stable kernel status polling without infinite loops
 */

import { useEffect, useRef } from 'react';

export function useKernelPolling(isReady: boolean) {
  const pollRef = useRef(true);

  useEffect(() => {
    if (!window.vscode) return;

    // Request immediately
    window.vscode.postMessage({ type: 'requestStatus' });

    // Stop polling if already ready
    if (isReady) {
      pollRef.current = false;
      return;
    }

    // Poll every 2s
    const intervalId = setInterval(() => {
      if (!pollRef.current || isReady) {
        clearInterval(intervalId);
        return;
      }
      window.vscode?.postMessage({ type: 'requestStatus' });
    }, 2000);

    return () => {
      pollRef.current = false;
      clearInterval(intervalId);
    };
  }, []); // No dependencies - runs once, stops when ready via ref

  // Separate effect to update pollRef when ready changes
  useEffect(() => {
    if (isReady) {
      pollRef.current = false;
    }
  }, [isReady]);
}

