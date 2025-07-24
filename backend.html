fichier FormResponses
function handleFormClient(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("FormResponses");

  const params = e.parameter;

  const row = [
    new Date(),
    params.prenom || "",
    params.nom || "",
    params.adresse || "",
    params.email || "",
    params.service || "",
    params.date || "",
    params.heure || "",
    params.commentaire || ""
  ];

  sheet.appendRow(row);

  // Appel onFormSubmit (si nécessaire)
  const lastRow = sheet.getLastRow();
  onFormSubmit({ source: ss, range: sheet.getRange(lastRow, 1) });

  // Retourne un objet simple, pas TextOutput
  return { success: true, message: "Données enregistrées" };
}


function handleFicheObservation(e) {
  const missionId = e.parameter.missionId || "Inconnu";
  const clientPrenom = e.parameter.prenomClient || "Inconnu";
  const clientNom = e.parameter.nomClient || "Inconnu";
  const obsDate = e.parameter.obsDate || "Inconnue";
  const etatSante = e.parameter.etatSante || "";
  const etatForme = e.parameter.etatForme || "";
  const environnement = e.parameter.environnement || "";
  const latitude = e.parameter.latitude || "";
  const longitude = e.parameter.longitude || "";
  const heureDebut = e.parameter.heureDebut || "";
  const heureFin = e.parameter.heureFin || "";
  const prestataireEmail = e.parameter.prestataireEmail || "";

  // Récupérer prénom/nom du prestataire
  const prestataire = getPrestataireNameByEmail(prestataireEmail);
  const prestatairePrenom = prestataire.prenom || "Inconnu";
  const prestataireNom = prestataire.nom || "Inconnu";

  // Contenu HTML de la fiche, avec tous les éléments demandés
  const htmlContent = `
    <h2>Fiche d'observation</h2>
    <p><strong>Mission :</strong> ${missionId}</p>
    <p><strong>Client :</strong> ${clientPrenom} ${clientNom}</p>
    <p><strong>Date :</strong> ${obsDate}</p>
    <p><strong>État de santé :</strong><br/>${etatSante.replace(/\n/g, "<br>")}</p>
    <p><strong>État de forme :</strong> ${etatForme}</p>
    <p><strong>Environnement :</strong><br/>${environnement.replace(/\n/g, "<br>")}</p>
    <p><strong>Coordonnées GPS :</strong> ${latitude}, ${longitude}</p>
    <p><strong>Heure début :</strong> ${heureDebut}</p>
    <p><strong>Heure fin :</strong> ${heureFin}</p>
    <p><strong>Prestataire :</strong> ${prestatairePrenom} ${prestataireNom}</p>
  `;

  const blob = Utilities.newBlob(htmlContent, 'text/html', 'fiche.html');
  const pdfBlob = blob.getAs('application/pdf').setName(`Fiche_${missionId}_${clientPrenom}_${clientNom}_${obsDate}.pdf`);

  const folderId = '1f-BU9ZEGOS5_eODpYsugveKqliVfky16'; // ton dossier Drive
  const folder = DriveApp.getFolderById(folderId);
  const file = folder.createFile(pdfBlob);

  const ss = SpreadsheetApp.openById('1KMdm740bc24Dx4puD71n5KTFrPqYVNl_f3T12hjYlKQ');
  const sheetName = 'FichesObservations';

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(['Horodatage', 'ID Mission', 'Nom Client', 'Date Observation', 'Lien PDF']);
  }

  sheet.appendRow([new Date(), missionId, `${clientPrenom} ${clientNom}`, obsDate, file.getUrl()]);

  // ✅ Mise à jour du statut de la mission dans la feuille "Missions"
  const missionSheet = SpreadsheetApp.openById('1KMdm740bc24Dx4puD71n5KTFrPqYVNl_f3T12hjYlKQ')
                                     .getSheetByName('Missions');
  const missionData = missionSheet.getDataRange().getValues();

  for (let i = 1; i < missionData.length; i++) {
    if (missionData[i][0] === missionId) { // Colonne A = ID mission
      missionSheet.getRange(i + 1, 9).setValue("terminée"); // Colonne H = Statut
      break;
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ success: true, url: file.getUrl() }))
                       .setMimeType(ContentService.MimeType.JSON);
}

function onFormSubmit(e) {
  const sheetForm = e.source.getSheetByName('FormResponses');
  const sheetMissions = e.source.getSheetByName('Missions');

  const row = e.range.getRow();
  const data = sheetForm.getRange(row, 1, 1, sheetForm.getLastColumn()).getValues()[0];

  const nomClient = data[2];      // Colonne C
  const adresse = data[3];        // Colonne D
  const emailPresta = data[4];    // Colonne E (c’est bien l’email du prestataire affecté ici ?)
  const service = data[5];        // Colonne F
  const date = data[6];           // Colonne G
  const heure = data[7];          // Colonne H

  const idDemande = 'D' + String(row).padStart(4, '0'); // ID Demande basé sur la ligne
  const idMission = generateMissionId(sheetMissions);   // ID mission unique généré

  // Ajouter la mission dans la feuille Missions
  sheetMissions.appendRow([
    idMission,
    idDemande,
    emailPresta,
    date,
    heure,
    service,
    nomClient,
    adresse,
    'en attente',  // statut initial
    '',           // réponse prestataire vide
    ''            // dates alternatives vides
  ]);

  // S’assurer que la colonne L existe dans FormResponses pour stocker l’ID demande
  const colCount = sheetForm.getLastColumn();
  if (colCount < 12) {
    sheetForm.insertColumnAfter(colCount);
  }

  // Écrire l’ID demande dans la colonne L (colonne 12)
  sheetForm.getRange(row, 12).setValue(idDemande);

  // Envoi mail au prestataire (tu l'as déjà bien fait)
  const sujet = `📝 Nouvelle mission Viiveo – ${service}`;
  const message = `
Bonjour,

Une nouvelle mission vous a été attribuée :

🧑‍🤝‍🧑 Client : ${nomClient}  
📍 Adresse : ${adresse}  
🛎️ Service : ${service}  
📅 Date : ${date} à ${heure}  

Merci de vous connecter à votre interface pour confirmer ou proposer une alternative :  
👉 https://viiveo-prestataire.com

Numéro de mission : ${idMission}

Cordialement,  
L’équipe Viiveo`;

  MailApp.sendEmail(emailPresta, sujet, message);
}

