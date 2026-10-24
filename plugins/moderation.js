const config = require('../config')
const db = require('../lib/db')
const { num, isAdminOf, targets } = require('../lib/utils')

const MODES = ['off', 'delete', 'warn', 'kick']
const LINK = /(https?:\/\/|chat\.whatsapp\.com\/|www\.)\S+/i
const spam = new Map()

const fill = (tpl, v) =>
  tpl.replace(/&mention/g, '@' + v.mention).replace(/&warn/g, v.warn).replace(/&remaining/g, v.remaining)

async function addWarn(ctx, user) {
  const n = db.addWarn(ctx.jid, user)
  const v = { mention: num(user), warn: n, remaining: Math.max(config.WARN_LIMIT - n, 0) }
  if (n >= config.WARN_LIMIT) {
    db.resetWarn(ctx.jid, user)
    if (config.WARN_RESET_MESSAGE) {
      await ctx.sock.sendMessage(ctx.jid, {
        text: fill(config.WARN_RESET_MESSAGE, v),
        mentions: [user],
      })
    }
    await ctx.sock.groupParticipantsUpdate(ctx.jid, [user], 'remove').catch(() => {})
    return ctx.sock.sendMessage(ctx.jid, { text: fill(config.WARN_KICK_MESSAGE, v), mentions: [user] })
  }
  return ctx.sock.sendMessage(ctx.jid, { text: fill(config.WARN_MESSAGE, v), mentions: [user] })
}

// Delete the offending message, then apply the configured action
async function punish(ctx, mode, tpl) {
  const meta = await ctx.meta()
  if (!isAdminOf(meta, ctx.meJid, ctx.sock.user.lid)) return false // bot cannot act without admin rights
  await ctx.sock.sendMessage(ctx.jid, { delete: ctx.m.key }).catch(() => {})
  if (mode === 'warn') await addWarn(ctx, ctx.sender)
  if (mode === 'kick') {
    await ctx.sock.groupParticipantsUpdate(ctx.jid, [ctx.sender], 'remove').catch(() => {})
    await ctx.sock.sendMessage(ctx.jid, { text: fill(tpl, { mention: num(ctx.sender), warn: 0, remaining: 0 }), mentions: [ctx.sender] })
  }
  return true
}

async function guard(ctx) {
  if (!ctx.isGroup || ctx.isOwner) return false
  const g = db.group(ctx.jid)
  if (MODES.slice(1).every((m) => ![g.antilink, g.antispam, g.antiword, g.antibot].includes(m))) return false
  const meta = await ctx.meta()
  if (config.GROUP_ADMINS.includes(num(ctx.sender)) || isAdminOf(meta, ctx.sender)) return false

  const text = ctx.text
  if (g.antibot !== 'off' && /^BAE5/.test(ctx.m.key.id || '')) return punish(ctx, g.antibot, config.ANTI_BOT_MESSAGE)
  if (g.antilink !== 'off' && LINK.test(text)) return punish(ctx, g.antilink, config.ANTILINK_MSG)
  if (g.antiword !== 'off' && (g.words.length || config.ANTIWORDS.length)) {
    const t = text.toLowerCase()
    if ([...g.words, ...config.ANTIWORDS].some((w) => t.includes(w))) {
      return punish(ctx, g.antiword, config.ANTIWORDS_MSG)
    }
  }
  if (g.antispam !== 'off') {
    const k = ctx.jid + ctx.sender
    const now = Date.now()
    const arr = (spam.get(k) || []).filter((t) => now - t < 8000)
    arr.push(now)
    spam.set(k, arr)
    if (arr.length > 5) {
      spam.delete(k)
      return punish(ctx, g.antispam, config.ANTISPAM_MSG)
    }
  }
  return false
}

const toggle = (feature, desc) => ({
  cmd: feature,
  desc: `${desc} (off/delete/warn/kick)`,
  category: 'moderation',
  group: true,
  admin: true,
  run: async (ctx) => {
    const v = ctx.args.trim().toLowerCase()
    const g = db.group(ctx.jid)
    if (!MODES.includes(v)) return ctx.reply(`Usage: ${ctx.prefix}${feature} off|delete|warn|kick\nCurrent: ${g[feature]}`)
    g[feature] = v
    db.save()
    await ctx.reply(`${feature}: ${v}`)
  },
})

module.exports = {
  hooks: [guard],
  commands: [
    toggle('antilink', 'Block links'),
    toggle('antispam', 'Block message flooding'),
    toggle('antiword', 'Block forbidden words'),
    toggle('antibot', 'Block other bots (heuristic)'),
    {
      cmd: 'addword',
      desc: 'Add a forbidden word',
      category: 'moderation',
      group: true,
      admin: true,
      run: async (ctx) => {
        const w = ctx.args.trim().toLowerCase()
        if (!w) return ctx.reply(`Usage: ${ctx.prefix}addword <word>`)
        const g = db.group(ctx.jid)
        if (!g.words.includes(w)) g.words.push(w)
        db.save()
        await ctx.reply(`Words: ${g.words.join(', ')}`)
      },
    },
    {
      cmd: 'delword',
      desc: 'Remove a forbidden word',
      category: 'moderation',
      group: true,
      admin: true,
      run: async (ctx) => {
        const g = db.group(ctx.jid)
        g.words = g.words.filter((w) => w !== ctx.args.trim().toLowerCase())
        db.save()
        await ctx.reply(`Words: ${g.words.join(', ') || '(none)'}`)
      },
    },
    {
      cmd: 'warn',
      desc: 'Warn a member (mention or reply)',
      category: 'moderation',
      group: true,
      admin: true,
      botAdmin: true,
      run: async (ctx) => {
        const t = targets(ctx)
        if (!t.length) return ctx.reply('Mention or reply to the member to warn.')
        await addWarn(ctx, t[0])
      },
    },
    {
      cmd: 'warns',
      desc: 'Show warns of a member',
      category: 'moderation',
      group: true,
      run: async (ctx) => {
        const t = targets(ctx)[0] || ctx.sender
        await ctx.reply(`@${num(t)}: ${db.getWarn(ctx.jid, t)}/${config.WARN_LIMIT}`, [t])
      },
    },
    {
      cmd: 'resetwarn',
      desc: 'Reset warns of a member',
      category: 'moderation',
      group: true,
      admin: true,
      run: async (ctx) => {
        const t = targets(ctx)[0]
        if (!t) return ctx.reply('Mention or reply to the member.')
        db.resetWarn(ctx.jid, t)
        await ctx.reply('Warns reset.')
      },
    },
  ],
}
