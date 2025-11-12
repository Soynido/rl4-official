import { useEffect } from 'react';
import { useRL4Store } from './useRL4Store';
import type { RL4Message } from '@/types/rl4';

/**
 * Hook qui synchronise automatiquement le store avec les messages du backend VSCode
 * Écoute les messages de type 'updateStore' (legacy) et les nouveaux types RL4
 */
export function useStoreSync() {
  const {
    updateSnapshot, // Legacy support
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

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data as RL4Message | { type: 'updateStore'; payload: any };

      if (!msg?.type) return;

      // Cognitive Density Audit - Temporary validation
      if (msg.type.startsWith('update')) {
        const fields = Object.keys(msg.payload || {});
        const density = fields.length;
        console.log(`[RL4Messages] ${msg.type}(fields_present=[${fields.join(',')}]) density=${density}`);

        // Display payload structure for validation
        if (density > 0) {
          console.table(Object.fromEntries(
            fields.map(key => [key, msg.payload[key] !== undefined ? '✅' : '❌'])
          ));
        }
      }

      switch (msg.type) {
        case 'updateStore':
          // Legacy support
          updateSnapshot(msg.payload);
          console.log('[RL4 WebView] Legacy snapshot received:', msg.payload?.cycleId || 'unknown');
          break;

        case 'updateNow':
          updateNow(msg.payload);
          console.log('[RL4 WebView] Now data received:', msg.payload?.cycleId || 'unknown');
          break;

        case 'updateBefore':
          updateBefore(msg.payload);
          console.log('[RL4 WebView] Before data received:', msg.payload?.date || 'unknown');
          break;

        case 'updateNext':
          updateNext(msg.payload);
          console.log('[RL4 WebView] Next data received, phase:', msg.payload?.phase || 'unknown');
          break;

        case 'updateRestore':
          updateRestore(msg.payload);
          console.log('[RL4 WebView] Restore data received, entries:', msg.payload?.entries?.length || 0);
          break;

        default:
          console.warn('[RL4 WebView] Unknown message type:', (msg as any).type);
      }
    };

    window.addEventListener('message', handler);

    return () => {
      window.removeEventListener('message', handler);
    };
  }, [updateSnapshot, updateNow, updateBefore, updateNext, updateRestore]);
}

