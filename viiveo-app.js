// viiveo-app.js 050825 10:30 (Mise à jour pour envoi de photos en Base64)
// CORRECTION : Vérification de la page pour empêcher le scanner automatique

// =============================================
// VÉRIFICATION INITIALE - NE PAS EXÉCUTER SUR LES PAGES NON-PRESTATAIRES
// =============================================
(function() {
    // Vérifier si nous sommes sur une page prestataire
    const isPrestatairePage = window.location.pathname.includes('iprestataires') || 
                             window.location.pathname.includes('prestataire') ||
                             document.querySelector('.viiveo-prestataire-interface') ||
                             document.getElementById('loginForm');
    
    // Si ce n'est pas une page prestataire, arrêter l'exécution du script
    if (!isPrestatairePage) {
        console.log('🚫 viiveo-app.js: Page non prestataire détectée, script désactivé');
        
        // Désactiver les fonctions principales pour éviter tout comportement indésirable
        window.openModalStartPrestation = function() {
            console.log('🚫 Scanner désactivé sur cette page');
        };
        window.openModalCloturerPrestation = function() {
            console.log('🚫 Scanner désactivé sur cette page');
        };
        window.startQrScanner = function() {
            console.log('🚫 Scanner QR désactivé sur cette page');
            return Promise.reject(new Error('Scanner désactivé'));
        };
        
        return; // Arrête l'exécution du script
    }
    
    console.log('✅ viiveo-app.js: Page prestataire détectée, script activé');
})();

// =============================================
// CODE EXISTANT (s'exécute seulement sur les pages prestataires)
// =============================================

// Variables globales pour l'état de la mission et du prestataire
let currentMissionId = null;
let currentClientPrenom = "", currentClientNom = "";
let currentPrestatairePrenom = null, currentPrestataireNom = null;
let currentLatitude = null, currentLongitude = null;
let heureDebut = null;

// Ajoutez cette variable globale pour l'instance du scanner.
let qrScannerInstance = null;

window.webAppUrl = "https://gaetano1747.gm-harchies.workers.dev"; // URL de votre Cloudflare Worker

