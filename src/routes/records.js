import { Router } from 'express'
import Record from '../models/Record.js'
import { requireAuth } from '../middleware/auth.js'
import { toRows, buildCsv, buildXlsx } from '../utils/export.js'

const router = Router()
router.use(requireAuth)

// 前端记录字段转 Mongo 文档，提交与批量同步共用。
// 公共字段单独入库；其余扩展统计（averageTime、maxDigit、TRRE 等）自动归档到 moduleData
function toDoc(b, userId) {
  const {
    id, userId: _ignored, childId, childName, childAge, type, typeName,
    totalQuestions, correctCount, incorrectCount, score,
    stoppedEarly, endedBy, details, createdAt, moduleData, ...rest
  } = b
  return {
    userId,
    clientId: String(id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    childId: childId || '',
    childName: childName || '',
    childAge: childAge != null ? String(childAge) : '',
    type,
    typeName: typeName || '',
    totalQuestions: Number(totalQuestions) || 0,
    correctCount: Number(correctCount) || 0,
    incorrectCount: Number(incorrectCount) || 0,
    score: Number(score) || 0,
    stoppedEarly: !!stoppedEarly,
    endedBy: endedBy || 'completed',
    moduleData: { ...(moduleData || {}), ...rest },
    details: details || [],
    clientCreatedAt: Number(createdAt) || Date.now()
  }
}

// 提交单条记录
router.post('/', async (req, res) => {
  try {
    const b = req.body || {}
    if (!b.type) return res.status(400).json({ message: '缺少记录类型' })
    const doc = await Record.create(toDoc(b, req.user.id))
    res.status(201).json({ id: doc._id })
  } catch (e) {
    console.error('[records:create]', e)
    res.status(500).json({ message: '保存记录失败' })
  }
})

// 批量同步本地历史记录：按 clientId 去重，已存在的跳过
router.post('/batch', async (req, res) => {
  try {
    const list = Array.isArray(req.body && req.body.records) ? req.body.records : []
    if (!list.length) return res.json({ inserted: 0, skipped: 0 })
    if (list.length > 500) return res.status(400).json({ message: '单次最多同步 500 条' })

    const clientIds = list.map(r => String(r.id)).filter(Boolean)
    const existing = new Set(
      (await Record.find({ userId: req.user.id, clientId: { $in: clientIds } }).select('clientId').lean())
        .map(d => d.clientId)
    )
    const docs = list.filter(r => r.type && !existing.has(String(r.id))).map(r => toDoc(r, req.user.id))

    let inserted = 0
    if (docs.length) {
      const result = await Record.insertMany(docs, { ordered: false }).catch(err => {
        // 部分重复键报错时仍返回成功插入的部分
        if (err && err.insertedDocs) return err.insertedDocs
        throw err
      })
      inserted = Array.isArray(result) ? result.length : 0
    }
    res.json({ inserted, skipped: list.length - inserted })
  } catch (e) {
    console.error('[records:batch]', e)
    res.status(500).json({ message: '批量同步失败' })
  }
})

// 分页查询当前账号的记录
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20))
    const filter = { userId: req.user.id }
    if (req.query.childId) filter.childId = req.query.childId
    if (req.query.type) filter.type = req.query.type
    const [items, total] = await Promise.all([
      Record.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      Record.countDocuments(filter)
    ])
    res.json({ items, total, page, pageSize })
  } catch (e) {
    console.error('[records:list]', e)
    res.status(500).json({ message: '查询记录失败' })
  }
})

// 导出当前账号全部记录（可按 childId 过滤），支持 csv / xlsx
// 注意：必须定义在 GET /:id 之前，否则 export 会被当作记录 id 匹配
router.get('/export', async (req, res) => {
  try {
    const filter = { userId: req.user.id }
    if (req.query.childId) filter.childId = req.query.childId
    const items = await Record.find(filter).sort({ createdAt: -1 }).lean()
    const rows = toRows(items)
    const format = (req.query.format || 'csv').toLowerCase()
    const filename = `assessment-records-${new Date().toISOString().slice(0, 10)}`

    if (format === 'xlsx') {
      const buf = buildXlsx(rows)
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`)
      return res.send(buf)
    }
    // CSV 加 BOM，保证 Excel 直接打开不乱码
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`)
    res.send(buildCsv(rows))
  } catch (e) {
    console.error('[records:export]', e)
    res.status(500).json({ message: '导出失败' })
  }
})

// 查询单条记录详情
router.get('/:id', async (req, res) => {
  try {
    const doc = await Record.findOne({ _id: req.params.id, userId: req.user.id }).lean()
    if (!doc) return res.status(404).json({ message: '记录不存在' })
    res.json({ item: doc })
  } catch (e) {
    console.error('[records:get]', e)
    res.status(500).json({ message: '查询记录失败' })
  }
})

// 删除一条记录
router.delete('/:id', async (req, res) => {
  try {
    const doc = await Record.findOneAndDelete({ _id: req.params.id, userId: req.user.id })
    if (!doc) return res.status(404).json({ message: '记录不存在' })
    res.json({ ok: true })
  } catch (e) {
    console.error('[records:delete]', e)
    res.status(500).json({ message: '删除记录失败' })
  }
})

export default router