function testOnFormSubmit() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("FormResponses");
  const lastRow = sheet.getLastRow();

  const fakeEvent = {
    source: ss,
    range: sheet.getRange(lastRow, 1)
  };

  onFormSubmit(fakeEvent);
}

function generateMissionId(sheetMissions) {
  const lastRow = sheetMissions.getLastRow();
  if (lastRow < 2) {
    return "M0001"; // première mission
  } else {
    const lastId = sheetMissions.getRange(lastRow, 1).getValue(); // colonne A = ID mission
    const num = parseInt(lastId.replace(/\D/g, "")) + 1;
    return "M" + num.toString().padStart(4, "0");
  }
}

    
fichier DropPrestataires
    function createCorsResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*"); // à adapter selon besoin
}

function normalizeText(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function handleGetPrestataires(e) {
  const ss = SpreadsheetApp.openById('1KMdm740bc24Dx4puD71n5KTFrPqYVNl_f3T12hjYlKQ');
  const sheet = ss.getSheetByName('IPrestataires');
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).getValues();

  const specialiteDemandeeRaw = e.parameter.specialite || "";
  const specialiteDemandee = specialiteDemandeeRaw.trim().toLowerCase();
  const type = (e.parameter.type || "").toLowerCase();

  // Log pour debug
  Logger.log(`Specialite demandée: "${specialiteDemandeeRaw}" -> normalisée: "${specialiteDemandee}"`);
  Logger.log(`Nombre total de lignes dans IPrestataires: ${values.length}`);

  const filtres = values.filter(row => {
    let validationCell = row[11] ? row[11].toString().trim().toLowerCase() : "";
    validationCell = validationCell.replace(/[\u200B-\u200D\uFEFF]/g, "");
    const valide = validationCell === "oui";

    const specialiteCell = row[5] ? row[5].toString().trim().toLowerCase() : "";
    const matchSpec = specialiteDemandee ? specialiteCell === specialiteDemandee : true;

    return valide && matchSpec;
  });

  Logger.log(`Nombre de prestataires filtrés : ${filtres.length}`);

  const result = type === "dropdown"
    ? {
        success: true,
        prestataires: filtres.map(r => ({
          nomComplet: `${r[0]} ${r[1]}`.trim(),
          email: r[4],
          specialite: r[5]
        }))
      }
    : {
        success: true,
        prestataires: filtres.map(r => ({
          prenom: r[0],
          nom: r[1],
          adresse: r[2],
          telephone: r[3],
          email: r[4],
          specialite: r[5],
          disponibilite: r[6],
          photo: r[7] || "https://via.placeholder.com/300x200?text=Photo",
          commentaire: r[8] || ""
        }))
      };

return createCorsResponse(result);
}




function testHandleGetPrestataires() {
  const fakeEvent = {
    parameter: {
      specialite: "aide ménagère",
      type: "dropdown"
    }
  };
  const result = handleGetPrestataires(fakeEvent);
  Logger.log(result.getContent());
}


    fichier PassWordIclient
    function generateMissingPasswords() {
  const sheetName = 'IClients';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const data = sheet.getRange(2, 1, lastRow - 1, 19).getValues(); // A à S
  let updated = false;

  for (let i = 0; i < data.length; i++) {
    try {
      const prenom = data[i][0];
      const nom = data[i][1];
      const email = data[i][4];
      let passwordValue = data[i][14]; // colonne O
      let mailSent = data[i][15];      // colonne P
      let qrCodeUrl = data[i][16];     // colonne Q
      const credits = data[i][17];     // colonne R (réservée)
      let idClient = data[i][18];      // colonne S

      Logger.log(`🔸 Vérification ligne ${i + 2}`);

      // Étape 1 : Générer ID client si manquant
      if (!idClient && prenom && nom) {
        idClient = `cli-${prenom.trim().slice(0, 2).toLowerCase()}${nom.trim().slice(0, 2).toLowerCase()}${Date.now().toString().slice(-5)}`;
        data[i][18] = idClient;
        Logger.log(`🆔 ID client généré : ${idClient}`);
        updated = true;
      }

      // Étape 2 : Générer mot de passe et QR code si pas encore envoyés
      if (nom && email && idClient && !passwordValue && !mailSent) {
        Logger.log(`🟢 Traitement : ${prenom} ${nom} <${email}>`);

        // Génération du mot de passe
        const newPassword = generatePassword(10);
        data[i][14] = newPassword;

        // Génération du QR Code
        const verifyUrl = `https://viiveo.app/scan?clientId=${idClient}&email=${encodeURIComponent(email)}`;
        qrCodeUrl = generateQRCodeImage(verifyUrl);
        data[i][16] = qrCodeUrl;

        // Envoi du mail
        MailApp.sendEmail({
          to: email,
          subject: 'Bienvenue sur la plateforme Viiveo ✨',
          htmlBody: `
            <div style="font-family: 'Segoe UI', sans-serif; color: #333;">
              <h2>Bienvenue sur Viiveo 🌿</h2>
              <p>Bonjour <strong>${prenom}</strong>,</p>
              <p>Voici votre mot de passe :</p>
              <div style="background: #e8f5e9; padding: 10px; font-size: 18px;">${newPassword}</div>
              <p>Et votre QR code personnel :</p>
              <img src="${qrCodeUrl}" width="200" />
              <p><a href="https://viiveo.app/client?email=${encodeURIComponent(email)}">Accéder à mon espace client</a></p>
            </div>
          `
        });

        data[i][15] = '✔ Mail envoyé';
        updated = true;
      }

    } catch (err) {
      Logger.log(`❌ Erreur à la ligne ${i + 2} : ${err.message}`);
    }
  }

  if (updated) {
    sheet.getRange(2, 1, data.length, 19).setValues(data);
    Logger.log("✅ Données mises à jour.");
  } else {
    Logger.log("ℹ️ Aucune mise à jour nécessaire.");
  }
}

