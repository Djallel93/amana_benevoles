/**
 * @file availabilityService.js
 * @description Gestion des disponibilités des bénévoles.
 *
 * Sheet columns: id_benevole | disponibilites | remarques | derniere_maj
 */

function setVolunteerAvailability(volunteerId, disponibilite, remarques = '') {
    try {
        const volunteer = getVolunteerById(volunteerId);
        if (!volunteer) {
            return { success: false, error: `Bénévole ${volunteerId} introuvable` };
        }

        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.DISPONIBILITES);
        if (!sheet) throw new Error('Feuille disponibilites introuvable');

        const existing = findVolunteerAvailability(volunteerId, disponibilite);
        if (existing) {
            return updateVolunteerAvailability(volunteerId, disponibilite, remarques);
        }

        sheet.appendRow([
            volunteerId,
            disponibilite,
            remarques,
            formatVolunteerDateTime()
        ]);

        logVolunteerInfo(`Disponibilité ajoutée pour ${volunteerId}: ${disponibilite}`);
        return { success: true };

    } catch (error) {
        logVolunteerError('Échec ajout disponibilité', error);
        return { success: false, error: error.toString() };
    }
}

function getVolunteerAvailabilities(volunteerId) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.DISPONIBILITES);
        if (!sheet) throw new Error('Feuille disponibilites introuvable');

        const data = sheet.getDataRange().getValues();
        const availabilities = [];

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (normalizeVolunteerId(row[DISPONIBILITE_COLUMNS.ID_BENEVOLE]) === normalizeVolunteerId(volunteerId)) {
                availabilities.push({
                    idBenevole: row[DISPONIBILITE_COLUMNS.ID_BENEVOLE],
                    disponibilite: row[DISPONIBILITE_COLUMNS.DISPONIBILITE],
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

function getAvailableVolunteers(disponibilite) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.DISPONIBILITES);
        if (!sheet) throw new Error('Feuille disponibilites introuvable');

        const data = sheet.getDataRange().getValues();
        const volunteerIds = new Set();

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (row[DISPONIBILITE_COLUMNS.DISPONIBILITE] === disponibilite) {
                volunteerIds.add(row[DISPONIBILITE_COLUMNS.ID_BENEVOLE]);
            }
        }

        const volunteers = [];
        volunteerIds.forEach(volunteerId => {
            const volunteer = getVolunteerById(volunteerId);
            if (volunteer?.actif && volunteer.statut === VOLUNTEER_CONFIG.STATUS.VALIDE) {
                volunteers.push(volunteer);
            }
        });

        return volunteers;

    } catch (error) {
        logVolunteerError(`Échec récupération bénévoles pour créneau ${disponibilite}`, error);
        return [];
    }
}

function removeVolunteerAvailability(volunteerId, disponibilite) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.DISPONIBILITES);
        if (!sheet) throw new Error('Feuille disponibilites introuvable');

        const data = sheet.getDataRange().getValues();

        for (let i = 1; i < data.length; i++) {
            if (String(data[i][DISPONIBILITE_COLUMNS.ID_BENEVOLE]).trim() === String(volunteerId).trim() &&
                data[i][DISPONIBILITE_COLUMNS.DISPONIBILITE] === disponibilite) {
                sheet.deleteRow(i + 1);
                logVolunteerInfo(`Disponibilité supprimée: ${volunteerId} - ${disponibilite}`);
                return { success: true };
            }
        }

        return { success: false, error: 'Disponibilité introuvable' };

    } catch (error) {
        logVolunteerError('Échec suppression disponibilité', error);
        return { success: false, error: error.toString() };
    }
}

function findVolunteerAvailability(volunteerId, disponibilite) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.DISPONIBILITES);
        if (!sheet) return null;

        const data = sheet.getDataRange().getValues();

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (normalizeVolunteerId(row[DISPONIBILITE_COLUMNS.ID_BENEVOLE]) === normalizeVolunteerId(volunteerId) &&
                row[DISPONIBILITE_COLUMNS.DISPONIBILITE] === disponibilite) {
                return {
                    idBenevole: row[DISPONIBILITE_COLUMNS.ID_BENEVOLE],
                    disponibilite: row[DISPONIBILITE_COLUMNS.DISPONIBILITE],
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

function updateVolunteerAvailability(volunteerId, disponibilite, remarques) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.DISPONIBILITES);
        if (!sheet) throw new Error('Feuille disponibilites introuvable');

        const data = sheet.getDataRange().getValues();

        for (let i = 1; i < data.length; i++) {
            if (String(data[i][DISPONIBILITE_COLUMNS.ID_BENEVOLE]).trim() === String(volunteerId).trim() &&
                data[i][DISPONIBILITE_COLUMNS.DISPONIBILITE] === disponibilite) {
                const targetRow = i + 1;
                sheet.getRange(targetRow, DISPONIBILITE_COLUMNS.REMARQUES + 1).setValue(remarques);
                sheet.getRange(targetRow, DISPONIBILITE_COLUMNS.DERNIERE_MAJ + 1).setValue(formatVolunteerDateTime());
                return { success: true };
            }
        }

        return { success: false, error: 'Disponibilité introuvable' };

    } catch (error) {
        logVolunteerError('Échec mise à jour disponibilité', error);
        return { success: false, error: error.toString() };
    }
}