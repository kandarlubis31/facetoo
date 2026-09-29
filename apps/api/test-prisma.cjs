const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const start = Date.now();
p.$connect().then(() => {
  console.log('Connected in', Date.now() - start, 'ms');
  return p.$disconnect();
}).catch(e => console.error('Error:', e.message));
