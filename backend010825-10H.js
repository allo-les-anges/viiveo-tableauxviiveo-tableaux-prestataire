FormResponses
/**
 * Gère les soumissions de formulaire client, valide les données,
 * recherche le client, génère des identifiants de mission,
 * enregistre la mission dans une feuille Google Sheets,
 * et envoie un e-mail au prestataire.
 * @param {Object} e L'événement de soumission du formulaire, contenant les paramètres.
 * @returns {Object} Un objet indiquant le succès ou l'échec de l'opération, avec un message.
 */
function handleFormClient(e) {
  try {
    Logger.log("📩 Paramètres reçus dans handleFormClient : " + JSON.stringify(e.parameter));

    // Récupération et nettoyage des paramètres du formulaire
    const prenomPrestataire = e.parameter.prenom_prestataire?.trim();
    const nomPrestataire = e.parameter.nom_prestataire?.trim();
    const prestataireNomComplet = (prenomPrestataire && nomPrestataire) ? `${prenomPrestataire} ${nomPrestataire}` : "Pas de préférence";

    const prenomClient = e.parameter.prenom?.trim();
    const nomClient = e.parameter.nom?.trim();
    const emailClient = e.parameter.email?.trim();
    const passwordClient = e.parameter.password?.trim(); // Ajout du mot de passe client
    const adresseClient = e.parameter.adresse?.trim(); // Ajout de l'adresse client

    const service = e.parameter.service?.trim();
    const dateIntervention = e.parameter.date?.trim(); // Renommé pour plus de clarté
    const heure = e.parameter.heure?.trim();
    const commentaire = e.parameter.commentaire?.trim();

    // Date de la soumission du formulaire (aujourd'hui)
    const dateDemande = new Date().toLocaleDateString('fr-FR'); // Format DD/MM/YYYY

    // Vérification des champs requis
    if (!prenomClient || !nomClient || !emailClient || !passwordClient || !service || !dateIntervention || !heure || !adresseClient) {
      Logger.log("❌ handleFormClient: Champs requis manquants dans la requête.");
      return { success: false, message: "Champs requis manquants (Prénom, Nom, Email, Mot de passe, Adresse, Service, Date, Heure)." };
    }

    // Fonction utilitaire pour obtenir l'email d'un prestataire par son nom complet
    let emailPrestataire = null;
    if (prenomPrestataire && nomPrestataire && prenomPrestataire !== "" && nomPrestataire !== "") {
        emailPrestataire = getPrestataireEmailByName(prenomPrestataire, nomPrestataire);
        if (!emailPrestataire) {
            Logger.log(`❌ handleFormClient: Aucun email trouvé pour le prestataire sélectionné : ${prenomPrestataire} ${nomPrestataire} (ou prestataire non validé).`);
        }
    }

    // Récupérer les données des clients depuis la feuille "IClients"
    // REMPLACEZ "1KMdm740bc24Dx4puD71n5KTFrPqYVNl_f3T12hjYlKQ" PAR L'ID DE VOTRE PROPRE FEUILLE GOOGLE SHEET
    const ss = SpreadsheetApp.openById("1KMdm740bc24Dx4puD71n5KTFrPqYVNl_f3T12hjYlKQ");
    const sheetClients = ss.getSheetByName("IClients");
    if (!sheetClients) {
        Logger.log("❌ handleFormClient: Feuille 'IClients' introuvable.");
        return { success: false, message: "Feuille 'IClients' introuvable." };
    }

    const clientsData = sheetClients.getDataRange().getValues();
    const clientHeaders = clientsData[0].map(h => String(h).trim().toLowerCase());

    Logger.log("handleFormClient: En-têtes de la feuille IClients: " + JSON.stringify(clientHeaders));

    // Définir les indices de colonne pour IClients en utilisant les en-têtes
    const clientPrenomCol = clientHeaders.indexOf("prénom");
    const clientNomCol = clientHeaders.indexOf("nom");
    const clientAdresseCol = clientHeaders.indexOf("adresse");
    const clientEmailCol = clientHeaders.indexOf("email");
    const clientPasswordCol = clientHeaders.indexOf("mot de passe");
    const clientIdCol = clientHeaders.indexOf("id client");

    // Vérifier si toutes les colonnes essentielles sont trouvées dans IClients
    const requiredClientCols = {
        "prénom": clientPrenomCol,
        "nom": clientNomCol,
        "adresse": clientAdresseCol,
        "email": clientEmailCol,
        "mot de passe": clientPasswordCol,
        "id client": clientIdCol
    };
    const missingClientCols = Object.keys(requiredClientCols).filter(key => requiredClientCols[key] === -1);
    if (missingClientCols.length > 0) {
        Logger.log(`❌ handleFormClient: Colonnes essentielles manquantes dans IClients: ${missingClientCols.join(', ')}.`);
        return { success: false, message: `Colonnes essentielles manquantes dans IClients: ${missingClientCols.join(', ')}.` };
    }

    let clientTrouve = null;
    for (let i = 1; i < clientsData.length; i++) {
      const row = clientsData[i];
      const prenomFeuille = (row[clientPrenomCol] || "").toString().trim().toLowerCase();
      const nomFeuille = (row[clientNomCol] || "").toString().trim().toLowerCase();
      const emailFeuille = (row[clientEmailCol] || "").toString().trim().toLowerCase();
      const passwordFeuille = (row[clientPasswordCol] || "").toString().trim();

      if (
        prenomFeuille === prenomClient.toLowerCase() &&
        nomFeuille === nomClient.toLowerCase() &&
        emailFeuille === emailClient.toLowerCase() &&
        passwordFeuille === passwordClient
      ) {
        clientTrouve = {
          prenom: (row[clientPrenomCol] || "").toString().trim(),
          nom: (row[clientNomCol] || "").toString().trim(),
          email: (row[clientEmailCol] || "").toString().trim(),
          adresse: (row[clientAdresseCol] || "").toString().trim(),
          idClient: (row[clientIdCol] || "").toString().trim()
        };
        Logger.log(`✅ handleFormClient: Client trouvé dans IClients: ${clientTrouve.prenom} ${clientTrouve.nom} (${clientTrouve.email})`);
        break;
      }
    }

    if (!clientTrouve) {
      Logger.log(`❌ handleFormClient: Client non trouvé ou identifiants incorrects dans IClients - Prénom: ${prenomClient}, Nom: ${nomClient}, Email: ${emailClient}`);
      return { success: false, message: "Client introuvable ou mot de passe incorrect." };
    }

    if (!clientTrouve.prenom || clientTrouve.prenom.trim() === "" || !clientTrouve.nom || clientTrouve.nom.trim() === "") {
      Logger.log(`❌ handleFormClient: Client trouvé mais nom incomplet dans IClients - Prénom: '${clientTrouve.prenom}', Nom: '${clientTrouve.nom}'`);
      return { success: false, message: "Client trouvé mais son prénom ou nom est incomplet dans la base de données IClients. Veuillez corriger la fiche client." };
    }

    // Récupérer les données de la feuille "Missions" pour trouver le dernier ID séquentiel
    const sheetMissions = ss.getSheetByName("Missions");
    if (!sheetMissions) {
        Logger.log("❌ handleFormClient: Feuille 'Missions' introuvable.");
        return { success: false, message: "Feuille 'Missions' introuvable." };
    }
    const missionsData = sheetMissions.getDataRange().getValues();
    const missionsHeaders = missionsData[0].map(h => String(h).trim().toLowerCase());

    const missionIdCol = missionsHeaders.indexOf("id");
    const demandeIdCol = missionsHeaders.indexOf("id demande");

    if (missionIdCol === -1 || demandeIdCol === -1) {
        Logger.log("❌ handleFormClient: Colonnes 'ID' ou 'ID Demande' manquantes dans la feuille 'Missions'.");
        return { success: false, message: "Colonnes 'ID' ou 'ID Demande' manquantes dans la feuille Missions." };
    }

    let maxMissionNum = 0;
    let maxDemandeNum = 0;

    for (let i = 1; i < missionsData.length; i++) {
      const currentMissionId = missionsData[i][missionIdCol]?.toString().trim();
      const currentDemandeId = missionsData[i][demandeIdCol]?.toString().trim();

      const missionMatch = currentMissionId ? currentMissionId.match(/^M(\d+)$/) : null;
      const demandeMatch = currentDemandeId ? currentDemandeId.match(/^D(\d+)$/) : null;

      if (missionMatch) {
        const num = parseInt(missionMatch[1], 10);
        if (!isNaN(num) && num > maxMissionNum) {
          maxMissionNum = num;
        }
      }

      if (demandeMatch) {
        const num = parseInt(demandeMatch[1], 10);
        if (!isNaN(num) && num > maxDemandeNum) {
          maxDemandeNum = num;
        }
      }
    }

    const newMissionId = "M" + String(maxMissionNum + 1).padStart(4, "0");
    const newDemandeId = "D" + String(maxDemandeNum + 1).padStart(4, "0");
    Logger.log(`handleFormClient: Generated Mission ID: ${newMissionId}, Demande ID: ${newDemandeId}`);

    // --- Écriture dans la feuille "Missions" ---
    const missionRow = [
      newMissionId,                   // Col ID (A)
      newDemandeId,                   // Col ID Demande (B)
      emailPrestataire || "",         // Col Email Prestataire (C)
      dateIntervention,               // Col Date (D)
      heure,                          // Col Heure (E)
      service,                        // Col Service (F)
      `${clientTrouve.prenom} ${clientTrouve.nom}`, // Col Client (G)
      clientTrouve.adresse || "",     // Col Adresse (H)
      "en attente",                   // Col Statut (I)
      "",                             // Colonne vide (J)
      "",                             // Colonne vide (K)
      "",                             // Colonne vide (L)
      clientTrouve.idClient || ""     // Col id client (ID Client QR) (M)
    ];
    Logger.log("handleFormClient: Row to be appended to Missions sheet: " + JSON.stringify(missionRow));

    sheetMissions.appendRow(missionRow);
    Logger.log("handleFormClient: Row appended successfully to Missions sheet.");


    // --- Écriture dans la feuille "FormResponses" ---
    const sheetFormResponses = ss.getSheetByName("FormResponses");
    if (!sheetFormResponses) {
      Logger.log("❌ handleFormClient: Feuille 'FormResponses' introuvable. Impossible d'enregistrer la demande.");
      return { success: true, message: `Demande de mission enregistrée pour le client ${clientTrouve.prenom} ${clientTrouve.nom}. (Feuille FormResponses manquante)` };
    }

    const formResponseRow = [
      dateDemande,      // "Demande dû" (Maintenant la date du jour de la soumission) (A)
      nomClient,        // "Nom" (B)
      prenomClient,     // "Prénom" (C)
      adresseClient,    // "Adresse" (D)
      emailClient,      // "E-mail" (E)
      service,          // "Service" (F)
      dateIntervention, // "Intervention" (Date de l'intervention planifiée) (G)
      heure,            // "Heure" (H)
      commentaire,      // "Tâche" (I)
      nomPrestataire,   // "Nom Prestataire" (J)
      prenomPrestataire,// "Prénom Pest." (K)
      newDemandeId      // "ID Demande" (L)
    ];
    Logger.log("handleFormClient: Row to be appended to FormResponses sheet: " + JSON.stringify(formResponseRow));
    sheetFormResponses.appendRow(formResponseRow);
    Logger.log("handleFormClient: Row appended successfully to FormResponses sheet.");


    // Envoi de l'e-mail au prestataire (si un prestataire a été choisi)
    if (emailPrestataire) {
        MailApp.sendEmail({
            to: emailPrestataire,
            subject: `Nouvelle mission - ${service}`,
            htmlBody: `<p>Bonjour ${prenomPrestataire},</p>
                       <p>Une mission vous a été attribuée pour le ${dateIntervention} à ${heure}.</p>
                       <p><strong>Service :</strong> ${service}</p>
                       <p>Merci de vous connecter à votre espace pour confirmer ou refuser.</p>`
        });
        Logger.log(`handleFormClient: Email sent to prestataire: ${emailPrestataire}`);
    } else {
        Logger.log("handleFormClient: Pas d'email prestataire, pas d'envoi d'email.");
    }

    return { success: true, message: `Demande de mission enregistrée pour le client ${clientTrouve.prenom} ${clientTrouve.nom}.` };

  } catch (error) {
    Logger.log("❌ Erreur dans handleFormClient: " + error.message);
    return { success: false, message: "Erreur serveur : " + error.message };
  }
}

