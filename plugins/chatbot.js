const config = require('../config')
const { quotedText, num } = require('../lib/utils')

module.exports = {
  commands: [
    {
      cmd: 'bot',
      alias: ['chat'],
      desc: 'Chat with Brainshop',
      category: 'ai',
      run: async (ctx) => {
        const [bid, key] = config.BRAINSHOP.split(',').map((s) => s.trim())
        if (!bid || !key) return ctx.reply('BRAINSHOP ("bid,key") is not set in config.env')
        const q = ctx.args || quotedText(ctx.m)
        if (!q) return ctx.reply(`Usage: ${ctx.prefix}bot <message>`)
        const url = `http://api.brainshop.ai/get?bid=${bid}&key=${key}&uid=${num(ctx.sender)}&msg=${encodeURIComponent(q)}`
        const j = await (await fetch(url)).json()
        await ctx.reply(j.cnt || 'No answer.')
      },
    },
  ],
}
