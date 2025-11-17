import { useState, useEffect } from 'react';
import './App.css';
import { 
  CognitiveLoadCard, 
  NextStepsCard, 
  PlanDriftCard, 
  RisksCard,
  AnomaliesCard,
  type Anomaly
} from './components';
import { 
  PatternsCard,
  type TaskPattern,
  type PatternAnomaly
} from './components/PatternsCard';
import { 
  parseContextRL4, 
  getMockKPIData,
  type CognitiveLoadData,
  type NextTasksData,
  type PlanDriftData,
  type RisksData
} from './utils/contextParser';
import { logger } from './utils/logger'; // ✅ NEW: Memory-safe logger

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

type DeviationMode = 'strict' | 'flexible' | 'exploratory' | 'free' | 'firstUse';

// FileLink component (defined outside to avoid re-creation on each render)
const FileLink = ({ fileName }: { fileName: string }) => {
  const handleOpenFile = (fileName: string) => {
    if (window.vscode) {
      window.vscode.postMessage({
        type: 'openFile',
        fileName
      });
    } else {
      console.error('[RL4] vscode API not available');
    }
  };

  return (
    <code 
      onClick={() => handleOpenFile(fileName)}
      style={{ 
        cursor: 'pointer', 
        color: 'var(--vscode-textLink-foreground)',
        textDecoration: 'underline'
      }}
      title={`Click to open ${fileName} in editor`}
    >
      {fileName}
    </code>
  );
};

