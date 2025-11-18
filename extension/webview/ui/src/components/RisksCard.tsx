/**
 * Risks Card — Displays observable risks only
 * NO speculation. Only factual observations from system data.
 */

import React from 'react';

interface Risk {
  emoji: string;
  severity: 'critical' | 'warning' | 'ok';
  description: string;
}

interface RisksProps {
  risks: Risk[];
}

export const RisksCard: React.FC<RisksProps> = ({ risks }) => {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'var(--vscode-inputValidation-errorBorder)';
      case 'warning': return 'var(--vscode-inputValidation-warningBorder)';
      case 'ok': return 'var(--vscode-inputValidation-infoBorder)';
      default: return 'var(--vscode-foreground)';
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'critical': return 'CRITICAL';
      case 'warning': return 'WARNING';
      case 'ok': return 'OK';
      default: return 'INFO';
    }
  };

  // Count risks by severity
  const criticalCount = risks.filter(r => r.severity === 'critical').length;
  const warningCount = risks.filter(r => r.severity === 'warning').length;
  const okCount = risks.filter(r => r.severity === 'ok').length;

  return (
    <div className="kpi-card risks-card">
      <div className="kpi-header">
        <h3>⚠️ Risks</h3>
        <div className="tooltip">
          <span className="tooltip-icon">❓</span>
          <div className="tooltip-content">
            <strong>What is this?</strong><br/>
            Observable risks detected from your workspace activity. Based on measurable patterns, not predictions.<br/><br/>
            <strong>Risk Types:</strong><br/>
            • <strong>🔴 Critical:</strong> Uncommitted files (&gt;15), data loss risk<br/>
            • <strong>🟡 Warning:</strong> Burst activity (&gt;30 edits in &lt;2min), possible debugging session<br/>
            • <strong>🟡 Warning:</strong> Long gaps (&gt;30min), potential blocker or break<br/>
            • <strong>🟢 OK:</strong> System health (memory, event loop) within normal range<br/><br/>
            <strong>Why it matters:</strong><br/>
            Helps you catch potential issues early (like forgetting to commit work) and understand your work patterns.
          </div>
        </div>
      </div>

      <div className="risks-summary">
        {criticalCount > 0 && (
          <span className="risk-count critical">
            🔴 {criticalCount} Critical
          </span>
        )}
        {warningCount > 0 && (
          <span className="risk-count warning">
            🟡 {warningCount} Warning
          </span>
        )}
        {okCount > 0 && (
          <span className="risk-count ok">
            🟢 {okCount} OK
          </span>
        )}
        {risks.length === 0 && (
          <span className="risk-count ok">
            ✅ No risks detected
          </span>
        )}
      </div>

      <div className="kpi-risks">
        {risks.length > 0 ? (
          <ul className="risks-list">
            {risks.map((risk, index) => (
              <li 
                key={index} 
                className="risk-item"
                style={{ borderLeftColor: getSeverityColor(risk.severity) }}
              >
                <div className="risk-header">
                  <span className="risk-emoji">{risk.emoji}</span>
                  <span 
                    className="risk-severity" 
                    style={{ color: getSeverityColor(risk.severity) }}
                  >
                    {getSeverityLabel(risk.severity)}
                  </span>
                </div>
                <p className="risk-description">{risk.description}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="no-risks">
            ✅ No observable risks detected. System health excellent.
          </p>
        )}
      </div>
    </div>
  );
};

