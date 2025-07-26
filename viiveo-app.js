// viiveo-app.js - À placer sur GitHub

// Variables globales pour l'état de la mission et du prestataire
let currentMissionId = null;
let currentClientPrenom = "", currentClientNom = "";
let currentPrestatairePrenom = null, currentPrestataireNom = null;
let currentLatitude = null, currentLongitude = null;
let heureDebut = null;

// Ajoutez cette variable globale pour l'instance du scanner.
// Cela permet de la nettoyer correctement à la fermeture de la modale.
let qrScannerInstance = null; // Correctement déclaré en global

// Fonctions liées au scanner et à la modale
function setTodayDate(obsDateInput) {
    if (obsDateInput) {
        obsDateInput.value = new Date().toISOString().split("T")[0];
    }
}

function openModalStartPrestation(missionId, clientPrenom, clientNom) {
    const modalOverlay = document.getElementById("modalOverlay");
    const stepQR = document.getElementById("stepQR");
    const stepForm = document.getElementById("stepForm");
    const stepSuccess = document.getElementById("stepSuccess");
    const geolocationMessage = document.getElementById("geolocationMessage"); // Récupérer l'élément du message

    if (!modalOverlay || !stepQR || !stepForm || !stepSuccess || !geolocationMessage) {
        console.error("Erreur: Éléments de la modale ou du message de géolocalisation non trouvés lors de l'ouverture.");
        alert("Une erreur est survenue lors de l'ouverture de la modale. Veuillez recharger la page.");
        return;
    }

    if (!window.currentEmail) {
        alert("Erreur: Les données du prestataire ne sont pas chargées. Veuillez vous reconnecter.");
        console.error("Tentative d'ouvrir la modale sans données prestataire (email null).");
        return;
    }

    currentMissionId = missionId;
    currentClientPrenom = clientPrenom;
    currentClientNom = clientNom;
    currentPrestatairePrenom = window.currentPrenom;
    currentPrestataireNom = window.currentNom;

    // S'assurer que les étapes sont dans le bon ordre d'affichage
    stepQR.style.display = "none";
    stepForm.style.display = "none";
    stepSuccess.style.display = "none";
    geolocationMessage.style.display = "none"; // Masquer le message de géolocalisation au début
    geolocationMessage.textContent = ""; // Vider le texte
    modalOverlay.style.display = "flex"; // Rend la modale visible

    // Démarre le scanner APRES que la modale est rendue visible
    setTimeout(() => {
        startQrScanner();
    }, 50); // Un délai de 50ms pour la robustesse.
}

function closeModal() {
    const modalOverlay = document.getElementById("modalOverlay");
    if (modalOverlay) {
        modalOverlay.style.display = "none"; // CACHE LA MODALE ICI
    }
    const obsForm = document.getElementById("obsForm");
    if (obsForm) {
        clearForm(obsForm); // Assurez-vous que cette fonction existe et vide bien les champs
    }
    const geolocationMessage = document.getElementById("geolocationMessage");
    if (geolocationMessage) {
        geolocationMessage.style.display = "none";
        geolocationMessage.textContent = "";
    }
    // Arrête le scanner si une instance est active
    if (qrScannerInstance && typeof qrScannerInstance.stop === 'function') {
        qrScannerInstance.stop().catch(err => console.warn("Erreur à l'arrêt du scanner:", err));
    }
    qrScannerInstance = null; // Nettoyer la référence de manière inconditionnelle après tentative d'arrêt
}