// Fonction utilitaire pour obtenir l'email d'un prestataire par son nom complet
function getPrestataireEmailByName(prenom, nom) {
    Logger.log(`getPrestataireEmailByName: Recherche de l'email pour ${prenom} ${nom}`);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetPrestataires = ss.getSheetByName("IPrestataires");
    if (!sheetPrestataires) {
        Logger.log("getPrestataireEmailByName: Feuille 'IPrestataires' introuvable.");
        return null;
    }

    const data = sheetPrestataires.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());

    const prenomCol = headers.indexOf("prénom");
    const nomCol = headers.indexOf("nom");
    const emailCol = headers.indexOf("e-mail");
    const valideCol = headers.indexOf("validé ?");

    if ([prenomCol, nomCol, emailCol, valideCol].some(idx => idx === -1)) {
        Logger.log("getPrestataireEmailByName: Colonnes essentielles (Prénom, Nom, E-mail, Validé ?) manquantes dans 'IPrestataires'.");
        return null;
    }

    const searchPrenom = prenom.toLowerCase();
    const searchNom = nom.toLowerCase();

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const sheetPrenom = (row[prenomCol] || "").toString().trim().toLowerCase();
        const sheetNom = (row[nomCol] || "").toString().trim().toLowerCase();
        const sheetEmail = (row[emailCol] || "").toString().trim();
        const sheetValide = (row[valideCol] || "").toString().trim().toLowerCase();

        if (sheetPrenom === searchPrenom && sheetNom === searchNom && sheetValide === "oui") {
            Logger.log(`getPrestataireEmailByName: Prestataire trouvé: ${sheetEmail}`);
            return sheetEmail;
        }
    }
    Logger.log(`getPrestataireEmailByName: Prestataire ${prenom} ${nom} non trouvé ou non validé.`);
    return null;
}

/**
 * Fonction déclenchée après l'ajout d'une ligne dans "FormResponses" (par un Google Form).
 * Crée une mission dans la feuille "Missions" et envoie une notification.
 * @param {GoogleAppsScript.Events.SheetsOnFormSubmit} e L'objet événement de soumission du formulaire.
 */
function onFormSubmit(e) {
  Logger.log("--- DÉBUT onFormSubmit ---");
  const ss = e.source;
  const sheetForm = ss.getSheetByName('FormResponses');
  const sheetMissions = ss.getSheetByName('Missions');
  const sheetClients = ss.getSheetByName('IClients');

  if (!sheetForm || !sheetMissions || !sheetClients) {
    Logger.log("❌ onFormSubmit: ERREUR : Une ou plusieurs feuilles manquent.");
    return;
  }

  const rowNum = e.range.getRow();
  // Récupère toutes les données de la ligne qui vient d'être ajoutée
  const data = sheetForm.getRange(rowNum, 1, 1, sheetForm.getLastColumn()).getValues()[0];

  // Récupération des en-têtes de FormResponses pour une lecture robuste
  const formHeaders = sheetForm.getDataRange().getValues()[0].map(h => String(h).trim());
  const getColIndex = (headerName) => formHeaders.indexOf(headerName);

  const colIdxPrenomClient = getColIndex("Prénom");
  const colIdxNomClient = getColIndex("Nom");
  const colIdxAdresse = getColIndex("Adresse");
  const colIdxEmailClient = getColIndex("E-mail");
  const colIdxService = getColIndex("Service");
  const colIdxDate = getColIndex("Intervention"); // "Intervention" est la date dans FormResponses
  const colIdxHeure = getColIndex("Heure");
  const colIdxPrestaPrenom = getColIndex("Prénom Pest."); // Attention à l'orthographe "Pest."
  const colIdxPrestaNom = getColIndex("Nom Prestataire");
  const colIdxIdDemandeForm = getColIndex("ID Demande"); // Colonne L (index 11)

  // Vérification des indices de colonnes
  if ([colIdxPrenomClient, colIdxNomClient, colIdxAdresse, colIdxEmailClient, colIdxService, colIdxDate, colIdxHeure, colIdxPrestaPrenom, colIdxPrestaNom, colIdxIdDemandeForm].some(idx => idx === -1)) {
      Logger.log("❌ onFormSubmit: ERREUR : Une ou plusieurs colonnes essentielles sont introuvables dans FormResponses.");
      return;
  }

  const prenomClient = data[colIdxPrenomClient]?.toString().trim();
  const nomClient = data[colIdxNomClient]?.toString().trim();
  const adresse = data[colIdxAdresse]?.toString().trim();
  const emailClient = data[colIdxEmailClient]?.toString().trim();
  const service = data[colIdxService]?.toString().trim();
  const date = data[colIdxDate]; // La date brute
  const heure = data[colIdxHeure]; // L'heure brute
  const prestaPrenom = data[colIdxPrestaPrenom]?.toString().trim();
  const prestaNom = data[colIdxPrestaNom]?.toString().trim();

  // --- NOUVEAU: Récupération de l'ID client depuis IClients via email ---
  const clientsData = sheetClients.getDataRange().getValues();
  const clientsHeaders = clientsData[0].map(h => String(h).trim().toLowerCase());
  const colIndexClientsEmail = clientsHeaders.indexOf("e-mail");
  const colIndexClientsId = clientsHeaders.indexOf("id client");

  let idClient = "";
  if (colIndexClientsEmail !== -1 && colIndexClientsId !== -1) {
      for (let i = 1; i < clientsData.length; i++) {
          const clientEmailInSheet = clientsData[i][colIndexClientsEmail]?.toString().trim().toLowerCase();
          if (clientEmailInSheet === emailClient.toLowerCase()) {
              idClient = clientsData[i][colIndexClientsId]?.toString().trim();
              break;
          }
      }
  }

  if (!idClient) {
    Logger.log(`⚠️ onFormSubmit: ID client introuvable pour l'email ${emailClient} dans IClients.`);
  } else {
    Logger.log(`✅ onFormSubmit: ID client trouvé : ${idClient} pour l'email ${emailClient}.`);
  }

  // Récupération email prestataire
  const emailPresta = getPrestataireEmailByName(prestaPrenom, prestaNom);
  if (!emailPresta) {
    Logger.log(`⚠️ onFormSubmit: Aucun email prestataire trouvé pour ${prestaPrenom} ${prestaNom}.`);
  }

  // Génération de l'ID Demande basé sur le numéro de ligne dans FormResponses
  const idDemande = 'D' + String(rowNum).padStart(4, '0');
  Logger.log(`Generated ID Demande: ${idDemande} for row ${rowNum}`);

  // Génération de l'ID Mission
  const idMission = generateMissionId(sheetMissions);
  Logger.log(`Generated ID Mission: ${idMission}`);

  // Vérifier si la mission existe déjà pour éviter doublons (basé sur ID Demande)
  const missionsLastRow = sheetMissions.getLastRow();
  if (missionsLastRow > 1) {
    const missionsData = sheetMissions.getRange(2, 1, missionsLastRow - 1, sheetMissions.getLastColumn()).getValues();
    const colIndexMissionIdDemande = missionsData[0] ? missionsData[0].indexOf("ID Demande") : -1; // Re-obtenir l'index si nécessaire
    if (colIndexMissionIdDemande === -1) {
        Logger.log("❌ onFormSubmit: Colonne 'ID Demande' introuvable dans la feuille 'Missions' pour la vérification des doublons.");
        // Continuer sans vérification des doublons ou retourner une erreur
    } else {
        const idDemandesExistantes = missionsData.map(row => String(row[colIndexMissionIdDemande] || "").trim());
        if (idDemandesExistantes.includes(idDemande)) {
            Logger.log(`⚠️ onFormSubmit: Mission avec ID Demande ${idDemande} existe déjà dans 'Missions'. Abandon de la création.`);
            return;
        }
    }
  }


  // Ajout de la mission dans la feuille Missions
  // Assurez-vous que l'ordre des colonnes correspond aux en-têtes de votre feuille Missions
  // ["ID","ID Demande","Email Prestataire","Date","Heure","Service","Client","Adresse","Statut","Réponse Prestataire","Dates Alternatives","Validation client","id client"]
  sheetMissions.appendRow([
    idMission,                                  // A: ID Mission
    idDemande,                                  // B: ID Demande (le même que dans FormResponses)
    emailPresta,                                // C: Email Prestataire
    date,                                       // D: Date
    heure,                                      // E: Heure
    service,                                    // F: Service
    `${prenomClient} ${nomClient}`,             // G: Client (Prénom + Nom)
    adresse,                                    // H: Adresse
    'en attente',                               // I: Statut initial
    '',                                         // J: Réponse Prestataire
    '',                                         // K: Dates Alternatives
    '',                                         // L: Validation client
    idClient                                    // M: ID client (depuis IClients)
  ]);
  Logger.log(`✅ onFormSubmit: Nouvelle mission ${idMission} ajoutée avec ID client ${idClient}.`);

  // --- Écrire l’ID Demande dans la colonne L (12e colonne, index 11) de FormResponses ---
  // Cette ligne était déjà présente et est cruciale.
  const colCount = sheetForm.getLastColumn();
  if (colCount < 12) { // Si la colonne L (index 11) n'existe pas encore
      sheetForm.insertColumnAfter(colCount); // Insérer une colonne après la dernière existante
  }
  sheetForm.getRange(rowNum, colIdxIdDemandeForm + 1).setValue(idDemande); // Utilisation de l'index dynamique

  Logger.log(`✅ onFormSubmit: ID Demande ${idDemande} écrit dans la feuille 'FormResponses' à la ligne ${rowNum}, colonne L.`);


  // Envoi mail au prestataire (si email valide)
  if (emailPresta) {
    const sujet = `📝 Nouvelle mission Viiveo – ${service}`;
    const message = `
Bonjour,

Une nouvelle mission vous a été attribuée :

🧑‍🤝‍🧑 Client : ${prenomClient} ${nomClient}
📍 Adresse : ${adresse}
🛎️ Service : ${service}
📅 Date : ${date} à ${heure}

Merci de vous connecter à votre interface pour confirmer ou proposer une alternative :
👉 https://viiveo-presta.carrd.co//

Numéro de mission : ${idMission}

Cordialement,
L’équipe Viiveo`;

    MailApp.sendEmail(emailPresta, sujet, message);
    Logger.log(`📧 onFormSubmit: Notification envoyée au prestataire ${emailPresta} pour la mission ${idMission}.`);
  } else {
    Logger.log(`⚠️ onFormSubmit: Pas d'email prestataire défini pour la mission ${idMission}, notification non envoyée.`);
  }
  Logger.log("--- FIN onFormSubmit ---");
}

/**
 * Fonction de test pour simuler un appel à handleFormClient.
 * Simule les données envoyées par le formulaire frontend.
 */
function testHandleFormClient() {
  const e = {
    parameter: {
      prenom_prestataire: "Ray",
      nom_prestataire: "Mon",
      prenom: "Gaëtan", // Correction: utilise 'prenom' et 'nom' comme dans le formulaire HTML
      nom: "MUKEBA-HARCHIES",
      email: "gm.harchies@gmail.com", // Correction: utilise 'email' pour l'email client
      service: "Jardinage",
      date: "2025-07-30", // Date du jour pour le test
      heure: "10:00"
    }
  };

  Logger.log("--- DÉBUT testHandleFormClient ---");
  const result = handleFormClient(e);
  Logger.log("Résultat de handleFormClient :");
  Logger.log(result);
  Logger.log("--- FIN testHandleFormClient ---");
}

/**
 * Fonction de test pour la fonction onFormSubmit.
 * Simule un événement de soumission de formulaire.
 */
