/**
 * @file formHandler.js
 * @description Traitement des soumissions du Google Form
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
 * Extrait les données du formulaire
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
            quartiers: []
        };

        itemResponses.forEach(itemResponse => {
            const question = itemResponse.getItem().getTitle();
            const answer = itemResponse.getResponse();

            // Mapping des questions vers les champs
            if (question.includes('Nom')) {
                data.nom = answer;
            } else if (question.includes('Prénom')) {
                data.prenom = answer;
            } else if (question.includes('téléphone')) {
                data.telephone = answer;
            } else if (question.includes('Disponibilité')) {
                // Si réponse multiple
                if (Array.isArray(answer)) {
                    data.disponibilites = answer;
                } else {
                    data.disponibilites = [answer];
                }
            } else if (question.includes('véhicule')) {
                data.vehiculeType = answer;
            } else if (question.includes('Permis')) {
                data.permis = answer === 'Oui';
            } else if (question.includes('Préférences') || question.includes('livraison')) {
                // Extraction des quartiers depuis les préférences
                data.quartiers = extractQuartiersFromPreferences(answer);
            }
        }

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
 * Extrait les IDs de quartiers depuis les préférences
 * @param {string|Array} preferences - Préférences géographiques
 * @returns {Array} Liste des IDs de quartiers
 */
function extractQuartiersFromPreferences(preferences) {
    // Cette fonction doit être adaptée selon le format exact des réponses
    // Pour l'instant, retourne un tableau vide
    // À personnaliser selon vos besoins

    if (!preferences) {
        return [];
    }

    const quartiers = [];

    // Exemple de mapping simple
    // Vous devrez adapter selon votre API GEO
    const preferencesArray = Array.isArray(preferences) ? preferences : [preferences];

    preferencesArray.forEach(pref => {
        // Logique de résolution des quartiers
        // Par exemple, si "Nantes Centre" est mentionné
        if (typeof pref === 'string') {
            if (pref.includes('Nantes Centre')) {
                // Récupérer les quartiers de Nantes Centre via GEO API
                const quartiersCentre = getQuartiersBySecteur('NANTES_CENTRE_ID');
                quartiersCentre.forEach(q => quartiers.push(q.id));
            }
            // Ajouter d'autres mappings...
        }
    });

    return quartiers;
}

/**
 * Résout l'ID du véhicule depuis le type
 * @param {string} vehiculeType - Type de véhicule (ex: "Citadine", "Berline")
 * @returns {number|null} ID du véhicule
 */
function resolveVehicleId(vehiculeType) {
    const vehicles = getAllVehicles();

    // Normalisation du type
    const normalizedType = vehiculeType.toLowerCase().trim();

    // Mapping des types
    const typeMapping = {
        'citadine': ['citadine', 'petite voiture'],
        'berline': ['berline', 'voiture moyenne'],
        'suv': ['suv', 'grand véhicule', '4x4'],
        'utilitaire': ['utilitaire', 'camionnette', 'fourgon'],
        'break': ['break', 'familiale']
    };

    for (const vehicle of vehicles) {
        const vehicleType = vehicle.type.toLowerCase();

        // Recherche directe
        if (vehicleType === normalizedType) {
            return vehicle.id;
        }

        // Recherche via mapping
        for (const [key, aliases] of Object.entries(typeMapping)) {
            if (vehicleType.includes(key) && aliases.some(alias => normalizedType.includes(alias))) {
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