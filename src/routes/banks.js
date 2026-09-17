import { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// 题库 JSON 存放在 server/data/banks/<name>.json。
// 题库接口化阶段由脚本从前端 src/data 导出生成，此处按名称读取下发。
const banksDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../data/banks')

router.get('/:name', requireAuth, (req, res) => {
  const name = String(req.params.name).replace(/[^a-zA-Z0-9_-]/g, '')
  const file = path.join(banksDir, `${name}.json`)
  if (!fs.existsSync(file)) {
    return res.status(404).json({ message: '题库不存在' })
  }
  try {
    res.json(JSON.parse(fs.readFileSync(file, 'utf-8')))
  } catch (e) {
    console.error('[banks]', e)
    res.status(500).json({ message: '题库读取失败' })
  }
})

export default router
