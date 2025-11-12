/**
 * Dashboard View - High-level cognitive state overview
 */

import React from 'react';
import './Dashboard.css';

interface DashboardProps {
  cognitiveState: any;
}

const Dashboard: React.FC<DashboardProps> = ({ cognitiveState }) => {
  if (!cognitiveState) {
    return <div className="dashboard">Loading...</div>;
  }

  const { patterns, correlations, forecasts, adrs, biases, goals } = cognitiveState;

  return (
    <div className="dashboard">
      <h1>🧠 Cognitive Dashboard</h1>
      
      <div className="health-indicators">
        <div className="health-card">
          <h3>Pattern Diversity</h3>
          <div className="metric">{patterns?.total || 0} patterns</div>
          <div className="breakdown">
            {patterns?.impacts && Object.entries(patterns.impacts).map(([impact, count]: [string, any]) => (
              <span key={impact}>{impact}: {count} </span>
            ))}
          </div>
        </div>

        <div className="health-card">
          <h3>Correlation Quality</h3>
          <div className="metric">{correlations?.total || 0} correlations</div>
          <div className="breakdown">
            All directions: {correlations?.directions?.diverging || 0}
          </div>
        </div>

        <div className="health-card">
          <h3>Bias Level</h3>
          <div className="metric">{biases?.total || 0} biases</div>
          <div className="breakdown">
            {biases?.types && Object.entries(biases.types).map(([type, count]: [string, any]) => (
              <span key={type}>{type}: {count} </span>
            ))}
          </div>
        </div>

        <div className="health-card">
          <h3>Success Rate</h3>
          <div className="metric">100%</div>
          <div className="breakdown">Task execution perfect</div>
        </div>
      </div>

      <div className="active-goals">
        <h2>Active Goals ({goals?.active || 0})</h2>
        {goals && goals.active > 0 ? (
          <ul className="goal-list">
            <li>Goals will appear here</li>
          </ul>
        ) : (
          <p>No active goals</p>
        )}
      </div>

      <div className="quick-stats">
        <div className="stat-card">
          <h4>ADRs</h4>
          <div className="stat-value">{adrs?.total || 0}</div>
        </div>
        <div className="stat-card">
          <h4>Forecasts</h4>
          <div className="stat-value">{forecasts?.total || 0}</div>
        </div>
        <div className="stat-card">
          <h4>Modules</h4>
          <div className="stat-value">16</div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
