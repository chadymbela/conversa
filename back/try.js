const { randomBytes } = require("crypto");

const key = randomBytes(32);

console.log(key.toString("hex"));
console.log(key)