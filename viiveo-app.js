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

window.openModalStartPrestation = function(missionId, clientPrenom, clientNom) {
    console.log(`openModalStartPrestation appelée pour mission ID: ${missionId}`);
    const modalOverlay = document.getElementById("modalOverlay");
    const stepQR = document.getElementById("stepQR");
    const stepForm = document.getElementById("stepForm");
    const stepSuccess = document.getElementById("stepSuccess");
    const geolocationMessage = document.getElementById("geolocationMessage");

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
    // Assurez-vous que clientPrenom et clientNom sont bien passés depuis le bouton
    currentClientPrenom = clientPrenom || ""; // Définit à "" si undefined
    currentClientNom = clientNom || ""; // Définit à "" si undefined
    currentPrestatairePrenom = window.currentPrenom;
    currentPrestataireNom = window.currentNom;

    // S'assurer que les étapes sont dans le bon ordre d'affichage
    stepQR.style.display = "none";
    stepForm.style.display = "none";
    stepSuccess.style.display = "none";
    geolocationMessage.style.display = "none";
    geolocationMessage.textContent = "";
    modalOverlay.style.display = "flex";

    // Démarre le scanner APRES que la modale est rendue visible
    setTimeout(() => {
        startQrScanner();
    }, 50);
}

function closeModal() {
    const modalOverlay = document.getElementById("modalOverlay");
    if (modalOverlay) {
        modalOverlay.style.display = "none";
    }
    // Correction ici : Appel de clearFormFields() au lieu de clearForm()
    clearFormFields(); // Appelle la fonction existante pour nettoyer le formulaire

    const geolocationMessage = document.getElementById("geolocationMessage");
    if (geolocationMessage) {
        geolocationMessage.style.display = "none";
        geolocationMessage.textContent = "";
    }
    // Arrête le scanner si une instance est active
    if (qrScannerInstance && typeof qrScannerInstance.stop === 'function') {
        qrScannerInstance.stop().catch(err => console.warn("Erreur à l'arrêt du scanner:", err));
    }
    qrScannerInstance = null;
}

