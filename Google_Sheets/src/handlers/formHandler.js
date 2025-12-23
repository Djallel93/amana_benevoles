/**
 * @file formHandler.js
 * @description Traitement des soumissions du Google Form avec mapping configuré
 */

/**
 * Traite une soumission de formulaire
 * @param {Object} e - Événement de soumission
 */
function onFormSubmitVolunteer(e) {
    try {
        logVolunteerInfo('Nouvelle soumission formulaire reçue');

        // Extraction des données du formulaire
        const formData = extractFormData(e);

        if (!formData) {
            logVolunteerError('Données formulaire invalides');
            return;
        }

        // Vérification des doublons
        const duplicate = findVolunteerByEmail(formData.email);
        if (duplicate) {
            logVolunteerWarning(`Email déjà existant: ${formData.email}`, duplicate);
            notifyVolunteerAdmin(
                'Soumission formulaire - Doublon détecté',
                `Email: ${formData.email}\nBénévole existant: ${duplicate.id}\nStatut: ${duplicate.statut}`
            );
            return;
        }

        // Création du bénévole
        const result = createVolunteer({
            nom: formData.nom,
            prenom: formData.prenom,
            email: formData.email,
            telephone: formData.telephone,
            id_vehicule: formData.vehiculeId,
            confiance: false // Par défaut, pas de confiance via formulaire
        });

        if (!result.success) {
            logVolunteerError('Échec création bénévole depuis formulaire', result.error);
            return;
        }

        const volunteerId = result.volunteerId;

        // Ajout des disponibilités
        if (formData.disponibilites && formData.disponibilites.length > 0) {
            formData.disponibilites.forEach(dispo => {
                setVolunteerAvailability(volunteerId, dispo, false, '');
            });
        }

        // Ajout des couvertures géographiques
        if (formData.quartiers && formData.quartiers.length > 0) {
            formData.quartiers.forEach(quartierId => {
                addVolunteerCoverage(volunteerId, quartierId, 'Livraison', '');
            });
        }

        logVolunteerInfo(`Bénévole créé depuis formulaire: ${volunteerId}`);

    } catch (error) {
        logVolunteerError('Erreur traitement soumission formulaire', error);
    }
}

/**
 * Extrait les données du formulaire en utilisant le mapping configuré
 * @param {Object} e - Événement de soumission
 * @returns {Object|null} Données extraites
 */
function extractFormData(e) {
    try {
        const response = e.response;
        const itemResponses = response.getItemResponses();

        const data = {
            timestamp: new Date(),
            email: response.getRespondentEmail() || '',
            nom: '',
            prenom: '',
            telephone: '',
            disponibilites: [],
            vehiculeType: '',
            vehiculeId: null,
            permis: false,
            quartiers: [],
            preferences: ''
        };

        // Utilisation du mapping configuré pour extraire les données
        itemResponses.forEach(itemResponse => {
            const question = itemResponse.getItem().getTitle().toLowerCase();
            const answer = itemResponse.getResponse();

            // Détection du champ via les mots-clés du mapping
            const fieldName = detectFieldFromQuestion(question);

            if (fieldName) {
                processFormField(data, fieldName, answer, question);
            }
        });

        // Résolution du véhicule
        if (data.vehiculeType && data.permis) {
            data.vehiculeId = resolveVehicleId(data.vehiculeType);
        }

        // Validation minimale
        if (!data.nom || !data.prenom || !data.email || !data.telephone) {
            logVolunteerWarning('Données formulaire incomplètes', data);
            return null;
        }

        return data;

    } catch (error) {
        logVolunteerError('Échec extraction données formulaire', error);
        return null;
    }
}

/**
 * Détecte le nom du champ à partir de la question en utilisant le mapping
 * @param {string} question - Question du formulaire
 * @returns {string|null} Nom du champ ou null
 */
function detectFieldFromQuestion(question) {
    const mapping = FORM_FIELD_MAPPING.keywords;

    // Recherche du mot-clé correspondant dans la question
    for (const [keyword, fieldName] of Object.entries(mapping)) {
        if (question.includes(keyword)) {
            return fieldName;
        }
    }

    return null;
}

/**
 * Traite un champ du formulaire selon son type
 * @param {Object} data - Objet de données à remplir
 * @param {string} fieldName - Nom du champ
 * @param {*} answer - Réponse du formulaire
 * @param {string} question - Question complète
 */