function testOnFormSubmit() {
  Logger.log("--- DÉBUT testOnFormSubmit ---");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetFormResponses = ss.getSheetByName('FormResponses');
  const sheetMissions = ss.getSheetByName('Missions');
  const sheetClients = ss.getSheetByName('IClients');

  if (!sheetFormResponses) {
    Logger.log("❌ ERREUR : La feuille 'FormResponses' est introuvable. Impossible de tester.");
    Browser.msgBox("Erreur", "La feuille 'FormResponses' est introuvable. Veuillez la créer ou vérifier son nom.", Browser.Buttons.OK);
    return;
  }
  if (!sheetMissions) {
    Logger.log("❌ ERREUR : La feuille 'Missions' est introuvable. Impossible de tester.");
    Browser.msgBox("Erreur", "La feuille 'Missions' est introuvable. Veuillez la créer ou vérifier son nom.", Browser.Buttons.OK);
    return;
  }
  if (!sheetClients) {
    Logger.log("❌ ERREUR : La feuille 'IClients' est introuvable. Impossible de tester.");
    Browser.msgBox("Erreur", "La feuille 'IClients' est introuvable. Veuillez la créer ou vérifier son nom.", Browser.Buttons.OK);
    return;
  }

  // Exemple de données pour la nouvelle ligne (doit correspondre aux colonnes de FormResponses)
  // ["Horodatage", "Prénom", "Nom", "Adresse", "E-mail", "Service", "Intervention", "Heure", "Tâche", "Prénom Pest.", "Nom Prestataire", "ID Demande"]
  const testRowData = [
    new Date(),
    "Gaëtan",             // Prénom (col B)
    "MUKEBA-HARCHIES",    // Nom (col C)
    "123 Rue de la Test, 75001 Paris", // Adresse (col D) - Assurez-vous que cette adresse correspond à celle dans IClients si vous voulez un test complet
    "gm.harchies@gmail.com", // Email client (col E)
    "Jardinage",          // Service (col F)
    new Date("2025-07-30"), // Date (col G) - Utilisez un objet Date si c'est le format par défaut de votre formulaire
    new Date().setHours(10, 0, 0, 0), // Heure (col H) - Utilisez un objet Date pour l'heure
    "Tonte et désherbage.", // Tâche (col I)
    "Ray",                // Prénom Pest. (col J)
    "Mon",                // Nom Prestataire (col K)
    ""                    // ID Demande (col L) - Sera rempli par le script
  ];

  // Ajoutez la ligne de test à la feuille "FormResponses"
  sheetFormResponses.appendRow(testRowData);
  const testRowNum = sheetFormResponses.getLastRow(); // Récupère le numéro de ligne de la ligne ajoutée

  Logger.log(`✅ Ligne de test ajoutée à 'FormResponses' à la ligne ${testRowNum}.`);

  // --- SIMULATION DE L'OBJET 'e' ---
  const simulatedEvent = {
    source: ss,
    range: sheetFormResponses.getRange(testRowNum, 1) // La plage commence à la première colonne de la ligne ajoutée
  };

  Logger.log("ℹ️ Appel de onFormSubmit avec l'événement simulé...");

  try {
    onFormSubmit(simulatedEvent);
    Logger.log("✅ testOnFormSubmit terminé sans erreur détectée.");
    Browser.msgBox("Test Réussi", `La fonction onFormSubmit a été exécutée. Vérifiez les feuilles 'FormResponses' (ligne ${testRowNum}) et 'Missions'.`, Browser.Buttons.OK);
  } catch (error) {
    Logger.log("❌ ERREUR lors de l'exécution de onFormSubmit: " + error.message + " Stack: " + error.stack);
    Browser.msgBox("Test Échoué", "Une erreur est survenue lors de l'exécution de onFormSubmit: " + error.message + ". Vérifiez les logs.", Browser.Buttons.OK);
  }

  // Optionnel: Nettoyage de la ligne de test si vous le souhaitez (décommentez pour l'activer)
  // sheetFormResponses.deleteRow(testRowNum);
  // Logger.log(`Ligne de test ${testRowNum} supprimée de 'FormResponses'.`);
  Logger.log("--- FIN testOnFormSubmit ---");
}

/**
 * Génère un ID de mission unique basé sur le dernier ID de la feuille Missions.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheetMissions La feuille "Missions".
 * @returns {string} Le nouvel ID de mission.
 */
function generateMissionId(sheetMissions) {
  const lastRow = sheetMissions.getLastRow();
  if (lastRow < 2) { // Si seulement l'en-tête ou vide
    Logger.log("generateMissionId: Première mission générée : M0001");
    return "M0001"; // première mission
  } else {
    const lastId = sheetMissions.getRange(lastRow, 1).getValue(); // colonne A = ID mission
    Logger.log(`generateMissionId: Dernier ID mission lu : ${lastId}`);

    const num = parseInt(String(lastId).replace(/\D/g, "")); // Convertir en chaîne avant replace
    if (isNaN(num)) {
      Logger.log(`generateMissionId: Erreur : dernier ID mission '${lastId}' non conforme. Retour à M0001.`);
      return "M0001"; // fallback
    }
    const newId = "M" + (num + 1).toString().padStart(4, "0");
    Logger.log(`generateMissionId: Nouvel ID mission généré : ${newId}`);
    return newId;
  }
}

/**
 * Fonction utilitaire pour récupérer l'email d'un prestataire par son prénom et nom.
 * @param {string} prenom Le prénom du prestataire.
 * @param {string} nom Le nom du prestataire.
 * @returns {string|null} L'email du prestataire ou null si non trouvé/non validé.
 */
function getPrestataireEmailByName(prenom, nom) {
  const ss = SpreadsheetApp.openById("1KMdm740bc24Dx4puD71n5KTFrPqYVNl_f3T12hjYlKQ");
  const sheet = ss.getSheetByName("IPrestataires");
  if (!sheet) {
    Logger.log("❌ getPrestataireEmailByName: Feuille 'IPrestataires' introuvable.");
    return null;
  }
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim().toLowerCase());

  const colIdxPrenom = headers.indexOf("prénom");
  const colIdxNom = headers.indexOf("nom");
  const colIdxEmail = headers.indexOf("e-mail");
  const colIdxValide = headers.indexOf("validé ?"); // Assurez-vous que c'est le bon en-tête pour la validation

  if (colIdxPrenom === -1 || colIdxNom === -1 || colIdxEmail === -1 || colIdxValide === -1) {
    Logger.log("❌ getPrestataireEmailByName: Colonnes essentielles manquantes dans 'IPrestataires'.");
    return null;
  }

  const normalizedPrenom = prenom.toLowerCase().trim();
  const normalizedNom = nom.toLowerCase().trim();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const p = row[colIdxPrenom]?.toString().trim().toLowerCase();
    const n = row[colIdxNom]?.toString().trim().toLowerCase();
    const email = row[colIdxEmail]?.toString().trim();
    const valide = row[colIdxValide]?.toString().trim().toLowerCase();

    if (p === normalizedPrenom && n === normalizedNom && valide === "oui") {
      Logger.log(`✅ getPrestataireEmailByName: Prestataire trouvé : ${email}`);
      return email;
    }
  }
  Logger.log(`⚠️ getPrestataireEmailByName: Aucun prestataire trouvé pour ${prenom} ${nom} ou non validé.`);
  return null;
}

// Assurez-vous que cette fonction est définie si elle est utilisée ailleurs (par exemple dans API.gs)
function getPrestataireNameByEmail(email) {
  const ss = SpreadsheetApp.openById("1KMdm740bc24Dx4puD71n5KTFrPqYVNl_f3T12hjYlKQ");
  const sheet = ss.getSheetByName("IPrestataires");
  if (!sheet) {
    Logger.log("❌ getPrestataireNameByEmail: Feuille 'IPrestataires' introuvable.");
    return { prenom: "Inconnu", nom: "Inconnu" };
  }
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim().toLowerCase());

  const colIdxPrenom = headers.indexOf("prénom");
  const colIdxNom = headers.indexOf("nom");
  const colIdxEmail = headers.indexOf("e-mail");

  if (colIdxPrenom === -1 || colIdxNom === -1 || colIdxEmail === -1) {
    Logger.log("❌ getPrestataireNameByEmail: Colonnes essentielles manquantes dans 'IPrestataires'.");
    return { prenom: "Inconnu", nom: "Inconnu" };
  }

  const normalizedEmail = email.toLowerCase().trim();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const e = row[colIdxEmail]?.toString().trim().toLowerCase();
    if (e === normalizedEmail) {
      return { prenom: row[colIdxPrenom]?.toString().trim(), nom: row[colIdxNom]?.toString().trim() };
    }
  }
  return { prenom: "Inconnu", nom: "Inconnu" };
}


DropPrestataires
// La fonction de création de réponse simplifiée
function createPostCorsResponse(data) {
    return ContentService
        .createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}

// Votre fonction doPost corrigée
function doPost(e) {
    // ... (tout le début de la fonction reste le même)
    Logger.log("--- DÉBUT doPost (API.gs) ---");
    Logger.log("Objet 'e' reçu: " + JSON.stringify(e)); 
    
    let result;
    let typeFromPost = "";

    try {
        if (e && e.parameter) {
          typeFromPost = e.parameter.type || "";
        } else {
          Logger.log("❌ ERREUR: L'objet e.parameter est manquant. Le corps de la requête POST n'a pas été parsé.");
          result = { success: false, message: "Erreur de parsing de la requête. Paramètres non trouvés." };
          if (e && e.postData && e.postData.contents) {
             Logger.log("Contenu brut du POST: " + e.postData.contents.slice(0, 500) + "...");
          }
          return createPostCorsResponse(result); // Utilisation de la fonction corrigée
        }

        Logger.log("Type de requête détecté: " + typeFromPost);
        
        if (typeFromPost === "formClient") {
          result = handleFormClient(e); 
        } else if (typeFromPost === "envoyerFiche") {
          result = handleFicheObservation(e);
        } else if (typeFromPost === "ajoutCredits") {
          result = handleAjoutCredits(e);
        } else {
          result = {
            success: false,
            message: "Type de requête non reconnu",
            params: e.parameter
          };
        }

        return createPostCorsResponse(result); // Utilisation de la fonction corrigée
    } catch (err) {
        Logger.log("❌ ERREUR CATCH dans doPost: " + err.message + " Stack: " + err.stack);
        result = {
          success: false,
          message: err.message
        };
        return createPostCorsResponse(result); // Utilisation de la fonction corrigée
    }
}

function normalizeText(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
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

function nettoyerSpecialites() {
  const sheet = SpreadsheetApp.getActive().getSheetByName('IPrestataires');
  const data = sheet.getRange(2, 6, sheet.getLastRow() - 1).getValues(); // Colonne F

  for (let i = 0; i < data.length; i++) {
    const cleaned = (data[i][0] || "").trim().replace(/\s+/g, " ");
    sheet.getRange(i + 2, 6).setValue(cleaned); // Écrase la valeur nettoyée
  }

  Logger.log("Spécialités nettoyées.");
}

PassWordIclient
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
              <p><a href="https://viiveo-cl.carrd.co?email=${encodeURIComponent(email)}">Accéder à mon espace client</a></p>
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

// Exemple d'URL vers ton script Google Apps Script (avec paramètres)
const urlGAS = "https://script.google.com/macros/s/AKfycbzEEZZnZJK1BEXlCk81ogi0Aa7MFGunOkjS5s2CCDIZPSkHq0OtPAcEBLrkXp-fpb8aaQ/exec?type=verifqr&idclient=cli-gamu56798&email=gm.harchies@gmail.com&callback=maFonction";

// Génère l'URL image QR
const qrCodeUrl = generateQRCodeImage(urlGAS);

console.log(qrCodeUrl);


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



ExpoDonnéesClient
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



LoginPasswordPrestataire
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


NotificationPrestataire
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

  const users = data.slice(1); // Ignorer la ligne d'en-tête si elle existe

  const match = users.find(row =>
    (row[4] || "").toLowerCase() === email && row[10] === password
  );

  if (match) {
    const userEmail = match[4];  // Colonne de l'email
    const userPrenom = match[0]; // Colonne du prénom (ajustez l'index si nécessaire)
    const userNom = match[1];    // Colonne du nom (ajustez l'index si nécessaire)

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      email: userEmail,
      prenom: userPrenom, // Inclure le prénom
      nom: userNom        // Inclure le nom
    })).setMimeType(ContentService.MimeType.JSON);
  } else {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Identifiants invalides" }));
  }
}

