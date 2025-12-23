/**
 * @file availabilityService.js
 * @description Gestion des disponibilités des bénévoles
 */

/**
 * Ajoute ou met à jour une disponibilité pour un bénévole
 * @param {string} volunteerId - ID du bénévole
 * @param {string} disponibilite - Créneau de disponibilité
 * @param {boolean} courtDelaiOk - Accepte les demandes à court délai
 * @param {string} remarques - Remarques optionnelles
 * @returns {Object} {success: boolean, error?: string}
 */
function setVolunteerAvailability(volunteerId, disponibilite, courtDelaiOk = false, remarques = '') {
    try {
        logVolunteerInfo(`Définition disponibilité pour ${volunteerId}`, {
            disponibilite: disponibilite,
            courtDelaiOk: courtDelaiOk
        });

        // Vérification que le bénévole existe
        const volunteer = getVolunteerById(volunteerId);
        if (!volunteer) {
            return {
                success: false,
                error: `Bénévole ${volunteerId} introuvable`
            };
        }

        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.DISPONIBILITES);

        if (!sheet) {
            throw new Error('Feuille disponibilites introuvable');
        }

        // Vérification si la disponibilité existe déjà
        const existing = findVolunteerAvailability(volunteerId, disponibilite);

        if (existing) {
            // Mise à jour
            return updateVolunteerAvailability(volunteerId, disponibilite, courtDelaiOk, remarques);
        }

        // Création
        const now = formatVolunteerDateTime();

        const row = [
            volunteerId,
            disponibilite,
            courtDelaiOk,
            remarques,
            now
        ];

        sheet.appendRow(row);

        logVolunteerInfo(`Disponibilité ajoutée pour ${volunteerId}: ${disponibilite}`);

        return {
            success: true
        };

    } catch (error) {
        logVolunteerError('Échec ajout disponibilité', error);
        return {
            success: false,
            error: error.toString()
        };
    }
}

/**
 * Récupère toutes les disponibilités d'un bénévole
 * @param {string} volunteerId - ID du bénévole
 * @returns {Array} Liste des disponibilités
 */
function getVolunteerAvailabilities(volunteerId) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.DISPONIBILITES);

        if (!sheet) {
            throw new Error('Feuille disponibilites introuvable');
        }

        const data = sheet.getDataRange().getValues();
        const availabilities = [];

        for (let i = 1; i < data.length; i++) {
            const row = data[i];

            if (row[DISPONIBILITE_COLUMNS.ID_BENEVOLE] === volunteerId) {
                availabilities.push({
                    idBenevole: row[DISPONIBILITE_COLUMNS.ID_BENEVOLE],
                    disponibilite: row[DISPONIBILITE_COLUMNS.DISPONIBILITE],
                    courtDelaiOk: row[DISPONIBILITE_COLUMNS.COURT_DELAI_OK],
                    remarques: row[DISPONIBILITE_COLUMNS.REMARQUES],
                    derniereMaj: row[DISPONIBILITE_COLUMNS.DERNIERE_MAJ]
                });
            }
        }

        return availabilities;

    } catch (error) {
        logVolunteerError(`Échec récupération disponibilités pour ${volunteerId}`, error);
        return [];
    }
}

/**
 * Récupère tous les bénévoles disponibles pour un créneau
 * @param {string} disponibilite - Créneau de disponibilité
 * @param {boolean} courtDelaiOnly - Ne retourner que ceux qui acceptent le court délai
 * @returns {Array} Liste des bénévoles disponibles
 */
function getAvailableVolunteers(disponibilite, courtDelaiOnly = false) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.DISPONIBILITES);

        if (!sheet) {
            throw new Error('Feuille disponibilites introuvable');
        }

        const data = sheet.getDataRange().getValues();
        const volunteerIds = new Set();

        for (let i = 1; i < data.length; i++) {
            const row = data[i];

            if (row[DISPONIBILITE_COLUMNS.DISPONIBILITE] === disponibilite) {
                if (!courtDelaiOnly || row[DISPONIBILITE_COLUMNS.COURT_DELAI_OK] === true) {
                    volunteerIds.add(row[DISPONIBILITE_COLUMNS.ID_BENEVOLE]);
                }
            }
        }

        // Récupération des détails des bénévoles
        const volunteers = [];
        volunteerIds.forEach(volunteerId => {
            const volunteer = getVolunteerById(volunteerId);
            if (volunteer && volunteer.actif && volunteer.statut === VOLUNTEER_CONFIG.STATUS.VALIDE) {
                volunteers.push(volunteer);
            }
        });

        return volunteers;

    } catch (error) {
        logVolunteerError(`Échec récupération bénévoles pour créneau ${disponibilite}`, error);
        return [];
    }
}

