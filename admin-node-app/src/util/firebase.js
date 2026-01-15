var admin = require("firebase-admin");

var serviceAccount = require("./firebaseAdminSDK.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://agapay-capstone-default-rtdb.asia-southeast1.firebasedatabase.app"
});

module.exports = admin;