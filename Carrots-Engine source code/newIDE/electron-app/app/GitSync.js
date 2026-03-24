const child_process = require('child_process');
const electron = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULT_TIMEOUT_MS = 60000;

const runCommand = (command, args, cwd, timeoutMs = DEFAULT_TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    child_process.execFile(
      command,
      args,
      {
        cwd,
        timeout: timeoutMs,
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        const output = {
          stdout: stdout ? String(stdout).trim() : '',
          stderr: stderr ? String(stderr).trim() : '',
        };

        if (error) {
          error.stdout = output.stdout;
          error.stderr = output.stderr;
          reject(error);
          return;
        }

        resolve(output);
      }
    );
  });

const isGitMissingError = error => !!error && error.code === 'ENOENT';

const isNotRepositoryError = error => {
  if (!error) return false;
  const message = `${error.message || ''} ${error.stderr || ''}`.toLowerCase();
  return message.includes('not a git repository');
};

const isNoRemoteError = error => {
  if (!error) return false;
  const message = `${error.message || ''} ${error.stderr || ''}`.toLowerCase();
  return (
    message.includes('no such remote') ||
    message.includes("no remote configured for branch")
  );
};

const isNothingToCommitError = error => {
  if (!error) return false;
  const message = `${error.message || ''} ${error.stdout || ''} ${
    error.stderr || ''
  }`.toLowerCase();
  return (
    message.includes('nothing to commit') ||
    message.includes('no changes added to commit')
  );
};

const normalizeProjectWorkingDirectory = projectPath => {
  if (typeof projectPath !== 'string' || !projectPath.trim()) {
    throw new Error('A valid project path is required.');
  }

  const absolutePath = path.resolve(projectPath.trim());
  if (!fs.existsSync(absolutePath)) {
    throw new Error('Project path does not exist.');
  }

  const stats = fs.statSync(absolutePath);
  return stats.isDirectory() ? absolutePath : path.dirname(absolutePath);
};

const runGitCommand = (args, cwd, timeoutMs) =>
  runCommand('git', args, cwd, timeoutMs);

const ensureGitAvailable = async cwd => {
  try {
    await runGitCommand(['--version'], cwd);
  } catch (error) {
    if (isGitMissingError(error)) {
      throw new Error(
        'Git is not installed or unavailable in PATH. Install Git and restart Carrots Engine.'
      );
    }
    throw error;
  }
};