async function startQrScanner() {
    const qrReaderElement = document.getElementById("qr-reader");
    const geolocationMessage = document.getElementById("geolocationMessage");

    if (!qrReaderElement) {
        console.error("Éléments 'qr-reader' non trouvé. Le scanner ne peut pas démarrer.");
        alert("Erreur: Le scanner QR ne peut pas démarrer (élément manquant).");
        closeModal();
        return;
    }

    const stepQR = document.getElementById("stepQR");
    if (stepQR) {
        stepQR.style.display = "flex";
    }

    qrReaderElement.innerHTML = "";

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

    qrScannerInstance = new Html5Qrcode("qr-reader");

    console.log("Tentative de démarrage du scanner QR...");

    try {
        await qrScannerInstance.start(
            { facingMode: "environment" },
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.333334
            },
            async (decodedText, decodedResult) => {
                console.log(`QR Code détecté: ${decodedText}`);
                try {
                    // Arrêter le scanner immédiatement après la détection pour éviter de multiples scans
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

                    let currentLat, currentLon;
                    if (!navigator.geolocation) {
                        if (geolocationMessage) {
                            geolocationMessage.textContent = "❌ Votre appareil ne supporte pas la géolocalisation.";
                            geolocationMessage.style.display = "block";
                            geolocationMessage.style.color = "#d32f2f";
                        }
                        console.error("Géolocalisation non supportée.");
                        return; // Empêche la suite si non supporté
                    }

                    if (geolocationMessage) {
                        geolocationMessage.textContent = "Veuillez autoriser la géolocalisation...";
                        geolocationMessage.style.display = "block";
                        geolocationMessage.style.color = "#333";
                    }

                    try {
                        const position = await new Promise((resolve, reject) => {
                            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
                        });
                        currentLat = position.coords.latitude;
                        currentLon = position.coords.longitude;
                        currentLatitude = currentLat;
                        currentLongitude = currentLon;
                        if (geolocationMessage) geolocationMessage.style.display = "none"; // Masque le message si succès
                    } catch (geoError) {
                        let geoMessage = "⚠️ Erreur de géolocalisation.";
                        switch (geoError.code) {
                            case geoError.PERMISSION_DENIED:
                                geoMessage = "❌ Vous devez autoriser la géolocalisation pour continuer. Veuillez vérifier les paramètres de votre navigateur et de votre téléphone.";
                                break;
                            case geoError.POSITION_UNAVAILABLE:
                                geoMessage = "📍 Position non disponible. Veuillez vérifier votre connexion ou votre environnement.";
                                break;
                            case geoError.TIMEOUT:
                                geoMessage = "⏱️ Le délai de localisation est dépassé. Veuillez réessayer.";
                                break;
                            default:
                                geoMessage = "❌ Erreur inconnue de géolocalisation.";
                        }
                        if (geolocationMessage) {
                            geolocationMessage.textContent = geoMessage;
                            geolocationMessage.style.display = "block";
                            geolocationMessage.style.color = "#d32f2f";
                        }
                        console.error("Erreur de géolocalisation lors du scan:", geoError);
                        // Ne pas fermer la modale ici pour laisser le message visible
                        return; // Empêche la suite si géolocalisation échoue
                    }

                    const fullAppsScriptApiUrl = `${window.webAppUrl}?type=verifqr&idclient=${encodeURIComponent(idClient)}&email=${encodeURIComponent(window.currentEmail)}&latitude=${encodeURIComponent(currentLat)}&longitude=${encodeURIComponent(currentLon)}`;
                    console.log("URL COMPLETE ENVOYEE AU BACKEND:", fullAppsScriptApiUrl);

                    const callbackName = 'cbVerifyClient' + Date.now();
                    const data = await window.callApiJsonp(fullAppsScriptApiUrl, callbackName); // Utilisation de window.callApiJsonp

                    if (!data.success) {
                        alert("❌ " + data.message);
                        closeModal();
                        return;
                    }

                    if (data.missionStatus === "started") {
                        heureDebut = new Date().toISOString();
                        alert("✅ Mission démarrée avec succès !");
                        closeModal();
                        if (window.currentEmail) {
                            await window.loadMissions(window.currentEmail);
                        }
                    } else if (data.missionStatus === "readyForEnd") {
                        getGeolocationAndShowForm();
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
                // console.warn("QR Scan progress error:", errorMessage);
            }
        );
        console.log("Scanner QR démarré avec succès.");
    } catch (err) {
        alert("Impossible d’activer la caméra. Assurez-vous d'avoir donné les permissions et que la caméra n'est pas utilisée par une autre application.");
        console.error("Erreur d'initialisation de la caméra (détails complètes):", err);
        closeModal();
    }
}

function getGeolocationAndShowForm() {
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
    stepForm.style.display = "flex";
    // Utilise les variables globales currentClientPrenom et currentClientNom
    clientNameInput.value = `${currentClientPrenom} ${currentClientNom}`.trim();
    if (clientNameInput.value === "") {
        clientNameInput.value = "Client inconnu";
    }
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

    if (modalOverlay && stepQR && stepForm && stepSuccess && obsForm && photosInput && photosPreview && clientNameInput && obsDateInput && etatSanteInput && etatFormeInput && environnementInput) {
        photosInput.addEventListener("change", e => {
            photosPreview.innerHTML = "";
            const files = e.target.files;
            if (files.length > 3) {
                alert("Vous ne pouvez sélectionner que 3 photos max.");
                photosInput.value = "";
                return;
            }
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
            formData.append("latitude", currentLatitude);
            formData.append("longitude", currentLongitude);
            formData.append("heureDebut", heureDebut);
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
                    stepSuccess.style.display = "flex";
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

function createAndInjectModalHtml() {
    const modalHtml = `
        <div id="modalOverlay" style="display: none;">
            <div id="modalContent">
                <div id="stepQR" style="display:none;">
                    <h2>📸 Scanner le QR code client</h2>
                    <div id="qr-reader"></div>
                    <p id="geolocationMessage" style="color: #d32f2f; font-weight: bold; text-align: center; margin-top: 15px; display: none;"></p>
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
        const data = await window.callApiJsonp(url, callbackName); // Utilisation de window.callApiJsonp
        console.log("LOGIN: Réponse de l'API de login:", data);
        if (!data.success) {
            if (message) message.textContent = data.message || "Connexion échouée.";
            console.log("LOGIN: Connexion échouée. Message:", data.message);
            return;
        }

        window.setPrestataireData(data.email, data.prenom, data.nom);

        window.show(form, false);
        window.show(missionsBlock, true);
        await window.loadMissions(window.currentEmail); // Utilisation de window.loadMissions
        console.log("LOGIN: Missions chargées après connexion réussie.");
    } catch (err) {
        if (message) message.textContent = "Erreur serveur ou réseau.";
        console.error("LOGIN ERROR: Erreur dans la fonction login():", err);
    } finally {
        window.show(loader, false);
        console.log("LOGIN: Fonction login() terminée.");
    }
};

/**
 * Charge et affiche les missions pour le prestataire donné, en les catégorisant
 * par statut (en attente, planifiées, en cours, terminées).
 * Gère également l'affichage du loader et des conteneurs de missions.
 *
 * @param {string} emailToLoad L'adresse email du prestataire pour laquelle charger les missions.
 */
window.loadMissions = async function(emailToLoad) {
    // 1. Récupération des conteneurs DOM
    const contAttente = document.getElementById("missions-attente");
    const contAvenir = document.getElementById("missions-a-venir");
    const contEnCours = document.getElementById("missions-en-cours"); // NOUVEAU : Conteneur pour missions en cours
    const contTerminees = document.getElementById("missions-terminees");

    // Conteneur parent pour tous les tableaux de missions (pour masquer/afficher d'un coup)
    const mainMissionsDisplay = document.getElementById("main-missions-display");
    // Le loader global
    const globalLoader = document.getElementById("global-loader");

    // Vérification que tous les conteneurs nécessaires existent
    if (!contAttente || !contAvenir || !contEnCours || !contTerminees || !mainMissionsDisplay || !globalLoader) {
        console.error("LOAD MISSIONS ERROR: Un ou plusieurs conteneurs de missions/loader sont introuvables dans le DOM.");
        // Gérer cette erreur visiblement pour l'utilisateur si possible
        alert("Erreur d'affichage : Impossible de trouver tous les éléments de l'interface.");
        return;
    }

    // 2. Afficher le loader et masquer les conteneurs de missions au début du chargement
    globalLoader.style.display = 'block';
    mainMissionsDisplay.style.display = 'none';

    // Afficher des messages "Chargement..." dans chaque section (facultatif si le loader global suffit)
    contAttente.innerHTML = "Chargement...";
    contAvenir.innerHTML = "Chargement...";
    contEnCours.innerHTML = "Chargement...";
    contTerminees.innerHTML = "Chargement...";

    try {
        const callbackName = 'cbMissions' + Date.now();
        if (!window.webAppUrl) {
            console.error("LOAD MISSIONS ERROR: window.webAppUrl n'est pas défini !");
            alert("Erreur de configuration: URL de l'application manquante pour charger les missions.");
            // Cacher le loader et afficher un message d'erreur persistant si l'URL manque
            globalLoader.style.display = 'none';
            mainMissionsDisplay.innerHTML = "<p class='error-message'>Erreur de configuration: URL de l'application manquante.</p>";
            mainMissionsDisplay.style.display = 'block';
            return;
        }

        // 3. Appel de l'API backend pour récupérer les missions
        const url = `${window.webAppUrl}?type=missionspresta&email=${encodeURIComponent(emailToLoad)}`;
        console.log("LOAD MISSIONS: URL d'API générée:", url);
        const data = await window.callApiJsonp(url, callbackName);
        console.log("LOAD MISSIONS: Réponse de l'API des missions:", data);

        // 4. Traitement de la réponse de l'API
        if (!data.success || !Array.isArray(data.missions)) {
            alert("Erreur lors du chargement des missions.");
            console.warn("LOAD MISSIONS: Données de missions invalides ou échec.", data);
            // Cacher le loader et afficher un message d'erreur
            globalLoader.style.display = 'none';
            mainMissionsDisplay.innerHTML = `<p class='error-message'>${data.message || 'Erreur lors du chargement des missions.'}</p>`;
            mainMissionsDisplay.style.display = 'block';
            return;
        }

        // 5. Filtrage des missions par statut
        const missions = data.missions;
        const missionsAttente = missions.filter(m => m.statut && String(m.statut).toLowerCase() === "en attente");
        const missionsValidees = missions.filter(m => m.statut && (String(m.statut).toLowerCase() === "confirmée" || String(m.statut).toLowerCase() === "validée"));
        const missionsEnCours = missions.filter(m => m.statut && String(m.statut).toLowerCase() === "en cours");
        const missionsTerminees = missions.filter(m => m.statut && (String(m.statut).toLowerCase() === "terminée" || String(m.statut).toLowerCase() === "clôturée"));

        // 6. Rendu des tableaux dans leurs conteneurs respectifs
        contAttente.innerHTML = renderTable(missionsAttente, 'attente');
        contAvenir.innerHTML = renderTable(missionsValidees, 'validee');
        contEnCours.innerHTML = renderTable(missionsEnCours, 'enCours');
        contTerminees.innerHTML = renderTable(missionsTerminees, 'terminee');

        // 7. Attacher les écouteurs d'événements aux boutons nouvellement rendus
        attachMissionButtonListeners();

        // 8. Masquer le loader et afficher les conteneurs de missions après le succès
        globalLoader.style.display = 'none';
        mainMissionsDisplay.style.display = 'block';

        console.log("LOAD MISSIONS: Tableaux de missions rendus et écouteurs attachés avec succès.");

    } catch (e) {
        // 9. Gestion des erreurs lors de l'appel API ou du traitement
        alert("Erreur serveur lors du chargement des missions.");
        console.error("LOAD MISSIONS ERROR: Erreur dans loadMissions():", e);
        // Cacher le loader et afficher un message d'erreur
        globalLoader.style.display = 'none';
        mainMissionsDisplay.innerHTML = `<p class='error-message'>Erreur lors du chargement des missions: ${e.message}</p>`;
        mainMissionsDisplay.style.display = 'block';
    }
};
function renderTable(missions, type = "") {
    if (!missions.length) return "<p>Aucune mission.</p>";
    let html = `<table class="missions-table"><thead><tr><th>ID</th><th>Client</th><th>Adresse</th><th>Service</th><th>Date</th><th>Heure</th>`;
    if (type === "attente" || type === "validee" || type === "enCours") { // Afficher "Actions" seulement si des actions sont possibles
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
                        console.warn("Failed to parse full date/time for mission", m.id, dateTimeString);
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
        } else if (type === "validee") { // Missions planifiées : Seul le bouton Démarrer apparaît
            html += `<td data-label="Actions" class="actions">
            <button class="btn-action btn-start" data-mission-id="${m.id}" data-client-prenom="${m.clientPrenom || ''}" data-client-nom="${m.clientNom || ''}" data-action-type="start">▶️ Démarrer</button>
            </td>`;
        } else if (type === "enCours") { // Missions en cours : Seul le bouton Clôturer apparaît
            html += `<td data-label="Actions" class="actions">
            <button class="btn-action btn-cloturer" data-mission-id="${m.id}" data-action-type="cloturer">🏁 Clôturer</button>
            </td>`;
        }
        // Pour type === "terminee", aucune action n'est ajoutée ici, ce qui est le comportement souhaité.

        html += "</tr>";
    });

    html += "</tbody></table>";
    return html;
}
// Assurez-vous que cette fonction est appelée après le rendu des tableaux.
// Elle est déjà appelée dans votre window.loadMissions.
// Assurez-vous que cette fonction est appelée après le rendu des tableaux.
// Elle est déjà appelée dans votre window.loadMissions.
function attachMissionButtonListeners() {
    // Écouteurs pour les boutons de validation/refus (missions en attente)
    document.querySelectorAll('.btn-validate').forEach(button => {
        button.onclick = async function() {
            const missionId = this.dataset.missionId;
            // Votre logique existante pour valider la mission
            console.log(`Validation de la mission ${missionId}`);
            // Exemple d'appel API (adaptez à votre fonction validerMission)
            const url = `${window.webAppUrl}?type=validermission&missionId=${encodeURIComponent(missionId)}`;
            const response = await window.callApiJsonp(url, 'cbValidate' + Date.now());
            if (response.success) {
                alert(`Mission ${missionId} validée avec succès !`);
                window.loadMissions(window.currentEmail); // Recharger les missions avec window.currentEmail
            } else {
                alert(`Erreur lors de la validation de la mission ${missionId}: ${response.message}`);
            }
        };
    });

    document.querySelectorAll('.btn-refuse').forEach(button => {
        button.onclick = async function() {
            const missionId = this.dataset.missionId;
            // Votre logique existante pour refuser la mission
            console.log(`Refus de la mission ${missionId}`);
            // Exemple d'appel API (adaptez à votre fonction refuserMission)
            const url = `${window.webAppUrl}?type=refusermission&missionId=${encodeURIComponent(missionId)}`;
            const response = await window.callApiJsonp(url, 'cbRefuse' + Date.now());
            if (response.success) {
                alert(`Mission ${missionId} refusée avec succès.`);
                window.loadMissions(window.currentEmail); // Recharger les missions avec window.currentEmail
            } else {
                alert(`Erreur lors du refus de la mission ${missionId}: ${response.message}`);
            }
        };
    });

    // Écouteur pour le bouton "Start" (missions validées)
    document.querySelectorAll('.btn-start').forEach(button => {
        button.onclick = function() { // Reste synchrone pour ouvrir la modale
            const missionId = this.dataset.missionId;
            const clientPrenom = this.dataset.clientPrenom;
            const clientNom = this.dataset.clientNom;
            console.log(`Démarrage de la mission ${missionId} pour ${clientPrenom} ${clientNom}`);

            // Appel de la fonction openModalStartPrestation existante
            window.openModalStartPrestation(missionId, clientPrenom, clientNom);
        };
    });

    // --- ÉCOUTEUR POUR LE BOUTON "CLÔTURER" ---
    document.querySelectorAll('.btn-cloturer').forEach(button => {
        button.onclick = function() {
            const missionId = this.dataset.missionId;
            // Assurez-vous d'avoir ces données disponibles si elles sont nécessaires pour le formulaire d'observation
            // Pour l'instant, openModalStartPrestation attend clientPrenom et clientNom
            // Si ces infos ne sont pas sur le bouton clôturer, elles devront être récupérées d'une autre manière (par ex. depuis currentClientPrenom/Nom si déjà mis à jour, ou via un appel API)
            // Pour l'exemple, je les récupère du dataset si elles y sont (idéalement, elles devraient l'être pour être cohérent avec le btn-start)
            const clientPrenom = this.dataset.clientPrenom || ''; // Récupérer le prénom du client
            const clientNom = this.dataset.clientNom || '';     // Récupérer le nom du client

            console.log(`Clôture de la mission ${missionId}`);

            // Appeler openModalStartPrestation pour lancer le processus de QR et formulaire
            // En passant l'ID de mission, et les informations du client (même si le QR ne sera pas scanné pour la fin, le processus est le même)
            window.openModalStartPrestation(missionId, clientPrenom, clientNom);
        };
    });
    // --- FIN ÉCOUTEUR ---
}
// Fonctions de gestion des clics (maintenant appelées par addEventListener)
async function handleValidateMission(event) {
    const missionId = event.currentTarget.dataset.missionId;
    console.log(`handleValidateMission appelée pour ID: ${missionId}`);
    // Remplacer confirm() par une modale personnalisée si possible
    if (!window.confirm("Confirmer la validation ?")) return;
    const callbackName = 'cbValider' + Date.now();
    const url = `${window.webAppUrl}?type=validerMission&id=${encodeURIComponent(missionId)}`;
    await window.callApiJsonp(url, callbackName);
    alert("Mission validée.");
    if (window.currentEmail) await window.loadMissions(window.currentEmail);
}

async function handleRefuseMission(event) {
    const missionId = event.currentTarget.dataset.missionId;
    console.log(`handleRefuseMission appelée pour ID: ${missionId}`);
    // Remplacer prompt() par une modale personnalisée si possible
    const alt = prompt("Nouvelle date/heure ?");
    if (!alt) return;
    const callbackName = 'cbRefuser' + Date.now();
    const url = `${window.webAppUrl}?type=refuserMission&id=${encodeURIComponent(missionId)}&alternatives=${encodeURIComponent(alt)}`;
    await window.callApiJsonp(url, callbackName);
    alert("Proposition envoyée.");
    if (window.currentEmail) await window.loadMissions(window.currentEmail);
}

async function handleStartMission(event) {
    const missionId = event.currentTarget.dataset.missionId;
    const clientPrenom = event.currentTarget.dataset.clientPrenom;
    const clientNom = event.currentTarget.dataset.clientNom;
    console.log(`handleStartMission appelée pour ID: ${missionId}, Client: ${clientPrenom} ${clientNom}`);
    window.openModalStartPrestation(missionId, clientPrenom, clientNom);
}


window.validerMission = handleValidateMission; // Garder pour la compatibilité si d'autres parties l'appellent directement
window.refuserMission = handleRefuseMission; // Garder pour la compatibilité
// window.openModalStartPrestation est déjà globale

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


// Point d'entrée principal du script
document.addEventListener('DOMContentLoaded', () => {
    initializeLoginForm();

    createAndInjectModalHtml();

    setTimeout(() => {
        initializeModalListeners();
        console.log("initializeModalListeners appelée après injection et délai.");
    }, 100);
});
