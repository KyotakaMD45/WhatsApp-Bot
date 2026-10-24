const db = require('../lib/db')
const config = require('../config')
const { getMedia } = require('../lib/media')
const { getContext, num, targets } = require('../lib/utils')

const counts = () => db.kv('msgs', {})

async function countHook(ctx) {
  if (ctx.isGroup) {
    const g = (counts()[ctx.jid] ??= {})
    g[ctx.sender] = (g[ctx.sender] || 0) + 1
    db.save()
  }
  return false
}

const gcmd = (cmd, desc, o, run) => ({ cmd, desc, category: 'group', group: true, admin: true, ...o, run })

module.exports = {
  hooks: [countHook],
  commands: [
    {
      cmd: 'delete',
      alias: ['dlt'],
      desc: 'Delete the replied message',
      category: 'whatsapp',
      run: async (ctx) => {
        const c = getContext(ctx.m)
        if (!c?.stanzaId) return ctx.reply('Reply to the message to delete.')
        const key = { remoteJid: ctx.jid, id: c.stanzaId, fromMe: num(c.participant) === num(ctx.meJid), participant: c.participant }
        await ctx.sock.sendMessage(ctx.jid, { delete: key })
      },
    },
    {
      cmd: 'react',
      desc: 'React to the replied message: react 🔥',
      category: 'whatsapp',
      run: async (ctx) => {
        const c = getContext(ctx.m)
        if (!c?.stanzaId || !ctx.args) return ctx.reply(`Reply to a message: ${ctx.prefix}react 🔥`)
        await ctx.sock.sendMessage(ctx.jid, { react: { text: ctx.args.trim(), key: { remoteJid: ctx.jid, id: c.stanzaId, participant: c.participant } } })
      },
    },
    {
      cmd: 'poll',
      desc: 'Create a poll: poll Question|option1|option2',
      category: 'whatsapp',
      run: async (ctx) => {
        const [name, ...values] = ctx.args.split('|').map((s) => s.trim()).filter(Boolean)
        if (!name || values.length < 2) return ctx.reply(`Usage: ${ctx.prefix}poll Question|option1|option2`)
        await ctx.sock.sendMessage(ctx.jid, { poll: { name, values, selectableCount: 1 } })
      },
    },
    {
      cmd: 'jid',
      desc: 'Show the JID of a user or this chat',
      category: 'user',
      run: async (ctx) => ctx.reply(targets(ctx)[0] || ctx.jid),
    },
    {
      cmd: 'pp',
      desc: 'Set the bot profile picture (reply to an image)',
      category: 'user',
      owner: true,
      run: async (ctx) => {
        const media = await getMedia(ctx, ['imageMessage'])
        if (!media) return ctx.reply('Reply to an image.')
        await ctx.sock.updateProfilePicture(ctx.meJid, media.buffer)
        await ctx.reply('Profile picture updated.')
      },
    },
    gcmd('gpp', 'Set the group picture (reply to an image)', { botAdmin: true }, async (ctx) => {
      const media = await getMedia(ctx, ['imageMessage'])
      if (!media) return ctx.reply('Reply to an image.')
      await ctx.sock.updateProfilePicture(ctx.jid, media.buffer)
      await ctx.reply('Group picture updated.')
    }),
    gcmd('tag', 'Hidden mention of everyone', {}, async (ctx) => {
      const meta = await ctx.meta(true)
      const q = getContext(ctx.m)?.quotedMessage
      const text = ctx.args || q?.conversation || q?.extendedTextMessage?.text || '📢'
      await ctx.sock.sendMessage(ctx.jid, { text, mentions: meta.participants.map((p) => p.id) })
    }),
    gcmd('ginfo', 'Group information', {}, async (ctx) => {
      const m = await ctx.meta(true)
      const admins = m.participants.filter((p) => p.admin).length
      await ctx.reply(`*${m.subject}*\nMembers: ${m.participants.length} (admins: ${admins})\nCreated: ${new Date(m.creation * 1000).toLocaleDateString('en-GB')}\n\n${m.desc || ''}`)
    }),
    gcmd('revoke', 'Reset the group invite link', { alias: ['reset'], botAdmin: true }, async (ctx) => {
      await ctx.sock.groupRevokeInvite(ctx.jid)
      await ctx.reply('Invite link reset.')
    }),
    gcmd('msgs', 'Top 10 most active members', { admin: false }, async (ctx) => {
      const g = counts()[ctx.jid] || {}
      const top = Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, 10)
      await ctx.reply(top.map(([j, n], i) => `${i + 1}. @${num(j)}: ${n}`).join('\n') || 'No data yet.', top.map(([j]) => j))
    }),
    gcmd('inactive', 'Members with no message since the bot counts', {}, async (ctx) => {
      const g = counts()[ctx.jid] || {}
      const meta = await ctx.meta(true)
      const list = meta.participants.map((p) => p.id).filter((j) => !g[j])
      await ctx.reply(`Inactive (${list.length}):\n` + list.map((j) => '@' + num(j)).join(' '), list)
    }),
    gcmd('antifake', 'Remove joiners whose number does not start with these codes: antifake 225,33 | off', { botAdmin: true }, async (ctx) => {
      const g = db.group(ctx.jid)
      const a = ctx.args.trim().toLowerCase()
      g.antifake = a === 'off' || !a ? [] : a.split(/[,\s]+/).map((x) => x.replace(/\D/g, '')).filter(Boolean)
      db.save()
      await ctx.reply(g.antifake.length ? 'Allowed codes: ' + g.antifake.join(', ') : 'antifake: off')
    }),
    gcmd('pdm', 'Announce promotions/demotions (on/off)', {}, async (ctx) => {
      const g = db.group(ctx.jid)
      g.pdm = ctx.args.trim().toLowerCase() === 'on'
      db.save()
      await ctx.reply('pdm: ' + (g.pdm ? 'on' : 'off'))
    }),
  ],
  events: [
    {
      name: 'group-participants.update',
      run: async (sock, ev) => {
        if (!config.BOT_ENABLED) return
        const g = db.group(ev.id)
        const ids = (ev.participants || []).map((p) => (typeof p === 'string' ? p : p.id || p.phoneNumber)).filter(Boolean)
        if (ev.action === 'add' && g.antifake?.length) {
          const bad = ids.filter((j) => !g.antifake.some((c) => num(j).startsWith(c)))
          if (bad.length) await sock.groupParticipantsUpdate(ev.id, bad, 'remove').catch(() => {})
        }
        if (g.pdm && (ev.action === 'promote' || ev.action === 'demote')) {
          await sock.sendMessage(ev.id, { text: `${ids.map((j) => '@' + num(j)).join(' ')} was ${ev.action}d`, mentions: ids })
        }
      },
    },
  ],
}
