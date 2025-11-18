/**
 * messageHandlers.ts
 * Pure message dispatch layer - NO internal state, NO closures
 * All logic delegated to React setters passed as dependencies
 */

interface MessageHandlerDeps {
  // React setters (stable)
  setProposals: (v: any[]) => void;
  setDevBadge: (v: any) => void;
  setPatchPreview: (v: any | null) => void;
  setPrompt: (v: string | null) => void;
  setLoading: (v: boolean) => void;
  setAnomalies: (v: any[]) => void;
  setCompressionMetrics: (v: any | null) => void;
  setTaskVerifications: (v: any[]) => void;
  setKernelStatus: (v: any | null) => void;
  setPatterns: (v: any[]) => void;
  setPatternAnomalies: (v: any[]) => void;
  setSuggestions: (v: any[]) => void;
  setAdHocActions: (v: any[]) => void;
  
  // Hook callbacks (stable via useCallback)
  setFeedbackWithTimeout: (msg: string, ms: number) => void;
  setGithubStatus: (v: any) => void;
  setCommitPrompt: (v: string | null) => void;
  handleCommitCommandChange: (text: string) => void;
  resetCommit: () => void;
  setCognitiveLoad: (v: any) => void;
  setNextTasks: (v: any) => void;
  setPlanDrift: (v: any) => void;
  setRisks: (v: any) => void;
  
  // Utils
  logger: any;
  parseContextRL4: (text: string) => any;
}

/**
 * Creates a pure message handler map
 * Each handler is a pure function: (payload) => void
 */
