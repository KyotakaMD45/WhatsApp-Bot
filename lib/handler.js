const { jidNormalizedUser } = require('@whiskeysockets/baileys')
const config = require('../config')
const db = require('./db')
const { content, getText, num, isAdminOf } = require('./utils')
const api = require('./api')
const { createTranslator } = require('./i18n')

const sessionCaches = new Map()
const t = createTranslator(config.BOT_LANG)

function getCaches(session) {
  const key = String(session)
  if (!sessionCaches.has(key)) {
    sessionCaches.set(key, { messages: new Map(), metadata: new Map() })
  }
  return sessionCaches.get(key)
}

async function getMeta(sock, jid, fresh, metaCache) {
  const c = metaCache.get(jid)
  if (!fresh && c && Date.now() - c.t < 60000) return c.m
  const m = await sock.groupMetadata(jid)
  metaCache.set(jid, { m, t: Date.now() })
  return m
}

module.exports = async function handle(sock, m, plugins, session = 0) {
  if (!m.message || !m.key?.remoteJid) return
  const { messages: cache, metadata: metaCache } = getCaches(session)
  const jid = m.key.remoteJid

  if (jid === 'status@broadcast') {
    if (config.AUTO_STATUS_VIEW) await sock.readMessages([m.key]).catch(() => {})
    return
  }
  if (jid.endsWith('@broadcast') || jid.endsWith('@newsletter')) return
  if (Date.now() / 1000 - Number(m.messageTimestamp || 0) > 60) return // ignore replayed messages

  const meJid = jidNormalizedUser(sock.user.id)
  const isGroup = jid.endsWith('@g.us')
  const rawSender = m.key.fromMe ? meJid : isGroup ? m.key.participant || m.participant : jid
  if (!rawSender) return
  const sender = jidNormalizedUser(rawSender)

  // Anti-delete: forward deleted messages to the bot owner
  const proto = content(m).protocolMessage
  if (proto?.type === 0 && config.ANTI_DELETE) {
    const old = cache.get(proto.key?.id)
    if (old) {
      const who = old.key.participant || old.key.remoteJid
      const txt = getText(old)
      await sock.sendMessage(meJid, {
        text: `🗑 Deleted message from @${num(who)} in ${old.key.remoteJid}${txt ? ':\n' + txt : ''}`,
        mentions: [who],
      })
      if (!txt) await sock.sendMessage(meJid, { forward: old }).catch(() => {})
    }
    return
  }
  if (m.message && !proto) {
    cache.set(m.key.id, m)
    if (cache.size > 500) cache.delete(cache.keys().next().value)
  }

  const ownerNums = new Set([num(meJid), num(sock.user.lid), ...config.SUDO].filter(Boolean))
  const isOwner = !!m.key.fromMe || ownerNums.has(num(sender))
  const text = getText(m)

  if (!m.key.fromMe) {
    api.notify({ id: m.key.id, from: jid, sender, isGroup, text, timestamp: Number(m.messageTimestamp || 0) }, session)
    if (config.SEND_READ) sock.readMessages([m.key]).catch(() => {})
  }
  if (!config.BOT_ENABLED) return

  // AJOIN: owner sends a group invite link in private -> join
  const invite = text.match(/chat\.whatsapp\.com\/([A-Za-z0-9]{10,})/)
  if (config.AJOIN && !isGroup && isOwner && invite) {
    await sock.groupAcceptInvite(invite[1]).catch(() => {})
    return
  }

  const ctx = {
    sock, m, jid, sender, meJid, isGroup, isOwner, text, plugins, args: '', prefix: config.PREFIX[0],
    t,
    reply: (t, mentions = []) => sock.sendMessage(jid, { text: t, mentions }, { quoted: m }),
    meta: (fresh) => getMeta(sock, jid, fresh, metaCache),
  }

  // Hooks (moderation) run on every message, before commands
  if (!m.key.fromMe) {
    for (const hook of plugins.hooks) {
      if (await hook(ctx)) return
    }
  }

  // Commands: the prefix is REQUIRED
  const sessionPrefix = config.PREFIXES[session] || config.PREFIX
  const prefix = sessionPrefix.find((p) => text.startsWith(p))
  if (!prefix) return
  const [name, ...rest] = text.slice(prefix.length).trim().split(/\s+/)
  const cmd = plugins.commands.get((name || '').toLowerCase())
  if (!cmd) return
  if (db.mode() === 'private' && !isOwner) return

  ctx.args = rest.join(' ')
  ctx.prefix = prefix

  try {
    if (cmd.owner && !isOwner) return await ctx.reply(t('error.ownerOnly'))
    if ((cmd.group || cmd.admin || cmd.botAdmin) && !isGroup) return await ctx.reply(t('error.groupsOnly'))
    if (cmd.admin || cmd.botAdmin) {
      const meta = await ctx.meta()
      if (
        cmd.admin &&
        !isOwner &&
        !config.GROUP_ADMINS.includes(num(sender)) &&
        !isAdminOf(meta, sender)
      ) return await ctx.reply(t('error.adminsOnly'))
      if (cmd.botAdmin && !isAdminOf(meta, meJid, sock.user.lid)) return await ctx.reply(t('error.botAdminRequired'))
    }
    await cmd.run(ctx)
    if (config.CMD_REACTION) await sock.sendMessage(jid, { react: { text: '✅', key: m.key } }).catch(() => {})
  } catch (e) {
    console.error(`[${cmd.cmd}]`, e)
    await ctx.reply(t('error.commandFailed', { message: e.message || e })).catch(() => {})
  }
}
