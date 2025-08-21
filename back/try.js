const io = require("socket.io-client");

// si ton serveur Node tourne sur localhost et port 3005
const socket = io("http://localhost:3005");

const data = {
    userId: "benjilumbala@gmail.com",
    password: "10benjluX?",
}

socket.emit("login", data, (response) => {
    console.log("login response:", response);
});