/**
 * Supprime une disponibilité spécifique
 * @param {string} volunteerId - ID du bénévole
 * @param {string} disponibilite - Créneau de disponibilité
 * @returns {Object} {success: boolean, error?: string}
 */
function removeVolunteerAvailability(volunteerId, disponibilite) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.DISPONIBILITES);

        if (!sheet) {
            throw new Error('Feuille disponibilites introuvable');
        }

        const data = sheet.getDataRange().getValues();
        let targetRow = -1;

        for (let i = 1; i < data.length; i++) {
            const row = data[i];

            if (row[DISPONIBILITE_COLUMNS.ID_BENEVOLE] === volunteerId &&
                row[DISPONIBILITE_COLUMNS.DISPONIBILITE] === disponibilite) {
                targetRow = i + 1;
                break;
            }
        }

        if (targetRow === -1) {
            return {
                success: false,
                error: 'Disponibilité introuvable'
            };
        }

        sheet.deleteRow(targetRow);

        logVolunteerInfo(`Disponibilité supprimée: ${volunteerId} - ${disponibilite}`);

        return {
            success: true
        };

    } catch (error) {
        logVolunteerError('Échec suppression disponibilité', error);
        return {
            success: false,
            error: error.toString()
        };
    }
}

/**
 * Trouve une disponibilité spécifique
 * @param {string} volunteerId - ID du bénévole
 * @param {string} disponibilite - Créneau de disponibilité
 * @returns {Object|null} Disponibilité ou null
 */
function findVolunteerAvailability(volunteerId, disponibilite) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.DISPONIBILITES);

        if (!sheet) {
            return null;
        }

        const data = sheet.getDataRange().getValues();

        for (let i = 1; i < data.length; i++) {
            const row = data[i];

            if (row[DISPONIBILITE_COLUMNS.ID_BENEVOLE] === volunteerId &&
                row[DISPONIBILITE_COLUMNS.DISPONIBILITE] === disponibilite) {
                return {
                    idBenevole: row[DISPONIBILITE_COLUMNS.ID_BENEVOLE],
                    disponibilite: row[DISPONIBILITE_COLUMNS.DISPONIBILITE],
                    courtDelaiOk: row[DISPONIBILITE_COLUMNS.COURT_DELAI_OK],
                    remarques: row[DISPONIBILITE_COLUMNS.REMARQUES],
                    derniereMaj: row[DISPONIBILITE_COLUMNS.DERNIERE_MAJ]
                };
            }
        }

        return null;

    } catch (error) {
        logVolunteerError('Échec recherche disponibilité', error);
        return null;
    }
}

/**
 * Met à jour une disponibilité existante
 * @param {string} volunteerId - ID du bénévole
 * @param {string} disponibilite - Créneau de disponibilité
 * @param {boolean} courtDelaiOk - Accepte les demandes à court délai
 * @param {string} remarques - Remarques
 * @returns {Object} {success: boolean, error?: string}
 */
function updateVolunteerAvailability(volunteerId, disponibilite, courtDelaiOk, remarques) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.DISPONIBILITES);

        if (!sheet) {
            throw new Error('Feuille disponibilites introuvable');
        }

        const data = sheet.getDataRange().getValues();
        let targetRow = -1;

        for (let i = 1; i < data.length; i++) {
            const row = data[i];

            if (row[DISPONIBILITE_COLUMNS.ID_BENEVOLE] === volunteerId &&
                row[DISPONIBILITE_COLUMNS.DISPONIBILITE] === disponibilite) {
                targetRow = i + 1;
                break;
            }
        }

        if (targetRow === -1) {
            return {
                success: false,
                error: 'Disponibilité introuvable'
            };
        }

        const now = formatVolunteerDateTime();
        sheet.getRange(targetRow, DISPONIBILITE_COLUMNS.COURT_DELAI_OK + 1).setValue(courtDelaiOk);
        sheet.getRange(targetRow, DISPONIBILITE_COLUMNS.REMARQUES + 1).setValue(remarques);
        sheet.getRange(targetRow, DISPONIBILITE_COLUMNS.DERNIERE_MAJ + 1).setValue(now);

        return {
            success: true
        };

    } catch (error) {
        logVolunteerError('Échec mise à jour disponibilité', error);
        return {
            success: false,
            error: error.toString()
        };
    }
}