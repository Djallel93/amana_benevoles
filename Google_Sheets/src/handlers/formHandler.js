/**
 * @file formHandler.js
 * @description Entry point for form submission processing.
 * Delegates to formExtractor.js (data parsing) and formCoverageHandler.js (coverage).
 */

function onFormSubmitVolunteer(e) {
    try {
        logVolunteerInfo('Nouvelle soumission formulaire reçue');

        const formData = extractFormData(e);
        if (!formData) {
            logVolunteerError('Données formulaire invalides');
            return;
        }

        const duplicate = findVolunteerByEmail(formData.email);
        if (duplicate) {
            logVolunteerWarning(`Email déjà existant: ${formData.email}`, duplicate);
            notifyVolunteerAdmin(
                'Soumission formulaire - Doublon détecté',
                `Email: ${formData.email}\nBénévole existant: ${duplicate.id}\nStatut: ${duplicate.statut}`
            );
            return;
        }

        const result = createVolunteer({
            nom: formData.nom,
            prenom: formData.prenom,
            email: formData.email,
            telephone: formData.telephone,
            id_vehicule: formData.vehiculeId,
            confiance: false
        });

        if (!result.success) {
            logVolunteerError('Échec création bénévole depuis formulaire', result.error);
            return;
        }

        const volunteerId = result.volunteerId;

        formData.disponibilites.forEach(dispo => {
            const r = setVolunteerAvailability(volunteerId, dispo, '');
            if (!r.success) logVolunteerWarning(`Échec disponibilité "${dispo}" pour ${volunteerId}`, r.error);
        });

        processCoverageFromPreferences(volunteerId, formData.prefZone, formData.prefNantes);

        logVolunteerInfo(`Bénévole créé depuis formulaire: ${volunteerId}`);

    } catch (error) {
        logVolunteerError('Erreur traitement soumission formulaire', error);
    }
}

function processManualFormSubmission(rowNumber) {
    try {
        const form = FormApp.getActiveForm();
        const formResponses = form.getResponses();

        if (rowNumber < 1 || rowNumber > formResponses.length) {
            return { success: false, error: 'Numéro de ligne invalide' };
        }

        onFormSubmitVolunteer({ response: formResponses[rowNumber - 1] });
        return { success: true, message: 'Soumission traitée' };

    } catch (error) {
        logVolunteerError('Échec traitement manuel soumission', error);
        return { success: false, error: error.toString() };
    }
}