async function startQrScanner() {
    const qrReaderElement = document.getElementById("qr-reader");
    const geolocationMessage = document.getElementById("geolocationMessage");

    if (!qrReaderElement) {
        console.error("Élément 'qr-reader' non trouvé. Le scanner ne peut pas démarrer.");
        alert("Erreur: Le scanner QR ne peut pas démarrer (élément manquant).");
        closeModal();
        return;
    }

    const stepQR = document.getElementById("stepQR");
    if (stepQR) {
        stepQR.style.display = "flex"; // S'assure que stepQR est visible pour le scanner
    }

    qrReaderElement.innerHTML = ""; // Nettoie l'élément avant de redémarrer le scanner.

    // Si une instance existe déjà et est active, arrêtez-la et mettez-la à null pour éviter les conflits
    if (qrScannerInstance && typeof qrScannerInstance.stop === 'function') {
        try {
            await qrScannerInstance.stop();
            console.log("Ancienne instance du scanner arrêtée.");
        } catch (error) {
            console.warn("Erreur lors de l'arrêt d'une ancienne instance de scanner:", error);
        } finally {
            qrScannerInstance = null;
        }
    }

    qrScannerInstance = new Html5Qrcode("qr-reader"); // Affectation à la variable globale

    console.log("Tentative de démarrage du scanner QR...");

    try {
        await qrScannerInstance.start(
            { facingMode: "environment" }, // Utilise la caméra arrière
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.333334
            },
            async (decodedText, decodedResult) => {
                console.log(`QR Code détecté: ${decodedText}`);
                try {
                    // Arrête le scanner immédiatement après la détection
                    if (qrScannerInstance && typeof qrScannerInstance.stop === 'function') {
                        await qrScannerInstance.stop();
                        qrScannerInstance = null;
                        console.log("Scanner arrêté après détection réussie.");
                    }

                    const url = new URL(decodedText);
                    const idClient = url.searchParams.get("idclient") || url.searchParams.get("clientId");
                    if (!idClient) throw new Error("QR invalide : idclient manquant");

                    console.log("ID Client extrait:", idClient);
                    console.log("Email prestataire global (window.currentEmail):", window.currentEmail);
                    console.log("URL Apps Script globale (window.webAppUrl):", window.webAppUrl);

                    // --- NOUVEAU: Récupérer la géolocalisation AVANT l'appel API pour l'envoyer directement ---
                    let currentLat, currentLon;
                    if (!navigator.geolocation) {
                        if (geolocationMessage) {
                            geolocationMessage.textContent = "❌ Votre appareil ne supporte pas la géolocalisation.";
                            geolocationMessage.style.display = "block";
                            geolocationMessage.style.color = "#d32f2f";
                        }
                        console.error("Géolocalisation non supportée.");
                        return; // Arrête l'exécution si la géolocalisation n'est pas supportée
                    }

                    // Afficher un message d'attente pour la géolocalisation
                    if (geolocationMessage) {
                        geolocationMessage.textContent = "Veuillez autoriser la géolocalisation...";
                        geolocationMessage.style.display = "block";
                        geolocationMessage.style.color = "#333"; // Couleur neutre
                    }

                    try {
                        const position = await new Promise((resolve, reject) => {
                            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
                        });
                        currentLat = position.coords.latitude;
                        currentLon = position.coords.longitude;
                        // Mettre à jour les variables globales pour le cas où le formulaire s'ouvre
                        currentLatitude = currentLat;
                        currentLongitude = currentLon;
                        if (geolocationMessage) geolocationMessage.style.display = "none"; // Masquer le message en cas de succès
                    } catch (geoError) {
                        let geoMessage = "⚠️ Erreur de géolocalisation.";
                        switch (geoError.code) {
                            case geoError.PERMISSION_DENIED:
                                geoMessage = "❌ Vous devez autoriser la géolocalisation pour continuer.";
                                break;
                            case geoError.POSITION_UNAVAILABLE:
                                geoMessage = "📍 Position non disponible.";
                                break;
                            case geoError.TIMEOUT:
                                geoMessage = "⏱️ Le délai de localisation est dépassé.";
                                break;
                            default:
                                geoMessage = "❌ Erreur inconnue.";
                        }
                        if (geolocationMessage) {
                            geolocationMessage.textContent = geoMessage;
                            geolocationMessage.style.display = "block";
                            geolocationMessage.style.color = "#d32f2f"; // Couleur d'erreur
                        }
                        console.error("Erreur de géolocalisation lors du scan:", geoError);
                        return; // Arrête l'exécution si la géolocalisation échoue
                    }
                    // --- FIN NOUVEAU ---

                    // Envoyer la géolocalisation avec l'appel API
                    const fullAppsScriptApiUrl = `${window.webAppUrl}?type=verifqr&idclient=${encodeURIComponent(idClient)}&email=${encodeURIComponent(window.currentEmail)}&latitude=${encodeURIComponent(currentLat)}&longitude=${encodeURIComponent(currentLon)}`;
                    console.log("URL COMPLETE ENVOYEE AU BACKEND:", fullAppsScriptApiUrl);

                    const callbackName = 'cbVerifyClient' + Date.now();
                    const data = await callApiJsonp(fullAppsScriptApiUrl, callbackName);

                    if (!data.success) {
                        alert("❌ " + data.message); // Garder l'alerte ici pour les erreurs de vérification du QR
                        closeModal();
                        return;
                    }

                    // NOUVEAU LOGIQUE BASÉE SUR LE STATUT DE LA MISSION RENVOYÉ PAR LE BACKEND
                    if (data.missionStatus === "started") { // Le backend indique que la mission vient de démarrer
                        heureDebut = new Date().toISOString(); // Enregistrer l'heure de début côté client
                        alert("✅ Mission démarrée avec succès !");
                        closeModal();
                        if (window.currentEmail) {
                            await window.loadMissions(window.currentEmail); // Recharger la liste des missions
                        }
                    } else if (data.missionStatus === "readyForEnd") { // Le backend indique que la mission est en cours et prête pour la fin
                        // Les variables globales currentLatitude, currentLongitude, heureDebut devraient déjà être définies
                        // par le premier scan ou par le backend si l'app a été fermée.
                        // Pour le moment, nous nous fions à celles définies au premier scan.
                        getGeolocationAndShowForm(); // Procéder au formulaire d'observation
                    } else {
                        alert("Statut de mission inattendu : " + (data.message || "Erreur inconnue."));
                        closeModal();
                    }

                } catch (err) {
                    alert("Erreur lors du scan QR : " + (err.message || "Erreur inconnue"));
                    console.error("Erreur dans startQrScanner (callback de succès - détails complètes):", err);
                    closeModal();
                }
            },
            (errorMessage) => {
                // Cette fonction est appelée pour les erreurs de progression (par exemple, pas de QR code trouvé)
                // console.warn("QR Scan progress error:", errorMessage); // Re-commenté comme il peut être trop verbeux
            }
        );
        console.log("Scanner QR démarré avec succès.");
    } catch (err) {
        // Cette fonction est appelée si le scanner ne peut pas démarrer du tout (par ex. problème de caméra, permissions)
        alert("Impossible d’activer la caméra. Assurez-vous d'avoir donné les permissions et que la caméra n'est pas utilisée par une autre application.");
        console.error("Erreur d'initialisation de la caméra (détails complètes):", err);
        closeModal();
    }
}

