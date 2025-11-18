/**
 * useGitHubIntegration - GitHub connection and status management
 */

import { useState, useEffect, useCallback } from 'react';

interface GitHubStatus {
  connected: boolean;
  repo?: string;
  reason?: string;
}

export function useGitHubIntegration() {
  const [githubStatus, setGithubStatus] = useState<GitHubStatus | null>(null);

  useEffect(() => {
    if (window.vscode) {
      window.vscode.postMessage({ type: 'checkGitHubStatus' });
    }
  }, []);

  const handleConnectGitHub = useCallback(() => {
    if (window.vscode) {
      window.vscode.postMessage({ type: 'connectGitHub' });
    }
  }, []);

  return {
    githubStatus,
    setGithubStatus,
    handleConnectGitHub
  };
}

