// on utilise deux express tout seul pour les routes api ancienne aunilatéral et on utilise socket.io pour la communication en temps réel dans cette app

const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const http = require("http");
const {Server} = require("socket.io");
const mysql = require("mysql2/promise");
const multer = require("multer");
const NodeCache = require("node-cache");
const cache = new NodeCache();
const crypto = require("crypto");
const path = require("path");
const cryptoKey = Buffer.from(process.env.CRYPTO_KEY, "hex");
const fs = require("fs");
const bcrypt = require("bcrypt");

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
        port: process.env.DB_PORT
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

const messageFileStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "messageFiles");
    },
    filename: function (req, file, cb) {
        const {conversationId, userId} = req.body;
        // on utilise le participantId pour savoir à qui appartient le fichier
        cb(null, Date.now() + "_" + conversationId + "_" + userId + path.extname(file.originalname));
    }
})

const uploadMessageFile = multer({ storage: messageFileStorage });


function encrypt(text, iv) {
    let cipher = crypto.createCipheriv('aes-256-cbc', cryptoKey, iv);
    let encrypted = cipher.update(text, "utf8","hex");
    encrypted += cipher.final("hex");
    return encrypted;
};


function decrypt(text, iv) {
    // on utilise le même iv que celui utilisé pour chiffrer le texte
    // on utilise le même cryptoKey que celui utilisé pour chiffrer le texte
    iv = Buffer.from(iv, "hex");
    // on crée un objet de déchiffrement avec le même algorithme, la même clé et le même iv

    let decipher = crypto.createDecipheriv('aes-256-cbc', cryptoKey, iv);
    let decrypted = decipher.update(text, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
};


function addUserSocketId(userId, socketId) {
    // on ajoute l'id de la socket à la liste des sockets de l'utilisateur dans node-cache
    const userSockets = cache.get("userConnected") || [];
    if(!userSockets.filter(user => user.userId === userId && user.socketId === socketId)) {
        userSockets.push({userId, socketId});
        cache.set("userConnected", userSockets);
    }
};

function removeUserSocketId(socketId) {
    // on supprime l'id de la socket de la liste des sockets de l'utilisateur dans node-cache
    const userSockets = cache.get("userConnected") || [];
    const newUserSockets = userSockets.filter(user => !(user.socketId === socketId));
    cache.set("userConnected", newUserSockets);
};

function getUserSocketIds(userId) {
    // on récupère la liste des sockets de l'utilisateur dans node-cache
    const userSockets = cache.get("userConnected") || [];
    return userSockets.filter(user => user.userId === userId).map(user => user.socketId);
};


// initialisation et lancement de l'utisation de notre serveur en temps réel
io.on("connection", (socket) => {

    // quand l'utilisateur se connecte
    socket.on("login", async(data, callback) => {
        const response = await login(data);
        if (response.message === "success") {
            addUserSocketId(response.data.id, socket.id);
            io.emit("userConnected", { userId: response.data.id, socketId: socket.id });
        }
        callback(response);

    })

    // quand l'utilisateur crée un compte
    socket.on("signup", async (data, callback) =>{
        const response = await signup(data);
        if (response.message === "success") {
            addUserSocketId(response.data.userId, socket.id);
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
            
            const socketIds = getUserSocketIds(data.participantId);
            socketIds.forEach((socketId) => {
                io.to(socketId).emit("newMessageText", data); // on emet le message à l'utilisateur concerné
            })
            callback({ message: "success" });

        }
        catch (err) {
            return callback({ message: "error" })
        }
    });

    socket.on("deleteMessageText", async (data, callback) =>{
        try {
            const sql = "DELETE FROM message WHERE messageId = ?";
            await db.query(sql, [data.messageId]);

            const socketIds = getuserSocketIds(data.participantId);
            
            socketIds.forEach((socketId) => {
                io.to(socketId).emit("messageDeleted", data);
            })

            callback({ message: "success" });
        }
        catch (err) {
            return callback({ message: "error" })
        }
    });

    socket.on("deleteMessageFile", async (data, callback) =>{
        try {
            const sql = "DELETE FROM message WHERE messageId = ?";
            await db.query(sql, [data.messageId]);

            // on supprime le fichier du disque
            const filePath = path.join(__dirname, "messageFiles", data.fileName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            const socketIds = getuserSocketIds(data.participantId);
            
            socketIds.forEach((socketId) => {
                io.to(socketId).emit("messageFileDeleted", data);
            })

            callback({ message: "success" });
        }
        catch (err) {
            return callback({ message: "error" })
        }
    });

    socket.on("editMessageText", async (data, callback) =>{
        try {
            const iv = crypto.randomBytes(16);
            const newContentEncrypted = encrypt(data.messageContent, iv);
            const sql = "UPDATE message SET messageContent = ? WHERE messageId = ?";
            await db.query(sql, [newContentEncrypted, data.messageId]);
            
            const socketIds = getuserSocketIds(data.participantId);

            socketIds.forEach((socketId) => {
                io.to(socketId).emit("messageEdited", data);
            })

            callback({ message: "success" });
        }
        catch (err) {
            return callback({ message: "error" })
        }
    });

    socket.on("disconnect", () => {
        // quand l'utilisateur se déconnecte on supprime son id de la liste des sockets de l'utilisateur dans node-cache
        removeUserSocketId(socket.id);
    }
    
);

});

app.post("/sendMessageFile", uploadMessageFile.single("file"), async (req, res) => {
    const {userId, conversationId, fileType} = req.body;
    const file = req.file.filename;
    const timedate = new Date().toLocaleString();
    const iv = crypto.randomBytes(16);
    const stockableIv = iv.toString("hex");
    const sql = "INSERT INTO message (messageContent, messageType, sender, conversation, iv, timedate) VALUES (?, ?, ?, ?, ?, ?)";

    try{
        const encryptedFile = encrypt(file, iv);
        await db.query(sql, [encryptedFile, fileType, userId, conversationId, stockableIv, timedate]);

        // on envoie le message à tous les utilisateurs de la conversation
        const socketIds = getuserSocketIds(userId);
        socketIds.forEach((socketId) => {
            io.to(socketId).emit("newMessageFile", {messageContent: file, messageType: fileType, userId, conversationId, iv, timedate});
        });

        return res.json({message: "success"});
    }
    catch (err) {
        return res.json({ message: "error" , details: "database error" });
    }

});


async function login(body) {
    // on récupère les données de l'utilisateur et userId peut etre le numéro de téléphone ou l'email de l'utilisateur
    const { userId, password } = body;
    const sql = "SELECT * FROM users WHERE email = ? OR phoneNumber = ?";
    
    // on vérifie si l'utilisateur existe dans la base de données
    try {
        const [result] = await db.query(sql, [userId, userId]);
        // si l'utilisateur n'existe pas on renvoie un message d'erreur
        if(result.length === 0)  return { message: "username or password incorrect", details: "username or password incorrect  "} 
        
        // si l'utilisateur existe on vérifie si le mot de passe est correct
        let match;
        try {
            match = await bcrypt.compare(password, result[0].password)
        }
        catch (err) {
            // si il y a une erreur lors de la comparaison des mots de passe on renvoie un message d'erreur
            return { message: "error", details: "password comparison error"  + "_  " + err.message }
        }
    
        // si le mot de passe est correct on renvoie les données de l'utilisateur au cas contraire on renvoie un message d'erreur 
        const connectedUser = { message: "success", data: result[0] };
        const userNotFound = { message: "error", details: "username or password incorrect" };
        return match ? connectedUser : userNotFound;
    }
    // si il y a une erreur on renvoie un message d'erreur
    catch (err) {
        return {message: "error", details: "database error" + "_  " + err.message}
    }
    
};



async function signup(body) {
    // on recupère les données du formulaire venant de l'utilisateur et on les stocke dans des variables
    const {email, phoneNumber, password, firstName, lastName, birthDate, sexe, answerOne, answerTwo, answerThree} = body;
    

    // on vérifie si l'utilisateur existe déjà
    const chechSql = "SELECT * FROM users WHERE email = ? OR phoneNumber = ?"
    try {
        const [userExist] = await db.query(chechSql, [email, phoneNumber])
        if(userExist.length > 0)  {
            return {message: "error", details: "user already exist"}
        }
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
            const hashedPassword = await bcrypt.hash(password, 10); // on hash le mot de passe avant de l'insérer dans la base de données

            const [result] = await db.query(sql, [email, phoneNumber, hashedPassword, firstName, lastName, birthDate, sexe, answerOne, answerTwo, answerThree]);

            // si l'insertion est réussie, on renvoie un message de succès avec les données de l'utilisateur en y ajoutant le Id qu'il recevra de la bdd
            return {message: "success", data: login({userId: email, password})};
        }
        catch (err) {
            // si l'insertion échoue, on renvoie un message d'erreur
            return {message: "error", details: "database error"}
        }

    }
};


app.post("reset", async (req, res) => {
    // on récupère les données du formulaire et le userId peut être le numéro de téléphone ou l'email
   const {userId, answerOne, answerTwo, answerThree} = req.body;

    // on vérifie que l'utilisateur au travers de l'userId existe bien dans la bdd et que les réponses sont correctes
    const sql = "SELECT * FROM users WHERE (email = ? OR phoneNumber = ?) AND answerOne = ? AND answerTwo = ? AND answerThree = ?";

    try {
        const [result] = await db.query(sql, [userId, userId, answerOne, answerTwo, answerThree]);

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
        const [result] = await db.query(sql, [userID, userID]);
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
        const [ result] = await db.query(sql, [id]);
        const messages = result.map(message => {
            return {
                id: message.messageId,
                content: decrypt(message.messageContent, Buffer.from(message.iv, "hex")),
                sender: message.sender,
                timedate: message.timedate
            }
        })
        return res.json({message: "success", data: messages})
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
        user.length == 0 && res.json({message: "not found"})

        return res.json({message: "sucess", data: user})
    }

    catch (err) {
        res.json({message: "error"})
    }
});

app.post("/updateProfile", uploadProfilPhoto.single("newPhoto"), async(req, res) => {
    const {userId} = req.body;
    const newPhoto = req.file ? req.file.filename : null; // si l'utilisateur n'a pas envoyé de nouvelle photo, on garde l'ancienne
    const sql = "UPDATE users SET profile = ? WHERE userId = ?";

    try{
        if (!newPhoto) {
            return res.json({message: "error", details: "no photo provided"});
        }
        // on met à jour la photo de profil de l'utilisateur dans la base de données
        await db.query(sql, [newPhoto, userId]);
        io.emit("profileUpdated", {userId, newPhoto}); // on émet un événement pour informer les autres utilisateurs que la photo de profil a été mise à jour
        return res.json({message: "success", data: {userId, newPhoto}})
    }
    catch (err) {
        res.json({message: "error", details: "database error"});
    }

});

app.post("/updatePassword", async (req, res) => {
    const {userId, oldPassword, newPassword} = req.body;
    const sql = "SELECT * FROM users WHERE userId = ?";

    try {
        const user = await db.query(sql, [userId]);
        if (user.length === 0) {
            return res.json({message: "error", details: "user not found"});
        }

        const match = await bcrypt.compare(oldPassword, user[0].password);
        if (!match) {
            return res.json({message: "error", details: "old password is incorrect"});
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        const updateSql = "UPDATE users SET password = ? WHERE userId = ?";
        await db.query(updateSql, [hashedNewPassword, userId]);

        return res.json({message: "success", details: "password updated successfully"});
    }
    catch (err) {
        return res.json({message: "error", details: "database error"});
    }
});

app.post("/updateOtherInfo", async (req, res) => {
    const {userId, info, value} = req.body;
    const sql = "UPDATE users SET ?? = ? WHERE userId = ?";


    try {
        await db.query(sql, [info, value, userId]);
        // on émet un événement pour informer les autres utilisateurs que les informations de l'utilisateur ont été mises à jour
        io.emit("otherInfoUpdated", {userId, info, value});
        return res.json({message: "success", details: "info updated successfully"});
    }
    catch (err) {
        return res.json({message: "error", details: "database error"});
    }
});




intiDb()
.then(server.listen(port, () => console.log("server is running on port: " + port)))
.catch((err) => console.log(err))


