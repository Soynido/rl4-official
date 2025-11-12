/**
 * GoalBoard View - Visualize and manage cognitive goals
 */

import React from 'react';
import './GoalBoard.css';

interface Goal {
  id: string;
  objective: string;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  expected_duration: string;
  rationale: string[];
  created_at: string;
  status?: 'active' | 'completed' | 'deferred';
}

interface GoalBoardProps {
  goals?: Goal[];
}

const GoalBoard: React.FC<GoalBoardProps> = ({ goals = [] }) => {
  const highPriorityGoals = goals.filter(g => g.priority === 'high');
  const mediumPriorityGoals = goals.filter(g => g.priority === 'medium');
  const lowPriorityGoals = goals.filter(g => g.priority === 'low');

  const renderGoalCard = (goal: Goal) => (
    <div key={goal.id} className="goal-card">
      <div className="goal-header">
        <h4>{goal.objective}</h4>
        <span className={`priority-badge priority-${goal.priority}`}>
          {goal.priority}
        </span>
      </div>
      
      <div className="goal-confidence">
        <span>Confidence: </span>
        <div className="confidence-bar">
          <div 
            className="confidence-fill" 
            style={{ width: `${goal.confidence * 100}%` }}
          />
        </div>
        <span>{Math.round(goal.confidence * 100)}%</span>
      </div>

      <div className="goal-details">
        <div className="duration">
          <span>⏱️ {goal.expected_duration}</span>
        </div>
        
        <div className="rationale">
          <strong>Rationale:</strong>
          <ul>
            {goal.rationale.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="goal-actions">
        <button className="btn-execute">Execute</button>
        <button className="btn-defer">Defer</button>
        <button className="btn-skip">Skip</button>
      </div>
    </div>
  );

  return (
    <div className="goal-board">
      <h1>🎯 Goal Management</h1>
      
      <div className="goal-kanban">
        <div className="kanban-column">
          <h2>High Priority ({highPriorityGoals.length})</h2>
          <div className="goal-column-content">
            {highPriorityGoals.map(renderGoalCard)}
            {highPriorityGoals.length === 0 && (
              <div className="empty-column">No high priority goals</div>
            )}
          </div>
        </div>

        <div className="kanban-column">
          <h2>Medium Priority ({mediumPriorityGoals.length})</h2>
          <div className="goal-column-content">
            {mediumPriorityGoals.map(renderGoalCard)}
            {mediumPriorityGoals.length === 0 && (
              <div className="empty-column">No medium priority goals</div>
            )}
          </div>
        </div>

        <div className="kanban-column">
          <h2>Low Priority ({lowPriorityGoals.length})</h2>
          <div className="goal-column-content">
            {lowPriorityGoals.map(renderGoalCard)}
            {lowPriorityGoals.length === 0 && (
              <div className="empty-column">No low priority goals</div>
            )}
          </div>
        </div>

        <div className="kanban-column">
          <h2>Completed (0)</h2>
          <div className="goal-column-content">
            <div className="empty-column">No completed goals yet</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoalBoard;
