// viiveo-app.js - À placer sur GitHub

// Variables globales pour l'état de la mission et du prestataire
let currentMissionId = null;
let currentClientPrenom = "", currentClientNom = "";
let currentPrestatairePrenom = null, currentPrestataireNom = null;
let currentLatitude = null, currentLongitude = null;
let heureDebut = null;

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

    stepQR.style.display = "flex";
    stepForm.style.display = "none";
    stepSuccess.style.display = "none";
    modalOverlay.style.display = "flex"; // REND LA MODALE VISIBLE ICI

    startQrScanner();
}

function closeModal() {
    const modalOverlay = document.getElementById("modalOverlay");
    if (modalOverlay) {
        modalOverlay.style.display = "none"; // CACHE LA MODALE ICI
    }
    const obsForm = document.getElementById("obsForm");
    if (obsForm) {
        clearForm(obsForm);
    }
    // Tentative d'arrêt de toutes les instances Html5Qrcode (plus robuste)
    Html5Qrcode.getCameras().forEach(camera => {
        if (camera && camera.isScanning) {
            camera.stop().catch(err => console.warn("Erreur à l'arrêt du scanner:", err));
        }
    });
    // Si vous avez un Html5QrcodeScanner instancié directement (pas par ID)
    const qrReaderInstance = window.qrScannerInstance; // Assurez-vous que cette variable est définie si vous l'utilisez
    if (qrReaderInstance && qrReaderInstance.isScanning) {
        qrReaderInstance.stop().catch(err => console.warn("Erreur à l'arrêt du scanner (instance):", err));
    }

}

async function startQrScanner() {
    const qrReaderElement = document.getElementById("qr-reader");
    if (!qrReaderElement) {
        console.error("Élément 'qr-reader' non trouvé.");
        alert("Erreur: Le scanner QR ne peut pas démarrer (élément manquant).");
        closeModal();
        return;
    }
    qrReaderElement.innerHTML = ""; // Nettoie l'élément avant de redémarrer le scanner

    // IMPORTANT : Utilisez une variable globale pour l'instance du scanner si vous ne voulez qu'une seule instance active
    // Ou assurez-vous de bien la gérer. Ici, on crée une nouvelle instance à chaque appel.
    const qrReader = new Html5Qrcode("qr-reader");

    // Stockez l'instance si vous voulez la référencer facilement pour l'arrêter
    // window.qrScannerInstance = qrReader; // Décommentez si vous utilisez window.qrScannerInstance dans closeModal

    qrReader.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        async (decodedText) => {
            qrReader.stop(); // Arrête le scanner après un scan réussi
            try {
                console.log("🔍 Texte QR scanné :", decodedText);

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
                alert("Erreur lors du scan QR : " + err.message);
                console.error("Erreur dans startQrScanner:", err);
                closeModal();
            }
        },
        (errorMessage) => {
            // Cette fonction est appelée en cas d'erreur ou d'échec de lecture continu
            // Ne pas alerter l'utilisateur constamment, juste logguer
            // console.warn("QR Scan progress error:", errorMessage);
        }
    ).catch(err => {
        alert("Impossible d’activer la caméra. Assurez-vous d'avoir donné les permissions.");
        console.error("Erreur d'initialisation de la caméra:", err);
        closeModal();
    });
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
    stepForm.style.display = "block";
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

// Fonctions liées au login et missions
function show(el, visible) {
    if (!el) return;
    el.style.display = visible ? "block" : "none";
}

async function login() {
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
    show(loader, true);
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

        show(form, false);
        show(missionsBlock, true);
        await loadMissions(window.currentEmail);
        console.log("LOGIN: Missions chargées après connexion réussie.");
    } catch (err) {
        if (message) message.textContent = "Erreur serveur ou réseau.";
        console.error("LOGIN ERROR: Erreur dans la fonction login():", err);
    } finally {
        show(loader, false);
        console.log("LOGIN: Fonction login() terminée.");
    }
}

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
            [...files].forEach(file => {
                const reader = new FileReader();
                reader.onload = ev => {
                    const img = document.createElement("img");
                    img.src = ev.target.result;
                    photosPreview.appendChild(img);
                };
                reader.readAsDataURL(file);
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
                    stepSuccess.style.display = "block";
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
        if (document.getElementById("btnCancelQR")) document.getElementById("btnCancelQR").onclick = closeModal;
        if (document.getElementById("btnCancelForm")) document.getElementById("btnCancelForm").onclick = closeModal;
        if (document.getElementById("btnCloseSuccess")) document.getElementById("btnCloseSuccess").onclick = closeModal;

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
    if (loginForm && typeof login === 'function') {
        // Supprimez l'écouteur précédent pour éviter les doublons si la fonction est appelée plusieurs fois
        loginForm.removeEventListener("submit", login);
        loginForm.addEventListener("submit", login);
        console.log("Écouteur de soumission ajouté au formulaire de connexion.");
    } else {
        console.warn("Formulaire de connexion ou fonction 'login' non disponible. Nouvelle tentative...");
        setTimeout(initializeLoginForm, 200); // Réessaie si le formulaire n'est pas encore là
    }
}
// Cette fonction crée et injecte le HTML de la modale dynamiquement
function createAndInjectModalHtml() {
    // **ATTENTION : Copiez TOUT le contenu de votre fichier viiveo-modals.html ici.**
    // Assurez-vous que c'est une chaîne de caractères sur une seule ligne ou en utilisant des backticks ` ` pour le multi-ligne.
    const modalHtml = `
        <div id="modalOverlay" style="display: none;">
            <div id="modalContent">
                <div id="stepQR" style="display:flex; flex-direction:column; align-items:center;">
                    <h2>📸 Scanner le QR code client</h2>
                    <div id="qr-reader"></div>
                    <button id="btnCancelQR">Annuler</button>
                </div>

                <div id="stepForm" style="display:none;">
                    <h2>📝 Fiche d'observation</h2>
                    <form id="obsForm">
                        <label>Nom du client</label>
                        <input type="text" id="clientName" readonly />
                        <label>Date de l'observation</label>
                        <input type="date" id="obsDate" required />
                        <label>État de santé</label>
                        <textarea id="etatSante" rows="3" placeholder="Décrire l'état de santé..."></textarea>
                        <label>État de forme</label>
                        <select id="etatForme" required>
                            <option value="">-- Choisir --</option>
                            <option>Très bon</option>
                            <option>Bon</option>
                            <option>Moyen</option>
                            <option>Faible</option>
                            <option>Très faible</option>
                        </select>
                        <label>Environnement</label>
                        <textarea id="environnement" rows="3" placeholder="Décrire l'environnement..."></textarea>
                        <label>Photos (max 3)</label>
                        <input type="file" id="photos" accept="image/*" multiple />
                        <div id="photosPreview"></div>
                        <button type="submit">Envoyer la fiche</button>
                        <button type="button" id="btnCancelForm">Annuler</button>
                    </form>
                </div>

                <div id="stepSuccess" style="display:none; text-align:center;">
                    <h2>✅ Fiche envoyée avec succès !</h2>
                    <button id="btnCloseSuccess">Fermer</button>
                </div>
            </div>
        </div>
    `;
    // Injecte le HTML à la fin du corps du document
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    console.log("Modal HTML injected dynamically via JS.");
}
// ... (votre code existant) ...

// SUPPRIMEZ cette fonction entière car le HTML est maintenant statique dans Carrd
// async function loadModalHtmlAndInit() { ... }

// Modifiez votre gestionnaire DOMContentLoaded
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