function processFormField(data, fieldName, answer, question) {
    switch (fieldName) {
        case 'nom':
            data.nom = String(answer).trim();
            break;

        case 'prenom':
            data.prenom = String(answer).trim();
            break;

        case 'telephone':
            data.telephone = String(answer).trim();
            break;

        case 'disponibilites':
            // Gestion des réponses multiples ou simples
            if (Array.isArray(answer)) {
                data.disponibilites = answer.map(d => normalizeAvailability(d));
            } else {
                data.disponibilites = [normalizeAvailability(answer)];
            }
            break;

        case 'vehiculeType':
            data.vehiculeType = String(answer).trim();
            break;

        case 'permis':
            // Utilisation du mapping de valeurs
            const normalizedAnswer = String(answer).toLowerCase().trim();
            data.permis = FORM_FIELD_MAPPING.values[normalizedAnswer] || false;
            break;

        case 'preferences':
            data.preferences = answer;
            data.quartiers = extractQuartiersFromPreferences(answer);
            break;
    }
}

/**
 * Normalise un créneau de disponibilité
 * @param {string} availability - Disponibilité brute
 * @returns {string} Disponibilité normalisée
 */
function normalizeAvailability(availability) {
    if (!availability) return '';

    const normalized = String(availability).trim();
    const slots = FORM_FIELD_MAPPING.availabilitySlots;

    // Recherche d'une correspondance exacte ou partielle
    for (const slot of slots) {
        if (normalized.toLowerCase().includes(slot.toLowerCase()) ||
            slot.toLowerCase().includes(normalized.toLowerCase())) {
            return slot;
        }
    }

    // Si pas de correspondance, retourne la valeur normalisée
    return normalized;
}

/**
 * Extrait les IDs de quartiers depuis les préférences
 * @param {string|Array} preferences - Préférences géographiques
 * @returns {Array} Liste des IDs de quartiers
 */
function extractQuartiersFromPreferences(preferences) {
    if (!preferences) {
        return [];
    }

    const quartiers = [];
    const preferencesArray = Array.isArray(preferences) ? preferences : [preferences];

    preferencesArray.forEach(pref => {
        if (typeof pref === 'string') {
            const prefLower = pref.toLowerCase();

            // Mapping géographique basique (à adapter selon votre API)
            if (prefLower.includes('nantes centre') || prefLower.includes('centre')) {
                // Récupérer les quartiers du secteur Nantes Centre
                const quartiersCentre = getQuartiersBySecteur('NANTES_CENTRE_ID');
                quartiersCentre.forEach(q => quartiers.push(q.id));
            }

            if (prefLower.includes('nantes nord')) {
                const quartiersNord = getQuartiersBySecteur('NANTES_NORD_ID');
                quartiersNord.forEach(q => quartiers.push(q.id));
            }

            if (prefLower.includes('nantes sud')) {
                const quartiersSud = getQuartiersBySecteur('NANTES_SUD_ID');
                quartiersSud.forEach(q => quartiers.push(q.id));
            }

            // Ajoutez d'autres mappings selon vos besoins
        }
    });

    return [...new Set(quartiers)]; // Supprime les doublons
}

/**
 * Résout l'ID du véhicule depuis le type en utilisant le mapping
 * @param {string} vehiculeType - Type de véhicule
 * @returns {number|null} ID du véhicule
 */
function resolveVehicleId(vehiculeType) {
    const vehicles = getAllVehicles();
    const normalizedType = vehiculeType.toLowerCase().trim();
    const typeMapping = FORM_FIELD_MAPPING.vehicleTypes;

    for (const vehicle of vehicles) {
        const vehicleType = vehicle.type.toLowerCase();

        // Recherche directe
        if (vehicleType === normalizedType) {
            return vehicle.id;
        }

        // Recherche via mapping
        for (const [key, aliases] of Object.entries(typeMapping)) {
            if (vehicleType.includes(key) &&
                aliases.some(alias => normalizedType.includes(alias))) {
                return vehicle.id;
            }
        }
    }

    logVolunteerWarning(`Type de véhicule non résolu: ${vehiculeType}`);
    return null;
}

/**
 * Traite manuellement une soumission depuis les réponses du formulaire
 * @param {number} rowNumber - Numéro de ligne dans la feuille de réponses
 * @returns {Object} Résultat du traitement
 */
function processManualFormSubmission(rowNumber) {
    try {
        const form = FormApp.getActiveForm();
        const formResponses = form.getResponses();

        if (rowNumber > formResponses.length || rowNumber < 1) {
            return {
                success: false,
                error: 'Numéro de ligne invalide'
            };
        }

        const response = formResponses[rowNumber - 1];
        const e = { response: response };

        onFormSubmitVolunteer(e);

        return {
            success: true,
            message: 'Soumission traitée'
        };

    } catch (error) {
        logVolunteerError('Échec traitement manuel soumission', error);
        return {
            success: false,
            error: error.toString()
        };
    }
}