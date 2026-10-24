const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: path.join(__dirname, 'config.env') })

const jsonPath = path.join(__dirname, 'config.json')
let jsonConfig = {}
if (fs.existsSync(jsonPath)) {
  try {
    jsonConfig = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    if (!jsonConfig || typeof jsonConfig !== 'object' || Array.isArray(jsonConfig)) {
      throw new Error('expected a JSON object')
    }
  } catch (error) {
    throw new Error(`Unable to read config.json: ${error.message}`)
  }
}
const legacySessions = ['session1', 'session2', 'session3']
  .map((key) => jsonConfig[key] || {})
const legacy = legacySessions[0]
const legacyValue = (key) => {
  const value = legacy[key] ?? (key === 'YT_COOKIE' ? legacy.BING_COOKIE : undefined)
  return value === null || String(value).toLowerCase() === 'null' ? undefined : value
}
const env = (k, d = '') => {
  const value = process.env[k]
  const selected = value === undefined || value === '' ? legacyValue(k) : value
  return selected === undefined || selected === '' ? d : String(selected).trim()
}
const bool = (k, d = false) => env(k, String(d)).toLowerCase() === 'true'
const digits = (s) => String(s).replace(/\D/g, '')
const normalizePrefix = (value) => String(value).replace(/[\^\[\]]/g, '').split('').filter(Boolean)
const indexedList = (value, normalize) => {
  if (!value) return []
  const values = value.split(',').map((item) => normalize(item.trim()))
  while (values.length && !values[values.length - 1]) values.pop()
  return values
}
const sessionIds = indexedList(env('SESSION_IDS'), (id) => id)
const pairNumbers = indexedList(env('PAIR_NUMBERS'), digits)
const legacySessionIds = legacySessions.map((session) => session.SESSION_ID || '')
while (legacySessionIds.length && !legacySessionIds[legacySessionIds.length - 1]) legacySessionIds.pop()
const SESSION_IDS = sessionIds.length
  ? sessionIds
  : legacySessionIds.length
    ? legacySessionIds
    : env('SESSION_ID')
      ? [env('SESSION_ID')]
      : []
const PAIR_NUMBERS = pairNumbers.length ? pairNumbers : digits(env('PAIR_NUMBER')) ? [digits(env('PAIR_NUMBER'))] : []
const SESSION_COUNT = Math.max(SESSION_IDS.length, PAIR_NUMBERS.length, 1)
const BOT_LANG = env('BOT_LANG', 'en').toLowerCase()
const SUPPORTED_LANGUAGES = new Set(['en', 'fr'])
const PREFIX = normalizePrefix(env('PREFIX', '.'))
const PREFIXES = legacySessions.map((session) => {
  const value = session.PREFIX
  if (process.env.PREFIX !== undefined || value === undefined || value === null || String(value).toLowerCase() === 'null') {
    return PREFIX
  }
  return normalizePrefix(value)
})

if (!SUPPORTED_LANGUAGES.has(BOT_LANG)) {
  throw new Error(`Unsupported BOT_LANG "${BOT_LANG}". Supported languages: ${[...SUPPORTED_LANGUAGES].join(', ')}`)
}

module.exports = {
  BOT_NAME: env('BOT_NAME', 'MyBot'),
  SESSION_COUNT,
  SESSION_IDS,
  PAIR_NUMBERS,
  BOT_LANG,
  SESSION_ID: env('SESSION_ID'),
  PAIR_NUMBER: digits(env('PAIR_NUMBER')),
  // accepts "." or ".!," or the old regex style "^[.,!]"
  PREFIX,
  PREFIXES,
  MODE: env('MODE', 'private').toLowerCase() === 'public' ? 'public' : 'private',
  SUDO: env('SUDO').split(',').map(digits).filter(Boolean),
  GROUP_ADMINS: env('GROUP_ADMINS').split(',').map(digits).filter(Boolean),

  WARN_LIMIT: Number(env('WARN_LIMIT', '3')) || 3,
  ANTILINK_MSG: env('ANTILINK_MSG', '_Antilink detected &mention kicked_'),
  ANTISPAM_MSG: env('ANTISPAM_MSG', '_Antispam detected &mention kicked_'),
  ANTIWORDS_MSG: env('ANTIWORDS_MSG', '_Forbidden word detected &mention kicked_'),
  ANTIWORDS: env('ANTIWORDS').split(',').map((word) => word.trim().toLowerCase()).filter(Boolean),
  ANTI_BOT_MESSAGE: env('ANTI_BOT_MESSAGE', '&mention removed'),
  WARN_MESSAGE: env(
    'WARN_MESSAGE',
    '⚠️ WARNING ⚠️\n*User:* &mention\n*Warn:* &warn\n*Remaining:* &remaining'
  ),
  WARN_RESET_MESSAGE: env('WARN_RESET_MESSAGE', ''),
  WARN_KICK_MESSAGE: env('WARN_KICK_MESSAGE', '&mention kicked (warn limit reached)'),

  ALWAYS_ONLINE: bool('ALWAYS_ONLINE'),
  AUTO_STATUS_VIEW: bool('AUTO_STATUS_VIEW'),
  REJECT_CALL: bool('REJECT_CALL'),
  ANTI_DELETE: bool('ANTI_DELETE'),
  CMD_REACTION: bool('CMD_REACTION', true),
  DISABLE_START_MESSAGE: bool('DISABLE_START_MESSAGE'),

  GEMINI_API_KEY: env('GEMINI_API_KEY'),
  GEMINI_MODEL: env('GEMINI_MODEL', 'gemini-2.5-flash'),
  GROQ_API_KEY: env('GROQ_API_KEY'),
  GROQ_MODEL: env('GROQ_MODEL', 'llama-3.3-70b-versatile'),
  OPENROUTER_API_KEY: env('OPENROUTER_API_KEY'),
  OPENROUTER_MODEL: env('OPENROUTER_MODEL', 'openai/gpt-oss-20b:free'),

  SEND_READ: bool('SEND_READ'),
  AJOIN: bool('AJOIN'),
  APPROVE: bool('APPROVE'),
  AUTO_UPDATE: bool('AUTO_UPDATE'),
  RMBG_KEY: env('RMBG_KEY'),
  YT_COOKIE: env('YT_COOKIE', env('BING_COOKIE')),
  MAX_UPLOAD: Number(env('MAX_UPLOAD', '100')) || 100,
  BRAINSHOP: env('BRAINSHOP'), // "bid,key"

  // API_MODE: false/bot = bot only, true/both = bot + API, only/api = API only
  ...(() => {
    const m = env('API_MODE', 'false').toLowerCase()
    const mode = m === 'true' || m === 'both' ? 'both' : m === 'only' || m === 'api' ? 'api' : 'bot'
    return { API_ENABLED: mode !== 'bot', BOT_ENABLED: mode !== 'api' && !bool('DISABLE_BOT') }
  })(),
  PORT: Number(env('PORT', '3000')) || 3000,
  API_KEY: env('API_KEY'),
  API_WEBHOOK_URL: env('API_WEBHOOK_URL'),

  BAILEYS_LOG_LVL: env('BAILEYS_LOG_LVL', 'silent'),
}
