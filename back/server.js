// on utilise deux express tout seul pour les routes api ancienne aunilatéral et on utilise socket.io pour la communication en temps réel dans cette app

const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const http = require("http");
const {Server} = require("socket.io");
const mysql = require("mysql2");
const multer = require("multer");

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
    // on récupère les données de l'utilisateur
    const { email, password } = req.body;
    const sql = "SELECT * FROM users WHERE email = ? OR phoneNumber = ?"
    
    // on vérifie si l'utilisateur existe dans la base de données
    try {
        const result = await db.query(sql, [email, email])
        // si l'utilisateur n'existe pas on renvoie un message d'erreur
        result.lenght < 0 && res.json({ message: "username or password incorrect", details: "username or password incorrect" })
        
        // si l'utilisateur existe on vérifie si le mot de passe est correct
        const match = await bcrypt.compare(password, result[0].password)
    
        // si le mot de passe est correct on renvoie les données de l'utilisateur au cas contraire on renvoie un message d'erreur 
        match ? res.json({ message: "success", data: result[0] }) : res.json({ message: "username or password incorrect"})
    }
    // si il y a une erreur on renvoie un message d'erreur
    catch (err) {
        res.json({message: "error", details: "database error"})
    }
    

});


app.post("signup", async (req, res) => {
    // on recupère les données du formulaire venant de l'utilisateur et on les stocke dans des variables
    const {email, phoneNumber, password, firstName, lastName, birthDate, sexe, answerOne, answerTwo, answerThree} = req.body;

    const chechSql = "SELECT * FROM users WHERE email = ? OR phoneNumber = ?"
    try {
        const userExist = await db.query(chechSql, [email, phoneNumber])
        userExist.lenght > 0 && res.json({message: "error", details: "user already exist"}) 
    }
    catch (err) {
        res.json({message: "error", details: "database error"})
    }


    function addUser() {
        const sql = "INSERT INTO users (email, phoneNumber, password, firstName, lastName, birthDate, sexe, answerOne, answerTwo, answerThree) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
       
        try {

        }
        catch (err) {
            res.json({message: "error", details: "database error"})
        }

    }
});




intiDb()
.then(server.listen(port, () => console.log("server is running on port: " + port)))
.catch((err) => console.log(err))


