// viiveo-app.js - À placer sur GitHub

// Variables pour l'état de la mission et du prestataire
let currentMissionId = null;
let currentClientPrenom = "", currentClientNom = "";
let currentPrestatairePrenom = null, currentPrestataireNom = null;
let currentLatitude = null, currentLongitude = null;
let heureDebut = null;

// Références DOM (doivent être après le HTML dans le DOM)
const modalOverlay = document.getElementById("modalOverlay");
const stepQR = document.getElementById("stepQR");
const stepForm = document.getElementById("stepForm");
const stepSuccess = document.getElementById("stepSuccess");

const clientNameInput = document.getElementById("clientName");
const obsDateInput = document.getElementById("obsDate");
const etatSanteInput = document.getElementById("etatSante");
const etatFormeInput = document.getElementById("etatForme");
const environnementInput = document.getElementById("environnement");
const photosInput = document.getElementById("photos");
const photosPreview = document.getElementById("photosPreview");

// Fonctions liées au scanner et à la modale
function setTodayDate() {
    obsDateInput.value = new Date().toISOString().split("T")[0];
}

function openModalStartPrestation(missionId, clientPrenom, clientNom) {
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
    modalOverlay.style.display = "flex";

    startQrScanner();
}

function closeModal() {
    modalOverlay.style.display = "none";
    clearForm(document.getElementById("obsForm")); // Utilisez clearForm avec l'ID du formulaire
    const qrReaderInstance = Html5Qrcode.getCameras().find(c => c.id === "qr-reader");
    if (qrReaderInstance && qrReaderInstance.isScanning) {
        qrReaderInstance.stop().catch(err => console.warn("Erreur à l'arrêt du scanner:", err));
    }
}

