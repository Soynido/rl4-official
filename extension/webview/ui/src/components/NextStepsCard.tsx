/**
 * Next Tasks Card — Displays mode-adapted recommended actions
 * Adapts to user-selected deviation mode (Strict/Flexible/Exploratory/Free)
 */

import React from 'react';

interface NextTask {
  priority: 'P0' | 'P1' | 'P2';
  action: string;
}

interface NextTasksProps {
  mode: 'strict' | 'flexible' | 'exploratory' | 'free' | 'firstUse';
  steps: NextTask[];
}

export const NextStepsCard: React.FC<NextTasksProps> = ({ mode, steps }) => {
  const getModeEmoji = () => {
    switch (mode) {
      case 'strict': return '🔴';
      case 'flexible': return '🟡';
      case 'exploratory': return '🟢';
      case 'free': return '⚪';
      case 'firstUse': return '🔍';
      default: return '🎯';
    }
  };

  const getModeLabel = () => {
    switch (mode) {
      case 'strict': return 'Strict Mode (0%)';
      case 'flexible': return 'Flexible Mode (25%)';
      case 'exploratory': return 'Exploratory Mode (50%)';
      case 'free': return 'Free Mode (100%)';
      case 'firstUse': return 'First Use Mode (Deep Analysis)';
      default: return 'Unknown Mode';
    }
  };

  const getModeDescription = () => {
    switch (mode) {
      case 'strict':
        return 'Focus ONLY on P0 tasks from baseline plan. Reject ALL new ideas.';
      case 'flexible':
        return 'Focus on P0+P1 tasks. New ideas OK if total bias < 25%.';
      case 'exploratory':
        return 'Welcome creative ideas. New features OK if total bias < 50%.';
      case 'free':
        return 'Creative mode. All ideas welcome. No constraints.';
      case 'firstUse':
        return 'Analyze project history, detect context, and generate comprehensive snapshot. Use on first RL4 install or to refresh context.';
      default:
        return '';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'P0': return '#ff4d4d';
      case 'P1': return '#ff9500';
      case 'P2': return '#667eea';
      default: return '#666';
    }
  };

  return (
    <div className="kpi-card next-steps-card">
      <div className="kpi-header">
        <h3>🎯 Next Tasks</h3>
        <div className="tooltip">
          <span className="tooltip-icon">❓</span>
          <div className="tooltip-content">
            <strong>What is this?</strong><br/>
            Recommended actions prioritized by urgency and selected mode. Tasks adapt to your workflow preferences.<br/><br/>
            <strong>Mode Types:</strong><br/>
            • <strong>Strict (0%):</strong> Focus only on critical P0 tasks<br/>
            • <strong>Flexible (25%):</strong> P0+P1 tasks, accept minor scope changes<br/>
            • <strong>Exploratory (50%):</strong> Encourage creative solutions<br/>
            • <strong>Free (100%):</strong> No constraints on approach<br/><br/>
            <strong>Why it matters:</strong><br/>
            Keeps you focused on high-impact work while managing scope creep based on your selected mode.
          </div>
        </div>
      </div>

      <div className="kpi-mode-indicator">
        <span className="mode-emoji">{getModeEmoji()}</span>
        <span className="mode-label">{getModeLabel()}</span>
      </div>
      
      <p className="mode-description">{getModeDescription()}</p>

      <div className="kpi-steps">
        {steps.length > 0 ? (
          <ol className="steps-list">
            {steps.map((step, index) => (
              <li key={index} className="step-item">
                <span 
                  className="step-priority" 
                  style={{ color: getPriorityColor(step.priority) }}
                >
                  [{step.priority}]
                </span>
                <span className="step-action">{step.action}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="no-steps">✅ No actions required. All on track!</p>
        )}
      </div>
    </div>
  );
};

