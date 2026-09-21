import { spawnSync } from 'node:child_process'

/** Keep Windows workers in separate process groups so Ctrl+C only interrupts the supervisor. */
export function devSpawnOptions({ root, env, npmCli, platform = process.platform }) {
  const windows = platform === 'win32'
  return {
    cwd: root,
    env,
    // Pipes keep output visible even when Windows creates a hidden console for detached workers.
    stdio: windows ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    shell: windows && !npmCli,
    detached: true,
    windowsHide: windows,
  }
}

/** Kill the whole process tree rather than just the npm wrapper process. */
export function terminateDevTree(child, signal, {
  platform = process.platform,
  run = spawnSync,
  killGroup = process.kill,
} = {}) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return

  if (platform === 'win32') {
    const result = run('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    })
    if (!result.error && result.status === 0) return
    // A fallback does not necessarily kill descendants; surface the problem to the operator.
    child.kill(signal)
    throw new Error(`taskkill /T が失敗しました（${result.error?.message ?? `status=${result.status}`}）。ポート3000/3001を確認してください。`)
  }

  killGroup(-child.pid, signal)
}
