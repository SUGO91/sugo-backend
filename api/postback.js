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

    if (status === "1") {
      await transactionRef.set({
        transactionId: transId,
        createdAt: new Date(),
      });

      const userRef = db.collection("users").doc(userId);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        throw new Error("User not found");
      }

      const userData = userSnap.data();

      let companyProfit = amount * 0.6;
      let userReward = amount * 0.4;

      // USER REWARD
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

        // TRACK SURVEY COUNT
        referredSurveyCount: (userData.referredSurveyCount || 0) + 1,
      });

      // REFERRAL LOCK SYSTEM
      if (
        userData.referredBy &&
        userData.referredBy !== "" &&
        (userData.referredSurveyCount || 0) + 1 >= 3 &&
        (userData.referralRewardCount || 0) === 0
      ) {
        const referrerQuery = await db
          .collection("users")
          .where("referralCode", "==", userData.referredBy)
          .get();

        if (!referrerQuery.empty) {
          const referrerDoc = referrerQuery.docs[0];
          const referrerData = referrerDoc.data();

          const referralReward = 20; // fixed reward ₹20

          await referrerDoc.ref.update({
            referralEarnings:
              (referrerData.referralEarnings || 0) + referralReward,

            history: admin.firestore.FieldValue.arrayUnion(
              `Referral Reward +₹${referralReward}`
            ),
          });

          // MARK USER AS ALREADY REWARDED
          await userRef.update({
            referralRewardCount: 1,
          });

          console.log("Referral reward unlocked ✅");
        }
      }

      // UPDATE WALLET
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