function getGeolocationAndShowForm() {
    // Cette fonction est maintenant simple car la géolocalisation est gérée dans startQrScanner
    // Elle est appelée UNIQUEMENT quand le backend a confirmé que c'est un scan de fin de mission.
    showForm();
}

function showForm() {
    const stepQR = document.getElementById("stepQR");
    const stepForm = document.getElementById("stepForm");
    const clientNameInput = document.getElementById("clientName");
    const obsDateInput = document.getElementById("obsDate");

    if (!stepQR || !stepForm || !clientNameInput || !obsDateInput) {
        console.error("Éléments du formulaire de prestation non trouvés pour l'affichage.");
        alert("Erreur: Impossible d'afficher le formulaire de prestation. Veuillez recharger la page.");
        closeModal();
        return;
    }

    stepQR.style.display = "none";
    stepForm.style.display = "flex"; // Correctement en "flex"
    clientNameInput.value = `${currentClientPrenom} ${currentClientNom}`;
    setTodayDate(obsDateInput);
}

function clearFormFields() {
    const obsDateInput = document.getElementById("obsDate");
    const etatSanteInput = document.getElementById("etatSante");
    const etatFormeInput = document.getElementById("etatForme");
    const environnementInput = document.getElementById("environnement");
    const photosInput = document.getElementById("photos");
    const photosPreview = document.getElementById("photosPreview");

    if (obsDateInput) obsDateInput.value = "";
    if (etatSanteInput) etatSanteInput.value = "";
    if (etatFormeInput) etatFormeInput.value = "";
    if (environnementInput) environnementInput.value = "";
    if (photosInput) photosInput.value = "";
    if (photosPreview) photosPreview.innerHTML = "";
}

