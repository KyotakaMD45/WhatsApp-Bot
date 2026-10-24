const { num, targets } = require('../lib/utils')

const mentionList = (jids) => jids.map((j) => '@' + num(j)).join(' ')

const change = (cmd, action, desc, done) => ({
  cmd,
  desc,
  category: 'group',
  group: true,
  admin: true,
  botAdmin: true,
  run: async (ctx) => {
    const t = targets(ctx).filter((j) => num(j) !== num(ctx.meJid))
    if (!t.length) return ctx.reply('Mention, reply to, or type the number of the member.')
    await ctx.sock.groupParticipantsUpdate(ctx.jid, t, action)
    await ctx.meta(true)
    await ctx.reply(`${done} ${mentionList(t)}`, t)
  },
})

module.exports = {
  commands: [
    change('kick', 'remove', 'Remove a member', 'Removed'),
    change('promote', 'promote', 'Make a member admin', 'Promoted'),
    change('demote', 'demote', 'Remove admin rights', 'Demoted'),
    {
      cmd: 'add',
      desc: 'Add a number to the group',
      category: 'group',
      group: true,
      admin: true,
      botAdmin: true,
      run: async (ctx) => {
        const jids = ctx.args.split(/\s+/).map((a) => a.replace(/\D/g, '')).filter((d) => d.length >= 7).map((d) => d + '@s.whatsapp.net')
        if (!jids.length) return ctx.reply(`Usage: ${ctx.prefix}add 22507000000`)
        const res = await ctx.sock.groupParticipantsUpdate(ctx.jid, jids, 'add')
        await ctx.reply(res.map((r) => `${num(r.jid || r.content?.attrs?.jid)}: ${r.status === '200' ? 'added' : 'failed (' + r.status + ')'}`).join('\n'))
      },
    },
    {
      cmd: 'tagall',
      desc: 'Mention every member',
      category: 'group',
      group: true,
      admin: true,
      run: async (ctx) => {
        const meta = await ctx.meta(true)
        const ids = meta.participants.map((p) => p.id)
        await ctx.sock.sendMessage(ctx.jid, { text: `${ctx.args || 'Attention everyone'}\n\n${mentionList(ids)}`, mentions: ids })
      },
    },
    {
      cmd: 'mute',
      desc: 'Only admins can send messages',
      category: 'group',
      group: true,
      admin: true,
      botAdmin: true,
      run: async (ctx) => {
        await ctx.sock.groupSettingUpdate(ctx.jid, 'announcement')
        await ctx.reply('Group muted.')
      },
    },
    {
      cmd: 'unmute',
      desc: 'Everyone can send messages',
      category: 'group',
      group: true,
      admin: true,
      botAdmin: true,
      run: async (ctx) => {
        await ctx.sock.groupSettingUpdate(ctx.jid, 'not_announcement')
        await ctx.reply('Group unmuted.')
      },
    },
    {
      cmd: 'link',
      desc: 'Get the group invite link',
      category: 'group',
      group: true,
      admin: true,
      botAdmin: true,
      run: async (ctx) => ctx.reply('https://chat.whatsapp.com/' + (await ctx.sock.groupInviteCode(ctx.jid))),
    },
  ],
}
