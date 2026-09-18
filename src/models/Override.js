// 题库答案覆盖：管理员在后台修改的正确答案
// 只存 override，运行时与静态题库合并
import mongoose from 'mongoose'

const overrideSchema = new mongoose.Schema({
  trialId: { type: String, required: true },
  moduleId: { type: String, required: true, index: true },
  correct: { type: String, required: true }, // e.g. 'left' | 'right' | 'P2'
  updatedBy: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now }
})

overrideSchema.index({ trialId: 1, moduleId: 1 }, { unique: true })

export default mongoose.model('Override', overrideSchema)