/**
 * @file volunteerEmailService.js
 * @description Service d'envoi d'emails aux bénévoles avec template HTML
 */

/**
 * Envoie un email de demande de disponibilité à un bénévole
 * @param {string} volunteerId - ID du bénévole
 * @param {Object} eventDetails - Détails de l'événement
 * @returns {Object} {success: boolean, error?: string}
 */
function sendAvailabilityRequest(volunteerId, eventDetails) {
    try {
        const volunteer = getVolunteerById(volunteerId);

        if (!volunteer) {
            return {
                success: false,
                error: `Bénévole ${volunteerId} introuvable`
            };
        }

        if (!volunteer.email || !isValidVolunteerEmail(volunteer.email)) {
            return {
                success: false,
                error: 'Email bénévole invalide'
            };
        }

        if (!volunteer.actif) {
            return {
                success: false,
                error: 'Bénévole inactif'
            };
        }

        const config = getVolunteerScriptConfig();
        const confirmYesUrl = `${config.webAppUrl}?action=confirmAvailability&volunteerId=${volunteerId}&eventId=${eventDetails.eventId}&response=yes&token=${config.volunteerApiKey}`;
        const confirmNoUrl = `${config.webAppUrl}?action=confirmAvailability&volunteerId=${volunteerId}&eventId=${eventDetails.eventId}&response=no&token=${config.volunteerApiKey}`;

        const htmlBody = generateAvailabilityEmailHtml(volunteer, eventDetails, confirmYesUrl, confirmNoUrl);

        MailApp.sendEmail({
            to: volunteer.email,
            subject: `🔔 Demande de disponibilité - ${eventDetails.titre}`,
            htmlBody: htmlBody,
            name: 'Gestion des Bénévoles'
        });

        logVolunteerInfo(`Email de disponibilité envoyé à ${volunteerId}`);

        return {
            success: true
        };

    } catch (error) {
        logVolunteerError(`Échec envoi email à ${volunteerId}`, error);
        return {
            success: false,
            error: error.toString()
        };
    }
}

/**
 * Génère le HTML de l'email de demande de disponibilité à partir du template
 * @param {Object} volunteer - Données du bénévole
 * @param {Object} eventDetails - Détails de l'événement
 * @param {string} confirmYesUrl - URL de confirmation positive
 * @param {string} confirmNoUrl - URL de confirmation négative
 * @returns {string} HTML de l'email
 */
function generateAvailabilityEmailHtml(volunteer, eventDetails, confirmYesUrl, confirmNoUrl) {
    // Charger le template
    let template = HtmlService.createHtmlOutputFromFile('views/email/emailAvailabilityTemplate').getContent();

    // Formatage de la date
    const dateFormatted = formatEventDate(eventDetails.date);

    // Section description (optionnelle)
    let descriptionSection = '';
    if (eventDetails.description && eventDetails.description.trim() !== '') {
        descriptionSection = `
            <div class="description-box">
                <div class="description-label">Description</div>
                <p style="margin: 5px 0; line-height: 1.6;">${escapeHtml(eventDetails.description)}</p>
            </div>
        `;
    }

    // Remplacement des placeholders
    template = template.replace('{{PRENOM}}', escapeHtml(volunteer.prenom));
    template = template.replace('{{NOM}}', escapeHtml(volunteer.nom));
    template = template.replace('{{TITRE}}', escapeHtml(eventDetails.titre));
    template = template.replace('{{DATE}}', escapeHtml(dateFormatted));
    template = template.replace('{{HORAIRE}}', escapeHtml(eventDetails.horaire));
    template = template.replace('{{LIEU}}', escapeHtml(eventDetails.lieu));
    template = template.replace('{{TYPE}}', escapeHtml(eventDetails.type));
    template = template.replace('{{DESCRIPTION_SECTION}}', descriptionSection);
    template = template.replace('{{CONFIRM_YES_URL}}', confirmYesUrl);
    template = template.replace('{{CONFIRM_NO_URL}}', confirmNoUrl);

    return template;
}

/**
 * Formate une date d'événement pour l'affichage
 * @param {string} dateString - Date au format YYYY-MM-DD
 * @returns {string} Date formatée
 */
function formatEventDate(dateString) {
    if (!dateString) return '';

    try {
        const date = new Date(dateString);
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };

        return date.toLocaleDateString('fr-FR', options);
    } catch (error) {
        logVolunteerWarning('Erreur formatage date', error);
        return dateString;
    }
}

/**
 * Échappe les caractères HTML pour éviter l'injection
 * @param {string} text - Texte à échapper
 * @returns {string} Texte échappé
 */
function escapeHtml(text) {
    if (!text) return '';

    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };

    return String(text).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Envoie des demandes de disponibilité à plusieurs bénévoles
 * @param {Array} volunteerIds - Liste des IDs de bénévoles
 * @param {Object} eventDetails - Détails de l'événement
 * @returns {Object} {sent, failed, errors}
 */
