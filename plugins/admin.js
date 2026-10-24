const { run } = require('../lib/shell')
const { num, targets } = require('../lib/utils')

const git = (...a) => run('git', a, 60000)

module.exports = {
  commands: [
    {
      cmd: 'update',
      desc: 'Check for updates (add "now" to install)',
      category: 'owner',
      owner: true,
      run: async (ctx) => {
        await git('fetch')
        const branch = (await git('rev-parse', '--abbrev-ref', 'HEAD')).trim()
        const behind = Number((await git('rev-list', '--count', `HEAD..origin/${branch}`)).trim())
        if (!ctx.args.includes('now')) {
          return ctx.reply(behind ? `${behind} update(s) available. Send ${ctx.prefix}update now` : 'Already up to date.')
        }
        await git('pull', '--ff-only')
        await run('npm', ['install', '--omit=dev'], 300000)
        await ctx.reply('Updated. Restarting...')
        setTimeout(() => process.exit(0), 1000) // pm2 restarts the bot
      },
    },
    {
      cmd: 'restart',
      desc: 'Restart the bot (needs pm2)',
      category: 'owner',
      owner: true,
      run: async (ctx) => {
        await ctx.reply('Restarting...')
        setTimeout(() => process.exit(0), 1000)
      },
    },
    {
      cmd: 'join',
      desc: 'Join a group from an invite link',
      category: 'owner',
      owner: true,
      run: async (ctx) => {
        const m = ctx.args.match(/chat\.whatsapp\.com\/([A-Za-z0-9]{10,})/)
        if (!m) return ctx.reply(`Usage: ${ctx.prefix}join <invite link>`)
        await ctx.sock.groupAcceptInvite(m[1])
        await ctx.reply('Joined.')
      },
    },
    {
      cmd: 'leave',
      desc: 'Leave this group',
      category: 'owner',
      owner: true,
      group: true,
      run: async (ctx) => {
        await ctx.reply('Bye!')
        await ctx.sock.groupLeave(ctx.jid)
      },
    },
    ...['block', 'unblock'].map((cmd) => ({
      cmd,
      desc: `${cmd[0].toUpperCase() + cmd.slice(1)} a user (mention/reply/number, or this chat)`,
      category: 'owner',
      owner: true,
      run: async (ctx) => {
        const t = targets(ctx)[0] || (ctx.isGroup ? null : ctx.jid)
        if (!t) return ctx.reply('Mention, reply to, or type a number.')
        await ctx.sock.updateBlockStatus(t, cmd)
        await ctx.reply(`${cmd}ed ${num(t)}`)
      },
    })),
  ],
}
