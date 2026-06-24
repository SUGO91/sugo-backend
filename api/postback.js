import http from "http";
import admin from "firebase-admin";

// FIREBASE INIT USING RENDER ENV VARIABLES
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.PROJECT_ID,
    clientEmail: process.env.CLIENT_EMAIL,
    privateKey: process.env.PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});

const db = admin.firestore();

// SERVER
const server = http.createServer(async (req, res) => {
  // HOME PAGE
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

    // DUPLICATE CHECK
    const transactionRef = db
      .collection("processedTransactions")
      .doc(transId);

    const transactionSnap = await transactionRef.get();

    if (transactionSnap.exists) {
      console.log("Duplicate transaction blocked ❌");

      res.writeHead(200, { "Content-Type": "application/json" });

      res.end(
        JSON.stringify({
          success: true,
          message: "Duplicate ignored",
        })
      );

      return;
    }

    // ONLY SUCCESSFUL SURVEY
    if (status === "1") {
      // SAVE TRANSACTION
      await transactionRef.set({
        transactionId: transId,
        createdAt: new Date(),
      });

      // GET USER
      const userRef = db.collection("users").doc(userId);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        throw new Error("User not found");
      }

      const userData = userSnap.data();

      let companyProfit = 0;
      let userReward = amount * 0.4;
      let referrerReward = 0;

      // CHECK REFERRAL
      if (userData.referredBy && userData.referredBy !== "") {
        companyProfit = amount * 0.5;
        referrerReward = amount * 0.1;

        // FIND REFERRER BY REFERRAL CODE
        const referrerQuery = await db
          .collection("users")
          .where("referralCode", "==", userData.referredBy)
          .get();

        if (!referrerQuery.empty) {
          const referrerDoc = referrerQuery.docs[0];
          const referrerData = referrerDoc.data();

          await referrerDoc.ref.update({
            referralEarnings:
              (referrerData.referralEarnings || 0) + referrerReward,

            history: admin.firestore.FieldValue.arrayUnion(
              `Referral Reward +₹${referrerReward}`
            ),
          });

          console.log("Referrer rewarded ✅");
        }
      } else {
        companyProfit = amount * 0.6;
      }

      // USER COINS
      const coins = Math.floor(userReward * 10);

      // UPDATE USER
      await userRef.update({
        coins: (userData.coins || 0) + coins,

        totalEarningsRs: (userData.totalEarningsRs || 0) + userReward,

        pendingRewardValueRs:
          (userData.pendingRewardValueRs || 0) + userReward,

        history: admin.firestore.FieldValue.arrayUnion(
          `Survey Completed +${coins} Coins`
        ),
      });

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

      console.log("Survey processed successfully ✅");
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