function generatePassword(length = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let pass = '';
  for (let i = 0; i < length; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

function generateQRCodeImage(url) {
  const baseUrl = "https://api.qrserver.com/v1/create-qr-code/";
  return `${baseUrl}?size=200x200&data=${encodeURIComponent(url)}`;
}

function testGenerateClients() {
  generateMissingPasswords();
}

function createTriggerGeneratePasswords() {
  const triggers = ScriptApp.getProjectTriggers();
  const exists = triggers.some(t => t.getHandlerFunction() === 'generateMissingPasswords');
  if (!exists) {
    ScriptApp.newTrigger('generateMissingPasswords')
      .timeBased()
      .everyMinutes(5)
      .create();
    Logger.log('Déclencheur généré toutes les 5 minutes.');
  } else {
    Logger.log('Déclencheur déjà existant.');
  }
}

function regenerateQRCodesForExistingClients() {
  const sheetName = 'IClients';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const data = sheet.getRange(2, 1, lastRow - 1, 19).getValues(); // A à S
  let updated = false;

  for (let i = 0; i < data.length; i++) {
    try {
      const prenom = data[i][0];
      const nom = data[i][1];
      const email = data[i][4];
      let qrCodeUrl = data[i][16];     // colonne Q
      const idClient = data[i][18];    // colonne S

      // Si client a un idClient mais pas encore de QR code
      if (idClient && !qrCodeUrl && prenom && nom && email) {
        const verifyUrl = `https://viiveo.app/scan?clientId=${idClient}&email=${encodeURIComponent(email)}`;
        qrCodeUrl = generateQRCodeImage(verifyUrl);
        data[i][16] = qrCodeUrl;
        Logger.log(`QR code généré pour ${prenom} ${nom} - Ligne ${i + 2}`);
        updated = true;
      }
    } catch (err) {
      Logger.log(`Erreur à la ligne ${i + 2} : ${err.message}`);
    }
  }

  if (updated) {
    sheet.getRange(2, 1, data.length, 19).setValues(data);
    Logger.log("✅ QR codes mis à jour pour les clients concernés.");
  } else {
    Logger.log("ℹ️ Tous les clients ont déjà un QR code.");
  }
}


    fichier ExpoDonnéesClient
    function getClientData(e) {
  const email = (e.parameter.email || "").trim().toLowerCase();
  const password = (e.parameter.password || "").trim();

  if (!email || !password) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Identifiants manquants" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const clientsSheet = ss.getSheetByName("IClients");
  const clientsData = clientsSheet.getDataRange().getValues();

  let clientInfo = null;
  for (let i = 1; i < clientsData.length; i++) {
    const row = clientsData[i];
    const storedEmail = (row[4] || "").toString().trim().toLowerCase();
    const storedPassword = (row[14] || "").toString().trim();

    if (email === storedEmail && password === storedPassword) {
      clientInfo = {
        nom: row[0],
        prenom: row[1],
        adresse: row[3],
        email: storedEmail,
        credits: row[13] || 0,
        photoUrl: row[10] || "",
      };
      break;
    }
  }

  if (!clientInfo) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Email ou mot de passe incorrect" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const formSheet = ss.getSheetByName("FormResponses");
  const formData = formSheet.getDataRange().getValues();
  const headers = formData[0].map(h => h.toString().toLowerCase());

  const idxDate = headers.indexOf("demande dû");
  const idxEmail = headers.indexOf("e-mail");
  const idxService = headers.indexOf("service");
  const idxIntervention = headers.indexOf("intervention");
  const idxHeure = headers.indexOf("heure");
  const idxTache = headers.indexOf("tâche");

  const missionsSheet = ss.getSheetByName("Missions");
  const missionsData = missionsSheet.getDataRange().getValues();

  const idxMissionEmail = 2;
  const idxMissionDate = 3;
  const idxMissionHeure = 4;
  const idxMissionStatut = 8;
  const idxValidationClient = 12;
  const idxIdMission = 0;

  function formatDateString(d) {
    if (!d) return '';
    const date = new Date(d);
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }

  function formatTimeString(d) {
    if (!d) return '';
    const date = new Date(d);
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'HH:mm');
  }

  let demandes = [];

  for (let i = 1; i < formData.length; i++) {
    const row = formData[i];
    const emailRow = (row[idxEmail] || "").toString().trim().toLowerCase();
    if (emailRow !== email) continue;

    const interventionDateRaw = row[idxIntervention];
    const interventionTimeRaw = row[idxHeure];

    const interventionDate = formatDateString(interventionDateRaw);
    const interventionTime = formatTimeString(interventionTimeRaw);

    let statut = "En attente";
    let validationClient = "";
    let idMission = "";

    for (let j = 1; j < missionsData.length; j++) {
      const mRow = missionsData[j];
      const mEmail = (mRow[idxMissionEmail] || "").toString().trim().toLowerCase();
      const mDate = formatDateString(mRow[idxMissionDate]);
      const mTime = formatTimeString(mRow[idxMissionHeure]);

      if (mEmail === email && mDate === interventionDate && mTime === interventionTime) {
        statut = mRow[idxMissionStatut] || "En attente";
        validationClient = mRow[idxValidationClient] || "";
        idMission = mRow[idxIdMission] || "";
        break;
      }
    }

    demandes.push({
      dateDemande: row[idxDate],
      service: row[idxService],
      intervention: interventionDate,
      heure: interventionTime,
      tache: row[idxTache],
      statut: statut,
      validationClient: validationClient,
      idMission: idMission
    });
  }

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    client: clientInfo,
    demandes: demandes
  })).setMimeType(ContentService.MimeType.JSON);
}
function verifyUserPassword(e) {
  const email = (e.parameter.email || "").toLowerCase().trim();
  const password = (e.parameter.password || "").trim();

  if (!email || !password) {
    return createCorsResponse({ success: false, message: "Email et mot de passe requis." });
  }

  const ss = SpreadsheetApp.openById('1KMdm740bc24Dx4puD71n5KTFrPqYVNl_f3T12hjYlKQ');
  const sheet = ss.getSheetByName("IClients");

  if (!sheet) {
    return createCorsResponse({ success: false, message: "Feuille IClients introuvable" });
  }

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const emailSheet = (data[i][4] || "").toLowerCase().trim();   // Colonne E = email
    const passwordSheet = (data[i][9] || "").trim();               // Colonne J = mot de passe
    if (email === emailSheet && password === passwordSheet) {
      return createCorsResponse({ success: true, message: "Utilisateur authentifié." });
    }
  }

  return createCorsResponse({ success: false, message: "Email ou mot de passe incorrect." });
}


    fichier LoginPasswordPrestataire
    function generatePassword(length = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function generatePasswordsForValidatedPrestataires() {
  const sheetName = 'IPrestataires';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const data = sheet.getRange(2, 1, lastRow - 1, 12).getValues(); // A à L
  let updated = false;

  for (let i = 0; i < data.length; i++) {
    const prenom = data[i][0];         // Col A
    const nom = data[i][1];            // Col B
    const email = data[i][4];          // Col E
    const validation = data[i][11];    // Col L
    const password = data[i][10];      // Col K

    if (validation && validation.toString().toLowerCase() === 'oui' && !password && email) {
      const newPassword = generatePassword(10);
      data[i][10] = newPassword; // Écrire le mot de passe en colonne K

      try {
        MailApp.sendEmail({
          to: email,
          subject: 'Bienvenue sur Viiveo – Vos accès prestataire 👩‍⚕️',
          htmlBody: `
            <div style="font-family: Arial, sans-serif; font-size: 15px; color: #333;">
              <div style="text-align: center; margin-bottom: 20px;">
                <img src="https://i.postimg.cc/VNqjxcQX/logo-viiveo-2.png" alt="Viiveo" style="max-width: 200px;">
              </div>

              <p>Bonjour ${prenom} 👋,</p>

              <p>Vous êtes désormais validé(e) comme prestataire sur la plateforme <strong>Viiveo</strong>.</p>

              <p>Voici votre mot de passe personnel :</p>

              <p style="font-size: 18px; font-weight: bold; color: #2e7d32; text-align: center; border: 1px solid #2e7d32; padding: 10px; border-radius: 6px; background-color: #e8f5e9;">
                ${newPassword}
              </p>

              <p>Conservez-le précieusement. Vous pourrez le modifier une fois connecté(e) à votre espace.</p>

              <p style="margin-top: 30px;">À bientôt sur <strong>Viiveo</strong> 🌿<br>L’équipe Viiveo</p>
            </div>
          `
        });

        updated = true;

      } catch (err) {
        Logger.log("Erreur d'envoi d'e-mail pour " + email + ": " + err);
      }
    }
  }

  if (updated) {
    sheet.getRange(2, 1, data.length, 12).setValues(data); // Écrire les données modifiées
  }
}

function createTriggerForPrestataires() {
  ScriptApp.newTrigger('generatePasswordsForValidatedPrestataires')
    .timeBased()
    .everyMinutes(5)
    .create();
}

function notifierNouvelInscrit() {
  const sheetName = 'IPrestataires';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, 12); // colonnes A à L
  const data = dataRange.getValues();

  const propKey = 'derniereLigneNotifiee';
  const scriptProps = PropertiesService.getScriptProperties();
  const lastNotified = parseInt(scriptProps.getProperty(propKey) || 0);
  const currentLastRow = sheet.getLastRow();

  if (currentLastRow - 1 > lastNotified) {
    const newEntries = data.slice(lastNotified); // uniquement les nouvelles lignes

    newEntries.forEach((row, i) => {
      const prenom = row[0];
      const nom = row[1];
      const email = row[4];
      const specialite = row[5];
      const rowIndex = lastNotified + 2 + i; // +2 car index base 0 et entête

      const sheetId = sheet.getSheetId();
      const docId = ss.getId();
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${docId}/edit#gid=${sheetId}&range=A${rowIndex}`;

      const subject = `📥 Nouveau prestataire inscrit – ${prenom} ${nom}`;
      const body = `
Bonjour,

Un nouveau candidat s’est inscrit sur la plateforme Viiveo comme prestataire pour le service : *${specialite}*.

👤 Nom : ${prenom} ${nom}  
📧 Email : ${email}  
📄  à valider : ${sheetUrl}

Merci de valider ou refuser via la colonne L (Validé ?).

— Viiveo
`;

      MailApp.sendEmail({
        to: "gm.harchies@gmail.com",
        subject: subject,
        htmlBody: body.replace(/\n/g, "<br>")
      });
    });

    scriptProps.setProperty(propKey, currentLastRow - 1); // maj du dernier notifié
  }
}

