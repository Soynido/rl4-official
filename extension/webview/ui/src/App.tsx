/**
 * RL4 WebView UI — Smart UI with LLM-Validated KPIs
 * Phase E4: Transform "data display" into "actionable insights"
 */

import { useState, useEffect } from 'react';
import './App.css';
import { 
  CognitiveLoadCard, 
  NextStepsCard, 
  PlanDriftCard, 
  RisksCard 
} from './components';
import { 
  parseContextRL4, 
  getMockKPIData,
  type CognitiveLoadData,
  type NextTasksData,
  type PlanDriftData,
  type RisksData
} from './utils/contextParser';

// Declare vscode API
declare global {
  interface Window {
    vscode?: {
      postMessage: (message: any) => void;
    };
    acquireVsCodeApi?: () => {
      postMessage: (message: any) => void;
    };
  }
}

type DeviationMode = 'strict' | 'flexible' | 'exploratory' | 'free';

export default function App() {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [deviationMode, setDeviationMode] = useState<DeviationMode>('flexible');
  
  // KPI States
  const [cognitiveLoad, setCognitiveLoad] = useState<CognitiveLoadData | null>(null);
  const [nextTasks, setNextTasks] = useState<NextTasksData | null>(null);
  const [planDrift, setPlanDrift] = useState<PlanDriftData | null>(null);
  const [risks, setRisks] = useState<RisksData | null>(null);
  const [showKPIs, setShowKPIs] = useState(false);

  // Listen for messages from extension
  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      console.log('[RL4 WebView] Received message:', message.type);
      
      switch (message.type) {
        case 'snapshotGenerated':
          console.log('[RL4 WebView] Snapshot received, length:', message.payload?.length);
          setPrompt(message.payload);
          setLoading(false);
          
          // Copy to clipboard automatically
          if (message.payload) {
            navigator.clipboard.writeText(message.payload).then(() => {
              setFeedback('✅ Copied to clipboard!');
              setTimeout(() => setFeedback(null), 3000);
            }).catch(err => {
              console.error('[RL4] Clipboard error:', err);
              setFeedback('❌ Copy failed');
              setTimeout(() => setFeedback(null), 3000);
            });
          }
          break;
          
        case 'error':
          console.error('[RL4 WebView] Error:', message.payload);
          setLoading(false);
          setFeedback('❌ Error generating snapshot');
          setTimeout(() => setFeedback(null), 3000);
          break;
          
        case 'kpisUpdated':
          console.log('[RL4 WebView] KPIs updated:', message.payload);
          if (message.payload) {
            const parsed = parseContextRL4(message.payload);
            setCognitiveLoad(parsed.cognitiveLoad);
            setNextTasks(parsed.nextSteps);
            setPlanDrift(parsed.planDrift);
            setRisks(parsed.risks);
            setShowKPIs(true);
            setFeedback('✅ KPIs updated from Context.RL4');
            setTimeout(() => setFeedback(null), 3000);
          }
          break;
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []);
  
  // Load mock KPIs on mount for development
  useEffect(() => {
    const mockData = getMockKPIData();
    setCognitiveLoad(mockData.cognitiveLoad);
    setNextTasks(mockData.nextTasks);
    setPlanDrift(mockData.planDrift);
    setRisks(mockData.risks);
    setShowKPIs(true);
  }, []);

  // Generate snapshot handler
  const handleGenerateSnapshot = () => {
    setLoading(true);
    setFeedback(null);
    
    console.log('[RL4 WebView] Requesting snapshot with mode:', deviationMode);
    
    if (window.vscode) {
      window.vscode.postMessage({ 
        type: 'generateSnapshot',
        deviationMode 
      });
    } else {
      console.error('[RL4] vscode API not available');
      setLoading(false);
      setFeedback('❌ VS Code API unavailable');
    }
  };

  return (
    <div className="rl4-layout">
      {/* Header */}
      <header className="rl4-header">
        <div className="rl4-logo">
          <span className="rl4-icon">🧠</span>
          <h1>RL4 — Dev Continuity System</h1>
        </div>
        <div className="rl4-tagline">
          <p>Single Context Snapshot. Zero Confusion. Full Feedback Loop.</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="rl4-main">
        <div className="rl4-hero">
          {/* Deviation Mode Selector */}
          <div className="deviation-mode-selector">
            <label htmlFor="deviation-mode">🎯 Perception Angle:</label>
            <select 
              id="deviation-mode"
              value={deviationMode}
              onChange={(e) => setDeviationMode(e.target.value as DeviationMode)}
              disabled={loading}
            >
              <option value="strict">🔴 Strict (0%) — P0 only</option>
              <option value="flexible">🟡 Flexible (25%) — P0+P1 OK</option>
              <option value="exploratory">🟢 Exploratory (50%) — New ideas welcome</option>
              <option value="free">⚪ Free (100%) — Creative mode</option>
            </select>
          </div>

          <button 
            onClick={handleGenerateSnapshot}
            disabled={loading}
            className="generate-button"
          >
            {loading ? '⏳ Generating Snapshot...' : '📋 Generate Context Snapshot'}
          </button>

          {feedback && (
            <div className={`feedback ${feedback.includes('✅') ? 'success' : 'error'}`}>
              {feedback}
            </div>
          )}

          <div className="rl4-instructions">
            <p><strong>How it works:</strong></p>
            <ol>
              <li>Click button → Prompt generated & copied</li>
              <li>Paste in Cursor/Claude → Agent analyzes</li>
              <li>Agent updates <code>.reasoning_rl4/Plan.RL4</code>, <code>Tasks.RL4</code>, <code>Context.RL4</code></li>
              <li>RL4 detects changes → Updates internal state</li>
              <li>Next snapshot includes your updates ✅</li>
            </ol>
          </div>
        </div>

        {/* KPI Dashboard */}
        {showKPIs && (
          <div className="kpi-dashboard">
            <div className="kpi-dashboard-header">
              <h2>📊 Workspace Insights</h2>
              <p className="kpi-disclaimer">
                ✅ Real-time metrics from your workspace activity
              </p>
            </div>
            
            <div className="kpi-grid">
              {cognitiveLoad && (
                <CognitiveLoadCard 
                  percentage={cognitiveLoad.percentage}
                  level={cognitiveLoad.level}
                  metrics={cognitiveLoad.metrics}
                />
              )}
              
              {nextTasks && (
                <NextStepsCard 
                  mode={nextTasks.mode}
                  steps={nextTasks.steps}
                />
              )}
              
              {planDrift && (
                <PlanDriftCard 
                  percentage={planDrift.percentage}
                  threshold={planDrift.threshold}
                  changes={planDrift.changes}
                />
              )}
              
              {risks && (
                <RisksCard risks={risks.risks} />
              )}
            </div>
          </div>
        )}

        {/* Prompt Preview */}
        {prompt && (
          <div className="prompt-preview">
            <div className="prompt-header">
              <h3>📋 Context Snapshot</h3>
              <span className="prompt-length">{prompt.length} characters</span>
            </div>
            
            <pre className="prompt-content">
              {prompt.substring(0, 1500)}
              {prompt.length > 1500 && '\n\n... (full prompt copied to clipboard)'}
            </pre>

            <button 
              onClick={() => {
                navigator.clipboard.writeText(prompt).then(() => {
                  setFeedback('✅ Copied again!');
                  setTimeout(() => setFeedback(null), 2000);
                });
              }}
              className="copy-again-button"
            >
              📋 Copy Again
            </button>
          </div>
        )}

        {/* Info Cards */}
        <div className="info-cards">
          <div className="info-card">
            <h4>🎯 What RL4 Does</h4>
            <p>Collects workspace activity, system health, file patterns, git history, and ADRs.</p>
          </div>
          
          <div className="info-card">
            <h4>🔍 What You Get</h4>
            <p>Complete context: Plan + Tasks + Timeline + Blind Spot Data + Decision History.</p>
          </div>
          
          <div className="info-card">
            <h4>🔄 Feedback Loop</h4>
            <p>Agent updates <code>Plan/Tasks/Context/ADRs.RL4</code> → RL4 parses → Next snapshot reflects changes.</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="rl4-footer">
        <p>RL4 v2.4.0 — Phase E3.3: Single Context Snapshot System</p>
        <p style={{ fontSize: '11px', color: '#666' }}>
          Files: <code>.reasoning_rl4/Plan.RL4</code>, <code>Tasks.RL4</code>, <code>Context.RL4</code>, <code>ADRs.RL4</code>
        </p>
      </footer>
    </div>
  );
}