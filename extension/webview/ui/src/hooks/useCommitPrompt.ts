/**
 * useCommitPrompt - Commit prompt generation and validation
 */

import { useState, useCallback } from 'react';

interface CommitPreview {
  title?: string;
  body?: string;
}

export function useCommitPrompt() {
  const [commitPrompt, setCommitPrompt] = useState<string | null>(null);
  const [commitCommand, setCommitCommand] = useState<string | null>(null);
  const [commitWhy, setCommitWhy] = useState<string | null>(null);
  const [commitPreview, setCommitPreview] = useState<CommitPreview | null>(null);

  const handleGenerateCommitPrompt = useCallback(() => {
    if (window.vscode) {
      window.vscode.postMessage({ type: 'generateCommitPrompt' });
    }
  }, []);

  const handleValidateCommit = useCallback(() => {
    if (!commitCommand) return;

    let commandToExecute = commitCommand;

    if (commitCommand.includes('RL4_COMMIT_VALIDATE')) {
      const tokenMatch = commitCommand.match(/RL4_COMMIT_VALIDATE\s*(.+?)\s*RL4_COMMIT_END/s);
      if (tokenMatch) {
        const tokenContent = tokenMatch[1];
        const commandMatch = tokenContent.match(/COMMAND:\s*(.+?)(?:\s*RL4_COMMIT_END|$)/s);
        if (commandMatch) {
          commandToExecute = commandMatch[1].trim().replace(/\s+/g, ' ');
        } else {
          return;
        }
      } else {
        return;
      }
    }

    if (!commandToExecute.includes('gh pr create')) {
      return;
    }

    if (window.vscode) {
      window.vscode.postMessage({
        type: 'executeCommitCommand',
        command: commandToExecute
      });
    }
  }, [commitCommand]);

  const handleCommitCommandChange = useCallback((text: string) => {
    setCommitCommand(text);

    if (text.includes('RL4_COMMIT_VALIDATE') && text.includes('RL4_COMMIT_END')) {
      const tokenMatch = text.match(/RL4_COMMIT_VALIDATE\s*(.+?)\s*RL4_COMMIT_END/s);
      if (tokenMatch) {
        const tokenContent = tokenMatch[1];

        const whyMatch = tokenContent.match(/WHY:\s*(.+?)(?:\s+COMMAND:|COMMAND:)/s);
        if (whyMatch) {
          setCommitWhy(whyMatch[1].trim().replace(/\s+/g, ' '));
        }

        const commandMatch = tokenContent.match(/COMMAND:\s*(.+?)(?:\s*RL4_COMMIT_END|$)/s);
        if (commandMatch) {
          const extractedCommand = commandMatch[1].trim().replace(/\s+/g, ' ');
          const titleMatch = extractedCommand.match(/--title\s+"((?:[^"\\]|\\.)+)"/);
          const bodyMatch = extractedCommand.match(/--body\s+"((?:[^"\\]|\\.)+)"/);

          setCommitPreview({
            title: titleMatch ? titleMatch[1].replace(/\\(.)/g, '$1') : undefined,
            body: bodyMatch ? bodyMatch[1].replace(/\\n/g, '\n').replace(/\\(.)/g, '$1') : undefined
          });
        }
      }
    } else if (text.includes('gh pr create')) {
      const titleMatch = text.match(/--title\s+"([^"]+)"/);
      const bodyMatch = text.match(/--body\s+"([^"]+)"/);

      setCommitPreview({
        title: titleMatch ? titleMatch[1] : undefined,
        body: bodyMatch ? bodyMatch[1].replace(/\\n/g, '\n') : undefined
      });
    }
  }, []);

  const resetCommit = useCallback(() => {
    setCommitCommand(null);
    setCommitPrompt(null);
    setCommitWhy(null);
    setCommitPreview(null);
  }, []);

  return {
    commitPrompt,
    setCommitPrompt,
    commitCommand,
    setCommitCommand,
    commitWhy,
    setCommitWhy,
    commitPreview,
    setCommitPreview,
    handleGenerateCommitPrompt,
    handleValidateCommit,
    handleCommitCommandChange,
    resetCommit
  };
}

