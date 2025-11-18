/**
 * RL4 Cognitive OS - Neural State Synchronizer
 * Synchronisation de l'état cognitif avec Cursor via interface immersive
 */

import { useState, useRef, useEffect } from 'react';
import { useRL4Store } from '../api/useRL4Store';

export function WhereAmI() {
  const snapshot = useRL4Store((s) => s.snapshot);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<NodeJS.Timeout | null>(null);

  if (!snapshot) {
    return (
      <div className="rl4-container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '500px'
      }}>
        <div className="rl4-neural-flicker">
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--rl4-space-lg)'
          }}>
            <div className="rl4-spinner" style={{ width: '32px', height: '32px' }} />
            <div style={{
              fontSize: 'var(--rl4-font-lg)',
              color: 'var(--rl4-text-muted)',
              fontFamily: 'var(--rl4-font-mono)',
              textAlign: 'center'
            }}>
              <span className="rl4-pulse">🔗</span>
              <div style={{ marginTop: 'var(--rl4-space-sm)' }}>
                Establishing neural link...
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Generate agent-calibrated prompt (100% dynamic from RL4 data)
  const generatePrompt = () => {
    const lines: string[] = [];
    
    // Header
    lines.push('╭──────────────────────────────────────────────────╮');
    lines.push('│  🧠 RL4 NEURAL SNAPSHOT — AGENT CALIBRATION     │');
    lines.push(`│  Cycle: ${String(snapshot.cycleId || 0).padEnd(5)} │ Mood: ${(snapshot.mood || 'UNKNOWN').padEnd(10)} │ Phase: ${(snapshot.architecture?.phase || 'unknown').toUpperCase().padEnd(8)} │`);
    lines.push('╰──────────────────────────────────────────────────╯');
    lines.push('');
    
    // Architecture Context
    lines.push('🏗️  ARCHITECTURE CONTEXT');
    lines.push('─'.repeat(50));
    lines.push(`Project: ${snapshot.architecture?.projectName || 'RL4 Cognitive OS'}`);
    lines.push(`Phase: ${snapshot.architecture?.phase || 'unknown'}`);
    if (snapshot.architecture?.criticalModules && snapshot.architecture.criticalModules.length > 0) {
      lines.push(`Critical Modules: ${snapshot.architecture.criticalModules.join(', ')}`);
    }
    lines.push('');
    
    // Active Constraints
    lines.push('🎯 ACTIVE CONSTRAINTS & DECISIONS');
    lines.push('─'.repeat(50));
    if (snapshot.constraints?.recentADRs && snapshot.constraints.recentADRs.length > 0) {
      lines.push('Recent ADRs:');
      snapshot.constraints.recentADRs.forEach((adr, idx) => {
        lines.push(`  ${idx + 1}. ${adr.id} — ${adr.title}`);
      });
    } else {
      lines.push('Recent ADRs: None recorded');
    }
    
    if (snapshot.constraints?.techDebt && snapshot.constraints.techDebt.length > 0) {
      lines.push('');
      lines.push('Tech Debt:');
      snapshot.constraints.techDebt.forEach(debt => lines.push(`  • ${debt}`));
    }
    lines.push('');
    
    // Current Focus
    lines.push('📂 CURRENT FOCUS');
    lines.push('─'.repeat(50));
    lines.push(`Active File: ${snapshot.focusedFile || snapshot.focus || 'N/A'}`);
    if (snapshot.recentlyViewed && snapshot.recentlyViewed.length > 0) {
      lines.push('Recently Viewed:');
      snapshot.recentlyViewed.slice(0, 5).forEach((file, idx) => {
        lines.push(`  ${idx + 1}. ${file}`);
      });
    }
    lines.push('');
    
    // Patterns
    lines.push(`🧬 DETECTED PATTERNS (${snapshot.patterns?.length || 0})`);
    lines.push('─'.repeat(50));
    if (snapshot.patterns && snapshot.patterns.length > 0) {
      snapshot.patterns.forEach(p => {
        const conf = Math.round((p.confidence || 0) * 100);
        const trend = p.trend || 'stable';
        const trendIcon = trend === 'increasing' ? '📈' : trend === 'decreasing' ? '📉' : '➡️';
        const impact = p.impact ? ` | ${p.impact}` : '';
        lines.push(`  ${trendIcon} ${p.id} — ${conf}% confidence${impact}`);
      });
    } else {
      lines.push('  No patterns detected in current cycle');
    }
    lines.push('');
    
    // Forecasts
    lines.push(`🔮 FORECASTS (${snapshot.forecasts?.length || 0})`);
    lines.push('─'.repeat(50));
    if (snapshot.forecasts && snapshot.forecasts.length > 0) {
      snapshot.forecasts.forEach(f => {
        const conf = Math.round((f.confidence || 0) * 100);
        const category = f.category ? ` [${f.category}]` : '';
        lines.push(`  → ${f.predicted} — ${conf}%${category}`);
      });
    } else {
      lines.push('  No active forecasts');
    }
    lines.push('');
    
    // Alerts & Health
    lines.push('⚠️  ALERTS & COGNITIVE HEALTH');
    lines.push('─'.repeat(50));
    if (snapshot.alerts?.activeBiases && snapshot.alerts.activeBiases.length > 0) {
      lines.push('Active Biases:');
      snapshot.alerts.activeBiases.forEach(bias => {
        lines.push(`  • ${bias.type}: ${bias.count} detected`);
      });
      lines.push('');
    }
    
    if (snapshot.alerts?.healthMetrics) {
      const m = snapshot.alerts.healthMetrics;
      lines.push('Health Metrics:');
      lines.push(`  • Predictive Drift: ${Math.round(m.predictiveDrift * 100)}%`);
      lines.push(`  • Coherence: ${Math.round(m.coherence * 100)}%`);
      lines.push(`  • Action Adoption: ${Math.round(m.actionAdoption * 100)}%`);
    }
    lines.push('');
    
    // Goals
    lines.push(`🎯 GOALS STATUS`);
    lines.push('─'.repeat(50));
    if (snapshot.goals) {
      const successRate = Math.round((snapshot.goals.successRate || 0) * 100);
      lines.push(`Active: ${snapshot.goals.active} | Completed: ${snapshot.goals.completed} | Success Rate: ${successRate}%`);
      if (snapshot.goals.list && snapshot.goals.list.length > 0) {
        lines.push('');
        snapshot.goals.list.slice(0, 3).forEach(goal => {
          const statusIcon = goal.status === 'active' || goal.status === 'in_progress' ? '🔵' : '✅';
          lines.push(`  ${statusIcon} ${goal.objective} (${goal.priority})`);
        });
      }
    }
    lines.push('');
    lines.push('─'.repeat(50));
    lines.push('');
    
    // Agent Directive
    lines.push('🚀 AGENT CALIBRATION DIRECTIVE');
    lines.push('');
    lines.push(`Primary Context: You are assisting in the **${snapshot.architecture?.phase || 'unknown'} phase** of RL4 Cognitive OS.`);
    lines.push('');
    lines.push('Suggested Approach:');
    lines.push('  1. Analyze current focus and recent patterns');
    lines.push('  2. Verify alignment with active forecasts');
    lines.push('  3. Check for bias alerts that might affect decisions');
    lines.push('  4. Propose next steps respecting ADRs and minimizing tech debt');
    lines.push('');
    lines.push(`📊 Snapshot Quality: ${Math.round((snapshot.confidence || 0) * 100)}% | Generated: ${new Date().toLocaleTimeString()}`);
    
    return lines.join('\n');
  };

  const prompt = generatePrompt();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      
      copyTimerRef.current = setTimeout(() => {
        setCopied(false);
        copyTimerRef.current = null;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy cognitive state:', err);
    }
  };

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleOpenInCursor = () => {
    const encoded = encodeURIComponent(prompt);
    window.open(`cursor://new?text=${encoded}`);
  };

  // Calculate status indicators
  const cognitiveLoad = Math.min(100, (snapshot.patterns?.length || 0) * 15 + (snapshot.forecasts?.length || 0) * 10);
  const patternDiversity = snapshot.patterns?.length || 0;
  const confidenceLevel = (snapshot.confidence || 0) * 100;

  return (
    <div className="rl4-container rl4-stagger-neural">
      {/* Hero Section */}
      <div className="rl4-hero rl4-fade-in">
        <h1 className="rl4-hero__title">
          <span style={{ marginRight: 'var(--rl4-space-sm)' }}>🧠</span>
          Neural State Synchronizer
        </h1>
        <p className="rl4-hero__subtitle">
          Export your cognitive state to Cursor for perfect context synchronization
        </p>
      </div>

      {/* Status Overview Cards */}
      <div className="rl4-grid rl4-grid--3 rl4-stagger-neural" style={{ marginBottom: 'var(--rl4-space-2xl)' }}>
        <div className="rl4-card rl4-card-float rl4-hover-lift">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--rl4-space-sm)'
          }}>
            <span style={{ fontSize: 'var(--rl4-font-lg)', color: 'var(--rl4-violet)' }}>⚡</span>
            <span style={{
              fontSize: 'var(--rl4-font-xs)',
              color: 'var(--rl4-text-muted)',
              fontFamily: 'var(--rl4-font-mono)'
            }}>
              COGNITIVE LOAD
            </span>
          </div>
          <div style={{
            fontSize: 'var(--rl4-font-2xl)',
            fontWeight: 'var(--rl4-font-weight-bold)',
            color: cognitiveLoad > 70 ? 'var(--rl4-error)' : cognitiveLoad > 40 ? 'var(--rl4-warning)' : 'var(--rl4-success)',
            fontFamily: 'var(--rl4-font-display)'
          }}>
            {cognitiveLoad}%
          </div>
          <div className="rl4-data-flow" style={{
            height: '3px',
            borderRadius: 'var(--rl4-radius-full)',
            marginTop: 'var(--rl4-space-sm)'
          }} />
        </div>

        <div className="rl4-card rl4-card-float rl4-hover-lift">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--rl4-space-sm)'
          }}>
            <span style={{ fontSize: 'var(--rl4-font-lg)', color: 'var(--rl4-turquoise)' }}>🧬</span>
            <span style={{
              fontSize: 'var(--rl4-font-xs)',
              color: 'var(--rl4-text-muted)',
              fontFamily: 'var(--rl4-font-mono)'
            }}>
              PATTERNS
            </span>
          </div>
          <div style={{
            fontSize: 'var(--rl4-font-2xl)',
            fontWeight: 'var(--rl4-font-weight-bold)',
            color: 'var(--rl4-turquoise)',
            fontFamily: 'var(--rl4-font-display)'
          }}>
            {patternDiversity}
          </div>
          <div className="rl4-data-flow" style={{
            height: '3px',
            borderRadius: 'var(--rl4-radius-full)',
            marginTop: 'var(--rl4-space-sm)',
            background: 'linear-gradient(90deg, transparent 0%, var(--vscode-inputValidation-infoBorder) 25%, var(--vscode-inputValidation-infoBorder) 50%, var(--vscode-inputValidation-infoBorder) 75%, transparent 100%)',
            opacity: '0.3'
          }} />
        </div>

        <div className="rl4-card rl4-card-float rl4-hover-lift">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--rl4-space-sm)'
          }}>
            <span style={{ fontSize: 'var(--rl4-font-lg)', color: 'var(--rl4-magenta)' }}>🎯</span>
            <span style={{
              fontSize: 'var(--rl4-font-xs)',
              color: 'var(--rl4-text-muted)',
              fontFamily: 'var(--rl4-font-mono)'
            }}>
              CONFIDENCE
            </span>
          </div>
          <div style={{
            fontSize: 'var(--rl4-font-2xl)',
            fontWeight: 'var(--rl4-font-weight-bold)',
            color: 'var(--rl4-magenta)',
            fontFamily: 'var(--rl4-font-display)'
          }}>
            {Math.round(confidenceLevel)}%
          </div>
          <div className="rl4-data-flow" style={{
            height: '3px',
            borderRadius: 'var(--rl4-radius-full)',
            marginTop: 'var(--rl4-space-sm)',
            background: 'linear-gradient(90deg, transparent 0%, var(--vscode-textLink-foreground) 25%, var(--vscode-textLink-foreground) 50%, var(--vscode-textLink-foreground) 75%, transparent 100%)',
            opacity: '0.3'
          }} />
        </div>
      </div>

      {/* Cognitive State Card */}
      <div className="rl4-card rl4-card--glow rl4-scale-in rl4-stagger-neural" style={{
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Card Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--rl4-space-lg)',
          paddingBottom: 'var(--rl4-space-md)',
          borderBottom: 'var(--rl4-border-subtle)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--rl4-space-sm)'
          }}>
            <span style={{ fontSize: 'var(--rl4-font-xl)' }}>📋</span>
            <div>
              <h2 style={{
                fontSize: 'var(--rl4-font-lg)',
                fontWeight: 'var(--rl4-font-weight-bold)',
                color: 'var(--rl4-text-primary)',
                margin: 0,
                marginBottom: 'var(--rl4-space-xs)'
              }}>
                Cognitive State Export
              </h2>
              <p style={{
                fontSize: 'var(--rl4-font-xs)',
                color: 'var(--rl4-text-muted)',
                margin: 0,
                fontFamily: 'var(--rl4-font-mono)'
              }}>
                Cycle {snapshot.cycleId || 'INIT'} • {snapshot.mood || 'NEUTRAL'} mood
              </p>
            </div>
          </div>
          <div className="rl4-live-badge" style={{
            fontSize: 'var(--rl4-font-xs)'
          }}>
            <span style={{ marginRight: 'var(--rl4-space-xs)' }}>●</span>
            LIVE
          </div>
        </div>

        {/* Neural Code Display */}
        <div className="rl4-code" style={{
          background: 'var(--rl4-darker)',
          border: 'var(--rl4-border-subtle)',
          borderRadius: 'var(--rl4-radius-lg)',
          padding: 'var(--rl4-space-lg)',
          fontFamily: 'var(--rl4-font-mono)',
          fontSize: 'var(--rl4-font-sm)',
          lineHeight: 'var(--rl4-line-height-relaxed)',
          color: 'var(--rl4-text-secondary)',
          overflowX: 'auto',
          whiteSpace: 'pre',
          maxHeight: '400px',
          overflowY: 'auto',
          position: 'relative'
        }}>
          <div className="rl4-neural-flicker">{prompt}</div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: 'var(--rl4-space-md)',
          marginTop: 'var(--rl4-space-lg)'
        }}>
          <button
            onClick={handleCopy}
            className={`rl4-btn rl4-btn--primary rl4-button-neural rl4-ripple ${copied ? 'rl4-scale-in' : ''}`}
            style={{ flex: 1 }}
          >
            <span style={{ marginRight: 'var(--rl4-space-sm)' }}>
              {copied ? '✅' : '📋'}
            </span>
            {copied ? 'State Copied!' : 'Copy Cognitive State'}
          </button>

          <button
            onClick={handleOpenInCursor}
            className="rl4-btn rl4-btn--secondary rl4-ripple rl4-button-neural"
            style={{ flex: 1 }}
          >
            <span style={{ marginRight: 'var(--rl4-space-sm)' }}>🚀</span>
            Open in Cursor
          </button>
        </div>
      </div>

      {/* Neural Stats Footer */}
      <div className="rl4-footer-stats rl4-stagger-neural">
        <div className="rl4-footer-stats__item">
          <div className="rl4-footer-stats__label">Active Patterns</div>
          <div className="rl4-footer-stats__value" style={{ color: 'var(--rl4-turquoise)' }}>
            {snapshot.patterns?.length || 0}
          </div>
        </div>

        <div className="rl4-footer-stats__item">
          <div className="rl4-footer-stats__label">Forecasts</div>
          <div className="rl4-footer-stats__value" style={{ color: 'var(--rl4-magenta)' }}>
            {snapshot.forecasts?.length || 0}
          </div>
        </div>

        <div className="rl4-footer-stats__item">
          <div className="rl4-footer-stats__label">Knowledge Base</div>
          <div className="rl4-footer-stats__value" style={{ color: 'var(--rl4-violet)' }}>
            {snapshot.adrs?.total || 0} ADRs
          </div>
        </div>

        <div className="rl4-footer-stats__item">
          <div className="rl4-footer-stats__label">Sync Status</div>
          <div className="rl4-footer-stats__value rl4-tension-low" style={{ color: 'var(--rl4-success)' }}>
            Ready
          </div>
        </div>
      </div>
    </div>
  );
}

