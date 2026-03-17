/**
 * @file volunteerMenu.js
 * @description Menu personnalisé Google Sheets pour la gestion des bénévoles
 */

/**
 * Crée le menu personnalisé à l'ouverture
 */
function handleOnOpen() {
    onOpenVolunteer();
}

function onOpenVolunteer() {
    const ui = SpreadsheetApp.getUi();

    ui.createMenu('👥 Gestion Bénévoles')
        .addItem('➕ Nouveau Bénévole', 'showAddVolunteerDialog')
        .addItem('✏️ Modifier Bénévole', 'showEditVolunteerDialog')
        .addSeparator()
        .addItem('📧 Demander Disponibilités', 'showRequestAvailabilityDialog')
        .addItem('📋 Briefing Mission', 'showMissionBriefingDialog')
        .addSeparator()
        .addSubMenu(createSyncMenu(ui))
        .addSubMenu(createImportMenu(ui))
        .addSubMenu(createValidationMenu(ui))
        .addSeparator()
        .addItem('📊 Statistiques', 'showVolunteerStatistics')
        .addItem('🔄 Rafraîchir Cache', 'clearVolunteerCache')
        .addToUi();
}

/**
 * Crée le sous-menu de synchronisation
 */
function createSyncMenu(ui) {
    return ui.createMenu('🔄 Synchronisation')
        .addItem('Contacts → Sheets', 'syncContactsToVolunteersMenu')
        .addItem('Sheets → Contacts', 'syncVolunteersToContactsMenu')
        .addItem('Changements récents (24h)', 'syncRecentContactChangesMenu');
}

/**
 * Crée le sous-menu d'import
 */
function createImportMenu(ui) {
    return ui.createMenu('📥 Import')
        .addItem('Créer feuille import', 'createVolunteerBulkImportSheet')
        .addItem('Traiter import (10 lignes)', 'processVolunteerBulkImportMenu')
        .addItem('Statistiques import', 'showBulkImportStats')
        .addItem('Effacer feuille import', 'clearVolunteerBulkImportSheet');
}

/**
 * Crée le sous-menu de validation
 */
function createValidationMenu(ui) {
    return ui.createMenu('✅ Validation & Tests')
        .addItem('🔍 Valider Structure Feuilles', 'validateVolunteerSheets')
        .addItem('🌐 Tester API GEO', 'testVolunteerGeoApi')
        .addItem('📋 Rapport Complet', 'showValidationReport');
}

/**
 * Affiche le dialogue d'ajout de bénévole
 * CORRECTION : Utilisation de createTemplateFromFile au lieu de createHtmlOutputFromFile
 */
function showAddVolunteerDialog() {
    const template = HtmlService.createTemplateFromFile('views/volunteer/addVolunteer');
    const html = template.evaluate()
        .setWidth(600)
        .setHeight(700);

    SpreadsheetApp.getUi().showModalDialog(html, 'Nouveau Bénévole');
}

/**
 * Affiche le dialogue de modification de bénévole
 * CORRECTION : Utilisation de createTemplateFromFile
 */
function showEditVolunteerDialog() {
    const template = HtmlService.createTemplateFromFile('views/volunteer/editVolunteer');
    const html = template.evaluate()
        .setWidth(700)
        .setHeight(750);

    SpreadsheetApp.getUi().showModalDialog(html, 'Modifier Bénévole');
}

/**
 * Affiche le dialogue de demande de disponibilités
 * CORRECTION : Utilisation de createTemplateFromFile
 */
function showRequestAvailabilityDialog() {
    const template = HtmlService.createTemplateFromFile('views/volunteer/requestAvailability');
    const html = template.evaluate()
        .setWidth(700)
        .setHeight(800);

    SpreadsheetApp.getUi().showModalDialog(html, 'Demander Disponibilités');
}

/**
 * Synchronisation Contacts → Sheets (menu)
 */
function syncContactsToVolunteersMenu() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
        'Synchronisation Contacts → Sheets',
        'Cette action mettra à jour tous les bénévoles actifs depuis Google Contacts. Continuer ?',
        ui.ButtonSet.YES_NO
    );

    if (response === ui.Button.YES) {
        const result = syncAllContactsToVolunteers();

        let message = `✅ Synchronisation terminée\n\n`;
        message += `Total: ${result.total}\n`;
        message += `Mis à jour: ${result.updated}\n`;
        message += `Inchangés: ${result.unchanged}\n`;
        message += `Échecs: ${result.failed}`;

        ui.alert('Résultat', message, ui.ButtonSet.OK);
    }
}

/**
 * Synchronisation Sheets → Contacts (menu)
 */
function syncVolunteersToContactsMenu() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
        'Synchronisation Sheets → Contacts',
        'Cette action créera/mettra à jour les contacts Google pour tous les bénévoles actifs. Continuer ?',
        ui.ButtonSet.YES_NO
    );

    if (response === ui.Button.YES) {
        const result = syncAllVolunteersToContacts();

        let message = `✅ Synchronisation terminée\n\n`;
        message += `Total: ${result.total}\n`;
        message += `Synchronisés: ${result.synced}\n`;
        message += `Échecs: ${result.failed}`;

        ui.alert('Résultat', message, ui.ButtonSet.OK);
    }
}

/**
 * Synchronisation changements récents (menu)
 */
function syncRecentContactChangesMenu() {
    const result = syncRecentContactChanges(24);

    const ui = SpreadsheetApp.getUi();
    let message = `✅ Synchronisation des changements récents (24h)\n\n`;
    message += `Contacts modifiés: ${result.total}\n`;
    message += `Mis à jour: ${result.updated}\n`;
    message += `Inchangés: ${result.unchanged}\n`;
    message += `Échecs: ${result.failed}`;

    ui.alert('Résultat', message, ui.ButtonSet.OK);
}

