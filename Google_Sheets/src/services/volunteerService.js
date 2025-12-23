/**
 * @file volunteerService.js
 * @description Service de gestion CRUD des bénévoles
 */

/**
 * Crée un nouveau bénévole
 * @param {Object} volunteerData - Données du bénévole
 * @returns {Object} {success: boolean, volunteerId?: string, error?: string}
 */
function createVolunteer(volunteerData) {
    try {
        logVolunteerInfo('Création d\'un nouveau bénévole', volunteerData);

        // Validation des données requises
        const validation = validateVolunteerData(volunteerData);
        if (!validation.isValid) {
            return {
                success: false,
                error: `Données invalides: ${validation.errors.join(', ')}`
            };
        }

        // Vérification des doublons (email)
        const duplicate = findVolunteerByEmail(volunteerData.email);
        if (duplicate) {
            return {
                success: false,
                error: `Un bénévole avec l'email ${volunteerData.email} existe déjà (ID: ${duplicate.id})`
            };
        }

        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.BENEVOLES);

        if (!sheet) {
            throw new Error('Feuille benevoles introuvable');
        }

        // Génération de l'ID
        const volunteerId = generateVolunteerId();
        const now = formatVolunteerDateTime();

        // Normalisation du téléphone
        const normalizedPhone = normalizeVolunteerPhone(volunteerData.telephone);

        // Construction de la ligne
        const row = [
            volunteerId,
            volunteerData.nom || '',
            volunteerData.prenom || '',
            volunteerData.email || '',
            normalizedPhone,
            now, // date_inscription
            true, // actif par défaut
            volunteerData.confiance || false,
            volunteerData.id_vehicule || '',
            now, // derniere_maj
            VOLUNTEER_CONFIG.STATUS.RECU // statut initial
        ];

        // Ajout de la ligne
        sheet.appendRow(row);

        logVolunteerInfo(`Bénévole créé avec succès: ${volunteerId}`);

        // Notification admin
        notifyVolunteerAdmin(
            'Nouveau bénévole inscrit',
            `ID: ${volunteerId}\nNom: ${volunteerData.nom} ${volunteerData.prenom}\nEmail: ${volunteerData.email}\nTéléphone: ${normalizedPhone}`
        );

        return {
            success: true,
            volunteerId: volunteerId
        };

    } catch (error) {
        logVolunteerError('Échec création bénévole', error);
        return {
            success: false,
            error: error.toString()
        };
    }
}

/**
 * Récupère un bénévole par ID
 * @param {string} volunteerId - ID du bénévole
 * @returns {Object|null} Données du bénévole ou null
 */
function getVolunteerById(volunteerId) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.BENEVOLES);

        if (!sheet) {
            throw new Error('Feuille benevoles introuvable');
        }

        const data = sheet.getDataRange().getValues();

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (row[BENEVOLE_COLUMNS.ID] === volunteerId) {
                return {
                    id: row[BENEVOLE_COLUMNS.ID],
                    nom: row[BENEVOLE_COLUMNS.NOM],
                    prenom: row[BENEVOLE_COLUMNS.PRENOM],
                    email: row[BENEVOLE_COLUMNS.EMAIL],
                    telephone: row[BENEVOLE_COLUMNS.TELEPHONE],
                    dateInscription: row[BENEVOLE_COLUMNS.DATE_INSCRIPTION],
                    actif: row[BENEVOLE_COLUMNS.ACTIF],
                    confiance: row[BENEVOLE_COLUMNS.CONFIANCE],
                    idVehicule: row[BENEVOLE_COLUMNS.ID_VEHICULE],
                    derniereMaj: row[BENEVOLE_COLUMNS.DERNIERE_MAJ],
                    statut: row[BENEVOLE_COLUMNS.STATUT]
                };
            }
        }

        return null;

    } catch (error) {
        logVolunteerError(`Échec récupération bénévole ${volunteerId}`, error);
        return null;
    }
}

/**
 * Met à jour un bénévole existant
 * @param {string} volunteerId - ID du bénévole
 * @param {Object} updateData - Données à mettre à jour
 * @returns {Object} {success: boolean, error?: string}
 */
