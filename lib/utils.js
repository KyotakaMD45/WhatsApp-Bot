const unwrap = (msg) =>
  msg?.ephemeralMessage?.message ||
  msg?.viewOnceMessage?.message ||
  msg?.viewOnceMessageV2?.message ||
  msg?.documentWithCaptionMessage?.message ||
  msg

function content(m) {
  let x = m.message
  for (let i = 0; i < 3; i++) {
    const u = unwrap(x)
    if (u === x) break
    x = u
  }
  return x || {}
}

const getText = (m) => {
  const c = content(m)
  return (
    c.conversation || c.extendedTextMessage?.text || c.imageMessage?.caption || c.videoMessage?.caption || ''
  ).trim()
}

const getContext = (m) =>
  Object.values(content(m))
    .map((v) => v?.contextInfo)
    .find(Boolean)

const quotedText = (m) => {
  const q = getContext(m)?.quotedMessage
  return q?.conversation || q?.extendedTextMessage?.text || ''
}

const num = (jid) => String(jid || '').split('@')[0].split(':')[0]

const isAdminOf = (meta, jid, lid) => {
  const ids = [num(jid), num(lid)].filter(Boolean)
  return meta.participants.some(
    (p) => p.admin && [p.id, p.jid, p.phoneNumber, p.lid].some((x) => x && ids.includes(num(x)))
  )
}

// mentioned users, else replied-to user, else numbers typed in the arguments
const targets = (ctx) => {
  const c = getContext(ctx.m)
  const set = new Set(c?.mentionedJid || [])
  if (!set.size && c?.quotedMessage && c.participant) set.add(c.participant)
  if (!set.size) {
    ctx.args.split(/\s+/).forEach((a) => {
      const d = a.replace(/\D/g, '')
      if (d.length >= 7) set.add(d + '@s.whatsapp.net')
    })
  }
  return [...set]
}

module.exports = { content, getText, getContext, quotedText, num, isAdminOf, targets }