/**
 * Traitement import (menu)
 */
function processVolunteerBulkImportMenu() {
    const ui = SpreadsheetApp.getUi();
    const result = processVolunteerBulkImport(10);

    if (!result.success && result.message) {
        ui.alert('Erreur', result.message, ui.ButtonSet.OK);
        return;
    }

    let message = `✅ Import traité\n\n`;
    message += `Traités: ${result.processed}\n`;
    message += `Réussis: ${result.succeeded}\n`;
    message += `Échecs: ${result.failed}\n`;
    message += `Ignorés: ${result.skipped}`;

    ui.alert('Résultat Import', message, ui.ButtonSet.OK);
}

/**
 * Affiche les statistiques d'import
 */
function showBulkImportStats() {
    const stats = getVolunteerBulkImportStats();

    const ui = SpreadsheetApp.getUi();
    let message = `📊 Statistiques Import\n\n`;
    message += `Total: ${stats.total}\n`;
    message += `En attente: ${stats.pending}\n`;
    message += `En cours: ${stats.processing}\n`;
    message += `Réussis: ${stats.success}\n`;
    message += `Erreurs: ${stats.error}`;

    ui.alert('Statistiques', message, ui.ButtonSet.OK);
}

/**
 * Calcule et affiche les statistiques
 */
function showVolunteerStatistics() {
    const stats = calculateVolunteerStatistics();

    let message = `═══════════════════════════════════════\n`;
    message += `📊 STATISTIQUES BÉNÉVOLES\n`;
    message += `═══════════════════════════════════════\n\n`;

    message += `👥 BÉNÉVOLES\n`;
    message += `  Total: ${stats.total}\n`;
    message += `  Actifs: ${stats.actifs}\n`;
    message += `  Validés: ${stats.valides}\n`;
    message += `  En attente: ${stats.enAttente}\n`;
    message += `  Confiance: ${stats.confiance}\n`;
    message += `  Avec véhicule: ${stats.avecVehicule}\n\n`;

    message += `📋 DONNÉES\n`;
    message += `  Disponibilités: ${stats.totalDisponibilites}\n`;
    message += `  Couvertures: ${stats.totalCouvertures}\n`;
    message += `  Véhicules: ${stats.totalVehicules}\n\n`;

    message += `═══════════════════════════════════════\n`;

    SpreadsheetApp.getUi().alert('Statistiques', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Calcule les statistiques
 */
function calculateVolunteerStatistics() {
    const volunteers = getAllVolunteers();

    const stats = {
        total: volunteers.length,
        actifs: volunteers.filter(v => v.actif).length,
        valides: volunteers.filter(v => v.statut === VOLUNTEER_CONFIG.STATUS.VALIDE).length,
        enAttente: volunteers.filter(v => v.statut === VOLUNTEER_CONFIG.STATUS.RECU).length,
        avecVehicule: volunteers.filter(v => v.idVehicule).length,
        confiance: volunteers.filter(v => v.confiance).length,
        totalDisponibilites: 0,
        totalCouvertures: 0,
        totalVehicules: getAllVehicles().length
    };

    // Compte les disponibilités
    const dispSheet = SpreadsheetApp.getActiveSpreadsheet()
        .getSheetByName(VOLUNTEER_CONFIG.SHEETS.DISPONIBILITES);
    if (dispSheet) {
        stats.totalDisponibilites = Math.max(0, dispSheet.getLastRow() - 1);
    }

    // Compte les couvertures
    const covSheet = SpreadsheetApp.getActiveSpreadsheet()
        .getSheetByName(VOLUNTEER_CONFIG.SHEETS.COUVERTURE);
    if (covSheet) {
        stats.totalCouvertures = Math.max(0, covSheet.getLastRow() - 1);
    }

    return stats;
}

/**
 * Efface le cache
 */
function clearVolunteerCache() {
    try {
        CacheService.getScriptCache().removeAll([]);
        SpreadsheetApp.getUi().alert('✅ Cache effacé avec succès');
    } catch (error) {
        SpreadsheetApp.getUi().alert('❌ Erreur lors de l\'effacement du cache');
    }
}

/**
 * Valide la structure des feuilles
 */
function validateVolunteerSheets() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const requiredSheets = Object.values(VOLUNTEER_CONFIG.SHEETS);

    const missing = [];
    const existing = [];

    requiredSheets.forEach(sheetName => {
        const sheet = ss.getSheetByName(sheetName);
        if (sheet) {
            existing.push(`✅ ${sheetName} (${sheet.getLastRow() - 1} lignes)`);
        } else {
            missing.push(`❌ ${sheetName}`);
        }
    });

    let message = '📋 Validation Structure\n\n';
    message += existing.join('\n');

    if (missing.length > 0) {
        message += '\n\nFeuilles manquantes:\n' + missing.join('\n');
    }

    SpreadsheetApp.getUi().alert('Validation', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Teste la connexion à l'API GEO
 */
function testVolunteerGeoApi() {
    const result = testGeoApiConnection();

    const message = result.success
        ? `✅ ${result.message}`
        : `❌ ${result.message}`;

    SpreadsheetApp.getUi().alert('Test API GEO', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Opens the mission briefing dialog.
 */
function showMissionBriefingDialog() {
    const template = HtmlService.createTemplateFromFile('views/volunteer/missionBriefing');
    const html = template.evaluate()
        .setWidth(560)
        .setHeight(480);

    SpreadsheetApp.getUi().showModalDialog(html, '📋 Briefing Mission');
}
