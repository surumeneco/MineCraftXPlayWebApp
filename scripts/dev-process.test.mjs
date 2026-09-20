import assert from 'node:assert/strict'
import { test } from 'node:test'
import { devSpawnOptions, terminateDevTree } from './dev-process.mjs'

test('Windows uses a detached, hidden process group and forwarded output', () => {
  const opts = devSpawnOptions({ root: '/repo', env: {}, npmCli: 'npm-cli.js', platform: 'win32' })
  assert.equal(opts.detached, true)
  assert.equal(opts.windowsHide, true)
  assert.equal(opts.shell, false)
  assert.deepEqual(opts.stdio, ['inherit', 'pipe', 'pipe'])
})

test('Windows fallback npm.cmd uses shell without changing the isolated process group', () => {
  const opts = devSpawnOptions({ root: '/repo', env: {}, npmCli: undefined, platform: 'win32' })
  assert.equal(opts.shell, true)
  assert.equal(opts.detached, true)
})

test('Windows Ctrl+C terminates the entire npm process tree', () => {
  let command
  const child = { pid: 123, exitCode: null, signalCode: null, kill: () => assert.fail('no fallback expected') }
  terminateDevTree(child, 'SIGINT', {
    platform: 'win32',
    run: (...args) => { command = args; return { status: 0 } },
  })
  assert.equal(command[0], 'taskkill')
  assert.deepEqual(command[1], ['/PID', '123', '/T', '/F'])
})

test('Windows taskkill failure reports it and falls back to the direct process', () => {
  let fallback
  const child = { pid: 123, exitCode: null, signalCode: null, kill: signal => { fallback = signal } }
  assert.throws(() => terminateDevTree(child, 'SIGINT', {
    platform: 'win32', run: () => ({ status: 1 }),
  }), /ポート3000\/3001/)
  assert.equal(fallback, 'SIGINT')
})

test('Linux shutdown targets the entire detached process group', () => {
  let result
  terminateDevTree({ pid: 456, exitCode: null, signalCode: null }, 'SIGTERM', {
    platform: 'linux', killGroup: (pid, signal) => { result = [pid, signal] },
  })
  assert.deepEqual(result, [-456, 'SIGTERM'])
})

test('Exiting children are not signaled a second time', () => {
  terminateDevTree({ pid: 789, exitCode: 0, signalCode: null }, 'SIGTERM', {
    platform: 'win32', run: () => assert.fail('must not kill exited PID'),
  })
})
