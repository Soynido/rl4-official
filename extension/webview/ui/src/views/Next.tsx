import { useRL4Store } from '@/api/useRL4Store';
import { buildNextPrompt } from '@/utils/prompts';

export function Next() {
  const next = useRL4Store(s => s.next);
  const prompt = buildNextPrompt(next);

  return (
    <div className="rl4-card">
      <div className="rl4-card__header">
        <h2 className="rl4-card__title">Next — Agent Bootstrap</h2>
        <button
          className="rl4-btn rl4-btn--primary"
          onClick={() => navigator.clipboard.writeText(prompt)}
          disabled={!next}
        >
          📋 Copy Next-Steps Bootstrap
        </button>
      </div>
      <div className="rl4-card__body">
        <pre className="rl4-code">{prompt}</pre>
      </div>
    </div>
  );
}