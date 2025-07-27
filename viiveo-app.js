// viiveo-app.js - À placer sur GitHub

console.log("viiveo-app.js: Script chargé et début de l'exécution."); // Log très précoce pour le débogage

// --- Variables Globales ---
// Ces variables sont définies dans Embed 1 de Carrd.co.
// window.webAppUrl = "https://script.google.com/macros/s/AKfycbzEEZZnZJK1BEXlCk81ogi0Aa7MFGunOkjS5s2CCDIZPSkHq0OtPAcEBLrkXp-fpb8aaQ/exec";
// window.currentEmail = null;
// window.currentPrenom = null;
// window.currentNom = null;

// Variables globales pour le workflow de la mission
let currentMissionId = null;
let currentClientPrenom = null;
let currentClientNom = null;
let currentHeureDebutReelle = null; // Stocke l'heure de début réelle de la mission (ISO string)
let currentLatitudeDebut = null;
let currentLongitudeDebut = null;

let qrScannerInstance = null; // Variable pour stocker l'instance du scanner QR

// --- Fonctions Utilitaires ---

/**
 * Fonction générique pour appeler l'API Apps Script via JSONP.
 * @param {string} url L'URL complète de l'API Apps Script.
 * @param {string} callbackName Le nom de la fonction de callback JSONP.
 * @returns {Promise<Object>} Une promesse qui se résout avec les données de la réponse de l'API.
 */
function callApiJsonp(url, callbackName) {
    return new Promise((resolve, reject) => {
        // Crée un élément script pour la requête JSONP
        const script = document.createElement('script');
        script.src = `${url}&callback=${callbackName}`;
        document.body.appendChild(script);

        // Définit la fonction de callback globale
        window[callbackName] = (data) => {
            console.log(`JSONP Callback ${callbackName} reçu:`, data);
            resolve(data);
            // Nettoie l'élément script et la fonction de callback globale après utilisation
            document.body.removeChild(script);
            delete window[callbackName];
        };

        script.onerror = (error) => {
            console.error(`Erreur de chargement du script JSONP pour ${url}:`, error);
            reject(new Error(`Erreur réseau ou de chargement pour l'API: ${url}`));
            // Nettoie en cas d'erreur
            document.body.removeChild(script);
            delete window[callbackName];
        };

        console.log(`JSONP: Requête lancée pour ${url} avec callback ${callbackName}`);
    });
}


/**
 * Affiche un message à l'utilisateur.
 * @param {string} message Le message à afficher.
 * @param {string} type Le type de message ('success', 'error', 'info').
 */
function showMessage(message, type) {
    const messageDiv = document.getElementById('message');
    if (messageDiv) {
        messageDiv.textContent = message;
        messageDiv.style.color = type === 'error' ? 'red' : (type === 'success' ? 'green' : 'blue');
        setTimeout(() => {
            messageDiv.textContent = '';
        }, 5000); // Le message disparaît après 5 secondes
    } else {
        console.log(`Message (${type}): ${message}`);
    }
}

/**
 * Gère la connexion du prestataire.
 */
window.login = async function() { // Rendre la fonction login globale
    console.log("LOGIN: Fonction login() appelée.");
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const messageDiv = document.getElementById('message');
    const loaderDiv = document.querySelector('.viiveo-loader');
    const loginDiv = document.querySelector('.viiveo-login');
    const missionsDiv = document.querySelector('.viiveo-missions');

    // Vérification des éléments du DOM
    if (!emailInput || !passwordInput || !messageDiv || !loaderDiv || !loginDiv || !missionsDiv) {
        console.error("LOGIN: Un ou plusieurs éléments du DOM nécessaires pour la connexion sont introuvables.");
        showMessage("Erreur interne: Impossible d'initialiser le formulaire de connexion.", "error");
        return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        showMessage('Veuillez entrer votre e-mail et votre mot de passe.', 'error');
        return;
    }

    loaderDiv.style.display = 'block';
    loginDiv.style.display = 'none';
    messageDiv.textContent = ''; // Efface les messages précédents

    const loginUrl = new URL(window.webAppUrl);
    loginUrl.searchParams.append('type', 'loginpresta');
    loginUrl.searchParams.append('email', email);
    loginUrl.searchParams.append('password', password);

    console.log("LOGIN: URL d'API générée:", loginUrl.toString());

    try {
        const data = await callApiJsonp(loginUrl.toString(), 'loginCallback');
        console.log("LOGIN: Réponse de l'API de login:", data);

        if (data.success) {
            window.setPrestataireData(data.email, data.prenom, data.nom); // Met à jour les variables globales
            showMessage('Connexion réussie !', 'success');
            loginDiv.style.display = 'none';
            missionsDiv.style.display = 'block';
            console.log("LOGIN: Missions chargées après connexion réussie.");
            await window.loadMissions(); // Appel direct de loadMissions après la connexion réussie
        } else {
            showMessage(data.message || 'Erreur de connexion.', 'error');
            loginDiv.style.display = 'block'; // Réaffiche le formulaire de login
        }
    } catch (error) {
        console.error("LOGIN: Erreur lors de l'appel API de login:", error);
        showMessage('Erreur de communication avec le serveur.', 'error');
        loginDiv.style.display = 'block'; // Réaffiche le formulaire de login
    } finally {
        loaderDiv.style.display = 'none';
        console.log("LOGIN: Fonction login() terminée.");
    }
};

