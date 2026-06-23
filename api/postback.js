import http from "http";
import admin from "firebase-admin";
import serviceAccount from "./serviceAccountKey.json" assert { type: "json" };

// FIREBASE ADMIN INIT
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const server = http.createServer(async (req, res) => {
  // HOME CHECK
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

    // only successful surveys
    if (status === "1") {
      // BUSINESS MODEL
      const userReward = amount * 0.4;   // 40%
      const companyProfit = amount * 0.6; // 60%

      // 1 rupee = 10 coins
      const coins = Math.floor(userReward * 10);

      // USER DOCUMENT
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

      // COMPANY WALLET
      const walletRef = db.collection("companyWallet").doc("main");

      const walletSnap = await walletRef.get();

      if (walletSnap.exists) {
        const wallet = walletSnap.data();

        await walletRef.update({
          totalEarnings: (wallet.totalEarnings || 0) + amount,

          netProfit: (wallet.netProfit || 0) + companyProfit,

          totalCoinsGiven: (wallet.totalCoinsGiven || 0) + coins,

          estimatedRewardLiability:
            (wallet.estimatedRewardLiability || 0) + userReward,
        });
      }

      console.log("Reward added successfully");
    }

    res.writeHead(200, { "Content-Type": "application/json" });

    res.end(
      JSON.stringify({
        success: true,
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
