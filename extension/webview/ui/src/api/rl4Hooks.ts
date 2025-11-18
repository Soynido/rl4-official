import { useEffect } from 'react';
import { useRL4Store } from './useRL4Store';
import type { RL4Message } from '@/types/rl4';

/**
 * Hook qui synchronise automatiquement le store avec les messages du backend VSCode
 * DEPRECATED: Message handling now centralized in useMessageHandler
 * This hook is kept for backward compatibility but should not register its own listener
 */
export function useStoreSync() {
  const {
    updateSnapshot,
    updateNow,
    updateBefore,
    updateNext,
    updateRestore
  } = useRL4Store((s) => ({
    updateSnapshot: s.updateSnapshot,
    updateNow: s.updateNow,
    updateBefore: s.updateBefore,
    updateNext: s.updateNext,
    updateRestore: s.updateRestore,
  }));

  // Return the update functions for use by centralized message handler
  return {
    updateSnapshot,
    updateNow,
    updateBefore,
    updateNext,
    updateRestore
  };
}

