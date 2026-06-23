import http from "http";
import admin from "firebase-admin";
import fs from "fs";

// READ FIREBASE SECRET KEY
const serviceAccount = JSON.parse(
  fs.readFileSync("./serviceAccountKey.json", "utf8")
);

// FIREBASE INIT
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// SERVER
const server = http.createServer(async (req, res) => {
  // HOME PAGE TEST
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });

    res.end(
      JSON.stringify({
        message: "Sugo backend running 🚀",
      })
    );

    return;
  }

  // CPX POSTBACK
  if (req.url.startsWith("/postback")) {
    const url = new URL(req.url, "http://localhost");

    const userId = url.searchParams.get("user_id");
    const status = url.searchParams.get("status");
    const amount = Number(url.searchParams.get("amount"));
    const transId = url.searchParams.get("trans_id");

    console.log("New CPX Event");
    console.log("User:", userId);
    console.log("Status:", status);
    console.log("Amount:", amount);
    console.log("Transaction:", transId);

    // ONLY SUCCESSFUL SURVEY
    if (status === "1") {
      // OUR BUSINESS MODEL
      const userReward = amount * 0.4;      
      const companyProfit = amount * 0.6;   
      const coins = Math.floor(userReward * 10);

      // UPDATE USER
      const userRef = db.collection("users").doc(userId);
      const userSnap = await userRef.get();

      if (userSnap.exists) {
        const userData = userSnap.data();

        await userRef.update({
          coins: (userData.coins || 0) + coins,

          history: admin.firestore.FieldValue.arrayUnion(
            `Survey Completed +${coins} Coins`
          ),
        });
      }

      // UPDATE COMPANY WALLET
      const walletRef = db.collection("companyWallet").doc("main");
      const walletSnap = await walletRef.get();

      if (walletSnap.exists) {
        const walletData = walletSnap.data();

        await walletRef.update({
          totalEarnings: (walletData.totalEarnings || 0) + amount,

          netProfit: (walletData.netProfit || 0) + companyProfit,

          totalCoinsGiven: (walletData.totalCoinsGiven || 0) + coins,

          estimatedRewardLiability:
            (walletData.estimatedRewardLiability || 0) + userReward,
        });
      }

      console.log("Reward added successfully ✅");
    }

    res.writeHead(200, { "Content-Type": "application/json" });

    res.end(
      JSON.stringify({
        success: true,
        message: "Postback processed",
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

// START SERVER
server.listen(10000, () => {
  console.log("Sugo backend running on port 10000 🚀");
});
