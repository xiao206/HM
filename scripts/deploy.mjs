import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function exec(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    stdio: 'inherit',
    ...opts,
  })
}

function execText(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    ...opts,
  }).trim()
}

function exists(p) {
  try {
    fs.accessSync(p)
    return true
  } catch {
    return false
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(s, d)
      continue
    }
    if (entry.isSymbolicLink()) {
      const link = fs.readlinkSync(s)
      fs.symlinkSync(link, d)
      continue
    }
    fs.copyFileSync(s, d)
  }
}

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')

const repoRoot = process.cwd()
if (!exists(path.join(repoRoot, '.git'))) {
  throw new Error('必须在 git 仓库根目录执行（未找到 .git）')
}

const startBranch = execText('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
const startStatus = execText('git', ['status', '--porcelain'])
if (startStatus) {
  throw new Error('工作区不干净，请先提交/暂存/还原改动后再发布')
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hm-dist-'))
const tempDist = path.join(tempDir, 'dist')

function cleanupTemp() {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true })
  } catch {}
}

function safeCheckout(branch) {
  exec('git', ['checkout', branch])
}

try {
  if (!exists(path.join(repoRoot, 'node_modules'))) {
    exec('npm', ['ci', '--no-audit', '--no-fund'])
  }

  exec('npm', ['run', 'build'])

  const builtDist = path.join(repoRoot, 'dist')
  if (!exists(path.join(builtDist, 'index.html'))) {
    throw new Error('构建产物 dist/index.html 不存在，请检查构建是否成功')
  }

  copyDir(builtDist, tempDist)

  const featHash = execText('git', ['rev-parse', '--short', 'HEAD'])

  exec('git', ['fetch', 'origin', 'main'])

  const hasLocalMain = exists(path.join(repoRoot, '.git', 'refs', 'heads', 'main'))
  if (!hasLocalMain) {
    exec('git', ['checkout', '-B', 'main', 'origin/main'])
  } else {
    safeCheckout('main')
  }

  exec('git', ['reset', '--hard', 'origin/main'])
  exec('git', ['clean', '-fd'])

  const deployDist = path.join(repoRoot, 'dist')
  fs.rmSync(deployDist, { recursive: true, force: true })
  copyDir(tempDist, deployDist)

  exec('git', ['add', 'dist'])

  let hasChanges = true
  try {
    execFileSync('git', ['diff', '--cached', '--quiet'])
    hasChanges = false
  } catch {}

  if (!dryRun && hasChanges) {
    exec('git', ['commit', '-m', `deploy: sync dist from feat/vue-static (${featHash})`])
    exec('git', ['push', 'origin', 'main'])
  }
} finally {
  try {
    safeCheckout(startBranch)
  } catch {}
  cleanupTemp()
}
