const config = require('../config')
const db = require('../lib/db')
const { num } = require('../lib/utils')

const flag = (cmd, desc) => ({
  cmd,
  desc: `${desc} (on/off)`,
  category: 'group',
  group: true,
  admin: true,
  run: async (ctx) => {
    const v = ctx.args.trim().toLowerCase()
    if (!['on', 'off'].includes(v)) return ctx.reply(`Usage: ${ctx.prefix}${cmd} on|off`)
    db.group(ctx.jid)[cmd] = v === 'on'
    db.save()
    await ctx.reply(`${cmd}: ${v}`)
  },
})

module.exports = {
  commands: [flag('welcome', 'Greet new members'), flag('goodbye', 'Say goodbye to leavers')],
  events: [
    {
      name: 'group-participants.update',
      run: async (sock, ev) => {
        if (!config.BOT_ENABLED) return
        const g = db.group(ev.id)
        const ids = (ev.participants || []).map((p) => (typeof p === 'string' ? p : p.id || p.phoneNumber)).filter(Boolean)
        if (ev.action === 'add' && g.welcome) {
          const meta = await sock.groupMetadata(ev.id).catch(() => null)
          await sock.sendMessage(ev.id, {
            text: `Welcome ${ids.map((j) => '@' + num(j)).join(' ')} to *${meta?.subject || 'the group'}* 👋`,
            mentions: ids,
          })
        }
        if (ev.action === 'remove' && g.goodbye) {
          await sock.sendMessage(ev.id, { text: `Goodbye ${ids.map((j) => '@' + num(j)).join(' ')} 👋`, mentions: ids })
        }
      },
    },
    {
      name: 'group.join-request',
      run: async (sock, ev) => {
        if (!config.APPROVE || ev.action !== 'created') return
        await sock.groupRequestParticipantsUpdate(ev.id, [ev.participant], 'approve').catch(() => {})
      },
    },
  ],
}