async function startQrScanner() {
    document.getElementById("qr-reader").innerHTML = "";
    const qrReader = new Html5Qrcode("qr-reader");

    qrReader.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        async (decodedText) => {
            qrReader.stop();
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
        () => {}
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
    stepQR.style.display = "none";
    stepForm.style.display = "block";
    clientNameInput.value = `${currentClientPrenom} ${currentClientNom}`;
    setTodayDate();
}

function clearFormFields() { // Renommée pour éviter conflit avec la fonction utilitaire clearForm
    obsDateInput.value = "";
    etatSanteInput.value = "";
    etatFormeInput.value = "";
    environnementInput.value = "";
    photosInput.value = "";
    photosPreview.innerHTML = "";
}

// Fonctions liées au login et missions
function show(el, visible) {
    if (!el) return;
    el.style.display = visible ? "block" : "none";
}

async function login() {
    const email = document.getElementById("email")?.value.trim();
    const password = document.getElementById("password")?.value.trim();
    const message = document.getElementById("message");
    const loader = document.querySelector(".viiveo-loader");
    const form = document.querySelector(".viiveo-login");
    const missionsBlock = document.querySelector(".viiveo-missions");

    if (!email || !password) {
        message.textContent = "Champs requis.";
        return;
    }
    message.textContent = "";
    show(loader, true);
    tempDisable(document.querySelector(".viiveo-login button"), 3000); // Désactive le bouton 3s

    try {
        const callbackName = 'cbLogin' + Date.now();
        const url = `${window.webAppUrl}?type=loginpresta&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
        const data = await callApiJsonp(url, callbackName);
        if (!data.success) {
            message.textContent = data.message || "Connexion échouée.";
            return;
        }

        window.setPrestataireData(data.email, data.prenom, data.nom);

        show(form, false);
        show(missionsBlock, true);
        await loadMissions(window.currentEmail);
    } catch (err) {
        message.textContent = "Erreur serveur.";
        console.error(err);
    } finally {
        show(loader, false);
    }
}

window.loadMissions = async function(emailToLoad) {
    const contAttente = document.getElementById("missions-attente");
    const contAvenir = document.getElementById("missions-a-venir");
    const contTerminees = document.getElementById("missions-terminees");
    if (!contAttente || !contAvenir || !contTerminees) return;

    contAttente.innerHTML = "Chargement...";
    contAvenir.innerHTML = "Chargement...";
    contTerminees.innerHTML = "Chargement...";

    try {
        const callbackName = 'cbMissions' + Date.now();
        const url = `${window.webAppUrl}?type=missionspresta&email=${encodeURIComponent(emailToLoad)}`;
        const data = await callApiJsonp(url, callbackName);

        if (!data.success || !Array.isArray(data.missions)) {
            alert("Erreur lors du chargement des missions.");
            return;
        }

        const missions = data.missions;
        const missionsAttente = missions.filter(m => m.statut === "en attente");
        const missionsValidees = missions.filter(m => m.statut === "confirmée" || m.statut === "validée");
        const missionsTerminees = missions.filter(m => m.statut === "terminée");

        contAttente.innerHTML = renderTable(missionsAttente, 'attente');
        contAvenir.innerHTML = renderTable(missionsValidees, 'validee');
        contTerminees.innerHTML = renderTable(missionsTerminees, '');
    } catch (e) {
        alert("Erreur serveur.");
        console.error(e);
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
            html += `<td data-label="Actions" class="actions"><button class="btn-action btn-start" onclick="handleStartPrestation('${m.id}')">▶️</button></td>`;
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

function handleStartPrestation(id) {
    setTimeout(() => {
        if (typeof window.startPrestation === "function") {
            window.startPrestation(id);
        } else {
            alert("⏳ Le système de scan n'est pas encore prêt. Veuillez patienter ou recharger la page.");
        }
    }, 300);
}

// Gestionnaires d'événements
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

document.getElementById("obsForm").addEventListener("submit", async e => {
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

document.getElementById("btnCancelQR").onclick = closeModal;
document.getElementById("btnCancelForm").onclick = closeModal;
document.getElementById("btnCloseSuccess").onclick = closeModal;

window.startPrestation = function(missionId) {
    if (!window.currentEmail) {
        alert("Vous devez être connecté pour démarrer une prestation. Veuillez vous authentifier.");
        console.warn("Tentative de démarrer une prestation sans prestataire connecté.");
        return;
    }

    const rows = [...document.querySelectorAll("table tbody tr")];
    const row = rows.find(tr =>
        tr.children[0]?.textContent.trim().toUpperCase() === missionId.toUpperCase()
    );

    if (!row) {
        alert(`❌ Ligne de mission introuvable pour l'ID ${missionId}`);
        console.warn("Lignes disponibles :", rows.map(r => r.children[0]?.textContent.trim()));
        return;
    }

    const clientNom = row.children[1]?.textContent.trim() || "";
    // Note: clientPrenom n'est pas extrait directement de la table ici.
    // Assurez-vous que votre tableau ou votre backend fournit le prénom si nécessaire.
    // Pour l'instant, je le laisse comme une chaîne vide si non disponible.
    const clientPrenom = row.children[1]?.dataset.prenom?.trim() || clientNom.split(" ")[0];

    openModalStartPrestation(missionId, clientPrenom, clientNom);
};

// Fonctions utilitaires génériques (ajoutées depuis votre dernier embed)
// 🧼 Fonction pour nettoyer les inputs d’un formulaire (corrigée pour un usage plus générique)
function clearForm(formElement) {
    if (!formElement) return;
    Array.from(formElement.elements).forEach(el => {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            el.value = '';
        } else if (el.tagName === 'SELECT') {
            el.selectedIndex = 0; // Réinitialise la sélection à la première option
        }
    });
}

// ⌛ Fonction pour désactiver un bouton temporairement
function tempDisable(btn, ms = 1000) {
    if (!btn) return;
    btn.disabled = true;
    setTimeout(() => {
        btn.disabled = false;
    }, ms);
}

// 💡 Fonction pour créer un élément HTML depuis une chaîne HTML
function createElementFromHTML(htmlString) {
    const div = document.createElement('div');
    div.innerHTML = htmlString.trim();
    return div.firstChild; // Retourne le premier élément enfant
}


document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById("loginForm"); // Ciblez le formulaire par son ID
    if (loginForm) {
        // S'assure que la fonction login est bien chargée AVANT d'attacher le listener
        if (typeof login === 'function') {
            loginForm.addEventListener("submit", login); // Attachez l'événement submit au formulaire
        } else {
            console.error("La fonction 'login' n'est pas encore définie. Veuillez recharger la page.");
            // Tentative de réattacher après un court délai au cas où
            setTimeout(() => {
                if (typeof login === 'function') {
                    loginForm.addEventListener("submit", login);
                } else {
                     console.error("La fonction 'login' est toujours indéfinie après délai. Problème de chargement JS.");
                }
            }, 500);
        }
    }
});