export function createMessageHandlers(deps: MessageHandlerDeps): Record<string, (payload: any) => void> {
  const {
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
  } = deps;

  return {
    proposalsUpdated: (payload) => {
      setProposals(Array.isArray(payload?.suggestedTasks) ? payload.suggestedTasks : []);
      if (payload?.counts) {
        setDevBadge({
          newCount: payload.counts.newCount ?? 0,
          changedCount: payload.counts.changedCount ?? 0
        });
      } else {
        setDevBadge({ newCount: payload?.suggestedTasks?.length ?? 0, changedCount: 0 });
      }
    },

    taskLogChanged: (payload) => {
      if (payload) {
        setDevBadge((prev: any) => ({
          newCount: payload.newCount ?? prev.newCount,
          changedCount: payload.changedCount ?? prev.changedCount
        }));
      }
    },

    patchPreview: (payload) => {
      setPatchPreview(payload || null);
      setFeedbackWithTimeout('🧪 Patch preview ready', 2000);
    },

    snapshotGenerated: (payload) => {
      logger.log('[RL4 WebView] Snapshot received, length:', payload?.length);
      setPrompt(payload);
      setLoading(false);
      
      if (payload) {
        navigator.clipboard.writeText(payload).then(() => {
          setFeedbackWithTimeout('✅ Copied to clipboard!', 3000);
        }).catch(err => {
          console.error('[RL4] Clipboard error:', err);
          setFeedbackWithTimeout('❌ Copy failed', 3000);
        });
      }
    },

    error: (payload) => {
      console.error('[RL4 WebView] Error:', payload);
      setLoading(false);
      setFeedbackWithTimeout('❌ Error generating snapshot', 3000);
    },

    snapshotMetadata: (payload) => {
      logger.log('[RL4 WebView] Snapshot metadata received:', payload);
      if (payload) {
        const anomalies = payload.anomalies || [];
        const compression = payload.compression || null;
        logger.log(`[RL4 WebView] Setting ${anomalies.length} anomalies, compression: ${compression ? compression.reductionPercent.toFixed(1) + '%' : 'null'}`);
        setAnomalies(anomalies);
        setCompressionMetrics(compression);
      } else {
        logger.warn('[RL4 WebView] snapshotMetadata received but payload is empty');
      }
    },

    taskVerificationResults: (payload) => {
      logger.log('[RL4 WebView] Task verification results received:', payload);
      if (payload && payload.results) {
        setTaskVerifications(payload.results || []);
        setFeedbackWithTimeout(`✅ ${payload.results.length} task(s) verified`, 3000);
      }
    },

    taskMarkedDone: (payload) => {
      logger.log('[RL4 WebView] Task marked as done:', payload);
      if (payload && payload.taskId) {
        setTaskVerifications((prev: any[]) => prev.filter(v => v.taskId !== payload.taskId));
        setFeedbackWithTimeout(`✅ Task ${payload.taskId} marked as done`, 3000);
      }
    },

    llmResponseImported: (payload) => {
      logger.log('[RL4 WebView] LLM response imported:', payload);
      if (payload && payload.stats) {
        const { patterns, correlations, forecasts, adrs } = payload.stats;
        setFeedbackWithTimeout(`✅ Imported: ${patterns} patterns, ${correlations} correlations, ${forecasts} forecasts, ${adrs} evidence`, 5000);
      }
    },

    llmImportError: (payload) => {
      logger.error('[RL4 WebView] LLM import error:', payload);
      setFeedbackWithTimeout(`❌ Import failed: ${payload?.message || 'Unknown error'}`, 5000);
    },

    tasksLoaded: () => {
      logger.log('[RL4 WebView] Tasks.RL4 loaded');
    },

    adrsLoaded: () => {
      logger.log('[RL4 WebView] ADRs.RL4 loaded');
    },

    kpisUpdated: (payload) => {
      logger.log('[RL4 WebView] KPIs updated:', payload);
      if (payload) {
        const parsed = parseContextRL4(payload);
        setCognitiveLoad(parsed.cognitiveLoad);
        setNextTasks(parsed.nextSteps);
        setPlanDrift(parsed.planDrift);
        setRisks(parsed.risks);
        setFeedbackWithTimeout('✅ KPIs updated from Context.RL4', 3000);
      }
    },

    githubStatus: (payload) => {
      logger.log('[RL4 WebView] GitHub status:', payload);
      setGithubStatus(payload);
    },

    githubConnected: () => {
      setFeedbackWithTimeout('✅ GitHub connected successfully!', 3000);
    },

    kernelStatus: (payload) => {
      logger.log('[RL4 WebView] Kernel status received:', payload);
      setKernelStatus(payload);
    },

    'kernel:notReady': (payload) => {
      logger.warn('[RL4 WebView] Kernel not ready:', payload);
      setKernelStatus({
        ready: false,
        message: payload?.message || `Kernel not ready: ${payload?.reason}`,
        error: true,
        safeMode: payload?.safeMode || false
      });
    },

    githubError: (payload) => {
      setFeedbackWithTimeout(`❌ GitHub connection failed: ${payload || 'Unknown error'}`, 5000);
    },

    commitPromptGenerated: (payload) => {
      setCommitPrompt(payload);
      setFeedbackWithTimeout('✅ Commit prompt copied to clipboard!', 3000);
    },

    commitCommandReceived: (payload) => {
      handleCommitCommandChange(payload);
      setFeedbackWithTimeout('✅ GH CLI command received from LLM', 3000);
    },

    commitExecuted: () => {
      setFeedbackWithTimeout('✅ Commit created successfully!', 3000);
      resetCommit();
    },

    patternsUpdated: (payload) => {
      logger.log('[RL4 WebView] Patterns updated:', payload);
      if (payload) {
        setPatterns(payload.patterns || []);
        setPatternAnomalies(payload.anomalies || []);
        setFeedbackWithTimeout(`✅ ${payload.patterns?.length || 0} patterns loaded`, 2000);
      }
    },

    suggestionsUpdated: (payload) => {
      logger.log('[RL4 WebView] Suggestions updated:', payload);
      if (payload) {
        setSuggestions(payload.suggestions || []);
        if (payload.suggestions && payload.suggestions.length > 0) {
          setFeedbackWithTimeout(`💡 ${payload.suggestions.length} suggestions generated`, 2000);
        }
      }
    },

    suggestionApplied: (payload) => {
      logger.log('[RL4 WebView] Suggestion applied:', payload);
      if (payload?.success) {
        setFeedbackWithTimeout(`✅ Suggestion applied for task ${payload.taskId}`, 2000);
        if (window.vscode) {
          window.vscode.postMessage({ type: 'requestSuggestions' });
        }
      } else {
        setFeedbackWithTimeout(`❌ Failed to apply suggestion: ${payload?.error || 'Unknown error'}`, 3000);
      }
    },

    adHocActionsUpdated: (payload) => {
      logger.log('[RL4 WebView] Ad-hoc actions updated:', payload);
      if (payload) {
        setAdHocActions(payload.actions || []);
        if (payload.actions && payload.actions.length > 0) {
          setFeedbackWithTimeout(`🔍 ${payload.actions.length} ad-hoc actions detected`, 2000);
        }
      }
    },

    commitError: (payload) => {
      setFeedbackWithTimeout(`❌ Commit failed: ${payload || 'Unknown error'}`, 5000);
    }
  };
}