/**
 * Charge les missions pour le prestataire connecté.
 */
window.loadMissions = async function() { // Rendre la fonction loadMissions globale
    console.log("LOAD MISSIONS: Fonction loadMissions() appelée.");
    if (!window.currentEmail) {
        console.log("LOAD MISSIONS: Pas d'email prestataire (window.currentEmail est null ou vide), ne charge pas les missions.");
        return;
    }
    console.log(`LOAD MISSIONS: Chargement des missions pour ${window.currentEmail}`);

    const loaderDiv = document.querySelector('.viiveo-loader');
    loaderDiv.style.display = 'block';

    const missionsUrl = new URL(window.webAppUrl);
    missionsUrl.searchParams.append('type', 'missionspresta');
    missionsUrl.searchParams.append('email', window.currentEmail);

    console.log("LOAD MISSIONS: URL d'API générée:", missionsUrl.toString());

    try {
        const data = await callApiJsonp(missionsUrl.toString(), 'missionsCallback');
        console.log("LOAD MISSIONS: Réponse de l'API des missions:", data);

        if (data.success && data.missions) {
            console.log(`LOAD MISSIONS: ${data.missions.length} missions reçues.`);
            const missions = data.missions;
            const missionsAttente = missions.filter(m => m.statut === "en attente");
            const missionsValidees = missions.filter(m => m.statut === "confirmée" || m.statut === "validée");
            const missionsTerminees = missions.filter(m => m.statut === "terminée");

            document.getElementById('missions-attente').innerHTML = renderTable(missionsAttente, 'attente');
            document.getElementById('missions-a-venir').innerHTML = renderTable(missionsValidees, 'validee');
            document.getElementById('missions-terminees').innerHTML = renderTable(missionsTerminees, '');

            console.log("LOAD MISSIONS: Tableaux de missions rendus avec succès.");
        } else {
            showMessage(data.message || 'Aucune mission trouvée.', 'info');
            document.getElementById('missions-attente').innerHTML = "<p>Aucune mission en attente.</p>";
            document.getElementById('missions-a-venir').innerHTML = "<p>Aucune mission à venir.</p>";
            document.getElementById('missions-terminees').innerHTML = "<p>Aucune mission terminée.</p>";
            console.log("LOAD MISSIONS: Aucune mission ou erreur dans la réponse.");
        }
    } catch (error) {
        console.error("LOAD MISSIONS: Erreur lors de l'appel API des missions:", error);
        showMessage('Erreur lors du chargement des missions.', 'error');
    } finally {
        loaderDiv.style.display = 'none';
    }
};

/**
 * Rend les missions dans une structure de tableau HTML.
 * @param {Array<Object>} missions La liste des missions à rendre.
 * @param {string} type Le type de missions ('attente', 'validee', '').
 * @returns {string} Le HTML du tableau des missions.
 */
