```javascript
import http from "http";
import admin from "firebase-admin";

// FIREBASE INIT
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.PROJECT_ID,
    clientEmail: process.env.CLIENT_EMAIL,
    privateKey: process.env.PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});

const db = admin.firestore();

const server = http.createServer(async (req, res) => {
  // HEALTH CHECK
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Sugo backend running 🚀" }));
    return;
  }

  // CPX POSTBACK
  if (req.url.startsWith("/postback")) {
    try {
      const url = new URL(req.url, "http://localhost");

      const userId = url.searchParams.get("user_id");
      const status = url.searchParams.get("status");
      const amount = Number(url.searchParams.get("amount"));
      const transId = url.searchParams.get("trans_id");

      console.log("New CPX Survey Event");

      // DUPLICATE BLOCK
      const transactionRef = db.collection("processedTransactions").doc(transId);
      const transactionSnap = await transactionRef.get();

      if (transactionSnap.exists) {
        console.log("Duplicate blocked ❌");

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
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

        let companyProfit = 0;
        let userReward = amount * 0.40;
        let referralReward = 0;

        // REFERRAL CASE
        if (userData.referredBy && userData.referredBy !== "") {
          companyProfit = amount * 0.50;
          referralReward = amount * 0.10;

          const referrerQuery = await db
            .collection("users")
            .where("referralCode", "==", userData.referredBy)
            .get();

          if (!referrerQuery.empty) {
            const referrerDoc = referrerQuery.docs[0];
            const referrerData = referrerDoc.data();

            await referrerDoc.ref.update({
              referralEarnings:
                (referrerData.referralEarnings || 0) + referralReward,

              history: admin.firestore.FieldValue.arrayUnion(
                `Referral reward +₹${referralReward.toFixed(2)}`
              ),
            });
          }
        } else {
          // NORMAL USER
          companyProfit = amount * 0.60;
        }

        // UPDATE USER
        await userRef.update({
          balance: (userData.balance || 0) + userReward,

          totalEarningsRs:
            (userData.totalEarningsRs || 0) + userReward,

          history: admin.firestore.FieldValue.arrayUnion(
            `Survey completed +₹${userReward.toFixed(2)}`
          ),
        });

        // UPDATE COMPANY WALLET
        const walletRef = db.collection("companyWallet").doc("main");
        const walletSnap = await walletRef.get();

        if (walletSnap.exists) {
          const walletData = walletSnap.data();

          await walletRef.update({
            totalEarnings:
              (walletData.totalEarnings || 0) + amount,

            netProfit:
              (walletData.netProfit || 0) + companyProfit,

            totalPaidToUsers:
              (walletData.totalPaidToUsers || 0) + userReward + referralReward,
          });
        }

        console.log("Survey processed successfully ✅");
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
      return;
    } catch (error) {
      console.log(error);

      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Server error" }));
      return;
    }
  }

  // 404
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Route not found" }));
});

server.listen(10000, () => {
  console.log("Sugo backend running on port 10000 🚀");
});
```