function creerDeclencheurToutesLes5Minutes() {
  const fonction = 'notifierNouvelInscrit';

  // Vérifie si le déclencheur existe déjà pour éviter les doublons
  const allTriggers = ScriptApp.getProjectTriggers();
  const existeDeja = allTriggers.some(trigger =>
    trigger.getHandlerFunction() === fonction &&
    trigger.getEventType() === ScriptApp.EventType.CLOCK
  );

  if (!existeDeja) {
    ScriptApp.newTrigger(fonction)
      .timeBased()
      .everyMinutes(5) // ⏱️ Toutes les 5 minutes
      .create();
    Logger.log("✅ Déclencheur toutes les 5 minutes créé.");
  } else {
    Logger.log("⚠️ Le déclencheur existe déjà.");
  }
}


    
    fichier NotificationPrestataire
    function normalizeText(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
function handleLoginPresta(e) {
  const email = (e.parameter.email || "").toLowerCase();
  const password = e.parameter.password;

  const sheet = SpreadsheetApp.getActive().getSheetByName("IPrestataires");
  const data = sheet.getDataRange().getValues();
  const match = data.find(row =>
    (row[4] || "").toLowerCase() === email && row[10] === password
  );

  if (match) {
    return ContentService.createTextOutput(JSON.stringify({ success: true }));
  } else {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Identifiants invalides" }));
  }
}

function handleGetPrestataires(e) {
  const ss = SpreadsheetApp.openById('1KMdm740bc24Dx4puD71n5KTFrPqYVNl_f3T12hjYlKQ');
  const sheet = ss.getSheetByName('IPrestataires');
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).getValues();

  const specialiteDemandeeRaw = e.parameter.specialite || "";
  const specialiteDemandee = specialiteDemandeeRaw.trim().toLowerCase();
  const type = (e.parameter.type || "").toLowerCase();

  // Log pour debug
  Logger.log(`Specialite demandée: "${specialiteDemandeeRaw}" -> normalisée: "${specialiteDemandee}"`);
  Logger.log(`Nombre total de lignes dans IPrestataires: ${values.length}`);

  const filtres = values.filter(row => {
    let validationCell = row[11] ? row[11].toString().trim().toLowerCase() : "";
    validationCell = validationCell.replace(/[\u200B-\u200D\uFEFF]/g, "");
    const valide = validationCell === "oui";

    const specialiteCell = row[5] ? row[5].toString().trim().toLowerCase() : "";
    const matchSpec = specialiteDemandee ? specialiteCell === specialiteDemandee : true;

    return valide && matchSpec;
  });

  Logger.log(`Nombre de prestataires filtrés : ${filtres.length}`);

  const result = type === "dropdown"
    ? {
        success: true,
        prestataires: filtres.map(r => ({
          nomComplet: `${r[0]} ${r[1]}`.trim(),
          email: r[4],
          specialite: r[5]
        }))
      }
    : {
        success: true,
        prestataires: filtres.map(r => ({
          prenom: r[0],
          nom: r[1],
          adresse: r[2],
          telephone: r[3],
          email: r[4],
          specialite: r[5],
          disponibilite: r[6],
          photo: r[7] || "https://via.placeholder.com/300x200?text=Photo",
          commentaire: r[8] || ""
        }))
      };

  return result; // **IMPORTANT** : juste l'objet, pas de ContentService ici
}



