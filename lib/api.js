const http = require('http')
const crypto = require('crypto')
const config = require('../config')

const sockets = new Map()
const setSock = (sock, session = 0) => {
  const key = String(session)
  if (sock) sockets.set(key, sock)
  else sockets.delete(key)
}
const toJid = (to) => (String(to).includes('@') ? String(to) : String(to).replace(/\D/g, '') + '@s.whatsapp.net')

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let b = ''
    let tooLarge = false
    req.on('data', (c) => {
      if (tooLarge) return
      b += c
      if (Buffer.byteLength(b) > 1e6) tooLarge = true
    })
    req.on('end', () => {
      if (tooLarge) {
        const error = new Error('body too large')
        error.statusCode = 413
        reject(error)
        return
      }
      try {
        const body = b ? JSON.parse(b) : {}
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          const error = new Error('request body must be a JSON object')
          error.statusCode = 400
          reject(error)
          return
        }
        resolve(body)
      } catch (e) {
        const error = new Error('invalid JSON')
        error.statusCode = 400
        reject(error)
      }
    })
  })

async function send(body) {
  const session = String(body.session ?? '0')
  if (!/^\d+$/.test(session) || Number(session) >= config.SESSION_COUNT) {
    const error = new Error('session must be a configured session index')
    error.statusCode = 400
    throw error
  }
  const sock = sockets.get(session)
  if (!sock) {
    const error = new Error('bot is not connected')
    error.statusCode = 503
    throw error
  }
  if (typeof body.to !== 'string' || !body.to.trim()) {
    const error = new Error('"to" is required')
    error.statusCode = 400
    throw error
  }
  const jid = toJid(body.to)
  const type = body.type || 'text'
  let content
  if (type === 'text') content = { text: body.text || '' }
  else if (['image', 'video', 'audio', 'document'].includes(type)) {
    if (!body.url) throw new Error('"url" is required')
    content = { [type]: { url: body.url } }
    if (body.text && type !== 'audio') content.caption = body.text
    if (type === 'audio') content.mimetype = 'audio/mpeg'
    if (type === 'document') {
      content.mimetype = body.mimetype || 'application/octet-stream'
      content.fileName = body.fileName || 'file'
    }
  } else throw new Error('unsupported type')
  const opts = body.quoted
    ? { quoted: { key: { remoteJid: jid, id: body.quoted, fromMe: false }, message: { conversation: '' } } }
    : {}
  return (await sock.sendMessage(jid, content, opts)).key.id
}

const sameKey = (a, b) => {
  const x = Buffer.from(String(a))
  const y = Buffer.from(String(b))
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

function start() {
  if (!config.API_ENABLED) return
  if (!config.API_KEY) return console.log('API_MODE is on but API_KEY is empty: API not started')
  http
    .createServer(async (req, res) => {
      const json = (code, obj) => {
        res.writeHead(code, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(obj))
      }
      if (!sameKey(req.headers['x-api-key'] || '', config.API_KEY)) return json(401, { status: 401, error: 'invalid api key' })
      try {
        if (req.method === 'GET' && req.url === '/api/status') {
          const sessions = Array.from({ length: config.SESSION_COUNT }, (_, index) => ({
            session: String(index),
            connected: sockets.has(String(index)),
          }))
          return json(200, { status: 200, connected: sessions.some((session) => session.connected), sessions })
        }
        if (req.method === 'GET' && req.url === '/api/sessions') {
          return json(200, {
            status: 200,
            sessions: Array.from({ length: config.SESSION_COUNT }, (_, index) => ({
              session: String(index),
              connected: sockets.has(String(index)),
            })),
          })
        }
        if (req.method === 'POST' && req.url === '/api/send') {
          return json(200, { status: 200, id: await send(await readBody(req)) })
        }
        json(404, { status: 404, error: 'not found' })
      } catch (e) {
        const status = e.statusCode || 500
        json(status, { status, error: e.message })
      }
    })
    .listen(config.PORT, () => console.log('API listening on port ' + config.PORT))
}

// Incoming messages are forwarded to API_WEBHOOK_URL
function notify(payload, session = 0) {
  if (!config.API_ENABLED || !config.API_WEBHOOK_URL) return
  fetch(config.API_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': config.API_KEY },
    body: JSON.stringify({ ...payload, session: String(session) }),
  }).catch(() => {})
}

module.exports = { start, setSock, notify }
