require("dotenv").config();

const Server = require("./src/server");

new Server().start(process.env.PORT || 8080);