// Rendre la fonction show globale
window.show = function(el, visible) {
    if (!el) return;
    el.style.display = visible ? "block" : "none";
};


function tempDisable(btn, ms = 1000) {
    if (!btn) return;
    btn.disabled = true;
    setTimeout(() => {
        btn.disabled = false;
    }, ms);
}

function createElementFromHTML(htmlString) {
    const div = document.createElement('div');
    div.innerHTML = htmlString.trim();
    return div.firstChild;
}

// Nouvelle fonction pour initialiser les écouteurs de la modale d'observation
function initializeModalListeners() {
    const modalOverlay = document.getElementById("modalOverlay");
    const stepQR = document.getElementById("stepQR");
    const stepForm = document.getElementById("stepForm");
    const stepSuccess = document.getElementById("stepSuccess");
    const obsForm = document.getElementById("obsForm");
    const photosInput = document.getElementById("photos");
    const photosPreview = document.getElementById("photosPreview");
    const clientNameInput = document.getElementById("clientName");
    const obsDateInput = document.getElementById("obsDate");
    const etatSanteInput = document.getElementById("etatSante");
    const etatFormeInput = document.getElementById("etatForme");
    const environnementInput = document.getElementById("environnement");

    // Vérifier si tous les éléments essentiels de la modale sont présents
    if (modalOverlay && stepQR && stepForm && stepSuccess && obsForm && photosInput && photosPreview && clientNameInput && obsDateInput && etatSanteInput && etatFormeInput && environnementInput) {
        // Attachez le change listener pour les photos
        photosInput.addEventListener("change", e => {
            photosPreview.innerHTML = "";
            const files = e.target.files;
            if (files.length > 3) {
                alert("Vous ne pouvez sélectionner que 3 photos max.");
                photosInput.value = "";
                return;
            }
            // Utilisation de Promise.all pour s'assurer que toutes les images sont chargées avant de les afficher
            const fileReaders = Array.from(files).map(file => {
                return new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onload = ev => {
                        const img = document.createElement("img");
                        img.src = ev.target.result;
                        photosPreview.appendChild(img);
                        resolve();
                    };
                    reader.readAsDataURL(file);
                });
            });
            Promise.all(fileReaders).then(() => {
                console.log("Toutes les photos ont été prévisualisées.");
            });
        });

        // Attachez le submit listener pour le formulaire d'observation
        obsForm.addEventListener("submit", async e => {
            e.preventDefault();

            if (photosInput.files.length > 3) {
                alert("Maximum 3 photos autorisées.");
                return;
            }

            if (!window.currentEmail) {
                alert("Erreur: Données du prestataire manquantes pour l'envoi.");
                console.error("Tentative d'envoi de formulaire sans email prestataire.");
                return;
            }

            const heureFin = new Date().toISOString();
            const formData = new FormData();
            formData.append("type", "envoyerFiche");
            formData.append("missionId", currentMissionId);
            formData.append("prenomClient", currentClientPrenom);
            formData.append("nomClient", currentClientNom);
            formData.append("obsDate", obsDateInput.value);
            formData.append("etatSante", etatSanteInput.value);
            formData.append("etatForme", etatFormeInput.value);
            formData.append("environnement", environnementInput.value);
            formData.append("latitude", currentLatitude); // Utilise la latitude globale définie au début ou à la fin
            formData.append("longitude", currentLongitude); // Utilise la longitude globale
            formData.append("heureDebut", heureDebut); // Utilise l'heure de début globale
            formData.append("heureFin", heureFin);
            formData.append("prestatairePrenom", window.currentPrenom);
            formData.append("prestataireNom", window.currentNom);
            formData.append("prestataireEmail", window.currentEmail);

            for (let file of photosInput.files) {
                formData.append("photos", file);
            }

            try {
                const res = await fetch(window.webAppUrl, {
                    method: "POST",
                    body: formData,
                });
                const json = await res.json();
                if (json.success) {
                    stepForm.style.display = "none";
                    stepSuccess.style.display = "flex"; // Changed to flex for consistency with modalContent
                    if (typeof window.loadMissions === 'function' && window.currentEmail) {
                        window.loadMissions(window.currentEmail);
                    }
                } else {
                    alert("Erreur : " + (json.message || "Envoi échoué"));
                }
            } catch (err) {
                alert("Erreur réseau ou du serveur lors de l'envoi de la fiche.");
                console.error("Erreur lors de l'envoi de la fiche:", err);
            }
        });

        // Attachez les écouteurs pour les boutons de la modale ici
        if (document.querySelector("#btnCancelQR")) document.querySelector("#btnCancelQR").onclick = closeModal;
        if (document.querySelector("#btnCancelForm")) document.querySelector("#btnCancelForm").onclick = closeModal;
        if (document.querySelector("#btnCloseSuccess")) document.querySelector("#btnCloseSuccess").onclick = closeModal;

        console.log("Écouteurs de la modale d'observation initialisés.");

    } else {
        console.warn("Certains éléments de la modale d'observation sont manquants. Nouvelle tentative d'initialisation des écouteurs de modale...");
        setTimeout(initializeModalListeners, 100);
    }
}

