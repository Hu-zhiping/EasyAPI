// EasyAPI 功能测试专用本地服务器（确定性响应，无外部依赖）
import http from 'node:http'

const PORT = 18080
const json = (res, code, obj, headers = {}) => {
  const body = JSON.stringify(obj)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...headers })
  res.end(body)
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
  const path = url.pathname
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf-8')
    const headers = { ...req.headers }
    delete headers.host

    if (path === '/ping') return json(res, 200, { ok: true, msg: 'pong' })
    if (path === '/manyheaders') {
      const h = {}
      for (let i = 1; i <= 25; i++) h[`X-Test-Header-${String(i).padStart(2, '0')}`] = `value-${i}`
      return json(res, 200, { ok: true }, h)
    }
    if (path === '/echo') {
      return json(res, req.method === 'POST' ? 201 : 200, {
        method: req.method,
        query: Object.fromEntries(url.searchParams),
        headers,
        body: body || null
      })
    }
    if (path === '/cookie/set') {
      return json(res, 200, { set: true }, { 'Set-Cookie': 'sid=abc123; Path=/; Max-Age=3600' })
    }
    if (path === '/cookie/check') {
      return json(res, 200, { cookieHeader: req.headers.cookie ?? null })
    }
    if (path === '/cookie/clear') {
      return json(res, 200, { cleared: true }, { 'Set-Cookie': 'sid=; Path=/; Max-Age=0' })
    }
    if (path === '/redirect') {
      res.writeHead(302, { Location: '/ping' })
      return res.end()
    }
    if (path === '/html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      return res.end('<html><body><h1>EasyAPI Preview</h1></body></html>')
    }
    if (path === '/large') {
      const items = Array.from({ length: 2000 }, (_, i) => ({ id: i, name: `item-${i}` }))
      return json(res, 200, { items })
    }
    if (path === '/slow') {
      setTimeout(() => json(res, 200, { slow: true }), 3000)
      return
    }
    if (path === '/status/404') return json(res, 404, { error: 'not found' })
    if (path === '/status/500') return json(res, 500, { error: 'server error' })
    json(res, 404, { error: `unknown path ${path}` })
  })
})

server.listen(PORT, '127.0.0.1', () => console.log(`test-server ready on http://127.0.0.1:${PORT}`))
