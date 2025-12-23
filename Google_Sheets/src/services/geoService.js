/**
 * @file volunteerGeoService.js
 * @description Intégration avec l'API géographique externe
 */

/**
 * Appelle l'API GEO avec paramètres
 * @param {string} action - Action de l'API
 * @param {Object} params - Paramètres de la requête
 * @returns {Object} Réponse de l'API
 */
function callVolunteerGeoApi(action, params) {
    const config = getVolunteerScriptConfig();
    const cache = CacheService.getScriptCache();

    const cacheKey = `vol_geo_${action}_${JSON.stringify(params)}`;
    const cached = cache.get(cacheKey);

    if (cached) {
        return JSON.parse(cached);
    }

    const apiKey = config.geoApiKey;
    if (!apiKey) {
        logVolunteerError('GEO_API_KEY non configurée');
        return { error: true, message: 'Clé API non configurée' };
    }

    params['X-Api-Key'] = apiKey;

    const url = buildGeoApiUrl(config.geoApiUrl, action, params);

    try {
        const response = UrlFetchApp.fetch(url, {
            method: 'get',
            muteHttpExceptions: true
        });

        const responseCode = response.getResponseCode();
        const responseText = response.getContentText();

        if (responseCode !== 200) {
            logVolunteerError(`GEO API error: ${responseCode}`, responseText);
            return { error: true, message: responseText };
        }

        const result = JSON.parse(responseText);

        if (!result.error) {
            cache.put(cacheKey, JSON.stringify(result), VOLUNTEER_CONFIG.CACHE.VERY_LONG);
        }

        return result;

    } catch (error) {
        logVolunteerError('Appel GEO API échoué', error);
        return { error: true, message: error.toString() };
    }
}

/**
 * Construit l'URL de l'API GEO
 * @param {string} baseUrl - URL de base
 * @param {string} action - Action
 * @param {Object} params - Paramètres
 * @returns {string} URL complète
 */
function buildGeoApiUrl(baseUrl, action, params) {
    const queryParams = [`action=${encodeURIComponent(action)}`];

    Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
            queryParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`);
        }
    });

    return `${baseUrl}?${queryParams.join('&')}`;
}

/**
 * Valide qu'un quartier existe dans l'API GEO
 * @param {string} quartierId - ID du quartier
 * @returns {Object} {isValid: boolean, error?: string}
 */
function validateQuartierViaGeoApi(quartierId) {
    if (!quartierId) {
        return {
            isValid: false,
            error: 'Quartier ID vide'
        };
    }

    try {
        const result = callVolunteerGeoApi('validatequartier', { id: quartierId });

        if (result.error) {
            return {
                isValid: false,
                error: result.message || 'Quartier invalide'
            };
        }

        return {
            isValid: true
        };

    } catch (error) {
        logVolunteerError('Échec validation quartier', error);
        return {
            isValid: false,
            error: error.toString()
        };
    }
}

/**
 * Récupère les détails d'un quartier
 * @param {string} quartierId - ID du quartier
 * @returns {Object|null} Détails du quartier
 */
function getQuartierDetails(quartierId) {
    try {
        const result = callVolunteerGeoApi('getquartier', { id: quartierId });

        if (result.error) {
            return null;
        }

        return {
            id: result.id,
            nom: result.nom,
            idSecteur: result.idSecteur
        };

    } catch (error) {
        logVolunteerError(`Échec récupération quartier ${quartierId}`, error);
        return null;
    }
}

/**
 * Récupère tous les quartiers d'un secteur
 * @param {string} secteurId - ID du secteur
 * @returns {Array} Liste des quartiers
 */
function getQuartiersBySecteur(secteurId) {
    try {
        const result = callVolunteerGeoApi('quartiersbysecteur', { idSecteur: secteurId });

        if (result.error || !result.quartiers) {
            return [];
        }

        return result.quartiers;

    } catch (error) {
        logVolunteerError(`Échec récupération quartiers du secteur ${secteurId}`, error);
        return [];
    }
}

/**
 * Récupère tous les secteurs d'une ville
 * @param {string} villeId - ID de la ville
 * @returns {Array} Liste des secteurs
 */
function getSecteursByVille(villeId) {
    try {
        const result = callVolunteerGeoApi('secteursbyville', { idVille: villeId });

        if (result.error || !result.secteurs) {
            return [];
        }

        return result.secteurs;

    } catch (error) {
        logVolunteerError(`Échec récupération secteurs de la ville ${villeId}`, error);
        return [];
    }
}

/**
 * Récupère toutes les villes
 * @returns {Array} Liste des villes
 */
function getAllVilles() {
    try {
        const result = callVolunteerGeoApi('getvilles', {});

        if (result.error || !result.villes) {
            return [];
        }

        return result.villes;

    } catch (error) {
        logVolunteerError('Échec récupération villes', error);
        return [];
    }
}

/**
 * Résout la hiérarchie complète d'un quartier (Ville > Secteur > Quartier)
 * @param {string} quartierId - ID du quartier
 * @returns {Object|null} {ville, secteur, quartier}
 */
function resolveQuartierHierarchy(quartierId) {
    try {
        const quartier = getQuartierDetails(quartierId);
        if (!quartier) {
            return null;
        }

        const secteurResult = callVolunteerGeoApi('getsecteur', { id: quartier.idSecteur });
        if (secteurResult.error) {
            return null;
        }

        const villeResult = callVolunteerGeoApi('getville', { id: secteurResult.idVille });
        if (villeResult.error) {
            return null;
        }

        return {
            quartier: {
                id: quartier.id,
                nom: quartier.nom
            },
            secteur: {
                id: secteurResult.id,
                nom: secteurResult.nom
            },
            ville: {
                id: villeResult.id,
                nom: villeResult.nom,
                codePostal: villeResult.codePostal
            }
        };

    } catch (error) {
        logVolunteerError(`Échec résolution hiérarchie quartier ${quartierId}`, error);
        return null;
    }
}

/**
 * Teste la connectivité avec l'API GEO
 * @returns {Object} {success: boolean, message: string}
 */
function testGeoApiConnection() {
    try {
        const result = callVolunteerGeoApi('ping', {});

        if (result.error) {
            return {
                success: false,
                message: `Erreur API: ${result.message}`
            };
        }

        return {
            success: true,
            message: `API GEO v${result.version} opérationnelle`
        };

    } catch (error) {
        return {
            success: false,
            message: `Connexion échouée: ${error.toString()}`
        };
    }
}