import http from "http";

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      message: "Sugo backend running 🚀"
    })
  );
});

server.listen(10000, () => {
  console.log("Server running on port 10000");
});
