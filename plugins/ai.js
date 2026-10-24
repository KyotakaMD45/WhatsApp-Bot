const config = require('../config')
const { quotedText } = require('../lib/utils')

async function postJson(url, headers, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error?.message || 'HTTP ' + r.status)
  return j
}

async function gemini(q) {
  if (!config.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set')
  const j = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.GEMINI_MODEL}:generateContent`,
    { 'x-goog-api-key': config.GEMINI_API_KEY },
    { contents: [{ parts: [{ text: q }] }] }
  )
  return j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || 'No answer.'
}

const openaiLike = (url, key, model, name) => async (q) => {
  if (!key) throw new Error(`${name} API key is not set`)
  const j = await postJson(url, { Authorization: 'Bearer ' + key }, { model, messages: [{ role: 'user', content: q }] })
  return j.choices?.[0]?.message?.content || 'No answer.'
}

const providers = {
  gemini,
  groq: openaiLike('https://api.groq.com/openai/v1/chat/completions', config.GROQ_API_KEY, config.GROQ_MODEL, 'GROQ'),
  openrouter: openaiLike('https://openrouter.ai/api/v1/chat/completions', config.OPENROUTER_API_KEY, config.OPENROUTER_MODEL, 'OPENROUTER'),
}

const ask = (cmd, fn, desc) => ({
  cmd,
  desc,
  category: 'ai',
  run: async (ctx) => {
    const q = ctx.args || quotedText(ctx.m)
    if (!q) return ctx.reply(`Usage: ${ctx.prefix}${cmd} <question>`)
    await ctx.reply(await fn(q))
  },
})

const firstConfigured = () =>
  config.GEMINI_API_KEY ? providers.gemini : config.GROQ_API_KEY ? providers.groq : providers.openrouter

module.exports = {
  commands: [
    ask('ai', (q) => firstConfigured()(q), 'Ask the first configured AI'),
    ask('gemini', providers.gemini, 'Ask Gemini'),
    ask('groq', providers.groq, 'Ask Groq'),
    ask('openrouter', providers.openrouter, 'Ask OpenRouter'),
  ],
}
