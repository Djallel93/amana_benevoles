/**
 * @file vehicleService.js
 * @description Gestion des véhicules des bénévoles
 */

/**
 * Récupère un véhicule par ID
 * @param {number} vehicleId - ID du véhicule
 * @returns {Object|null} Données du véhicule ou null
 */
function getVehicleById(vehicleId) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.VEHICULES);

        if (!sheet) {
            throw new Error('Feuille vehicules introuvable');
        }

        const data = sheet.getDataRange().getValues();

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (row[VEHICULE_COLUMNS.ID] == vehicleId) {
                return {
                    id: row[VEHICULE_COLUMNS.ID],
                    type: row[VEHICULE_COLUMNS.TYPE],
                    capaciteKg: row[VEHICULE_COLUMNS.CAPACITE_KG]
                };
            }
        }

        return null;

    } catch (error) {
        logVolunteerError(`Échec récupération véhicule ${vehicleId}`, error);
        return null;
    }
}

/**
 * Récupère tous les véhicules
 * @returns {Array} Liste des véhicules
 */
function getAllVehicles() {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.VEHICULES);

        if (!sheet) {
            throw new Error('Feuille vehicules introuvable');
        }

        const data = sheet.getDataRange().getValues();
        const vehicles = [];

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            vehicles.push({
                id: row[VEHICULE_COLUMNS.ID],
                type: row[VEHICULE_COLUMNS.TYPE],
                capaciteKg: row[VEHICULE_COLUMNS.CAPACITE_KG]
            });
        }

        return vehicles;

    } catch (error) {
        logVolunteerError('Échec récupération liste véhicules', error);
        return [];
    }
}

/**
 * Récupère tous les bénévoles utilisant un véhicule
 * @param {number} vehicleId - ID du véhicule
 * @returns {Array} Liste des bénévoles
 */
function getVolunteersByVehicle(vehicleId) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.BENEVOLES);

        if (!sheet) {
            return [];
        }

        const data = sheet.getDataRange().getValues();
        const volunteers = [];

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (row[BENEVOLE_COLUMNS.ID_VEHICULE] == vehicleId) {
                volunteers.push({
                    id: row[BENEVOLE_COLUMNS.ID],
                    nom: row[BENEVOLE_COLUMNS.NOM],
                    prenom: row[BENEVOLE_COLUMNS.PRENOM],
                    email: row[BENEVOLE_COLUMNS.EMAIL]
                });
            }
        }

        return volunteers;

    } catch (error) {
        logVolunteerError(`Échec récupération bénévoles pour véhicule ${vehicleId}`, error);
        return [];
    }
}