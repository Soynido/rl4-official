/**
 * Plan Drift Card — Displays factual bias between current plan and baseline
 * NO judgments. Just state facts and let user decide.
 */

import React from 'react';

interface PlanDriftProps {
  percentage: number;
  threshold: number;
  changes: {
    phase: {
      original: string;
      current: string;
      changed: boolean;
    };
    goal: {
      percentage: number;
    };
    tasks: {
      added: number;
    };
  };
}

export const PlanDriftCard: React.FC<PlanDriftProps> = ({ 
  percentage, 
  threshold,
  changes 
}) => {
  const getDriftColor = () => {
    if (percentage > threshold * 2) return '#ff4d4d'; // Critical (>50% for flexible)
    if (percentage > threshold) return '#ff9500'; // High (>25% for flexible)
    return '#00c864'; // Normal
  };

  const getDriftEmoji = () => {
    if (percentage > threshold * 2) return '🔴';
    if (percentage > threshold) return '🟡';
    return '🟢';
  };

  const getAlertLevel = () => {
    if (percentage > threshold * 2) return 'CRITICAL';
    if (percentage > threshold) return 'WARNING';
    return 'OK';
  };

  return (
    <div className="kpi-card plan-drift-card">
      <div className="kpi-header">
        <h3>📊 Plan Drift</h3>
        <div className="tooltip">
          <span className="tooltip-icon">❓</span>
          <div className="tooltip-content">
            <strong>What is this?</strong><br/>
            Measures how much your current work has drifted from your original plan baseline.<br/><br/>
            <strong>Tracks changes in:</strong><br/>
            • <strong>Phase:</strong> Current project phase vs. original<br/>
            • <strong>Goal:</strong> Similarity between current and original objectives<br/>
            • <strong>Timeline:</strong> Schedule adjustments over time<br/>
            • <strong>Tasks:</strong> Added or removed work items<br/><br/>
            <strong>Threshold:</strong> {threshold}% (based on selected mode)<br/><br/>
            <strong>Why it matters:</strong><br/>
            Helps you catch scope creep early and decide whether to accept changes, recalibrate, or refocus on the original plan.
          </div>
        </div>
      </div>

      <div className="kpi-value">
        <span className="kpi-percentage" style={{ color: getDriftColor() }}>
          {percentage}%
        </span>
        <span className="kpi-level" style={{ color: getDriftColor() }}>
          {getDriftEmoji()} {getAlertLevel()}
        </span>
      </div>

      <div className="drift-threshold">
        <span className="threshold-label">Threshold:</span>
        <span className="threshold-value">{threshold}%</span>
        {percentage > threshold && (
          <span className="threshold-exceeded" style={{ color: getDriftColor() }}>
            (+{percentage - threshold}% over)
          </span>
        )}
      </div>

      <div className="kpi-changes">
        {changes.phase.changed && (
          <div className="change-item">
            <span className="change-label">📌 Phase:</span>
            <span className="change-value">
              {changes.phase.original} → {changes.phase.current}
            </span>
          </div>
        )}
        
        {changes.goal.percentage > 0 && (
          <div className="change-item">
            <span className="change-label">🎯 Goal:</span>
            <span className="change-value">
              {changes.goal.percentage}% different
            </span>
          </div>
        )}
        
        {changes.tasks.added > 0 && (
          <div className="change-item">
            <span className="change-label">✅ Tasks:</span>
            <span className="change-value">
              +{changes.tasks.added} added
            </span>
          </div>
        )}
      </div>

      {percentage > threshold && (
        <div className="drift-alert" style={{ 
          borderColor: getDriftColor(),
          backgroundColor: getDriftColor() + '22'
        }}>
          <strong>⚠️ Deviation Detected</strong>
          <p>Plan drift exceeds {threshold}% threshold. Consider:</p>
          <ul>
            <li>Accept drift (update baseline)</li>
            <li>Recalibrate (remove features)</li>
            <li>Continue (acknowledge temporarily)</li>
          </ul>
        </div>
      )}
    </div>
  );
};