function renderTable(missions, type = "") {
    if (!missions.length) return `<p>Aucune mission ${type ? `(${type})` : ''}.</p>`;

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
            <button class="btn-action btn-validate" onclick="window.validerMission('${m.id}')">✅</button>
            <button class="btn-action btn-refuse" onclick="window.refuserMission('${m.id}')">❌</button>
            </td>`;
        } else if (type === "validee") { // Pour les missions "confirmée" ou "validée"
            html += `<td data-label="Actions" class="actions"><button class="btn-action btn-start" onclick="window.openModalStartPrestation('${m.id}', '${m.clientPrenom}', '${m.clientNom}')">▶️</button></td>`;
        }
        html += "</tr>";
    });

    html += "</tbody></table>";
    return html;
}

// Fonctions pour valider et refuser une mission (rendues globales)
window.validerMission = async function(id) {
    // Remplacer confirm() par une modale personnalisée si possible
    if (!confirm("Confirmer la validation de la mission ?")) return;
    const loaderDiv = document.querySelector('.viiveo-loader');
    loaderDiv.style.display = 'block';
    try {
        const url = new URL(window.webAppUrl);
        url.searchParams.append('type', 'validerMission');
        url.searchParams.append('id', id);
        const data = await callApiJsonp(url.toString(), 'validerCallback');
        if (data.success) {
            showMessage('Mission validée avec succès !', 'success');
            await window.loadMissions(); // Recharger les missions
        } else {
            showMessage(data.message || 'Erreur lors de la validation.', 'error');
        }
    } catch (error) {
        console.error("Erreur lors de la validation de mission:", error);
        showMessage('Erreur de communication avec le serveur.', 'error');
    } finally {
        loaderDiv.style.display = 'none';
    }
};

window.refuserMission = async function(id) {
    // Remplacer prompt() par une modale personnalisée si possible
    const alternatives = prompt("Veuillez entrer une nouvelle date/heure ou des alternatives pour le refus :");
    if (!alternatives) return;
    const loaderDiv = document.querySelector('.viiveo-loader');
    loaderDiv.style.display = 'block';
    try {
        const url = new URL(window.webAppUrl);
        url.searchParams.append('type', 'refuserMission');
        url.searchParams.append('id', id);
        url.searchParams.append('alternatives', alternatives);
        const data = await callApiJsonp(url.toString(), 'refuserCallback');
        if (data.success) {
            showMessage('Proposition d\'alternatives envoyée !', 'success');
            await window.loadMissions(); // Recharger les missions
        } else {
            showMessage(data.message || 'Erreur lors du refus.', 'error');
        }
    } catch (error) {
        console.error("Erreur lors du refus de mission:", error);
        showMessage('Erreur de communication avec le serveur.', 'error');
    } finally {
        loaderDiv.style.display = 'none';
    }
};


// --- Fonctions du Scanner QR ---

/**
 * Démarre le scanner QR.
 */
function startQrScanner() {
    console.log("Tentative de démarrage du scanner QR...");
    // Créer une modale pour le scanner
    const scannerModal = document.createElement('div');
    scannerModal.id = 'scannerModal';
    scannerModal.className = 'fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50';
    scannerModal.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-xl w-11/12 max-w-lg relative">
            <h2 class="text-2xl font-bold mb-4">Scanner QR Code</h2>
            <div id="qr-code-reader" style="width: 100%;"></div>
            <button id="closeScannerModal" class="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>
    `;
    document.body.appendChild(scannerModal);

    const html5QrCodeRegion = scannerModal.querySelector('#qr-code-reader');

    qrScannerInstance = new Html5Qrcode("qr-code-reader"); // Initialise le scanner sur l'élément créé dans la modale
    qrScannerInstance.start(
        { facingMode: "environment" }, // Utilise la caméra arrière
        {
            fps: 10,    // Nombre d'images par seconde pour le scan
            qrbox: { width: 250, height: 250 } // Taille de la zone de scan
        },
        (qrCodeMessage) => {
            // Appelé quand un QR code est détecté
            handleScanResult(qrCodeMessage);
            // La modale sera fermée dans handleScanResult après l'arrêt du scanner
        },
        (errorMessage) => {
            // Appelé en cas d'erreur ou si aucun QR n'est détecté
            // console.log(`QR Code no match: ${errorMessage}`); // Peut être très verbeux
        }
    ).then(() => {
        console.log("Scanner QR démarré avec succès.");
    }).catch((err) => {
        console.error("Erreur lors du démarrage du scanner QR:", err);
        showMessage('Impossible de démarrer le scanner QR. Vérifiez les permissions de la caméra.', 'error');
        scannerModal.remove(); // Ferme la modale en cas d'erreur
    });

    // Écouteur pour fermer la modale
    scannerModal.querySelector('#closeScannerModal').addEventListener('click', () => {
        if (qrScannerInstance && typeof qrScannerInstance.stop === 'function') {
             qrScannerInstance.stop().catch(err => console.warn("Erreur à l'arrêt du scanner:", err));
        }
        scannerModal.remove();
        console.log("Scanner QR arrêté et modale fermée manuellement.");
    });
}

