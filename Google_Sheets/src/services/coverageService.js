/**
 * @file coverageService.js
 * @description Gestion de la couverture géographique des bénévoles
 */

/**
 * Ajoute une zone de couverture pour un bénévole
 * @param {string} volunteerId - ID du bénévole
 * @param {string} quartierId - ID du quartier
 * @param {string} type - Type de couverture
 * @param {string} remarques - Remarques optionnelles
 * @returns {Object} {success: boolean, error?: string}
 */
function addVolunteerCoverage(volunteerId, quartierId, type, remarques = '') {
    try {
        logVolunteerInfo(`Ajout couverture pour bénévole ${volunteerId}`, {
            quartier: quartierId,
            type: type
        });

        // Validation du type
        const validTypes = Object.values(VOLUNTEER_CONFIG.COVERAGE_TYPES);
        if (!validTypes.includes(type)) {
            return {
                success: false,
                error: `Type de couverture invalide. Types valides: ${validTypes.join(', ')}`
            };
        }

        // Vérification que le bénévole existe
        const volunteer = getVolunteerById(volunteerId);
        if (!volunteer) {
            return {
                success: false,
                error: `Bénévole ${volunteerId} introuvable`
            };
        }

        // Vérification que le quartier existe via l'API GEO
        const quartierValidation = validateQuartierViaGeoApi(quartierId);
        if (!quartierValidation.isValid) {
            return {
                success: false,
                error: `Quartier ${quartierId} invalide: ${quartierValidation.error}`
            };
        }

        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.COUVERTURE);

        if (!sheet) {
            throw new Error('Feuille couverture introuvable');
        }

        // Vérification des doublons
        const existingCoverage = findVolunteerCoverage(volunteerId, quartierId, type);
        if (existingCoverage) {
            return {
                success: false,
                error: 'Cette couverture existe déjà pour ce bénévole'
            };
        }

        const now = formatVolunteerDateTime();

        const row = [
            volunteerId,
            quartierId,
            type,
            remarques,
            now
        ];

        sheet.appendRow(row);

        logVolunteerInfo(`Couverture ajoutée avec succès pour ${volunteerId}`);

        return {
            success: true
        };

    } catch (error) {
        logVolunteerError('Échec ajout couverture', error);
        return {
            success: false,
            error: error.toString()
        };
    }
}

/**
 * Récupère toutes les couvertures d'un bénévole
 * @param {string} volunteerId - ID du bénévole
 * @returns {Array} Liste des couvertures
 */
function getVolunteerCoverages(volunteerId) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.COUVERTURE);

        if (!sheet) {
            throw new Error('Feuille couverture introuvable');
        }

        const data = sheet.getDataRange().getValues();
        const coverages = [];

        for (let i = 1; i < data.length; i++) {
            const row = data[i];

            if (row[COUVERTURE_COLUMNS.ID_BENEVOLE] === volunteerId) {
                coverages.push({
                    idBenevole: row[COUVERTURE_COLUMNS.ID_BENEVOLE],
                    idQuartier: row[COUVERTURE_COLUMNS.ID_QUARTIER],
                    typeCouverture: row[COUVERTURE_COLUMNS.TYPE_COUVERTURE],
                    remarques: row[COUVERTURE_COLUMNS.REMARQUES],
                    derniereMaj: row[COUVERTURE_COLUMNS.DERNIERE_MAJ]
                });
            }
        }

        return coverages;

    } catch (error) {
        logVolunteerError(`Échec récupération couvertures pour ${volunteerId}`, error);
        return [];
    }
}

/**
 * Récupère tous les bénévoles couvrant un quartier
 * @param {string} quartierId - ID du quartier
 * @param {string} type - Type de couverture (optionnel)
 * @returns {Array} Liste des bénévoles avec leurs infos
 */
function getVolunteersByQuartier(quartierId, type = null) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.COUVERTURE);

        if (!sheet) {
            throw new Error('Feuille couverture introuvable');
        }

        const data = sheet.getDataRange().getValues();
        const volunteerIds = new Set();

        for (let i = 1; i < data.length; i++) {
            const row = data[i];

            if (row[COUVERTURE_COLUMNS.ID_QUARTIER] == quartierId) {
                if (type === null || row[COUVERTURE_COLUMNS.TYPE_COUVERTURE] === type) {
                    volunteerIds.add(row[COUVERTURE_COLUMNS.ID_BENEVOLE]);
                }
            }
        }

        // Récupération des détails des bénévoles
        const volunteers = [];
        volunteerIds.forEach(volunteerId => {
            const volunteer = getVolunteerById(volunteerId);
            if (volunteer && volunteer.actif) {
                volunteers.push(volunteer);
            }
        });

        return volunteers;

    } catch (error) {
        logVolunteerError(`Échec récupération bénévoles pour quartier ${quartierId}`, error);
        return [];
    }
}