function handleGetPrestataires(e) {
  const ss = SpreadsheetApp.openById('1KMdm740bc24Dx4puD71n5KTFrPqYVNl_f3T12hjYlKQ');
  const sheet = ss.getSheetByName('IPrestataires');
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).getValues();

  const specialiteDemandeeRaw = e.parameter.specialite || "";
  const specialiteDemandee = specialiteDemandeeRaw.trim().toLowerCase().replace(/\s+/g, " ");

  const type = (e.parameter.type || "").toLowerCase();

  Logger.log(`📌 Spécialité demandée (raw): "${specialiteDemandeeRaw}" → filtrée: "${specialiteDemandee}"`);
  Logger.log(`📊 Nombre total de lignes dans IPrestataires: ${values.length}`);

  const filtres = values.filter(row => {
    // Validation : colonne 12 (index 11)
    const validationCell = (row[11] || "").toString().trim().toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, "");
    const estValide = validationCell === "oui";

    // Spécialité : colonne 6 (index 5)
    const specialiteCell = (row[5] || "").toString().trim().toLowerCase().replace(/\s+/g, " ");

    // Si une spécialité est demandée, elle doit correspondre (exactement mais avec normalisation)
    const matchSpecialite = specialiteDemandee
      ? specialiteCell === specialiteDemandee
      : true;

    return estValide && matchSpecialite;
  });

  Logger.log(`✅ Prestataires valides filtrés : ${filtres.length}`);

  // Format selon le type demandé
  const result = {
    success: true,
    prestataires: filtres.map(r => {
      if (type === "dropdown") {
        return {
          nomComplet: `${r[0]} ${r[1]}`.trim(),
          email: r[4],
          specialite: (r[5] || "").toString().replace(/\s+/g, " ").trim()
        };
      } else {
        return {
          prenom: r[0],
          nom: r[1],
          adresse: r[2],
          telephone: r[3],
          email: r[4],
          specialite: r[5],
          disponibilite: r[6],
          photo: r[7] || "https://via.placeholder.com/300x200?text=Photo",
          commentaire: r[8] || ""
        };
      }
    })
  };

  return result;
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

/**
 * Récupère les missions pour un prestataire donné depuis les feuilles "Missions" et "FormResponses".
 * Formate les données pour l'affichage frontend.
 * @param {Object} e L'événement de requête, contenant l'email du prestataire.
 * @returns {GoogleAppsScript.Content.TextOutput} Une réponse JSONP contenant les missions.
 */
function getMissionsForPresta(e) {
  const email = (e.parameter.email || "").toLowerCase();
  Logger.log("🔍 Email reçu dans getMissionsForPresta : " + email);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetMissions = ss.getSheetByName('Missions');
  const sheetForms = ss.getSheetByName('FormResponses');

  if (!sheetMissions || !sheetForms) {
    Logger.log("❌ Une ou plusieurs feuilles sont introuvables dans getMissionsForPresta.");
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Feuille(s) manquante(s)" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const missionsData = sheetMissions.getDataRange().getValues();
  const formsData = sheetForms.getDataRange().getValues();
  const formsHeaders = formsData[0]; // Récupère les en-têtes de FormResponses

  Logger.log("📋 Lignes lues dans Missions : " + missionsData.length);
  Logger.log("� Lignes lues dans FormResponses : " + formsData.length);

  // Nettoyer les en-têtes de la feuille Missions en supprimant les espaces superflus
  const missionsHeaders = missionsData[0].map(header => String(header).trim());
  const formsHeadersTrimmed = formsData[0].map(header => String(header).trim()); // Nettoyer aussi les en-têtes de FormResponses

  // Trouver les indices de colonnes pour Missions (avec les noms exacts)
  const colIndexEmailPrestataire = missionsHeaders.indexOf("Email Prestataire");
  const colIndexStatut = missionsHeaders.indexOf("Statut");
  const colIndexIdMission = missionsHeaders.indexOf("ID");
  const colIndexIdDemande = missionsHeaders.indexOf("ID Demande");
  const colIndexAdresse = missionsHeaders.indexOf("Adresse");
  const colIndexService = missionsHeaders.indexOf("Service");
  const colIndexDate = missionsHeaders.indexOf("Date");
  const colIndexHeure = missionsHeaders.indexOf("Heure"); // Colonne de l'heure planifiée
  const colIndexIdClientQR = missionsHeaders.indexOf("id client");
  // NOUVEAU: Index pour le nom complet du client dans la feuille Missions (Colonne G), en utilisant l'en-tête "Client"
  const colIndexClient = missionsHeaders.indexOf("Client"); // Utilise l'en-tête "Client"

  // Vérification des colonnes essentielles dans "Missions" pour getMissionsForPresta
  const requiredMissionCols = {
    "Email Prestataire": colIndexEmailPrestataire,
    "Statut": colIndexStatut,
    "ID": colIndexIdMission,
    "ID Demande": colIndexIdDemande,
    "Adresse": colIndexAdresse,
    "Service": colIndexService,
    "Date": colIndexDate,
    "Heure": colIndexHeure,
    "id client": colIndexIdClientQR,
    "Client": colIndexClient // NOUVEAU: Ajouter la vérification pour la colonne "Client"
  };

  for (const colName in requiredMissionCols) {
    if (requiredMissionCols[colName] === -1) {
      Logger.log(`❌ ERREUR : Colonne '${colName}' introuvable dans la feuille 'Missions' pour getMissionsForPresta.`);
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: `Colonne '${colName}' manquante dans la feuille Missions. Veuillez l'ajouter et redéployer.` }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  const filteredMissions = missionsData.slice(1).filter(row => {
    const prestEmail = (row[colIndexEmailPrestataire] || "").toLowerCase();
    const statut = (row[colIndexStatut] || "").toLowerCase();
    return prestEmail === email &&
      ["en attente", "confirmée", "validée", "terminée", "en cours"].includes(statut);
  });

  Logger.log("✅ Missions trouvées pour ce prestataire : " + filteredMissions.length);

  const missions = filteredMissions.map(row => {
    // --- Traitement de la date : Force le format YYYY-MM-DD ---
    const rawDate = row[colIndexDate];
    let formattedDate = "";
    if (rawDate instanceof Date) {
      formattedDate = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "yyyy-MM-dd"); // Force YYYY-MM-DD
    } else if (typeof rawDate === "string") {
      // Tente de convertir DD/MM/YYYY en YYYY-MM-DD si c'est le cas
      const parts = rawDate.split('/');
      if (parts.length === 3) {
        formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      } else {
        formattedDate = rawDate.trim(); // Garde la chaîne telle quelle si format non reconnu
      }
    } else if (typeof rawDate === "number") { // Gère les dates en format numérique Excel
      formattedDate = Utilities.formatDate(new Date(Math.round((rawDate - 25569) * 86400 * 1000)), Session.getScriptTimeZone(), "yyyy-MM-dd");
    } else {
      formattedDate = String(rawDate || "").trim();
    }
    Logger.log(`DEBUG: Mission ID ${row[colIndexIdMission]} - Date brute: '${rawDate}' (Type: ${typeof rawDate}) -> Formatée: '${formattedDate}'`);


    // --- Traitement de l'heure : Force le format HH:mm:ss ---
    const rawHeure = row[colIndexHeure];
    let formattedHeure = "";
    Logger.log(`DEBUG: Mission ID ${row[colIndexIdMission]} - Heure brute (rawHeure): '${rawHeure}' (Type: ${typeof rawHeure})`);

    if (rawHeure instanceof Date) {
      formattedHeure = Utilities.formatDate(rawHeure, Session.getScriptTimeZone(), "HH:mm:ss"); // Force HH:mm:ss
      Logger.log(`DEBUG: Heure formatée (Date instance): ${formattedHeure}`);
    } else if (typeof rawHeure === 'number') {
      // Les heures peuvent être des nombres représentant une fraction de jour (ex: 0.375 pour 09:00)
      const dateObj = new Date(1899, 11, 30, 0, 0, 0); // Date de référence pour les nombres d'heure Sheets
      dateObj.setTime(dateObj.getTime() + rawHeure * 24 * 60 * 60 * 1000);
      formattedHeure = Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "HH:mm:ss");
      Logger.log(`DEBUG: Heure formatée (Number): ${formattedHeure}`);
    } else if (typeof rawHeure === 'string') {
        formattedHeure = rawHeure.trim();
        // Si l'heure est au format "H:mm" ou "HH:mm", ajoute ":00" pour HH:mm:ss
        if (formattedHeure.match(/^\d{1,2}:\d{2}$/)) {
            formattedHeure += ":00";
        }
        Logger.log(`DEBUG: Heure formatée (String): ${formattedHeure}`);
    } else {
      formattedHeure = String(rawHeure || "").trim();
      Logger.log(`DEBUG: Heure formatée (Other type): ${formattedHeure}`);
    }

    const idDemandeMission = String(row[colIndexIdDemande]).trim(); // Col B de la feuille Missions (ID Demande)
    let clientPrenom = "";
    let clientNom = "";

    // Recherche des infos client dans FormResponses
    const colIndexFormIdDemande = formsHeadersTrimmed.indexOf("ID Demande");
    const colIndexFormPrenom = formsHeadersTrimmed.indexOf("Prénom");
    const colIndexFormNom = formsHeadersTrimmed.indexOf("Nom");
    const colIndexFormEmail = formsHeadersTrimmed.indexOf("E-mail"); // Utilisez 'E-mail' ici

    if (colIndexFormIdDemande === -1 || colIndexFormPrenom === -1 || colIndexFormNom === -1 || colIndexFormEmail === -1) {
        Logger.log("❌ ERREUR : Une ou plusieurs colonnes essentielles sont introuvables dans la feuille 'FormResponses' pour la recherche client.");
        // Gérer l'erreur ou fournir des valeurs par défaut
    } else {
        for (let j = 1; j < formsData.length; j++) {
            const idDemandeForm = String(formsData[j][colIndexFormIdDemande] || "").trim();
            if (idDemandeForm === idDemandeMission) {
                clientPrenom = formsData[j][colIndexFormPrenom];
                clientNom = formsData[j][colIndexFormNom];
                break;
            }
        }
    }

    return {
      id: row[colIndexIdMission],
      // Utilise l'index trouvé pour la colonne "Client"
      client: row[colIndexClient] || "Client inconnu",
      clientPrenom: clientPrenom,
      clientNom: clientNom,
      adresse: row[colIndexAdresse],
      service: row[colIndexService],
      date: formattedDate, // Date au format YYYY-MM-DD
      heure: formattedHeure, // Heure au format HH:mm:ss
      statut: row[colIndexStatut] || "",
      idClientQR: row[colIndexIdClientQR] || "" // Col M (index 12) pour ID Client QR
    };
  });

  if (missions.length > 0) {
    Logger.log("🧾 Exemple mission après enrichissement : " + JSON.stringify(missions[0]));
  } else {
    Logger.log("🧾 Aucune mission à afficher.");
  }

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    missions: missions
  })).setMimeType(ContentService.MimeType.JSON);
}