const parseBranchHeader = headerLine => {
  const info = {
    branchName: null,
    upstreamBranchName: null,
    aheadCount: 0,
    behindCount: 0,
  };
  if (!headerLine || !headerLine.startsWith('## ')) {
    return info;
  }

  const noCommitMatch = headerLine.match(/^##\s+No commits yet on\s+(.+)$/);
  if (noCommitMatch) {
    info.branchName = noCommitMatch[1].trim();
    return info;
  }

  const detachedMatch = headerLine.match(/^##\s+HEAD \(no branch\)$/);
  if (detachedMatch) {
    info.branchName = 'HEAD';
    return info;
  }

  const branchMatch = headerLine.match(
    /^##\s+([^.\s]+)(?:\.\.\.([^\s]+))?(?:\s+\[(.+)\])?$/
  );

  if (!branchMatch) {
    return info;
  }

  info.branchName = branchMatch[1] || null;
  info.upstreamBranchName = branchMatch[2] || null;

  const aheadBehind = branchMatch[3];
  if (!aheadBehind) {
    return info;
  }

  aheadBehind.split(',').forEach(part => {
    const trimmedPart = part.trim();
    const aheadMatch = trimmedPart.match(/^ahead\s+(\d+)$/);
    if (aheadMatch) {
      info.aheadCount = parseInt(aheadMatch[1], 10) || 0;
      return;
    }

    const behindMatch = trimmedPart.match(/^behind\s+(\d+)$/);
    if (behindMatch) {
      info.behindCount = parseInt(behindMatch[1], 10) || 0;
    }
  });

  return info;
};

const parseStatusCounters = lines => {
  let stagedCount = 0;
  let changedCount = 0;
  let untrackedCount = 0;
  let conflictedCount = 0;

  for (const line of lines) {
    if (!line || line.length < 2 || line.startsWith('## ')) {
      continue;
    }

    const x = line[0];
    const y = line[1];

    if (x === '?' && y === '?') {
      untrackedCount++;
      continue;
    }

    const isConflict =
      x === 'U' ||
      y === 'U' ||
      (x === 'A' && y === 'A') ||
      (x === 'D' && y === 'D');
    if (isConflict) {
      conflictedCount++;
    }

    if (x !== ' ' && x !== '?') {
      stagedCount++;
    }
    if (y !== ' ' && y !== '?') {
      changedCount++;
    }
  }

  return {
    stagedCount,
    changedCount,
    untrackedCount,
    conflictedCount,
  };
};

const getRepositoryRoot = async workingDirectory => {
  try {
    const result = await runGitCommand(
      ['rev-parse', '--show-toplevel'],
      workingDirectory
    );
    return result.stdout || null;
  } catch (error) {
    if (isNotRepositoryError(error)) return null;
    throw error;
  }
};

const getCurrentBranch = async repositoryRoot => {
  const result = await runGitCommand(
    ['rev-parse', '--abbrev-ref', 'HEAD'],
    repositoryRoot
  );
  return result.stdout || null;
};

const getRemoteOriginUrl = async repositoryRoot => {
  try {
    const result = await runGitCommand(
      ['remote', 'get-url', 'origin'],
      repositoryRoot
    );
    return result.stdout || null;
  } catch (error) {
    if (isNoRemoteError(error)) {
      return null;
    }
    throw error;
  }
};

const getGitSyncState = async projectPath => {
  const workingDirectory = normalizeProjectWorkingDirectory(projectPath);
  await ensureGitAvailable(workingDirectory);

  const repositoryRoot = await getRepositoryRoot(workingDirectory);
  if (!repositoryRoot) {
    return {
      supported: true,
      isRepository: false,
      workingDirectory,
      repositoryRoot: null,
      branchName: null,
      upstreamBranchName: null,
      aheadCount: 0,
      behindCount: 0,
      stagedCount: 0,
      changedCount: 0,
      untrackedCount: 0,
      conflictedCount: 0,
      remoteOriginUrl: null,
    };
  }

  const statusResult = await runGitCommand(
    ['status', '--porcelain=v1', '--branch'],
    repositoryRoot
  );

  const statusLines = statusResult.stdout
    ? statusResult.stdout.split(/\r?\n/).filter(Boolean)
    : [];

  const branchInfo = parseBranchHeader(statusLines[0] || '');
  const statusCounters = parseStatusCounters(statusLines);
  const remoteOriginUrl = await getRemoteOriginUrl(repositoryRoot);

  return {
    supported: true,
    isRepository: true,
    workingDirectory,
    repositoryRoot,
    remoteOriginUrl,
    ...branchInfo,
    ...statusCounters,
  };
};

const ensureRepositoryRoot = async projectPath => {
  const state = await getGitSyncState(projectPath);
  if (!state.isRepository || !state.repositoryRoot) {
    throw new Error('This project is not initialized as a Git repository.');
  }
  return state.repositoryRoot;
};

const normalizeCommitMessage = commitMessage => {
  if (typeof commitMessage !== 'string') {
    throw new Error('A commit message is required.');
  }
  const trimmed = commitMessage.trim();
  if (!trimmed) {
    throw new Error('Commit message cannot be empty.');
  }
  return trimmed;
};

const normalizeRemoteUrl = remoteUrl => {
  if (typeof remoteUrl !== 'string') {
    throw new Error('A remote URL is required.');
  }
  const trimmed = remoteUrl.trim();
  if (!trimmed) {
    throw new Error('Remote URL cannot be empty.');
  }
  return trimmed;
};

const normalizeRemoteUrlForBrowser = remoteUrl => {
  if (!remoteUrl) return null;

  if (remoteUrl.startsWith('git@')) {
    const sshMatch = remoteUrl.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
    if (sshMatch) {
      return `https://${sshMatch[1]}/${sshMatch[2]}`;
    }
  }

  if (
    remoteUrl.startsWith('http://') ||
    remoteUrl.startsWith('https://')
  ) {
    return remoteUrl.endsWith('.git')
      ? remoteUrl.slice(0, remoteUrl.length - 4)
      : remoteUrl;
  }

  return remoteUrl;
};

const registerGitSyncIpcHandlers = ipcMain => {
  ipcMain.handle('git-sync-get-state', async (event, { projectPath }) =>
    getGitSyncState(projectPath)
  );

  ipcMain.handle('git-sync-init-repository', async (event, { projectPath }) => {
    const workingDirectory = normalizeProjectWorkingDirectory(projectPath);
    await ensureGitAvailable(workingDirectory);
    await runGitCommand(['init'], workingDirectory);
    return getGitSyncState(projectPath);
  });

  ipcMain.handle(
    'git-sync-set-remote-origin',
    async (event, { projectPath, remoteUrl }) => {
      const repositoryRoot = await ensureRepositoryRoot(projectPath);
      const normalizedRemoteUrl = normalizeRemoteUrl(remoteUrl);

      try {
        await runGitCommand(['remote', 'get-url', 'origin'], repositoryRoot);
        await runGitCommand(
          ['remote', 'set-url', 'origin', normalizedRemoteUrl],
          repositoryRoot
        );
      } catch (error) {
        if (isNoRemoteError(error)) {
          await runGitCommand(
            ['remote', 'add', 'origin', normalizedRemoteUrl],
            repositoryRoot
          );
        } else {
          throw error;
        }
      }

      return getGitSyncState(projectPath);
    }
  );

  ipcMain.handle('git-sync-fetch-origin', async (event, { projectPath }) => {
    const repositoryRoot = await ensureRepositoryRoot(projectPath);
    await runGitCommand(['fetch', 'origin', '--prune'], repositoryRoot);
    return getGitSyncState(projectPath);
  });

  ipcMain.handle('git-sync-pull-origin', async (event, { projectPath }) => {
    const repositoryRoot = await ensureRepositoryRoot(projectPath);
    const branchName = await getCurrentBranch(repositoryRoot);
    if (!branchName || branchName === 'HEAD') {
      throw new Error('Cannot pull while repository is in detached HEAD state.');
    }

    await runGitCommand(
      ['pull', '--rebase', '--autostash', 'origin', branchName],
      repositoryRoot
    );
    return getGitSyncState(projectPath);
  });

  ipcMain.handle('git-sync-push-origin', async (event, { projectPath }) => {
    const repositoryRoot = await ensureRepositoryRoot(projectPath);
    const branchName = await getCurrentBranch(repositoryRoot);
    if (!branchName || branchName === 'HEAD') {
      throw new Error('Cannot push while repository is in detached HEAD state.');
    }

    await runGitCommand(['push', '-u', 'origin', branchName], repositoryRoot);
    return getGitSyncState(projectPath);
  });

  ipcMain.handle(
    'git-sync-commit-all',
    async (event, { projectPath, commitMessage }) => {
      const repositoryRoot = await ensureRepositoryRoot(projectPath);
      const normalizedCommitMessage = normalizeCommitMessage(commitMessage);

      await runGitCommand(['add', '-A'], repositoryRoot);

      let noChangesCommitted = false;
      try {
        await runGitCommand(
          ['commit', '-m', normalizedCommitMessage],
          repositoryRoot
        );
      } catch (error) {
        if (isNothingToCommitError(error)) {
          noChangesCommitted = true;
        } else {
          throw error;
        }
      }

      return {
        noChangesCommitted,
        state: await getGitSyncState(projectPath),
      };
    }
  );

  ipcMain.handle('git-sync-open-remote-origin', async (event, { projectPath }) => {
    const repositoryRoot = await ensureRepositoryRoot(projectPath);
    const remoteOriginUrl = await getRemoteOriginUrl(repositoryRoot);
    if (!remoteOriginUrl) {
      throw new Error('No origin remote configured.');
    }

    const browserUrl = normalizeRemoteUrlForBrowser(remoteOriginUrl);
    if (!browserUrl) {
      throw new Error('Unable to open remote URL.');
    }

    await electron.shell.openExternal(browserUrl);
    return { opened: true, url: browserUrl };
  });
};

module.exports = {
  registerGitSyncIpcHandlers,
};
