import { resolve } from 'node:path';
import { createApp } from './app.mjs';
const port = Number(process.env.PORT ?? 8006);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT ต้องเป็นเลข 1–65535');
const database = resolve(process.env.HOOKLAB_DATA_DIR ?? '.data', 'hooklab.sqlite');
const server = createApp({ database });
server.listen(port, '127.0.0.1', () => console.log(`HookLab ready at http://127.0.0.1:${port}`));
server.on('error', error => { console.error(`HookLab เปิดไม่ได้ (${error.code ?? 'server error'})`); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
