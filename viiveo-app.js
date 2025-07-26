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

    if (!modalOverlay || !stepQR || !stepForm || !stepSuccess) {
        console.error("Erreur: Éléments de la modale non trouvés lors de l'ouverture.");
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
    // IMPORTANT : On masque toutes les étapes d'abord pour éviter les flashs.
    // stepQR.style.display sera mis à "flex" dans startQrScanner()
    stepQR.style.display = "none";
    stepForm.style.display = "none";
    stepSuccess.style.display = "none";
    modalOverlay.style.display = "flex"; // Rend la modale visible

    // Démarre le scanner APRES que la modale est rendue visible
    // Un léger délai peut être bénéfique ici aussi pour s'assurer que le DOM est "peint"
    // avant que html5-qrcode ne tente d'accéder à l'élément.
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
    // Arrête le scanner si une instance est active
    // Correction: Utilisez isScanning seulement si qrScannerInstance n'est pas null
    if (qrScannerInstance && typeof qrScannerInstance.stop === 'function') {
        qrScannerInstance.stop().catch(err => console.warn("Erreur à l'arrêt du scanner:", err));
    }
    qrScannerInstance = null; // Nettoyer la référence de manière inconditionnelle après tentative d'arrêt
}

async function startQrScanner() {
    const qrReaderElement = document.getElementById("qr-reader");
    if (!qrReaderElement) {
        console.error("Élément 'qr-reader' non trouvé. Le scanner ne peut pas démarrer.");
        alert("Erreur: Le scanner QR ne peut pas démarrer (élément manquant).");
        closeModal();
        return;
    }

    // Assurez-vous que l'élément conteneur du scanner est visible avant de le démarrer.
    // Il est dans stepQR, donc stepQR doit être visible.
    const stepQR = document.getElementById("stepQR");
    if (stepQR) {
        stepQR.style.display = "flex"; // S'assure que stepQR est visible pour le scanner
    }

    // Nettoie l'élément avant de redémarrer le scanner.
    // C'est très important pour éviter les problèmes si le scanner a été arrêté/redémarré.
    qrReaderElement.innerHTML = "";

    // Si une instance existe déjà et est active, arrêtez-la et mettez-la à null pour éviter les conflits
    if (qrScannerInstance && typeof qrScannerInstance.stop === 'function') {
        try {
            await qrScannerInstance.stop();
            console.log("Ancienne instance du scanner arrêtée.");
        } catch (error) {
            console.warn("Erreur lors de l'arrêt d'une ancienne instance de scanner:", error);
        } finally {
            qrScannerInstance = null; // Nettoyage de l'instance, même si l'arrêt a échoué
        }
    }

    // Crée une nouvelle instance du scanner et la stocke pour pouvoir l'arrêter
    qrScannerInstance = new Html5Qrcode("qr-reader"); // Affectation à la variable globale

    console.log("Tentative de démarrage du scanner QR..."); // AJOUTÉ POUR LE DÉBOGAGE

    try {
        await qrScannerInstance.start( // Utilisez la variable globale ici
            { facingMode: "environment" }, // Utilise la caméra arrière
            {
                fps: 10, // Nombre d'images par seconde pour scanner
                qrbox: { width: 250, height: 250 }, // Taille du carré de détection (utilisez l'objet pour html5-qrcode v2.x)
                aspectRatio: 1.333334 // Recommandé pour stabiliser le flux vidéo
            },
            async (decodedText, decodedResult) => { // Ajout de decodedResult pour cohérence
                // Cette fonction est appelée quand un QR code est détecté
                console.log(`QR Code détecté: ${decodedText}`);
                try {
                    // Arrête le scanner immédiatement après la détection
                    if (qrScannerInstance && typeof qrScannerInstance.stop === 'function') {
                        await qrScannerInstance.stop();
                        qrScannerInstance = null; // Réinitialise l'instance
                        console.log("Scanner arrêté après détection réussie.");
                    }

                    // Votre logique de traitement du QR code ici
                    const url = new URL(decodedText);
                    const idClient = url.searchParams.get("idclient") || url.searchParams.get("clientId");
                    if (!idClient) throw new Error("QR invalide : idclient manquant");

                    console.log("ID Client extrait:", idClient);
                    console.log("Email prestataire global (window.currentEmail):", window.currentEmail);
                    console.log("URL Apps Script globale (window.webAppUrl):", window.webAppUrl);

                    const fullAppsScriptApiUrl = `${window.webAppUrl}?type=verifqr&idclient=${encodeURIComponent(idClient)}&email=${encodeURIComponent(window.currentEmail)}`;
                    console.log("URL COMPLETE ENVOYEE AU BACKEND:", fullAppsScriptApiUrl);

                    const callbackName = 'cbVerifyClient' + Date.now();
                    const data = await callApiJsonp(fullAppsScriptApiUrl, callbackName);

                    if (!data.success) {
                        alert("❌ " + data.message);
                        closeModal();
                        return;
                    }

                    heureDebut = new Date().toISOString();
                    getGeolocationAndShowForm();

                } catch (err) {
                    alert("Erreur lors du scan QR : " + (err.message || "Erreur inconnue")); // Utilise err.message ou une string générique
                    console.error("Erreur dans startQrScanner (callback de succès - détails complètes):", err); // Détail du log
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
        // TRÈS IMPORTANT: Afficher l'objet d'erreur complet ici
        console.error("Erreur d'initialisation de la caméra (détails complètes):", err);
        closeModal();
    }
}

function getGeolocationAndShowForm() {
    if (!navigator.geolocation) {
        alert("❌ Votre appareil ne supporte pas la géolocalisation.");
        closeModal();
        return;
    }

    navigator.geolocation.getCurrentPosition(
        position => {
            currentLatitude = position.coords.latitude;
            currentLongitude = position.coords.longitude;
            showForm();
        },
        error => {
            let message = "⚠️ Erreur de géolocalisation.";
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    message = "❌ Vous devez autoriser la géolocalisation pour continuer.";
                    break;
                case error.POSITION_UNAVAILABLE:
                    message = "📍 Position non disponible.";
                    break;
                case error.TIMEOUT:
                    message = "⏱️ Le délai de localisation est dépassé.";
                    break;
                default:
                    message = "❌ Erreur inconnue.";
            }
            alert(message);
            console.error("Erreur de géolocalisation:", error);
            closeModal();
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
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
        // Utilisation de querySelector pour être plus robuste si l'ID n'est pas unique
        if (document.querySelector("#btnCancelQR")) document.querySelector("#btnCancelQR").onclick = closeModal;
        if (document.querySelector("#btnCancelForm")) document.querySelector("#btnCancelForm").onclick = closeModal;
        if (document.querySelector("#btnCloseSuccess")) document.querySelector("#btnCloseSuccess").onclick = closeModal;

        console.log("Écouteurs de la modale d'observation initialisés.");

    } else {
        console.warn("Certains éléments de la modale d'observation sont manquants. Nouvelle tentative d'initialisation des écouteurs de modale...");
        // Si les éléments ne sont pas là, relancez l'initialisation après un court délai
        // C'est utile si le HTML est injecté après le premier DOMContentLoaded.
        setTimeout(initializeModalListeners, 100);
    }
}

function initializeLoginForm() {
    const loginForm = document.getElementById("loginForm");
    console.log("DEBUG initializeLoginForm: loginForm element:", loginForm); // NOUVEAU LOG
    console.log("DEBUG initializeLoginForm: typeof login:", typeof login); // NOUVEAU LOG

    if (loginForm && typeof login === 'function') {
        // Supprimez l'écouteur précédent pour éviter les doublons si la fonction est appelée plusieurs fois
        loginForm.removeEventListener("submit", login); // Supprime l'écouteur si déjà présent
        loginForm.addEventListener("submit", login);
        console.log("Écouteur de soumission ajouté au formulaire de connexion.");
    } else {
        console.warn("Formulaire de connexion ou fonction 'login' non disponible. Nouvelle tentative...");
        setTimeout(initializeLoginForm, 200); // Réessaie si le formulaire n'est pas encore là
    }
}

// Cette fonction crée et injecte le HTML de la modale dynamiquement
function createAndInjectModalHtml() {
    // Correction: Retiré tous les styles inline sauf le display initial,
    // pour que le CSS externe (viiveo-styles.css) prenne le relais.
    const modalHtml = `
        <div id="modalOverlay" style="display: none;">
            <div id="modalContent">
                <div id="stepQR" style="display:none;">
                    <h2>📸 Scanner le QR code client</h2>
                    <div id="qr-reader"></div>
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
    // Injecte le HTML à la fin du corps du document
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    console.log("Modal HTML injected dynamically via JS.");

    // Correction: Ce setTimeout n'est plus nécessaire ici.
    // Les styles par défaut sont gérés par le CSS externe,
    // et openModalStartPrestation gère l'affichage initial.
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
