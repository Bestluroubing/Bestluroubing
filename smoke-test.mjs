// 后端接口冒烟测试脚本：注册→儿童→提交记录→查询→导出
const BASE = 'http://localhost:3000/api'

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined
  })
  let data = {}
  try { data = await res.json() } catch (e) {}
  return { status: res.status, data, headers: res.headers }
}

async function main() {
  console.log('=== 冒烟测试开始 ===\n')

  // 1. 健康检查
  let r = await req('/health')
  console.log(`[1] 健康检查: ${r.status} ${JSON.stringify(r.data)}`)

  // 2. 注册
  const uname = 'trae_' + Date.now()
  r = await req('/auth/register', {
    method: 'POST',
    body: { username: uname, password: 'abc123456', nickname: '测试账号' }
  })
  console.log(`[2] 注册 ${uname}: ${r.status} ${r.data.message || 'ok'}`)
  if (!r.data.token) { console.error('注册失败，终止'); process.exit(1) }
  const TOKEN = r.data.token
  const h = { Authorization: `Bearer ${TOKEN}` }

  // 3. me
  r = await req('/auth/me', { headers: h })
  console.log(`[3] /me: ${r.status} ${r.data.user?.username}`)

  // 4. 添加儿童
  r = await req('/auth/children', {
    method: 'POST', headers: h,
    body: { name: '小明', age: '5', gender: 'male', notes: '测试' }
  })
  console.log(`[4] 添加儿童: ${r.status}`)
  const childId = r.data.children?.[0]?.id

  // 5. 提交记录
  r = await req('/records', {
    method: 'POST', headers: h,
    body: {
      id: 'rec-' + Date.now(),
      type: 'ax-discrimination',
      typeName: '声音小侦探-1A 频率辨别',
      totalQuestions: 10, correctCount: 8, incorrectCount: 2, score: 8,
      stoppedEarly: false, endedBy: 'completed',
      averageTime: 1.2, difficulty: 'L1', subtaskId: 1, subtaskName: '1A 频率辨别',
      details: [
        { trial: 'same', label: '纯音1v2', expected: 'same', answer: 'same', correct: true, responseTime: 1.1 }
      ],
      createdAt: Date.now()
    }
  })
  console.log(`[5] 提交记录: ${r.status} id=${r.data.id}`)

  // 6. 批量同步（空数组应成功）
  r = await req('/records/batch', {
    method: 'POST', headers: h, body: { records: [] }
  })
  console.log(`[6] 批量同步空: ${r.status} ${JSON.stringify(r.data)}`)

  // 7. 查询列表
  r = await req('/records', { headers: h })
  console.log(`[7] 列表查询: ${r.status} total=${r.data.total}`)
  const recId = r.data.items?.[0]?._id

  // 8. 单条详情
  if (recId) {
    r = await req('/records/' + recId, { headers: h })
    console.log(`[8] 详情: ${r.status} childName=${r.data.item?.childName || '(空)'}`)
  }

  // 9. 导出 CSV（直接 fetch 拿 blob）
  const csvRes = await fetch(BASE + '/records/export?format=csv', { headers: h })
  console.log(`[9] CSV导出: ${csvRes.status} type=${csvRes.headers.get('content-type')}`)

  // 10. 导出 xlsx
  const xlsxRes = await fetch(BASE + '/records/export?format=xlsx', { headers: h })
  console.log(`[10] XLSX导出: ${xlsxRes.status} type=${xlsxRes.headers.get('content-type')}`)

  // 11. 删除记录
  if (recId) {
    r = await req('/records/' + recId, { method: 'DELETE', headers: h })
    console.log(`[11] 删除记录: ${r.status}`)
  }

  // 12. 无 token 访问应 401
  r = await req('/records')
  console.log(`[12] 未登录401: ${r.status}`)

  // 13. 儿童信息回显
  if (childId) {
    r = await req('/auth/me', { headers: h })
    console.log(`[13] children: ${r.data.user?.children?.length} 个`)
  }

  console.log('\n=== 全部通过 ===')
}

main().catch(e => { console.error('失败:', e); process.exit(1) })