function sendBulkAvailabilityRequests(volunteerIds, eventDetails) {
    const results = {
        sent: 0,
        failed: 0,
        errors: []
    };

    volunteerIds.forEach(volunteerId => {
        const result = sendAvailabilityRequest(volunteerId, eventDetails);

        if (result.success) {
            results.sent++;
        } else {
            results.failed++;
            results.errors.push({
                volunteerId: volunteerId,
                error: result.error
            });
        }

        // Petit délai pour éviter les quotas
        Utilities.sleep(100);
    });

    logVolunteerInfo('Envoi bulk terminé', results);

    // Notification admin
    if (results.sent > 0) {
        notifyVolunteerAdmin(
            'Demandes de disponibilité envoyées',
            `Événement: ${eventDetails.titre}\nDate: ${eventDetails.date}\n\nEnvoyés: ${results.sent}\nÉchecs: ${results.failed}`
        );
    }

    return results;
}

/**
 * Traite une réponse de disponibilité depuis un email
 * @param {string} volunteerId - ID du bénévole
 * @param {string} eventId - ID de l'événement
 * @param {string} response - 'yes' ou 'no'
 * @returns {Object} {success: boolean, message: string}
 */
function handleAvailabilityResponse(volunteerId, eventId, response) {
    try {
        // Validation
        const volunteer = getVolunteerById(volunteerId);
        if (!volunteer) {
            return {
                success: false,
                message: 'Bénévole introuvable'
            };
        }

        if (!['yes', 'no'].includes(response)) {
            return {
                success: false,
                message: 'Réponse invalide'
            };
        }

        // Enregistrer la réponse (vous pouvez l'intégrer à votre système de gestion d'événements)
        logVolunteerInfo(`Réponse disponibilité: ${volunteerId} - Event ${eventId} - ${response}`);

        const message = response === 'yes'
            ? `✅ Merci ${volunteer.prenom} ! Votre disponibilité est confirmée.`
            : `Merci ${volunteer.prenom} pour votre réponse. Nous en prenons note.`;

        // Notification admin
        notifyVolunteerAdmin(
            `Réponse disponibilité - ${volunteer.prenom} ${volunteer.nom}`,
            `Bénévole: ${volunteer.id}\nÉvénement: ${eventId}\nRéponse: ${response === 'yes' ? 'Disponible' : 'Non disponible'}`
        );

        return {
            success: true,
            message: message
        };

    } catch (error) {
        logVolunteerError('Échec traitement réponse disponibilité', error);
        return {
            success: false,
            message: error.toString()
        };
    }
}

/**
 * Envoie un email de rappel à un bénévole
 * @param {string} volunteerId - ID du bénévole
 * @param {Object} eventDetails - Détails de l'événement
 * @returns {Object} {success: boolean, error?: string}
 */
function sendReminderEmail(volunteerId, eventDetails) {
    try {
        const volunteer = getVolunteerById(volunteerId);

        if (!volunteer || !volunteer.email) {
            return {
                success: false,
                error: 'Bénévole ou email introuvable'
            };
        }

        const dateFormatted = formatEventDate(eventDetails.date);

        const htmlBody = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #ff9800; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
                    .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    .event-box { background: #fff3e0; padding: 15px; border-left: 4px solid #ff9800; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>⏰ Rappel - Événement à venir</h2>
                    </div>
                    <div class="content">
                        <p>Bonjour ${escapeHtml(volunteer.prenom)},</p>
                        
                        <p>Nous vous rappelons que vous êtes inscrit pour l'événement suivant :</p>
                        
                        <div class="event-box">
                            <strong>${escapeHtml(eventDetails.titre)}</strong><br>
                            📅 ${escapeHtml(dateFormatted)}<br>
                            🕐 ${escapeHtml(eventDetails.horaire)}<br>
                            📍 ${escapeHtml(eventDetails.lieu)}
                        </div>
                        
                        <p>Nous comptons sur votre présence. En cas d'empêchement, merci de nous prévenir au plus vite.</p>
                        
                        <p>À bientôt !</p>
                    </div>
                    <div class="footer">
                        <p>👥 Système de Gestion des Bénévoles</p>
                    </div>
                </div>
            </body>
            </html>`;

        MailApp.sendEmail({
            to: volunteer.email,
            subject: `⏰ Rappel - ${eventDetails.titre}`,
            htmlBody: htmlBody,
            name: 'Gestion des Bénévoles'
        });

        logVolunteerInfo(`Email de rappel envoyé à ${volunteerId}`);

        return {
            success: true
        };

    } catch (error) {
        logVolunteerError(`Échec envoi rappel à ${volunteerId}`, error);
        return {
            success: false,
            error: error.toString()
        };
    }
}