/**
 * @file helpers.js
 * @description Fonctions d'aide pour l'interface utilisateur
 */

/**
 * Affiche une boîte de dialogue HTML personnalisée
 * @param {string} title - Titre de la dialog
 * @param {string} htmlFile - Nom du fichier HTML
 * @param {number} width - Largeur
 * @param {number} height - Hauteur
 */
function showHtmlDialog(title, htmlFile, width = 600, height = 500) {
    try {
        const html = HtmlService.createHtmlOutputFromFile(htmlFile)
            .setWidth(width)
            .setHeight(height);

        SpreadsheetApp.getUi().showModalDialog(html, title);

    } catch (error) {
        logVolunteerError(`Échec affichage dialog: ${htmlFile}`, error);
        showErrorAlert('Erreur d\'affichage', error.toString());
    }
}

/**
 * Affiche une alerte simple
 * @param {string} title - Titre
 * @param {string} message - Message
 * @param {string} type - Type (info, warning, error)
 */
function showAlert(title, message, type = 'info') {
    const ui = SpreadsheetApp.getUi();

    let icon = '📋';
    if (type === 'warning') icon = '⚠️';
    if (type === 'error') icon = '❌';
    if (type === 'success') icon = '✅';

    ui.alert(`${icon} ${title}`, message, ui.ButtonSet.OK);
}

/**
 * Affiche une alerte d'erreur
 * @param {string} title - Titre
 * @param {string} error - Message d'erreur
 */
function showErrorAlert(title, error) {
    showAlert(title, error, 'error');
}

/**
 * Affiche une alerte de succès
 * @param {string} title - Titre
 * @param {string} message - Message
 */
function showSuccessAlert(title, message) {
    showAlert(title, message, 'success');
}

/**
 * Affiche une boîte de confirmation
 * @param {string} title - Titre
 * @param {string} message - Message
 * @returns {boolean} True si confirmé
 */
function showConfirmDialog(title, message) {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(title, message, ui.ButtonSet.YES_NO);
    return response === ui.Button.YES;
}

/**
 * Affiche une sidebar HTML
 * @param {string} htmlFile - Nom du fichier HTML
 * @param {string} title - Titre de la sidebar
 */
function showSidebar(htmlFile, title) {
    try {
        const html = HtmlService.createHtmlOutputFromFile(htmlFile)
            .setTitle(title);

        SpreadsheetApp.getUi().showSidebar(html);

    } catch (error) {
        logVolunteerError(`Échec affichage sidebar: ${htmlFile}`, error);
        showErrorAlert('Erreur d\'affichage', error.toString());
    }
}

/**
 * Affiche un toast (notification temporaire)
 * @param {string} message - Message
 * @param {string} title - Titre (optionnel)
 * @param {number} timeout - Durée en secondes
 */
function showToast(message, title = '', timeout = 5) {
    try {
        SpreadsheetApp.getActiveSpreadsheet().toast(message, title, timeout);
    } catch (error) {
        logVolunteerError('Échec affichage toast', error);
    }
}

/**
 * Met en surbrillance une cellule ou une plage
 * @param {string} sheetName - Nom de la feuille
 * @param {string} range - Plage (ex: 'A1:B2')
 * @param {string} color - Couleur (ex: '#ffff00')
 */
function highlightRange(sheetName, range, color = '#ffff00') {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
        if (sheet) {
            sheet.getRange(range).setBackground(color);
        }
    } catch (error) {
        logVolunteerError('Échec mise en surbrillance', error);
    }
}

/**
 * Scroll vers une ligne spécifique
 * @param {string} sheetName - Nom de la feuille
 * @param {number} row - Numéro de ligne
 */
function scrollToRow(sheetName, row) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
        if (sheet) {
            sheet.setActiveRange(sheet.getRange(row, 1));
        }
    } catch (error) {
        logVolunteerError('Échec scroll vers ligne', error);
    }
}

/**
 * Crée un menu déroulant dans une cellule
 * @param {string} sheetName - Nom de la feuille
 * @param {string} range - Plage
 * @param {Array} values - Valeurs du menu
 */
function createDropdown(sheetName, range, values) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
        if (sheet) {
            const rule = SpreadsheetApp.newDataValidation()
                .requireValueInList(values, true)
                .build();
            sheet.getRange(range).setDataValidation(rule);
        }
    } catch (error) {
        logVolunteerError('Échec création dropdown', error);
    }
}

