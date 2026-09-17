// 把指定账号设为管理员。用法：node seed-admin.mjs <username>
import dotenv from 'dotenv'
import { connectDB } from './src/db.js'
import User from './src/models/User.js'

dotenv.config()

async function main() {
  const username = process.argv[2]
  if (!username) {
    console.error('用法: node seed-admin.mjs <username>')
    process.exit(1)
  }
  await connectDB()
  const user = await User.findOne({ username: String(username).trim().toLowerCase() })
  if (!user) {
    console.error(`账号 ${username} 不存在`)
    process.exit(1)
  }
  user.isAdmin = true
  await user.save()
  console.log(`已将 ${user.username} 设为管理员`)
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
