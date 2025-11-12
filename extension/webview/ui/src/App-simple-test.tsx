/**
 * Test minimal avec les 4 views sans Tabs custom
 */

import { useState } from 'react';
import { useStoreSync } from './api/rl4Hooks';
import { Now } from './views/Now';
import { Before } from './views/Before';
import { Next } from './views/Next';
import { Restore } from './views/Restore';
import './styles/globals.css';

export default function App() {
  useStoreSync();
  const [activeTab, setActiveTab] = useState('now');

  return (
    <div className="rl4-layout">
      <header className="rl4-header">
        <div className="rl4-header__logo">
          🧠 RL4 Cognitive OS (Test)
        </div>
      </header>

      <nav style={{ display: 'flex', gap: '1rem', padding: '1rem' }}>
        <button onClick={() => setActiveTab('now')}>🧠 Now</button>
        <button onClick={() => setActiveTab('before')}>🕒 Before</button>
        <button onClick={() => setActiveTab('next')}>➡️ Next</button>
        <button onClick={() => setActiveTab('restore')}>🧳 Restore</button>
      </nav>

      <main className="rl4-main">
        {activeTab === 'now' && <Now />}
        {activeTab === 'before' && <Before />}
        {activeTab === 'next' && <Next />}
        {activeTab === 'restore' && <Restore />}
      </main>
    </div>
  );
}


