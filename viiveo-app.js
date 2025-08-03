// viiveo-app.js - Fichier consolidé et corrigé

// Variables globales pour l'état de la mission et du prestataire
let qrScannerInstance = null;
let currentMissionId = null;
let currentClientPrenom = "";
let currentClientNom = "";
let currentPrestatairePrenom = null;
let currentPrestataireNom = null;
let currentLatitude = null;
let currentLongitude = null;
let heureDebut = null;

// L'URL de votre Web App Apps Script
const webAppUrl = "https://script.google.com/macros/s/AKfycbzEEZZnZJK1BEXlCk81ogi0Aa7MFGunOkjS5s2CCDIZPSkHq0OtPAcEBLrkXp-fpb8aaQ/exec";

// --- Fonctions utilitaires ---
function show(el, visible) {
    if (!el) return;
    el.style.display = visible ? "block" : "none";
}

function createElementFromHTML(htmlString) {
    const div = document.createElement('div');
    div.innerHTML = htmlString.trim();
    return div.firstChild;
}

function setTodayDate(obsDateInput) {
    if (obsDateInput) {
        obsDateInput.value = new Date().toISOString().split("T")[0];
    }
}

function clearFormFields() {
    const obsForm = document.getElementById("obsForm");
    const photosInput = document.getElementById("photos");
    const photosPreview = document.getElementById("photosPreview");

    if (obsForm) obsForm.reset();
    if (photosInput) photosInput.value = "";
    if (photosPreview) photosPreview.innerHTML = "";
}

// Fonction pour faire des requêtes JSONP
async function callApiJsonp(url, callbackName, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + callbackName;
        document.head.appendChild(script);

        window[callbackName] = (data) => {
            delete window[callbackName];
            document.head.removeChild(script);
            resolve(data);
        };

        script.onerror = () => {
            delete window[callbackName];
            document.head.removeChild(script);
            reject(new Error("Erreur de chargement du script JSONP."));
        };

        setTimeout(() => {
            if (window[callbackName]) {
                delete window[callbackName];
                document.head.removeChild(script);
                reject(new Error("Délai d'attente expiré pour le JSONP."));
            }
        }, timeout);
    });
}

// --- Fonctions de gestion de la modale ---
function startQrScanner() {
    const stepQR = document.getElementById("stepQR");
    const qrReaderElement = document.getElementById("qr-reader");

    if (!stepQR || !qrReaderElement) {
        console.error("Erreur: Éléments du scanner non trouvés.");
        alert("Erreur: Impossible de démarrer le scanner.");
        return;
    }

    stepQR.style.display = "flex";
    qrReaderElement.innerHTML = "";
    clearFormFields();

    if (qrScannerInstance && typeof qrScannerInstance.stop === 'function') {
        qrScannerInstance.stop().catch(err => console.warn("Erreur à l'arrêt du scanner:", err));
    }
    
    qrScannerInstance = new Html5Qrcode("qr-reader");

    qrScannerInstance.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
            console.log(`QR Code détecté: ${decodedText}`);
            if (qrScannerInstance) {
                await qrScannerInstance.stop().catch(err => console.warn("Erreur à l'arrêt du scanner:", err));
                qrScannerInstance = null;
            }
            handleQrCode(decodedText);
        },
        (errorMessage) => {}
    ).catch(err => {
        console.error("Erreur d'initialisation de la caméra:", err);
        alert("Impossible d’activer la caméra. Assurez-vous d'avoir donné les permissions.");
        closeModal();
    });
}

async function handleQrCode(qrText) {
    const urlParams = new URLSearchParams(qrText.split('?')[1]);
    const clientId = urlParams.get('idclient') || urlParams.get('clientId');
    
    if (!clientId) {
        alert("QR code invalide. L'identifiant client est manquant.");
        closeModal();
        return;
    }

    // Récupération de la géolocalisation de début
    let lat = null;
    let lon = null;
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
        });
        lat = position.coords.latitude;
        lon = position.coords.longitude;
        window.currentLatitude = lat;
        window.currentLongitude = lon;
    } catch (geoError) {
        alert("❌ Erreur de géolocalisation. Veuillez autoriser la localisation.");
        console.error("Erreur de géolocalisation:", geoError);
        closeModal();
        return;
    }

    // Appel de l'API pour vérifier le QR code
    try {
        const url = `${webAppUrl}?type=verifqr&idclient=${encodeURIComponent(clientId)}&email=${encodeURIComponent(currentEmail)}&latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}`;
        const response = await callApiJsonp(url, `cbVerify${Date.now()}`);

        if (response.success && response.missionStatus === "readyForEnd") {
            window.currentMissionId = response.missionId;
            window.currentClientPrenom = response.client.prenom;
            window.currentClientNom = response.client.nom;
            window.heureDebut = response.heureDebut;
            showForm();
        } else {
            alert("Erreur de vérification : " + (response.message || "Statut de mission inattendu."));
            closeModal();
        }
    } catch (err) {
        alert("Erreur réseau ou du serveur lors de la vérification QR.");
        console.error("Erreur lors de la vérification QR:", err);
        closeModal();
    }
}

