/**
 * @file volunteerApiHandler.js
 * @description API HTTP en lecture seule pour l'accès aux données bénévoles
 */

/**
 * Handler principal pour les requêtes GET
 */
function doGet(e) {
    try {
        const action = e.parameter.action;

        if (!action) {
            return createJsonResponse({ error: 'Paramètre action manquant' }, 400);
        }

        // Authentification (sauf pour ping)
        if (action.toLowerCase() !== 'ping') {
            const authResult = authenticateVolunteerRequest(e);
            if (!authResult.success) {
                return createJsonResponse({ error: authResult.error }, 401);
            }
        }

        // Routage des actions
        switch (action.toLowerCase()) {
            case 'getvolunteer':
                return getVolunteerApi(e);

            case 'listvolunteers':
                return listVolunteersApi(e);

            case 'getavailability':
                return getAvailabilityApi(e);

            case 'getvolunteersbyquartier':
                return getVolunteersByQuartierApi(e);

            case 'getavailablevolunteers':
                return getAvailableVolunteersApi(e);

            case 'getvehicles':
                return getVehiclesApi(e);

            case 'ping':
                return createJsonResponse({
                    status: 'ok',
                    message: 'API Bénévoles opérationnelle',
                    version: '1.0',
                    timestamp: new Date().toISOString()
                });

            default:
                return createJsonResponse({ error: 'Action inconnue' }, 400);
        }

    } catch (error) {
        logVolunteerError('Requête API échouée', error);
        return createJsonResponse({ error: error.toString() }, 500);
    }
}

/**
 * Authentifie une requête API
 */
function authenticateVolunteerRequest(e) {
    const config = getVolunteerScriptConfig();
    const expectedApiKey = config.volunteerApiKey;

    if (!expectedApiKey) {
        logVolunteerError('VOLUNTEER_API_KEY non configurée');
        return { success: false, error: 'Authentification API non configurée' };
    }

    const providedApiKey = e.parameter.apiKey || e.parameter.api_key;

    if (!providedApiKey) {
        return {
            success: false,
            error: 'Clé API manquante. Incluez ?apiKey=VOTRE_CLE'
        };
    }

    if (providedApiKey !== expectedApiKey) {
        logVolunteerWarning('Tentative clé API invalide');
        return { success: false, error: 'Clé API invalide' };
    }

    return { success: true };
}

/**
 * Récupère un bénévole par ID
 */
function getVolunteerApi(e) {
    const id = e.parameter.id;

    if (!id) {
        return createJsonResponse({ error: 'Paramètre id manquant' }, 400);
    }

    const volunteer = getVolunteerById(id);

    if (!volunteer) {
        return createJsonResponse({ error: 'Bénévole introuvable' }, 404);
    }

    // Enrichissement avec véhicule si présent
    if (volunteer.idVehicule) {
        const vehicle = getVehicleById(volunteer.idVehicule);
        if (vehicle) {
            volunteer.vehicule = vehicle;
        }
    }

    return createJsonResponse(volunteer);
}

/**
 * Liste tous les bénévoles avec filtres
 */
function listVolunteersApi(e) {
    const filters = {};

    if (e.parameter.actif !== undefined) {
        filters.actif = e.parameter.actif === 'true';
    }

    if (e.parameter.statut) {
        filters.statut = e.parameter.statut;
    }

    if (e.parameter.confiance !== undefined) {
        filters.confiance = e.parameter.confiance === 'true';
    }

    const volunteers = getAllVolunteers(filters);

    return createJsonResponse({
        count: volunteers.length,
        filters: filters,
        volunteers: volunteers
    });
}

/**
 * Récupère les disponibilités d'un bénévole
 */
function getAvailabilityApi(e) {
    const volunteerId = e.parameter.volunteerId;

    if (!volunteerId) {
        return createJsonResponse({ error: 'Paramètre volunteerId manquant' }, 400);
    }

    const availabilities = getVolunteerAvailabilities(volunteerId);

    return createJsonResponse({
        volunteerId: volunteerId,
        count: availabilities.length,
        availabilities: availabilities
    });
}

/**
 * Récupère les bénévoles couvrant un quartier
 */
function getVolunteersByQuartierApi(e) {
    const quartierId = e.parameter.quartierId;
    const type = e.parameter.type || null;

    if (!quartierId) {
        return createJsonResponse({ error: 'Paramètre quartierId manquant' }, 400);
    }

    const volunteers = getVolunteersByQuartier(quartierId, type);

    return createJsonResponse({
        quartierId: quartierId,
        type: type,
        count: volunteers.length,
        volunteers: volunteers
    });
}

/**
 * Récupère les bénévoles disponibles pour un créneau
 */
function getAvailableVolunteersApi(e) {
    const disponibilite = e.parameter.disponibilite;
    const courtDelaiOnly = e.parameter.courtDelaiOnly === 'true';

    if (!disponibilite) {
        return createJsonResponse({ error: 'Paramètre disponibilite manquant' }, 400);
    }

    const volunteers = getAvailableVolunteers(disponibilite, courtDelaiOnly);

    return createJsonResponse({
        disponibilite: disponibilite,
        courtDelaiOnly: courtDelaiOnly,
        count: volunteers.length,
        volunteers: volunteers
    });
}

/**
 * Récupère tous les véhicules
 */
function getVehiclesApi(e) {
    const vehicles = getAllVehicles();

    return createJsonResponse({
        count: vehicles.length,
        vehicles: vehicles
    });
}

/**
 * Crée une réponse JSON
 */
function createJsonResponse(data, statusCode = 200) {
    return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}