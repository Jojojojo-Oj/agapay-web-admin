const express = require("express");
const app = express();
const PORT = 3000;
const bodyParser = require("body-parser");
const firebaseRoute = require("./src/route/firebaseRoute");

app.use(bodyParser.json());

app.get("/", (req, res) => {
    res.send("Hello Nigga")
})

app.listen(PORT, () => {
    console.log(`App listening at http://localhost:${PORT}`)
})