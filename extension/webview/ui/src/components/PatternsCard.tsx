import React from 'react';
import './PatternsCard.css';

export interface TaskPattern {
  taskId: string;
  taskTitle?: string;
  typicalCommands: string[];
  successRate: number; // 0-1
  avgDuration: number; // ms
  runsCount: number;
  lastRun: string; // ISO timestamp
  completeWhen?: string; // Auto-detected pattern
}

export interface PatternAnomaly {
  taskId: string;
  type: 'success_rate_drop' | 'unusual_duration' | 'command_change' | 'dependency_issue';
  severity: 'low' | 'medium' | 'high';
  description: string;
  expected: any;
  actual: any;
  recommendation: string;
}

interface PatternsCardProps {
  patterns: TaskPattern[];
  anomalies?: PatternAnomaly[];
}

export const PatternsCard: React.FC<PatternsCardProps> = ({ patterns, anomalies = [] }) => {
  if (patterns.length === 0) {
    return (
      <div className="patterns-card empty">
        <div className="empty-state">
          <span className="empty-icon">📊</span>
          <h3>No Patterns Learned Yet</h3>
          <p>Execute tasks in the RL4 Terminal to start learning patterns.</p>
          <p className="hint">Use helper scripts: <code>source scripts/rl4-log.sh</code></p>
        </div>
      </div>
    );
  }

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  };

  const formatTimestamp = (iso: string): string => {
    try {
      const date = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
      return `${Math.floor(diffMins / 1440)}d ago`;
    } catch {
      return iso;
    }
  };

  const getSuccessRateColor = (rate: number): string => {
    if (rate >= 0.9) return 'var(--vscode-testing-iconPassed)';
    if (rate >= 0.7) return 'var(--vscode-editorWarning-foreground)';
    return 'var(--vscode-editorError-foreground)';
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'high': return 'var(--vscode-editorError-foreground)';
      case 'medium': return 'var(--vscode-editorWarning-foreground)';
      case 'low': return 'var(--vscode-editorInfo-foreground)';
      default: return 'var(--vscode-foreground)';
    }
  };

  const getSeverityIcon = (severity: string): string => {
    switch (severity) {
      case 'high': return '🔴';
      case 'medium': return '🟠';
      case 'low': return '🟡';
      default: return '⚪';
    }
  };

  const classifyCommand = (command: string): string => {
    const lower = command.toLowerCase();
    if (lower.includes('npm install') || lower.includes('yarn') || lower.includes('pnpm')) return 'setup';
    if (lower.includes('npm run build') || lower.includes('webpack') || lower.includes('vite build')) return 'build';
    if (lower.includes('test') || lower.includes('jest') || lower.includes('mocha')) return 'test';
    if (lower.includes('debug') || lower.includes('console')) return 'debug';
    if (lower.includes('git commit') || lower.includes('gh pr')) return 'deploy';
    if (lower.includes('lint') || lower.includes('format')) return 'document';
    return 'implementation';
  };

  const getPhaseColor = (phase: string): string => {
    const colors: Record<string, string> = {
      'setup': 'var(--vscode-textLink-foreground)',
      'build': 'var(--vscode-textLink-foreground)',
      'test': 'var(--vscode-testing-iconPassed)',
      'debug': 'var(--vscode-editorWarning-foreground)',
      'deploy': 'var(--vscode-editorError-foreground)',
      'document': 'var(--vscode-textLink-foreground)',
      'implementation': 'var(--vscode-textLink-foreground)'
    };
    return colors[phase] || 'var(--vscode-descriptionForeground)';
  };

  return (
    <div className="patterns-card">
      <div className="patterns-header">
        <h3>📊 Learned Patterns ({patterns.length})</h3>
        <p className="patterns-subtitle">
          Auto-learning from your terminal executions
        </p>
      </div>

      {/* Anomalies Section */}
      {anomalies.length > 0 && (
        <div className="patterns-anomalies">
          <h4>⚠️ Anomalies Detected ({anomalies.length})</h4>
          {anomalies.map((anomaly, idx) => (
            <div 
              key={idx} 
              className="anomaly-item"
              style={{ borderLeftColor: getSeverityColor(anomaly.severity) }}
            >
              <div className="anomaly-header">
                <span className="anomaly-severity">{getSeverityIcon(anomaly.severity)}</span>
                <span className="anomaly-type">{anomaly.type.replace(/_/g, ' ')}</span>
                <span className="anomaly-task">{anomaly.taskId}</span>
              </div>
              <p className="anomaly-description">{anomaly.description}</p>
              <div className="anomaly-details">
                <span>Expected: {JSON.stringify(anomaly.expected)}</span>
                <span>Actual: {JSON.stringify(anomaly.actual)}</span>
              </div>
              <p className="anomaly-recommendation">💡 {anomaly.recommendation}</p>
            </div>
          ))}
        </div>
      )}

      {/* Patterns Table */}
      <div className="patterns-table-container">
        <table className="patterns-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Runs</th>
              <th>Success Rate</th>
              <th>Avg Duration</th>
              <th>Last Run</th>
              <th>Suggested Condition</th>
            </tr>
          </thead>
          <tbody>
            {patterns.map((pattern) => {
              const phase = pattern.typicalCommands.length > 0 
                ? classifyCommand(pattern.typicalCommands[0]) 
                : 'implementation';
              
              return (
                <tr key={pattern.taskId}>
                  <td>
                    <div className="task-cell">
                      <span 
                        className="phase-badge" 
                        style={{ backgroundColor: getPhaseColor(phase) }}
                      >
                        {phase}
                      </span>
                      <span className="task-title">
                        {pattern.taskTitle || pattern.taskId}
                      </span>
                    </div>
                  </td>
                  <td className="runs-cell">{pattern.runsCount}</td>
                  <td>
                    <span 
                      className="success-rate"
                      style={{ color: getSuccessRateColor(pattern.successRate) }}
                    >
                      {(pattern.successRate * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="duration-cell">{formatDuration(pattern.avgDuration)}</td>
                  <td className="timestamp-cell">{formatTimestamp(pattern.lastRun)}</td>
                  <td>
                    {pattern.completeWhen ? (
                      <code className="condition-code">{pattern.completeWhen}</code>
                    ) : (
                      <span className="no-condition">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Patterns Details (Expandable) */}
      <details className="patterns-details">
        <summary>View Detailed Breakdown</summary>
        <div className="patterns-breakdown">
          {patterns.map((pattern) => (
            <div key={pattern.taskId} className="pattern-detail">
              <h5>{pattern.taskTitle || pattern.taskId}</h5>
              <div className="pattern-commands">
                <strong>Typical Commands:</strong>
                <ul>
                  {pattern.typicalCommands.map((cmd, idx) => (
                    <li key={idx}><code>{cmd}</code></li>
                  ))}
                </ul>
              </div>
              <div className="pattern-stats">
                <div className="stat">
                  <span className="stat-label">Success Rate:</span>
                  <span className="stat-value" style={{ color: getSuccessRateColor(pattern.successRate) }}>
                    {(pattern.successRate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-label">Runs:</span>
                  <span className="stat-value">{pattern.runsCount}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Avg Duration:</span>
                  <span className="stat-value">{formatDuration(pattern.avgDuration)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
};

