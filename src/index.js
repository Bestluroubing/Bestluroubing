import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import { config } from './config.js'
import { connectDB } from './db.js'
import authRoutes from './routes/auth.js'
import recordRoutes from './routes/records.js'
import bankRoutes from './routes/banks.js'
import adminRoutes from './routes/admin.js'

const app = express()

// 前端部署在 https 域名下，通过 CORS 白名单放开跨域访问
app.use(cors({
  origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map(s => s.trim())
}))
app.use(express.json({ limit: '2mb' }))

// 健康检查，部署平台探活与前端可用性探测都走这里
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: Date.now() })
})

// 诊断端点：模拟 register 完整流程（bcrypt + User.create），返回完整错误（仅调试用）
app.get('/api/db-ping', async (req, res) => {
  const report = {}
  try {
    report.readyState = ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState]
    report.ping = await mongoose.connection.db.admin().ping().then(() => 'ok').catch(e => ({ name: e.name, message: e.message }))

    // bcrypt.hash 测试
    let hashR = null
    try {
      const bcrypt = (await import('bcryptjs')).default
      const h = await bcrypt.hash('test123', 10)
      hashR = { ok: true, len: h.length }
    } catch (e) { hashR = { ok: false, name: e.name, message: e.message } }
    report.bcryptHash = hashR

    // User.create 测试（unique 索引冲突时忽略）
    let createR = null
    try {
      const User = (await import('./models/User.js')).default
      const uname = `__diag_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
      const u = await User.create({
        username: uname,
        password: hashR?.ok ? hashR.ok : 'test-hash',
        nickname: 'diag',
        children: [{ name: 'diag', age: '0' }]
      })
      // 立刻删掉
      await User.deleteOne({ _id: u._id })
      createR = { ok: true }
    } catch (e) { createR = { ok: false, name: e.name, message: e.message, stack: String(e.stack).slice(0, 600) } }
    report.userCreate = createR

    // 同时返回 config 关键项（脱敏）
    report.config = {
      hasMongoUri: !!config.mongoUri,
      mongoUriStart: config.mongoUri?.slice(0, 30),
      mongoUriHasAuthSource: config.mongoUri?.includes('authSource'),
      mongoUriHasTls: config.mongoUri?.includes('tls'),
      corsOrigin: config.corsOrigin,
      port: config.port,
      hasJwtSecret: !!config.jwtSecret
    }

    res.json({ ok: true, ...report })
  } catch (e) {
    res.status(500).json({ ok: false, name: e.name, message: e.message, stack: String(e.stack).slice(0, 600), report })
  }
})

app.use('/api/auth', authRoutes)
app.use('/api/records', recordRoutes)
app.use('/api/banks', bankRoutes)
app.use('/api/admin', adminRoutes)

// 未匹配的 API 路径统一返回 404 JSON
app.use('/api', (req, res) => {
  res.status(404).json({ message: '接口不存在' })
})

// 兜底错误处理，避免堆栈信息泄露给前端
app.use((err, req, res, next) => {
  console.error('[server]', err)
  if (res.headersSent) return
  res.status(500).json({ message: '服务器内部错误' })
})

connectDB()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`[server] 服务已启动 http://localhost:${config.port}`)
    })
  })
  .catch(err => {
    console.error('[db] 连接失败：', err.message)
    process.exit(1)
  })
