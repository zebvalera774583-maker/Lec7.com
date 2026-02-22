#!/usr/bin/env node
/**
 * Guard: User.role можно менять только из whitelist-путей.
 * Валит билд при попытке обновить role вне разрешённых мест.
 *
 * Whitelist:
 *   - app/api/admin/**
 *   - app/api/internal/** (bootstrap/seed владельца)
 *   - scripts/**
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

const WHITELIST_PATTERNS = [
  /^app[\\/]api[\\/]admin[\\/]/,
  /^app[\\/]api[\\/]internal[\\/]/,
  /^scripts[\\/]/,
]

const SCAN_DIRS = ['app', 'lib']
const SCAN_EXT = ['.ts', '.tsx']
const EXCLUDE_DIRS = ['node_modules', '.next', 'dist']

const DANGEROUS_PATTERNS = [
  /prisma\.user\.update\s*\(/,
  /prisma\.user\.updateMany\s*\(/,
  /prisma\.user\.upsert\s*\(/,
]

const ROLE_IN_DATA = /(?:data|create|update)\s*:\s*\{[\s\S]*?['"]?role['"]?\s*:/

function isWhitelisted(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/')
  return WHITELIST_PATTERNS.some((p) => p.test(rel))
}

function collectFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(e.name)) {
        collectFiles(full, files)
      }
    } else if (SCAN_EXT.some((ext) => e.name.endsWith(ext))) {
      files.push(full)
    }
  }
  return files
}

function extractCallBlock(content, startIdx) {
  let depth = 0
  let i = content.indexOf('(', startIdx)
  if (i < 0) return ''
  depth = 1
  i++
  const begin = i
  while (i < content.length && depth > 0) {
    const c = content[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    i++
  }
  return content.slice(begin, i - 1)
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const rel = path.relative(ROOT, filePath)

  for (const dangerous of DANGEROUS_PATTERNS) {
    let idx = 0
    while (true) {
      const match = content.slice(idx).match(dangerous)
      if (!match) break
      const callStart = idx + match.index
      const block = extractCallBlock(content, callStart)
      if (ROLE_IN_DATA.test(block)) {
        const lineNum = content.slice(0, callStart).split('\n').length
        return { file: rel, line: lineNum }
      }
      idx = callStart + 1
    }
  }
  return null
}

function main() {
  const violations = []
  for (const dir of SCAN_DIRS) {
    const base = path.join(ROOT, dir)
    const files = collectFiles(base)
    for (const f of files) {
      if (isWhitelisted(f)) continue
      const v = checkFile(f)
      if (v) violations.push(v)
    }
  }

  if (violations.length > 0) {
    console.error('\n[guard-primary-role] User.role можно менять только из whitelist:\n')
    console.error('  app/api/admin/**')
    console.error('  app/api/internal/**')
    console.error('  scripts/**\n')
    console.error('Найдены запрещённые обновления User.role:\n')
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}`)
    }
    console.error('')
    process.exit(1)
  }
  console.log('[guard-primary-role] OK')
}

main()
