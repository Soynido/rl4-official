/**
 * AnomaliesCard — Display detected anomalies
 */

import React from 'react';

export interface Anomaly {
  id: string;
  type: 'sudden_change' | 'regression' | 'missing_pattern' | 'unusual_activity' | 'forecast_inaccuracy' | 'bias_spike';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detected_at: string;
  context?: {
    metric?: string;
    value?: number;
    expected?: number;
    timeframe?: string;
  };
  recommendation: string;
  related_items?: string[];
}

interface AnomaliesCardProps {
  anomalies: Anomaly[];
}

export const AnomaliesCard: React.FC<AnomaliesCardProps> = ({ anomalies }) => {
  if (anomalies.length === 0) {
    return null;
  }

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return 'var(--vscode-errorForeground)';
      case 'high': return 'var(--vscode-textLink-foreground)';
      case 'medium': return 'var(--vscode-textLink-foreground)';
      case 'low': return 'var(--vscode-descriptionForeground)';
      default: return 'var(--vscode-foreground)';
    }
  };

  const getSeverityEmoji = (severity: string): string => {
    switch (severity) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  return (
    <div style={{
      marginTop: '15px',
      padding: '12px',
      backgroundColor: 'var(--vscode-input-background)',
      border: '1px solid var(--vscode-input-border)',
      borderRadius: '4px'
    }}>
      <h3 style={{
        margin: '0 0 10px 0',
        fontSize: '14px',
        fontWeight: '600',
        color: 'var(--vscode-foreground)'
      }}>
        🚨 Anomalies Detected ({anomalies.length})
      </h3>
      
      {anomalies.map((anomaly) => (
        <div
          key={anomaly.id}
          style={{
            marginBottom: '10px',
            padding: '8px',
            backgroundColor: 'var(--vscode-editor-background)',
            borderLeft: `3px solid ${getSeverityColor(anomaly.severity)}`,
            borderRadius: '2px'
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '5px'
          }}>
            <span style={{ fontSize: '16px' }}>{getSeverityEmoji(anomaly.severity)}</span>
            <strong style={{
              fontSize: '12px',
              color: getSeverityColor(anomaly.severity),
              textTransform: 'uppercase'
            }}>
              {anomaly.type.replace(/_/g, ' ')}
            </strong>
            <span style={{
              fontSize: '10px',
              color: 'var(--vscode-descriptionForeground)',
              marginLeft: 'auto'
            }}>
              {anomaly.severity}
            </span>
          </div>
          
          <p style={{
            margin: '5px 0',
            fontSize: '11px',
            color: 'var(--vscode-foreground)',
            lineHeight: '1.4'
          }}>
            {anomaly.description}
          </p>
          
          {anomaly.context && anomaly.context.metric && (
            <div style={{
              fontSize: '10px',
              color: 'var(--vscode-descriptionForeground)',
              marginTop: '5px',
              fontFamily: 'monospace'
            }}>
              {anomaly.context.metric}: {anomaly.context.value}
              {anomaly.context.expected && ` (expected: ${anomaly.context.expected})`}
            </div>
          )}
          
          <div style={{
            marginTop: '5px',
            padding: '5px',
            backgroundColor: 'var(--vscode-input-background)',
            borderRadius: '2px',
            fontSize: '10px',
            color: 'var(--vscode-descriptionForeground)',
            fontStyle: 'italic'
          }}>
            💡 {anomaly.recommendation}
          </div>
        </div>
      ))}
    </div>
  );
};

