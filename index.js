const fs = require('fs')
const path = require('path')
const pino = require('pino')
const qrcode = require('qrcode-terminal')
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  Browsers,
} = require('@whiskeysockets/baileys')
const config = require('./config')
const db = require('./lib/db')
const handle = require('./lib/handler')
const { loadPlugins } = require('./lib/plugins')
const api = require('./lib/api')
const { run } = require('./lib/shell')

const plugins = loadPlugins()
const startMessageSent = new Set()
const presenceTimers = new Map()

const sessionDirectory = (index) =>
  path.join(__dirname, index === 0 ? 'session' : `session-${index}`)

function restoreSession(index, directory) {
  const creds = path.join(directory, 'creds.json')
  const sessionId = config.SESSION_IDS[index]
  if (!sessionId || fs.existsSync(creds)) return
  try {
    const json = Buffer.from(sessionId, 'base64').toString('utf8')
    JSON.parse(json)
    fs.mkdirSync(directory, { recursive: true })
    fs.writeFileSync(creds, json)
    console.log(`[session ${index}] session restored from environment`)
  } catch {
    console.error(`[session ${index}] session ID is invalid (expected base64 of creds.json)`)
  }
}

async function startSession(index, version) {
  const directory = sessionDirectory(index)
  try {
    restoreSession(index, directory)
    const { state, saveCreds } = await useMultiFileAuthState(directory)

    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: config.BAILEYS_LOG_LVL }),
      browser: Browsers.ubuntu('Chrome'),
      markOnlineOnConnect: config.ALWAYS_ONLINE,
      syncFullHistory: false,
    })

    const pairNumber = config.PAIR_NUMBERS[index]
    if (!sock.authState.creds.registered && pairNumber) {
      setTimeout(async () => {
        try {
          console.log(`[session ${index}] pairing code:`, await sock.requestPairingCode(pairNumber))
        } catch (e) {
          console.error(`[session ${index}] pairing failed:`, e.message)
        }
      }, 3000)
    }

    sock.ev.on('creds.update', saveCreds)
    for (const e of plugins.events) sock.ev.on(e.name, (...a) => e.run(sock, ...a).catch(() => {}))

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr && !pairNumber) {
        console.log(`[session ${index}] scan this QR code to log in`)
        qrcode.generate(qr, { small: true })
      }

      if (connection === 'open') {
        console.log(`${config.BOT_NAME} [session ${index}] connected as ${sock.user.id}`)
        api.setSock(sock, index)
        clearInterval(presenceTimers.get(index))
        if (config.ALWAYS_ONLINE) {
          presenceTimers.set(index, setInterval(() => sock.sendPresenceUpdate('available').catch(() => {}), 30000))
        }
        if (!startMessageSent.has(index) && !config.DISABLE_START_MESSAGE) {
          startMessageSent.add(index)
          await sock
            .sendMessage(jidNormalizedUser(sock.user.id), {
              text: `✅ *${config.BOT_NAME}* connected.\nSession: ${index}\nPrefix: ${config.PREFIX.join(' ')}\nMode: ${db.mode()}\nType ${config.PREFIX[0]}menu to see the commands.`,
            })
            .catch(() => {})
        }
      }

      if (connection === 'close') {
        clearInterval(presenceTimers.get(index))
        presenceTimers.delete(index)
        api.setSock(null, index)
        const code = lastDisconnect?.error?.output?.statusCode
        if (code === DisconnectReason.loggedOut) {
          console.log(`[session ${index}] logged out; clearing credentials and requesting a new login`)
          fs.rmSync(directory, { recursive: true, force: true })
        } else {
          console.log(`[session ${index}] connection closed (${code}), reconnecting...`)
        }
        setTimeout(() => startSession(index, version), 3000)
      }
    })

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return
      for (const m of messages) {
        try {
          await handle(sock, m, plugins, index)
        } catch (e) {
          console.error(`[session ${index}] handler error:`, e)
        }
      }
    })

    sock.ev.on('call', async (calls) => {
      if (!config.REJECT_CALL) return
      for (const c of calls) {
        if (c.status === 'offer') await sock.rejectCall(c.id, c.from).catch(() => {})
      }
    })
  } catch (error) {
    console.error(`[session ${index}] failed to start:`, error)
    setTimeout(() => startSession(index, version), 3000)
  }
}

async function start() {
  const { version } = await fetchLatestBaileysVersion()
  await Promise.all(
    Array.from({ length: config.SESSION_COUNT }, (_, index) => startSession(index, version))
  )
}

async function preflight() {
  if (!config.AUTO_UPDATE) return
  try {
    const out = await run('git', ['pull', '--ff-only'], 60000)
    if (!/Already up to date/i.test(out)) {
      console.log('Updated from git, installing dependencies and restarting...')
      await run('npm', ['install', '--omit=dev'], 300000)
      process.exit(0) // pm2 restarts the bot with the new code
    }
  } catch (e) {
    console.log('Auto update skipped:', e.message)
  }
}

api.start()
preflight()
  .then(start)
  .catch((e) => {
  console.error(e)
  process.exit(1)
})