/**
 * Supprime une couverture spécifique
 * @param {string} volunteerId - ID du bénévole
 * @param {string} quartierId - ID du quartier
 * @param {string} type - Type de couverture
 * @returns {Object} {success: boolean, error?: string}
 */
function removeVolunteerCoverage(volunteerId, quartierId, type) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.COUVERTURE);

        if (!sheet) {
            throw new Error('Feuille couverture introuvable');
        }

        const data = sheet.getDataRange().getValues();
        let targetRow = -1;

        for (let i = 1; i < data.length; i++) {
            const row = data[i];

            if (row[COUVERTURE_COLUMNS.ID_BENEVOLE] === volunteerId &&
                row[COUVERTURE_COLUMNS.ID_QUARTIER] == quartierId &&
                row[COUVERTURE_COLUMNS.TYPE_COUVERTURE] === type) {
                targetRow = i + 1;
                break;
            }
        }

        if (targetRow === -1) {
            return {
                success: false,
                error: 'Couverture introuvable'
            };
        }

        sheet.deleteRow(targetRow);

        logVolunteerInfo(`Couverture supprimée: ${volunteerId} - ${quartierId} - ${type}`);

        return {
            success: true
        };

    } catch (error) {
        logVolunteerError('Échec suppression couverture', error);
        return {
            success: false,
            error: error.toString()
        };
    }
}

/**
 * Trouve une couverture spécifique
 * @param {string} volunteerId - ID du bénévole
 * @param {string} quartierId - ID du quartier
 * @param {string} type - Type de couverture
 * @returns {Object|null} Couverture ou null
 */
function findVolunteerCoverage(volunteerId, quartierId, type) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.COUVERTURE);

        if (!sheet) {
            return null;
        }

        const data = sheet.getDataRange().getValues();

        for (let i = 1; i < data.length; i++) {
            const row = data[i];

            if (row[COUVERTURE_COLUMNS.ID_BENEVOLE] === volunteerId &&
                row[COUVERTURE_COLUMNS.ID_QUARTIER] == quartierId &&
                row[COUVERTURE_COLUMNS.TYPE_COUVERTURE] === type) {
                return {
                    idBenevole: row[COUVERTURE_COLUMNS.ID_BENEVOLE],
                    idQuartier: row[COUVERTURE_COLUMNS.ID_QUARTIER],
                    typeCouverture: row[COUVERTURE_COLUMNS.TYPE_COUVERTURE],
                    remarques: row[COUVERTURE_COLUMNS.REMARQUES],
                    derniereMaj: row[COUVERTURE_COLUMNS.DERNIERE_MAJ]
                };
            }
        }

        return null;

    } catch (error) {
        logVolunteerError('Échec recherche couverture', error);
        return null;
    }
}

/**
 * Met à jour les remarques d'une couverture
 * @param {string} volunteerId - ID du bénévole
 * @param {string} quartierId - ID du quartier
 * @param {string} type - Type de couverture
 * @param {string} remarques - Nouvelles remarques
 * @returns {Object} {success: boolean, error?: string}
 */
function updateCoverageRemarks(volunteerId, quartierId, type, remarques) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.COUVERTURE);

        if (!sheet) {
            throw new Error('Feuille couverture introuvable');
        }

        const data = sheet.getDataRange().getValues();
        let targetRow = -1;

        for (let i = 1; i < data.length; i++) {
            const row = data[i];

            if (row[COUVERTURE_COLUMNS.ID_BENEVOLE] === volunteerId &&
                row[COUVERTURE_COLUMNS.ID_QUARTIER] == quartierId &&
                row[COUVERTURE_COLUMNS.TYPE_COUVERTURE] === type) {
                targetRow = i + 1;
                break;
            }
        }

        if (targetRow === -1) {
            return {
                success: false,
                error: 'Couverture introuvable'
            };
        }

        const now = formatVolunteerDateTime();
        sheet.getRange(targetRow, COUVERTURE_COLUMNS.REMARQUES + 1).setValue(remarques);
        sheet.getRange(targetRow, COUVERTURE_COLUMNS.DERNIERE_MAJ + 1).setValue(now);

        return {
            success: true
        };

    } catch (error) {
        logVolunteerError('Échec mise à jour remarques couverture', error);
        return {
            success: false,
            error: error.toString()
        };
    }
}