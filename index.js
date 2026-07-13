import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

// Allow the frontend (hosted anywhere) to call this API with no login/auth,
// matching the friction-free approach used on the main jkh-dental-suite.
app.use('*', cors())

app.get('/', (c) => c.text('JKH Pensioner Billing API is running.'))

app.get('/api/health', (c) => c.json({ ok: true }))

// List all bills (summary only) - used for the Register view
app.get('/api/bills', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT bill_no as no, bill_date as date, patient_name as name, total FROM bills ORDER BY bill_no DESC'
  ).all()
  return c.json(results)
})

// Full backup export (all fields, all bills)
app.get('/api/bills/export-all', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM bills ORDER BY bill_no DESC').all()
  const bills = results.map((row) => ({
    no: row.bill_no,
    date: row.bill_date,
    name: row.patient_name,
    age: row.age,
    sex: row.sex,
    phone: row.phone,
    lines: JSON.parse(row.lines || '[]'),
    total: row.total,
  }))
  const counterRow = await c.env.DB.prepare("SELECT value FROM counters WHERE name='bill_counter'").first()
  return c.json({ bills, billCounter: counterRow ? counterRow.value : 0 })
})

// Bulk import (used by the BACKUP JSON -> import flow)
app.post('/api/bills/import-all', async (c) => {
  const body = await c.req.json()
  const bills = body.bills || []
  for (const b of bills) {
    if (!b.no) continue
    await c.env.DB.prepare(
      `INSERT INTO bills (bill_no, bill_date, patient_name, age, sex, phone, lines, total, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(bill_no) DO UPDATE SET
         bill_date=excluded.bill_date, patient_name=excluded.patient_name, age=excluded.age,
         sex=excluded.sex, phone=excluded.phone, lines=excluded.lines, total=excluded.total,
         updated_at=datetime('now')`
    )
      .bind(
        b.no,
        b.date || '',
        b.name || '',
        b.age || '',
        b.sex || '',
        b.phone || '',
        JSON.stringify(b.lines || []),
        parseFloat(b.total) || 0
      )
      .run()
  }
  return c.json({ ok: true, imported: bills.length })
})

// Get one full bill
app.get('/api/bills/:no', async (c) => {
  const no = c.req.param('no')
  const row = await c.env.DB.prepare('SELECT * FROM bills WHERE bill_no = ?').bind(no).first()
  if (!row) return c.json({ error: 'not found' }, 404)
  return c.json({
    no: row.bill_no,
    date: row.bill_date,
    name: row.patient_name,
    age: row.age,
    sex: row.sex,
    phone: row.phone,
    lines: JSON.parse(row.lines || '[]'),
    total: row.total,
  })
})

// Atomically get the next bill number (prefix = YYMM, e.g. 26070001)
app.post('/api/next-bill-no', async (c) => {
  const prefix = new Date().toISOString().slice(2, 7).replace('-', '')
  const result = await c.env.DB.prepare(
    "UPDATE counters SET value = value + 1 WHERE name='bill_counter' RETURNING value"
  ).first()
  const num = result.value
  const billNo = prefix + String(num).padStart(4, '0')
  return c.json({ billNo })
})

// Create or update a bill
app.post('/api/bills', async (c) => {
  const b = await c.req.json()
  if (!b.no) return c.json({ error: 'bill no required' }, 400)
  await c.env.DB.prepare(
    `INSERT INTO bills (bill_no, bill_date, patient_name, age, sex, phone, lines, total, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(bill_no) DO UPDATE SET
       bill_date=excluded.bill_date, patient_name=excluded.patient_name, age=excluded.age,
       sex=excluded.sex, phone=excluded.phone, lines=excluded.lines, total=excluded.total,
       updated_at=datetime('now')`
  )
    .bind(
      b.no,
      b.date || '',
      b.name || '',
      b.age || '',
      b.sex || '',
      b.phone || '',
      JSON.stringify(b.lines || []),
      parseFloat(b.total) || 0
    )
    .run()
  return c.json({ ok: true })
})

// Delete a bill
app.delete('/api/bills/:no', async (c) => {
  const no = c.req.param('no')
  await c.env.DB.prepare('DELETE FROM bills WHERE bill_no = ?').bind(no).run()
  return c.json({ ok: true })
})

export default app
