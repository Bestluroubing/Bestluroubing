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

// 诊断端点：ping + 查询 User，返回完整错误（仅调试用）
app.get('/api/db-ping', async (req, res) => {
  try {
    const state = mongoose.connection.readyState
    const stateLabel = ['disconnected', 'connected', 'connecting', 'disconnecting'][state] || String(state)
    const start = Date.now()
    await mongoose.connection.db.admin().ping()

    // 尝试加载 User model 并查询
    let userOk = null
    let userErr = null
    try {
      const User = (await import('./models/User.js')).default
      const count = await User.countDocuments()
      userOk = { count }
    } catch (e) {
      userErr = { name: e.name, message: e.message, stack: String(e.stack).slice(0, 500) }
    }

    res.json({ ok: true, readyState: stateLabel, pingMs: Date.now() - start, userOk, userErr })
  } catch (e) {
    console.error('[db-ping]', e)
    res.status(500).json({ ok: false, readyState: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState], error: { name: e.name, message: e.message, stack: String(e.stack).slice(0, 500) } })
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