export default function App() {
  // Tabs and Dev proposals state
  const [activeTab, setActiveTab] = useState<'control' | 'dev' | 'insights' | 'about'>('control');
  const [devBadge, setDevBadge] = useState<{ newCount: number; changedCount: number }>({ newCount: 0, changedCount: 0 });
  const [proposals, setProposals] = useState<Array<{
    id: string;
    title: string;
    why?: string;
    effort?: string;
    roi?: number;
    risk?: string;
    bias?: number;
    deps?: string[];
    scope?: string;
    possibleDuplicateOf?: string | null;
  }>>([]);
  const [patchPreview, setPatchPreview] = useState<any | null>(null);
  const [taskVerifications, setTaskVerifications] = useState<Array<{
    taskId: string;
    verified: boolean;
    verifiedAt?: string;
    matchedConditions: string[];
    matchedEvents: any[];
    confidence: 'low' | 'medium' | 'high';
    suggestion: string;
  }>>([]);
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
  
  // GitHub connection state
  const [githubStatus, setGithubStatus] = useState<{ connected: boolean; repo?: string; reason?: string } | null>(null);
  
  // Commit prompt state
  const [commitPrompt, setCommitPrompt] = useState<string | null>(null);
  const [commitCommand, setCommitCommand] = useState<string | null>(null);
  const [commitWhy, setCommitWhy] = useState<string | null>(null);
  const [commitPreview, setCommitPreview] = useState<{ title?: string; body?: string } | null>(null);
  
  // Snapshot metadata state
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [compressionMetrics, setCompressionMetrics] = useState<{
    originalSize: number;
    optimizedSize: number;
    reductionPercent: number;
    mode: string;
  } | null>(null);

  // Terminal Patterns state
  const [patterns, setPatterns] = useState<TaskPattern[]>([]);
  const [patternAnomalies, setPatternAnomalies] = useState<PatternAnomaly[]>([]);
  const [insightsSubTab, setInsightsSubTab] = useState<'kpis' | 'patterns'>('kpis');

  // Auto-Suggestions state
  interface TaskSuggestion {
    taskId: string;
    taskTitle: string;
    suggestedCondition: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    reason: string;
    matchedPattern?: {
      taskId: string;
      taskTitle?: string;
      runsCount: number;
      successRate: number;
    };
  }
  const [suggestions, setSuggestions] = useState<TaskSuggestion[]>([]);

  // Ad-Hoc Actions state
  interface AdHocAction {
    timestamp: string;
    action: 'npm_install' | 'file_created' | 'git_commit' | 'terminal_command' | 'manual_marker';
    command?: string;
    file?: string;
    commitMessage?: string;
    marker?: string;
    suggestedTask: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    reason: string;
    linkedTaskId?: string;
  }
  const [adHocActions, setAdHocActions] = useState<AdHocAction[]>([]);

  // Listen for messages from extension
  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      logger.log('[RL4 WebView] Received message:', message.type); // ✅ FIXED: Memory-safe logging
      
      switch (message.type) {
        case 'proposalsUpdated':
          // payload: { suggestedTasks: [...], counts?: { newCount, changedCount } }
          setProposals(Array.isArray(message.payload?.suggestedTasks) ? message.payload.suggestedTasks : []);
          if (message.payload?.counts) {
            setDevBadge({
              newCount: message.payload.counts.newCount ?? 0,
              changedCount: message.payload.counts.changedCount ?? 0
            });
          } else {
            setDevBadge({ newCount: message.payload?.suggestedTasks?.length ?? 0, changedCount: 0 });
          }
          break;
        
        case 'taskLogChanged':
          // payload: { newCount, changedCount }
          if (message.payload) {
            setDevBadge({
              newCount: message.payload.newCount ?? devBadge.newCount,
              changedCount: message.payload.changedCount ?? devBadge.changedCount
            });
          }
          break;
        case 'patchPreview':
          setPatchPreview(message.payload || null);
          setFeedback('🧪 Patch preview ready');
          setTimeout(() => setFeedback(null), 2000);
          break;
        case 'snapshotGenerated':
          logger.log('[RL4 WebView] Snapshot received, length:', message.payload?.length); // ✅ FIXED
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
          
        case 'snapshotMetadata':
          logger.log('[RL4 WebView] Snapshot metadata received:', message.payload); // ✅ FIXED
          if (message.payload) {
            const anomalies = message.payload.anomalies || [];
            const compression = message.payload.compression || null;
            logger.log(`[RL4 WebView] Setting ${anomalies.length} anomalies, compression: ${compression ? compression.reductionPercent.toFixed(1) + '%' : 'null'}`); // ✅ FIXED
            setAnomalies(anomalies);
            setCompressionMetrics(compression);
          } else {
            logger.warn('[RL4 WebView] snapshotMetadata received but payload is empty'); // ✅ FIXED
          }
          break;
          
        case 'taskVerificationResults':
          logger.log('[RL4 WebView] Task verification results received:', message.payload); // ✅ FIXED
          if (message.payload && message.payload.results) {
            setTaskVerifications(message.payload.results || []);
            setFeedback(`✅ ${message.payload.results.length} task(s) verified`);
            setTimeout(() => setFeedback(null), 3000);
          }
          break;

        case 'taskMarkedDone':
          logger.log('[RL4 WebView] Task marked as done:', message.payload); // ✅ FIXED
          if (message.payload && message.payload.taskId) {
            // Remove the verification for this task since it's now done
            setTaskVerifications(prev => prev.filter(v => v.taskId !== message.payload.taskId));
            setFeedback(`✅ Task ${message.payload.taskId} marked as done`);
            setTimeout(() => setFeedback(null), 3000);
          }
          break;
        
        case 'llmResponseImported':
          logger.log('[RL4 WebView] LLM response imported:', message.payload);
          if (message.payload && message.payload.stats) {
            const { patterns, correlations, forecasts, adrs } = message.payload.stats;
            setFeedback(`✅ Imported: ${patterns} patterns, ${correlations} correlations, ${forecasts} forecasts, ${adrs} evidence`);
            setTimeout(() => setFeedback(null), 5000);
          }
          break;
        
        case 'llmImportError':
          logger.error('[RL4 WebView] LLM import error:', message.payload);
          setFeedback(`❌ Import failed: ${message.payload?.message || 'Unknown error'}`);
          setTimeout(() => setFeedback(null), 5000);
          break;
          
        case 'tasksLoaded':
          logger.log('[RL4 WebView] Tasks.RL4 loaded'); // ✅ FIXED
          // For now, just log it. In the future, we can parse and display active tasks
          // in the Dev tab
          break;
          
        case 'adrsLoaded':
          logger.log('[RL4 WebView] ADRs.RL4 loaded'); // ✅ FIXED
          // For now, just log it. In the future, we can parse and display ADRs
          // in the Insights tab
          break;
          
        case 'kpisUpdated':
          logger.log('[RL4 WebView] KPIs updated:', message.payload); // ✅ FIXED
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
          
        case 'githubStatus':
          logger.log('[RL4 WebView] GitHub status:', message.payload); // ✅ FIXED
          setGithubStatus(message.payload);
          break;
          
        case 'githubConnected':
          setFeedback('✅ GitHub connected successfully!');
          setTimeout(() => setFeedback(null), 3000);
          // Request updated status
          if (window.vscode) {
            window.vscode.postMessage({ type: 'checkGitHubStatus' });
          }
          break;
          
        case 'githubError':
          setFeedback(`❌ GitHub connection failed: ${message.payload || 'Unknown error'}`);
          setTimeout(() => setFeedback(null), 5000);
          break;
          
        case 'commitPromptGenerated':
          setCommitPrompt(message.payload);
          setFeedback('✅ Commit prompt copied to clipboard!');
          setTimeout(() => setFeedback(null), 3000);
          break;
          
        case 'commitCommandReceived':
          setCommitCommand(message.payload);
          setFeedback('✅ GH CLI command received from LLM');
          setTimeout(() => setFeedback(null), 3000);
          break;
          
        case 'commitExecuted':
          setFeedback('✅ Commit created successfully!');
          setCommitCommand(null);
          setCommitPrompt(null);
          setCommitWhy(null);
          setCommitPreview(null);
          setTimeout(() => setFeedback(null), 3000);
          break;
        
        case 'patternsUpdated':
          logger.log('[RL4 WebView] Patterns updated:', message.payload); // ✅ FIXED
          if (message.payload) {
            setPatterns(message.payload.patterns || []);
            setPatternAnomalies(message.payload.anomalies || []);
            setFeedback(`✅ ${message.payload.patterns?.length || 0} patterns loaded`);
            setTimeout(() => setFeedback(null), 2000);
          }
          break;

        case 'suggestionsUpdated':
          logger.log('[RL4 WebView] Suggestions updated:', message.payload);
          if (message.payload) {
            setSuggestions(message.payload.suggestions || []);
            if (message.payload.suggestions && message.payload.suggestions.length > 0) {
              setFeedback(`💡 ${message.payload.suggestions.length} suggestions generated`);
              setTimeout(() => setFeedback(null), 2000);
            }
          }
          break;

        case 'suggestionApplied':
          logger.log('[RL4 WebView] Suggestion applied:', message.payload);
          if (message.payload?.success) {
            setFeedback(`✅ Suggestion applied for task ${message.payload.taskId}`);
            setTimeout(() => setFeedback(null), 2000);
            // Refresh suggestions after successful apply
            if (window.vscode) {
              window.vscode.postMessage({ type: 'requestSuggestions' });
            }
          } else {
            setFeedback(`❌ Failed to apply suggestion: ${message.payload?.error || 'Unknown error'}`);
            setTimeout(() => setFeedback(null), 3000);
          }
          break;

        case 'adHocActionsUpdated':
          logger.log('[RL4 WebView] Ad-hoc actions updated:', message.payload);
          if (message.payload) {
            setAdHocActions(message.payload.actions || []);
            if (message.payload.actions && message.payload.actions.length > 0) {
              setFeedback(`🔍 ${message.payload.actions.length} ad-hoc actions detected`);
              setTimeout(() => setFeedback(null), 2000);
            }
          }
          break;
          
        case 'commitError':
          setFeedback(`❌ Commit failed: ${message.payload || 'Unknown error'}`);
          setTimeout(() => setFeedback(null), 5000);
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
    
    logger.log('[RL4 WebView] Requesting snapshot with mode:', deviationMode); // ✅ FIXED
    
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
  
  // Connect GitHub handler
  const handleConnectGitHub = () => {
    if (window.vscode) {
      window.vscode.postMessage({ 
        type: 'connectGitHub'
      });
      setFeedback('🔗 Opening GitHub token setup...');
    } else {
      console.error('[RL4] vscode API not available');
      setFeedback('❌ VS Code API unavailable');
    }
  };

  // Check GitHub status on mount
  useEffect(() => {
    if (window.vscode) {
      window.vscode.postMessage({ type: 'checkGitHubStatus' });
    }
  }, []);

  // Generate commit prompt handler
  const handleGenerateCommitPrompt = () => {
    if (window.vscode) {
      window.vscode.postMessage({ type: 'generateCommitPrompt' });
      setFeedback('🔍 Collecting commit context...');
    }
  };

  // Validate and execute commit
  const handleValidateCommit = () => {
    if (!commitCommand) return;
    
    // Extract command from RL4 validation token if present
    let commandToExecute = commitCommand;
    
    if (commitCommand.includes('RL4_COMMIT_VALIDATE')) {
      // Parse the validation token block (handle both single-line and multi-line formats)
      const tokenMatch = commitCommand.match(/RL4_COMMIT_VALIDATE\s*(.+?)\s*RL4_COMMIT_END/s);
      if (tokenMatch) {
        const tokenContent = tokenMatch[1];
        const commandMatch = tokenContent.match(/COMMAND:\s*(.+?)(?:\s*RL4_COMMIT_END|$)/s);
        if (commandMatch) {
          commandToExecute = commandMatch[1].trim().replace(/\s+/g, ' ');
        } else {
          setFeedback('❌ Could not extract command from validation token');
          setTimeout(() => setFeedback(null), 3000);
          return;
        }
      } else {
        setFeedback('❌ Invalid validation token format');
        setTimeout(() => setFeedback(null), 3000);
        return;
      }
    }
    
    // Validate command format
    if (!commandToExecute.includes('gh pr create')) {
      setFeedback('❌ Invalid command format. Must be a gh pr create command.');
      setTimeout(() => setFeedback(null), 3000);
      return;
    }
    
    if (window.vscode) {
      window.vscode.postMessage({ 
        type: 'executeCommitCommand',
        command: commandToExecute
      });
      setFeedback('⏳ Creating commit...');
    }
  };

  const handleMarkTaskDone = (taskId: string) => {
    if (window.vscode) {
      window.vscode.postMessage({
        type: 'markTaskDone',
        taskId
      });
      setFeedback(`⏳ Marking task ${taskId} as done...`);
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
        {/* Tabs: Control / Dev / Insights / About */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button
            onClick={() => setActiveTab('control')}
            className={`tab-button ${activeTab === 'control' ? 'active' : ''}`}
            style={{
              padding: '6px 10px',
              border: '1px solid var(--vscode-input-border)',
              backgroundColor: activeTab === 'control' ? 'var(--vscode-input-background)' : 'transparent',
              color: 'var(--vscode-foreground)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🛠️ Control
          </button>
          <button
            onClick={() => {
              setActiveTab('dev');
              // acknowledge new items when opening
              setDevBadge(prev => ({ ...prev, newCount: 0 }));
              // Request suggestions and ad-hoc actions when Dev tab opens
              if (window.vscode) {
                window.vscode.postMessage({ type: 'requestSuggestions' });
                window.vscode.postMessage({ type: 'requestAdHocActions' });
              }
            }}
            className={`tab-button ${activeTab === 'dev' ? 'active' : ''}`}
            style={{
              padding: '6px 10px',
              border: '1px solid var(--vscode-input-border)',
              backgroundColor: activeTab === 'dev' ? 'var(--vscode-input-background)' : 'transparent',
              color: 'var(--vscode-foreground)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              position: 'relative'
            }}
          >
            👨‍💻 Dev
            {(devBadge.newCount > 0 || devBadge.changedCount > 0) && (
              <span
                title="New proposals / Changes"
                style={{
                  marginLeft: '8px',
                  background: '#d32f2f',
                  color: 'white',
                  borderRadius: '10px',
                  padding: '0 6px',
                  fontSize: '10px',
                  lineHeight: '16px'
                }}
              >
                {devBadge.newCount + devBadge.changedCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={`tab-button ${activeTab === 'insights' ? 'active' : ''}`}
            style={{
              padding: '6px 10px',
              border: '1px solid var(--vscode-input-border)',
              backgroundColor: activeTab === 'insights' ? 'var(--vscode-input-background)' : 'transparent',
              color: 'var(--vscode-foreground)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            📊 Insights
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`tab-button ${activeTab === 'about' ? 'active' : ''}`}
            style={{
              padding: '6px 10px',
              border: '1px solid var(--vscode-input-border)',
              backgroundColor: activeTab === 'about' ? 'var(--vscode-input-background)' : 'transparent',
              color: 'var(--vscode-foreground)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            ℹ️ About
          </button>
        </div>

        {activeTab === 'control' && (
        <div className="rl4-hero">
          {/* Deviation Mode Selector */}
          <div className="deviation-mode-selector">
            <label htmlFor="deviation-mode">🎯 Calibrate your coding Agent:</label>
            <select 
              id="deviation-mode"
              value={deviationMode}
              onChange={(e) => setDeviationMode(e.target.value as DeviationMode)}
              disabled={loading}
              className={deviationMode === 'firstUse' ? 'first-use-mode' : ''}
            >
              <optgroup label="Standard Modes">
                <option value="strict">🔴 Strict — Focus on existing plan only</option>
                <option value="flexible">🟡 Flexible — Allow small improvements</option>
                <option value="exploratory">🟢 Exploratory — Welcome new ideas</option>
                <option value="free">⚪ Free — Creative mode, no constraints</option>
              </optgroup>
              <optgroup label="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━">
                <option value="firstUse">
                  🔍 First Use — Deep project analysis (~5s)
                </option>
              </optgroup>
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

          {/* GitHub Connection */}
          <div className="github-connection" style={{ marginTop: '20px', padding: '15px', border: '1px solid var(--vscode-input-border)', borderRadius: '4px', backgroundColor: 'var(--vscode-input-background)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div>
                <strong>🔗 GitHub Integration</strong>
                {githubStatus && (
                  <span style={{ marginLeft: '10px', fontSize: '12px', color: githubStatus.connected ? '#4caf50' : '#ff9800' }}>
                    {githubStatus.connected 
                      ? `✅ Connected to ${githubStatus.repo || 'repository'}`
                      : `⚠️ ${githubStatus.reason === 'no_repo' ? 'No repository detected' : githubStatus.reason === 'missing_token' ? 'No token configured' : 'Not connected'}`
                    }
                  </span>
                )}
              </div>
              <button
                onClick={handleConnectGitHub}
                style={{
                  padding: '6px 12px',
                  backgroundColor: githubStatus?.connected ? 'var(--vscode-button-secondaryBackground)' : 'var(--vscode-button-background)',
                  color: 'var(--vscode-button-foreground)',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                {githubStatus?.connected ? '🔄 Reconnect' : '🔗 Connect GitHub'}
              </button>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', margin: 0 }}>
              Connect your GitHub repository to enable PR/Issue tracking and cognitive analysis.
            </p>
          </div>

          {/* Commit with WHY */}
          {githubStatus?.connected && (
            <div className="commit-enrichment" style={{ marginTop: '20px', padding: '15px', border: '1px solid var(--vscode-input-border)', borderRadius: '4px', backgroundColor: 'var(--vscode-input-background)' }}>
              <div style={{ marginBottom: '10px' }}>
                <strong>📝 Generate Commit with WHY</strong>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginBottom: '10px' }}>
                Generate a commit prompt with RL4 context. Paste it in your LLM to get WHY + GH CLI command.
              </p>
              <button
                onClick={handleGenerateCommitPrompt}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'var(--vscode-button-background)',
                  color: 'var(--vscode-button-foreground)',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  marginRight: '10px'
                }}
              >
                📋 Generate Commit Prompt
              </button>
              
              {commitPrompt && (
                <div style={{ marginTop: '15px', padding: '10px', backgroundColor: 'var(--vscode-textBlockQuote-background)', borderRadius: '4px' }}>
                  <strong>✅ Prompt copied! Paste it in your LLM, then paste the RL4 validation token below:</strong>
                  <textarea
                    placeholder="Paste the RL4_COMMIT_VALIDATE block from your LLM response here..."
                    value={commitCommand || ''}
                    onChange={(e) => {
                      const text = e.target.value;
                      setCommitCommand(text);
                      
                      // Auto-detect and parse RL4 validation token
                      if (text.includes('RL4_COMMIT_VALIDATE') && text.includes('RL4_COMMIT_END')) {
                        // Extract token block (handle both single-line and multi-line formats)
                        const tokenMatch = text.match(/RL4_COMMIT_VALIDATE\s*(.+?)\s*RL4_COMMIT_END/s);
                        if (tokenMatch) {
                          const tokenContent = tokenMatch[1];
                          
                          // Extract WHY (handle both \n and spaces as separators)
                          const whyMatch = tokenContent.match(/WHY:\s*(.+?)(?:\s+COMMAND:|COMMAND:)/s);
                          if (whyMatch) {
                            setCommitWhy(whyMatch[1].trim().replace(/\s+/g, ' '));
                          }
                          
                          // Extract command (handle both \n and spaces as separators)
                          const commandMatch = tokenContent.match(/COMMAND:\s*(.+?)(?:\s*RL4_COMMIT_END|$)/s);
                          if (commandMatch) {
                            const extractedCommand = commandMatch[1].trim().replace(/\s+/g, ' ');
                            
                            // Extract title and body from command for preview
                            const titleMatch = extractedCommand.match(/--title\s+"((?:[^"\\]|\\.)+)"/);
                            const bodyMatch = extractedCommand.match(/--body\s+"((?:[^"\\]|\\.)+)"/);
                            
                            setCommitPreview({
                              title: titleMatch ? titleMatch[1].replace(/\\(.)/g, '$1') : undefined,
                              body: bodyMatch ? bodyMatch[1].replace(/\\n/g, '\n').replace(/\\(.)/g, '$1') : undefined
                            });
                          }
                        }
                      } else if (text.includes('gh pr create')) {
                        // Direct command without token - try to extract preview
                        const titleMatch = text.match(/--title\s+"([^"]+)"/);
                        const bodyMatch = text.match(/--body\s+"([^"]+)"/);
                        
                        setCommitPreview({
                          title: titleMatch ? titleMatch[1] : undefined,
                          body: bodyMatch ? bodyMatch[1].replace(/\\n/g, '\n') : undefined
                        });
                      }
                    }}
                    style={{
                      width: '100%',
                      minHeight: '120px',
                      marginTop: '10px',
                      padding: '8px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      backgroundColor: 'var(--vscode-editor-background)',
                      color: 'var(--vscode-editor-foreground)',
                      border: '1px solid var(--vscode-input-border)',
                      borderRadius: '2px',
                      resize: 'vertical'
                    }}
                  />
                  <p style={{ fontSize: '10px', color: 'var(--vscode-descriptionForeground)', marginTop: '5px', marginBottom: '0' }}>
                    💡 Tip: Paste the entire RL4_COMMIT_VALIDATE block from your LLM. The command will be extracted automatically.
                  </p>
                  {commitCommand && commitCommand.includes('gh pr create') && (
                    <div style={{ marginTop: '15px' }}>
                      {/* WHY Display */}
                      {commitWhy && (
                        <div style={{ 
                          padding: '10px', 
                          backgroundColor: 'var(--vscode-textBlockQuote-background)', 
                          borderRadius: '4px',
                          marginBottom: '10px',
                          borderLeft: '3px solid #4caf50'
                        }}>
                          <strong style={{ fontSize: '11px', color: '#4caf50' }}>💡 WHY:</strong>
                          <p style={{ fontSize: '11px', marginTop: '5px', marginBottom: '0' }}>
                            {commitWhy}
                          </p>
                        </div>
                      )}
                      
                      {/* Commit Preview */}
                      {commitPreview && (
                        <div style={{ 
                          padding: '10px', 
                          backgroundColor: 'var(--vscode-editor-background)', 
                          borderRadius: '4px',
                          marginBottom: '10px'
                        }}>
                          <strong style={{ fontSize: '11px' }}>🔍 Commit Preview:</strong>
                          <div style={{ marginTop: '8px' }}>
                            <div style={{ marginBottom: '8px' }}>
                              <strong style={{ fontSize: '10px', color: 'var(--vscode-textLink-foreground)' }}>Title:</strong>
                              <div style={{ 
                                fontSize: '10px', 
                                marginTop: '3px',
                                padding: '5px',
                                backgroundColor: 'var(--vscode-input-background)',
                                borderRadius: '2px'
                              }}>
                                {commitPreview.title || 'N/A'}
                              </div>
                            </div>
                            {commitPreview.body && (
                              <div>
                                <strong style={{ fontSize: '10px', color: 'var(--vscode-textLink-foreground)' }}>Body:</strong>
                                <pre style={{ 
                                  fontSize: '9px', 
                                  marginTop: '3px',
                                  padding: '5px',
                                  backgroundColor: 'var(--vscode-input-background)',
                                  borderRadius: '2px',
                                  whiteSpace: 'pre-wrap',
                                  maxHeight: '200px',
                                  overflow: 'auto',
                                  wordBreak: 'break-word'
                                }}>
                                  {commitPreview.body}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Validation Buttons */}
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          onClick={handleValidateCommit}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#4caf50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '2px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}
                        >
                          ✅ Validate & Execute
                        </button>
                        <button
                          onClick={() => {
                            setCommitCommand(null);
                            setCommitPrompt(null);
                            setCommitWhy(null);
                            setCommitPreview(null);
                          }}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: 'var(--vscode-button-secondaryBackground)',
                            color: 'var(--vscode-button-foreground)',
                            border: 'none',
                            borderRadius: '2px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          ❌ Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="rl4-instructions">
            <p><strong>How it works:</strong></p>
            <ol>
              <li><strong>Generate</strong> → Click button, prompt is generated & copied to clipboard</li>
              <li><strong>Analyze</strong> → Paste in your AI agent (Cursor/Claude), it analyzes your project context</li>
              <li><strong>Update</strong> → Agent updates <FileLink fileName="Plan.RL4" />, <FileLink fileName="Tasks.RL4" />, <FileLink fileName="Context.RL4" />, <FileLink fileName="ADRs.RL4" /></li>
              <li><strong>Sync</strong> → RL4 automatically detects changes and updates its internal state</li>
              <li><strong>Iterate</strong> → Next snapshot includes all your updates, creating a feedback loop ✅</li>
            </ol>
          </div>
        </div>
        )}

        {activeTab === 'dev' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Import LLM Response Button */}
            <div style={{ marginBottom: '8px' }}>
              <button
                onClick={() => {
                  if (window.vscode) {
                    window.vscode.postMessage({ type: 'importLLMResponse' });
                  }
                }}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  fontSize: '13px',
                  background: 'var(--vscode-button-background)',
                  color: 'var(--vscode-button-foreground)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                📥 Import LLM Response (from clipboard)
              </button>
              <p style={{ fontSize: '10px', color: 'var(--vscode-descriptionForeground)', margin: '6px 0 0 0' }}>
                Copy your LLM response (with <code>RL4_PROPOSAL</code> wrapper) and click this button to populate cognitive files.
              </p>
            </div>

            {/* Auto-Suggestions Section */}
            {suggestions.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h2 style={{ margin: 0 }}>💡 Suggested Conditions</h2>
                  <button
                    onClick={() => {
                      if (window.vscode) {
                        window.vscode.postMessage({ type: 'requestSuggestions' });
                      }
                    }}
                    style={{ 
                      padding: '4px 8px', 
                      fontSize: '11px', 
                      background: 'var(--vscode-button-secondaryBackground)', 
                      color: 'var(--vscode-button-foreground)', 
                      border: 'none', 
                      borderRadius: '3px', 
                      cursor: 'pointer' 
                    }}
                  >
                    🔄 Refresh
                  </button>
                </div>
                <div style={{ 
                  border: '1px solid #ff9800', 
                  borderRadius: '4px', 
                  background: 'rgba(255, 152, 0, 0.1)' 
                }}>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {suggestions.map(suggestion => (
                      <li 
                        key={suggestion.taskId} 
                        style={{ 
                          padding: '10px 12px', 
                          borderTop: '1px solid rgba(255, 152, 0, 0.3)',
                          ':first-child': { borderTop: 'none' }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600 }}>
                              {suggestion.taskTitle}
                              <span 
                                style={{ 
                                  marginLeft: '8px',
                                  padding: '2px 6px',
                                  fontSize: '10px',
                                  borderRadius: '3px',
                                  background: suggestion.confidence === 'HIGH' ? '#2e7d32' : suggestion.confidence === 'MEDIUM' ? '#ff9800' : '#757575',
                                  color: 'white'
                                }}
                              >
                                {suggestion.confidence}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '4px' }}>
                              <strong>Suggested:</strong> <code style={{ 
                                background: 'var(--vscode-textCodeBlock-background)', 
                                padding: '2px 4px', 
                                borderRadius: '2px',
                                fontSize: '10px'
                              }}>@rl4:completeWhen="{suggestion.suggestedCondition}"</code>
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--vscode-descriptionForeground)', marginTop: '4px' }}>
                              {suggestion.reason}
                            </div>
                            {suggestion.matchedPattern && (
                              <div style={{ fontSize: '10px', color: 'var(--vscode-descriptionForeground)', marginTop: '4px' }}>
                                📊 Based on similar task: <em>{suggestion.matchedPattern.taskTitle || suggestion.matchedPattern.taskId}</em> ({suggestion.matchedPattern.runsCount} runs, {Math.round(suggestion.matchedPattern.successRate * 100)}% success)
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              if (window.vscode) {
                                window.vscode.postMessage({ 
                                  type: 'applySuggestion', 
                                  payload: { 
                                    taskId: suggestion.taskId, 
                                    suggestedCondition: suggestion.suggestedCondition 
                                  } 
                                });
                              }
                            }}
                            style={{ 
                              padding: '6px 10px', 
                              fontSize: '11px', 
                              background: '#2e7d32', 
                              color: 'white', 
                              border: 'none', 
                              borderRadius: '3px', 
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            ✅ Apply
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Ad-Hoc Actions Section (Suggested from Activity) */}
            {adHocActions.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h2 style={{ margin: 0 }}>🔍 Suggested from Activity</h2>
                  <button
                    onClick={() => {
                      if (window.vscode) {
                        window.vscode.postMessage({ type: 'requestAdHocActions' });
                      }
                    }}
                    style={{ 
                      padding: '4px 8px', 
                      fontSize: '11px', 
                      background: 'var(--vscode-button-secondaryBackground)', 
                      color: 'var(--vscode-button-foreground)', 
                      border: 'none', 
                      borderRadius: '3px', 
                      cursor: 'pointer' 
                    }}
                  >
                    🔄 Refresh
                  </button>
                </div>
                <div style={{ 
                  border: '1px solid #2196f3', 
                  borderRadius: '4px', 
                  background: 'rgba(33, 150, 243, 0.1)' 
                }}>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {adHocActions.slice(0, 10).map((action, index) => (
                      <li 
                        key={`${action.timestamp}-${index}`} 
                        style={{ 
                          padding: '10px 12px', 
                          borderTop: index === 0 ? 'none' : '1px solid rgba(33, 150, 243, 0.3)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600 }}>
                              {action.suggestedTask}
                              <span 
                                style={{ 
                                  marginLeft: '8px',
                                  padding: '2px 6px',
                                  fontSize: '10px',
                                  borderRadius: '3px',
                                  background: action.confidence === 'HIGH' ? '#2e7d32' : action.confidence === 'MEDIUM' ? '#ff9800' : '#757575',
                                  color: 'white'
                                }}
                              >
                                {action.confidence}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '4px' }}>
                              <strong>Type:</strong> {action.action.replace('_', ' ')} • <strong>Time:</strong> {new Date(action.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            {action.command && (
                              <div style={{ fontSize: '10px', color: 'var(--vscode-descriptionForeground)', marginTop: '4px' }}>
                                <code style={{ 
                                  background: 'var(--vscode-textCodeBlock-background)', 
                                  padding: '2px 4px', 
                                  borderRadius: '2px',
                                  fontSize: '9px'
                                }}>{action.command.substring(0, 80)}{action.command.length > 80 ? '...' : ''}</code>
                              </div>
                            )}
                            {action.file && (
                              <div style={{ fontSize: '10px', color: 'var(--vscode-descriptionForeground)', marginTop: '4px' }}>
                                📄 File: <em>{action.file}</em>
                              </div>
                            )}
                            {action.commitMessage && (
                              <div style={{ fontSize: '10px', color: 'var(--vscode-descriptionForeground)', marginTop: '4px' }}>
                                📝 Commit: <em>"{action.commitMessage.substring(0, 60)}{action.commitMessage.length > 60 ? '...' : ''}"</em>
                              </div>
                            )}
                            <div style={{ fontSize: '10px', color: 'var(--vscode-descriptionForeground)', marginTop: '4px', fontStyle: 'italic' }}>
                              {action.reason}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <button
                              onClick={() => {
                                // TODO: Implement create task from ad-hoc action
                                setFeedback('💡 Create task feature coming soon!');
                                setTimeout(() => setFeedback(null), 2000);
                              }}
                              style={{ 
                                padding: '4px 8px', 
                                fontSize: '10px', 
                                background: '#2e7d32', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '3px', 
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              ✅ Create Task
                            </button>
                            <button
                              onClick={() => {
                                // Remove from list
                                setAdHocActions(prev => prev.filter((_, i) => i !== index));
                                setFeedback('🗑️ Action ignored');
                                setTimeout(() => setFeedback(null), 1500);
                              }}
                              style={{ 
                                padding: '4px 8px', 
                                fontSize: '10px', 
                                background: '#9e9e9e', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '3px', 
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              🗑️ Ignore
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                {adHocActions.length > 10 && (
                  <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '8px', textAlign: 'center' }}>
                    Showing 10 of {adHocActions.length} detected actions
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2>🧩 Proposed Tasks (LLM)</h2>
              <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
                New: {devBadge.newCount} · Changes: {devBadge.changedCount}
              </div>
            </div>
            <div style={{ border: '1px solid var(--vscode-input-border)', borderRadius: '4px' }}>
              {proposals.length === 0 ? (
                <div style={{ padding: '12px', fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
                  No proposals yet. Generate a snapshot in Exploratory/Free mode and paste the agent response.
                </div>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {proposals.map(item => (
                    <li key={item.id} style={{ padding: '10px 12px', borderTop: '1px solid var(--vscode-input-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>{item.title}</div>
                          <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '4px' }}>
                            {item.why}
                          </div>
                          <div style={{ fontSize: '10px', marginTop: '6px', display: 'flex', gap: '10px', color: 'var(--vscode-descriptionForeground)' }}>
                            {item.effort && <span>Effort: {item.effort}</span>}
                            {typeof item.roi === 'number' && <span>ROI: {item.roi}/10</span>}
                            {item.risk && <span>Risk: {item.risk}</span>}
                            {typeof item.bias === 'number' && <span>Bias: +{item.bias}%</span>}
                            {item.scope && <span>Scope: {item.scope}</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            title="Accepter en P0"
                            onClick={() => window.vscode?.postMessage({ type: 'submitDecisions', decisions: [{ id: item.id, action: 'accept', priority: 'P0' }] })}
                            style={{ padding: '6px 8px', fontSize: '11px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                          >
                            ✅ Accept (P0)
                          </button>
                          <button
                            title="Accepter en P1"
                            onClick={() => window.vscode?.postMessage({ type: 'submitDecisions', decisions: [{ id: item.id, action: 'accept', priority: 'P1' }] })}
                            style={{ padding: '6px 8px', fontSize: '11px', background: '#388e3c', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                          >
                            ✅ Accept (P1)
                          </button>
                          <button
                            title="Backlog (P2+)"
                            onClick={() => window.vscode?.postMessage({ type: 'submitDecisions', decisions: [{ id: item.id, action: 'backlog', priority: 'P2' }] })}
                            style={{ padding: '6px 8px', fontSize: '11px', background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-foreground)', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                          >
                            📦 Backlog
                          </button>
                          <button
                            title="Rejeter"
                            onClick={() => window.vscode?.postMessage({ type: 'submitDecisions', decisions: [{ id: item.id, action: 'reject' }] })}
                            style={{ padding: '6px 8px', fontSize: '11px', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                          >
                            🗑️ Reject
                          </button>
                        </div>
                      </div>
                      {item.possibleDuplicateOf && (
                        <div style={{ marginTop: '6px', fontSize: '10px', color: '#ffb300' }}>
                          ⚠️ Possible duplicate of external task: {item.possibleDuplicateOf}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            {/* Task Verification Results */}
            {taskVerifications.length > 0 && (
              <div>
                <h3 style={{ margin: '8px 0' }}>✅ Verified Tasks (RL4)</h3>
                <div style={{ border: '1px solid var(--vscode-input-border)', borderRadius: '4px' }}>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {taskVerifications.map(verification => (
                      <li key={verification.taskId} style={{ padding: '10px 12px', borderTop: '1px solid var(--vscode-input-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600 }}>
                              Task #{verification.taskId}
                              <span 
                                style={{ 
                                  marginLeft: '8px',
                                  padding: '2px 6px',
                                  fontSize: '10px',
                                  borderRadius: '3px',
                                  background: verification.confidence === 'high' ? '#2e7d32' : verification.confidence === 'medium' ? '#ff9800' : '#757575',
                                  color: 'white'
                                }}
                              >
                                {verification.confidence.toUpperCase()}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '4px' }}>
                              {verification.suggestion}
                            </div>
                            <div style={{ fontSize: '10px', marginTop: '6px', color: 'var(--vscode-descriptionForeground)' }}>
                              ✅ Matched: {verification.matchedConditions.length} condition(s)
                              {verification.verifiedAt && (
                                <span style={{ marginLeft: '10px' }}>
                                  🕐 {new Date(verification.verifiedAt).toLocaleString()}
                                </span>
                              )}
                            </div>
                            {verification.matchedConditions.length > 0 && (
                              <div style={{ fontSize: '10px', marginTop: '4px', color: 'var(--vscode-descriptionForeground)' }}>
                                <details>
                                  <summary style={{ cursor: 'pointer' }}>📋 Conditions</summary>
                                  <ul style={{ marginTop: '4px', paddingLeft: '20px' }}>
                                    {verification.matchedConditions.map((cond, idx) => (
                                      <li key={idx}>{cond}</li>
                                    ))}
                                  </ul>
                                </details>
                              </div>
                            )}
                          </div>
                          <div>
                            <button
                              onClick={() => handleMarkTaskDone(verification.taskId)}
                              style={{ 
                                padding: '6px 10px', 
                                fontSize: '11px', 
                                background: '#2e7d32', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '3px', 
                                cursor: 'pointer' 
                              }}
                              title="Mark this task as done in Tasks.RL4"
                            >
                              ✅ Mark as Done
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            
            <div>
              <h3 style={{ margin: '8px 0' }}>🧪 Patch Preview</h3>
              {patchPreview ? (
                <div style={{ border: '1px solid var(--vscode-input-border)', borderRadius: '4px', padding: '10px' }}>
                  <pre style={{ fontSize: '11px', whiteSpace: 'pre-wrap', margin: 0 }}>
                    {JSON.stringify(patchPreview, null, 2)}
                  </pre>
                  <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => window.vscode?.postMessage({ type: 'applyPatch', patch: patchPreview })}
                      style={{ padding: '6px 10px', background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' }}
                    >
                      ✅ Apply Patch
                    </button>
                    <button
                      onClick={() => setPatchPreview(null)}
                      style={{ padding: '6px 10px', background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-foreground)', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' }}
                    >
                      ❌ Discard
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
                  Generated after your decisions. A `RL4_TASKS_PATCH` preview will appear here before applying.
                </div>
              )}
            </div>
          </div>
        )}

        {/* KPI Dashboard (Insights tab) */}
        {activeTab === 'insights' && (
          <div className="kpi-dashboard">
            <div className="kpi-dashboard-header">
              <h2>📊 Workspace Insights</h2>
              <p className="kpi-disclaimer">
                ✅ Real-time metrics from your workspace activity
              </p>
            </div>
            
            {/* Insights Sub-Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--vscode-panel-border)', paddingBottom: '8px' }}>
              <button
                onClick={() => setInsightsSubTab('kpis')}
                style={{
                  padding: '8px 16px',
                  background: insightsSubTab === 'kpis' ? 'var(--vscode-button-background)' : 'transparent',
                  color: insightsSubTab === 'kpis' ? 'var(--vscode-button-foreground)' : 'var(--vscode-foreground)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: insightsSubTab === 'kpis' ? '600' : 'normal'
                }}
              >
                📊 KPIs
              </button>
              <button
                onClick={() => {
                  setInsightsSubTab('patterns');
                  // Request patterns from extension
                  if (window.vscode) {
                    window.vscode.postMessage({ type: 'requestPatterns' });
                  }
                }}
                style={{
                  padding: '8px 16px',
                  background: insightsSubTab === 'patterns' ? 'var(--vscode-button-background)' : 'transparent',
                  color: insightsSubTab === 'patterns' ? 'var(--vscode-button-foreground)' : 'var(--vscode-foreground)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: insightsSubTab === 'patterns' ? '600' : 'normal'
                }}
              >
                🧠 Patterns
                {patterns.length > 0 && (
                  <span style={{ 
                    marginLeft: '6px', 
                    padding: '2px 6px', 
                    background: 'var(--vscode-badge-background)', 
                    color: 'var(--vscode-badge-foreground)', 
                    borderRadius: '10px', 
                    fontSize: '11px',
                    fontWeight: '600'
                  }}>
                    {patterns.length}
                  </span>
                )}
              </button>
            </div>
            
            {/* KPIs Sub-Tab */}
            {insightsSubTab === 'kpis' && showKPIs && (
              <>
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
                
                {/* Anomalies Card */}
                {anomalies.length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    <AnomaliesCard anomalies={anomalies} />
          </div>
        )}
              </>
            )}

            {/* Patterns Sub-Tab */}
            {insightsSubTab === 'patterns' && (
              <PatternsCard 
                patterns={patterns} 
                anomalies={patternAnomalies}
              />
            )}
          </div>
        )}

        {/* About Tab */}
        {activeTab === 'about' && (
        <div className="info-cards">
          <div className="info-card">
            <h4>🎯 What RL4 Does</h4>
              <p>Automatically collects your workspace activity, system health, file patterns, git history, and architectural decisions.</p>
          </div>
          
          <div className="info-card">
            <h4>🔍 What You Get</h4>
              <p>A complete context snapshot: your project plan, active tasks, timeline, blind spot data, and decision history — all in one prompt.</p>
          </div>
          
          <div className="info-card">
            <h4>🔄 Feedback Loop</h4>
              <p>Your AI agent updates the RL4 files → RL4 automatically parses changes → Next snapshot reflects all updates, creating a continuous learning cycle.</p>
            </div>
            
            <div className="info-card">
              <h4>📁 RL4 Files</h4>
              <p>All context is stored in <FileLink fileName="Plan.RL4" />, <FileLink fileName="Tasks.RL4" />, <FileLink fileName="Context.RL4" />, and <FileLink fileName="ADRs.RL4" /> — human-readable and AI-friendly.</p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="rl4-footer">
        <p>RL4 — Development Context Snapshot</p>
        <p style={{ fontSize: '11px', color: '#666' }}>
          Files: <FileLink fileName="Plan.RL4" />, <FileLink fileName="Tasks.RL4" />, <FileLink fileName="Context.RL4" />, <FileLink fileName="ADRs.RL4" />
        </p>
      </footer>
    </div>
  );
}
