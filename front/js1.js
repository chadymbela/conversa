    // si nous sommes sur la page de connexion et l'utilisateur saisie  ses informations de connexion on recuper les information
   const backend = "http://localhost:3005"
    const socket = io(`${backend}`)
   
   
    var form_connexion = document.getElementById("form_connexion");
       if(form_connexion){
         form_connexion.addEventListener("submit", function(e){
            var tel_conn = document.getElementById("telephone").value;
            var mdp_conn = document.getElementById("mdp").value;
            if(tel_conn){
                if(mdp_conn){
                    e.preventDefault();

                   socket.emit("login", {tel_conn, mdp_conn}, (response) => {
                    response.message !== "sucess" &&  alert("Identifiant ou mot de passe incorrect") 

                    if (response.message === "success") {
                        localStorage.setItem("utilisateur", JSON.stringify(response.data));
                        window.location.href = "conversation.html";
                    }
                    document.getElementById("telephone").value = "";
                    document.getElementById("mdp").value = "";
                    
                   })
                    
                }else{
                    e.preventDefault();
                    document.getElementById("div_p").style.display = "flex";
                    document.getElementById("p").textContent="le champ mot de passe est vide";
                }
            }else{
                e.preventDefault();
                document.getElementById("div_p").style.display = "flex";
                document.getElementById("p").textContent="le champ téléphone est vide";
            }
        })
       }




//------------------___________ les etapes pour la creation du compte ________________--------------------
//----------____________etape 1____ on assure que les champs ne sont pas vide, on recupere les données et nous redirige sur l'etape 2_________-------------
    const form1 = document.getElementById("form1");
    if(form1){
         form1.addEventListener("submit", function(e){
            var nom = document.getElementById("nom").value;
            var prenom = document.getElementById("prenom").value;
          if(nom){
            if(prenom){
               e.preventDefault();
               localStorage.getItem("nom", nom);
               localStorage.getItem("prenom", prenom);
               location.href="signup2.html";

            }else{
                 e.preventDefault();
                document.getElementById("div_p").style.display = "flex";
                document.getElementById("p").textContent="le champ prenom est vide";
            }
          }else{
                e.preventDefault();
                document.getElementById("div_p").style.display = "flex";
                document.getElementById("p").textContent="le champ nom est vide";
          }
        })
    }

//-----------____________ etape 2_____ on assure que les champs ne sont pas vide, on recupere les données et nous redirige sur l'etape 3__________---------

    const form2 = document.getElementById("form2");
    if(form2){
        form2.addEventListener("submit", function(e){
            let email = document.getElementById("email_ins").value;
            let tel = document.getElementById("tel_ins").value;
            if(email){
                if(tel){
                    e.preventDefault();
                    localStorage.getItem("email", email);
                    localStorage.getItem("tel", tel);
                    location.href="signup3.html";

                }else{
                     e.preventDefault();
                    document.getElementById("div_p").style.display = "flex";
                    document.getElementById("p").textContent="le champ téléphone est vide";
                }

            }else{
                 e.preventDefault();
                document.getElementById("div_p").style.display = "flex";
                document.getElementById("p").textContent="le champ email est vide";
            }
            
        })

    }

//_____________-------------étape 3 ------ on assure que les champs ne sont pas vide, on recupere les données et nous redirige sur l'etape 4-------------______________________

const form3 = document.getElementById("form3")
    if(form3){
        form3.addEventListener("submit", function(e){
            let sexe = document.getElementById("sexe").value;
            let date_naissance = document.getElementById("date_naissance").value;
            if(sexe){
                if(date_naissance){
                    e.preventDefault();
                    localStorage.getItem("sexe", sexe);
                    localStorage.getItem("date_naissance", date_naissance);
                    location.href="signup4.html";

                }else{
                     e.preventDefault();
                    document.getElementById("div_p").style.display = "flex";
                    document.getElementById("p").textContent="le champ date de naissance est vide";
                }

            }else{
                 e.preventDefault();
                document.getElementById("div_p").style.display = "flex";
                document.getElementById("p").textContent="le champ sexe est vide";
            }
            
        })

    }
//____________----------------étape 4 ----------_____on assure que les champs ne sont pas vide, on recupere les données et nous redirige sur l'etape 5____________