/**
 * Formate une plage comme tableau
 * @param {string} sheetName - Nom de la feuille
 * @param {string} range - Plage
 */
function formatAsTable(sheetName, range) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
        if (sheet) {
            const rangeObj = sheet.getRange(range);

            // En-tête
            rangeObj.getCell(1, 1).setBackground('#4285f4')
                .setFontColor('#ffffff')
                .setFontWeight('bold');

            // Bordures
            rangeObj.setBorder(true, true, true, true, true, true);

            // Lignes alternées
            rangeObj.applyRowBanding();
        }
    } catch (error) {
        logVolunteerError('Échec formatage tableau', error);
    }
}

/**
 * Exporte une feuille en CSV
 * @param {string} sheetName - Nom de la feuille
 * @returns {Blob} Blob CSV
 */
function exportSheetToCsv(sheetName) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(sheetName);

        if (!sheet) {
            throw new Error(`Feuille ${sheetName} introuvable`);
        }

        const data = sheet.getDataRange().getValues();
        const csv = data.map(row => row.join(',')).join('\n');

        return Utilities.newBlob(csv, 'text/csv', `${sheetName}.csv`);

    } catch (error) {
        logVolunteerError('Échec export CSV', error);
        return null;
    }
}

/**
 * Crée un lien hypertexte dans une cellule
 * @param {string} sheetName - Nom de la feuille
 * @param {string} cell - Cellule (ex: 'A1')
 * @param {string} url - URL
 * @param {string} text - Texte affiché
 */
function createHyperlink(sheetName, cell, url, text) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
        if (sheet) {
            const formula = `=HYPERLINK("${url}", "${text}")`;
            sheet.getRange(cell).setFormula(formula);
        }
    } catch (error) {
        logVolunteerError('Échec création hyperlien', error);
    }
}

/**
 * Protège une plage contre la modification
 * @param {string} sheetName - Nom de la feuille
 * @param {string} range - Plage
 * @param {string} description - Description
 */
function protectRange(sheetName, range, description = '') {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
        if (sheet) {
            const protection = sheet.getRange(range).protect();
            protection.setDescription(description);

            // Seuls les éditeurs peuvent modifier
            const me = Session.getEffectiveUser();
            protection.addEditor(me);
            protection.removeEditors(protection.getEditors());

            if (protection.canDomainEdit()) {
                protection.setDomainEdit(false);
            }
        }
    } catch (error) {
        logVolunteerError('Échec protection plage', error);
    }
}

/**
 * Affiche une barre de progression (via toast)
 * @param {number} current - Valeur actuelle
 * @param {number} total - Valeur totale
 * @param {string} message - Message
 */
function showProgress(current, total, message = 'Progression') {
    const percent = Math.round((current / total) * 100);
    const bar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5));
    showToast(`${message}: ${bar} ${percent}%`, 'Traitement', 2);
}

/**
 * Efface le contenu d'une plage sans supprimer les formules
 * @param {string} sheetName - Nom de la feuille
 * @param {string} range - Plage
 */
function clearRangeContent(sheetName, range) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
        if (sheet) {
            sheet.getRange(range).clearContent();
        }
    } catch (error) {
        logVolunteerError('Échec effacement contenu', error);
    }
}

/**
 * Copie le format d'une plage vers une autre
 * @param {string} sheetName - Nom de la feuille
 * @param {string} sourceRange - Plage source
 * @param {string} targetRange - Plage cible
 */
function copyFormat(sheetName, sourceRange, targetRange) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
        if (sheet) {
            const source = sheet.getRange(sourceRange);
            const target = sheet.getRange(targetRange);
            source.copyFormatToRange(sheet, target.getColumn(),
                target.getLastColumn(), target.getRow(), target.getLastRow());
        }
    } catch (error) {
        logVolunteerError('Échec copie format', error);
    }
}

/**
 * Fonction globale pour inclure des fichiers HTML dans les templates
 * Utilisée par les balises <?!= include('filename') ?> dans les fichiers HTML
 * @param {string} filename - Nom du fichier à inclure
 * @returns {string} Contenu du fichier
 */
function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
}