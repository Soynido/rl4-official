/**
 * useMessageHandler - Single unified message listener for VS Code WebView
 * Replaces all scattered window.addEventListener('message') to prevent memory leaks
 */

import { useEffect, useCallback } from 'react';

export type MessageHandlers = Record<string, (payload: any, message?: any) => void>;

export function useMessageHandler(handlers: MessageHandlers) {
  const handleMessage = useCallback((event: MessageEvent) => {
    const message = event.data;
    const { type, payload } = message || {};
    
    if (type && handlers[type]) {
      handlers[type](payload, message);
    }
  }, [handlers]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);
}

