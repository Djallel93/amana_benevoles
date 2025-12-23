/**
 * @file volunteerBulkImport.js
 * @description Import en masse de bénévoles depuis CSV
 */

const VOLUNTEER_BULK_SHEET = 'Bulk_Import_Benevoles';

/**
 * Crée la feuille d'import en masse si elle n'existe pas
 */
function createVolunteerBulkImportSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(VOLUNTEER_BULK_SHEET);

    if (!sheet) {
        sheet = ss.insertSheet(VOLUNTEER_BULK_SHEET);

        // En-têtes
        const headers = [
            'nom',
            'prenom',
            'email',
            'telephone',
            'id_vehicule',
            'confiance',
            'statut_import',
            'commentaire'
        ];

        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
        sheet.setFrozenRows(1);

        logVolunteerInfo('Feuille bulk import créée');
    }

    return sheet;
}

/**
 * Traite l'import en masse
 * @param {number} batchSize - Nombre de lignes à traiter
 * @returns {Object} Résultats de l'import
 */
function processVolunteerBulkImport(batchSize = 10) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(VOLUNTEER_BULK_SHEET);

    if (!sheet) {
        return {
            success: false,
            message: `Feuille ${VOLUNTEER_BULK_SHEET} introuvable. Créez-la via le menu.`
        };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
        return {
            success: false,
            message: 'Aucune donnée à importer'
        };
    }

    const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    const results = {
        success: true,
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        errors: []
    };

    // Traiter uniquement les lignes en attente
    let processed = 0;
    for (let i = 0; i < data.length && processed < batchSize; i++) {
        const row = data[i];
        const rowNumber = i + 2; // +2 car header + index 0-based

        const statut = row[6]; // statut_import

        // Ignorer les lignes déjà traitées
        if (statut && statut !== 'En attente') {
            results.skipped++;
            continue;
        }

        // Marquer comme en cours
        sheet.getRange(rowNumber, 7).setValue('⚙️ En cours...');
        SpreadsheetApp.flush();

        const volunteerData = {
            nom: row[0],
            prenom: row[1],
            email: row[2],
            telephone: row[3],
            id_vehicule: row[4] || null,
            confiance: row[5] === true || row[5] === 'true' || row[5] === 'TRUE'
        };

        // Validation basique
        if (!volunteerData.nom || !volunteerData.prenom || !volunteerData.email || !volunteerData.telephone) {
            sheet.getRange(rowNumber, 7).setValue('❌ Erreur');
            sheet.getRange(rowNumber, 8).setValue('Champs requis manquants');
            results.failed++;
            results.errors.push({ row: rowNumber, error: 'Champs manquants' });
            processed++;
            continue;
        }

        // Tentative de création
        const result = createVolunteer(volunteerData);

        if (result.success) {
            sheet.getRange(rowNumber, 7).setValue('✅ Créé');
            sheet.getRange(rowNumber, 8).setValue(`ID: ${result.volunteerId}`);
            results.succeeded++;
        } else {
            sheet.getRange(rowNumber, 7).setValue('❌ Erreur');
            sheet.getRange(rowNumber, 8).setValue(result.error);
            results.failed++;
            results.errors.push({ row: rowNumber, error: result.error });
        }

        processed++;
        results.processed++;
    }

    logVolunteerInfo('Import en masse terminé', results);

    if (results.succeeded > 0) {
        notifyVolunteerAdmin(
            'Import bénévoles terminé',
            `Traités: ${results.processed}\nRéussis: ${results.succeeded}\nÉchecs: ${results.failed}`
        );
    }

    return results;
}

/**
 * Efface la feuille d'import
 */
function clearVolunteerBulkImportSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(VOLUNTEER_BULK_SHEET);

    if (!sheet) {
        return { success: false, message: 'Feuille introuvable' };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
    }

    return { success: true, message: 'Feuille effacée' };
}

/**
 * Obtient les statistiques d'import
 */
function getVolunteerBulkImportStats() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(VOLUNTEER_BULK_SHEET);

    if (!sheet) {
        return {
            total: 0,
            pending: 0,
            processing: 0,
            success: 0,
            error: 0
        };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
        return {
            total: 0,
            pending: 0,
            processing: 0,
            success: 0,
            error: 0
        };
    }

    const data = sheet.getRange(2, 7, lastRow - 1, 1).getValues();

    const stats = {
        total: lastRow - 1,
        pending: 0,
        processing: 0,
        success: 0,
        error: 0
    };

    data.forEach(row => {
        const statut = row[0];
        if (!statut || statut === 'En attente') {
            stats.pending++;
        } else if (statut.includes('En cours')) {
            stats.processing++;
        } else if (statut.includes('✅')) {
            stats.success++;
        } else if (statut.includes('❌')) {
            stats.error++;
        }
    });

    return stats;
}