import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.user.count()
  .then(c => { console.log('DB OK, users:', c); p.$disconnect(); })
  .catch(e => { console.log('DB FAIL:', e.message.substring(0, 200)); p.$disconnect(); });