function setTodayDate(obsDateInput) {
    if (obsDateInput) {
        obsDateInput.value = new Date().toISOString().split("T")[0];
    }
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

function closeModal() {
    const modalOverlay = document.getElementById("modalOverlay");
    const fullScreenLoader = document.getElementById("fullScreenLoader"); // Récupération du loader plein écran

    if (modalOverlay) {
        modalOverlay.style.display = "none";
    }
    if (fullScreenLoader) { // S'assurer que le loader plein écran est masqué
        fullScreenLoader.style.display = "none";
        fullScreenLoader.style.opacity = '0'; // Assurez-vous que l'opacité est aussi à 0
    }
    clearFormFields();

    const geolocationMessage = document.getElementById("geolocationMessage");
    if (geolocationMessage) {
        geolocationMessage.style.display = "none";
        geolocationMessage.textContent = "";
    }
    if (qrScannerInstance && typeof qrScannerInstance.stop === 'function') {
        qrScannerInstance.stop().catch(err => console.warn("Erreur à l'arrêt du scanner:", err));
    }
    qrScannerInstance = null;
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
    clientNameInput.value = `${currentClientPrenom} ${currentClientNom}`.trim();
    if (clientNameInput.value === "") {
        clientNameInput.value = "Client inconnu";
    }
    setTodayDate(obsDateInput);
}

function getGeolocationAndShowForm() {
    const geolocationMessage = document.getElementById("geolocationMessage");

    if (!window.currentLatitude || !window.currentLongitude) {
        if (geolocationMessage) {
            geolocationMessage.textContent = "❌ La géolocalisation a échoué. Veuillez réessayer de scanner le QR.";
            geolocationMessage.style.display = "block";
            geolocationMessage.style.color = "#d32f2f";
        }
        return;
    }
    showForm();
}

async function startQrScanner() {
    const qrReaderElement = document.getElementById("qr-reader");
    const geolocationMessage = document.getElementById("geolocationMessage");
    const stepQR = document.getElementById("stepQR");
    const qrScannerLoader = document.getElementById("qrScannerLoader"); // Récupération du loader du scanner

    if (!qrReaderElement || !stepQR || !geolocationMessage || !qrScannerLoader) {
        console.error("Éléments 'qr-reader' ou loader non trouvés. Le scanner ne peut pas démarrer.");
        alert("Erreur: Le scanner QR ne peut pas démarrer (élément manquant).");
        closeModal();
        return;
    }
    stepQR.style.display = "flex";
    qrReaderElement.innerHTML = "";

    if (qrScannerInstance && typeof qrScannerInstance.stop === 'function') {
        try {
            await qrScannerInstance.stop();
        } catch (error) {
            console.warn("Erreur à l'arrêt du scanner:", error);
        } finally {
            qrScannerInstance = null;
        }
    }

    qrScannerInstance = new Html5Qrcode("qr-reader");
    console.log("Tentative de démarrage du scanner QR...");

    try {
        await qrScannerInstance.start(
            { facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.333334 },
            async (decodedText, decodedResult) => {
                console.log(`QR Code détecté: ${decodedText}`);
                try {
                    if (qrScannerInstance && typeof qrScannerInstance.stop === 'function') {
                        await qrScannerInstance.stop();
                        qrScannerInstance = null;
                        console.log("Scanner arrêté après détection réussie.");
                    }
                    const url = new URL(decodedText);
                    const idClient = url.searchParams.get("idclient") || url.searchParams.get("clientId");
                    if (!idClient) throw new Error("QR invalide : idclient manquant");

                    if (qrScannerLoader) window.show(qrScannerLoader, true); // Afficher le loader avant la géolocalisation et l'appel API

                    if (navigator.geolocation) {
                        try {
                            const position = await new Promise((resolve, reject) => {
                                navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
                            });
                            window.currentLatitude = position.coords.latitude;
                            window.currentLongitude = position.coords.longitude;
                            if (geolocationMessage) geolocationMessage.style.display = "none";
                        } catch (geoError) {
                            let geoMessage = "❌ Géolocalisation requise.";
                            switch (geoError.code) {
                                case geoError.PERMISSION_DENIED: geoMessage = "❌ Vous devez autoriser la géolocalisation."; break;
                                case geoError.POSITION_UNAVAILABLE: geoMessage = "📍 Position non disponible."; break;
                                case geoError.TIMEOUT: geoMessage = "⏱️ Le délai de localisation est dépassé."; break;
                            }
                            if (geolocationMessage) {
                                geolocationMessage.textContent = geoMessage;
                                geolocationMessage.style.display = "block";
                                geolocationMessage.style.color = "#d32f2f";
                            }
                            if (qrScannerLoader) window.show(qrScannerLoader, false); // Masquer le loader en cas d'erreur de géolocalisation
                            return; // Sortir si la géolocalisation échoue
                        }
                    } else {
                        if (geolocationMessage) {
                            geolocationMessage.textContent = "❌ Géolocalisation non supportée.";
                            geolocationMessage.style.display = "block";
                            geolocationMessage.style.color = "#d32f2f";
                        }
                        if (qrScannerLoader) window.show(qrScannerLoader, false); // Masquer le loader si la géolocalisation n'est pas supportée
                        return; // Sortir si la géolocalisation n'est pas supportée
                    }

                    const fullAppsScriptApiUrl = `${window.webAppUrl}?type=verifqr&idclient=${encodeURIComponent(idClient)}&email=${encodeURIComponent(window.currentEmail)}&latitude=${encodeURIComponent(window.currentLatitude || 'null')}&longitude=${encodeURIComponent(window.currentLongitude || 'null')}`;
                    const callbackName = 'cbVerifyClient' + Date.now();
                    const data = await window.callApiJsonp(fullAppsScriptApiUrl, callbackName);

                    if (qrScannerLoader) window.show(qrScannerLoader, false); // Masquer le loader après l'appel API

                    if (!data.success) {
                        alert("❌ " + data.message);
                        closeModal();
                        return;
                    }

                    if (data.missionStatus === "started") {
                        window.heureDebut = new Date().toISOString();
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
                    if (qrScannerLoader) window.show(qrScannerLoader, false); // Masquer le loader en cas d'erreur
                    closeModal();
                }
            },
            (errorMessage) => {}
        );
        console.log("Scanner QR démarré avec succès.");
    } catch (err) {
        alert("Impossible d’activer la caméra. Assurez-vous d'avoir donné les permissions.");
        console.error("Erreur d'initialisation de la caméra (détails complètes):", err);
        if (qrScannerLoader) window.show(qrScannerLoader, false); // Masquer le loader en cas d'erreur
        closeModal();
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
    window.currentMissionId = missionId;
    currentClientPrenom = clientPrenom || "";
    currentClientNom = clientNom || "";
    currentPrestatairePrenom = window.currentPrenom;
    currentPrestataireNom = window.currentNom;

    stepQR.style.display = "none";
    stepForm.style.display = "none";
    stepSuccess.style.display = "none";
    geolocationMessage.style.display = "none";
    geolocationMessage.textContent = "";
    modalOverlay.style.display = "flex";

    setTimeout(() => {
        startQrScanner();
    }, 50);
}

window.openModalCloturerPrestation = function(missionId, clientPrenom, clientNom) {
    console.log(`Ouverture de la modale pour la clôture de la mission ${missionId}`);
    
    const modalOverlay = document.getElementById("modalOverlay");
    const stepQR = document.getElementById("stepQR");
    const stepForm = document.getElementById("stepForm");
    const stepSuccess = document.getElementById("stepSuccess");

    if (!modalOverlay || !stepQR || !stepForm || !stepSuccess) {
      console.error("Erreur: Éléments de la modale non trouvés lors de l'ouverture pour clôture.");
      alert("Une erreur est survenue lors de l'ouverture de la modale. Veuillez recharger la page.");
      return;
    }
    
    if (qrScannerInstance && typeof qrScannerInstance.stop === 'function') {
      qrScannerInstance.stop().catch(err => console.warn("Erreur à l'arrêt du scanner:", err));
      qrScannerInstance = null;
    }

    stepQR.style.display = "none";
    stepForm.style.display = "none";
    stepSuccess.style.display = "none";
    modalOverlay.style.display = "flex";
    
    window.currentMissionId = missionId;
    currentClientPrenom = clientPrenom || "";
    currentClientNom = clientNom || "";
    
    setTimeout(() => {
        startQrScanner();
    }, 50);
};
    
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

/**
 * Compresses an image file.
 * @param {File} file The image file to compress.
 * @param {number} maxWidth The maximum width for the compressed image.
 * @param {number} maxHeight The maximum height for the compressed image.
 * @param {number} quality The compression quality (0 to 1).
 * @returns {Promise<string>} A promise that resolves with the Base64 data URL of the compressed image.
 */
async function compressImage(file, maxWidth = 800, maxHeight = 600, quality = 0.7) { // Qualité par défaut à 0.7
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions while maintaining aspect ratio
                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert canvas content to data URL (Base64) with specified quality
                const dataUrl = canvas.toDataURL(file.type, quality);
                resolve(dataUrl);
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
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

    // Récupération des boutons de fermeture/annulation
    const btnCloseSuccess = document.getElementById("btnCloseSuccess");
    const btnCancelForm = document.getElementById("btnCancelForm");
    const btnCancelQR = document.getElementById("btnCancelQR");

    // Récupération du loader plein écran
    const fullScreenLoader = document.getElementById("fullScreenLoader");
    console.log("initializeModalListeners: fullScreenLoader element found:", !!fullScreenLoader); // Log de vérification

    if (modalOverlay && stepQR && stepForm && stepSuccess && obsForm && photosInput && photosPreview && clientNameInput && obsDateInput && etatSanteInput && etatFormeInput && environnementInput && btnCloseSuccess && btnCancelForm && btnCancelQR && fullScreenLoader) {
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
            
            const submitBtn = e.target.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;
            
            // Afficher le loader plein écran juste avant l'envoi de la fiche
            if (fullScreenLoader) {
                fullScreenLoader.style.display = 'flex';
                fullScreenLoader.style.opacity = '1';
                console.log("Loader plein écran affiché.");
            }
            
            try {
                let finalLat = null;
                let finalLon = null;
                try {
                    console.log("Tentative de récupération de la géolocalisation de fin...");
                    const position = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
                    });
                    finalLat = position.coords.latitude;
                    finalLon = position.coords.longitude;
                    console.log("✅ Géolocalisation de fin capturée :", finalLat, finalLon);
                } catch (geoError) {
                    alert("❌ Erreur de géolocalisation pour la clôture. Veuillez réessayer.");
                    console.error("❌ Erreur de géolocalisation de fin:", geoError);
                    if (submitBtn) submitBtn.disabled = false;
                    if (fullScreenLoader) { // Masquer le loader en cas d'erreur de géolocalisation
                        fullScreenLoader.style.display = 'none';
                        fullScreenLoader.style.opacity = '0';
                    }
                    return;
                }
                
                const heureFin = new Date().toISOString();
                
                // MODIFICATION: Compression des images avant conversion en Base64
                const photosBase64 = [];
                const filePromises = Array.from(photosInput.files).map(async file => {
                    try {
                        const compressedDataUrl = await compressImage(file, 1024, 768, 0.7); // Compresser à 1024x768, qualité 70%
                        const base64String = compressedDataUrl.split(',')[1];
                        photosBase64.push({
                            data: base64String,
                            name: file.name,
                            type: file.type
                        });
                    } catch (error) {
                        console.error(`Erreur lors de la compression ou lecture du fichier ${file.name}:`, error);
                        // Ne pas rejeter la promesse ici pour que les autres fichiers puissent être traités
                    }
                });

                await Promise.all(filePromises); // Attendre que toutes les photos soient lues et compressées

                const payload = {
                    type: "envoyerFiche",
                    missionId: window.currentMissionId,
                    prenomClient: window.currentClientPrenom,
                    nomClient: window.currentClientNom,
                    obsDate: obsDateInput.value,
                    etatSante: etatSanteInput.value,
                    etatForme: etatFormeInput.value,
                    environnement: environnementInput.value,
                    latitudeDebut: window.currentLatitude,
                    longitudeDebut: window.currentLongitude,
                    latitudeFin: finalLat,
                    longitudeFin: finalLon,
                    heureDebut: window.heureDebut,
                    heureFin: heureFin,
                    prestatairePrenom: window.currentPrenom,
                    prestataireNom: window.currentNom,
                    prestataireEmail: window.currentEmail,
                    photos: photosBase64
                };
                
                console.log(`➡️ Lancement de la requête fetch pour envoyer la fiche (JSON).`);
                console.log(`Payload JSON (sans les données Base64 complètes pour la console):`, { ...payload, photos: payload.photos.map(p => ({ name: p.name, type: p.type, dataLength: p.data.length })) });

                const json = await sendFormDataRequest(payload, window.webAppUrl);

// Si nous arrivons ici, la requête a réussi (response.ok est TRUE)
// L'objet 'json' contient la réponse parsée du serveur.
// Nous continuons ensuite avec la gestion du succès/échec logique :
    
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
            } finally {
                if (submitBtn) submitBtn.disabled = false;
                if (fullScreenLoader) { // Masquer le loader dans le bloc finally
                    fullScreenLoader.style.display = 'none';
                    fullScreenLoader.style.opacity = '0';
                }
                console.log("Loader plein écran masqué.");
            }
        });

        // Ajout des écouteurs d'événements pour les boutons de fermeture/annulation
        btnCloseSuccess.addEventListener("click", closeModal);
        btnCancelForm.addEventListener("click", closeModal);
        btnCancelQR.addEventListener("click", closeModal);

    }
}

