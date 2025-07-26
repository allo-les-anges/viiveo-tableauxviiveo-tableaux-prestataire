// viiveo-app.js

// --- Variables Globales ---
// Ces variables sont définies dans Embed 1, mais sont répétées ici pour clarté
// Assurez-vous qu'elles ne sont pas redéclarées avec 'let' ou 'const' si elles le sont déjà dans Embed 1
// window.webAppUrl = "https://script.google.com/macros/s/AKfycbzEEZZnZJK1BEXlCk81ogi0Aa7MFGunOkjS5s2CCDIZPSkHq0OtPAcEBLrkXp-fpb8aaQ/exec";
// window.currentEmail = null;
// window.currentPrenom = null;
// window.currentNom = null;

// Nouvelles variables globales pour le workflow de la mission
window.currentMissionId = null;
window.currentClientPrenom = null;
window.currentClientNom = null;
window.currentHeureDebutReelle = null; // Stocke l'heure de début réelle de la mission (ISO string)
window.currentLatitudeDebut = null;
window.currentLongitudeDebut = null;

let html5QrCodeScanner = null; // Variable pour stocker l'instance du scanner QR

// --- Fonctions Utilitaires ---

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

// --- Fonctions de Connexion et Chargement des Missions ---

/**
 * Gère la connexion du prestataire.
 */
async function login() {
    console.log("LOGIN: Fonction login() appelée.");
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const messageDiv = document.getElementById('message');
    const loaderDiv = document.querySelector('.viiveo-loader');
    const loginDiv = document.querySelector('.viiveo-login');
    const missionsDiv = document.querySelector('.viiveo-missions');

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
            await loadMissions(); // Appel direct de loadMissions après la connexion réussie
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
}

/**
 * Charge les missions pour le prestataire connecté.
 */
async function loadMissions() {
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
            renderMissions(data.missions);
            console.log("LOAD MISSIONS: Tableaux de missions rendus avec succès.");
        } else {
            showMessage(data.message || 'Aucune mission trouvée.', 'info');
            renderMissions([]); // Affiche des tableaux vides
            console.log("LOAD MISSIONS: Aucune mission ou erreur dans la réponse.");
        }
    } catch (error) {
        console.error("LOAD MISSIONS: Erreur lors de l'appel API des missions:", error);
        showMessage('Erreur lors du chargement des missions.', 'error');
    } finally {
        loaderDiv.style.display = 'none';
    }
}

/**
 * Rend les missions dans les sections appropriées du DOM.
 * @param {Array<Object>} missions La liste des missions.
 */
