import { createServer } from './app.mjs';
const port = Number(process.env.PORT || 3000);
const server = createServer();
server.listen(port, () => console.log(`Northstar running at http://localhost:${port}`));