function createAndInjectModalHtml() {
    // Vérifier si l'utilisateur est déjà connecté avant d'injecter la modale
    const isLoggedIn = window.currentEmail && window.currentPrenom && window.currentNom;
    const isLoginPage = document.getElementById('loginForm') && !isLoggedIn;
    
    // Ne pas injecter la modale sur la page de connexion si l'utilisateur n'est pas connecté
    if (isLoginPage) {
        console.log('🚫 Modale scanner non injectée: page de connexion détectée');
        return;
    }

    const modalHtml = `
        <style>
            /* Styles pour les loaders */
            .loader {
                border: 4px solid #f3f3f3; /* Gris clair */
                border-top: 4px solid #3498db; /* Bleu */
                border-radius: 50%;
                width: 20px;
                height: 20px;
                animation: spin 2s linear infinite;
                margin: 10px auto; /* Centrer le loader */
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            /* Styles pour le loader plein écran */
            #fullScreenLoader {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(0, 0, 0, 0.7); /* Fond semi-transparent */
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 1001; /* Assure qu'il est au-dessus des autres éléments, y compris la modale */
                color: white; /* Couleur du texte */
                font-size: 1.2em;
                text-align: center;
                /* Initialement caché via CSS pour une meilleure gestion par JS */
                opacity: 0;
                visibility: hidden; /* Utiliser visibility pour éviter les interactions */
                transition: opacity 0.3s ease-in-out, visibility 0.3s ease-in-out; /* Ajoute une transition douce */
            }
            /* Règle pour afficher le loader */
            #fullScreenLoader.is-visible {
                opacity: 1;
                visibility: visible;
            }

            #fullScreenLoader .loader {
                width: 50px; /* Plus grand pour le loader central */
                height: 50px;
                border-width: 6px;
            }
            #fullScreenLoader p {
                margin-top: 15px;
            }

            /* Styles spécifiques pour la modale scanner */
            #modalOverlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 1000;
            }

            #modalContent {
                background: white;
                padding: 2rem;
                border-radius: 1rem;
                max-width: 90%;
                max-height: 90%;
                overflow-y: auto;
                text-align: center;
            }

            #qr-reader {
                width: 100%;
                max-width: 400px;
                margin: 1rem auto;
            }

            #stepQR, #stepForm, #stepSuccess {
                display: none;
            }

            #stepQR h2, #stepForm h2, #stepSuccess h2 {
                margin-bottom: 1rem;
                color: #333;
            }

            #obsForm label {
                display: block;
                margin: 0.5rem 0 0.2rem;
                font-weight: bold;
                text-align: left;
            }

            #obsForm input, #obsForm select, #obsForm textarea {
                width: 100%;
                padding: 0.5rem;
                margin-bottom: 1rem;
                border: 1px solid #ddd;
                border-radius: 0.25rem;
            }

            #photosPreview {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
                margin: 1rem 0;
            }

            #photosPreview img {
                width: 100px;
                height: 100px;
                object-fit: cover;
                border-radius: 0.25rem;
            }

            button {
                background: #3498db;
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 0.25rem;
                cursor: pointer;
                margin: 0.25rem;
            }

            button:hover {
                background: #2980b9;
            }

            button[type="button"] {
                background: #95a5a6;
            }

            button[type="button"]:hover {
                background: #7f8c8d;
            }

            /* SOLUTION URGENTE - Cacher la modale scanner sur la page de connexion */
#modalOverlay,
#modalContent,
[class*="modal"],
[class*="scanner"] {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    position: fixed !important;
    left: -9999px !important;
    top: -9999px !important;
    z-index: -9999 !important;
}

/* Cacher spécifiquement le texte du scanner dans le footer */
body:not(.logged-in)::after,
body:not(.logged-in)::before {
    content: none !important;
}

/* Cacher tout élément contenant le texte du scanner */
*:contains("Scanner le QR code client") {
    display: none !important;
}       
        </style>
        <div id="modalOverlay" style="display: none;">
            <div id="modalContent">
                <div id="stepQR" style="display:none;">
                    <h2>📸 Scanner le QR code client</h2>
                    <div id="qr-reader"></div>
                    <p id="geolocationMessage" style="color: #d32f2f; font-weight: bold; text-align: center; margin-top: 15px; display: none;"></p>
                    <div id="qrScannerLoader" class="loader" style="display:none;"></div> <!-- LOADER POUR LE SCANNER QR -->
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
    
    // Injection du fullScreenLoader seulement si nécessaire
    if (!document.getElementById('fullScreenLoader')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="fullScreenLoader" style="display: none; opacity: 0;">
                <div class="loader"></div>
                <p>Cette opération peut prendre quelques secondes...</p>
            </div>
        `);
    }
    
    console.log("Modal HTML injected dynamically via JS.");
}
// CORRECTION : L'ensemble de la fonction handleLogin a été placé entre les accolades.
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
        console.error("LOGIN ERROR: Erreur dans la fonction login():", err);
    } finally {
        window.show(loader, false);
        console.log("LOGIN: Fonction login() terminée.");
    }
};

