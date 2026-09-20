import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envFile = resolve(root, '.env')

if (!existsSync(envFile)) {
  console.error('[dev] .env がありません。ルートで .env.example を .env にコピーし、DBパスワードを設定してください。')
  process.exit(1)
}

// npm scripts do not load .env automatically; Docker Compose does. Share one configuration.
const env = { ...parseEnv(readFileSync(envFile, 'utf8')), ...process.env }
for (const key of ['POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD']) {
  if (!env[key]) {
    console.error(`[dev] .env に ${key} を設定してください。`)
    process.exit(1)
  }
}

const dbPort = Number(env.POSTGRES_PORT ?? '5432')
if (!Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65535) {
  console.error('[dev] POSTGRES_PORT には有効なポート番号を指定してください。')
  process.exit(1)
}

// Existing Docker frontend/backend containers or another dev server would clash with host processes.
async function checkPort(port) {
  return new Promise((resolveCheck) => {
    const server = createServer()
    server.once('error', resolveCheck)
    server.listen(port, '0.0.0.0', () => server.close(() => resolveCheck(null)))
  })
}
for (const port of [3000, 3001]) {
  const error = await checkPort(port)
  if (error) {
    console.error(`[dev] ポート ${port} が使用中です（${error.code}）。既存の開発サーバー、または Docker の frontend/backend を停止してください。`)
    console.error('[dev] Docker版の場合: docker compose -f compose.yaml -f compose.dev.yaml stop frontend backend')
    process.exit(1)
  }
}

console.log('[dev] PostgreSQL を Docker Compose で起動し、ヘルスチェックを待機します。')
const database = spawnSync('docker', [
  'compose', '-f', 'compose.yaml', '-f', 'compose.dev.yaml',
  'up', '-d', '--wait', 'db',
], { cwd: root, env, stdio: 'inherit' })
if (database.error || database.status !== 0) {
  console.error(`[dev] DB の起動に失敗しました。${database.error?.message ?? 'Docker Compose のログを確認してください。'}`)
  process.exit(1)
}

// The API runs on the host rather than inside Docker, so 'db:5432' cannot be used here.
const databaseUrl = `postgresql://${encodeURIComponent(env.POSTGRES_USER)}:${encodeURIComponent(env.POSTGRES_PASSWORD)}@127.0.0.1:${dbPort}/${encodeURIComponent(env.POSTGRES_DB)}`
const childEnv = {
  ...env,
  NODE_ENV: 'development',
  PORT: '3001',
  DATABASE_URL: databaseUrl,
  FRONTEND_ORIGIN: env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
  NUXT_PUBLIC_API_BASE: env.NUXT_PUBLIC_API_BASE ?? 'http://localhost:3001/api',
}

// npm_execpath is set by `npm run dev` and works on Windows without shell quoting.
const npmCli = env.npm_execpath
const executable = npmCli ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm')
const children = new Map()
let stopping = false

function stop(signal = 'SIGTERM') {
  if (stopping) return
  stopping = true
  for (const child of children.values()) {
    if (child.exitCode !== null || child.signalCode !== null) continue
    try {
      if (process.platform === 'win32') child.kill(signal)
      else process.kill(-child.pid, signal)
    } catch (error) {
      if (error.code !== 'ESRCH') console.error('[dev] 子プロセスの停止に失敗:', error)
    }
  }
}

process.on('SIGINT', () => {
  process.exitCode = 130
  stop('SIGINT')
})
process.on('SIGTERM', () => {
  process.exitCode = 143
  stop('SIGTERM')
})

console.log('[dev] Nuxt: http://localhost:3000 / NestJS: http://localhost:3001/api/health')
console.log('[dev] Ctrl+C で両方を停止します。PostgreSQL は保持されます。')
for (const [name, script] of [['frontend', 'dev:frontend'], ['backend', 'dev:backend']]) {
  const args = npmCli ? [npmCli, 'run', script] : ['run', script]
  const child = spawn(executable, args, {
    cwd: root,
    env: childEnv,
    stdio: 'inherit',
    shell: process.platform === 'win32' && !npmCli,
    detached: process.platform !== 'win32',
  })
  children.set(name, child)
  child.on('error', (error) => {
    console.error(`[dev] ${name} の起動に失敗: ${error.message}`)
    process.exitCode = 1
    stop()
  })
  child.on('exit', (code, signal) => {
    children.delete(name)
    if (stopping) return
    console.error(`[dev] ${name} が終了しました（code=${code}, signal=${signal}）。残りの開発サーバーを停止します。`)
    process.exitCode = code ?? 1
    stop()
  })
}
