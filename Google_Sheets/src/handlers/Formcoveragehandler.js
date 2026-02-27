/**
 * @file formCoverageHandler.js
 * @description Resolves volunteer coverage zones from form preference answers.
 *
 * Coverage logic:
 *   Option 1 (Nantes + outside) → all secteurs via getsecteurs API
 *   Option 2 (Nantes only)      → all Nantes secteurs via secteursbyville (idVille=1)
 *   Option 3 (Specific zones)   → secteurs resolved from checkbox answer (prefNantes)
 *   Option 4 (Other)            → no coverage rows, admin notified
 */

const NANTES_VILLE_ID = 1;

const PREF_ZONE_OPTIONS = {
    ALL: 'nantes et en dehors',
    NANTES: 'que dans nantes',
    SPECIFIC: 'certains lieux'
};

// Checkbox answer fragments → Nantes secteur IDs
const NANTES_SECTEUR_MAP = {
    'nord': 1,
    'est': 2,
    'centre': 3,
    'west': 4,
    'ouest': 4,
    'sud': 5
};

function processCoverageFromPreferences(volunteerId, prefZone, prefNantes) {
    const zoneLower = (prefZone || '').toLowerCase();

    if (zoneLower.includes(PREF_ZONE_OPTIONS.ALL)) {
        logVolunteerInfo(`Couverture complète (Nantes + extérieur) pour ${volunteerId}`);
        const result = callVolunteerGeoApi('getquartiers', {});
        if (result.error || !result.quartiers?.length) {
            logVolunteerWarning('Impossible de récupérer tous les quartiers', result.message);
            return;
        }
        createCoverageFromQuartierList(volunteerId, result.quartiers);

    } else if (zoneLower.includes(PREF_ZONE_OPTIONS.NANTES)) {
        logVolunteerInfo(`Couverture Nantes uniquement pour ${volunteerId}`);
        const result = callVolunteerGeoApi('secteursbyville', { idVille: NANTES_VILLE_ID });
        if (result.error || !result.secteurs?.length) {
            logVolunteerWarning('Impossible de récupérer les secteurs Nantes', result.message);
            return;
        }
        createCoverageFromSecteurList(volunteerId, result.secteurs);

    } else if (zoneLower.includes(PREF_ZONE_OPTIONS.SPECIFIC)) {
        logVolunteerInfo(`Couverture zones spécifiques pour ${volunteerId}`);
        const secteurIds = resolveCheckboxesToSecteurIds(prefNantes || '');
        if (!secteurIds.length) {
            logVolunteerWarning(`Aucun secteur résolu depuis les cases à cocher pour ${volunteerId}`, prefNantes);
            return;
        }
        createCoverageFromSecteurList(volunteerId, secteurIds.map(id => ({ id })));

    } else {
        logVolunteerInfo(`Préférence non standard pour ${volunteerId}: "${prefZone}"`);
        notifyVolunteerAdmin(
            'Préférence de livraison non standard',
            `Bénévole: ${volunteerId}\nPréférence: ${prefZone}\nMerci de le contacter pour définir sa zone de couverture.`
        );
    }
}

/**
 * Writes one Livraison coverage row per quartier (when quartiers are already fetched).
 */
function createCoverageFromQuartierList(volunteerId, quartiers) {
    let total = 0;

    quartiers.forEach(quartier => {
        const r = addVolunteerCoverage(
            volunteerId,
            String(quartier.id),
            VOLUNTEER_CONFIG.COVERAGE_TYPES.LIVRAISON,
            ''
        );
        if (r.success) {
            total++;
        } else {
            logVolunteerWarning(`Couverture non créée quartier ${quartier.id}`, r.error);
        }
    });

    logVolunteerInfo(`${total} couverture(s) créée(s) pour ${volunteerId}`);
}

/**
 * Fetches quartiers for each secteur and writes one Livraison coverage row per quartier.
 */
function createCoverageFromSecteurList(volunteerId, secteurs) {
    let total = 0;

    secteurs.forEach(secteur => {
        const result = callVolunteerGeoApi('quartiersbysecteur', { idSecteur: secteur.id });
        if (result.error || !result.quartiers?.length) {
            logVolunteerWarning(`Aucun quartier pour secteur ${secteur.id}`);
            return;
        }
        result.quartiers.forEach(quartier => {
            const r = addVolunteerCoverage(
                volunteerId,
                String(quartier.id),
                VOLUNTEER_CONFIG.COVERAGE_TYPES.LIVRAISON,
                ''
            );
            if (r.success) {
                total++;
            } else {
                logVolunteerWarning(`Couverture non créée quartier ${quartier.id}`, r.error);
            }
        });
    });

    logVolunteerInfo(`${total} couverture(s) créée(s) pour ${volunteerId}`);
}

/**
 * Parses checkbox answer string into Nantes secteur IDs.
 * e.g. "Nantes Nord, Nantes Sud" → [1, 5]
 */
function resolveCheckboxesToSecteurIds(prefNantes) {
    const ids = new Set();

    prefNantes.split(/[,;]/).map(t => t.trim().toLowerCase()).filter(Boolean).forEach(token => {
        for (const [keyword, secteurId] of Object.entries(NANTES_SECTEUR_MAP)) {
            if (token.includes(keyword)) {
                ids.add(secteurId);
                break;
            }
        }
    });

    return [...ids];
}