function openModalCloturerPrestation(missionId, clientPrenom, clientNom) {
    currentMissionId = missionId;
    currentClientPrenom = clientPrenom || "";
    currentClientNom = clientNom || "";

    const modalOverlay = document.getElementById("modalOverlay");
    if (modalOverlay) {
        modalOverlay.style.display = "flex";
        startQrScanner();
    }
}

function showForm() {
    const stepQR = document.getElementById("stepQR");
    const stepForm = document.getElementById("stepForm");
    const clientNameInput = document.getElementById("clientName");
    const obsDateInput = document.getElementById("obsDate");

    if (stepQR && stepForm && clientNameInput && obsDateInput) {
        stepQR.style.display = "none";
        stepForm.style.display = "flex";
        clientNameInput.value = `${currentClientPrenom} ${currentClientNom}`.trim();
        setTodayDate(obsDateInput);
    }
}

function closeModal() {
    const modalOverlay = document.getElementById("modalOverlay");
    if (modalOverlay) modalOverlay.style.display = "none";

    if (qrScannerInstance && typeof qrScannerInstance.stop === 'function') {
        qrScannerInstance.stop().catch(err => console.warn("Erreur à l'arrêt du scanner:", err));
    }
    qrScannerInstance = null;
    clearFormFields();
}

