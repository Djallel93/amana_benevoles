/**
 * @file editHandler.js
 * @description Gestion des modifications dans Google Sheets et synchronisation avec Contacts
 */

function onEditVolunteerSheet(e) {
    try {
        if (!e) return;

        const range = e.range;
        const sheet = range.getSheet();

        if (sheet.getName() !== VOLUNTEER_CONFIG.SHEETS.BENEVOLES) return;

        const row = range.getRow();
        const col = range.getColumn();

        if (row === 1) return;

        const volunteerId = sheet.getRange(row, BENEVOLE_COLUMNS.ID + 1).getValue();

        if (!volunteerId) {
            logVolunteerWarning('Modification sur une ligne sans ID bénévole', { row });
            return;
        }

        if (col === BENEVOLE_COLUMNS.STATUT + 1) {
            handleStatusChange(volunteerId, sheet, row);
        } else if (isRelevantFieldChange(col)) {
            handleFieldChange(volunteerId, sheet, row, col);
        }

    } catch (error) {
        logVolunteerError('Erreur dans onEditVolunteerSheet', error);
    }
}

function handleStatusChange(volunteerId, sheet, row) {
    try {
        const newStatus = sheet.getRange(row, BENEVOLE_COLUMNS.STATUT + 1).getValue();

        logVolunteerInfo(`Changement de statut pour ${volunteerId}: ${newStatus}`);

        switch (newStatus) {
            case VOLUNTEER_CONFIG.STATUS.VALIDE:
                handleValidationStatus(volunteerId, sheet, row);
                break;

            case VOLUNTEER_CONFIG.STATUS.REJETE:
            case VOLUNTEER_CONFIG.STATUS.ARCHIVE:
                handleRejectionOrArchive(volunteerId, newStatus);
                break;

            default:
                logVolunteerInfo(`Statut ${newStatus} ne nécessite pas d'action spéciale`);
        }

    } catch (error) {
        logVolunteerError(`Erreur gestion changement statut pour ${volunteerId}`, error);
    }
}

function handleValidationStatus(volunteerId, sheet, row) {
    try {
        const volunteerData = {
            id: volunteerId,
            nom: sheet.getRange(row, BENEVOLE_COLUMNS.NOM + 1).getValue(),
            prenom: sheet.getRange(row, BENEVOLE_COLUMNS.PRENOM + 1).getValue(),
            email: sheet.getRange(row, BENEVOLE_COLUMNS.EMAIL + 1).getValue(),
            telephone: sheet.getRange(row, BENEVOLE_COLUMNS.TELEPHONE + 1).getValue(),
            dateInscription: sheet.getRange(row, BENEVOLE_COLUMNS.DATE_INSCRIPTION + 1).getValue(),
            actif: sheet.getRange(row, BENEVOLE_COLUMNS.ACTIF + 1).getValue(),
            confiance: sheet.getRange(row, BENEVOLE_COLUMNS.CONFIANCE + 1).getValue(),
            idVehicule: sheet.getRange(row, BENEVOLE_COLUMNS.ID_VEHICULE + 1).getValue()
        };

        const validation = validateVolunteerForContact(volunteerData);

        if (!validation.isValid) {
            sheet.getRange(row, BENEVOLE_COLUMNS.STATUT + 1).setValue(VOLUNTEER_CONFIG.STATUS.EN_COURS);

            const message = `❌ Validation impossible pour ${volunteerId}:\n${validation.errors.join('\n')}`;
            SpreadsheetApp.getUi().alert('Validation impossible', message, SpreadsheetApp.getUi().ButtonSet.OK);

            logVolunteerWarning(`Validation annulée pour ${volunteerId}`, validation.errors);
            return;
        }

        // Sync Google Contact
        const result = syncVolunteerToContact(volunteerId);

        if (result.success) {
            logVolunteerInfo(`Contact créé/mis à jour pour ${volunteerId}`, result);

            // Send welcome email
            sendWelcomeEmail(volunteerData);

            notifyVolunteerAdmin(
                'Bénévole validé',
                `Le bénévole ${volunteerData.prenom} ${volunteerData.nom} (${volunteerId}) a été validé.\nContact Google synchronisé.\nEmail de bienvenue envoyé.`
            );

            showToast(`✅ Bénévole validé, contact créé, email envoyé`, volunteerId, 5);

        } else {
            logVolunteerError(`Échec sync contact pour ${volunteerId}`, result.error);

            // Still send the welcome email even if contact sync failed
            sendWelcomeEmail(volunteerData);
            logVolunteerInfo(`Email de bienvenue envoyé malgré l'échec de sync pour ${volunteerId}`);

            SpreadsheetApp.getUi().alert(
                'Erreur synchronisation',
                `Le statut a été mis à jour et l'email de bienvenue envoyé, mais la synchronisation avec Google Contacts a échoué:\n${result.error}`,
                SpreadsheetApp.getUi().ButtonSet.OK
            );
        }

    } catch (error) {
        logVolunteerError(`Erreur validation ${volunteerId}`, error);
    }
}

