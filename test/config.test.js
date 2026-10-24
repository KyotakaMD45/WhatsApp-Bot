const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const test = require('node:test')

const envKeys = [
  'SESSION_ID',
  'SESSION_IDS',
  'PAIR_NUMBER',
  'PAIR_NUMBERS',
  'BOT_LANG',
  'PREFIX',
  'ANTIWORDS',
  'GROUP_ADMINS',
  'WARN_RESET_MESSAGE',
  'BING_COOKIE',
  'YT_COOKIE',
  'DISABLE_BOT',
  'WARN_LIMIT',
]

function loadConfig(values, legacyConfig) {
  const previous = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))
  const originalLoad = Module._load

  for (const key of envKeys) delete process.env[key]
  Object.assign(process.env, values)
  delete require.cache[require.resolve('../config')]
  Module._load = function (request, parent, isMain) {
    if (request === 'dotenv') return { config() {} }
    if (request === 'fs' && legacyConfig) {
      return {
        ...fs,
        existsSync: (file) => file.endsWith('config.json') || fs.existsSync(file),
        readFileSync: (file, ...args) =>
          file.endsWith('config.json') ? JSON.stringify(legacyConfig) : fs.readFileSync(file, ...args),
      }
    }
    return originalLoad.call(this, request, parent, isMain)
  }

  try {
    return require('../config')
  } finally {
    Module._load = originalLoad
    delete require.cache[require.resolve('../config')]
    for (const key of envKeys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
}

test('keeps the legacy single-session configuration working', () => {
  const config = loadConfig({ SESSION_ID: 'legacy-session', PAIR_NUMBER: '+1 (234)' })

  assert.deepEqual(config.SESSION_IDS, ['legacy-session'])
  assert.deepEqual(config.PAIR_NUMBERS, ['1234'])
  assert.equal(config.SESSION_COUNT, 1)
})

test('configures session count from multiple credentials or pairing numbers', () => {
  const config = loadConfig({
    SESSION_IDS: 'first-session, second-session',
    PAIR_NUMBERS: '123, 456, 789',
  })

  assert.deepEqual(config.SESSION_IDS, ['first-session', 'second-session'])
  assert.deepEqual(config.PAIR_NUMBERS, ['123', '456', '789'])
  assert.equal(config.SESSION_COUNT, 3)
})

test('preserves empty session indexes in comma-separated configuration', () => {
  const config = loadConfig({
    SESSION_IDS: 'first-session,,third-session,',
    PAIR_NUMBERS: '123,,789,',
  })

  assert.deepEqual(config.SESSION_IDS, ['first-session', '', 'third-session'])
  assert.deepEqual(config.PAIR_NUMBERS, ['123', '', '789'])
  assert.equal(config.SESSION_COUNT, 3)
})

test('rejects unsupported interface languages explicitly', () => {
  assert.throws(
    () => loadConfig({ BOT_LANG: 'xx' }),
    /Unsupported BOT_LANG "xx"/
  )
})

test('loads moderation settings and legacy cookie alias from the environment', () => {
  const config = loadConfig({
    ANTIWORDS: ' spam, rude ',
    GROUP_ADMINS: '+1 (234), 567',
    WARN_RESET_MESSAGE: 'Warns reset for &mention',
    BING_COOKIE: 'cookies.txt',
    DISABLE_BOT: 'true',
  })

  assert.deepEqual(config.ANTIWORDS, ['spam', 'rude'])
  assert.deepEqual(config.GROUP_ADMINS, ['1234', '567'])
  assert.equal(config.WARN_RESET_MESSAGE, 'Warns reset for &mention')
  assert.equal(config.YT_COOKIE, 'cookies.txt')
  assert.equal(config.BOT_ENABLED, false)
})

test('loads supported settings from the legacy JSON sessions', () => {
  const config = loadConfig(
    {},
    {
      session1: {
        SESSION_ID: 'first-session',
        PREFIX: '^.',
        WARN_LIMIT: '5',
        DISABLE_BOT: 'true',
      },
      session2: { SESSION_ID: 'second-session', PREFIX: '!' },
    }
  )

  assert.deepEqual(config.SESSION_IDS, ['first-session', 'second-session'])
  assert.deepEqual(config.PREFIXES.slice(0, 2), [['.'], ['!']])
  assert.equal(config.WARN_LIMIT, 5)
  assert.equal(config.BOT_ENABLED, false)
})
