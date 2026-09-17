import * as XLSX from 'xlsx'

// 将记录文档拍平为导出行；moduleData 里的扩展统计整列输出为 JSON 字符串
export function toRows(items) {
  return items.map(r => ({
    '记录ID': String(r._id),
    '儿童姓名': r.childName || '',
    '年龄': r.childAge || '',
    '评估模块': r.typeName || r.type,
    '模块标识': r.type,
    '题目总数': r.totalQuestions,
    '答对': r.correctCount,
    '答错': r.incorrectCount,
    '得分': r.score,
    '提前结束': r.stoppedEarly ? '是' : '否',
    '结束方式': r.endedBy || '',
    '扩展数据': JSON.stringify(r.moduleData || {}),
    '完成时间': r.clientCreatedAt
      ? new Date(r.clientCreatedAt).toLocaleString('zh-CN', { hour12: false })
      : (r.createdAt ? new Date(r.createdAt).toLocaleString('zh-CN', { hour12: false }) : '')
  }))
}

const HEADERS = [
  '记录ID', '儿童姓名', '年龄', '评估模块', '模块标识', '题目总数',
  '答对', '答错', '得分', '提前结束', '结束方式', '扩展数据', '完成时间'
]

export function buildCsv(rows) {
  const escape = v => {
    const s = v == null ? '' : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [HEADERS.join(',')]
  for (const row of rows) {
    lines.push(HEADERS.map(h => escape(row[h])).join(','))
  }
  return '\uFEFF' + lines.join('\r\n')
}

export function buildXlsx(rows) {
  const ws = XLSX.utils.json_to_sheet(rows, { header: HEADERS })
  ws['!cols'] = HEADERS.map(h => ({ wch: Math.max(10, Math.min(40, h.length * 2 + 4)) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '评估记录')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}
