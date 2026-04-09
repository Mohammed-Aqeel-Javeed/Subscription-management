const http = require('http');

async function run() {
  const data = JSON.stringify({
    fullName: "Test User",
    email: "test.user.1@perfecta.com",
    password: "Password123!",
    companyName: "Perfecta",
    tenantId: "tenant-test-123",
    sessionId: "cs_test_123456789"
  });

  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/signup',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req = http.request(options, (res) => {
    let responseBody = '';
    res.on('data', (chunk) => { responseBody += chunk; });
    res.on('end', () => {
      console.log('Status Code:', res.statusCode);
      console.log('Response Body:', responseBody);
    });
  });

  req.on('error', (error) => { console.error('Error:', error); });
  req.write(data);
  req.end();
}

run();