function testHandleGetPrestataires() {
  const fakeEvent = {
    parameter: {
      specialite: "aide ménagère",
      type: "dropdown"
    }
  };
  const result = handleGetPrestataires(fakeEvent);
  Logger.log(result.getContent());
}

function getMissionsForPresta(e) {
  const email = (e.parameter.email || "").toLowerCase();
  Logger.log("🔍 Email reçu : " + email);
  
  const sheet = SpreadsheetApp.getActive().getSheetByName('Missions');
  if (!sheet) {
    Logger.log("❌ Feuille 'Missions' introuvable.");
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Feuille manquante" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const data = sheet.getDataRange().getValues();
  Logger.log("📋 Lignes lues : " + data.length);

  const filtered = data.slice(1).filter(row => {
    const prestEmail = (row[2] || "").toLowerCase(); // colonne C
    const statut = row[8]; // colonne I
    return prestEmail === email &&
      ["en attente", "confirmée", "validée", "terminée"].includes(statut);
  });

  Logger.log("✅ Missions trouvées : " + filtered.length);

  const missions = filtered.map(row => {
    const dateIso = (row[3] instanceof Date) ? row[3].toISOString() : "";
    const heureIso = (row[4] instanceof Date) ? row[4].toISOString() : "";
    return {
      id: row[0],
      client: row[6],
      adresse: row[7],
      service: row[5],
      date: dateIso,
      heure: heureIso,
      statut: row[8] || "",
      validationClient: row[12] || ""
    };
  });

  Logger.log("🧾 Exemple mission : " + JSON.stringify(missions[0]));

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    missions: missions
  })).setMimeType(ContentService.MimeType.JSON);
}

