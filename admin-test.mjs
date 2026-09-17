const BASE = 'http://localhost:3000/api'
async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined
  })
  let data = {}
  try { data = await res.json() } catch (e) {}
  return { status: res.status, data }
}
async function main() {
  // 登录拿 token
  let r = await req('/auth/login', { method: 'POST', body: { username: 'regtest_new', password: 'abc123456' } })
  console.log('login:', r.status, 'isAdmin=', r.data.user?.isAdmin)
  const TOKEN = r.data.token
  const h = { Authorization: `Bearer ${TOKEN}` }

  r = await req('/admin/stats', { headers: h })
  console.log('stats:', JSON.stringify(r.data))

  r = await req('/admin/users?pageSize=3', { headers: h })
  console.log('users total=', r.data.total)

  r = await req('/admin/records?pageSize=3', { headers: h })
  console.log('records total=', r.data.total)

  // 非 admin 应该 403
  r = await req('/admin/stats', { headers: { Authorization: `Bearer fake` } })
  console.log('no-token status=', r.status, r.data.message)
}
main().catch(e => console.error(e))
