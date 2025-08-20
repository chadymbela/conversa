// on utilise deux express tout seul pour les routes api ancienne aunilatéral et on utilise socket.io pour la communication en temps réel dans cette app

const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const http = require("http");
const {Server} = require("socket.io");
const mysql = require("mysql2");
const multer = require("multer");
const {createClient} = require("redis");
const redis = createClient({url: process.env.REDIS_URL}).connect();
const crypto = require("crypto");
const path = require("path");
const cryptoKey = Buffer.from(process.env.CRYPTO_KEY, "hex");
const path = require("path");

const port = process.env.PORT || 3004;
const app = express();


app.use(express.json());


// configuration de socket.io qui nous permettra de gérer les connexions clients en temps réel
const server = http.createServer(app);
const io = new Server(server);

// configuration de la base de données
// le process.env..... signifie que les informations sont dans le fichier .env
// on peut les récupérer avec process.env.DB_HOST
let db;
async function intiDb() {
    db = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    })
};


// configuration du middleware pour télécharger les fichier dans une route api rest

const diskstorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "profilPhoto");
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + "_" + new Date() + path.extname(file.originalname));
    }
});
const uploadProfilPhoto = multer({ storage: diskstorage });


function encrypt(text, iv) {
    let cipher = crypto.createCipheriv('aes-256-cbc', cryptoKey, iv);
    let encrypted = cipher.update(text, "utf8","hex");
    encrypted += cipher.final("hex");
    return encrypted;
};


