import User from '../models/User.js'

// 必须是已登录且 isAdmin=true 的用户
export async function requireAdmin(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: '未登录' })
  }
  const user = await User.findById(req.user.id).select('_id isAdmin username')
  if (!user || !user.isAdmin) {
    return res.status(403).json({ message: '无权访问管理员后台' })
  }
  req.adminUser = user
  next()
}
