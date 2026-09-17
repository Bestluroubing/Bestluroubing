import mongoose from 'mongoose'

// 评估记录：公共字段与前端 saveResult 一一对应，
// 各模块的扩展统计（AX 难度、TRRE、体标记正确率等）统一放进 moduleData，
// 逐题明细结构因模块而异，直接以混合类型存储。
const recordSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  clientId: { type: String, default: '' }, // 前端生成的记录 id，批量同步时用于去重
  childId: { type: String, default: '' }, // 被试儿童档案 id（User.children 子文档 _id）
  childName: { type: String, default: '' }, // 提交时的儿童姓名快照，档案改名不影响历史
  childAge: { type: String, default: '' },
  type: { type: String, required: true },
  typeName: { type: String, default: '' },
  totalQuestions: { type: Number, default: 0 },
  correctCount: { type: Number, default: 0 },
  incorrectCount: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  stoppedEarly: { type: Boolean, default: false },
  endedBy: { type: String, enum: ['manual', 'auto', 'completed', ''], default: 'completed' },
  moduleData: { type: mongoose.Schema.Types.Mixed, default: {} },
  details: { type: mongoose.Schema.Types.Mixed, default: [] },
  clientCreatedAt: { type: Number, default: 0 }, // 前端记录的完成时间（毫秒）
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false })

// 同一账号下 clientId 唯一，防止批量同步重复入库
recordSchema.index({ userId: 1, clientId: 1 }, { unique: true, sparse: true })

export default mongoose.model('Record', recordSchema)
