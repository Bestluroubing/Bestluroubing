import mongoose from 'mongoose'
import { config } from './config.js'

// 建立数据库连接；连接串来自环境变量 MONGODB_URI
export async function connectDB() {
  if (!config.mongoUri) {
    throw new Error('未配置 MONGODB_URI，请参考 .env.example 填写后重试')
  }
  mongoose.set('strictQuery', true)
  await mongoose.connect(config.mongoUri)
  console.log('[db] MongoDB 连接成功')
}
