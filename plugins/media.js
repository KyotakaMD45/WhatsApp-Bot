const fs = require('fs')
const config = require('../config')
const { getMedia } = require('../lib/media')
const { run, tmp } = require('../lib/shell')

const FIT = 'format=rgba,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0'

async function withTmp(inputExt, outputExt, buffer, fn) {
  const inp = tmp(inputExt)
  const out = tmp(outputExt)
  fs.writeFileSync(inp, buffer)
  try {
    await fn(inp, out)
    return fs.readFileSync(out)
  } finally {
    for (const f of [inp, out]) fs.rm(f, { force: true }, () => {})
  }
}

module.exports = {
  commands: [
    {
      cmd: 'sticker',
      alias: ['s'],
      desc: 'Image/video (or reply) to sticker',
      category: 'media',
      run: async (ctx) => {
        const media = await getMedia(ctx, ['imageMessage', 'videoMessage'])
        if (!media) return ctx.reply(`Send or reply to an image/video with ${ctx.prefix}sticker`)
        const video = media.type === 'videoMessage'
        const webp = await withTmp(video ? '.mp4' : '.jpg', '.webp', media.buffer, (inp, out) =>
          run(
            'ffmpeg',
            video
              ? ['-y', '-i', inp, '-t', '8', '-vf', `fps=15,${FIT}`, '-an', '-loop', '0', '-c:v', 'libwebp', '-q:v', '50', out]
              : ['-y', '-i', inp, '-vf', FIT, '-c:v', 'libwebp', '-q:v', '80', out]
          )
        )
        await ctx.sock.sendMessage(ctx.jid, { sticker: webp }, { quoted: ctx.m })
      },
    },
    {
      cmd: 'toimg',
      desc: 'Reply to a sticker to get an image',
      category: 'media',
      run: async (ctx) => {
        const media = await getMedia(ctx, ['stickerMessage'])
        if (!media) return ctx.reply(`Reply to a sticker with ${ctx.prefix}toimg`)
        const png = await withTmp('.webp', '.png', media.buffer, (inp, out) => run('ffmpeg', ['-y', '-i', inp, out]))
        await ctx.sock.sendMessage(ctx.jid, { image: png }, { quoted: ctx.m })
      },
    },
    {
      cmd: 'rmbg',
      desc: 'Remove the background of an image (remove.bg)',
      category: 'media',
      run: async (ctx) => {
        if (!config.RMBG_KEY) return ctx.reply('RMBG_KEY is not set in config.env')
        const media = await getMedia(ctx, ['imageMessage'])
        if (!media) return ctx.reply(`Send or reply to an image with ${ctx.prefix}rmbg`)
        const fd = new FormData()
        fd.append('image_file', new Blob([media.buffer]), 'image.jpg')
        fd.append('size', 'auto')
        const r = await fetch('https://api.remove.bg/v1.0/removebg', {
          method: 'POST',
          headers: { 'X-Api-Key': config.RMBG_KEY },
          body: fd,
        })
        if (!r.ok) throw new Error('remove.bg error ' + r.status)
        await ctx.sock.sendMessage(
          ctx.jid,
          { document: Buffer.from(await r.arrayBuffer()), mimetype: 'image/png', fileName: 'no-background.png' },
          { quoted: ctx.m }
        )
      },
    },
    {
      cmd: 'vv',
      desc: 'Reveal a view-once photo/video/audio (reply)',
      category: 'media',
      owner: true,
      run: async (ctx) => {
        const media = await getMedia(ctx, ['imageMessage', 'videoMessage', 'audioMessage'])
        if (!media) return ctx.reply(`Reply to a view-once message with ${ctx.prefix}vv`)
        const key = media.type.replace('Message', '')
        await ctx.sock.sendMessage(ctx.jid, { [key]: media.buffer, caption: media.info?.caption || undefined }, { quoted: ctx.m })
      },
    },
  ],
}