function validerMission(e) {
  const id = e.parameter.id;
  const ss = SpreadsheetApp.getActive();
  const sheetMissions = ss.getSheetByName('Missions');
  const sheetForm = ss.getSheetByName('FormResponses');

  const missionsData = sheetMissions.getDataRange().getValues();
  const formData = sheetForm.getDataRange().getValues();

  let idDemande = null;

  // 🔁 Étape 1 : Mise à jour dans la feuille Missions
  for (let i = 1; i < missionsData.length; i++) {
    if (missionsData[i][0] === id) {
      idDemande = missionsData[i][1]; // Colonne B : ID Demande
      sheetMissions.getRange(i + 1, 9).setValue('confirmée'); // Colonne I : Statut
      sheetMissions.getRange(i + 1, 10).setValue('✅');        // Colonne J : Réponse prestataire
      break;
    }
  }

  if (!idDemande) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "ID mission introuvable" }))
                         .setMimeType(ContentService.MimeType.JSON);
  }

  // 🔁 Étape 2 : Recherche de l’e-mail du client dans FormResponses
  for (let j = 1; j < formData.length; j++) {
    const formId = formData[j][11]; // Colonne L = index 11
    if (formId === idDemande) {
      const emailClient = formData[j][4]; // Colonne E = Email
      const nomClient = formData[j][2];   // Colonne C = Prénom
      const service = formData[j][5];     // Colonne F = Service
      const date = formData[j][6];        // Colonne G = Date
      const heure = formData[j][7];       // Colonne H = Heure

      // 📧 Envoi de l'e-mail de confirmation
      const sujet = "✅ Confirmation de votre mission Viiveo";
      const message = `
Bonjour ${nomClient},

Votre demande de service (${service}) prévue le ${date} à ${heure} a été confirmée par notre prestataire.

Merci pour votre confiance.  
Vous pouvez suivre vos prestations depuis votre espace client Viiveo.

À bientôt,  
L’équipe Viiveo`;

      MailApp.sendEmail(emailClient, sujet, message);
      break;
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ success: true }))
                       .setMimeType(ContentService.MimeType.JSON);
}


function refuserMission(e) {
  const id = e.parameter.id;
  const alternatives = e.parameter.alternatives;
  const sheet = SpreadsheetApp.getActive().getSheetByName('Missions');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.getRange(i + 1, 9).setValue('refusée');       // Statut
      sheet.getRange(i + 1, 10).setValue('❌');            // Réponse prestataire
      sheet.getRange(i + 1, 11).setValue(alternatives);   // Dates alternatives
      break;
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ success: true }))
                       .setMimeType(ContentService.MimeType.JSON);
}

function testGetMissionsForPresta() {
  const fakeEvent = {
    parameter: {
      email: 'gm.harchies@gmail.com' // remplace par un email valide dans ta feuille Missions
    }
  };
  const output = getMissionsForPresta(fakeEvent);
  Logger.log(output.getContent());
}

function getPrestataireNameByEmail(email) {
  const ss = SpreadsheetApp.openById('1KMdm740bc24Dx4puD71n5KTFrPqYVNl_f3T12hjYlKQ'); // ID de ta feuille Google Sheets
  const sheet = ss.getSheetByName('IPrestataires');
  if (!sheet) return {prenom: "", nom: ""};

  const data = sheet.getDataRange().getValues(); // toutes les données
  // Supposons que : 
  // Colonne A = Prénom (index 0)
  // Colonne B = Nom (index 1)
  // Colonne C = Email (index 2) — à adapter si ton ordre diffère

  for (let i = 1; i < data.length; i++) { // commence à 1 pour sauter l'en-tête
    if (data[i][2].toString().trim().toLowerCase() === email.trim().toLowerCase()) {
      return {
        prenom: data[i][0],
        nom: data[i][1]
      };
    }
  }
  return {prenom: "", nom: ""}; // pas trouvé
}

function validerPrestationClient(e) {
  const id = e.parameter.id;
  const sheet = SpreadsheetApp.getActive().getSheetByName("Missions");
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.getRange(i + 1, 13).setValue("validée"); // Colonne M (index 13)

      // Préparer les infos pour le mail
      const emailPresta = data[i][2];   // Col C : Email prestataire
      const clientNom = data[i][6];     // Col G : Client
      const clientAdresse = data[i][7]; // Col H : Adresse
      const service = data[i][5];       // Col F : Service
      const dateRaw = data[i][3];       // Col D : Date
      const heure = data[i][4];         // Col E : Heure

      // Formatage date
      let dateFormatted = "";
      if (dateRaw instanceof Date) {
        dateFormatted = Utilities.formatDate(dateRaw, Session.getScriptTimeZone(), "dd/MM/yyyy");
      } else {
        dateFormatted = dateRaw.toString();
      }

      // Corps du mail
      const sujet = "Prestation validée par le client";
      const corps = `
Bonjour,

Le client ${clientNom} a validé la prestation suivante :

Service : ${service}
Date : ${dateFormatted}
Heure : ${heure}
Adresse : ${clientAdresse}

Vous pouvez désormais adresser votre facture au client.

Cordialement,
L'équipe Viiveo`;

      // Envoi mail
      MailApp.sendEmail(emailPresta, sujet, corps);

      return ContentService.createTextOutput(JSON.stringify({ success: true }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ success: false, error: "ID non trouvé" }))
                       .setMimeType(ContentService.MimeType.JSON);
}

function getAllValidatedPrestataires() {
  const sheet = SpreadsheetApp.getActive().getSheetByName("IPrestataires");
  const data = sheet.getDataRange().getValues();
  data.shift(); // Supprimer les entêtes

  return data
    .filter(row => row[11]?.toString().toLowerCase() === "oui") // Colonne L = "oui"
    .map(row => ({
      prenom: row[0],
      nom: row[1],
      adresse: row[2],
      telephone: row[3],
      email: row[4],
      specialite: row[5],
      disponibilite: row[6],
      photo: row[7] || "https://via.placeholder.com/300x200?text=Photo",
      commentaire: row[8] || ""
    }));
}