// viiveo-app.js
window.loadMissions = async function(emailToLoad, filterType = 'en_attente') {

    // Les DIVs INTERNES où les tableaux sont injectés (missions-attente, missions-a-venir, etc.)
    const contAttente = document.getElementById("missions-attente");
    const contAvenir = document.getElementById("missions-a-venir");
    const contEnCours = document.getElementById("missions-en-cours");
    const contTerminees = document.getElementById("missions-terminees");
    const mainMissionsDisplay = document.getElementById("main-missions-display");

    // L'élément 'loader' est le cercle, dont window.show manipule le wrapper.
    const loaderElement = document.getElementById('loader'); 

    // Récupérer les conteneurs PARENTS pour pouvoir les manipuler (missions-attente-container, etc.)
    const containerAttente = document.getElementById("missions-attente-container");
    const containerPlanif = document.getElementById("missions-planifiees-container");
    const containerEnCours = document.getElementById("missions-en-cours-container");
    const containerTerminees = document.getElementById("missions-terminees-container");
    
    // Ancien code : if (!contAttente || ... || !globalLoader)
    // NOUVEAU CODE DE VÉRIFICATION :
    if (!contAttente || !contAvenir || !contEnCours || !contTerminees || !mainMissionsDisplay || !loaderElement || !containerAttente || !containerPlanif || !containerEnCours || !containerTerminees) {
        console.error("LOAD MISSIONS ERROR: Un ou plusieurs conteneurs de missions/loader sont introuvables dans le DOM.");
        alert("Erreur d'affichage : Impossible de trouver tous les éléments de l'interface.");
        
        // Tentative de masquage du loader (s'il est visible)
        if (typeof window.show === 'function' && loaderElement) {
            window.show(loaderElement, false);
        }
        return;
    }
    // **********************************************
    // 1. AFFICHAGE DU LOADER
    // **********************************************
    window.show(loaderElement, true); 
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
            window.show(loaderElement, false); 
            mainMissionsDisplay.innerHTML = "<p class='error-message'>Erreur de configuration: URL de l'application manquante.</p>";
            mainMissionsDisplay.style.display = 'block';
            return;
        }

        const url = `${window.webAppUrl}?type=missionspresta&email=${encodeURIComponent(emailToLoad)}`;
        console.log("LOAD MISSIONS: URL d'API générée:", url);
        // Utilisation de la méthode générique pour éviter d'importer le code de callApiJsonp ici
        const data = await window.callApiJsonp(url, callbackName); 
        console.log("LOAD MISSIONS: Réponse de l'API des missions:", data);

        if (!data.success || !Array.isArray(data.missions)) {
            alert("Erreur lors du chargement des missions.");
            console.warn("LOAD MISSIONS: Données de missions invalides ou échec.", data);
            window.show(loaderElement, false); 
            mainMissionsDisplay.innerHTML = `<p class='error-message'>${data.message || 'Erreur lors du chargement des missions.'}</p>`;
            mainMissionsDisplay.style.display = 'block';
            return;
        }

        const missions = data.missions;
        const missionsAttente = missions.filter(m => m.statut && String(m.statut).toLowerCase() === "en attente");
        const missionsValidees = missions.filter(m => m.statut && (String(m.statut).toLowerCase() === "confirmée" || String(m.statut).toLowerCase() === "validée"));
        const missionsEnCours = missions.filter(m => m.statut && String(m.statut).toLowerCase() === "en cours");
        const missionsTerminees = missions.filter(m => m.statut && (String(m.statut).toLowerCase() === "terminée" || String(m.statut).toLowerCase() === "clôturée"));

        // Rendu des tableaux dans les DIVs internes
        contAttente.innerHTML = renderTable(missionsAttente, 'attente');
        contAvenir.innerHTML = renderTable(missionsValidees, 'validee');
        contEnCours.innerHTML = renderTable(missionsEnCours, 'enCours');
        contTerminees.innerHTML = renderTable(missionsTerminees, 'terminee');

        // Ajout des écouteurs
        attachMissionButtonListeners();

        // **********************************************
        // 2. MASQUAGE DU LOADER ET AFFICHAGE DU CONTENU
        // **********************************************
        window.show(loaderElement, false); 
        mainMissionsDisplay.style.display = 'block';
        
        // Gérer l'affichage du conteneur spécifique (missions en attente par défaut)
        
        // Masque tout d'abord tous les conteneurs (pour être sûr)
        containerAttente.style.display = 'none';
        containerPlanif.style.display = 'none';
        containerEnCours.style.display = 'none';
        containerTerminees.style.display = 'none';
        
        // Affiche le conteneur basé sur le filtre demandé (ou "en attente" par défaut)
        if (filterType === 'en_attente') {
            containerAttente.style.display = 'block';
        } else if (filterType === 'planifiees') {
            containerPlanif.style.display = 'block';
        } else if (filterType === 'en_cours') {
            containerEnCours.style.display = 'block';
        } else if (filterType === 'terminees') {
            containerTerminees.style.display = 'block';
        } else {
            // Afficher le défaut si l'argument est manquant (ex: après login)
            containerAttente.style.display = 'block';
        }


        console.log("LOAD MISSIONS: Tableaux de missions rendus et écouteurs attachés avec succès.");

    } catch (e) {
        alert("Erreur serveur lors du chargement des missions.");
        console.error("LOAD MISSIONS ERROR: Erreur dans loadMissions():", e);
        window.show(loaderElement, false); 
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
    document.querySelectorAll('.btn-validate').forEach(button => {
        button.onclick = async function() {
            const missionId = this.dataset.missionId;
            console.log(`Validation de la mission ${missionId}`);
            const url = `${window.webAppUrl}?type=validermission&missionId=${encodeURIComponent(missionId)}`;
            const response = await window.callApiJsonp(url, 'cbValidate' + Date.now());
            if (response.success) {
                alert(`Mission ${missionId} validée avec succès !`);
                window.loadMissions(window.currentEmail);
            } else {
                alert(`Erreur lors de la validation de la mission ${missionId}: ${response.message}`);
            }
        };
    });

    document.querySelectorAll('.btn-refuse').forEach(button => {
        button.onclick = async function() {
            const missionId = this.dataset.missionId;
            console.log(`Refus de la mission ${missionId}`);
            const alt = prompt("Nouvelle date/heure ?");
            if (!alt) return;
            const url = `${window.webAppUrl}?type=refusermission&missionId=${encodeURIComponent(missionId)}&alternatives=${encodeURIComponent(alt)}`;
            const response = await window.callApiJsonp(url, 'cbRefuse' + Date.now());
            if (response.success) {
                alert(`Mission ${missionId} refusée avec succès.`);
                window.loadMissions(window.currentEmail);
            } else {
                alert(`Erreur lors du refus de la mission ${missionId}: ${response.message}`);
            }
        };
    });

    document.querySelectorAll('.btn-start').forEach(button => {
        button.onclick = function() {
            const missionId = this.dataset.missionId;
            const clientPrenom = this.dataset.clientPrenom;
            const clientNom = this.dataset.clientNom;
            console.log(`Démarrage de la mission ${missionId} pour ${clientPrenom} ${clientNom}`);
            window.openModalStartPrestation(missionId, clientPrenom, clientNom);
        };
    });

    document.querySelectorAll('.btn-cloturer').forEach(button => {
        button.onclick = function() {
            const missionId = this.dataset.missionId;
            const clientPrenom = this.dataset.clientPrenom || '';
            const clientNom = this.dataset.clientNom || '';
            console.log(`Clôture de la mission ${missionId}`);
            window.openModalCloturerPrestation(missionId, clientPrenom, clientNom);
        };
    });
}

