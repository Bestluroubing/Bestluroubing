import { Router } from 'express'
import User from '../models/User.js'
import Record from '../models/Record.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'
import { toRows, buildCsv, buildXlsx } from '../utils/export.js'

const router = Router()
router.use(requireAuth, requireAdmin)

// 统计概览：账号总数、记录总数、各模块分布、儿童总数
router.get('/stats', async (req, res) => {
  try {
    const [userCount, recordCount, recordsByType, childCount] = await Promise.all([
      User.countDocuments(),
      Record.countDocuments(),
      Record.aggregate([
        { $group: { _id: '$typeName', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      User.aggregate([
        { $unwind: { path: '$children', preserveNullAndEmptyArrays: false } },
        { $count: 'total' }
      ]).then(arr => arr[0]?.total || 0)
    ])
    res.json({
      userCount,
      recordCount,
      childCount,
      recordsByType: recordsByType.map(r => ({ typeName: r._id, count: r.count }))
    })
  } catch (e) {
    console.error('[admin/stats]', e)
    res.status(500).json({ message: '统计失败' })
  }
})

// 账号列表：分页 + 用户名模糊搜索
router.get('/users', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20))
    const filter = {}
    if (req.query.keyword) {
      const re = new RegExp(String(req.query.keyword).trim(), 'i')
      filter.$or = [{ username: re }, { nickname: re }]
    }
    const [items, total] = await Promise.all([
      User.find(filter)
        .select('username nickname isAdmin children createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize).limit(pageSize).lean(),
      User.countDocuments(filter)
    ])
    res.json({ items, total, page, pageSize })
  } catch (e) {
    console.error('[admin/users]', e)
    res.status(500).json({ message: '查询账号失败' })
  }
})

// 全量记录列表：可按 userId / childId / typeName / 日期筛选
router.get('/records', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20))
    const filter = {}
    if (req.query.userId) filter.userId = req.query.userId
    if (req.query.typeName) filter.typeName = req.query.typeName
    if (req.query.childName) filter.childName = { $regex: String(req.query.childName).trim(), $options: 'i' }
    if (req.query.from) filter.clientCreatedAt = { $gte: parseInt(req.query.from) }
    if (req.query.to) {
      filter.clientCreatedAt = filter.clientCreatedAt || {}
      filter.clientCreatedAt.$lte = parseInt(req.query.to)
    }
    const [items, total] = await Promise.all([
      Record.find(filter).sort({ clientCreatedAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      Record.countDocuments(filter)
    ])
    // 附带账号用户名，方便管理端展示
    const userIds = [...new Set(items.map(r => String(r.userId)))].filter(Boolean)
    const userMap = userIds.length
      ? Object.fromEntries((await User.find({ _id: { $in: userIds } }).select('username').lean()).map(u => [String(u._id), u.username]))
      : {}
    res.json({
      items: items.map(r => ({ ...r, username: userMap[String(r.userId)] || '' })),
      total, page, pageSize
    })
  } catch (e) {
    console.error('[admin/records]', e)
    res.status(500).json({ message: '查询记录失败' })
  }
})

// 全量导出：所有账号所有记录，支持筛选同 /records
router.get('/export', async (req, res) => {
  try {
    const filter = {}
    if (req.query.userId) filter.userId = req.query.userId
    if (req.query.typeName) filter.typeName = req.query.typeName
    if (req.query.childName) filter.childName = { $regex: String(req.query.childName).trim(), $options: 'i' }
    if (req.query.from) filter.clientCreatedAt = { $gte: parseInt(req.query.from) }
    if (req.query.to) {
      filter.clientCreatedAt = filter.clientCreatedAt || {}
      filter.clientCreatedAt.$lte = parseInt(req.query.to)
    }
    const items = await Record.find(filter).sort({ clientCreatedAt: -1 }).lean()
    const format = (req.query.format || 'csv').toLowerCase()
    const filename = `admin-all-records-${new Date().toISOString().slice(0, 10)}`
    if (format === 'xlsx') {
      const buf = buildXlsx(toRows(items))
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`)
      return res.send(buf)
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`)
    res.send(buildCsv(toRows(items)))
  } catch (e) {
    console.error('[admin/export]', e)
    res.status(500).json({ message: '导出失败' })
  }
})

export default router
