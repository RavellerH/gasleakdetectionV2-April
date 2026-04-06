const axios = require('axios');

async function testLogin() {
  try {
    const res = await axios.post('http://localhost:3001/graphql', {
      query: `
        query Login($email: String!, $password: String!) {
          login(email: $email, password: $password) {
            user { id email name ruId role }
            error
          }
        }
      `,
      variables: {
        email: "admin@gld.com",
        password: "admin"
      }
    });
    console.log('--- LOGIN TEST ---');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.error('Login Error:', e.message);
  }
}
testLogin();
