/**
 * @file missionBriefingService.js
 * @description Handles mission briefing email campaign to all Validé volunteers.
 *
 * Exposed to client-side via google.script.run:
 *   - previewMissionBriefing(dateVal, timeVal)  → { success, count, dateFormatted, timeFormatted }
 *   - sendMissionBriefing(dateVal, timeVal)      → { sent, failed, errors[] }
 */

/**
 * Formats a YYYY-MM-DD date string to French long format.
 * e.g. "2025-04-12" → "samedi 12 avril 2025"
 *
 * @param {string} dateVal - ISO date string YYYY-MM-DD
 * @returns {string} French-formatted date
 */
function formatMissionDate(dateVal) {
    try {
        // Append T12:00:00 to avoid timezone-induced day shift
        const date = new Date(dateVal + 'T12:00:00');
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const formatted = date.toLocaleDateString('fr-FR', options);
        // Capitalise first letter
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch (e) {
        logVolunteerWarning('formatMissionDate failed', e);
        return dateVal;
    }
}

/**
 * Formats a HH:MM time string to a human-readable French string.
 * e.g. "08:00" → "8h00"
 *
 * @param {string} timeVal - Time string HH:MM
 * @returns {string} French-formatted time
 */
function formatMissionTime(timeVal) {
    try {
        const parts = timeVal.split(':');
        const hours = parseInt(parts[0], 10);
        const minutes = parts[1] || '00';
        return `${hours}h${minutes}`;
    } catch (e) {
        logVolunteerWarning('formatMissionTime failed', e);
        return timeVal;
    }
}

/**
 * Preview step: counts Validé volunteers and returns formatted date/time.
 * Called from the dialog before the user confirms sending.
 *
 * @param {string} dateVal  - ISO date YYYY-MM-DD
 * @param {string} timeVal  - Time HH:MM
 * @returns {Object} { success, count, dateFormatted, timeFormatted, error? }
 */
function previewMissionBriefing(dateVal, timeVal) {
    try {
        if (!dateVal || !timeVal) {
            return { success: false, error: 'Date ou heure manquante.' };
        }

        const volunteers = getAllVolunteers({ statut: VOLUNTEER_CONFIG.STATUS.VALIDE, actif: true });

        return {
            success: true,
            count: volunteers.length,
            dateFormatted: formatMissionDate(dateVal),
            timeFormatted: formatMissionTime(timeVal)
        };

    } catch (error) {
        logVolunteerError('previewMissionBriefing failed', error);
        return { success: false, error: error.toString() };
    }
}

/**
 * Send step: builds and dispatches the mission briefing email to every Validé volunteer.
 *
 * @param {string} dateVal  - ISO date YYYY-MM-DD
 * @param {string} timeVal  - Time HH:MM
 * @returns {Object} { sent, failed, errors[] }
 */
function sendMissionBriefing(dateVal, timeVal) {
    const results = { sent: 0, failed: 0, errors: [] };

    try {
        if (!dateVal || !timeVal) {
            return { sent: 0, failed: 0, errors: [{ volunteerId: 'N/A', error: 'Date ou heure manquante.' }] };
        }

        const dateFormatted = formatMissionDate(dateVal);
        const timeFormatted = formatMissionTime(timeVal);

        const volunteers = getAllVolunteers({ statut: VOLUNTEER_CONFIG.STATUS.VALIDE, actif: true });

        if (volunteers.length === 0) {
            logVolunteerWarning('sendMissionBriefing: aucun bénévole Validé trouvé');
            return results;
        }

        logVolunteerInfo(`sendMissionBriefing: envoi à ${volunteers.length} bénévole(s) — ${dateFormatted} à ${timeFormatted}`);

        volunteers.forEach(function (volunteer) {
            const result = sendMissionBriefingEmail(volunteer, dateFormatted, timeFormatted);

            if (result.success) {
                results.sent++;
            } else {
                results.failed++;
                results.errors.push({ volunteerId: String(volunteer.id), error: result.error });
            }

            // Throttle to respect Gmail quotas
            Utilities.sleep(150);
        });

        logVolunteerInfo('sendMissionBriefing terminé', results);

        // Notify admin
        notifyVolunteerAdmin(
            'Campagne Briefing Mission envoyée',
            `Date mission : ${dateFormatted}\nHeure : ${timeFormatted}\n\nEnvoyés : ${results.sent}\nÉchecs : ${results.failed}`
        );

    } catch (error) {
        logVolunteerError('sendMissionBriefing global failure', error);
        results.errors.push({ volunteerId: 'GLOBAL', error: error.toString() });
    }

    return results;
}

/**
 * Sends a single mission briefing email to one volunteer.
 *
 * @param {Object} volunteer      - Volunteer object from rowToVolunteer()
 * @param {string} dateFormatted  - Human-readable date string
 * @param {string} timeFormatted  - Human-readable time string
 * @returns {Object} { success, error? }
 */
function sendMissionBriefingEmail(volunteer, dateFormatted, timeFormatted) {
    try {
        if (!volunteer.email || !isValidVolunteerEmail(volunteer.email)) {
            return { success: false, error: 'Email invalide ou manquant' };
        }

        const subject = `Briefing mission \u2014 ${dateFormatted}`;
        const html = buildMissionBriefingHtml(volunteer, dateFormatted, timeFormatted);

        GmailApp.sendEmail(volunteer.email, subject, '', { htmlBody: html });

        logVolunteerInfo(`Briefing mission envoyé à ${volunteer.id} (${volunteer.email})`);
        return { success: true };

    } catch (error) {
        logVolunteerError(`Échec envoi briefing mission à ${volunteer.id}`, error);
        return { success: false, error: error.toString() };
    }
}

/**
 * Loads the mission briefing HTML template and substitutes placeholders.
 *
 * @param {Object} volunteer      - Volunteer object
 * @param {string} dateFormatted  - Human-readable date
 * @param {string} timeFormatted  - Human-readable time
 * @returns {string} Final HTML string
 */
function buildMissionBriefingHtml(volunteer, dateFormatted, timeFormatted) {
    const template = HtmlService
        .createHtmlOutputFromFile('views/email/missionBriefingTemplate')
        .getContent();

    return template
        .replace(/{{DATE_EVENT}}/g, escapeHtml(dateFormatted))
        .replace(/{{START_TIME}}/g, escapeHtml(timeFormatted))
        .replace(/{{LOGO_URL}}/g, LOGO_DRIVE_URL);
}