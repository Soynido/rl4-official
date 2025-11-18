/**
 * Cognitive Load Card — Displays factual cognitive load metrics
 * NO predictions, NO judgments. Just observable data.
 */

import React from 'react';

interface CognitiveLoadProps {
  percentage: number;
  level: 'normal' | 'high' | 'critical';
  metrics: {
    bursts: number;
    switches: number;
    parallelTasks: number;
    uncommittedFiles: number;
  };
}

export const CognitiveLoadCard: React.FC<CognitiveLoadProps> = ({ 
  percentage, 
  level, 
  metrics 
}) => {
  const getLevelColor = () => {
    switch (level) {
      case 'critical': return 'var(--vscode-inputValidation-errorBorder)';
      case 'high': return 'var(--vscode-inputValidation-warningBorder)';
      case 'normal': return 'var(--vscode-inputValidation-infoBorder)';
      default: return 'var(--vscode-foreground)';
    }
  };

  const getLevelEmoji = () => {
    switch (level) {
      case 'critical': return '🔴';
      case 'high': return '🟡';
      case 'normal': return '🟢';
      default: return '⚪';
    }
  };

  return (
    <div className="kpi-card cognitive-load-card">
      <div className="kpi-header">
        <h3>🧠 Cognitive Load</h3>
        <div className="tooltip">
          <span className="tooltip-icon">❓</span>
          <div className="tooltip-content">
            <strong>What is this?</strong><br/>
            Measures how much mental effort your current work requires based on workspace activity patterns.<br/><br/>
            <strong>Calculated from:</strong><br/>
            • <strong>Bursts:</strong> Rapid edit sessions (&gt;30 edits in &lt;2min)<br/>
            • <strong>Switches:</strong> File jumps in your timeline<br/>
            • <strong>Parallel Tasks:</strong> Tasks currently in progress<br/>
            • <strong>Uncommitted Files:</strong> Changed files not yet committed<br/><br/>
            <strong>Why it matters:</strong><br/>
            High cognitive load can lead to bugs, context switching fatigue, or forgetting to commit work.
          </div>
        </div>
      </div>

      <div className="kpi-value">
        <span className="kpi-percentage" style={{ color: getLevelColor() }}>
          {percentage}%
        </span>
        <span className="kpi-level" style={{ color: getLevelColor() }}>
          {getLevelEmoji()} {level.charAt(0).toUpperCase() + level.slice(1)}
        </span>
      </div>

      <div className="kpi-metrics">
        <div className="metric-item">
          <span className="metric-label">Bursts:</span>
          <span className="metric-value">{metrics.bursts}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Switches:</span>
          <span className="metric-value">{metrics.switches}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Parallel Tasks:</span>
          <span className="metric-value">{metrics.parallelTasks}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Uncommitted Files:</span>
          <span className="metric-value" style={{ 
            color: metrics.uncommittedFiles > 15 ? 'var(--vscode-inputValidation-errorBorder)' : 'inherit' 
          }}>
            {metrics.uncommittedFiles}
          </span>
        </div>
      </div>
    </div>
  );
};

