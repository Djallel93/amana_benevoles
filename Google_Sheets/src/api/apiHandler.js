/**
 * @file apiHandler.js
 * @description Read-only HTTP API for volunteer data access.
 *
 * NOTE: Google Apps Script ContentService does not support custom HTTP status codes.
 * All responses return HTTP 200. Errors are indicated by the `status` field in the JSON body.
 */

function doGet(e) {
    try {
        const action = e.parameter.action;

        if (!action) {
            return jsonResponse({ status: 400, error: 'Missing parameter: action' });
        }

        if (action.toLowerCase() !== 'ping') {
            const auth = authenticateRequest(e);
            if (!auth.success) {
                return jsonResponse({ status: 401, error: auth.error });
            }
        }

        switch (action.toLowerCase()) {
            case 'getvolunteer': return handleGetVolunteer(e);
            case 'listvolunteers': return handleListVolunteers(e);
            case 'getavailability': return handleGetAvailability(e);
            case 'getvolunteersbyquartier': return handleGetVolunteersByQuartier(e);
            case 'getavailablevolunteers': return handleGetAvailableVolunteers(e);
            case 'getvehicles': return handleGetVehicles(e);
            case 'ping':
                return jsonResponse({
                    status: 200,
                    message: 'API Bénévoles opérationnelle',
                    version: '1.0',
                    timestamp: new Date().toISOString()
                });
            default:
                return jsonResponse({ status: 400, error: `Unknown action: ${action}` });
        }

    } catch (error) {
        logVolunteerError('API request failed', error);
        return jsonResponse({ status: 500, error: error.toString() });
    }
}

function authenticateRequest(e) {
    const config = getVolunteerScriptConfig();
    const expectedKey = config.volunteerApiKey;

    if (!expectedKey) {
        logVolunteerError('VOLUNTEER_API_KEY not configured');
        return { success: false, error: 'API authentication not configured' };
    }

    const providedKey = e.parameter.apiKey || e.parameter.api_key;

    if (!providedKey) {
        return { success: false, error: 'Missing API key. Include ?apiKey=YOUR_KEY' };
    }

    if (providedKey !== expectedKey) {
        logVolunteerWarning('Invalid API key attempt');
        return { success: false, error: 'Invalid API key' };
    }

    return { success: true };
}

function handleGetVolunteer(e) {
    const id = e.parameter.id;
    if (!id) return jsonResponse({ status: 400, error: 'Missing parameter: id' });

    const volunteer = getVolunteerById(normalizeVolunteerId(id));
    if (!volunteer) return jsonResponse({ status: 404, error: `Volunteer not found: ${id}` });

    if (volunteer.idVehicule) {
        const vehicle = getVehicleById(volunteer.idVehicule);
        if (vehicle) volunteer.vehicule = vehicle;
    }

    return jsonResponse({ status: 200, ...volunteer });
}

function handleListVolunteers(e) {
    const filters = {};

    if (e.parameter.actif !== undefined) filters.actif = e.parameter.actif === 'true';
    if (e.parameter.statut) filters.statut = e.parameter.statut;
    if (e.parameter.confiance !== undefined) filters.confiance = e.parameter.confiance === 'true';
    if (e.parameter.admin !== undefined) filters.admin = e.parameter.admin === 'true';

    const volunteers = getAllVolunteers(filters);
    return jsonResponse({ status: 200, count: volunteers.length, filters, volunteers });
}

function handleGetAvailability(e) {
    const rawId = e.parameter.volunteerId;
    if (!rawId) return jsonResponse({ status: 400, error: 'Missing parameter: volunteerId' });

    const volunteerId = normalizeVolunteerId(rawId);

    const availabilities = getVolunteerAvailabilities(volunteerId);
    return jsonResponse({ status: 200, volunteerId, count: availabilities.length, availabilities });
}

function handleGetVolunteersByQuartier(e) {
    const quartierId = e.parameter.quartierId;
    if (!quartierId) return jsonResponse({ status: 400, error: 'Missing parameter: quartierId' });

    const type = e.parameter.type || null;
    const volunteers = getVolunteersByQuartier(quartierId, type);
    return jsonResponse({ status: 200, quartierId, type, count: volunteers.length, volunteers });
}

function handleGetAvailableVolunteers(e) {
    const disponibilite = e.parameter.disponibilite;
    if (!disponibilite) return jsonResponse({ status: 400, error: 'Missing parameter: disponibilite' });

    const volunteers = getAvailableVolunteers(disponibilite);
    return jsonResponse({ status: 200, disponibilite, count: volunteers.length, volunteers });
}

function handleGetVehicles(e) {
    const vehicles = getAllVehicles();
    return jsonResponse({ status: 200, count: vehicles.length, vehicles });
}

function jsonResponse(data) {
    return ContentService
        .createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}