import { useRL4Store } from '@/api/useRL4Store';
import { buildNowPrompt } from '@/utils/prompts';

export function Now() {
  const now = useRL4Store(s => s.now);
  const prompt = buildNowPrompt(now);

  return (
    <div className="rl4-card">
      <div className="rl4-card__header">
        <h2 className="rl4-card__title">Now — Cognitive State</h2>
        <button
          className="rl4-btn rl4-btn--primary"
          onClick={() => navigator.clipboard.writeText(prompt)}
          disabled={!now}
        >
          📋 Copy Cognitive State
        </button>
      </div>
      <div className="rl4-card__body">
        <pre className="rl4-code">{prompt}</pre>
      </div>
    </div>
  );
}