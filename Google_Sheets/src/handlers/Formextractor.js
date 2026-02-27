/**
 * @file formExtractor.js
 * @description Extracts and normalises data from Google Form submissions.
 *
 * Supports two trigger types:
 *   - Spreadsheet onFormSubmit: e.namedValues = { 'Column header': ['value'] }
 *   - Form onFormSubmit:        e.response.getItemResponses()
 *
 * "Toute la journée" expands to ['Matin', 'Après-midi', 'Soir'].
 */

const NO_VEHICLE_VALUES = ['non véhiculé', 'non vehicule', 'aucun', 'none', 'pas de véhicule', ''];
const ALL_DAY_SLOTS = ['Matin', 'Après-midi', 'Soir'];

function extractFormData(e) {
    try {
        if (!e) {
            logVolunteerError('Événement formulaire absent');
            return null;
        }

        const data = e.namedValues
            ? extractFromNamedValues(e.namedValues)
            : extractFromFormResponse(e);

        if (!data) return null;

        if (data.vehiculeType && !NO_VEHICLE_VALUES.includes(data.vehiculeType.toLowerCase().trim())) {
            data.vehiculeId = resolveVehicleId(data.vehiculeType);
        }

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

function extractFromNamedValues(namedValues) {
    const keyMap = {};
    Object.keys(namedValues).forEach(k => { keyMap[k.trim().toLowerCase()] = k; });

    const get = (normalizedKey) => {
        const orig = keyMap[normalizedKey];
        return orig ? (namedValues[orig]?.[0] ?? '').trim() : '';
    };
    const find = (substring) => {
        for (const [normKey, origKey] of Object.entries(keyMap)) {
            if (normKey.includes(substring)) return (namedValues[origKey]?.[0] ?? '').trim();
        }
        return '';
    };

    const data = buildEmptyFormData();

    data.email = get('adresse e-mail') || find('e-mail') || find('email');
    data.nom = get('nom');
    data.prenom = get('prénom') || get('prenom');
    data.telephone = find('téléphone') || find('telephone');
    data.vehiculeType = find('véhicule') || find('vehicule');

    const permisRaw = find('permis').toLowerCase();
    data.permis = FORM_FIELD_MAPPING.values[permisRaw] ?? false;

    const disponibiliteRaw = get('disponibilité') || get('disponibilite') || find('disponib');
    if (disponibiliteRaw) {
        data.disponibilites = expandAvailability(
            disponibiliteRaw.split(/[,;]/).map(d => d.trim()).filter(Boolean)
        );
    }

    data.prefZone = find('zone de livraison') || find('préférences en matière');
    data.prefNantes = find('préférences sur nantes') || find('preferences sur nantes');

    logVolunteerInfo('Données extraites', {
        email: data.email, nom: data.nom, prenom: data.prenom,
        telephone: data.telephone, vehiculeType: data.vehiculeType,
        permis: data.permis, disponibilites: data.disponibilites,
        prefZone: data.prefZone, prefNantes: data.prefNantes
    });

    return data;
}

function extractFromFormResponse(e) {
    if (!e.response) {
        logVolunteerError('Structure événement invalide: ni namedValues ni response');
        return null;
    }

    const data = buildEmptyFormData();
    data.email = e.response.getRespondentEmail() || '';

    e.response.getItemResponses().forEach(itemResponse => {
        const question = itemResponse.getItem().getTitle().trim();
        const answer = itemResponse.getResponse();
        const q = question.toLowerCase();

        if (q === 'nom') {
            data.nom = String(answer).trim();
        } else if (q === 'prénom' || q === 'prenom') {
            data.prenom = String(answer).trim();
        } else if (q.includes('téléphone') || q.includes('telephone') || q.includes('numéro')) {
            data.telephone = String(answer).trim();
        } else if (q.includes('disponib')) {
            const raw = Array.isArray(answer) ? answer : [String(answer)];
            data.disponibilites = expandAvailability(raw.map(d => d.trim()).filter(Boolean));
        } else if (q.includes('véhicule') || q.includes('vehicule')) {
            data.vehiculeType = String(answer).trim();
        } else if (q.includes('permis')) {
            data.permis = FORM_FIELD_MAPPING.values[String(answer).toLowerCase().trim()] ?? false;
        } else if (q.includes('zone de livraison') || q.includes('préférences en matière')) {
            data.prefZone = Array.isArray(answer) ? answer.join(', ') : String(answer);
        } else if (q.includes('préférences sur nantes') || q.includes('preferences sur nantes')) {
            data.prefNantes = Array.isArray(answer) ? answer.join(', ') : String(answer);
        }
    });

    return data;
}

function buildEmptyFormData() {
    return {
        timestamp: new Date(),
        email: '',
        nom: '',
        prenom: '',
        telephone: '',
        disponibilites: [],
        vehiculeType: '',
        vehiculeId: null,
        permis: false,
        prefZone: '',
        prefNantes: ''
    };
}

function expandAvailability(rawSlots) {
    const result = [];
    rawSlots.forEach(slot => {
        if (slot.toLowerCase().includes('toute') || slot.toLowerCase().includes('journée')) {
            ALL_DAY_SLOTS.forEach(s => { if (!result.includes(s)) result.push(s); });
        } else {
            const normalised = normalizeAvailability(slot);
            if (normalised && !result.includes(normalised)) result.push(normalised);
        }
    });
    return result;
}

function normalizeAvailability(availability) {
    if (!availability) return '';
    const normalized = String(availability).trim();

    for (const slot of FORM_FIELD_MAPPING.availabilitySlots) {
        if (normalized.toLowerCase() === slot.toLowerCase()) return slot;
    }
    for (const slot of FORM_FIELD_MAPPING.availabilitySlots) {
        if (normalized.toLowerCase().includes(slot.toLowerCase()) ||
            slot.toLowerCase().includes(normalized.toLowerCase())) {
            return slot;
        }
    }

    logVolunteerWarning(`Créneau de disponibilité non reconnu: "${normalized}"`);
    return normalized;
}

function resolveVehicleId(vehiculeType) {
    const vehicles = getAllVehicles();
    const normalizedType = vehiculeType.toLowerCase().trim();
    const typeMapping = FORM_FIELD_MAPPING.vehicleTypes;

    for (const vehicle of vehicles) {
        const vehicleTypeLower = vehicle.type.toLowerCase();
        if (vehicleTypeLower === normalizedType) return vehicle.id;

        for (const [key, aliases] of Object.entries(typeMapping)) {
            if (vehicleTypeLower.includes(key) &&
                aliases.some(alias => normalizedType.includes(alias))) {
                return vehicle.id;
            }
        }
    }

    logVolunteerWarning(`Type de véhicule non résolu: "${vehiculeType}"`);
    return null;
}