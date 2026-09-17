import mongoose from 'mongoose'

// 儿童档案：挂在账号下的子文档，测试前选择本次被试
const childSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  age: { type: String, default: '' },
  gender: { type: String, default: '' },
  notes: { type: String, default: '' },
  createdAt: { type: Number, default: () => Date.now() }
})

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true }, // 只存 bcrypt 哈希
  nickname: { type: String, default: '' },
  children: [childSchema],
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false })

// 对外输出时隐藏密码字段
userSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.password
    return ret
  }
})

export default mongoose.model('User', userSchema)