async function handleValidateMission(event) {
    const missionId = event.currentTarget.dataset.missionId;
    console.log(`handleValidateMission appelée pour ID: ${missionId}`);
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

window.validerMission = handleValidateMission;
window.refuserMission = handleRefuseMission;

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
    createAndInjectModalHtml();
    setTimeout(() => {
        initializeModalListeners();
        console.log("initializeModalListeners appelée après injection et délai.");
    }, 100);
});
/**
 * Utilise la méthode JSONP/GET pour envoyer la fiche de clôture, 
 * ce qui contourne le problème CORS.
 * @param {object} payload - Les données de la fiche, y compris les photos Base64.
 * @param {string} url - L'URL de l'application Apps Script (window.webAppUrl).
 * @returns {Promise<object>} La réponse JSON de l'API.
 */
function sendFicheJsonpRequest(payload, url) {
    return new Promise((resolve, reject) => {
        const callbackName = 'cbFiche' + new Date().getTime() + Math.floor(Math.random() * 1000);
        
        // Convertir la charge utile complète en paramètre d'URL encodé.
        // C'est potentiellement très long, mais nécessaire pour éviter CORS.
        const encodedPayload = encodeURIComponent(JSON.stringify(payload));

        // Note: Nous utilisons l'URL de base 'exec' mais encodons le corps en paramètre
        const finalUrl = `${url}?type=envoyerfiche&payload=${encodedPayload}&callback=${callbackName}`;

        console.log(`➡️ JSONP Fiche: Requête lancée pour ${finalUrl}`);
        
        window[callbackName] = (data) => {
            console.log(`✅ JSONP Fiche Callback ${callbackName} reçu:`, data);
            resolve(data);
            delete window[callbackName];
            script.remove();
        };

        const script = document.createElement('script');
        script.src = finalUrl;
        script.onerror = (e) => {
            console.error("❌ Erreur de chargement du script JSONP pour la fiche:", e);
            delete window[callbackName];
            script.remove();
            reject(new Error("Erreur réseau JSONP ou chargement du script Apps Script échoué."));
        };
        document.head.appendChild(script);
    });
}
/**
 * Envoie une requête POST Apps Script en utilisant FormData pour contourner CORS.
 * C'est la méthode recommandée par Google pour les requêtes POST depuis des domaines externes.
 * @param {object} payload - Les données de la fiche à envoyer.
 * @param {string} url - L'URL de l'application Apps Script.
 * @returns {Promise<object>} La réponse JSON du serveur.
 */
async function sendFormDataRequest(payload, url) {
    const formData = new FormData();
    
    // Convertir l'objet payload en FormData
    for (const key in payload) {
        if (payload.hasOwnProperty(key)) {
            // Gérer les photos séparément car elles sont un tableau d'objets
            if (key === 'photos' && Array.isArray(payload[key])) {
                // Stocker le tableau de photos en tant que chaîne JSON
                formData.append(key, JSON.stringify(payload[key]));
            } else {
                // Pour toutes les autres données (simples), les ajouter directement
                formData.append(key, payload[key]);
            }
        }
    }
    
    // L'utilisation de FormData rend l'en-tête 'Content-Type' inutile (le navigateur le gère)
    // et contourne le blocage CORS pour Apps Script.
    const response = await fetch(url, {
        method: "POST",
        body: formData, // <--- C'EST LA CLÉ !
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Échec de la requête HTTP FormData: Statut ${response.status}`, errorText);
        throw new Error(`Échec de la connexion au serveur (Statut HTTP ${response.status}).`);
    }

    // Le corps de la réponse Apps Script est toujours JSON
    return response.json();
}


