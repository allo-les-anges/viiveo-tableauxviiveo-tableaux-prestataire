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
  const missionsHeaders = missionsData[0]; // Récupère les en-têtes de la feuille Missions
  const formsData = formsSheet.getDataRange().getValues();
  const formsHeaders = formsData[0]; // Récupère les en-têtes de la feuille FormResponses

  Logger.log(`En-têtes Missions : ${JSON.stringify(missionsHeaders)}`);
  Logger.log(`En-têtes FormResponses : ${JSON.stringify(formsHeaders)}`);

  Logger.log(`ℹ️ Nombre de lignes dans Missions (hors en-tête) : ${missionsData.length - 1}`);
  Logger.log(`ℹ️ Nombre de lignes dans FormResponses (hors en-tête) : ${formsData.length - 1}`);

  // Recherche des indices de colonnes pour Missions (plus robuste avec les noms exacts)
  const colIndexMissionId = missionsHeaders.indexOf("ID");
  const colIndexIdDemande = missionsHeaders.indexOf("ID Demande");
  const colIndexEmailPrestataire = missionsHeaders.indexOf("Email Prestataire");
  const colIndexDate = missionsHeaders.indexOf("Date");
  const colIndexIdClientQR = missionsHeaders.indexOf("id client"); // CORRECTION ICI : "id client" avec espace
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
    "id client": colIndexIdClientQR, // CORRECTION ICI
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
  const colIndexFormEmail = formsHeaders.indexOf("Email");

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
