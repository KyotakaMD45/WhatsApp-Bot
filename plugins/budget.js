const db = require('../lib/db')

const store = () => db.kv('budget', { limit: 0, entries: [] })
const parse = (args) => {
  const m = args.trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/)
  return m ? { amount: Number(m[1].replace(',', '.')), note: m[2] || '-' } : null
}
const monthKey = (d) => new Date(d).toISOString().slice(0, 7)

const add = (cmd, type, desc) => ({
  cmd,
  desc,
  category: 'budget',
  owner: true,
  run: async (ctx) => {
    const p = parse(ctx.args)
    if (!p) return ctx.reply(`Usage: ${ctx.prefix}${cmd} 5000 salary`)
    store().entries.push({ type, ...p, date: Date.now() })
    db.save()
    await ctx.reply(`${type === 'income' ? '➕' : '➖'} ${p.amount} (${p.note})`)
  },
})

module.exports = {
  commands: [
    add('income', 'income', 'Record income: income 5000 salary'),
    add('expense', 'expense', 'Record an expense: expense 200 food'),
    {
      cmd: 'budget',
      desc: 'Set your monthly budget: budget 100000',
      category: 'budget',
      owner: true,
      run: async (ctx) => {
        const n = Number(ctx.args.replace(',', '.'))
        if (!n) return ctx.reply(`Usage: ${ctx.prefix}budget 100000\nCurrent: ${store().limit || 'not set'}`)
        store().limit = n
        db.save()
        await ctx.reply('Monthly budget: ' + n)
      },
    },
    {
      cmd: 'delbudget',
      desc: 'Delete all budget data',
      category: 'budget',
      owner: true,
      run: async (ctx) => {
        const b = store()
        b.limit = 0
        b.entries = []
        db.save()
        await ctx.reply('Budget data deleted.')
      },
    },
    {
      cmd: 'summary',
      desc: 'Budget summary for this month',
      category: 'budget',
      owner: true,
      run: async (ctx) => {
        const b = store()
        const now = monthKey(Date.now())
        const es = b.entries.filter((e) => monthKey(e.date) === now)
        const inc = es.filter((e) => e.type === 'income').reduce((a, e) => a + e.amount, 0)
        const exp = es.filter((e) => e.type === 'expense').reduce((a, e) => a + e.amount, 0)
        let t = `*Summary ${now}*\nIncome: ${inc}\nExpenses: ${exp}\nBalance: ${inc - exp}`
        if (b.limit) t += `\nBudget left: ${b.limit - exp} / ${b.limit}`
        await ctx.reply(t)
      },
    },
  ],
}