const form4 = document.getElementById("form4");
    if(form4){
            form4.addEventListener("submit", function(e){
                
                let mdp1 = document.getElementById("mdp1").value;
                let mdp2 = document.getElementById("mdp2").value;
                
                if(mdp1 && mdp1.length >= 6){
                    if(mdp2){
                        if(mdp1 === mdp2){
                            e.preventDefault();
                            localStorage.getItem("mdp", mdp1);
                            location.href="signup5.html";

                        }else{
                            e.preventDefault();
                            document.getElementById("div_p").style.display = "flex";
                            document.getElementById("p").textContent="le mot de passe doit étre identique pour comfirmer";
                        }
                    }else{
                        e.preventDefault();
                        document.getElementById("div_p").style.display = "flex";
                        document.getElementById("p").textContent="repetez le meme mot de passe pour comfirmer";
                    }
                }else{
                    e.preventDefault();
                    document.getElementById("div_p").style.display = "flex";
                    document.getElementById("p").textContent="Créez un mot de passe pour la securité votre compte.\nLe mot de passe doit contenir aumoin 6 caracteires";
                }

            })
    }
 //------------_______________ étape 5 ________on assure que les champs ne sont pas vide, on recupere les données, on insert les données dans la base de données, on garde la session puis ons e diri ____________-----------------------
 const form5 = document.getElementById("form5");
    if(form5){
        form5.addEventListener("submit", function(e){
            let answerOne = document.getElementById("qst1").value;
            let answerTwo = document.getElementById("qst2").value;
            let answerThree = document.getElementById("qst3").value;

            if(qst1 && qst2 && qst3){
                e.preventDefault();

               const lastName = localStorage.getItem("nom");
               const firstName = localStorage.getItem("prenom");
               const email = localStorage.getItem("email");
               const phoneNumber = localStorage.getItem("tel");
               const sexe = localStorage.getItem("sexe");
               const birthDate = localStorage("date_naissance");
               const password = localStorage.getItem("mdp");

               const data = {answerOne, answerTwo, answerThree, lastName, firstName, email, phoneNumber, sexe, birthDate, password }

               socket.emit("signup", data, (response) => {
                response.message !== "success" && alert("Une erreur est survenue")

                if(response.message === "success") {
                    localStorage.setItem("utilisateur", JSON.stringify(response.data));
                     window.location.href = "conversation.html";
                }
               })
               


            }else{
                e.preventDefault();
                document.getElementById("div_p").style.display = "flex";
                document.getElementById("p").textContent="répondez à toutes les quetions, ça vous permettra de tequiperer votre mot de passe en cas de perte";
                
            }
        })
    }

//___________---------------recuperation du mot de passe ------------_______________________

const formmdp = document.getElementById("formmdp");
    if(formmdp){
        formmdp.addEventListener("submit", function(e){
            let qst1 = document.getElementById("qst1_recuperation").value;
            let qst2 = document.getElementById("qst2_recuperation").value;
            let qst3 = document.getElementById("qst3_recuperation").value;
            if(qst1 && qst2 && qst3){
                e.preventDefault(); 
                //ici on teste les reponses avec celles de la base de données
                // toutes les reponses sont correcte on redirige l'utilisateur à la page << nouveaumdp.html >> pour recréer un nouveau mdp 

            }else{
                e.preventDefault();
                document.getElementById("div_p").style.display = "flex";
                document.getElementById("p").textContent="répondez corectement à toutes les quetions et soumettez ";
            }
        })
    }

//_______________--------------------- création de nouveau mdp -------------------______________________________
const form_nouveaumdp = document.getElementById("form_nouveaumdp");
    if(form_nouveaumdp){
            form4.addEventListener("submit", function(e){
                
                let mdp1 = document.getElementById("nouveaumdp").value;
                let mdp2 = document.getElementById("comfirmemdp").value;
                
                if(mdp1 && mdp1.length >= 6){
                    if(mdp2){
                        if(mdp1 === mdp2){
                            e.preventDefault();
                            // ici on recuper le mot de passe et on reunitialise.

                        }else{
                            e.preventDefault();
                            document.getElementById("div_p").style.display = "flex";
                            document.getElementById("p").textContent="le mot de passe doit étre identique pour comfirmer";
                        }
                    }else{
                        e.preventDefault();
                        document.getElementById("div_p").style.display = "flex";
                        document.getElementById("p").textContent="repetez le meme mot de passe pour comfirmer";
                    }
                }else{
                    e.preventDefault();
                    document.getElementById("div_p").style.display = "flex";
                    document.getElementById("p").textContent="Créez un mot de passe pour la securité votre compte.\nLe mot de passe doit contenir aumoin 6 caracteires";
                }

            })
    }