function verifierQRClient(e) {
  const idClient = (e.parameter.idclient || e.parameter.clientId || "").trim();
  const emailPresta = (e.parameter.email || "").trim().toLowerCase();
  const callback = e.parameter.callback; // support JSONP
  const today = Utilities.formatDate(new Date(), "Europe/Brussels", "yyyy-MM-dd");

  Logger.log(`🔍 Params reçus : idClient='${idClient}', emailPresta='${emailPresta}', callback='${callback}'`);
  Logger.log(`🔍 Date aujourd'hui : ${today}`);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetMissions = ss.getSheetByName("Missions");
  const sheetForms = ss.getSheetByName("FormResponses");

  if (!sheetMissions || !sheetForms) {
    Logger.log("❌ Feuilles manquantes.");
    return jsonpResponse(callback, {
      success: false,
      message: "Feuilles manquantes."
    });
  }

  const missions = sheetMissions.getDataRange().getValues();
  const forms = sheetForms.getDataRange().getValues();

  Logger.log(`ℹ️ Nombre de missions trouvées : ${missions.length - 1}`);
  Logger.log(`ℹ️ Nombre de formulaires trouvés : ${forms.length - 1}`);

  for (let i = 1; i < missions.length; i++) {
    const missionId = String(missions[i][0]).trim();              // Col A
    const idDemande = String(missions[i][1]).trim();              // Col B
    const missionEmail = (missions[i][2] || "").toLowerCase();    // Col C
    const rawDate = missions[i][3];                               // Col D
    const missionIdClient = String(missions[i][12] || "").trim(); // Col M (index 12)
    const statut = (missions[i][8] || "").toLowerCase();          // Col I

    // Parse la date correctement selon le type de rawDate
    let dateMission;
    if (rawDate instanceof Date) {
      dateMission = rawDate;
    } else if (typeof rawDate === "string" && rawDate.includes("/")) {
      const [day, month, year] = rawDate.split("/");
      dateMission = new Date(`${year}-${month}-${day}`);
    } else if (typeof rawDate === "number") {
      // Si c'est un numéro (date sérialisée Google Sheets)
      dateMission = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
    } else {
      Logger.log(`⚠️ Ligne ${i + 1} : Date non reconnue : ${rawDate}`);
      continue;
    }

    const missionDate = Utilities.formatDate(dateMission, "Europe/Brussels", "yyyy-MM-dd");

    Logger.log(`Ligne ${i + 1}: idClient='${missionIdClient}', email='${missionEmail}', statut='${statut}', date='${missionDate}'`);

    if (
      missionIdClient === idClient &&
      missionEmail === emailPresta &&
      statut === "confirmée" &&
      missionDate === today
    ) {
      Logger.log(`✅ Mission correspondante trouvée à la ligne ${i + 1}`);

      for (let j = 1; j < forms.length; j++) {
        const idDemandeForm = String(forms[j][11]).trim(); // Col L

        if (idDemandeForm === idDemande) {
          const nom = forms[j][0];
          const prenom = forms[j][1];
          const emailClient = forms[j][4];

          Logger.log(`✅ Correspondance trouvée dans FormResponses à la ligne ${j + 1}`);

          return jsonpResponse(callback, {
            success: true,
            message: "✅ Client vérifié. Prestation peut commencer.",
            missionId,
            idDemande,
            client: {
              nom,
              prenom,
              email: emailClient
            }
          });
        }
      }

      Logger.log(`❌ ID Demande '${idDemande}' non trouvé dans FormResponses.`);
      return jsonpResponse(callback, {
        success: false,
        message: "❌ ID Demande non trouvé dans FormResponses."
      });
    }
  }

  Logger.log("❌ Aucune mission confirmée aujourd’hui pour ce client.");
  return jsonpResponse(callback, {
    success: false,
    message: "❌ Aucune mission confirmée aujourd’hui pour ce client."
  });
}

// Fonction d'encapsulation JSONP (inchangée)
function jsonpResponse(callback, data) {
  const json = JSON.stringify(data);
  const content = callback ? `${callback}(${json});` : json;
  return ContentService
    .createTextOutput(content)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function testVerifierQRClient() {
  const fakeE = {
    parameter: {
      idclient: "dupont",
      email: "presta@example.com"
    }
  };
  const result = verifierQRClient(fakeE);
  Logger.log(result);
}

function testDateType() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetMissions = ss.getSheetByName("Missions");
  
  if (!sheetMissions) {
    Logger.log("Feuille Missions introuvable.");
    return;
  }
  
  const data = sheetMissions.getDataRange().getValues();
  
  if (data.length < 2) {
    Logger.log("Pas assez de données dans Missions.");
    return;
  }
  
  const rawDate = data[1][3]; // ligne 2 (index 1), colonne D (index 3)
  
  Logger.log("rawDate value: " + rawDate);
  Logger.log("rawDate type: " + Object.prototype.toString.call(rawDate));
}


