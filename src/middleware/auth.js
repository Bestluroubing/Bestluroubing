import jwt from 'jsonwebtoken'
import { config } from '../config.js'

// 校验 Authorization: Bearer <token>，通过后把用户挂到 req.user
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) {
    return res.status(401).json({ message: '未登录' })
  }
  try {
    req.user = jwt.verify(token, config.jwtSecret) // { id, username }
    next()
  } catch (e) {
    return res.status(401).json({ message: '登录已过期，请重新登录' })
  }
}
