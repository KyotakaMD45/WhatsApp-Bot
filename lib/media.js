const pino = require('pino')
const { downloadMediaMessage } = require('@whiskeysockets/baileys')
const { content, getContext } = require('./utils')

// Finds media in the message itself or in the replied-to message.
async function getMedia(ctx, kinds) {
  const quoted = getContext(ctx.m)?.quotedMessage
  for (const msg of [content(ctx.m), quoted]) {
    if (!msg) continue
    const c = msg.viewOnceMessage?.message || msg.viewOnceMessageV2?.message || msg.viewOnceMessageV2Extension?.message || msg
    const type = Object.keys(c).find((k) => kinds.includes(k))
    if (!type) continue
    const buffer = await downloadMediaMessage({ key: ctx.m.key, message: c }, 'buffer', {}, {
      logger: pino({ level: 'silent' }),
      reuploadRequest: ctx.sock.updateMediaMessage,
    })
    return { buffer, type, info: c[type] }
  }
  return null
}

module.exports = { getMedia }