function validerMission(e) {
  try {
    const id = e.parameter.missionId; 
    Logger.log("ID de mission reçu: " + id);

    const ss = SpreadsheetApp.getActive();
    const sheetMissions = ss.getSheetByName('Missions');
    const sheetForm = ss.getSheetByName('FormResponses');
    const sheetIClient = ss.getSheetByName('IClients');

    if (!sheetMissions || !sheetForm || !sheetIClient) {
      Logger.log("Erreur: Une ou plusieurs feuilles de calcul sont introuvables.");
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Feuille de calcul introuvable" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const missionsData = sheetMissions.getDataRange().getValues();
    const formData = sheetForm.getDataRange().getValues();
    const formsHeaders = formData[0];
    Logger.log("En-têtes de la feuille FormResponses: " + formsHeaders.join(', '));

    const iClientData = sheetIClient.getDataRange().getValues();
    const iClientHeaders = iClientData[0];
    Logger.log("En-têtes de la feuille IClients: " + iClientHeaders.join(', '));

    let idDemande = null;
    let missionRowIndex = -1;

    for (let i = 1; i < missionsData.length; i++) {
      if (missionsData[i][0] === id) {
        idDemande = missionsData[i][1];
        missionRowIndex = i + 1;
        Logger.log("Mission trouvée à la ligne " + missionRowIndex + ", ID Demande: " + idDemande);

        sheetMissions.getRange(missionRowIndex, 9).setValue('confirmée');
        sheetMissions.getRange(missionRowIndex, 10).setValue('✅');

        let emailClient = null;
        const formEmailIndex = formsHeaders.indexOf("E-mail");
        if (formEmailIndex === -1) {
            Logger.log("Erreur: En-tête 'E-mail' introuvable dans FormResponses.");
        } else {
            for (let j = 1; j < formData.length; j++) {
                const formId = formData[j][formsHeaders.indexOf("ID Demande")];
                if (formId === idDemande) {
                    emailClient = formData[j][formEmailIndex];
                    Logger.log("Email client trouvé: " + emailClient);
                    break;
                }
            }
        }
        
        if (emailClient) {
          const emailIndexIClient = iClientHeaders.indexOf("Email");
          const idClientIndex = 18; // Colonne S = 19ème colonne, index 18

          if (emailIndexIClient !== -1 && idClientIndex < iClientHeaders.length) {
            for (let k = 1; k < iClientData.length; k++) {
              if (iClientData[k][emailIndexIClient] === emailClient) {
                const idClient = iClientData[k][idClientIndex];
                if (idClient) {
                  Logger.log("ID client trouvé: " + idClient + ", mise à jour de la colonne 13 de Missions.");
                  sheetMissions.getRange(missionRowIndex, 13).setValue(idClient);
                } else {
                  Logger.log("Avertissement: La valeur de l'ID client à l'index " + idClientIndex + " est vide.");
                }
                break;
              }
            }
          } else {
            Logger.log("Erreur: En-tête 'Email' ou 'ID client' introuvable dans la feuille IClients.");
          }
        }

        break;
      }
    }

    if (!idDemande) {
      Logger.log("Erreur: ID mission introuvable. Fin de l'exécution.");
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "ID mission introuvable" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    for (let j = 1; j < formData.length; j++) {
      const formId = formData[j][formsHeaders.indexOf("ID Demande")];
      if (formId === idDemande) {
        const emailClient = formData[j][formsHeaders.indexOf("E-mail")];
        const nomClient = formData[j][formsHeaders.indexOf("Nom")];
        const service = formData[j][formsHeaders.indexOf("Service")];
        const date = formData[j][formsHeaders.indexOf("Date")];
        const heure = formData[j][formsHeaders.indexOf("Heure")];

        const sujet = "✅ Confirmation de votre mission Viiveo";
        const message = `
Bonjour ${nomClient},

Votre demande de service (${service}) prévue le ${date} à ${heure} a été confirmée par notre prestataire.

Merci pour votre confiance.
Vous pouvez suivre vos prestations depuis votre espace client Viiveo.

À bientôt,
L’équipe Viiveo`;

        if (emailClient) {
          Logger.log("Envoi de l'email de confirmation à " + emailClient);
          MailApp.sendEmail(emailClient, sujet, message);
        }
        break;
      }
    }

    Logger.log("Mission validée avec succès. Fin de l'exécution.");
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    Logger.log("--- ERREUR CRITIQUE ---");
    Logger.log("Nom de l'erreur: " + e.name);
    Logger.log("Message de l'erreur: " + e.message);
    Logger.log("Stack trace: " + e.stack);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: e.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
function testerValidationMission() {
  // --- CONFIGURATION DU TEST ---
  // Remplacez 'ID_DE_MISSION_A_TESTER' par un ID de mission existant de votre feuille 'Missions'.
  const idMissionTest = 'M0052'; 

  // --- DÉBUT DE LA FONCTION DE TEST ---
  try {
    const ss = SpreadsheetApp.getActive();
    const sheetMissions = ss.getSheetByName('Missions');
    const sheetForm = ss.getSheetByName('FormResponses');
    const sheetIClient = ss.getSheetByName('IClients');

    if (!sheetMissions || !sheetForm || !sheetIClient) {
      Logger.log("Erreur : Assurez-vous que les feuilles 'Missions', 'FormResponses' et 'IClients' existent.");
      return;
    }

    const missionsData = sheetMissions.getDataRange().getValues();
    const formData = sheetForm.getDataRange().getValues();
    const formsHeaders = formData[0];
    const iClientData = sheetIClient.getDataRange().getValues();
    const iClientHeaders = iClientData[0];

    Logger.log("--- Début du test de validation de mission pour l'ID: " + idMissionTest + " ---");

    let idDemande = null;
    let emailClient = null;
    let idClient = null;
    let idClientRowIndex = null;
    let idClientColumnIndex = null;
    
    let missionRowIndex = -1;

    // 1. Trouver la ligne de la mission dans la feuille 'Missions'
    for (let i = 1; i < missionsData.length; i++) {
      if (missionsData[i][0] === idMissionTest) {
        idDemande = missionsData[i][1]; // Colonne B = ID Demande
        missionRowIndex = i + 1;
        break;
      }
    }

    if (missionRowIndex === -1) {
      Logger.log("Échec : Mission avec l'ID " + idMissionTest + " introuvable dans la feuille 'Missions'. Vérifiez l'ID.");
      return;
    }
    
    Logger.log("Succès : Mission trouvée à la ligne " + missionRowIndex);
    Logger.log("ID Demande lié: " + idDemande);

    // 2. Trouver l'email du client dans la feuille 'FormResponses'
    for (let j = 1; j < formData.length; j++) {
      const formId = formData[j][formsHeaders.indexOf("ID Demande")];
      if (formId === idDemande) {
        emailClient = formData[j][formsHeaders.indexOf("E-mail")];
        break;
      }
    }

    if (!emailClient) {
      Logger.log("Échec : Email du client introuvable dans la feuille 'FormResponses' pour l'ID demande " + idDemande);
      return;
    }
    Logger.log("Succès : Email du client trouvé: " + emailClient);

    // 3. Trouver l'ID du client dans la feuille 'IClients'
    const emailIndexIClient = iClientHeaders.indexOf("Email");
    // L'index de la colonne pour l'ID du client est crucial.
    // D'après votre analyse, l'index 12 semble être le bon (13ème colonne).
    const idClientIndex = 12; // Modifié pour correspondre à la 13ème colonne (index 12)

    if (emailIndexIClient === -1) {
      Logger.log("Échec : La colonne 'Email' est introuvable dans la feuille 'IClients'. Vérifiez l'en-tête.");
      return;
    }

    for (let k = 1; k < iClientData.length; k++) {
      if (iClientData[k][emailIndexIClient] === emailClient) {
        idClient = iClientData[k][idClientIndex]; // Récupère l'ID client à l'index 12
        idClientRowIndex = k + 1;
        break;
      }
    }

    if (!idClient) {
      Logger.log("Échec : ID client introuvable dans la feuille 'IClients' pour l'email " + emailClient);
      return;
    }
    Logger.log("Succès : ID client trouvé: " + idClient + " à la ligne " + idClientRowIndex + " et colonne " + (idClientIndex + 1));
    
    // 4. Test de l'écriture dans la feuille Missions (simulation)
    // On va vérifier si la colonne cible dans Missions existe et si la valeur serait écrite correctement
    // La colonne M correspond à l'index 12.
    const missionTargetColumnIndex = 12; 

    Logger.log("--- Simulation de la mise à jour de la feuille 'Missions' ---");
    Logger.log("Action : Écriture de la valeur '" + idClient + "'");
    Logger.log("Dans la feuille : 'Missions'");
    Logger.log("À la ligne : " + missionRowIndex);
    Logger.log("À la colonne : " + (missionTargetColumnIndex + 1) + " (correspondant à l'index " + missionTargetColumnIndex + ")");

    // On pourrait même lire la valeur actuelle pour vérifier
    const currentValue = sheetMissions.getRange(missionRowIndex, missionTargetColumnIndex + 1).getValue();
    Logger.log("Valeur actuelle à cet emplacement : " + currentValue);
    
    if (missionTargetColumnIndex === 12) {
      Logger.log("Succès : L'index de colonne pour la mise à jour est bien la colonne M. Le code d'origine devrait fonctionner si vous remplacez `18` par `12`.");
    } else {
       Logger.log("Avertissement : L'index de colonne pour la mise à jour n'est pas 12. Vous devrez ajuster le code en conséquence.");
    }
    
    Logger.log("--- Fin du test. Si vous voyez 'Succès' partout, votre logique est bonne. ---");

  } catch (e) {
    Logger.log("Une erreur inattendue est survenue lors du test : " + e.toString());
  }
}

function refuserMission(e) {
  const id = e.parameter.id;
  const alternatives = e.parameter.alternatives;
  const sheet = SpreadsheetApp.getActive().getSheetByName('Missions');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.getRange(i + 1, 9).setValue('refusée');     // Statut (Col I)
      sheet.getRange(i + 1, 10).setValue('❌');           // Réponse prestataire (Col J)
      sheet.getRange(i + 1, 11).setValue(alternatives);  // Dates alternatives (Col K)
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

// Version améliorée de getPrestataireEmailByName pour plus de robustesse
function getPrestataireEmailByName(prenom, nom) {
  const ss = SpreadsheetApp.openById("1KMdm740bc24Dx4puD71n5KTFrPqYVNl_f3T12hjYlKQ");
  const sheet = ss.getSheetByName("IPrestataires");
  if (!sheet) {
    return null;
  }
  
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim()); // Récupère les en-têtes
  
  const prenomCol = headers.indexOf("Prénom");
  const nomCol = headers.indexOf("Nom");
  const emailCol = headers.indexOf("Email");
  const validationCol = headers.indexOf("Validation");

  // Vérifie que toutes les colonnes nécessaires existent
  if (prenomCol === -1 || nomCol === -1 || emailCol === -1 || validationCol === -1) {
      return null;
  }

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const prenomCell = row[prenomCol]?.toString().trim().toLowerCase();
    const nomCell = row[nomCol]?.toString().trim().toLowerCase();
    const emailCell = row[emailCol]?.toString().trim();
    const estValide = row[validationCol]?.toString().trim().toLowerCase();

    if (
      prenomCell === prenom.trim().toLowerCase() &&
      nomCell === nom.trim().toLowerCase() &&
      estValide === "oui"
    ) {
      return emailCell;
    }
  }

  return null;
}

function validerPrestationClient(e) {
  const id = e.parameter.id;
  const sheet = SpreadsheetApp.getActive().getSheetByName("Missions");
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.getRange(i + 1, 12).setValue("validée"); // Colonne L (index 11) pour "Validation Client"

      const emailPresta = data[i][2];
      const clientNom = data[i][6];
      const clientAdresse = data[i][7];
      const service = data[i][5];
      const dateRaw = data[i][3];
      const heure = data[i][4];

      let dateFormatted = "";
      if (dateRaw instanceof Date) {
        dateFormatted = Utilities.formatDate(dateRaw, Session.getScriptTimeZone(), "dd/MM/yyyy");
      } else {
        dateFormatted = dateRaw.toString();
      }

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
    .filter(row => row[11]?.toString().toLowerCase() === "oui") // Colonne L (index 11) = "oui"
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
  const idClientQR = (e.parameter.idclient || e.parameter.clientId || "").trim();
  const emailPrestataire = (e.parameter.email || "").trim().toLowerCase();
  const lat = e.parameter.latitude;
  const lon = e.parameter.longitude;
  const callback = e.parameter.callback;
  const today = Utilities.formatDate(new Date(), "Europe/Brussels", "yyyy-MM-dd");

  Logger.log(`--- DÉBUT verifierQRClient ---`);
  Logger.log(`Params reçus par l'URL : idClientQR='${idClientQR}', emailPrestataire='${emailPrestataire}', lat='${lat}', lon='${lon}'`);
  Logger.log(`Date d'aujourd'hui (format YYYY-MM-DD) : ${today}`);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const missionsSheet = ss.getSheetByName("Missions");
  const formsSheet = ss.getSheetByName("FormResponses");

  if (!missionsSheet || !formsSheet) {
    Logger.log("❌ ERREUR : Feuilles 'Missions' ou 'FormResponses' manquantes.");
    return buildJsonResponse(callback, {
      success: false,
      message: "Feuilles manquantes."
    });
  }

  const missionsData = missionsSheet.getDataRange().getValues();
  // Nettoyer les en-têtes de la feuille Missions en supprimant les espaces superflus
  const missionsHeaders = missionsData[0].map(header => String(header).trim()); 
  const formsData = formsSheet.getDataRange().getValues();
  const formsHeaders = formsData[0].map(header => String(header).trim()); // Nettoyer aussi les en-têtes de FormResponses

  Logger.log(`En-têtes Missions (nettoyés) : ${JSON.stringify(missionsHeaders)}`);
  Logger.log(`En-têtes FormResponses (nettoyés) : ${JSON.stringify(formsHeaders)}`);

  Logger.log(`ℹ️ Nombre de lignes dans Missions (hors en-tête) : ${missionsData.length - 1}`);
  Logger.log(`ℹ️ Nombre de lignes dans FormResponses (hors en-tête) : ${formsData.length - 1}`);

  // Recherche des indices de colonnes pour Missions (plus robuste avec les noms exacts)
  // Les noms recherchés ici ne doivent PAS avoir d'espaces superflus, car nous avons déjà trimé les en-têtes de la feuille.
  const colIndexMissionId = missionsHeaders.indexOf("ID");
  const colIndexIdDemande = missionsHeaders.indexOf("ID Demande");
  const colIndexEmailPrestataire = missionsHeaders.indexOf("Email Prestataire");
  const colIndexDate = missionsHeaders.indexOf("Date");
  const colIndexIdClientQR = missionsHeaders.indexOf("id client"); // Recherche maintenant "id client" sans espace final
  const colIndexStatut = missionsHeaders.indexOf("Statut");
  const colIndexHeureDebutReelle = missionsHeaders.indexOf("Heure Début Réelle");
  const colIndexLatitudeDebut = missionsHeaders.indexOf("Latitude Début");
  const colIndexLongitudeDebut = missionsHeaders.indexOf("Longitude Début");

  // Vérification des colonnes essentielles dans "Missions"
  const requiredMissionCols = {
    "ID": colIndexMissionId,
    "ID Demande": colIndexIdDemande,
    "Email Prestataire": colIndexEmailPrestataire,
    "Date": colIndexDate,
    "id client": colIndexIdClientQR, // Vérification sur "id client" sans espace final
    "Statut": colIndexStatut,
    "Heure Début Réelle": colIndexHeureDebutReelle,
    "Latitude Début": colIndexLatitudeDebut,
    "Longitude Début": colIndexLongitudeDebut
  };

  for (const colName in requiredMissionCols) {
    if (requiredMissionCols[colName] === -1) {
      Logger.log(`❌ ERREUR : Colonne '${colName}' introuvable dans la feuille 'Missions'.`);
      return buildJsonResponse(callback, { success: false, message: `Colonne '${colName}' manquante dans la feuille Missions. Veuillez l'ajouter et redéployer.` });
    }
  }

  let foundMissionRow = null;
  let foundMissionRowIndex = -1;

  for (let i = 1; i < missionsData.length; i++) {
    const row = missionsData[i];
    const missionId = String(row[colIndexMissionId] || "").trim();
    const missionIdDemande = String(row[colIndexIdDemande] || "").trim();
    const missionEmail = (row[colIndexEmailPrestataire] || "").toLowerCase();
    const rawDate = row[colIndexDate];
    const missionIdClientInSheet = String(row[colIndexIdClientQR] || "").trim();
    const statut = (row[colIndexStatut] || "").toLowerCase();

    let dateMission;
    if (rawDate instanceof Date) {
      dateMission = rawDate;
    } else if (typeof rawDate === "string" && rawDate.includes("/")) {
      const [day, month, year] = rawDate.split("/");
      dateMission = new Date(`${year}-${month}-${day}`);
    } else if (typeof rawDate === "number") { // Gère les dates en format numérique Excel
      dateMission = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
    } else {
      Logger.log(`⚠️ Ligne ${i + 1} : Date '${rawDate}' non reconnue ou format inattendu. Skipping.`);
      continue;
    }

    const formattedMissionDate = Utilities.formatDate(dateMission, "Europe/Brussels", "yyyy-MM-dd");

    Logger.log(`--- Analyse Ligne Missions ${i + 1} ---`);
    Logger.log(`  Mission ID: ${missionId}`);
    Logger.log(`  ID Demande (Mission): ${missionIdDemande}`);
    Logger.log(`  Email Presta (Mission): '${missionEmail}' (Comparé à '${emailPrestataire}')`);
    Logger.log(`  ID Client QR (Mission): '${missionIdClientInSheet}' (Comparé à '${idClientQR}')`);
    Logger.log(`  Statut (Mission): '${statut}'`);
    Logger.log(`  Date Mission (formatée): '${formattedMissionDate}' (Comparé à '${today}')`);

    if (
      missionIdClientInSheet === idClientQR &&
      missionEmail === emailPrestataire &&
      formattedMissionDate === today &&
      ["confirmée", "en cours", "terminée"].includes(statut) // Vérifie les statuts valides
    ) {
      foundMissionRow = row;
      foundMissionRowIndex = i;
      Logger.log(`✅ Correspondance trouvée pour la mission à la ligne ${i + 1}. Statut: '${statut}'`);
      break;
    } else {
      Logger.log(`❌ Pas de correspondance pour la mission à la ligne ${i + 1}.`);
      Logger.log(`  Détails de la non-correspondance:`);
      Logger.log(`    idClientQR match: ${missionIdClientInSheet === idClientQR}`);
      Logger.log(`    emailPrestataire match: ${missionEmail === emailPrestataire}`);
      Logger.log(`    date match: ${formattedMissionDate === today}`);
      Logger.log(`    statut valide: ${["confirmée", "en cours", "terminée"].includes(statut)}`);
    }
  }

  if (foundMissionRowIndex === -1) {
    Logger.log("❌ FINAL : Aucune mission active trouvée aujourd’hui pour ce client et prestataire.");
    return buildJsonResponse(callback, {
      success: false,
      message: "❌ Aucune mission active trouvée pour ce QR et prestataire aujourd'hui."
    });
  }

  const missionStatut = (foundMissionRow[colIndexStatut] || "").toLowerCase();
  const missionId = String(foundMissionRow[colIndexMissionId]).trim();
  const idDemande = String(foundMissionRow[colIndexIdDemande]).trim();

  // Recherche des informations du client dans FormResponses
  const colIndexFormIdDemande = formsHeaders.indexOf("ID Demande");
  const colIndexFormPrenom = formsHeaders.indexOf("Prénom");
  const colIndexFormNom = formsHeaders.indexOf("Nom");
  const colIndexFormEmail = formsHeaders.indexOf("E-mail");

  if (colIndexFormIdDemande === -1 || colIndexFormPrenom === -1 || colIndexFormNom === -1 || colIndexFormEmail === -1) {
    Logger.log("❌ ERREUR : Une ou plusieurs colonnes essentielles sont introuvables dans la feuille 'FormResponses'.");
    Logger.log(`Indices trouvés: ID Demande=${colIndexFormIdDemande}, Prénom=${colIndexFormPrenom}, Nom=${colIndexFormNom}, Email=${colIndexFormEmail}`);
    return buildJsonResponse(callback, { success: false, message: "Colonnes manquantes dans la feuille FormResponses. Vérifiez les en-têtes." });
  }

  let clientPrenom = "";
  let clientNom = "";
  let clientEmail = "";
  let clientFoundInForms = false;

  for (let j = 1; j < formsData.length; j++) {
    const formRow = formsData[j];
    const formIdDemande = String(formRow[colIndexFormIdDemande] || "").trim();
    
    Logger.log(`--- Analyse Ligne FormResponses ${j + 1} ---`);
    Logger.log(`  ID Demande (FormResponses): '${formIdDemande}'`);
    Logger.log(`  Comparaison avec ID Demande Mission: '${idDemande}'`);

    if (formIdDemande === idDemande) {
      clientPrenom = formRow[colIndexFormPrenom];
      clientNom = formRow[colIndexFormNom];
      clientEmail = formRow[colIndexFormEmail];
      clientFoundInForms = true;
      Logger.log(`✅ Client trouvé dans FormResponses à la ligne ${j + 1}. Client: ${clientPrenom} ${clientNom}`);
      break;
    } else {
      Logger.log(`❌ Pas de correspondance pour le client à la ligne ${j + 1}.`);
    }
  }

  if (!clientFoundInForms) {
    Logger.log(`❌ FINAL : Client non trouvé dans FormResponses pour ID Demande: ${idDemande}`);
    return buildJsonResponse(callback, {
      success: false,
      message: "Erreur: Informations client introuvables dans FormResponses."
    });
  }

  let responseMessage = "";
  let missionStatusForFrontend = "";
  let heureDebutReelle = null;

  if (missionStatut === "confirmée") {
    // Premier scan : Démarrage de la mission
    missionsSheet.getRange(foundMissionRowIndex + 1, colIndexStatut + 1).setValue("en cours");
    missionsSheet.getRange(foundMissionRowIndex + 1, colIndexHeureDebutReelle + 1).setValue(new Date());
    missionsSheet.getRange(foundMissionRowIndex + 1, colIndexLatitudeDebut + 1).setValue(lat);
    missionsSheet.getRange(foundMissionRowIndex + 1, colIndexLongitudeDebut + 1).setValue(lon);

    responseMessage = "✅ Mission démarrée avec succès !";
    missionStatusForFrontend = "started";
    heureDebutReelle = new Date().toISOString();
    Logger.log(`✅ Mission ${missionId} passée à 'en cours'. Heure début: ${heureDebutReelle}, Lat: ${lat}, Lon: ${lon}`);

  } else if (missionStatut === "en cours") {
    // Deuxième scan : Prêt pour la fin de mission (ouvrir le formulaire)
    heureDebutReelle = foundMissionRow[colIndexHeureDebutReelle];
    responseMessage = "ℹ️ Mission en cours. Prêt pour la fin et la fiche d'observation.";
    missionStatusForFrontend = "readyForEnd";
    Logger.log(`ℹ️ Mission ${missionId} est 'en cours'. Prêt pour la fin. Heure début réelle: ${heureDebutReelle}`);

  } else if (missionStatut === "terminée") {
    responseMessage = "⚠️ Cette mission est déjà terminée aujourd’hui.";
    missionStatusForFrontend = "completed";
    Logger.log(`⚠️ Mission ${missionId} est déjà 'terminée'.`);
  } else {
    responseMessage = "Statut de mission inattendu.";
    missionStatusForFrontend = "error";
    Logger.log(`❌ Statut inattendu pour mission ${missionId}: ${missionStatut}`);
  }

  Logger.log(`--- FIN verifierQRClient ---`);
  return buildJsonResponse(callback, {
    success: true,
    message: responseMessage,
    missionStatus: missionStatusForFrontend,
    mission: {
      id: missionId,
      heureDebutReelle: (heureDebutReelle instanceof Date) ? heureDebutReelle.toISOString() : heureDebutReelle,
      latitude: lat,
      longitude: lon
    },
    client: {
      nom: clientNom,
      prenom: clientPrenom,
      email: clientEmail
    }
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

/**
 * Fonction de test pour simuler un appel à verifierQRClient.
 * Permet de tester la logique de la fonction sans interaction frontend directe.
 * Assurez-vous de remplacer les valeurs des paramètres par des données réelles de vos feuilles.
 */
function testVerifierQRClient() {
  Logger.log("--- DÉBUT DU SCRIPT DE TEST ---");

  // ---------------------------------------------------------------------------------
  // REMPLACEZ CES VALEURS PAR DES DONNÉES RÉELLES DE VOS FEUILLES POUR UN TEST VALIDE
  // ---------------------------------------------------------------------------------
  const TEST_ID_CLIENT_QR = "ID_CLIENT_TEST"; // L'ID client qui se trouve dans la colonne "id client" de votre feuille "Missions"
  const TEST_EMAIL_PRESTATAIRE = "prestataire.test@example.com"; // Un email de prestataire qui a une mission assignée (et confirmée) pour aujourd'hui
  const TEST_LATITUDE = "50.6000"; // Coordonnées GPS fictives
  const TEST_LONGITUDE = "3.8000"; // Coordonnées GPS fictives
  const TEST_CALLBACK_NAME = "myFrontendCallback"; // Nom de callback fictif (peut être n'importe quoi pour le test)

  // Crée un objet 'e' factice qui simule les paramètres de l'URL
  const mockEvent = {
    parameter: {
      idclient: TEST_ID_CLIENT_QR,
      email: TEST_EMAIL_PRESTATAIRE,
      latitude: TEST_LATITUDE,
      longitude: TEST_LONGITUDE,
      callback: TEST_CALLBACK_NAME,
      // Ajoutez d'autres paramètres si votre fonction verifierQRClient les attend
    }
  };

  Logger.log(`Simulation d'un appel avec :`);
  Logger.log(`  idclient: ${mockEvent.parameter.idclient}`);
  Logger.log(`  email: ${mockEvent.parameter.email}`);
  Logger.log(`  latitude: ${mockEvent.parameter.latitude}`);
  Logger.log(`  longitude: ${mockEvent.parameter.longitude}`);

  try {
    // Appelle la fonction verifierQRClient avec l'objet factice
    const result = verifierQRClient(mockEvent);

    // Affiche le résultat retourné par verifierQRClient
    Logger.log("Résultat de verifierQRClient :");
    Logger.log(result);

    // Si le résultat est une chaîne JSONP, vous pouvez l'analyser pour voir le contenu
    if (typeof result === 'string' && result.startsWith(TEST_CALLBACK_NAME + '(')) {
      const jsonString = result.substring(TEST_CALLBACK_NAME.length + 1, result.length - 1);
      Logger.log("Contenu JSON de la réponse :");
      Logger.log(JSON.parse(jsonString));
    }

  } catch (error) {
    Logger.log("❌ Une erreur s'est produite lors de l'exécution de verifierQRClient :");
    Logger.log(error.message);
  }

  Logger.log("--- FIN DU SCRIPT DE TEST ---");
}

// ---------------------------------------------------------------------------------
// Fonction buildJsonResponse (à ajouter si elle n'est pas déjà dans votre projet)
// ---------------------------------------------------------------------------------
/**
 * Construit une réponse JSONP pour le frontend.
 * @param {string} callbackName Le nom de la fonction de rappel JSONP.
 * @param {object} data L'objet de données à renvoyer.
 * @return {GoogleAppsScript.Content.TextOutput} La réponse JSONP.
 */
function buildJsonResponse(callbackName, data) {
  const json = JSON.stringify(data);
  const output = ContentService.createTextOutput(`${callbackName}(${json})`);
  output.setMimeType(ContentService.MimeType.JAVASCRIPT);
  return output;
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

function buildJsonResponse(callback, payload) {
  const json = JSON.stringify(payload);
  const output = ContentService.createTextOutput();

  if (callback) {
    output.setContent(`${callback}(${json})`).setMimeType(ContentService.MimeType.JAVASCRIPT);
  } else {
    output.setContent(json).setMimeType(ContentService.MimeType.JSON);
  }

  return output;
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
      idclient: "cli-gamu56798", // Remplacez par un ID client QR valide de votre feuille Missions
      email: "gm.harchies@gmail.com", // Remplacez par un email prestataire valide
      latitude: "48.8566",
      longitude: "2.3522",
      callback: "cbVerifyClient12345"
    }
  };
  const result = verifierQRClient(fakeE);
  Logger.log(result.getContent());
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

function buildJsonResponse(callback, payload) {
  const json = JSON.stringify(payload);
  const output = ContentService.createTextOutput();

  if (callback) {
    output.setContent(`${callback}(${json})`).setMimeType(ContentService.MimeType.JAVASCRIPT);
  } else {
    output.setContent(json).setMimeType(ContentService.MimeType.JSON);
  }

  return output;
}

/**
 * Fonction de test pour simuler un appel à getMissionsForPresta
 * directement depuis l'éditeur Google Apps Script.
 * Cela permet de vérifier le comportement de la fonction et les logs.
 */
function testGetMissionsForPrestaDirect() {
  // Simule l'objet 'e' (event) qui serait passé lors d'une requête web.
  // L'email doit correspondre à un prestataire existant dans votre feuille "Missions"
  // pour obtenir des résultats significatifs.
  const fakeEvent = {
    parameter: {
      email: 'gm.harchies@gmail.com' // REMPLACEZ CET EMAIL par un email de prestataire valide de votre feuille "Missions"
    }
  };

  Logger.log("--- DÉBUT DU TEST : testGetMissionsForPrestaDirect ---");

  try {
    const result = getMissionsForPresta(fakeEvent);

    // Si la fonction retourne un ContentService.TextOutput, on peut récupérer son contenu.
    if (result && typeof result.getContent === 'function') {
      Logger.log("Réponse JSON de getMissionsForPresta : " + result.getContent());
    } else {
      // Si la fonction retourne directement un objet JS (comme dans le cas de 'type === "dropdown"'),
      // on peut le logger directement.
      Logger.log("Réponse objet de getMissionsForPresta : " + JSON.stringify(result, null, 2));
    }
  } catch (error) {
    Logger.log("❌ ERREUR lors de l'exécution de getMissionsForPresta : " + error.message);
  }

  Logger.log("--- FIN DU TEST : testGetMissionsForPrestaDirect ---");
}

/**
 * Récupère les missions dont le statut n'est ni "Clôturée" ni "Annulée".
 * @returns {Array<Object>} Un tableau d'objets représentant les missions en cours.
 */
function getMissionsEnCours() {
  try {
    const ss = SpreadsheetApp.openById("1KMdm740bc24Dx4puD71n5KTFrPqYVNl_f3T12hjYlKQ"); // REMPLACER PAR VOTRE ID DE FEUILLE
    const sheetMissions = ss.getSheetByName("Missions");

    if (!sheetMissions) {
      Logger.log("❌ getMissionsEnCours: Feuille 'Missions' introuvable.");
      return [];
    }

    const missionsData = sheetMissions.getDataRange().getValues();
    if (missionsData.length <= 1) { // Seulement les en-têtes ou feuille vide
      return [];
    }

    const headers = missionsData[0].map(h => String(h).trim());
    const missionsEnCours = [];

    const idColIndex = headers.indexOf("ID");
    const clientColIndex = headers.indexOf("Client");
    const serviceColIndex = headers.indexOf("Service");
    const dateColIndex = headers.indexOf("Date");
    const heureColIndex = headers.indexOf("Heure");
    const statutColIndex = headers.indexOf("Statut");
    const prestataireColIndex = headers.indexOf("Email Prestataire"); // Ou 'Prestataire' si c'est le nom complet

    // Vérifier que les colonnes nécessaires existent
    if (idColIndex === -1 || clientColIndex === -1 || serviceColIndex === -1 ||
        dateColIndex === -1 || heureColIndex === -1 || statutColIndex === -1) {
      Logger.log("❌ getMissionsEnCours: Colonnes essentielles manquantes dans 'Missions'.");
      return [];
    }

    for (let i = 1; i < missionsData.length; i++) {
      const row = missionsData[i];
      const statut = (row[statutColIndex] || "").toString().trim().toLowerCase();

      // Filtrer les missions qui ne sont ni "clôturée" ni "terminée" ni "annulée"
      if (statut !== "clôturée" && statut !== "terminée" && statut !== "annulée") {
        missionsEnCours.push({
          id: row[idColIndex],
          client: row[clientColIndex],
          service: row[serviceColIndex],
          date: row[dateColIndex],
          heure: row[heureColIndex],
          statut: row[statutColIndex],
          prestataire: prestataireColIndex !== -1 ? row[prestataireColIndex] : 'Non assigné'
        });
      }
    }
    Logger.log(`✅ ${missionsEnCours.length} missions en cours trouvées.`);
    return missionsEnCours;

  } catch (error) {
    Logger.log("❌ Erreur dans getMissionsEnCours: " + error.message);
    return [];
  }
}


routre
function doGet(e) {
  const type = (e?.parameter?.type || "").toLowerCase();
  const callback = e.parameter.callback; // callback JSONP

  Logger.log(`🔍 Type reçu (doGet de router.gs) : ${type}`);

  if (!type) {
    const errResp = { error: "Paramètre 'type' requis." };
    return createJsonpResponse(errResp, callback);
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

      case "verifqr":
        return verifierQRClient(e);

      case "dropdown":
      case "prestataires":
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

      case "missionsencours":
        // La fonction getMissionsEnCours retourne directement un tableau d'objets.
        // On l'encapsule dans un objet avec 'success' pour la cohérence des réponses.
        data = { success: true, missions: getMissionsEnCours() };
        break;

      case "getprestatairesstylés": {
        const specialiteDemandee = (e.parameter.specialite || "").toLowerCase();
        const tousLesPrestataires = getAllValidatedPrestataires();
        const prestatairesFiltres = tousLesPrestataires.filter(p =>
          (p.specialite || "").toLowerCase() === specialiteDemandee
        );
        data = { success: true, prestataires: prestatairesFiltres };
        break;
      }

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

    return createJsonpResponse(data, callback);

  } catch (err) {
    Logger.log("❌ Erreur interne dans doGet (router.gs) : " + err.message);
    return createJsonpResponse({ success: false, message: err.message }, callback);
  }
}

/**
 * Crée une réponse JSONP ou JSON (sans CORS headers car impossible dans GAS)
 * @param {object} data
 * @param {string} callback - nom de la fonction callback JSONP
 */
function createJsonpResponse(data, callback) {
  const json = JSON.stringify(data);
  if (callback) {
    const output = callback + "(" + json + ");";
    return ContentService.createTextOutput(output)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } else {
    // Attention : sans callback, CORS bloquera la requête si front différent
    return ContentService.createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

API
function doPost(e) {
  Logger.log("--- DÉBUT doPost (API.gs) ---");
  Logger.log("Objet 'e' reçu: " + JSON.stringify(e)); 

  let result;
  let typeFromPost = "";

  try {
    // VERIFICATION ROBUSTE : on s'assure que e et e.parameter existent
    if (e && e.parameter) {
      typeFromPost = e.parameter.type || "";
    } else {
      Logger.log("❌ ERREUR: L'objet e.parameter est manquant. Le corps de la requête POST n'a pas été parsé.");
      result = { success: false, message: "Erreur de parsing de la requête. Paramètres non trouvés." };

      // Log du contenu brut pour diagnostiquer la cause
      if (e && e.postData && e.postData.contents) {
         Logger.log("Contenu brut du POST: " + e.postData.contents.slice(0, 500) + "...");
      }
      return createPostCorsResponse(result);
    }

    Logger.log("Type de requête détecté: " + typeFromPost);

    if (typeFromPost === "formClient") {
      result = handleFormClient(e); 
    } else if (typeFromPost === "envoyerFiche") {
      result = handleFicheObservation(e);
    } else if (typeFromPost === "ajoutCredits") {
      result = handleAjoutCredits(e);
    } else {
      result = {
        success: false,
        message: "Type de requête non reconnu",
        params: e.parameter
      };
    }

    return createPostCorsResponse(result);
  } catch (err) {
    Logger.log("❌ ERREUR CATCH dans doPost: " + err.message + " Stack: " + err.stack);
    result = {
      success: false,
      message: err.message
    };
    return createPostCorsResponse(result);
  }
}

// ... Le reste de votre script Apps Script peut rester identique ...
// Assurez-vous que les fonctions createPostCorsResponse, handleFormClient,
// handleAjoutCredits, handleFicheObservation sont toujours définies ailleurs dans votre script.
// Pour handleFormClient, assurez-vous qu'elle retourne un objet simple comme { success: true, message: "..." }.
// Ne laissez PAS handleFormClient retourner ContentService.createTextOutput.

/**
 * Gère l'envoi de la fiche d'observation, met à jour la mission,
 * stocke les photos et génère le PDF.
 * @param {GoogleAppsScript.Events.DoPost} e L'objet événement doPost.
 * @returns {object} Un objet JSON avec le succès/échec et un message.
 */
/**
 * Gère l'envoi de la fiche d'observation, met à jour la mission,
 * stocke les photos et génère le PDF.
 * @param {GoogleAppsScript.Events.DoPost} e L'objet événement doPost.
 * @returns {object} Un objet JSON avec le succès/échec et un message.
 */
function handleFicheObservation(e) {
  // Les données du formulaire simple sont dans e.parameter
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
  const prestatairePrenom = prestataire ? prestataire.prenom || "Inconnu" : "Inconnu";
  const prestataireNom = prestataire ? prestataire.nom || "Inconnu" : "Inconnu";

  let photoUrls = []; // Déclarez la variable en dehors du bloc try
  
  // --- GESTION DES PHOTOS ---
  try {
    const photosFolderId = '1dXqCw_-vR24XLlkjJLUlyYC-QV9O6R6S'; // ID CORRIGÉ de votre dossier photos
    const photosFolder = DriveApp.getFolderById(photosFolderId);
    
    const uploadedPhotos = e.parameter.photos;
    const photosArray = Array.isArray(uploadedPhotos) ? uploadedPhotos : [uploadedPhotos];
    
    for (const photoBlob of photosArray) {
      if (photoBlob && photoBlob.getName && photoBlob.getName() !== 'undefined') {
        const file = photosFolder.createFile(photoBlob);
        photoUrls.push(file.getUrl());
        Logger.log(`✅ Photo "${file.getName()}" enregistrée dans Google Drive.`);
      }
    }
  } catch (err) {
    Logger.log("❌ Erreur lors de l'enregistrement des photos: " + err.message);
    // Si l'enregistrement des photos échoue, on retourne une erreur.
    return { success: false, message: "Erreur lors de l'enregistrement des photos." };
  }
  
  // --- CONTENU HTML DU PDF ---
  let photosHtml = '';
  if (photoUrls.length > 0) {
    photosHtml = `<h3>Photos d'observation :</h3>`;
    for (const url of photoUrls) {
      photosHtml += `<p><a href="${url}">Lien vers la photo</a></p>`;
    }
  }

  const htmlContent = `
    <h2>Fiche d'observation</h2>
    <p><strong>Mission :</strong> ${missionId}</p>
    <p><strong>Client :</strong> ${clientPrenom} ${clientNom}</p>
    <p><strong>Date d'observation :</strong> ${obsDate}</p>
    <p><strong>État de santé :</strong><br/>${etatSante.replace(/\n/g, "<br>")}</p>
    <p><strong>État de forme :</strong> ${etatForme}</p>
    <p><strong>Environnement :</strong><br/>${environnement.replace(/\n/g, "<br>")}</p>
    <p><strong>Coordonnées GPS de fin :</strong> ${latitude}, ${longitude}</p>
    <p><strong>Heure début réelle :</strong> ${heureDebut}</p>
    <p><strong>Heure fin réelle :</strong> ${heureFin}</p>
    <p><strong>Prestataire :</strong> ${prestatairePrenom} ${prestataireNom}</p>
    ${photosHtml}
  `;

  // ... (le reste du code pour générer le PDF et mettre à jour les feuilles) ...
  let pdfUrl;
  try {
    const blob = Utilities.newBlob(htmlContent, 'text/html', 'fiche.html');
    const pdfBlob = blob.getAs('application/pdf').setName(`Fiche_${missionId}_${clientPrenom}_${clientNom}_${obsDate}.pdf`);

    // On utilise ici le folderId pour le PDF. A vérifier si besoin.
    const folderId = '1f-BU9ZEGOS5_eODpYsugveKqliVfky16';
    const folder = DriveApp.getFolderById(folderId);
    const file = folder.createFile(pdfBlob);
    pdfUrl = file.getUrl();
  } catch (err) {
    Logger.log("❌ Erreur lors de la création du PDF: " + err.message);
    return { success: false, message: "Erreur lors de la création du PDF." };
  }


  // Enregistrement dans la feuille "FichesObservations"
  const ss = SpreadsheetApp.openById('1KMdm740bc24Dx4puD71n5KTFrPqYVNl_f3T12hjYlKQ'); // ID de votre Google Sheet principal
  const sheetNameFiches = 'FichesObservations';
  let sheetFiches = ss.getSheetByName(sheetNameFiches);
  if (!sheetFiches) {
    sheetFiches = ss.insertSheet(sheetNameFiches);
    sheetFiches.appendRow(['Horodatage', 'ID Mission', 'Nom Client', 'Date Observation', 'Lien PDF', 'Liens Photos']);
  }
  sheetFiches.appendRow([new Date(), missionId, `${clientPrenom} ${clientNom}`, obsDate, pdfUrl, photoUrls.join('\n')]);

  // --- MISE À JOUR DE LA FEUILLE "MISSIONS" ---
  const missionSheet = ss.getSheetByName('Missions');
  if (!missionSheet) {
    Logger.log("❌ handleFicheObservation: Feuille 'Missions' introuvable.");
    return { success: false, message: "Feuille 'Missions' introuvable pour la mise à jour." };
  }

  // ... (Reste de la mise à jour des missions) ...
  const missionData = missionSheet.getDataRange().getValues();
  const missionsHeaders = missionData[0].map(h => String(h).trim().toLowerCase());
  const missionIdCol = missionsHeaders.indexOf("id");
  const statutCol = missionsHeaders.indexOf("statut");
  const heureDebutReelleCol = missionsHeaders.indexOf("heure début réelle");
  const heureFinReelleCol = missionsHeaders.indexOf("heure fin réelle");
  const latitudeFinCol = missionsHeaders.indexOf("latitude fin");
  const longitudeFinCol = missionsHeaders.indexOf("longitude fin");
  const dateObservationCol = missionsHeaders.indexOf("date observation");
  const etatSanteCol = missionsHeaders.indexOf("état santé");
  const etatFormeCol = missionsHeaders.indexOf("état forme");
  const environnementCol = missionsHeaders.indexOf("environnement");
  const liensPhotosCol = missionsHeaders.indexOf("liens photos");
  const lienPdfCol = missionsHeaders.indexOf("lien pdf");
  const requiredColsForUpdate = [ missionIdCol, statutCol, heureDebutReelleCol, heureFinReelleCol, latitudeFinCol, longitudeFinCol, dateObservationCol, etatSanteCol, etatFormeCol, environnementCol, lienPdfCol, liensPhotosCol ];
// Ajoutez cette ligne juste en dessous
   Logger.log(`Indices des colonnes: ID=${missionIdCol}, Statut=${statutCol}, HeureDébut=${heureDebutReelleCol}, ... etc.`);

  if (requiredColsForUpdate.some(idx => idx === -1)) {
    Logger.log("❌ handleFicheObservation: Colonnes de mise à jour manquantes.");
const missingCols = requiredColsForUpdate.map((idx, i) => idx === -1 ? missionsHeaders[i] : null).filter(h => h !== null);

return {
  success: false,
  message: "Colonnes manquantes dans 'Missions' pour la mise à jour.",
  details: {
    allHeaders: missionsHeaders,
    missing: missingCols,
    indices: {
      missionIdCol: missionIdCol,
      statutCol: statutCol,
      heureDebutReelleCol: heureDebutReelleCol,
      heureFinReelleCol: heureFinReelleCol,
      latitudeFinCol: latitudeFinCol,
      longitudeFinCol: longitudeFinCol,
      dateObservationCol: dateObservationCol,
      etatSanteCol: etatSanteCol,
      etatFormeCol: etatFormeCol,
      environnementCol: environnementCol,
      lienPdfCol: lienPdfCol,
      liensPhotosCol: liensPhotosCol
    }
  }
};  }

  let missionRowFound = false;
  for (let i = 1; i < missionData.length; i++) {
    if ((missionData[i][missionIdCol] || "").toString().trim() === missionId) {
      const rowRange = missionSheet.getRange(i + 1, 1, 1, missionData[0].length);
      const currentRowValues = rowRange.getValues()[0];
      currentRowValues[statutCol] = "Clôturée";
      currentRowValues[heureDebutReelleCol] = heureDebut;
      currentRowValues[heureFinReelleCol] = heureFin;
      currentRowValues[latitudeFinCol] = latitude;
      currentRowValues[longitudeFinCol] = longitude;
      currentRowValues[dateObservationCol] = obsDate;
      currentRowValues[etatSanteCol] = etatSante;
      currentRowValues[etatFormeCol] = etatForme;
      currentRowValues[environnementCol] = environnement;
      currentRowValues[lienPdfCol] = pdfUrl;
      currentRowValues[liensPhotosCol] = photoUrls.join('\n');
      rowRange.setValues([currentRowValues]);
      Logger.log(`✅ Mission ${missionId} mise à jour avec photos.`);
      missionRowFound = true;
      break;
    }
  }

  if (!missionRowFound) {
    Logger.log(`❌ Mission ${missionId} non trouvée.`);
    // Ceci est une erreur logique, donc on renvoie un échec
    return { success: false, message: `Fiche enregistrée, mais mission ${missionId} non trouvée pour mise à jour.` };
  }
  
  return { success: true, url: pdfUrl, message: "Mission clôturée, fiche et photos enregistrées." };
}

// Note: Assurez-vous que la fonction getPrestataireNameByEmail existe dans votre code
function getPrestataireNameByEmail(email) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetPrestataires = ss.getSheetByName("IPrestataires");
  if (!sheetPrestataires) {
    Logger.log("getPrestataireNameByEmail: Feuille 'IPrestataires' introuvable.");
    return null;
  }
  const data = sheetPrestataires.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim().toLowerCase()); // On met les en-têtes en minuscule pour la recherche
  
  // Correction de la recherche des en-têtes en utilisant le format en minuscule
  const emailCol = headers.indexOf("email"); 
  const prenomCol = headers.indexOf("prénom");
  const nomCol = headers.indexOf("nom");

  if (emailCol === -1 || prenomCol === -1 || nomCol === -1) {
    Logger.log("getPrestataireNameByEmail: Colonnes 'Email', 'Prénom' ou 'Nom' manquantes dans 'IPrestataires'.");
    return null;
  }

  for (let i = 1; i < data.length; i++) {
    const rowEmail = (data[i][emailCol] || "").toString().trim().toLowerCase();
    if (rowEmail === email.toLowerCase()) {
      return {
        prenom: (data[i][prenomCol] || "").toString().trim(),
        nom: (data[i][nomCol] || "").toString().trim()
      };
    }
  }
  return null;
}

// --- FONCTION DE TEST POUR SIMULER L'ENVOI D'UN FORMULAIRE AVEC PHOTOS ---
function testFormSubmission() {
  const testMissionId = "TEST_MISSION_SIMULATED_20250731_02"; // ID unique pour ce test
  
  // Crée des données binaires (un faux fichier)
  const fakePhotoContent = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  const photoBlob1 = Utilities.newBlob(Utilities.base64Decode(fakePhotoContent.split(',')[1]), 'image/png', 'test_photo_1.png');
  const photoBlob2 = Utilities.newBlob(Utilities.base64Decode(fakePhotoContent.split(',')[1]), 'image/png', 'test_photo_2.png');
  
  // Crée l'objet 'e' qui simule la requête POST d'un FormData
  // Apps Script met les champs de texte dans 'e.parameter'
  // et les fichiers dans 'e.parameter' sous forme de Blobs.
  const e = {
    parameter: {
      type: "envoyerFiche",
      missionId: testMissionId,
      prenomClient: "FakeClient",
      nomClient: "Test",
      obsDate: "2025-07-31",
      etatSante: "Ceci est un test de l'état de santé.",
      etatForme: "Bonne",
      environnement: "Environnement de test.",
      latitude: "48.8566",
      longitude: "2.3522",
      heureDebut: "2025-07-31T15:00:00Z",
      prestatairePrenom: "Testeur",
      prestataireNom: "Viiveo",
      prestataireEmail: "test.prestataire@viiveo.com",
      // Les fichiers sont ajoutés comme une propriété 'photos'
      photos: [photoBlob1, photoBlob2]
    },
    // On peut aussi simuler d'autres propriétés de l'objet e si besoin
    // postData: { ... },
    // contentType: "multipart/form-data"
  };

  Logger.log("Appel de handleFicheObservation avec un objet 'e' simulé.");
  
  try {
    const result = handleFicheObservation(e);
    Logger.log("Résultat du test: " + JSON.stringify(result));
    
    if (result.success) {
      // Vous pouvez vérifier les feuilles de calcul et Google Drive ici
      Logger.log("✅ SUCCÈS : Vérifiez votre feuille 'FichesObservations' et votre dossier Drive.");
    } else {
      Logger.log("❌ ÉCHEC : Le test a échoué. Message : " + result.message);
    }
    
  } catch (err) {
    Logger.log("❌ ERREUR LORS DU TEST : " + err.message + " Stack: " + err.stack);
  }
}
