import { useState } from 'react';
import { useRL4Store } from '@/api/useRL4Store';

export function Restore() {
  const restore = useRL4Store(s => s.restore);
  const [selectedEntry, setSelectedEntry] = useState<number | null>(null);

  // No early return - compute derived state unconditionally
  const selectedData = (restore && selectedEntry !== null)
    ? restore.entries.find(e => e.cycleId === selectedEntry)
    : null;

  const handleDownload = async (entry: any) => {
    // TODO: Implement download via postMessage to extension
  };

  const handleOpenInCursor = async (entry: any) => {
    // TODO: Implement via postMessage to extension
  };

  return (
    <div className="rl4-card">
      <div className="rl4-card__header">
        <h2 className="rl4-card__title">Restore — Export & Reopen</h2>
      </div>
      <div className="rl4-card__body">
        {!restore ? (
          <p style={{ color: 'var(--rl4-text-muted)' }}>No restore points available</p>
        ) : (
          <>
            <div style={{ marginBottom: 'var(--rl4-space-lg)' }}>
              <h3 style={{
                fontSize: 'var(--rl4-font-base)',
                fontWeight: 'var(--rl4-font-weight-medium)',
                marginBottom: 'var(--rl4-space-md)',
                color: 'var(--rl4-text-primary)'
              }}>
                Available Restore Points ({restore.entries.length})
              </h3>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--rl4-space-sm)',
                maxHeight: '400px',
                overflowY: 'auto'
              }}>
                {restore.entries.map((entry) => (
                  <div
                    key={entry.cycleId}
                    onClick={() => setSelectedEntry(entry.cycleId)}
                    className={`rl4-stat-card ${selectedEntry === entry.cycleId ? 'rl4-card--glow' : ''}`}
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
                        {entry.label || `Cycle ${entry.cycleId}`}
                      </span>
                      <span style={{
                        fontSize: 'var(--rl4-font-xs)',
                        color: 'var(--rl4-text-muted)'
                      }}>
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div style={{
                      fontSize: 'var(--rl4-font-sm)',
                      color: 'var(--rl4-text-secondary)'
                    }}>
                      Artifacts: {Object.keys(entry.artifacts).join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedData && (
              <>
                <div className="rl4-divider" />
                <div>
                  <h3 style={{
                    fontSize: 'var(--rl4-font-base)',
                    fontWeight: 'var(--rl4-font-weight-medium)',
                    marginBottom: 'var(--rl4-space-md)',
                    color: 'var(--rl4-text-primary)'
                  }}>
                    Restore Point Details
                  </h3>
                  <div className="rl4-code" style={{ marginBottom: 'var(--rl4-space-md)' }}>
                    <div><strong>Cycle:</strong> {selectedData.cycleId}</div>
                    <div><strong>Timestamp:</strong> {selectedData.timestamp}</div>
                    {selectedData.label && (
                      <div><strong>Label:</strong> {selectedData.label}</div>
                    )}
                    <div><strong>Artifacts:</strong></div>
                    <ul style={{ marginLeft: 'var(--rl4-space-md)', marginTop: 'var(--rl4-space-xs)' }}>
                      {Object.entries(selectedData.artifacts).map(([key, path]) => (
                        <li key={key}>{key}: {path}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={{
                    display: 'flex',
                    gap: 'var(--rl4-space-md)'
                  }}>
                    <button
                      className="rl4-btn rl4-btn--primary"
                      onClick={() => handleDownload(selectedData)}
                    >
                      📦 Download Archive
                    </button>
                    <button
                      className="rl4-btn rl4-btn--secondary"
                      onClick={() => handleOpenInCursor(selectedData)}
                    >
                      🚀 Open in Cursor
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
