import { useState } from 'react';
import { useRL4Store } from '@/api/useRL4Store';

export function Before() {
  const before = useRL4Store(s => s.before);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);

  // No early return - compute derived state unconditionally
  const selectedData = (before && selectedPoint !== null)
    ? before.points.find(p => p.cycleId === selectedPoint)
    : null;

  return (
    <div className="rl4-card">
      <div className="rl4-card__header">
        <h2 className="rl4-card__title">Before — Time Capsule {before ? `(${before.date})` : ''}</h2>
      </div>
      <div className="rl4-card__body">
        {!before ? (
          <p style={{ color: 'var(--rl4-text-muted)' }}>No historical data available</p>
        ) : (
          <>
            <div style={{ marginBottom: 'var(--rl4-space-lg)' }}>
              <h3 style={{
                fontSize: 'var(--rl4-font-base)',
                fontWeight: 'var(--rl4-font-weight-medium)',
                marginBottom: 'var(--rl4-space-md)',
                color: 'var(--rl4-text-primary)'
              }}>
                Timeline Points ({before.points.length})
              </h3>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--rl4-space-sm)',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                {before.points.map((point) => (
                  <div
                    key={point.cycleId}
                    onClick={() => setSelectedPoint(point.cycleId)}
                    className={`rl4-stat-card ${selectedPoint === point.cycleId ? 'rl4-card--glow' : ''}`}
                    style={{
                      cursor: 'pointer',
                      padding: 'var(--rl4-space-md)',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 'var(--rl4-space-xs)'
                    }}>
                      <span style={{
                        fontWeight: 'var(--rl4-font-weight-medium)',
                        color: 'var(--rl4-text-primary)'
                      }}>
                        Cycle {point.cycleId}
                      </span>
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: point.heat > 0.7 ? 'var(--rl4-error)' :
                                           point.heat > 0.4 ? 'var(--rl4-warning)' :
                                           'var(--rl4-success)',
                          boxShadow: `0 0 8px ${point.heat > 0.7 ? 'var(--rl4-error)' :
                                                 point.heat > 0.4 ? 'var(--rl4-warning)' :
                                                 'var(--rl4-success)'}`
                        }}
                      />
                    </div>
                    <div style={{
                      fontSize: 'var(--rl4-font-xs)',
                      color: 'var(--rl4-text-muted)',
                      marginBottom: 'var(--rl4-space-xs)'
                    }}>
                      {new Date(point.timestamp).toLocaleString()}
                    </div>
                    {point.summary && (
                      <div style={{
                        fontSize: 'var(--rl4-font-sm)',
                        color: 'var(--rl4-text-secondary)'
                      }}>
                        {point.summary}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {selectedData && (
              <div className="rl4-divider" />
            )}

            {selectedData && (
              <div>
                <h3 style={{
                  fontSize: 'var(--rl4-font-base)',
                  fontWeight: 'var(--rl4-font-weight-medium)',
                  marginBottom: 'var(--rl4-space-md)',
                  color: 'var(--rl4-text-primary)'
                }}>
                  Snapshot Details
                </h3>
                <div className="rl4-code">
                  <div><strong>Cycle:</strong> {selectedData.cycleId}</div>
                  <div><strong>Timestamp:</strong> {selectedData.timestamp}</div>
                  <div><strong>Heat:</strong> {Math.round(selectedData.heat * 100)}%</div>
                  {selectedData.summary && (
                    <div><strong>Summary:</strong> {selectedData.summary}</div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