function initializeLoginForm() {
    const loginForm = document.getElementById("loginForm");
    console.log("DEBUG initializeLoginForm: loginForm element:", loginForm);
    console.log("DEBUG initializeLoginForm: typeof window.login:", typeof window.login);

    if (loginForm && typeof window.login === 'function') {
        loginForm.removeEventListener("submit", window.login);
        loginForm.addEventListener("submit", window.login);
        console.log("Écouteur de soumission ajouté au formulaire de connexion.");
    } else {
        console.warn("Formulaire de connexion ou fonction 'login' non disponible. Nouvelle tentative...");
        setTimeout(initializeLoginForm, 200);
    }
}

// Cette fonction crée et injecte le HTML de la modale dynamiquement
function createAndInjectModalHtml() {
    const modalHtml = `
        <div id="modalOverlay" style="display: none;">
            <div id="modalContent">
                <div id="stepQR" style="display:none;">
                    <h2>📸 Scanner le QR code client</h2>
                    <div id="qr-reader"></div>
                    <p id="geolocationMessage" style="color: #333; font-weight: bold; text-align: center; margin-top: 15px; display: none;"></p>
                    <button id="btnCancelQR">Annuler</button>
                </div>

                <div id="stepForm" style="display:none;">
                    <h2>📝 Fiche d'observation</h2>
                    <form id="obsForm">
                        <label for="clientName">Nom du client</label>
                        <input type="text" id="clientName" readonly />
                        <label for="obsDate">Date de l'observation</label>
                        <input type="date" id="obsDate" required />
                        <label for="etatSante">État de santé</label>
                        <textarea id="etatSante" rows="3" placeholder="Décrire l'état de santé..."></textarea>
                        <label for="etatForme">État de forme</label>
                        <select id="etatForme" required>
                            <option value="">-- Choisir --</option>
                            <option>Très bon</option>
                            <option>Bon</option>
                            <option>Moyen</option>
                            <option>Faible</option>
                            <option>Très faible</option>
                        </select>
                        <label for="environnement">Environnement</label>
                        <textarea id="environnement" rows="3" placeholder="Décrire l'environnement..."></textarea>
                        <label for="photos">Photos (max 3)</label>
                        <input type="file" id="photos" accept="image/*" multiple />
                        <div id="photosPreview"></div>
                        <button type="submit">Envoyer la fiche</button>
                        <button type="button" id="btnCancelForm">Annuler</button>
                    </form>
                </div>

                <div id="stepSuccess" style="display:none;">
                    <h2>✅ Fiche envoyée avec succès !</h2>
                    <button id="btnCloseSuccess">Fermer</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    console.log("Modal HTML injected dynamically via JS.");
}

// Rendre la fonction login globale pour qu'elle soit accessible par le formulaire
window.login = async function() {
    console.log("LOGIN: Fonction login() appelée.");
    const email = document.getElementById("email")?.value.trim();
    const password = document.getElementById("password")?.value.trim();
    const message = document.getElementById("message");
    const loader = document.querySelector(".viiveo-loader");
    const form = document.querySelector(".viiveo-login");
    const missionsBlock = document.querySelector(".viiveo-missions");

    if (!email || !password) {
        if (message) message.textContent = "Champs requis.";
        console.log("LOGIN: Champs email/password requis.");
        return;
    }
    if (message) message.textContent = "";
    window.show(loader, true);
    tempDisable(document.querySelector(".viiveo-login button"), 3000);
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
        const data = await callApiJsonp(url, callbackName);
        console.log("LOGIN: Réponse de l'API de login:", data);
        if (!data.success) {
            if (message) message.textContent = data.message || "Connexion échouée.";
            console.log("LOGIN: Connexion échouée. Message:", data.message);
            return;
        }

        window.setPrestataireData(data.email, data.prenom, data.nom);

        window.show(form, false);
        window.show(missionsBlock, true);
        await loadMissions(window.currentEmail);
        console.log("LOGIN: Missions chargées après connexion réussie.");
    } catch (err) {
        if (message) message.textContent = "Erreur serveur ou réseau.";
        console.error("LOGIN ERROR: Erreur dans la fonction login():", err);
    } finally {
        window.show(loader, false);
        console.log("LOGIN: Fonction login() terminée.");
    }
};

window.loadMissions = async function(emailToLoad) {
    const contAttente = document.getElementById("missions-attente");
    const contAvenir = document.getElementById("missions-a-venir");
    const contTerminees = document.getElementById("missions-terminees");
    if (!contAttente || !contAvenir || !contTerminees) {
        console.warn("Conteneurs de missions non trouvés. Impossible de charger les missions.");
        return;
    }

    contAttente.innerHTML = "Chargement...";
    contAvenir.innerHTML = "Chargement...";
    contTerminees.innerHTML = "Chargement...";

    try {
        const callbackName = 'cbMissions' + Date.now();
        if (!window.webAppUrl) {
            console.error("LOAD MISSIONS ERROR: window.webAppUrl n'est pas défini !");
            alert("Erreur de configuration: URL de l'application manquante pour charger les missions.");
            return;
        }
        const url = `${window.webAppUrl}?type=missionspresta&email=${encodeURIComponent(emailToLoad)}`;
        console.log("LOAD MISSIONS: URL d'API générée:", url);
        const data = await callApiJsonp(url, callbackName);
        console.log("LOAD MISSIONS: Réponse de l'API des missions:", data);

        if (!data.success || !Array.isArray(data.missions)) {
            alert("Erreur lors du chargement des missions.");
            console.warn("LOAD MISSIONS: Données de missions invalides ou échec.", data);
            return;
        }

        const missions = data.missions;
        const missionsAttente = missions.filter(m => m.statut === "en attente");
        const missionsValidees = missions.filter(m => m.statut === "confirmée" || m.statut === "validée");
        const missionsTerminees = missions.filter(m => m.statut === "terminée");

        contAttente.innerHTML = renderTable(missionsAttente, 'attente');
        contAvenir.innerHTML = renderTable(missionsValidees, 'validee');
        contTerminees.innerHTML = renderTable(missionsTerminees, '');
        console.log("LOAD MISSIONS: Tableaux de missions rendus avec succès.");
    } catch (e) {
        alert("Erreur serveur lors du chargement des missions.");
        console.error("LOAD MISSIONS ERROR: Erreur dans loadMissions():", e);
    }
}

function renderTable(missions, type = "") {
    if (!missions.length) return "<p>Aucune mission.</p>";
    let html = `<table class="missions-table"><thead><tr><th>ID</th><th>Client</th><th>Adresse</th><th>Service</th><th>Date</th><th>Heure</th>`;
    if (type) html += "<th>Actions</th>";
    html += "</tr></thead><tbody>";

    missions.forEach(m => {
        const date = new Date(m.date).toLocaleDateString('fr-FR');
        const heure = new Date(m.heure);
        const formattedHeure = `${String(heure.getHours()).padStart(2, '0')}h${String(heure.getMinutes()).padStart(2, '0')}`;
        html += `<tr>
            <td data-label="ID">${m.id}</td>
            <td data-label="Client">${m.client}</td>
            <td data-label="Adresse">${m.adresse}</td>
            <td data-label="Service">${m.service}</td>
            <td data-label="Date">${date}</td>
            <td data-label="Heure">${formattedHeure}</td>`;
        if (type === "attente") {
            html += `<td data-label="Actions" class="actions">
            <button class="btn-action btn-validate" onclick="validerMission('${m.id}')">✅</button>
            <button class="btn-action btn-refuse" onclick="refuserMission('${m.id}')">❌</button>
            </td>`;
        } else if (type === "validee") {
            html += `<td data-label="Actions" class="actions"><button class="btn-action btn-start" onclick="openModalStartPrestation('${m.id}', '${m.clientPrenom}', '${m.clientNom}')">▶️</button></td>`;
        }
        html += "</tr>";
    });

    html += "</tbody></table>";
    return html;
}

async function validerMission(id) {
    if (!confirm("Confirmer la validation ?")) return;
    const callbackName = 'cbValider' + Date.now();
    const url = `${window.webAppUrl}?type=validerMission&id=${encodeURIComponent(id)}`;
    await callApiJsonp(url, callbackName);
    alert("Mission validée.");
    if (window.currentEmail) await loadMissions(window.currentEmail);
}

async function refuserMission(id) {
    const alt = prompt("Nouvelle date/heure ?");
    if (!alt) return;
    const callbackName = 'cbRefuser' + Date.now();
    const url = `${window.webAppUrl}?type=refuserMission&id=${encodeURIComponent(id)}&alternatives=${encodeURIComponent(alt)}`;
    await callApiJsonp(url, callbackName);
    alert("Proposition envoyée.");
    if (window.currentEmail) await loadMissions(window.currentEmail);
}

// Fonctions utilitaires génériques
function clearForm(formElement) {
    if (!formElement) return;
    Array.from(formElement.elements).forEach(el => {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            el.value = '';
        } else if (el.tagName === 'SELECT') {
            el.selectedIndex = 0;
        }
    });
    // Réinitialisation spécifique du champ de fichier et de la prévisualisation
    const photosInput = formElement.querySelector("#photos");
    if (photosInput) photosInput.value = "";
    const photosPreview = formElement.querySelector("#photosPreview");
    if (photosPreview) photosPreview.innerHTML = "";
}


function tempDisable(btn, ms = 1000) {
    if (!btn) return;
    btn.disabled = true;
    setTimeout(() => {
        btn.disabled = false;
    }, ms);
}

function createElementFromHTML(htmlString) {
    const div = document.createElement('div');
    div.innerHTML = htmlString.trim();
    return div.firstChild;
}

// Point d'entrée principal du script
document.addEventListener('DOMContentLoaded', () => {
    initializeLoginForm(); // Initialise le formulaire de connexion

    // Injecte le HTML de la modale dynamiquement via JavaScript
    createAndInjectModalHtml();

    // Attendre un court instant pour que le DOM soit mis à jour
    // avant d'initialiser les écouteurs de la modale
    setTimeout(() => {
        initializeModalListeners();
        console.log("initializeModalListeners appelée après injection et délai.");
    }, 100); // 100ms est un bon point de départ, ajustez si nécessaire
});
