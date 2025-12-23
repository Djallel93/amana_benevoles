/**
 * @file volunteerInitialization.js
 * @description Initialisation et validation du système
 */

/**
 * Valide la structure complète du système
 */
function validateVolunteerSystem() {
    const results = {
        overall: true,
        timestamp: new Date().toISOString(),
        checks: {
            sheets: null,
            properties: null,
            geoApi: null
        },
        summary: {
            errors: 0,
            warnings: 0
        }
    };

    // Validation des feuilles
    results.checks.sheets = validateSheetStructure();
    if (!results.checks.sheets.success) {
        results.overall = false;
        results.summary.errors += results.checks.sheets.errors.length;
    }
    results.summary.warnings += results.checks.sheets.warnings.length;

    // Validation des propriétés
    results.checks.properties = validateScriptProperties();
    if (!results.checks.properties.success) {
        results.overall = false;
        results.summary.errors += results.checks.properties.errors.length;
    }
    results.summary.warnings += results.checks.properties.warnings.length;

    // Validation API GEO
    results.checks.geoApi = testGeoApiConnection();
    if (!results.checks.geoApi.success) {
        results.overall = false;
        results.summary.errors++;
    }

    return results;
}

/**
 * Valide la structure des feuilles
 */
function validateSheetStructure() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const results = {
        success: true,
        errors: [],
        warnings: [],
        sheets: {}
    };

    const requiredSheets = Object.values(VOLUNTEER_CONFIG.SHEETS);

    requiredSheets.forEach(sheetName => {
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) {
            results.success = false;
            results.errors.push(`❌ Feuille manquante: ${sheetName}`);
            results.sheets[sheetName] = { exists: false };
        } else {
            results.sheets[sheetName] = {
                exists: true,
                rows: sheet.getLastRow(),
                columns: sheet.getLastColumn()
            };
        }
    });

    return results;
}

/**
 * Valide les propriétés de script
 */
function validateScriptProperties() {
    const properties = PropertiesService.getScriptProperties();
    const results = {
        success: true,
        errors: [],
        warnings: [],
        properties: {}
    };

    const requiredProps = [
        'GEO_API_URL',
        'GEO_API_KEY',
        'VOLUNTEER_API_KEY'
    ];

    const optionalProps = [
        'WEB_APP_URL',
        'ADMIN_EMAIL'
    ];

    requiredProps.forEach(prop => {
        const value = properties.getProperty(prop);
        if (!value) {
            results.success = false;
            results.errors.push(`❌ Propriété manquante: ${prop}`);
            results.properties[prop] = { exists: false, required: true };
        } else {
            results.properties[prop] = { exists: true, required: true };
        }
    });

    optionalProps.forEach(prop => {
        const value = properties.getProperty(prop);
        if (!value) {
            results.warnings.push(`⚠️ Propriété optionnelle non définie: ${prop}`);
            results.properties[prop] = { exists: false, required: false };
        } else {
            results.properties[prop] = { exists: true, required: false };
        }
    });

    return results;
}

/**
 * Affiche un rapport de validation complet
 */
function showValidationReport() {
    const results = validateVolunteerSystem();

    let message = `═══════════════════════════════════════\n`;
    message += `📊 RAPPORT DE VALIDATION SYSTÈME\n`;
    message += `═══════════════════════════════════════\n\n`;
    message += `Timestamp: ${results.timestamp}\n`;
    message += `Statut Global: ${results.overall ? '✅ OK' : '❌ ERREURS'}\n`;
    message += `Erreurs: ${results.summary.errors} | Avertissements: ${results.summary.warnings}\n\n`;

    // Feuilles
    message += `📋 FEUILLES\n`;
    message += `${results.checks.sheets.success ? '✅' : '❌'} Statut: ${results.checks.sheets.success ? 'OK' : 'Erreurs'}\n`;
    if (results.checks.sheets.errors.length > 0) {
        results.checks.sheets.errors.forEach(err => message += `  ${err}\n`);
    }
    message += '\n';

    // Propriétés
    message += `🔑 PROPRIÉTÉS\n`;
    message += `${results.checks.properties.success ? '✅' : '❌'} Statut: ${results.checks.properties.success ? 'OK' : 'Erreurs'}\n`;
    if (results.checks.properties.errors.length > 0) {
        results.checks.properties.errors.forEach(err => message += `  ${err}\n`);
    }
    message += '\n';

    // API GEO
    message += `🌐 API GEO\n`;
    message += `  ${results.checks.geoApi.message}\n\n`;

    message += `═══════════════════════════════════════\n`;

    SpreadsheetApp.getUi().alert('Rapport de Validation', message, SpreadsheetApp.getUi().ButtonSet.OK);
}