const http = require('http');

function request(query, variables = {}, token) {
  const data = JSON.stringify({ query, variables });
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1', port: 4000, path: '/graphql', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const login = await request(
    'query Login($email:String!,$password:String!){login(email:$email,password:$password){token error}}',
    { email: 'admin@gld.com', password: 'admin' },
  );
  const token = login.data?.login?.token;
  if (!token) throw new Error(login.data?.login?.error || 'Login failed');
  const stats = await request('{ getDashboardStats { totalDevices } }', {}, token);
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