// --- Fonctions d'authentification et de chargement des missions ---
async function loadMissions(email) {
    const missionListDiv = document.getElementById("missionList");
    if (!missionListDiv) {
        console.error("LOAD MISSIONS: Élément 'missionList' non trouvé.");
        return;
    }
    missionListDiv.innerHTML = "<p>Chargement des missions...</p>";

    try {
        const url = `${webAppUrl}?type=missionspresta&email=${encodeURIComponent(email)}`;
        const response = await callApiJsonp(url, `cbMissions${Date.now()}`);

        if (response.success && response.missions && response.missions.length > 0) {
            missionListDiv.innerHTML = '';
            response.missions.forEach(mission => {
                const missionElement = createElementFromHTML(`
                    <div class="mission-card">
                        <h3>Mission ${mission.missionId}</h3>
                        <p>Client: ${mission.client}</p>
                        <p>Service: ${mission.service}</p>
                        <p>Date: ${mission.date}</p>
                        <p>Adresse: ${mission.adresse}</p>
                        <button class="close-mission-btn" data-mission-id="${mission.missionId}" data-client-prenom="${mission.clientPrenom}" data-client-nom="${mission.clientNom}">Clôturer la mission</button>
                    </div>
                `);
                missionElement.querySelector(".close-mission-btn").addEventListener("click", (e) => {
                    const missionId = e.target.getAttribute("data-mission-id");
                    const clientPrenom = e.target.getAttribute("data-client-prenom");
                    const clientNom = e.target.getAttribute("data-client-nom");
                    openModalCloturerPrestation(missionId, clientPrenom, clientNom);
                });
                missionListDiv.appendChild(missionElement);
            });
        } else {
            missionListDiv.innerHTML = "<p>Aucune mission en attente.</p>";
        }
    } catch (err) {
        console.error("LOAD MISSIONS: Erreur lors du chargement des missions:", err);
        missionListDiv.innerHTML = "<p>Erreur lors du chargement des missions. Veuillez réessayer.</p>";
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("email")?.value.trim();
    const password = document.getElementById("password")?.value.trim();
    const message = document.getElementById("message");
    const loader = document.getElementById("loader");
    const loginSection = document.querySelector(".viiveo-login");
    const missionsSection = document.querySelector(".viiveo-missions");

    if (!email || !password) {
        if (message) message.textContent = "Champs requis.";
        return;
    }

    if (message) message.textContent = "";
    show(loader, true);

    try {
        const url = `${webAppUrl}?type=loginpresta&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
        const data = await callApiJsonp(url, `cbLogin${Date.now()}`);

        if (data.success) {
            window.currentEmail = data.email;
            window.currentPrenom = data.prenom;
            window.currentNom = data.nom;
            document.body.classList.add('logged-in');
            document.getElementById('welcomeMessage').textContent = `Prestataire connecté : ${data.prenom} ${data.nom} (${data.email})`;
            show(loginSection, false);
            show(missionsSection, true);
            await loadMissions(window.currentEmail);
        } else {
            if (message) message.textContent = data.message || "Connexion échouée.";
        }
    } catch (err) {
        if (message) message.textContent = "Erreur serveur ou réseau.";
        console.error("Erreur lors de la connexion:", err);
    } finally {
        show(loader, false);
    }
}

// --- Exécution principale à l'initialisation de la page ---
document.addEventListener("DOMContentLoaded", function() {
    const loginForm = document.getElementById("loginForm");
    const obsForm = document.getElementById("obsForm");
    const modalCloseBtn = document.getElementById("btnCloseModal");
    const btnCancelQR = document.getElementById("btnCancelQR");
    const btnCancelForm = document.getElementById("btnCancelForm");
    const btnCloseSuccess = document.getElementById("btnCloseSuccess");

    // Ajout dynamique du HTML de la modale si ce n'est pas déjà fait
    if (!document.getElementById("modalOverlay")) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="modalOverlay" style="display: none;">
                <div id="modalContent">
                    <div id="stepQR" style="display:none;">
                        <h2>📸 Scanner le QR code client</h2>
                        <div id="qr-reader"></div>
                        <p id="geolocationMessage" style="color: #d32f2f; font-weight: bold; text-align: center; margin-top: 15px; display: none;"></p>
                        <button id="btnCancelQR" class="close-btn">Annuler</button>
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
        `);
        console.log("Modal HTML injected dynamically.");
    }

    if (loginForm) {
        loginForm.addEventListener("submit", handleLogin);
    }
    
    // Listeners pour la modale
    const photosInput = document.getElementById("photos");
    const photosPreview = document.getElementById("photosPreview");

    if (photosInput && photosPreview) {
        photosInput.addEventListener("change", e => {
            photosPreview.innerHTML = "";
            const files = e.target.files;
            if (files.length > 3) {
                alert("Vous ne pouvez sélectionner que 3 photos max.");
                photosInput.value = "";
                return;
            }
            Array.from(files).forEach(file => {
                const reader = new FileReader();
                reader.onload = ev => {
                    const img = document.createElement("img");
                    img.src = ev.target.result;
                    photosPreview.appendChild(img);
                };
                reader.readAsDataURL(file);
            });
        });
    }

    // Listener pour la soumission du formulaire d'observation
    if (obsForm) {
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

            try {
                let finalLat = null;
                let finalLon = null;
                try {
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
                    return;
                }

                const heureFin = new Date().toISOString();
                const formData = new FormData();
                
                formData.append("type", "envoyerFiche");
                formData.append("missionId", window.currentMissionId);
                formData.append("prenomClient", window.currentClientPrenom);
                formData.append("nomClient", window.currentClientNom);
                formData.append("obsDate", document.getElementById("obsDate").value);
                formData.append("etatSante", document.getElementById("etatSante").value);
                formData.append("etatForme", document.getElementById("etatForme").value);
                formData.append("environnement", document.getElementById("environnement").value);
                
                formData.append("latitudeDebut", window.currentLatitude);
                formData.append("longitudeDebut", window.currentLongitude);
                formData.append("latitudeFin", finalLat);
                formData.append("longitudeFin", finalLon);
                
                formData.append("heureDebut", window.heureDebut);
                formData.append("heureFin", heureFin);
                formData.append("prestatairePrenom", window.currentPrenom);
                formData.append("prestataireNom", window.currentNom);
                formData.append("prestataireEmail", window.currentEmail);

                for (const file of photosInput.files) {
                    formData.append("photos", file);
                }
                
                const response = await fetch(webAppUrl, {
                    method: "POST",
                    body: formData,
                });

                const json = await response.json();

                if (json.success) {
                    document.getElementById("stepForm").style.display = "none";
                    document.getElementById("stepSuccess").style.display = "flex";
                    if (window.currentEmail) {
                        await loadMissions(window.currentEmail);
                    }
                } else {
                    alert("Erreur : " + (json.message || "Envoi échoué"));
                }
            } catch (err) {
                alert("Erreur réseau ou du serveur lors de l'envoi de la fiche.");
                console.error("Erreur lors de l'envoi de la fiche:", err);
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    // Gestion des boutons de la modale
    const modal = document.getElementById("modalOverlay");
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'btnCloseModal' || e.target.id === 'btnCancelQR' || e.target.id === 'btnCancelForm' || e.target.id === 'btnCloseSuccess') {
                closeModal();
            }
        });
    }
});