fichier router
    function doGet(e) {
  const type = (e?.parameter?.type || "").toLowerCase();
  const callback = e.parameter.callback; // prise en charge JSONP

  Logger.log(`🔍 Type reçu : ${type}`);
  if (!type) {
    const errResp = { error: "Paramètre 'type' requis." };
    return createCorsResponse(errResp, callback);
  }

  try {
    let data;

    switch (type) {
      case "loginpresta":
        data = JSON.parse(handleLoginPresta(e).getContent());
        break;

      case "missionspresta":
        data = JSON.parse(getMissionsForPresta(e).getContent());
        break;

      case "validermission":
        data = JSON.parse(validerMission(e).getContent());
        break;

      case "refusermission":
        data = JSON.parse(refuserMission(e).getContent());
        break;

      case "dropdown":
      case "prestataires":
        // handleGetPrestataires ne retourne pas TextOutput, adapte:
        data = handleGetPrestataires(e);
        break;

      case "getclientdata":
        data = JSON.parse(getClientData(e).getContent());
        break;

      case "getmissionbyid":
        data = JSON.parse(getMissionById(e).getContent());
        break;

      case "getprestataire":
        data = JSON.parse(getPrestataireByEmail(e).getContent());
        break;

      case "validerprestationclient":
        data = JSON.parse(validerPrestationClient(e).getContent());
        break;

      case "verifqr":
  return verifierQRClient(e); // ✅ Corrige le bug de cbTest({})


      case "getprestatairesstylés": {
        const specialiteDemandee = (e.parameter.specialite || "").toLowerCase();
        const tousLesPrestataires = getAllValidatedPrestataires();
        const prestatairesFiltres = tousLesPrestataires.filter(p =>
          (p.specialite || "").toLowerCase() === specialiteDemandee
        );
        data = { success: true, prestataires: prestatairesFiltres };
        break;
      }

      case "startprestation":
        data = JSON.parse(handleStartPrestation(e).getContent());
        break;

      case "verifyclientemail": {
        const emailParam = e.parameter.email || "";
        const email = decodeURIComponent(emailParam.trim().toLowerCase());
        const sheet = SpreadsheetApp.getActive().getSheetByName("IClients");

        if (!sheet) {
          data = { success: false, message: "Feuille IClients introuvable" };
          break;
        }

        const sheetData = sheet.getDataRange().getValues();
        let found = false;
        for (let i = 1; i < sheetData.length; i++) {
          const emailSheet = (sheetData[i][4] || "").trim().toLowerCase();
          if (emailSheet === email) {
            data = { success: true, prenom: sheetData[i][0], nom: sheetData[i][1] };
            found = true;
            break;
          }
        }
        if (!found) {
          data = { success: false, message: "Client introuvable" };
        }
        break;
      }

      default:
        Logger.log(`❓ Type de requête inconnu : ${type}`);
        data = { error: "Type inconnu" };
    }

    return createCorsResponse(data, callback);

  } catch (err) {
    Logger.log("❌ Erreur interne : " + err.message);
    return createCorsResponse({ success: false, message: err.message }, callback);
  }
}

/**
 * Crée une réponse JSON ou JSONP avec gestion CORS
 * @param {object} data 
 * @param {string} callback - nom de la fonction callback JSONP
 */
function createCorsResponse(data, callback) {
  const json = JSON.stringify(data);
  if (callback) {
    // JSONP
    const output = callback + "(" + json + ");";
    return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JAVASCRIPT);
  } else {
    // JSON classique, bloqué par CORS si front différent
    return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
  }
}

function handleStartPrestation(e) {
  const id = e.parameter.id;
  if (!id) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Paramètre id requis." })).setMimeType(ContentService.MimeType.JSON);
  }

  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName("Missions");
  const data = sheet.getDataRange().getValues();

  // Trouve la ligne où l'id correspond (supposons colonne A, index 0)
  const rowIndex = data.findIndex(row => row[0] == id);
  if (rowIndex === -1) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Ligne de mission introuvable." })).setMimeType(ContentService.MimeType.JSON);
  }

  // Exemple : mettre à jour le statut (supposons colonne 8 = I = statut)
  sheet.getRange(rowIndex + 1, 9).setValue("en cours");  // +1 car lignes commencent à 1, 9 = colonne I

  return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Prestation démarrée." })).setMimeType(ContentService.MimeType.JSON);
}



          fichier API
          function createPostCorsResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    Logger.log("Paramètres reçus : " + JSON.stringify(e.parameter));

    const type = (e.parameter.type || "").trim();
    Logger.log("Type reçu : " + type);

    let result;

    if (type === "formClient") {
      result = handleFormClient(e);
    } else if (type === "envoyerFiche") {
      result = handleFicheObservation(e);
    } else if (type === "ajoutCredits") {
      result = handleAjoutCredits(e);
    } else {
      result = {
        success: false,
        message: "Type de requête non reconnu",
        params: e.parameter
      };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        message: err.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}




/**
 * Ajoute des crédits à un client identifié par son mot de passe.
 * Mot de passe dans colonne O (index 14), crédits en colonne R (index 17)
 */
function handleAjoutCredits(e) {
  const motdepasse = e.parameter.motdepasse;
  const pack = e.parameter.pack;
  const creditsToAdd = parseInt(e.parameter.credits, 10);

  if (!motdepasse || !pack || isNaN(creditsToAdd)) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "Paramètres manquants ou invalides"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("IClients");
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "Feuille IClients introuvable"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const data = sheet.getDataRange().getValues();

  // Recherche client par mot de passe dans colonne O (index 14)
  let clientRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][14] && data[i][14].toString() === motdepasse) {
      clientRow = i + 1; // 1-based index pour SpreadsheetApp
      break;
    }
  }

  if (clientRow === -1) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "Mot de passe client invalide"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // Colonne R = 18ème colonne (1-based), index 17 en 0-based
  const colCredits = 18; 
  let currentCredits = sheet.getRange(clientRow, colCredits).getValue();
  currentCredits = currentCredits ? parseInt(currentCredits, 10) : 0;

  const newCredits = currentCredits + creditsToAdd;
  sheet.getRange(clientRow, colCredits).setValue(newCredits);

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: `Crédits ajoutés : ${creditsToAdd}. Nouveau solde : ${newCredits}.`
  })).setMimeType(ContentService.MimeType.JSON);
}



    
