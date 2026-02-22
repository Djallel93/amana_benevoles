/**
 * @file volunteerService.js
 * @description CRUD service for volunteer management
 *
 * ID TYPE NOTE: Sheet stores IDs as numbers. The API receives them as strings.
 * All comparisons use String() coercion to prevent === type mismatches.
 */

function createVolunteer(volunteerData) {
    try {
        logVolunteerInfo('Creating volunteer', volunteerData);

        const validation = validateVolunteerData(volunteerData);
        if (!validation.isValid) {
            return { success: false, error: `Invalid data: ${validation.errors.join(', ')}` };
        }

        const duplicate = findVolunteerByEmail(volunteerData.email);
        if (duplicate) {
            return { success: false, error: `Email already exists (ID: ${duplicate.id})` };
        }

        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.BENEVOLES);

        if (!sheet) throw new Error('Sheet "benevoles" not found');

        const volunteerId = generateVolunteerId();
        const now = formatVolunteerDateTime();
        const normalizedPhone = normalizeVolunteerPhone(volunteerData.telephone);

        const row = Array(11).fill('');
        row[BENEVOLE_COLUMNS.ID] = volunteerId;
        row[BENEVOLE_COLUMNS.NOM] = volunteerData.nom || '';
        row[BENEVOLE_COLUMNS.PRENOM] = volunteerData.prenom || '';
        row[BENEVOLE_COLUMNS.EMAIL] = volunteerData.email || '';
        row[BENEVOLE_COLUMNS.TELEPHONE] = normalizedPhone;
        row[BENEVOLE_COLUMNS.DATE_INSCRIPTION] = now;
        row[BENEVOLE_COLUMNS.ACTIF] = true;
        row[BENEVOLE_COLUMNS.CONFIANCE] = volunteerData.confiance || false;
        row[BENEVOLE_COLUMNS.ID_VEHICULE] = volunteerData.id_vehicule || '';
        row[BENEVOLE_COLUMNS.DERNIERE_MAJ] = now;
        row[BENEVOLE_COLUMNS.STATUT] = VOLUNTEER_CONFIG.STATUS.RECU;

        sheet.appendRow(row);

        logVolunteerInfo(`Volunteer created: ${volunteerId}`);

        notifyVolunteerAdmin(
            'New volunteer registered',
            `ID: ${volunteerId}\nName: ${volunteerData.nom} ${volunteerData.prenom}\nEmail: ${volunteerData.email}\nPhone: ${normalizedPhone}`
        );

        return { success: true, volunteerId };

    } catch (error) {
        logVolunteerError('Failed to create volunteer', error);
        return { success: false, error: error.toString() };
    }
}

function getVolunteerById(volunteerId) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.BENEVOLES);

        if (!sheet) throw new Error('Sheet "benevoles" not found');

        const data = sheet.getDataRange().getValues();
        const targetId = String(volunteerId).trim();

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (String(row[BENEVOLE_COLUMNS.ID]).trim() === targetId) {
                return rowToVolunteer(row);
            }
        }

        return null;

    } catch (error) {
        logVolunteerError(`Failed to get volunteer ${volunteerId}`, error);
        return null;
    }
}

function updateVolunteer(volunteerId, updateData) {
    try {
        logVolunteerInfo(`Updating volunteer ${volunteerId}`, updateData);

        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.BENEVOLES);

        if (!sheet) throw new Error('Sheet "benevoles" not found');

        const data = sheet.getDataRange().getValues();
        const targetId = String(volunteerId).trim();
        let targetRow = -1;

        for (let i = 1; i < data.length; i++) {
            if (String(data[i][BENEVOLE_COLUMNS.ID]).trim() === targetId) {
                targetRow = i + 1;
                break;
            }
        }

        if (targetRow === -1) {
            return { success: false, error: `Volunteer ${volunteerId} not found` };
        }

        const changes = [];
        const set = (col, value, label) => {
            sheet.getRange(targetRow, col + 1).setValue(value);
            changes.push(label);
        };

        if (updateData.nom !== undefined) set(BENEVOLE_COLUMNS.NOM, updateData.nom, 'nom');
        if (updateData.prenom !== undefined) set(BENEVOLE_COLUMNS.PRENOM, updateData.prenom, 'prenom');

        if (updateData.email !== undefined) {
            if (!isValidVolunteerEmail(updateData.email)) {
                return { success: false, error: 'Invalid email' };
            }
            set(BENEVOLE_COLUMNS.EMAIL, updateData.email, 'email');
        }

        if (updateData.telephone !== undefined) {
            set(BENEVOLE_COLUMNS.TELEPHONE, normalizeVolunteerPhone(updateData.telephone), 'telephone');
        }

        if (updateData.actif !== undefined) set(BENEVOLE_COLUMNS.ACTIF, updateData.actif, 'actif');
        if (updateData.confiance !== undefined) set(BENEVOLE_COLUMNS.CONFIANCE, updateData.confiance, 'confiance');
        if (updateData.id_vehicule !== undefined) set(BENEVOLE_COLUMNS.ID_VEHICULE, updateData.id_vehicule, 'vehicule');
        if (updateData.statut !== undefined) set(BENEVOLE_COLUMNS.STATUT, updateData.statut, 'statut');

        sheet.getRange(targetRow, BENEVOLE_COLUMNS.DERNIERE_MAJ + 1).setValue(formatVolunteerDateTime());

        logVolunteerInfo(`Volunteer ${volunteerId} updated: ${changes.join(', ')}`);

        return { success: true, changes };

    } catch (error) {
        logVolunteerError(`Failed to update volunteer ${volunteerId}`, error);
        return { success: false, error: error.toString() };
    }
}

function getAllVolunteers(filters = {}) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.BENEVOLES);

        if (!sheet) throw new Error('Sheet "benevoles" not found');

        const data = sheet.getDataRange().getValues();
        const volunteers = [];

        for (let i = 1; i < data.length; i++) {
            const row = data[i];

            if (filters.actif !== undefined && row[BENEVOLE_COLUMNS.ACTIF] !== filters.actif) continue;
            if (filters.statut && row[BENEVOLE_COLUMNS.STATUT] !== filters.statut) continue;
            if (filters.confiance !== undefined && row[BENEVOLE_COLUMNS.CONFIANCE] !== filters.confiance) continue;

            volunteers.push(rowToVolunteer(row));
        }

        return volunteers;

    } catch (error) {
        logVolunteerError('Failed to get volunteers', error);
        return [];
    }
}

function findVolunteerByEmail(email) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.BENEVOLES);

        if (!sheet) return null;

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
        logVolunteerError('Failed to find volunteer by email', error);
        return null;
    }
}

function validateVolunteerData(data) {
    const errors = [];

    if (!data.nom || data.nom.trim() === '') errors.push('Nom required');
    if (!data.prenom || data.prenom.trim() === '') errors.push('Prénom required');
    if (!data.email || !isValidVolunteerEmail(data.email)) errors.push('Valid email required');
    if (!data.telephone) errors.push('Téléphone required');

    return { isValid: errors.length === 0, errors };
}

function archiveVolunteer(volunteerId) {
    return updateVolunteer(volunteerId, {
        actif: false,
        statut: VOLUNTEER_CONFIG.STATUS.ARCHIVE
    });
}

function rowToVolunteer(row) {
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