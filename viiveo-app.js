<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Application Prestataire</title>
    <style>
        /* CSS Minimaliste pour que le code fonctionne */
        body { font-family: Arial, sans-serif; padding: 20px; }
        .error-message { color: red; }
        .viiveo-missions { margin-top: 30px; border-top: 1px solid #ccc; padding-top: 20px; }
        .viiveo-missions { display: none; } /* Caché par handleLogin */
        #global-loader { display: none; margin: 20px; font-weight: bold; }
        .missions-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .missions-table th, .missions-table td { border: 1px solid #ccc; padding: 8px; text-align: left; }
        .actions button { margin: 0 5px; cursor: pointer; border: none; background: none; font-size: 1.2em; }
    </style>
</head>
<body>

    <div class="viiveo-login">
        <h2>Connexion Prestataire</h2>
        <form id="loginForm">
            <div>
                <label for="email">Email :</label>
                <input type="email" id="email" required>
            </div>
            <div>
                <label for="password">Mot de passe :</label>
                <input type="password" id="password" required>
            </div>
            <button type="submit" class="viiveo-login button">Se connecter</button>
            <p id="message" style="color:red;"></p>
        </form>
        <div id="loader" style="display:none;">Connexion en cours...</div>
    </div>


    <div class="viiveo-missions">
        <h2>Vos Missions</h2>
        <div id="global-loader">Chargement des missions en cours...</div>
        
        <div id="main-missions-display" style="display:none;">
            
            <h3>Missions en Attente</h3>
            <div id="missions-attente"></div>

            <h3>Missions À Venir (Validées)</h3>
            <div id="missions-a-venir"></div>

            <h3>Missions En Cours</h3>
            <div id="missions-en-cours"></div>

            <h3>Missions Terminées/Clôturées</h3>
            <div id="missions-terminees"></div>
        </div>
    </div>
    
    <div id="modals-container"></div>


    <script>
        // =================================================================
        // Fonctions Utilitaires Manquantes (Doivent être définies)
        // =================================================================
        window.webAppUrl = "https://api.votreapp.com/endpoint"; // **À REMPLIR**
        window.currentEmail = ""; 

        // Exemple des fonctions utilitaires manquantes (à adapter) :
        window.show = (element, state) => { 
            if (element) element.style.display = state ? 'block' : 'none'; 
        };
        window.setPrestataireData = (email, prenom, nom) => {
            window.currentEmail = email; // IMPORTANT
            console.log(`Données prestataire enregistrées : ${prenom} ${nom} (${email})`);
        };
        // Ces fonctions sont appelées par le script, vous devez les implémenter :
        // function createAndInjectModalHtml() { /* ... */ } 
        // function initializeModalListeners() { /* ... */ }
        // function openModalStartPrestation(id, prenom, nom) { /* ... */ } 
        // function openModalCloturerPrestation(id, prenom, nom) { /* ... */ } 
        // function tempDisable(button, duration) { /* ... */ } 

        // =================================================================
        // Le Code Principal Corrigé
        // =================================================================

        window.handleLogin = async function() {
            console.log("LOGIN: Fonction handleLogin() appelée.");
            const email = document.getElementById("email")?.value.trim();
            const password = document.getElementById("password")?.value.trim();
            const message = document.getElementById("message");
            const loader = document.getElementById("loader");
            const form = document.querySelector(".viiveo-login");
            const missionsBlock = document.querySelector(".viiveo-missions");

            if (!email || !password) {
                if (message) message.textContent = "Champs requis.";
                console.log("LOGIN: Champs email/password requis.");
                return;
            }
            if (message) message.textContent = "";
            window.show(loader, true);
            // tempDisable(document.querySelector(".viiveo-login button"), 3000); 
            console.log("LOGIN: Tentative de connexion avec email:", email);

            try {
                const callbackName = 'cbLogin' + Date.now();
                if (!window.webAppUrl) {
                    console.error("LOGIN ERROR: window.webAppUrl n'est pas défini !");
                    if (message) message.textContent = "Erreur de configuration: URL de l'application manquante.";
                    return;
                }
                const url = `${window.webAppUrl}?type=loginpresta&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
                console.log("LOGIN: URL d'API générée:", url);
                const data = await window.callApiJsonp(url, callbackName);
                console.log("LOGIN: Réponse de l'API de login:", data);
                if (!data.success) {
                    if (message) message.textContent = data.message || "Connexion échouée.";
                    console.log("LOGIN: Connexion échouée. Message:", data.message);
                    return;
                }

                window.setPrestataireData(data.email, data.prenom, data.nom);

                window.show(form, false);
                window.show(missionsBlock, true);
                await window.loadMissions(window.currentEmail); 
                console.log("LOGIN: Missions chargées après connexion réussie.");
            } catch (err) {
                if (message) message.textContent = "Erreur serveur ou réseau.";
                console.error("LOGIN ERROR: Erreur dans la fonction handleLogin():", err);
            } finally {
                window.show(loader, false);
                console.log("LOGIN: Fonction handleLogin() terminée.");
            }
        };

        window.loadMissions = async function(emailToLoad) {
            const contAttente = document.getElementById("missions-attente");
            const contAvenir = document.getElementById("missions-a-venir");
            const contEnCours = document.getElementById("missions-en-cours");
            const contTerminees = document.getElementById("missions-terminees");
            const mainMissionsDisplay = document.getElementById("main-missions-display");
            const globalLoader = document.getElementById("global-loader");

            if (!contAttente || !contAvenir || !contEnCours || !contTerminees || !mainMissionsDisplay || !globalLoader) {
                console.error("LOAD MISSIONS ERROR: Un ou plusieurs conteneurs de missions/loader sont introuvables dans le DOM.");
                alert("Erreur d'affichage : Impossible de trouver tous les éléments de l'interface.");
                return;
            }

            globalLoader.style.display = 'block';
            mainMissionsDisplay.style.display = 'none';

            contAttente.innerHTML = "Chargement...";
            contAvenir.innerHTML = "Chargement...";
            contEnCours.innerHTML = "Chargement...";
            contTerminees.innerHTML = "Chargement...";

            try {
                const callbackName = 'cbMissions' + Date.now();
                if (!window.webAppUrl) {
                    console.error("LOAD MISSIONS ERROR: window.webAppUrl n'est pas défini !");
                    alert("Erreur de configuration: URL de l'application manquante pour charger les missions.");
                    globalLoader.style.display = 'none';
                    mainMissionsDisplay.innerHTML = "<p class='error-message'>Erreur de configuration: URL de l'application manquante.</p>";
                    mainMissionsDisplay.style.display = 'block';
                    return;
                }

                const url = `${window.webAppUrl}?type=missionspresta&email=${encodeURIComponent(emailToLoad)}`;
                console.log("LOAD MISSIONS: URL d'API générée:", url);
                const data = await window.callApiJsonp(url, callbackName);
                console.log("LOAD MISSIONS: Réponse de l'API des missions:", data);

                if (!data.success || !Array.isArray(data.missions)) {
                    alert("Erreur lors du chargement des missions.");
                    console.warn("LOAD MISSIONS: Données de missions invalides ou échec.", data);
                    globalLoader.style.display = 'none';
                    mainMissionsDisplay.innerHTML = `<p class='error-message'>${data.message || 'Erreur lors du chargement des missions.'}</p>`;
                    mainMissionsDisplay.style.display = 'block';
                    return;
                }

                const missions = data.missions;
                const missionsAttente = missions.filter(m => m.statut && String(m.statut).toLowerCase() === "en attente");
                const missionsValidees = missions.filter(m => m.statut && (String(m.statut).toLowerCase() === "confirmée" || String(m.statut).toLowerCase() === "validée"));
                const missionsEnCours = missions.filter(m => m.statut && String(m.statut).toLowerCase() === "en cours");
                const missionsTerminees = missions.filter(m => m.statut && (String(m.statut).toLowerCase() === "terminée" || String(m.statut).toLowerCase() === "clôturée"));

                contAttente.innerHTML = renderTable(missionsAttente, 'attente');
                contAvenir.innerHTML = renderTable(missionsValidees, 'validee');
                contEnCours.innerHTML = renderTable(missionsEnCours, 'enCours');
                contTerminees.innerHTML = renderTable(missionsTerminees, 'terminee');

                attachMissionButtonListeners(); 

                globalLoader.style.display = 'none';
                mainMissionsDisplay.style.display = 'block';

                console.log("LOAD MISSIONS: Tableaux de missions rendus et écouteurs attachés avec succès.");

            } catch (e) {
                alert("Erreur serveur lors du chargement des missions.");
                console.error("LOAD MISSIONS ERROR: Erreur dans loadMissions():", e);
                globalLoader.style.display = 'none';
                mainMissionsDisplay.innerHTML = `<p class='error-message'>Erreur lors du chargement des missions: ${e.message}</p>`;
                mainMissionsDisplay.style.display = 'block';
            }
        };

        function renderTable(missions, type = "") {
            if (!missions.length) return "<p>Aucune mission.</p>";
            let html = `<table class="missions-table"><thead><tr><th>ID</th><th>Client</th><th>Adresse</th><th>Service</th><th>Date</th><th>Heure</th>`;
            if (type === "attente" || type === "validee" || type === "enCours") {
                html += "<th>Actions</th>";
            }
            html += "</tr></thead><tbody>";

            missions.forEach(m => {
                let formattedHeure = "N/A";
                let displayDate = "Date inconnue";

                if (m.date) {
                    const parts = String(m.date).split('/');
                    let isoDate = String(m.date);

                    if (parts.length === 3) {
                        isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`; 
                    }

                    try {
                        const dateObj = new Date(isoDate);
                        if (!isNaN(dateObj.getTime())) {
                            displayDate = dateObj.toLocaleDateString('fr-FR');
                        }
                    } catch (e) {
                        console.warn("Erreur de parsing de la date pour la mission", m.id, e);
                    }

                    if (m.heure) {
                        try {
                            const dateTimeString = `${isoDate}T${m.heure}`; 
                            const fullDate = new Date(dateTimeString);
                            if (!isNaN(fullDate.getTime())) {
                                formattedHeure = `${String(fullDate.getHours()).padStart(2, '0')}h${String(fullDate.getMinutes()).padStart(2, '0')}`;
                            } else {
                                const hourMinute = String(m.heure).split(':');
                                if (hourMinute.length >= 2) {
                                    formattedHeure = `${hourMinute[0].padStart(2, '0')}h${hourMinute[1].padStart(2, '0')}`;
                                } else {
                                    console.warn("Failed to parse full date/time for mission", m.id, dateTimeString);
                                }
                            }
                        } catch (e) {
                            console.warn("Erreur de parsing de l'heure pour la mission", m.id, e);
                        }
                    }
                }

                const clientName = m.client && String(m.client).trim() !== "" ? String(m.client) : "Client inconnu";

                html += `<tr>
                    <td data-label="ID">${m.id || 'N/A'}</td>
                    <td data-label="Client">${clientName}</td>
                    <td data-label="Adresse">${m.adresse || 'N/A'}</td>
                    <td data-label="Service">${m.service || 'N/A'}</td>
                    <td data-label="Date">${displayDate}</td>
                    <td data-label="Heure">${formattedHeure}</td>`;

                if (type === "attente") {
                    html += `<td data-label="Actions" class="actions">
                    <button class="btn-action btn-validate" data-mission-id="${m.id}" data-action-type="validate">✅</button>
                    <button class="btn-action btn-refuse" data-mission-id="${m.id}" data-action-type="refuse">❌</button>
                    </td>`;
                } else if (type === "validee") {
                    html += `<td data-label="Actions" class="actions">
                    <button class="btn-action btn-start" data-mission-id="${m.id}" data-client-prenom="${m.clientPrenom || ''}" data-client-nom="${m.clientNom || ''}" data-action-type="start">▶️</button>
                    </td>`;
                } else if (type === "enCours") {
                    html += `<td data-label="Actions" class="actions">
                    <button class="btn-action btn-cloturer" data-mission-id="${m.id}" data-client-prenom="${m.clientPrenom || ''}" data-client-nom="${m.clientNom || ''}" data-action-type="cloturer">🏁</button>
                    </td>`;
                }

                html += "</tr>";
            });

            html += "</tbody></table>";
            return html;
        }

        function attachMissionButtonListeners() {
            // Logique nettoyée et centralisée pour les actions de mission.
            document.querySelectorAll('.btn-validate').forEach(button => {
                button.onclick = null; 
                button.onclick = async function() {
                    const missionId = this.dataset.missionId;
                    console.log(`Validation de la mission ${missionId}`);
                    if (!window.confirm(`Confirmer la validation de la mission ${missionId} ?`)) {
                        return;
                    }
                    const url = `${window.webAppUrl}?type=validermission&missionId=${encodeURIComponent(missionId)}`; 
                    const response = await window.callApiJsonp(url, 'cbValidate' + Date.now());
                    if (response.success) {
                        alert(`Mission ${missionId} validée avec succès !`);
                        window.loadMissions(window.currentEmail);
                    } else {
                        alert(`Erreur lors de la validation de la mission ${missionId}: ${response.message || 'Erreur inconnue'}`);
                    }
                };
            });

            document.querySelectorAll('.btn-refuse').forEach(button => {
                button.onclick = null; 
                button.onclick = async function() {
                    const missionId = this.dataset.missionId;
                    console.log(`Refus de la mission ${missionId}`);
                    const alt = prompt("Nouvelle date/heure alternative à proposer :");
                    if (!alt) return;
                    const url = `${window.webAppUrl}?type=refusermission&missionId=${encodeURIComponent(missionId)}&alternatives=${encodeURIComponent(alt)}`; 
                    const response = await window.callApiJsonp(url, 'cbRefuse' + Date.now());
                    if (response.success) {
                        alert(`Mission ${missionId} refusée. Proposition envoyée.`);
                        window.loadMissions(window.currentEmail);
                    } else {
                        alert(`Erreur lors du refus de la mission ${missionId}: ${response.message || 'Erreur inconnue'}`);
                    }
                };
            });

            document.querySelectorAll('.btn-start').forEach(button => {
                button.onclick = null; 
                button.onclick = function() {
                    const missionId = this.dataset.missionId;
                    const clientPrenom = this.dataset.clientPrenom;
                    const clientNom = this.dataset.clientNom;
                    console.log(`Démarrage de la mission ${missionId} pour ${clientPrenom} ${clientNom}`);
                    if (window.openModalStartPrestation) {
                        window.openModalStartPrestation(missionId, clientPrenom, clientNom);
                    } else {
                        console.error("Fonction window.openModalStartPrestation manquante.");
                    }
                };
            });

            document.querySelectorAll('.btn-cloturer').forEach(button => {
                button.onclick = null; 
                button.onclick = function() {
                    const missionId = this.dataset.missionId;
                    const clientPrenom = this.dataset.clientPrenom || '';
                    const clientNom = this.dataset.clientNom || '';
                    console.log(`Clôture de la mission ${missionId}`);
                    if (window.openModalCloturerPrestation) {
                        window.openModalCloturerPrestation(missionId, clientPrenom, clientNom);
                    } else {
                        console.error("Fonction window.openModalCloturerPrestation manquante.");
                    }
                };
            });
        }


        window.callApiJsonp = function(url, callbackName) {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = `${url}&callback=${callbackName}`;
                document.body.appendChild(script);

                window[callbackName] = (data) => {
                    console.log(`JSONP Callback ${callbackName} reçu:`, data);
                    resolve(data);
                    script.remove();
                    delete window[callbackName];
                };

                script.onerror = (error) => {
                    console.error(`Erreur de chargement du script JSONP pour ${url}:`, error);
                    reject(new Error(`Erreur réseau ou de chargement pour l'API: ${url}`));
                    script.remove();
                    delete window[callbackName];
                };
                console.log(`JSONP: Requête lancée pour ${url} avec callback ${callbackName}`);
            });
        };

        function initializeLoginForm() {
            const loginForm = document.getElementById("loginForm");
            console.log("DEBUG initializeLoginForm: loginForm element:", loginForm);
            console.log("DEBUG initializeLoginForm: typeof window.handleLogin:", typeof window.handleLogin);

            if (loginForm && typeof window.handleLogin === 'function') {
                loginForm.removeEventListener("submit", window.handleLogin); 
                loginForm.addEventListener("submit", window.handleLogin);
                console.log("Écouteur de soumission ajouté au formulaire de connexion.");
            } else {
                console.warn("Formulaire de connexion ou fonction 'handleLogin' non disponible. Nouvelle tentative...");
                setTimeout(initializeLoginForm, 200);
            }
        }

        // Point d'entrée principal du script
        document.addEventListener('DOMContentLoaded', () => {
            initializeLoginForm();
            // Ces fonctions doivent être implémentées pour les modales :
            // createAndInjectModalHtml(); 
            // setTimeout(() => {
            //     initializeModalListeners(); 
            //     console.log("initializeModalListeners appelée après injection et délai.");
            // }, 100);
        });
    </script>
</body>
</html>
