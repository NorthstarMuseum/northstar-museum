// Start only against the isolated classroom database. Never touch real data.
import { existsSync } from 'node:fs';
if(!existsSync('./data/northstar-class-demo.sqlite')){
 console.error('Run npm run demo:prepare first to create a classroom demo database.');
 process.exit(1);
}
process.env.DATABASE_PATH='./data/northstar-class-demo.sqlite';
await import('./index.mjs');
