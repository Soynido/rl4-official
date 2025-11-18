/**
 * useKPIs - KPI data management and parsing
 */

import { useState, useEffect } from 'react';
import { getMockKPIData, type CognitiveLoadData, type NextTasksData, type PlanDriftData, type RisksData } from '../utils/contextParser';

export function useKPIs() {
  const [cognitiveLoad, setCognitiveLoad] = useState<CognitiveLoadData | null>(null);
  const [nextTasks, setNextTasks] = useState<NextTasksData | null>(null);
  const [planDrift, setPlanDrift] = useState<PlanDriftData | null>(null);
  const [risks, setRisks] = useState<RisksData | null>(null);
  const [showKPIs, setShowKPIs] = useState(false);

  useEffect(() => {
    const mockData = getMockKPIData();
    setCognitiveLoad(mockData.cognitiveLoad);
    setNextTasks(mockData.nextTasks);
    setPlanDrift(mockData.planDrift);
    setRisks(mockData.risks);
    setShowKPIs(true);
  }, []);

  return {
    cognitiveLoad,
    setCognitiveLoad,
    nextTasks,
    setNextTasks,
    planDrift,
    setPlanDrift,
    risks,
    setRisks,
    showKPIs
  };
}

