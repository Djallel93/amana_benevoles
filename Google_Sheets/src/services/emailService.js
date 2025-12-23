/**
 * @file volunteerEmailService.js
 * @description Service d'envoi d'emails aux bénévoles
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
        const confirmUrl = `${config.webAppUrl}?action=confirmAvailability&volunteerId=${volunteerId}&eventId=${eventDetails.eventId}&token=${config.volunteerApiKey}`;

        const htmlBody = generateAvailabilityEmailHtml(volunteer, eventDetails, confirmUrl);

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
 * Génère le HTML de l'email de demande de disponibilité
 */
function generateAvailabilityEmailHtml(volunteer, eventDetails, confirmUrl) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; }
        .header { background: #1a73e8; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: white; }
        .event-details { background: #f0f4ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { padding: 8px 0; border-bottom: 1px solid #ddd; }
        .detail-label { font-weight: bold; color: #555; }
        .button-container { text-align: center; margin: 30px 0; }
        .button { 
            display: inline-block; 
            padding: 14px 28px; 
            background: #1a73e8; 
            color: white; 
            text-decoration: none; 
            border-radius: 6px; 
            font-weight: bold; 
        }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>🔔 Demande de Disponibilité</h2>
        </div>
        <div class="content">
            <p>Bonjour ${volunteer.prenom} ${volunteer.nom},</p>
            
            <p>Nous organisons un événement et souhaiterions savoir si vous êtes disponible pour participer.</p>
            
            <div class="event-details">
                <h3 style="margin-top: 0;">📅 Détails de l'événement</h3>
                <div class="detail-row">
                    <span class="detail-label">Titre:</span> ${eventDetails.titre}
                </div>
                <div class="detail-row">
                    <span class="detail-label">Date:</span> ${eventDetails.date}
                </div>
                <div class="detail-row">
                    <span class="detail-label">Horaire:</span> ${eventDetails.horaire}
                </div>
                <div class="detail-row">
                    <span class="detail-label">Lieu:</span> ${eventDetails.lieu}
                </div>
                <div class="detail-row">
                    <span class="detail-label">Type:</span> ${eventDetails.type}
                </div>
                ${eventDetails.description ? `
                <div style="margin-top: 15px;">
                    <span class="detail-label">Description:</span>
                    <p style="margin: 5px 0;">${eventDetails.description}</p>
                </div>
                ` : ''}
            </div>
            
            <p><strong>Êtes-vous disponible pour cet événement ?</strong></p>
            
            <div class="button-container">
                <a href="${confirmUrl}&response=yes" class="button" style="background: #34a853;">
                    ✅ Oui, je suis disponible
                </a>
                <br><br>
                <a href="${confirmUrl}&response=no" class="button" style="background: #ea4335;">
                    ❌ Non, je ne suis pas disponible
                </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
                💡 Cliquez sur le bouton correspondant à votre réponse pour confirmer votre disponibilité.
            </p>
        </div>
        <div class="footer">
            <p>👥 Système de Gestion des Bénévoles</p>
            <p>Si vous avez des questions, n'hésitez pas à nous contacter.</p>
        </div>
    </div>
</body>
</html>`;
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

        // Ici, vous pouvez enregistrer la réponse dans une feuille dédiée
        // ou l'intégrer à votre système de gestion d'événements

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