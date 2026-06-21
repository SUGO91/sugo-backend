import http from "http";

const server = http.createServer(async (req, res) => {
  // Homepage check
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });

    res.end(
      JSON.stringify({
        message: "Sugo backend running 🚀",
      })
    );

    return;
  }

  // CPX Postback endpoint
  if (req.url.startsWith("/postback")) {
    const url = new URL(req.url, "http://localhost");

    // Data coming from CPX
    const userId = url.searchParams.get("user_id");
    const status = url.searchParams.get("status");
    const transactionId = url.searchParams.get("trans_id");

    console.log("New CPX Event");

    console.log("User ID:", userId);
    console.log("Status:", status);
    console.log("Transaction:", transactionId);

    // Temporary success response
    res.writeHead(200, { "Content-Type": "application/json" });

    res.end(
      JSON.stringify({
        success: true,
        message: "CPX postback received successfully",
      })
    );

    return;
  }

  // 404
  res.writeHead(404, { "Content-Type": "application/json" });

  res.end(
    JSON.stringify({
      error: "Route not found",
    })
  );
});

server.listen(10000, () => {
  console.log("Sugo backend running on port 10000 🚀");
});
