// on utilise deux express tout seul pour les routes api ancienne aunilatéral et on utilise socket.io pour la communication en temps réel dans cette app

const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const http = require("http");
const {Server} = require("socket.io");
const mysql = require("mysql2");
const multer = require("multer");
const { useId } = require("react");

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
        cb(null, file.originalname);
    }
});
const uploadProfilPhoto = multer({ storage: diskstorage });



// initialisation et lancement de l'utisation de notre serveur en temps réel
io.on("connection", (socket) => {

});

// c'est la route pour la connextion de l'utilisateur 
app.post("/login", async (req, res) => {

    // on récupère les données de l'utilisateur et userId peut etre le numéro de téléphone ou l'email de l'utilisateur
    const { userId, password } = req.body;
    const sql = "SELECT * FROM users WHERE email = ? OR phoneNumber = ?"
    
    // on vérifie si l'utilisateur existe dans la base de données
    try {
        const result = await db.query(sql, [userId, userId]);
        // si l'utilisateur n'existe pas on renvoie un message d'erreur
        result.lenght < 0 && res.json({ message: "username or password incorrect", details: "username or password incorrect" })
        
        // si l'utilisateur existe on vérifie si le mot de passe est correct
        const match = await bcrypt.compare(password, result[0].password)
    
        // si le mot de passe est correct on renvoie les données de l'utilisateur au cas contraire on renvoie un message d'erreur 
        return match ? res.json({ message: "success", data: result[0] }) : res.json({ message: "username or password incorrect"})
    }
    // si il y a une erreur on renvoie un message d'erreur
    catch (err) {
        res.json({message: "error", details: "database error"})
    }
    

});


app.post("signup", async (req, res) => {
    // on recupère les données du formulaire venant de l'utilisateur et on les stocke dans des variables
    const {email, phoneNumber, password, firstName, lastName, birthDate, sexe, answerOne, answerTwo, answerThree} = req.body;

    // on vérifie si l'utilisateur existe déjà
    const chechSql = "SELECT * FROM users WHERE email = ? OR phoneNumber = ?"
    try {
        const userExist = await db.query(chechSql, [email, phoneNumber])
        userExist.lenght > 0 && res.json({message: "error", details: "user already exist"}) 
        // s'il n'existe pas on l'ajoute à la base de données par la fonction addUser()
        return addUser();
    }
    catch (err) {
        // si il y a une erreur on renvoie un message d'erreur
        res.json({message: "error", details: "database error"})
    }


    async function addUser() {
        // on prépare la requête SQL pour l'insertion des données
        const sql = "INSERT INTO users (email, phoneNumber, password, firstName, lastName, birthDate, sexe, answerOne, answerTwo, answerThree) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        // on exécute la requête SQL avec les données de l'utilisateur
       
        try {
            const result = await db.query(sql, [email, phoneNumber, password, firstName, lastName, birthDate, sexe, answerOne, answerTwo, answerThree]);

            // si l'insertion est réussie, on renvoie un message de succès avec les données de l'utilisateur en y ajoutant le Id qu'il recevra de la bdd
            return res.json({message: "success", data: {userId: result.insertId, email, phoneNumber, firstName, lastName, birthDate, sexe, answerOne, answerTwo, answerThree}})
        }
        catch (err) {
            // si l'insertion échoue, on renvoie un message d'erreur
            res.json({message: "error", details: "database error"})
        }

    }
});


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
    const sql = "SELECT * FROM conversation ORDER BY conversationId DESC WHERE participant1 = ? OR participant2 = ?";

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
    const sql = "SELECT * FROM message WHERE conversationId = ?";

    try {
        const result = await db.query(sql, [id]);
        return res.json({message: "success", data: result})
    }
    catch (err) {
        return res.json({message: "error", details: "database error"})
    }
});




intiDb()
.then(server.listen(port, () => console.log("server is running on port: " + port)))
.catch((err) => console.log(err))


