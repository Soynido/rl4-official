/**
 * RL4 Cognitive OS - Neural Cockpit Main Application
 */

import { useStoreSync } from './api/rl4Hooks';
import { useRL4Store } from './api/useRL4Store';
import { Now } from './views/Now';
import { Before } from './views/Before';
import { Next } from './views/Next';
import { Restore } from './views/Restore';
import { Tabs, Tab } from './components/ui/Tabs';
import './styles/globals.css';

// Tension Indicator Component
const TensionIndicator = ({
  label,
  value,
  level
}: {
  label: string;
  value: number;
  level: 'low' | 'medium' | 'high';
}) => {
  const getTensionClass = () => {
    switch (level) {
      case 'low': return 'rl4-tension-low';
      case 'medium': return 'rl4-tension-medium';
      case 'high': return 'rl4-tension-high';
      default: return 'rl4-tension-low';
    }
  };

  const getTensionColor = () => {
    switch (level) {
      case 'low': return 'var(--rl4-turquoise)';
      case 'medium': return 'var(--rl4-warning)';
      case 'high': return 'var(--rl4-error)';
      default: return 'var(--rl4-turquoise)';
    }
  };

  return (
    <div className="rl4-header__indicator">
      <div className="rl4-header__indicator-label">{label}</div>
      <div
        className={`rl4-header__indicator-value ${getTensionClass()}`}
        style={{ color: getTensionColor() }}
      >
        {Math.round(value * 100)}%
      </div>
    </div>
  );
};

export default function App() {
  // Auto-sync with backend
  useStoreSync();

  const now = useRL4Store((s) => s.now);

  // Always render indicators with default values to avoid hydration issues
  const predictiveDrift = now?.health?.predictiveDrift ?? 0.3;
  const coherence = now?.health?.coherence ?? 0.7;
  const actionAdoption = now?.health?.actionAdoption ?? 0.5;

  // No early return - always render to keep hooks stable
  return (
    <div className="rl4-layout">
      {/* Neural Cockpit Header */}
      <header className="rl4-header">
        {/* Logo Section */}
        <div className="rl4-header__logo">
          <span style={{ marginRight: 'var(--rl4-space-sm)' }}>🧠</span>
          RL4 Cognitive OS
        </div>

        {/* Cognitive Tension Indicators */}
        <div className="rl4-header__center">
          <TensionIndicator
            label="Predictive Drift"
            value={predictiveDrift}
            level={predictiveDrift > 0.6 ? 'high' : predictiveDrift > 0.3 ? 'medium' : 'low'}
          />
          <TensionIndicator
            label="Coherence"
            value={coherence}
            level={coherence > 0.7 ? 'low' : coherence > 0.4 ? 'medium' : 'high'}
          />
          <TensionIndicator
            label="Action Adoption"
            value={actionAdoption}
            level={actionAdoption > 0.7 ? 'low' : actionAdoption > 0.4 ? 'medium' : 'high'}
          />
        </div>

        {/* Stats & Live Status */}
        <div className="rl4-header__stats">
          <span className="rl4-header__stat rl4-header__stat--violet">
            {now?.constraints?.recentADRs?.length ?? 0} ADRs
          </span>
          <span className="rl4-header__stat rl4-header__stat--magenta">
            {now?.patterns?.length ?? 0} Patterns
          </span>
          <span className="rl4-header__stat rl4-header__stat--turquoise">
            {now?.criticalModules?.length ?? 0} Modules
          </span>
          <span className="rl4-badge rl4-badge--live">
            <span style={{ marginRight: 'var(--rl4-space-xs)' }}>●</span>
            LIVE
          </span>
        </div>
      </header>

      {/* Main Content with 4 Tabs */}
      <Tabs defaultValue="now">
        <Tab value="now" label="🧠 Now">
          <Now />
        </Tab>

        <Tab value="before" label="🕒 Before">
          <Before />
        </Tab>

        <Tab value="next" label="➡️ Next">
          <Next />
        </Tab>

        <Tab value="restore" label="🧳 Restore">
          <Restore />
        </Tab>
      </Tabs>
    </div>
  );
}