function renderMissions(missions) {
    console.log("RENDER MISSIONS: Début du rendu des missions.");
    const missionsAttenteDiv = document.getElementById('missions-attente');
    const missionsAVenirDiv = document.getElementById('missions-a-venir');
    const missionsTermineesDiv = document.getElementById('missions-terminees');

    if (!missionsAttenteDiv || !missionsAVenirDiv || !missionsTermineesDiv) {
        console.error("RENDER MISSIONS: Un ou plusieurs conteneurs de missions sont introuvables dans le DOM.");
        showMessage("Erreur d'affichage: Conteneurs de missions manquants.", "error");
        return;
    }

    missionsAttenteDiv.innerHTML = '';
    missionsAVenirDiv.innerHTML = '';
    missionsTermineesDiv.innerHTML = '';
    console.log("RENDER MISSIONS: Conteneurs de missions vidés.");

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Pour comparer uniquement la date

    missions.forEach(mission => {
        // Logique de parsing de date plus robuste si mission.date n'est pas toujours un objet Date
        let missionDate;
        if (mission.date instanceof Date) {
            missionDate = mission.date;
        } else if (typeof mission.date === 'string') {
            missionDate = new Date(mission.date);
        } else {
            console.warn(`RENDER MISSIONS: Date de mission invalide pour ID ${mission.id}:`, mission.date);
            missionDate = new Date(); // Fallback
        }
        missionDate.setHours(0, 0, 0, 0);

        const missionElement = document.createElement('div');
        // Ajout de styles inline pour assurer la visibilité et un fond blanc
        missionElement.className = 'mission-card p-4 mb-3 rounded-lg shadow-md'; // Tailwind classes
        missionElement.style.backgroundColor = '#ffffff'; // Force le fond blanc
        missionElement.style.border = '1px solid #e0e0e0'; // Ajoute une bordure légère
        missionElement.style.padding = '1rem'; // Ajoute du padding
        missionElement.style.marginBottom = '0.75rem'; // Ajoute de la marge en bas
        missionElement.style.borderRadius = '0.5rem'; // Arrondit les coins
        missionElement.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'; // Ajoute une ombre
        
        missionElement.innerHTML = `
            <p class="text-lg font-semibold">ID Mission: ${mission.id}</p>
            <p>Client: ${mission.client}</p>
            <p>Service: ${mission.service}</p>
            <p>Date: ${mission.date} à ${mission.heure}</p>
            <p>Statut: <span class="font-bold ${mission.statut === 'confirmée' ? 'text-blue-600' : (mission.statut === 'en cours' ? 'text-orange-600' : 'text-green-600')}">${mission.statut}</span></p>
            <button class="scan-qr-button mt-3 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                    data-mission-id="${mission.id}"
                    data-client-id="${mission.idClientQR || ''}"
                    data-client-prenom="${mission.prenomClient || ''}"
                    data-client-nom="${mission.nomClient || ''}"
                    data-heure-debut-reelle="${mission.heureDebutReelle || ''}"
                    data-latitude-debut="${mission.latitudeDebut || ''}"
                    data-longitude-debut="${mission.longitudeDebut || ''}">
                Scanner QR
            </button>
        `;

        const scanButton = missionElement.querySelector('.scan-qr-button');
        scanButton.addEventListener('click', () => {
            console.log(`RENDER MISSIONS: Bouton Scanner QR cliqué pour mission ${mission.id}`);
            // Stocker les infos de la mission dans des variables globales temporaires avant le scan
            window.currentMissionId = scanButton.dataset.missionId;
            window.currentClientPrenom = scanButton.dataset.clientPrenom;
            window.currentClientNom = scanButton.dataset.clientNom;
            window.currentHeureDebutReelle = scanButton.dataset.heureDebutReelle;
            window.currentLatitudeDebut = scanButton.dataset.latitudeDebut;
            window.currentLongitudeDebut = scanButton.dataset.longitudeDebut;

            startQrScanner(); // Démarrer le scanner
        });

        if (mission.statut === 'confirmée') {
            missionsAttenteDiv.appendChild(missionElement);
            console.log(`RENDER MISSIONS: Mission ${mission.id} ajoutée à missions-attente.`);
        } else if (mission.statut === 'en cours') {
            missionsAVenirDiv.appendChild(missionElement);
            console.log(`RENDER MISSIONS: Mission ${mission.id} ajoutée à missions-a-venir.`);
        } else if (mission.statut === 'terminée') {
            missionsTermineesDiv.appendChild(missionElement);
            console.log(`RENDER MISSIONS: Mission ${mission.id} ajoutée à missions-terminees.`);
        } else {
            console.warn(`RENDER MISSIONS: Statut de mission inconnu pour ID ${mission.id}: ${mission.statut}. Non affichée.`);
        }
    });
    console.log("RENDER MISSIONS: Fin du rendu des missions.");
}


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

    html5QrCodeScanner = new Html5Qrcode("qr-code-reader"); // Initialise le scanner sur l'élément créé dans la modale
    html5QrCodeScanner.start(
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
        if (html5QrCodeScanner && html5QrCodeScanner.isScanning) { // Correction: isScanning est la bonne propriété
             html5QrCodeScanner.stop().catch(err => console.warn("Erreur à l'arrêt du scanner:", err));
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

    if (html5QrCodeScanner && html5QrCodeScanner.isScanning) {
        await html5QrCodeScanner.stop().catch(err => console.warn("Erreur à l'arrêt du scanner:", err));
        console.log("Scanner arrêté après détection réussie.");
    }
    if (scannerModal) {
        scannerModal.remove(); // Ferme la modale du scanner
        console.log("Modale du scanner fermée.");
    }

    // Extraire les paramètres de l'URL du QR code
    const url = new URL(qrData);
    const idClientQR = url.searchParams.get('idclient') || url.searchParams.get('clientId');
    // L'email du prestataire peut aussi être dans le QR, mais nous utilisons window.currentEmail pour la cohérence
    // const emailFromQR = url.searchParams.get('email');

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
                            await loadMissions(); // Recharger les missions pour mettre à jour l'affichage
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

                            openObservationModal(); // Ouvrir la modale de fiche d'observation
                        } else if (data.missionStatus === 'completed') {
                            // Mission déjà terminée
                            showMessage(data.message, 'info');
                            console.log("Mission déjà terminée, rechargement des missions...");
                            await loadMissions(); // Rafraîchir au cas où
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
function openObservationModal() {
    console.log("Ouverture de la modale d'observation...");
    const modalHtml = `
        <div id="observationModal" class="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-md relative overflow-y-auto max-h-[90vh]">
                <h2 class="text-2xl font-bold mb-4 text-center">Fiche d'Observation</h2>
                <button id="closeObservationModal" class="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                
                <p class="mb-2"><strong>Mission ID:</strong> <span id="modalMissionId">${window.currentMissionId || 'N/A'}</span></p>
                <p class="mb-4"><strong>Client:</strong> <span id="modalClientName">${window.currentClientPrenom || ''} ${window.currentClientNom || ''}</span></p>
                
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
        window.currentMissionId = null;
        window.currentClientPrenom = null;
        window.currentClientNom = null;
        window.currentHeureDebutReelle = null;
        window.currentLatitudeDebut = null;
        window.currentLongitudeDebut = null;
        console.log("Modale d'observation fermée manuellement.");
    });

    observationForm.addEventListener('submit', submitObservationForm);
    console.log("Écouteurs de la modale d'observation initialisés.");
}

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
    submitUrl.searchParams.append('missionId', window.currentMissionId);
    submitUrl.searchParams.append('prenomClient', window.currentClientPrenom);
    submitUrl.searchParams.append('nomClient', window.currentClientNom);
    submitUrl.searchParams.append('heureDebut', window.currentHeureDebutReelle); // Heure de début réelle stockée
    submitUrl.searchParams.append('latitude', window.currentLatitudeDebut); // Latitude de début réelle stockée
    submitUrl.searchParams.append('longitude', window.currentLongitudeDebut); // Longitude de début réelle stockée
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
            await loadMissions(); // Recharge les missions pour voir le statut "terminée"
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

// Attendre que le DOM soit complètement chargé
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM entièrement chargé.");

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', login);
        console.log("Écouteur du formulaire de connexion initialisé.");
    } else {
        console.error("Formulaire de connexion (loginForm) introuvable.");
    }
});

// initializeModalListeners n'est plus nécessaire car les écouteurs sont ajoutés directement dans openObservationModal
// au moment où la modale est créée.