/**
 * Gère le résultat du scan QR et interagit avec l'API Apps Script.
 * @param {string} qrData Les données brutes lues par le QR code.
 */
async function handleScanResult(qrData) {
    console.log("QR Code détecté:", qrData);
    const scannerModal = document.getElementById('scannerModal'); // Récupère la modale du scanner

    if (qrScannerInstance && typeof qrScannerInstance.stop === 'function') {
        await qrScannerInstance.stop().catch(err => console.warn("Erreur à l'arrêt du scanner:", err));
        console.log("Scanner arrêté après détection réussie.");
    }
    if (scannerModal) {
        scannerModal.remove(); // Ferme la modale du scanner
        console.log("Modale du scanner fermée.");
    }

    // Extraire les paramètres de l'URL du QR code
    const url = new URL(qrData);
    const idClientQR = url.searchParams.get('idclient') || url.searchParams.get('clientId');

    if (!idClientQR) {
        showMessage('Erreur: ID client non trouvé dans le QR code.', 'error');
        return;
    }

    // Utiliser l'email du prestataire actuellement connecté
    const prestataireEmail = window.currentEmail;

    if (!prestataireEmail) {
        showMessage('Erreur: Email du prestataire non disponible. Veuillez vous reconnecter.', 'error');
        return;
    }

    console.log("ID Client extrait:", idClientQR);
    console.log("Email prestataire global (window.currentEmail):", prestataireEmail);
    console.log("URL Apps Script globale (window.webAppUrl):", window.webAppUrl);

    // Obtenir la géolocalisation
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                console.log(`Géolocalisation obtenue: Lat ${lat}, Lon ${lon}`);

                // Construire l'URL pour la vérification QR
                const verifUrl = new URL(window.webAppUrl);
                verifUrl.searchParams.append('type', 'verifqr');
                verifUrl.searchParams.append('idclient', idClientQR);
                verifUrl.searchParams.append('email', prestataireEmail);
                verifUrl.searchParams.append('latitude', lat);
                verifUrl.searchParams.append('longitude', lon);

                // Appel à l'API Apps Script pour vérifier le QR
                try {
                    const data = await callApiJsonp(verifUrl.toString(), 'verifqrCallback');
                    console.log("Réponse de l'API verifqr:", data);

                    if (data.success) {
                        showMessage(data.message, 'success');
                        // Gérer les différents statuts de mission
                        if (data.missionStatus === 'started') {
                            // Mission vient d'être démarrée (premier scan)
                            console.log("Mission démarrée, rechargement des missions...");
                            await window.loadMissions(); // Recharger les missions pour mettre à jour l'affichage
                        } else if (data.missionStatus === 'readyForEnd') {
                            // Mission est en cours, prête pour la fin (deuxième scan)
                            console.log("Mission en cours, ouverture de la modale d'observation...");
                            // Stocker les infos de la mission pour le formulaire d'observation
                            window.currentMissionId = data.mission.id;
                            window.currentClientPrenom = data.client.prenom;
                            window.currentClientNom = data.client.nom;
                            window.currentHeureDebutReelle = data.mission.heureDebutReelle; // Récupère l'heure de début réelle
                            window.currentLatitudeDebut = data.mission.latitude; // Récupère la latitude de début
                            window.currentLongitudeDebut = data.mission.longitude; // Récupère la longitude de début

                            window.openObservationModal(); // Ouvrir la modale de fiche d'observation
                        } else if (data.missionStatus === 'completed') {
                            // Mission déjà terminée
                            showMessage(data.message, 'info');
                            console.log("Mission déjà terminée, rechargement des missions...");
                            await window.loadMissions(); // Rafraîchir au cas où
                        }
                    } else {
                        showMessage(data.message, 'error');
                    }
                } catch (error) {
                    console.error("Erreur lors de l'appel API verifqr:", error);
                    showMessage('Erreur de communication avec le serveur.', 'error');
                }
            },
            (error) => {
                console.error("Erreur de géolocalisation lors du scan:", error);
                showMessage('Impossible d\'obtenir la position GPS. Veuillez autoriser la géolocalisation.', 'error');
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    } else {
        showMessage('La géolocalisation n\'est pas supportée par ce navigateur.', 'error');
    }
}

