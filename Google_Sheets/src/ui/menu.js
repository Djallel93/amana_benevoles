/**
 * @file volunteerMenu.js
 * @description Menu personnalisé Google Sheets pour la gestion des bénévoles
 */

/**
 * Crée le menu personnalisé à l'ouverture
 */
function onOpenVolunteer() {
    const ui = SpreadsheetApp.getUi();
    
    ui.createMenu('👥 Gestion Bénévoles')
        .addItem('➕ Nouveau Bénévole', 'showAddVolunteerDialog')
        .addItem('✏️ Modifier Bénévole', 'showEditVolunteerDialog')
        .addSeparator()
        .addItem('📧 Demander Disponibilités', 'showRequestAvailabilityDialog')
        .addSeparator()
        .addSubMenu(createValidationMenu(ui))
        .addSeparator()
        .addItem('🔄 Rafraîchir Cache', 'clearVolunteerCache')
        .addToUi();
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
 */
function showAddVolunteerDialog() {
    const html = HtmlService.createHtmlOutputFromFile('views/volunteer/addVolunteer')
        .setWidth(600)
        .setHeight(700)
        .setTitle('Nouveau Bénévole');
    
    SpreadsheetApp.getUi().showModalDialog(html, 'Nouveau Bénévole');
}

/**
 * Affiche le dialogue de modification de bénévole
 */
function showEditVolunteerDialog() {
    const html = HtmlService.createHtmlOutputFromFile('views/volunteer/editVolunteer')
        .setWidth(600)
        .setHeight(700)
        .setTitle('Modifier Bénévole');
    
    SpreadsheetApp.getUi().showModalDialog(html, 'Modifier Bénévole');
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
        stats.totalDisponibilites = dispSheet.getLastRow() - 1;
    }
    
    // Compte les couvertures
    const covSheet = SpreadsheetApp.getActiveSpreadsheet()
        .getSheetByName(VOLUNTEER_CONFIG.SHEETS.COUVERTURE);
    if (covSheet) {
        stats.totalCouvertures = covSheet.getLastRow() - 1;
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
            existing.push(`✅ ${sheetName}`);
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