function decrypt(text, iv) {
    let decipher = crypto.createDecipheriv('aes-256-cbc', cryptoKey, iv);
    let decrypted = decipher.update(text, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}


// initialisation et lancement de l'utisation de notre serveur en temps réel
io.on("connection", (socket) => {

    // quand l'utilisateur se connecte
    socket.on("login", async(data, callback) => {
        const response = await login(data);
        if (response.message === "success") {
            (await redis).lPush("user" + response.data.id, socket.id);
        }
        callback(response);

    })

    // quand l'utilisateur crée un compte
    socket.on("signup", async (data, callback) =>{
        const response = await signup(data);
        if (response.message === "success") {
            (await redis).lPush("user" + response.data.id, socket.id);
        }
        callback(response);
    })

    // quand l'utilisateur envoie un message à un autre dans une conversation
    socket.on("sendMessageText", async (data, callback) => {
        
        try {
            const iv = crypto.randomBytes(16);
            const stockableIv= iv.toString("hex");

            const cryptContent = encrypt(data.messageContent, iv);
            const timedate = new Date().toLocaleString();
            const sql = "INSERT INTO message (messageContent, messageType, userId, conversation, iv, timedate) VALUES (?, ?, ?, ?, ?, ?)";
            await db.query(sql, [cryptContent, data.messageType, data.userId, data.conversation,stockableIv, timedate]);

            // si l'insertion dans la bdd réussit on renvoie un message de succès et emet pour que l'utilisateur concerné soit em
            
            const socketIds = await (await redis).lRange("user" + participantId, 0, -1);
            socketIds.forEach((socketId) => {
                io.to(socketId).emit("newMessage", data);
            })
            callback({ message: "success" });

        }
        catch (err) {
            return callback({ message: "error" })
        }
    });

    socket.on("deleteMessage", async (data, callback) =>{
        try {
            const sql = "DELETE FROM message WHERE messageId = ?";
            await db.query(sql, [data.messageId]);

            const socketIds = await (await redis).lRange("user" + participantId, 0, -1);
            
            socketIds.forEach((socketId) => {
                io.to(socketId).emit("messageDeleted", data);
            })

            callback({ message: "success" });
        }
        catch (err) {
            return callback({ message: "error" })
        }
    });

    socket.on("editMessage", async (data, callback) =>{
        try {
            const iv = crypto.randomBytes(16);
            const newContentEncrypted = encrypt(data.messageContent, iv);
            const sql = "UPDATE message SET messageContent = ? WHERE messageId = ?";
            await db.query(sql, [newContentEncrypted, data.messageId]);
            
            const socketIds = await (await redis).lRange("user" + participantId, 0, -1);

            socketIds.forEach((socketId) => {
                io.to(socketId).emit("messageEdited", data);
            })

            callback({ message: "success" });
        }
        catch (err) {
            return callback({ message: "error" })
        }
    });
    
});


async function login(body) {
    // on récupère les données de l'utilisateur et userId peut etre le numéro de téléphone ou l'email de l'utilisateur
    const { userId, password } = body;
    const sql = "SELECT * FROM users WHERE email = ? OR phoneNumber = ?"
    
    // on vérifie si l'utilisateur existe dans la base de données
    try {
        const result = await db.query(sql, [userId, userId]);
        // si l'utilisateur n'existe pas on renvoie un message d'erreur
        if(result.lenght < 0)  return { message: "username or password incorrect", details: "username or password incorrect" } 
        
        // si l'utilisateur existe on vérifie si le mot de passe est correct
        const match = await bcrypt.compare(password, result[0].password)
    
        // si le mot de passe est correct on renvoie les données de l'utilisateur au cas contraire on renvoie un message d'erreur 
        const connectedUser = { message: "success", data: result[0] };
        const userNotFound = { message: "error", details: "username or password incorrect" };
        return match ? connectedUser : userNotFound;
    }
    // si il y a une erreur on renvoie un message d'erreur
    catch (err) {
        return {message: "error", details: "database error"}
    }
    
}



async function signup(body) {
    // on recupère les données du formulaire venant de l'utilisateur et on les stocke dans des variables
    const {email, phoneNumber, password, firstName, lastName, birthDate, sexe, answerOne, answerTwo, answerThree} = body;

    // on vérifie si l'utilisateur existe déjà
    const chechSql = "SELECT * FROM users WHERE email = ? OR phoneNumber = ?"
    try {
        const userExist = await db.query(chechSql, [email, phoneNumber])
        if(userExist.lenght > 0)  return {message: "error", details: "user already exist"} 
        // s'il n'existe pas on l'ajoute à la base de données par la fonction addUser()
        return addUser();
    }
    catch (err) {
        // si il y a une erreur on renvoie un message d'erreur
        return {message: "error", details: "database error"}
    }


    async function addUser() {
        // on prépare la requête SQL pour l'insertion des données
        const sql = "INSERT INTO users (email, phoneNumber, password, firstName, lastName, birthDate, sexe, answerOne, answerTwo, answerThree) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        // on exécute la requête SQL avec les données de l'utilisateur
       
        try {
            const result = await db.query(sql, [email, phoneNumber, password, firstName, lastName, birthDate, sexe, answerOne, answerTwo, answerThree]);

            // si l'insertion est réussie, on renvoie un message de succès avec les données de l'utilisateur en y ajoutant le Id qu'il recevra de la bdd
            return {message: "success", data: {userId: result.insertId, email, phoneNumber, firstName, lastName, birthDate, sexe, answerOne, answerTwo, answerThree}}
        }
        catch (err) {
            // si l'insertion échoue, on renvoie un message d'erreur
            return {message: "error", details: "database error"}
        }

    }
}


app.post("reset", async (req, res) => {
    // on récupère les données du formulaire et le userId peut être le numéro de téléphone ou l'email
   const {userId, answerOne, answerTwo, answerThree} = req.body;

    // on vérifie que l'utilisateur au travers de l'userId existe bien dans la bdd et que les réponses sont correctes
    const sql = "SELECT * FROM users WHERE (email = ? OR phoneNumber = ?) AND answerOne = ? AND answerTwo = ? AND answerThree = ?";

    try {
        const result = await db.query(sql, [userId, userId, answerOne, answerTwo, answerThree]);

        // si l'utilisateur n'existe pas ou que les réponses sont incorrectes, on renvoie un message d'erreur
        if (result.length === 0) {
            return res.json({message: "error", details: "wrong answer or user does not exist"})
        }

        // si l'utilisateur existe et que les réponses sont correctes, on renvoie un message de succès

        return res.json({message: "success", details: "user found and answers are correct, he can reset his password"})
    }
    catch (err) {
        return res.json({message: "error", details: "database error"})
    }

});


app.post('/resetPasswordByResetingAccount', async (req, res) => {
    const {password, userId } = req.body; // récupérer les données du formulaire de réinitialisation de mot de passe

    const sql = "UPDATE users SET password = ? WHERE id = ?";
    const hashePwd = await bcrypt.hash(password, 10);

    try {
        await db.query(sql, [hashePwd, userId]);
        return res.json({message: "success", details: "password reseted"})
    }
    catch(err){
        return res.json({message: "error", details: "database error"})
    }
});


app.get("/getConversations/:userID", async (_, res) => {
    // récupérer l'id de l'utilisateur depuis les paramètres de la requête l'id est celui qui l'a obtenu dans la bdd
    const {userID} = req.params; 
    const sql = "SELECT * FROM conversation.*, message.* JOIN message ON conversationId = message.id ORDER BY conversationId DESC WHERE participant1 = ? OR participant2 = ?";

    try {
        const result = await db.query(sql, [userID, userID]);
        return res.json({message: "success", data: result})
    }
    catch(err){
        return res.json({message: "error", details: "database error"})
    }
});

app.get("/getConversation/:id", async (req, res) => {
    const {id} = req.params;
    const sql = "SELECT * FROM message ORDER BY timedate DESC WHERE conversationId = ?";

    try {
        const result = await db.query(sql, [id]);
        const messages = result.map(message => {
            return {
                id: message.messageId,
                content: decrypt(message.content, Buffer.from(message.iv, "hex")),
                sender: message.sender,
                timedate: message.timedate
            }
        })
        return res.json({message: "success", data: result})
    }
    catch (err) {
        return res.json({message: "error", details: "database error"})
    }
});

app.post("/serachUser", async(req, res) => {
    const {userId} = req.body;
    const sql = "SELECT * FROM users WHERE email = ? OR phoneNumber = ?";

    try {
        const user = await db.query(sql, [userId, userId])
        user.lenght == 0 && res.json({message: "not found"})

        return res.json({message: "sucess", data: user})
    }

    catch (err) {
        res.json({message: "error"})
    }
});

app.post("/updateProfile", uploadProfilPhoto.single("newPhoto"), async)




intiDb()
.then(server.listen(port, () => console.log("server is running on port: " + port)))
.catch((err) => console.log(err))


