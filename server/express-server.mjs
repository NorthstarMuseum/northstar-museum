// Optional Express host. Run `npm install`, then `npm run dev:express`.
// It preserves all existing authorization, API validation, and streaming request logic.
import express from 'express';
import { openDatabase } from './db.mjs';
import { createRequestHandler } from './app.mjs';

const app = express();
app.disable('x-powered-by');
const handler = createRequestHandler({db:openDatabase()});
app.use((req,res,next)=>{Promise.resolve(handler(req,res)).catch(next);});
const port = Number(process.env.PORT || 3000);
app.listen(port,()=>console.log(`Northstar (Express) running at http://localhost:${port}`));
