/**
 * @file availabilityService.js
 * @description Gestion des disponibilités des bénévoles.
 *
 * Sheet columns: id_benevole | disponibilites | remarques | derniere_maj
 */

/**
 * Returns the disponibilites sheet, trying exact name first then accent/case-insensitive fallback.
 * Logs all available sheet names if not found.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet|null}
 */
function getDisponibilitesSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(VOLUNTEER_CONFIG.SHEETS.DISPONIBILITES);
    if (!sheet) {
        const target = VOLUNTEER_CONFIG.SHEETS.DISPONIBILITES
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        sheet = ss.getSheets().find(s => {
            const name = s.getName()
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');
            return name === target;
        }) || null;
    }
    if (!sheet) {
        logVolunteerError(
            `Sheet not found. Configured: "${VOLUNTEER_CONFIG.SHEETS.DISPONIBILITES}". ` +
            `Available: ${SpreadsheetApp.getActiveSpreadsheet().getSheets().map(s => `"${s.getName()}"`).join(', ')}`
        );
    }
    return sheet;
}

function setVolunteerAvailability(volunteerId, disponibilite, remarques = '') {
    try {
        const volunteer = getVolunteerById(volunteerId);
        if (!volunteer) {
            return { success: false, error: `Bénévole ${volunteerId} introuvable` };
        }

        const sheet = getDisponibilitesSheet();
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
        const sheet = getDisponibilitesSheet();
        if (!sheet) return [];

        const data = sheet.getDataRange().getValues();
        const availabilities = [];
        const normalizedTarget = normalizeVolunteerId(volunteerId);

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (normalizeVolunteerId(row[DISPONIBILITE_COLUMNS.ID_BENEVOLE]) === normalizedTarget) {
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
        const sheet = getDisponibilitesSheet();
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
        const sheet = getDisponibilitesSheet();
        if (!sheet) throw new Error('Feuille disponibilites introuvable');

        const data = sheet.getDataRange().getValues();

        for (let i = 1; i < data.length; i++) {
            if (normalizeVolunteerId(data[i][DISPONIBILITE_COLUMNS.ID_BENEVOLE]) === normalizeVolunteerId(volunteerId) &&
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
        const sheet = getDisponibilitesSheet();
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
        const sheet = getDisponibilitesSheet();
        if (!sheet) throw new Error('Feuille disponibilites introuvable');

        const data = sheet.getDataRange().getValues();

        for (let i = 1; i < data.length; i++) {
            if (normalizeVolunteerId(data[i][DISPONIBILITE_COLUMNS.ID_BENEVOLE]) === normalizeVolunteerId(volunteerId) &&
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