import index from "./index.html";

const port = Number(process.env.PORT) || 3000;

Bun.serve({
  routes: {
    "/": index,
  },
  development: {
    hmr: true,
    console: true,
  },
  port,
});

console.log(`Arcanoid running at http://localhost:${port}`);
