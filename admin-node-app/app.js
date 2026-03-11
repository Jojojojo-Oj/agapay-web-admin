require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const sendSmsAlert = require("./src/controllers/smsAlertController");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

app.get("/", (req, res) => {
    res.send("Agapay Admin API");
});

app.post("/api/send-sms-alert", sendSmsAlert);

app.listen(PORT, () => {
    console.log(`App listening at http://localhost:${PORT}`);
});