function handleRejectionOrArchive(volunteerId, newStatus) {
    try {
        const volunteer = getVolunteerById(volunteerId);

        if (!volunteer) {
            logVolunteerWarning(`Bénévole ${volunteerId} introuvable`);
            return;
        }

        const result = deleteVolunteerContact(volunteerId);

        if (result.success) {
            logVolunteerInfo(`Contact Google supprimé pour ${volunteerId}`);

            notifyVolunteerAdmin(
                `Bénévole ${newStatus === VOLUNTEER_CONFIG.STATUS.REJETE ? 'rejeté' : 'archivé'}`,
                `Le bénévole ${volunteer.prenom} ${volunteer.nom} (${volunteerId}) a été ${newStatus === VOLUNTEER_CONFIG.STATUS.REJETE ? 'rejeté' : 'archivé'}.\nContact Google supprimé.`
            );

            showToast(`Contact supprimé pour ${volunteerId}`, newStatus, 3);

        } else if (result.error && !result.error.includes('introuvable')) {
            logVolunteerWarning(`Impossible de supprimer contact pour ${volunteerId}`, result.error);
        }

    } catch (error) {
        logVolunteerError(`Erreur rejet/archivage ${volunteerId}`, error);
    }
}

function handleFieldChange(volunteerId, sheet, row, col) {
    try {
        const status = sheet.getRange(row, BENEVOLE_COLUMNS.STATUT + 1).getValue();

        if (status !== VOLUNTEER_CONFIG.STATUS.VALIDE) return;

        sheet.getRange(row, BENEVOLE_COLUMNS.DERNIERE_MAJ + 1).setValue(formatVolunteerDateTime());

        const result = syncVolunteerToContact(volunteerId);

        if (result.success) {
            logVolunteerInfo(`Contact mis à jour pour ${volunteerId} après modification`);
        } else {
            logVolunteerWarning(`Échec mise à jour contact pour ${volunteerId}`, result.error);
        }

    } catch (error) {
        logVolunteerError(`Erreur modification champ pour ${volunteerId}`, error);
    }
}

function isRelevantFieldChange(col) {
    const relevantColumns = [
        BENEVOLE_COLUMNS.NOM + 1,
        BENEVOLE_COLUMNS.PRENOM + 1,
        BENEVOLE_COLUMNS.EMAIL + 1,
        BENEVOLE_COLUMNS.TELEPHONE + 1,
        BENEVOLE_COLUMNS.ACTIF + 1,
        BENEVOLE_COLUMNS.CONFIANCE + 1,
        BENEVOLE_COLUMNS.ID_VEHICULE + 1
    ];

    return relevantColumns.includes(col);
}

function validateVolunteerForContact(volunteerData) {
    const errors = [];

    if (!volunteerData.nom || String(volunteerData.nom).trim() === '')
        errors.push('Nom requis');

    if (!volunteerData.prenom || String(volunteerData.prenom).trim() === '')
        errors.push('Prénom requis');

    if (!volunteerData.email || !isValidVolunteerEmail(volunteerData.email))
        errors.push('Email valide requis');

    if (!volunteerData.telephone || String(volunteerData.telephone).trim() === '')
        errors.push('Téléphone requis');

    if (!volunteerData.dateInscription)
        errors.push('Date d\'inscription requise');

    if (volunteerData.actif === '' || volunteerData.actif === null || volunteerData.actif === undefined)
        errors.push('Statut actif requis');

    if (volunteerData.confiance === '' || volunteerData.confiance === null || volunteerData.confiance === undefined)
        errors.push('Statut confiance requis');

    return { isValid: errors.length === 0, errors };
}