// --- Modale de Fiche d'Observation ---

/**
 * Ouvre la modale pour la fiche d'observation.
 */
window.openObservationModal = function() { // Rendre la fonction globale
    console.log("Ouverture de la modale d'observation...");
    const modalHtml = `
        <div id="observationModal" class="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-md relative overflow-y-auto max-h-[90vh]">
                <h2 class="text-2xl font-bold mb-4 text-center">Fiche d'Observation</h2>
                <button id="closeObservationModal" class="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                
                <p class="mb-2"><strong>Mission ID:</strong> <span id="modalMissionId">${currentMissionId || 'N/A'}</span></p>
                <p class="mb-4"><strong>Client:</strong> <span id="modalClientName">${currentClientPrenom || ''} ${currentClientNom || ''}</span></p>
                
                <form id="observationForm" class="space-y-4">
                    <div>
                        <label for="obsDate" class="block text-sm font-medium text-gray-700">Date d'Observation:</label>
                        <input type="date" id="obsDate" name="obsDate" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" required>
                    </div>
                    <div>
                        <label for="etatSante" class="block text-sm font-medium text-gray-700">État de Santé:</label>
                        <textarea id="etatSante" name="etatSante" rows="4" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" placeholder="Décrivez l'état de santé du client..." required></textarea>
                    </div>
                    <div>
                        <label for="etatForme" class="block text-sm font-medium text-gray-700">État de Forme:</label>
                        <input type="text" id="etatForme" name="etatForme" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" placeholder="Ex: Bonne, Fatigué..." required>
                    </div>
                    <div>
                        <label for="environnement" class="block text-sm font-medium text-gray-700">Environnement:</label>
                        <textarea id="environnement" name="environnement" rows="4" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" placeholder="Décrivez l'environnement de la mission..." required></textarea>
                    </div>
                    <div>
                        <label for="photos" class="block text-sm font-medium text-gray-700">Photos (optionnel):</label>
                        <input type="file" id="photos" name="photos" accept="image/*" multiple class="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100">
                    </div>
                    
                    <button type="submit" class="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50">
                        Clôturer la Mission et Envoyer la Fiche
                    </button>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const observationModal = document.getElementById('observationModal');
    const closeButton = document.getElementById('closeObservationModal');
    const observationForm = document.getElementById('observationForm');
    const obsDateInput = document.getElementById('obsDate');

    // Pré-remplir la date d'observation avec la date du jour
    const today = new Date();
    obsDateInput.value = today.toISOString().split('T')[0];

    closeButton.addEventListener('click', () => {
        observationModal.remove();
        // Optionnel: Réinitialiser les variables globales de la mission si la modale est fermée sans soumission
        currentMissionId = null;
        currentClientPrenom = null;
        currentClientNom = null;
        currentHeureDebutReelle = null;
        currentLatitudeDebut = null;
        currentLongitudeDebut = null;
        console.log("Modale d'observation fermée manuellement.");
    });

    observationForm.addEventListener('submit', submitObservationForm);
    console.log("Écouteurs de la modale d'observation initialisés.");
};

/**
 * Gère la soumission du formulaire de fiche d'observation.
 * @param {Event} event L'événement de soumission du formulaire.
 */
async function submitObservationForm(event) {
    event.preventDefault();
    console.log("Soumission du formulaire d'observation...");

    const form = event.target;
    const formData = new FormData(form);

    const loaderDiv = document.querySelector('.viiveo-loader');
    loaderDiv.style.display = 'block';
    const observationModal = document.getElementById('observationModal');
    if (observationModal) observationModal.style.display = 'none'; // Cacher la modale pendant le chargement

    const submitUrl = new URL(window.webAppUrl);
    submitUrl.searchParams.append('type', 'ficheobservation'); // Type pour l'API Apps Script

    // Ajouter les données de la mission et du prestataire
    submitUrl.searchParams.append('missionId', currentMissionId);
    submitUrl.searchParams.append('prenomClient', currentClientPrenom);
    submitUrl.searchParams.append('nomClient', currentClientNom);
    submitUrl.searchParams.append('heureDebut', currentHeureDebutReelle); // Heure de début réelle stockée
    submitUrl.searchParams.append('latitude', currentLatitudeDebut); // Latitude de début réelle stockée
    submitUrl.searchParams.append('longitude', currentLongitudeDebut); // Longitude de début réelle stockée
    submitUrl.searchParams.append('prestatairePrenom', window.currentPrenom);
    submitUrl.searchParams.append('prestataireNom', window.currentNom);
    submitUrl.searchParams.append('prestataireEmail', window.currentEmail);

    // Ajouter les données du formulaire
    submitUrl.searchParams.append('obsDate', formData.get('obsDate'));
    submitUrl.searchParams.append('etatSante', formData.get('etatSante'));
    submitUrl.searchParams.append('etatForme', formData.get('etatForme'));
    submitUrl.searchParams.append('environnement', formData.get('environnement'));

    // Gérer les fichiers (photos)
    const files = formData.getAll('photos');
    let fetchOptions = { method: 'POST' };
    let body = new FormData(); // Utiliser un nouveau FormData pour l'envoi

    // Ajouter tous les paramètres à FormData, y compris les fichiers
    for (const [key, value] of submitUrl.searchParams.entries()) {
        body.append(key, value);
    }
    files.forEach((file, index) => {
        if (file.size > 0) { // S'assurer que le fichier n'est pas vide
            body.append('photos', file, file.name); // 'photos' doit correspondre à e.parameters.photos dans Apps Script
        }
    });
    fetchOptions.body = body;

    console.log("Envoi de la fiche d'observation à l'URL:", submitUrl.toString());

    try {
        // Pour les requêtes POST avec FormData (y compris les fichiers), on utilise fetch standard
        // et non JSONP, car JSONP ne supporte pas les requêtes POST avec corps.
        // L'URL de déploiement doit être configurée pour accepter les requêtes POST.
        const response = await fetch(window.webAppUrl, fetchOptions);
        const data = await response.json(); // Assurez-vous que votre doPost renvoie du JSON

        console.log("Réponse de l'API ficheobservation:", data);

        if (data.success) {
            showMessage('Fiche d\'observation envoyée et mission clôturée !', 'success');
            if (observationModal) observationModal.remove(); // Ferme la modale
            await window.loadMissions(); // Recharge les missions pour voir le statut "terminée"
        } else {
            showMessage(data.message || 'Erreur lors de l\'envoi de la fiche.', 'error');
            if (observationModal) observationModal.style.display = 'flex'; // Réaffiche la modale en cas d'erreur
        }
    } catch (error) {
        console.error("Erreur lors de l'appel API ficheobservation:", error);
        showMessage('Erreur de communication avec le serveur lors de l\'envoi de la fiche.', 'error');
        if (observationModal) observationModal.style.display = 'flex'; // Réaffiche la modale en cas d'erreur
    } finally {
        loaderDiv.style.display = 'none';
    }
}


// --- Initialisation ---

// Point d'entrée principal du script
// Utilisez window.onload pour vous assurer que tout le DOM est complètement chargé
// avant d'initialiser les écouteurs et d'injecter du HTML.
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded déclenché. Initialisation de l'application...");

    // Injecte le HTML de la modale dynamiquement via JavaScript
    createAndInjectModalHtml();

    // Initialise les écouteurs du formulaire de connexion et de la modale
    initializeLoginForm();
    initializeModalListeners(); // Appelé directement car le HTML de la modale est maintenant injecté
});

// Fonctions utilitaires génériques (déplacées ici pour éviter les conflits de portée)
function show(element, isVisible) {
    if (element) {
        element.style.display = isVisible ? 'block' : 'none';
    }
}

function clearForm(formElement) {
    if (!formElement) return;
    Array.from(formElement.elements).forEach(el => {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            el.value = '';
        } else if (el.tagName === 'SELECT') {
            el.selectedIndex = 0;
        }
    });
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

// Nouvelle fonction pour initialiser les écouteurs de la modale d'observation
function initializeModalListeners() {
    const observationModal = document.getElementById('observationModal');
    const closeButton = document.getElementById('closeObservationModal');
    const observationForm = document.getElementById('observationForm');
    const obsDateInput = document.getElementById('obsDate');
    const photosInput = document.getElementById('photos');
    const photosPreview = document.getElementById('photosPreview');

    if (!observationModal || !closeButton || !observationForm || !obsDateInput) {
        console.warn("Certains éléments de la modale d'observation sont manquants. Retrying initialization...");
        setTimeout(initializeModalListeners, 100); // Retry after 100ms
        return;
    }

    // Pré-remplir la date d'observation avec la date du jour
    const today = new Date();
    obsDateInput.value = today.toISOString().split('T')[0];

    closeButton.addEventListener('click', () => {
        observationModal.remove();
        currentMissionId = null;
        currentClientPrenom = null;
        currentClientNom = null;
        currentHeureDebutReelle = null;
        currentLatitudeDebut = null;
        currentLongitudeDebut = null;
        console.log("Modale d'observation fermée manuellement.");
    });

    observationForm.addEventListener('submit', submitObservationForm);
    console.log("Écouteurs de la modale d'observation initialisés.");

    // Photos preview listener - Vérifiez si les éléments de prévisualisation existent
    if (photosInput && photosPreview) {
        photosInput.addEventListener("change", e => {
            photosPreview.innerHTML = "";
            const files = e.target.files;
            if (files.length > 3) {
                alert("Vous ne pouvez sélectionner que 3 photos max."); // Utilisez une modale personnalisée si possible
                photosInput.value = "";
                return;
            }
            Array.from(files).forEach(file => {
                const reader = new FileReader();
                reader.onload = ev => {
                    const img = document.createElement("img");
                    img.src = ev.target.result;
                    img.style.maxWidth = "100px"; // Style pour la prévisualisation
                    img.style.maxHeight = "100px";
                    img.style.margin = "5px";
                    photosPreview.appendChild(img);
                };
                reader.readAsDataURL(file);
            });
        });
    } else {
        console.warn("Éléments de prévisualisation des photos (photosInput ou photosPreview) manquants.");
    }
}

// Nouvelle fonction pour initialiser les écouteurs du formulaire de connexion
function initializeLoginForm() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', window.login);
        console.log("Écouteur du formulaire de connexion initialisé pour submit.");
    } else {
        console.error("Formulaire de connexion (loginForm) introuvable. Vérifiez l'ID dans Embed 2.");
    }
}

// Fonction pour créer et injecter le HTML de la modale dynamiquement
function createAndInjectModalHtml() {
    const modalHtml = `
        <div id="observationModal" class="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-md relative overflow-y-auto max-h-[90vh]">
                <h2 class="text-2xl font-bold mb-4 text-center">Fiche d'Observation</h2>
                <button id="closeObservationModal" class="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                
                <p class="mb-2"><strong>Mission ID:</strong> <span id="modalMissionId">${currentMissionId || 'N/A'}</span></p>
                <p class="mb-4"><strong>Client:</strong> <span id="modalClientName">${currentClientPrenom || ''} ${currentClientNom || ''}</span></p>
                
                <form id="observationForm" class="space-y-4">
                    <div>
                        <label for="obsDate" class="block text-sm font-medium text-gray-700">Date d'Observation:</label>
                        <input type="date" id="obsDate" name="obsDate" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" required>
                    </div>
                    <div>
                        <label for="etatSante" class="block text-sm font-medium text-gray-700">État de Santé:</label>
                        <textarea id="etatSante" name="etatSante" rows="4" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" placeholder="Décrivez l'état de santé du client..." required></textarea>
                    </div>
                    <div>
                        <label for="etatForme" class="block text-sm font-medium text-gray-700">État de Forme:</label>
                        <input type="text" id="etatForme" name="etatForme" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" placeholder="Ex: Bonne, Fatigué..." required>
                    </div>
                    <div>
                        <label for="environnement" class="block text-sm font-medium text-gray-700">Environnement:</label>
                        <textarea id="environnement" name="environnement" rows="4" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" placeholder="Décrivez l'environnement de la mission..." required></textarea>
                    </div>
                    <div>
                        <label for="photos" class="block text-sm font-medium text-gray-700">Photos (optionnel):</label>
                        <input type="file" id="photos" name="photos" accept="image/*" multiple class="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100">
                    </div>
                    
                    <button type="submit" class="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50">
                        Clôturer la Mission et Envoyer la Fiche
                    </button>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    console.log("Modal HTML injected dynamically via JS.");
}