function updateVolunteer(volunteerId, updateData) {
    try {
        logVolunteerInfo(`Mise à jour bénévole ${volunteerId}`, updateData);

        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.BENEVOLES);

        if (!sheet) {
            throw new Error('Feuille benevoles introuvable');
        }

        const data = sheet.getDataRange().getValues();
        let targetRow = -1;

        // Recherche de la ligne
        for (let i = 1; i < data.length; i++) {
            if (data[i][BENEVOLE_COLUMNS.ID] === volunteerId) {
                targetRow = i + 1; // 1-based
                break;
            }
        }

        if (targetRow === -1) {
            return {
                success: false,
                error: `Bénévole ${volunteerId} introuvable`
            };
        }

        const changes = [];

        // Mise à jour des champs
        if (updateData.nom !== undefined) {
            sheet.getRange(targetRow, BENEVOLE_COLUMNS.NOM + 1).setValue(updateData.nom);
            changes.push('nom');
        }

        if (updateData.prenom !== undefined) {
            sheet.getRange(targetRow, BENEVOLE_COLUMNS.PRENOM + 1).setValue(updateData.prenom);
            changes.push('prenom');
        }

        if (updateData.email !== undefined) {
            if (!isValidVolunteerEmail(updateData.email)) {
                return { success: false, error: 'Email invalide' };
            }
            sheet.getRange(targetRow, BENEVOLE_COLUMNS.EMAIL + 1).setValue(updateData.email);
            changes.push('email');
        }

        if (updateData.telephone !== undefined) {
            const normalized = normalizeVolunteerPhone(updateData.telephone);
            sheet.getRange(targetRow, BENEVOLE_COLUMNS.TELEPHONE + 1).setValue(normalized);
            changes.push('telephone');
        }

        if (updateData.actif !== undefined) {
            sheet.getRange(targetRow, BENEVOLE_COLUMNS.ACTIF + 1).setValue(updateData.actif);
            changes.push('actif');
        }

        if (updateData.confiance !== undefined) {
            sheet.getRange(targetRow, BENEVOLE_COLUMNS.CONFIANCE + 1).setValue(updateData.confiance);
            changes.push('confiance');
        }

        if (updateData.id_vehicule !== undefined) {
            sheet.getRange(targetRow, BENEVOLE_COLUMNS.ID_VEHICULE + 1).setValue(updateData.id_vehicule);
            changes.push('vehicule');
        }

        if (updateData.statut !== undefined) {
            sheet.getRange(targetRow, BENEVOLE_COLUMNS.STATUT + 1).setValue(updateData.statut);
            changes.push('statut');
        }

        // Mise à jour du timestamp
        const now = formatVolunteerDateTime();
        sheet.getRange(targetRow, BENEVOLE_COLUMNS.DERNIERE_MAJ + 1).setValue(now);

        logVolunteerInfo(`Bénévole ${volunteerId} mis à jour: ${changes.join(', ')}`);

        return {
            success: true,
            changes: changes
        };

    } catch (error) {
        logVolunteerError(`Échec mise à jour bénévole ${volunteerId}`, error);
        return {
            success: false,
            error: error.toString()
        };
    }
}

/**
 * Récupère tous les bénévoles avec filtrage optionnel
 * @param {Object} filters - Filtres optionnels {actif, statut, confiance}
 * @returns {Array} Liste des bénévoles
 */
function getAllVolunteers(filters = {}) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.BENEVOLES);

        if (!sheet) {
            throw new Error('Feuille benevoles introuvable');
        }

        const data = sheet.getDataRange().getValues();
        const volunteers = [];

        for (let i = 1; i < data.length; i++) {
            const row = data[i];

            // Application des filtres
            if (filters.actif !== undefined && row[BENEVOLE_COLUMNS.ACTIF] !== filters.actif) {
                continue;
            }

            if (filters.statut && row[BENEVOLE_COLUMNS.STATUT] !== filters.statut) {
                continue;
            }

            if (filters.confiance !== undefined && row[BENEVOLE_COLUMNS.CONFIANCE] !== filters.confiance) {
                continue;
            }

            volunteers.push({
                id: row[BENEVOLE_COLUMNS.ID],
                nom: row[BENEVOLE_COLUMNS.NOM],
                prenom: row[BENEVOLE_COLUMNS.PRENOM],
                email: row[BENEVOLE_COLUMNS.EMAIL],
                telephone: row[BENEVOLE_COLUMNS.TELEPHONE],
                dateInscription: row[BENEVOLE_COLUMNS.DATE_INSCRIPTION],
                actif: row[BENEVOLE_COLUMNS.ACTIF],
                confiance: row[BENEVOLE_COLUMNS.CONFIANCE],
                idVehicule: row[BENEVOLE_COLUMNS.ID_VEHICULE],
                derniereMaj: row[BENEVOLE_COLUMNS.DERNIERE_MAJ],
                statut: row[BENEVOLE_COLUMNS.STATUT]
            });
        }

        return volunteers;

    } catch (error) {
        logVolunteerError('Échec récupération liste bénévoles', error);
        return [];
    }
}

/**
 * Trouve un bénévole par email
 * @param {string} email - Email du bénévole
 * @returns {Object|null} Bénévole ou null
 */
function findVolunteerByEmail(email) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.BENEVOLES);

        if (!sheet) {
            return null;
        }

        const data = sheet.getDataRange().getValues();

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (row[BENEVOLE_COLUMNS.EMAIL] === email) {
                return {
                    id: row[BENEVOLE_COLUMNS.ID],
                    nom: row[BENEVOLE_COLUMNS.NOM],
                    prenom: row[BENEVOLE_COLUMNS.PRENOM],
                    email: row[BENEVOLE_COLUMNS.EMAIL],
                    statut: row[BENEVOLE_COLUMNS.STATUT]
                };
            }
        }

        return null;

    } catch (error) {
        logVolunteerError('Échec recherche bénévole par email', error);
        return null;
    }
}

/**
 * Valide les données d'un bénévole
 * @param {Object} data - Données à valider
 * @returns {Object} {isValid: boolean, errors: Array}
 */
function validateVolunteerData(data) {
    const errors = [];

    if (!data.nom || data.nom.trim() === '') {
        errors.push('Nom requis');
    }

    if (!data.prenom || data.prenom.trim() === '') {
        errors.push('Prénom requis');
    }

    if (!data.email || !isValidVolunteerEmail(data.email)) {
        errors.push('Email valide requis');
    }

    if (!data.telephone) {
        errors.push('Téléphone requis');
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

/**
 * Archive un bénévole (le marque comme inactif et archivé)
 * @param {string} volunteerId - ID du bénévole
 * @returns {Object} {success: boolean, error?: string}
 */
function archiveVolunteer(volunteerId) {
    return updateVolunteer(volunteerId, {
        actif: false,
        statut: VOLUNTEER_CONFIG.STATUS.ARCHIVE
    });
}