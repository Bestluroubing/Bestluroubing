import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'
import { config } from '../config.js'

const router = Router()

function signToken(user) {
  return jwt.sign(
    { id: user._id, username: user.username },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  )
}

function publicUser(user) {
  return {
    id: user._id,
    username: user.username,
    nickname: user.nickname,
    isAdmin: !!user.isAdmin,
    // 子文档的 _id 转成 id，前端统一用 id 字段访问
    children: (user.children || []).map(c => ({
      id: c._id,
      name: c.name,
      age: c.age,
      gender: c.gender,
      notes: c.notes,
      createdAt: c.createdAt
    })),
    createdAt: user.createdAt
  }
}

// 注册：账号 + 密码 + 儿童信息，注册成功后自动创建第一个儿童档案
router.post('/register', async (req, res) => {
  try {
    const { username, password, childName, childAge } = req.body || {}
    if (!username || !password) {
      return res.status(400).json({ message: '账号和密码不能为空' })
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: '密码至少 6 位' })
    }
    const uname = String(username).trim().toLowerCase()
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(uname)) {
      return res.status(400).json({ message: '账号需为 3-20 位字母、数字或下划线' })
    }
    const exists = await User.findOne({ username: uname })
    if (exists) {
      return res.status(409).json({ message: '该账号已被注册' })
    }
    const userData = {
      username: uname,
      password: await bcrypt.hash(String(password), 10),
      nickname: String(childName || uname).slice(0, 20)
    }
    if (childName && String(childName).trim()) {
      userData.children = [{
        name: String(childName).trim(),
        age: childAge != null ? String(childAge) : ''
      }]
    }
    const user = await User.create(userData)
    res.status(201).json({ token: signToken(user), user: publicUser(user) })
  } catch (e) {
    console.error('[auth/register]', e)
    res.status(500).json({ message: '注册失败', error: e.message, name: e.name })
  }
})

// 登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {}
    if (!username || !password) {
      return res.status(400).json({ message: '用户名和密码不能为空' })
    }
    const user = await User.findOne({ username: String(username).trim().toLowerCase() })
    if (!user || !(await bcrypt.compare(String(password), user.password))) {
      return res.status(401).json({ message: '用户名或密码错误' })
    }
    res.json({ token: signToken(user), user: publicUser(user) })
  } catch (e) {
    console.error('[auth/login]', e)
    res.status(500).json({ message: '登录失败，请稍后重试' })
  }
})

// 当前用户信息
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
    if (!user) return res.status(404).json({ message: '用户不存在' })
    res.json({ user: publicUser(user) })
  } catch (e) {
    console.error('[auth/me]', e)
    res.status(500).json({ message: '获取用户信息失败' })
  }
})

// 新增儿童档案
router.post('/children', requireAuth, async (req, res) => {
  try {
    const { name, age, gender, notes } = req.body || {}
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: '儿童姓名不能为空' })
    }
    const user = await User.findById(req.user.id)
    if (!user) return res.status(404).json({ message: '用户不存在' })
    user.children.push({
      name: String(name).trim(),
      age: age != null ? String(age) : '',
      gender: gender || '',
      notes: notes || ''
    })
    await user.save()
    res.status(201).json({ children: user.children })
  } catch (e) {
    console.error('[auth/children:add]', e)
    res.status(500).json({ message: '保存儿童档案失败' })
  }
})

// 修改儿童档案
router.put('/children/:childId', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
    if (!user) return res.status(404).json({ message: '用户不存在' })
    const child = user.children.id(req.params.childId)
    if (!child) return res.status(404).json({ message: '儿童档案不存在' })
    const { name, age, gender, notes } = req.body || {}
    if (name != null) {
      if (!String(name).trim()) return res.status(400).json({ message: '儿童姓名不能为空' })
      child.name = String(name).trim()
    }
    if (age != null) child.age = String(age)
    if (gender != null) child.gender = gender
    if (notes != null) child.notes = notes
    await user.save()
    res.json({ children: user.children })
  } catch (e) {
    console.error('[auth/children:update]', e)
    res.status(500).json({ message: '修改儿童档案失败' })
  }
})

// 删除儿童档案
router.delete('/children/:childId', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
    if (!user) return res.status(404).json({ message: '用户不存在' })
    const child = user.children.id(req.params.childId)
    if (!child) return res.status(404).json({ message: '儿童档案不存在' })
    child.deleteOne()
    await user.save()
    res.json({ children: user.children })
  } catch (e) {
    console.error('[auth/children:remove]', e)
    res.status(500).json({ message: '删除儿童档案失败' })
  }
})

export default router
