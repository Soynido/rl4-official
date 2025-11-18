import { useState, useCallback, useMemo } from 'react';
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
  type CognitiveLoadData,
  type NextTasksData,
  type PlanDriftData,
  type RisksData
} from './utils/contextParser';
import { logger } from './utils/logger';
import { useMessageHandler } from './hooks/useMessageHandler';
import { useKernelPolling } from './hooks/useKernelPolling';
import { useFeedbackTimer } from './hooks/useFeedbackTimer';
import { useGitHubIntegration } from './hooks/useGitHubIntegration';
import { useCommitPrompt } from './hooks/useCommitPrompt';
import { useKPIs } from './hooks/useKPIs';
import { createMessageHandlers } from './handlers/messageHandlers';

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
  // ============================================================================
  // HOOKS (Memory-leak free, modular)
  // ============================================================================
  const { feedback, setFeedbackWithTimeout } = useFeedbackTimer();
  const { githubStatus, setGithubStatus, handleConnectGitHub } = useGitHubIntegration();
  const { 
    commitPrompt, 
    setCommitPrompt,
    commitCommand,
    setCommitCommand,
    commitWhy,
    setCommitWhy,
    commitPreview,
    setCommitPreview,
    handleGenerateCommitPrompt,
    handleValidateCommit,
    handleCommitCommandChange,
    resetCommit
  } = useCommitPrompt();
  const { 
    cognitiveLoad, 
    setCognitiveLoad,
    nextTasks, 
    setNextTasks,
    planDrift, 
    setPlanDrift,
    risks, 
    setRisks,
    showKPIs
  } = useKPIs();
  
  // ============================================================================
  // LOCAL UI STATE (kept in App.tsx)
  // ============================================================================
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
  const [deviationMode, setDeviationMode] = useState<DeviationMode>('flexible');
  
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [compressionMetrics, setCompressionMetrics] = useState<{
    originalSize: number;
    optimizedSize: number;
    reductionPercent: number;
    mode: string;
  } | null>(null);

  const [patterns, setPatterns] = useState<TaskPattern[]>([]);
  const [patternAnomalies, setPatternAnomalies] = useState<PatternAnomaly[]>([]);
  const [insightsSubTab, setInsightsSubTab] = useState<'kpis' | 'patterns'>('kpis');

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

  interface KernelStatus {
    ready: boolean;
    message?: string;
    initializing?: boolean;
    error?: boolean;
    safeMode?: boolean;
    status?: {
      running: boolean;
      uptime: number;
      health: any;
      timers: number;
      queueSize: number;
      version: string;
      cycleCount: number;
      safeMode: boolean;
      corruptionReason: string | null;
      cycleHealth?: {
        success: boolean;
        duration: number;
        phases?: any[];
        error?: string;
      };
    };
  }
  const [kernelStatus, setKernelStatus] = useState<KernelStatus | null>(null);

  // ============================================================================
  // MESSAGE HANDLING (Unified, memory-leak free)
  // ============================================================================
  const messageHandlers = useMemo(() => createMessageHandlers({
    setProposals,
    setDevBadge,
    setPatchPreview,
    setPrompt,
    setLoading,
    setAnomalies,
    setCompressionMetrics,
    setTaskVerifications,
    setKernelStatus,
    setPatterns,
    setPatternAnomalies,
    setSuggestions,
    setAdHocActions,
    setFeedbackWithTimeout,
    setGithubStatus,
    setCommitPrompt,
    handleCommitCommandChange,
    resetCommit,
    setCognitiveLoad,
    setNextTasks,
    setPlanDrift,
    setRisks,
    logger,
    parseContextRL4
  }), [
    setFeedbackWithTimeout,
    handleCommitCommandChange,
    resetCommit,
    setCognitiveLoad,
    setNextTasks,
    setPlanDrift,
    setRisks
  ]);

  useMessageHandler(messageHandlers);

  // ============================================================================
  // KERNEL POLLING (Stable, no infinite loop)
  // ============================================================================
  useKernelPolling(kernelStatus?.ready || false);

  // ============================================================================
  // UI HANDLERS (useCallback for performance)
  // ============================================================================
  const handleGenerateSnapshot = useCallback(() => {
    setLoading(true);
    
    logger.log(`[RL4 WebView] Requesting snapshot with mode: ${deviationMode}`);
    
    if (window.vscode) {
      window.vscode.postMessage({ 
        type: 'generateSnapshot',
        deviationMode 
      });
    } else {
      console.error('[RL4] vscode API not available');
      setLoading(false);
      setFeedbackWithTimeout('❌ VS Code API unavailable', 3000);
    }
  }, [deviationMode, setFeedbackWithTimeout]);
  
  const handleMarkTaskDone = useCallback((taskId: string) => {
    if (window.vscode) {
      window.vscode.postMessage({ 
        type: 'markTaskDone',
        taskId
      });
      setFeedbackWithTimeout(`⏳ Marking task ${taskId} as done...`, 2000);
    }
  }, [setFeedbackWithTimeout]);

  const handleOpenControl = useCallback(() => setActiveTab('control'), []);
  const handleOpenDev = useCallback(() => {
    setActiveTab('dev');
    setDevBadge(prev => ({ ...prev, newCount: 0 }));
    if (window.vscode) {
      window.vscode.postMessage({ type: 'requestSuggestions' });
      window.vscode.postMessage({ type: 'requestAdHocActions' });
    }
  }, []);
  const handleOpenInsights = useCallback(() => setActiveTab('insights'), []);
  const handleOpenAbout = useCallback(() => setActiveTab('about'), []);

  const handleInsightsKPIs = useCallback(() => setInsightsSubTab('kpis'), []);
  const handleInsightsPatterns = useCallback(() => {
    setInsightsSubTab('patterns');
    if (window.vscode) {
      window.vscode.postMessage({ type: 'requestPatterns' });
        }
  }, []);


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
            onClick={handleOpenControl}
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
            onClick={handleOpenDev}
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
                  background: 'var(--vscode-inputValidation-errorBorder)',
                  color: 'var(--vscode-editor-background)',
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
            onClick={handleOpenInsights}
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
            onClick={handleOpenAbout}
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
          {/* Kernel Status */}
          {kernelStatus && (
            <div className="kernel-status" style={{ 
              marginBottom: '20px', 
              padding: '15px', 
              border: '1px solid var(--vscode-input-border)', 
              borderRadius: '4px', 
              backgroundColor: 'var(--vscode-input-background)' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <strong>🧠 Kernel Status</strong>
                <span style={{ 
                  fontSize: '12px', 
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: kernelStatus.ready 
                    ? (kernelStatus.status?.safeMode ? 'var(--vscode-inputValidation-warningBackground)' : 'var(--vscode-inputValidation-infoBackground)')
                    : 'var(--vscode-inputValidation-errorBackground)',
                  color: kernelStatus.ready 
                    ? (kernelStatus.status?.safeMode ? 'var(--vscode-inputValidation-warningBorder)' : 'var(--vscode-inputValidation-infoBorder)')
                    : 'var(--vscode-inputValidation-errorBorder)'
                }}>
                  {kernelStatus.ready 
                    ? (kernelStatus.status?.safeMode ? '⚠️ SAFE MODE' : '✅ Ready')
                    : (kernelStatus.initializing ? '⏳ Initializing...' : '❌ Not Ready')
                  }
                </span>
              </div>
              {kernelStatus.ready && kernelStatus.status && (
                <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
                  <div>Cycle: {kernelStatus.status.cycleCount} | Uptime: {Math.floor(kernelStatus.status.uptime / 1000)}s | Timers: {kernelStatus.status.timers}</div>
                  {kernelStatus.status.cycleHealth && (
                    <div style={{ marginTop: '8px', fontSize: '11px' }}>
                      Last Cycle: {kernelStatus.status.cycleHealth.success ? '✅' : '❌'} 
                      {kernelStatus.status.cycleHealth.duration}ms | 
                      Phases: {kernelStatus.status.cycleHealth.phases?.length || 0}
                      {kernelStatus.status.cycleHealth.error && (
                        <div style={{ color: 'var(--vscode-inputValidation-errorBorder)', marginTop: '4px' }}>
                          Error: {kernelStatus.status.cycleHealth.error}
                        </div>
                      )}
                    </div>
                  )}
                  {kernelStatus.status.safeMode && kernelStatus.status.corruptionReason && (
                    <div style={{ marginTop: '8px', color: 'var(--vscode-inputValidation-warningBorder)' }}>
                      ⚠️ {kernelStatus.status.corruptionReason}
                    </div>
                  )}
                </div>
              )}
              {!kernelStatus.ready && kernelStatus.message && (
                <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
                  {kernelStatus.message}
                </div>
              )}
            </div>
          )}

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
            disabled={loading || !kernelStatus?.ready || kernelStatus?.status?.safeMode}
            className="generate-button"
            title={!kernelStatus?.ready ? 'Kernel not ready' : kernelStatus?.status?.safeMode ? 'Kernel in SAFE MODE' : ''}
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
                  <span style={{ marginLeft: '10px', fontSize: '12px', color: githubStatus.connected ? 'var(--vscode-textLink-foreground)' : 'var(--vscode-inputValidation-warningBorder)' }}>
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
                disabled={!kernelStatus?.ready || kernelStatus?.status?.safeMode}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'var(--vscode-button-background)',
                  color: 'var(--vscode-button-foreground)',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: (!kernelStatus?.ready || kernelStatus?.status?.safeMode) ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  marginRight: '10px',
                  opacity: (!kernelStatus?.ready || kernelStatus?.status?.safeMode) ? 0.5 : 1
                }}
                title={!kernelStatus?.ready ? 'Kernel not ready' : kernelStatus?.status?.safeMode ? 'Kernel in SAFE MODE' : ''}
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
                          borderLeft: '3px solid var(--vscode-textLink-foreground)'
                        }}>
                          <strong style={{ fontSize: '11px', color: 'var(--vscode-textLink-foreground)' }}>💡 WHY:</strong>
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
                          disabled={!kernelStatus?.ready || kernelStatus?.status?.safeMode}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: 'var(--vscode-button-background)',
                            color: 'var(--vscode-button-foreground)',
                            border: 'none',
                            borderRadius: '2px',
                            cursor: (!kernelStatus?.ready || kernelStatus?.status?.safeMode) ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            opacity: (!kernelStatus?.ready || kernelStatus?.status?.safeMode) ? 0.5 : 1
                          }}
                          title={!kernelStatus?.ready ? 'Kernel not ready' : kernelStatus?.status?.safeMode ? 'Kernel in SAFE MODE' : ''}
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
          <div className="dev-tab-container">
            {/* Import LLM Response Button */}
            <div className="dev-section">
              <button
                onClick={() => {
                  if (window.vscode) {
                    window.vscode.postMessage({ type: 'importLLMResponse' });
                  }
                }}
                disabled={!kernelStatus?.ready || kernelStatus?.status?.safeMode}
                className="dev-button-primary"
                style={{
                  opacity: (!kernelStatus?.ready || kernelStatus?.status?.safeMode) ? 0.5 : 1,
                  cursor: (!kernelStatus?.ready || kernelStatus?.status?.safeMode) ? 'not-allowed' : 'pointer'
                }}
                title={!kernelStatus?.ready ? 'Kernel not ready' : kernelStatus?.status?.safeMode ? 'Kernel in SAFE MODE' : ''}
              >
                📥 Import LLM Response (from clipboard)
              </button>
              <p className="dev-help-text">
                Copy your LLM response (with <code>RL4_PROPOSAL</code> wrapper) and click this button to populate cognitive files.
              </p>
            </div>

            {/* Auto-Suggestions Section */}
            {suggestions.length > 0 && (
              <div className="dev-section">
                <div className="dev-section-header">
                  <h2>💡 Suggested Conditions</h2>
                  <button
                    onClick={() => {
                      if (window.vscode) {
                        window.vscode.postMessage({ type: 'requestSuggestions' });
                      }
                    }}
                    className="dev-button-secondary"
                  >
                    🔄 Refresh
                  </button>
                </div>
                <div className="dev-card-suggestions">
                  <ul className="dev-list">
                    {suggestions.map(suggestion => (
                      <li key={suggestion.taskId} className="dev-list-item-suggestions">
                        <div className="dev-item-content">
                          <div className="dev-item-main">
                            <div className="dev-item-title">
                              {suggestion.taskTitle}
                              <span className={`dev-badge ${suggestion.confidence === 'HIGH' ? 'dev-badge-high' : suggestion.confidence === 'MEDIUM' ? 'dev-badge-medium' : 'dev-badge-low'}`}>
                                {suggestion.confidence}
                              </span>
                            </div>
                            <div className="dev-item-description">
                              <strong>Suggested:</strong> <code className="dev-item-code">@rl4:completeWhen="{suggestion.suggestedCondition}"</code>
                            </div>
                            <div className="dev-item-description" style={{ fontSize: '10px' }}>
                              {suggestion.reason}
                            </div>
                            {suggestion.matchedPattern && (
                              <div className="dev-item-description" style={{ fontSize: '10px' }}>
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
                            className="dev-button-success"
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
              <div className="dev-section">
                <div className="dev-section-header">
                  <h2>🔍 Suggested from Activity</h2>
                  <button
                    onClick={() => {
                      if (window.vscode) {
                        window.vscode.postMessage({ type: 'requestAdHocActions' });
                      }
                    }}
                    className="dev-button-secondary"
                  >
                    🔄 Refresh
                  </button>
                </div>
                <div className="dev-card-actions">
                  <ul className="dev-list">
                    {adHocActions.slice(0, 10).map((action, index) => (
                      <li key={`${action.timestamp}-${index}`} className="dev-list-item-actions">
                        <div className="dev-item-content">
                          <div className="dev-item-main">
                            <div className="dev-item-title">
                              {action.suggestedTask}
                              <span className={`dev-badge ${action.confidence === 'HIGH' ? 'dev-badge-high' : action.confidence === 'MEDIUM' ? 'dev-badge-medium' : 'dev-badge-low'}`}>
                                {action.confidence}
                              </span>
                            </div>
                            <div className="dev-item-description">
                              <strong>Type:</strong> {action.action.replace('_', ' ')} • <strong>Time:</strong> {new Date(action.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            {action.command && (
                              <div className="dev-item-description" style={{ fontSize: '10px' }}>
                                <code className="dev-item-code-small">{action.command.substring(0, 80)}{action.command.length > 80 ? '...' : ''}</code>
                              </div>
                            )}
                            {action.file && (
                              <div className="dev-item-description" style={{ fontSize: '10px' }}>
                                📄 File: <em>{action.file}</em>
                              </div>
                            )}
                            {action.commitMessage && (
                              <div className="dev-item-description" style={{ fontSize: '10px' }}>
                                📝 Commit: <em>"{action.commitMessage.substring(0, 60)}{action.commitMessage.length > 60 ? '...' : ''}"</em>
                              </div>
                            )}
                            <div className="dev-item-description" style={{ fontSize: '10px', fontStyle: 'italic' }}>
                              {action.reason}
                            </div>
                          </div>
                          <div className="dev-actions-group-vertical">
                            <button
                              onClick={() => {
                                // TODO: Implement create task from ad-hoc action
                                setFeedbackWithTimeout('💡 Create task feature coming soon!', 2000); // ✅ FIX #2: Cleaned timer
                              }}
                              className="dev-button-success-small"
                            >
                              ✅ Create Task
                            </button>
                            <button
                              onClick={() => {
                                // Remove from list
                                setAdHocActions(prev => prev.filter((_, i) => i !== index));
                                setFeedbackWithTimeout('🗑️ Action ignored', 1500); // ✅ FIX #2: Cleaned timer
                              }}
                              className="dev-button-danger-small"
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
                  <div className="dev-count-text">
                    Showing 10 of {adHocActions.length} detected actions
                  </div>
                )}
              </div>
            )}

            <div className="dev-section">
              <div className="dev-section-header">
                <h2>🧩 Proposed Tasks (LLM)</h2>
                <div className="dev-section-badge">
                  New: {devBadge.newCount} · Changes: {devBadge.changedCount}
                </div>
              </div>
              <div className="dev-card">
                {proposals.length === 0 ? (
                  <div className="dev-empty-state">
                    No proposals yet. Generate a snapshot in Exploratory/Free mode and paste the agent response.
                  </div>
                ) : (
                  <ul className="dev-list">
                    {proposals.map(item => (
                      <li key={item.id} className="dev-list-item">
                        <div className="dev-item-content">
                          <div className="dev-item-main">
                            <div className="dev-item-title">{item.title}</div>
                            <div className="dev-item-description">
                              {item.why}
                            </div>
                            <div className="dev-item-meta">
                              {item.effort && <span>Effort: {item.effort}</span>}
                              {typeof item.roi === 'number' && <span>ROI: {item.roi}/10</span>}
                              {item.risk && <span>Risk: {item.risk}</span>}
                              {typeof item.bias === 'number' && <span>Bias: +{item.bias}%</span>}
                              {item.scope && <span>Scope: {item.scope}</span>}
                            </div>
                            {item.possibleDuplicateOf && (
                              <div className="dev-warning-text">
                                ⚠️ Possible duplicate of external task: {item.possibleDuplicateOf}
                              </div>
                            )}
                          </div>
                          <div className="dev-actions-group">
                            <button
                              title="Accepter en P0"
                              onClick={() => window.vscode?.postMessage({ type: 'submitDecisions', decisions: [{ id: item.id, action: 'accept', priority: 'P0' }] })}
                              className="dev-button-success-p0"
                            >
                              ✅ Accept (P0)
                            </button>
                            <button
                              title="Accepter en P1"
                              onClick={() => window.vscode?.postMessage({ type: 'submitDecisions', decisions: [{ id: item.id, action: 'accept', priority: 'P1' }] })}
                              className="dev-button-success-p1"
                            >
                              ✅ Accept (P1)
                            </button>
                            <button
                              title="Backlog (P2+)"
                              onClick={() => window.vscode?.postMessage({ type: 'submitDecisions', decisions: [{ id: item.id, action: 'backlog', priority: 'P2' }] })}
                              className="dev-button-neutral"
                            >
                              📦 Backlog
                            </button>
                            <button
                              title="Rejeter"
                              onClick={() => window.vscode?.postMessage({ type: 'submitDecisions', decisions: [{ id: item.id, action: 'reject' }] })}
                              className="dev-button-danger"
                            >
                              🗑️ Reject
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            
            {/* Task Verification Results */}
            {taskVerifications.length > 0 && (
              <div className="dev-section">
                <div className="dev-section-header">
                  <h3>✅ Verified Tasks (RL4)</h3>
                </div>
                <div className="dev-card">
                  <ul className="dev-list">
                    {taskVerifications.map(verification => (
                      <li key={verification.taskId} className="dev-list-item">
                        <div className="dev-item-content">
                          <div className="dev-item-main">
                            <div className="dev-item-title">
                              Task #{verification.taskId}
                              <span className={`dev-badge ${verification.confidence === 'high' ? 'dev-badge-high' : verification.confidence === 'medium' ? 'dev-badge-medium' : 'dev-badge-low'}`}>
                                {verification.confidence.toUpperCase()}
                              </span>
                            </div>
                            <div className="dev-item-description">
                              {verification.suggestion}
                            </div>
                            <div className="dev-item-description" style={{ fontSize: '10px' }}>
                              ✅ Matched: {verification.matchedConditions.length} condition(s)
                              {verification.verifiedAt && (
                                <span style={{ marginLeft: '10px' }}>
                                  🕐 {new Date(verification.verifiedAt).toLocaleString()}
                                </span>
                              )}
                            </div>
                            {verification.matchedConditions.length > 0 && (
                              <div className="dev-item-description" style={{ fontSize: '10px' }}>
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
                              className="dev-button-success"
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
            
            <div className="dev-section">
              <div className="dev-section-header">
                <h3>🧪 Patch Preview</h3>
              </div>
              {patchPreview ? (
                <div className="dev-patch-preview">
                  <pre>
                    {JSON.stringify(patchPreview, null, 2)}
                  </pre>
                  <div className="dev-patch-actions">
                    <button
                      onClick={() => window.vscode?.postMessage({ type: 'applyPatch', patch: patchPreview })}
                      disabled={!kernelStatus?.ready || kernelStatus?.status?.safeMode}
                      className="dev-button-primary"
                      style={{ 
                        width: 'auto', 
                        fontSize: '12px',
                        opacity: (!kernelStatus?.ready || kernelStatus?.status?.safeMode) ? 0.5 : 1,
                        cursor: (!kernelStatus?.ready || kernelStatus?.status?.safeMode) ? 'not-allowed' : 'pointer'
                      }}
                      title={!kernelStatus?.ready ? 'Kernel not ready' : kernelStatus?.status?.safeMode ? 'Kernel in SAFE MODE' : ''}
                    >
                      ✅ Apply Patch
                    </button>
                    <button
                      onClick={() => setPatchPreview(null)}
                      className="dev-button-neutral"
                      style={{ fontSize: '12px' }}
                    >
                      ❌ Discard
                    </button>
                  </div>
                </div>
              ) : (
                <div className="dev-empty-state">
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
                onClick={handleInsightsKPIs}
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
                onClick={handleInsightsPatterns}
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
        <p style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
          Files: <FileLink fileName="Plan.RL4" />, <FileLink fileName="Tasks.RL4" />, <FileLink fileName="Context.RL4" />, <FileLink fileName="ADRs.RL4" />
        </p>
      </footer>
    </div>
  );
}
