/**
 * @file volunteer_config.js
 * @description Configuration centrale du système de gestion des bénévoles
 */

const VOLUNTEER_CONFIG = {
    SHEETS: {
        BENEVOLES: 'benevoles',
        VEHICULES: 'vehicules',
        COUVERTURE: 'couverture',
        DISPONIBILITES: 'disponibilites'
    },
    STATUS: {
        RECU: 'Reçu',
        EN_COURS: 'En cours',
        VALIDE: 'Validé',
        REJETE: 'Rejeté',
        ARCHIVE: 'Archivé'
    },
    COVERAGE_TYPES: {
        COLLECTE: 'Collecte',
        LIVRAISON: 'Livraison',
        TRI: 'Tri',
        TIRELIRE: 'Tirelire'
    },
    CACHE: {
        SHORT: 300,
        MEDIUM: 1800,
        LONG: 3600,
        VERY_LONG: 21600
    },
    GEO_API: {
        VERSION: '5.0',
        MAX_DISTANCE: 50
    }
};

const BENEVOLE_COLUMNS = {
    ID: 0,
    NOM: 1,
    PRENOM: 2,
    EMAIL: 3,
    TELEPHONE: 4,
    DATE_INSCRIPTION: 5,
    ACTIF: 6,
    CONFIANCE: 7,
    ID_VEHICULE: 8,
    DERNIERE_MAJ: 9,
    STATUT: 10
};

const VEHICULE_COLUMNS = {
    ID: 0,
    TYPE: 1,
    CAPACITE_KG: 2
};

const COUVERTURE_COLUMNS = {
    ID_BENEVOLE: 0,
    ID_QUARTIER: 1,
    TYPE_COUVERTURE: 2,
    REMARQUES: 3,
    DERNIERE_MAJ: 4
};

const DISPONIBILITE_COLUMNS = {
    ID_BENEVOLE: 0,
    DISPONIBILITE: 1,
    COURT_DELAI_OK: 2,
    REMARQUES: 3,
    DERNIERE_MAJ: 4
};

const FORM_FIELD_MAPPING = {
    keywords: {
        'nom': 'nom',
        'prénom': 'prenom',
        'prenom': 'prenom',
        'téléphone': 'telephone',
        'telephone': 'telephone',
        'disponibilité': 'disponibilites',
        'disponibilite': 'disponibilites',
        'véhicule': 'vehiculeType',
        'vehicule': 'vehiculeType',
        'permis': 'permis',
        'préférences': 'preferences',
        'preferences': 'preferences',
        'livraison': 'preferences'
    },
    values: {
        'oui': true,
        'non': false,
        'yes': true,
        'no': false
    },
    vehicleTypes: {
        'citadine': ['citadine', 'petite voiture', 'petite'],
        'berline': ['berline', 'voiture moyenne', 'moyenne'],
        'suv': ['suv', 'grand véhicule', '4x4', 'grand'],
        'utilitaire': ['utilitaire', 'camionnette', 'fourgon', 'van'],
        'break': ['break', 'familiale']
    },
    availabilitySlots: [
        'Matin',
        'Après-midi',
        'Soirée',
        'Week-end',
        'Semaine',
        'Journée complète'
    ]
};

function getVolunteerScriptConfig() {
    return {
        geoApiUrl: PropertiesService.getScriptProperties().getProperty('GEO_API_URL'),
        geoApiKey: PropertiesService.getScriptProperties().getProperty('GEO_API_KEY'),
        volunteerApiKey: PropertiesService.getScriptProperties().getProperty('VOLUNTEER_API_KEY'),
        webAppUrl: PropertiesService.getScriptProperties().getProperty('WEB_APP_URL'),
        adminEmail: PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL')
    };
}

function generateVolunteerId() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet()
        .getSheetByName(VOLUNTEER_CONFIG.SHEETS.BENEVOLES);

    if (!sheet) {
        throw new Error('Feuille benevoles introuvable');
    }

    const data = sheet.getDataRange().getValues();
    let maxId = 0;

    for (let i = 1; i < data.length; i++) {
        const id = data[i][BENEVOLE_COLUMNS.ID];
        if (id) {
            const num = parseInt(id);
            if (!isNaN(num) && num > maxId) {
                maxId = num;
            }
        }
    }

    const newId = `${String(maxId + 1).padStart(3, '0')}`;
    console.log(`Nouvel ID bénévole généré: ${newId}`);
    return newId;
}

function generateVehicleId() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet()
        .getSheetByName(VOLUNTEER_CONFIG.SHEETS.VEHICULES);

    if (!sheet) {
        throw new Error('Feuille vehicules introuvable');
    }

    const data = sheet.getDataRange().getValues();
    let maxId = 0;

    for (let i = 1; i < data.length; i++) {
        const id = parseInt(data[i][VEHICULE_COLUMNS.ID]);
        if (!isNaN(id) && id > maxId) {
            maxId = id;
        }
    }

    return maxId + 1;
}

function formatVolunteerDateTime(date = new Date()) {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function formatSheetDateTime(date) {
    if (!date) return '';

    if (typeof date === 'string') {
        date = new Date(date);
    }

    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function isValidVolunteerEmail(email) {
    if (!email) return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function normalizeVolunteerPhone(phone) {
    if (!phone) return '';

    let cleaned = String(phone).trim().replace(/\D/g, '');

    if (!cleaned) return '';

    let localNumber = '';

    if (cleaned.startsWith('0033')) {
        localNumber = cleaned.substring(4);
    } else if (cleaned.startsWith('33') && cleaned.length >= 11) {
        localNumber = cleaned.substring(2);
    } else if (cleaned.startsWith('0') && cleaned.length === 10) {
        localNumber = cleaned.substring(1);
    } else if (cleaned.length === 9 && !cleaned.startsWith('0')) {
        localNumber = cleaned;
    } else if (cleaned.length === 10 && cleaned.startsWith('0')) {
        localNumber = cleaned.substring(1);
    } else {
        logVolunteerWarning(`Format téléphone non standard: ${phone} -> ${cleaned}`);

        if (cleaned.length >= 9) {
            localNumber = cleaned.slice(-9);
        } else {
            return `'${cleaned}`;
        }
    }

    if (localNumber.length !== 9) {
        logVolunteerWarning(`Téléphone invalide (doit faire 9 chiffres): ${phone}`);

        if (localNumber.length > 9) {
            localNumber = localNumber.slice(-9);
        } else {
            return `'${cleaned}`;
        }
    }

    const firstDigit = localNumber[0];
    if (!/[1-9]/.test(firstDigit)) {
        logVolunteerWarning(`Téléphone invalide - premier chiffre doit être 1-9: ${phone}`);
        return `'${cleaned}`;
    }

    return `'+33 ${localNumber[0]} ${localNumber.substring(1, 3)} ${localNumber.substring(3, 5)} ${localNumber.substring(5, 7)} ${localNumber.substring(7, 9)}`;
}

function logVolunteerInfo(message, data = null) {
    const timestamp = formatVolunteerDateTime();
    console.log(`[${timestamp}] ℹ️ ${message}`);
    if (data) {
        console.log(JSON.stringify(data, null, 2));
    }
}

function logVolunteerWarning(message, data = null) {
    const timestamp = formatVolunteerDateTime();
    console.warn(`[${timestamp}] ⚠️ ${message}`);
    if (data) {
        console.warn(JSON.stringify(data, null, 2));
    }
}

function logVolunteerError(message, error = null) {
    const timestamp = formatVolunteerDateTime();
    console.error(`[${timestamp}] ❌ ${message}`);
    if (error) {
        console.error(error);
    }
}

function getVolunteerCache(key) {
    try {
        const cache = CacheService.getScriptCache();
        return cache.get(key);
    } catch (error) {
        logVolunteerWarning(`Cache get failed for key: ${key}`, error);
        return null;
    }
}

function setVolunteerCache(key, value, ttl) {
    try {
        const cache = CacheService.getScriptCache();
        cache.put(key, value, ttl);
        return true;
    } catch (error) {
        logVolunteerWarning(`Cache set failed for key: ${key}`, error);
        return false;
    }
}

function notifyVolunteerAdmin(subject, message) {
    try {
        const config = getVolunteerScriptConfig();
        const adminEmail = config.adminEmail;

        if (!adminEmail) {
            logVolunteerWarning('Email admin non configuré');
            return;
        }

        const emailBody = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #1a73e8; color: white; padding: 15px; border-radius: 8px 8px 0 0; }
                    .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
                    .footer { margin-top: 20px; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>🔔 ${subject}</h2>
                    </div>
                    <div class="content">
                        <p>${message.replace(/\n/g, '<br>')}</p>
                        <hr>
                        <p><strong>Timestamp:</strong> ${formatVolunteerDateTime()}</p>
                    </div>
                    <div class="footer">
                        <p>👥 Système de Gestion des Bénévoles - Notification automatique</p>
                    </div>
                </div>
            </body>
            </html>`;

        MailApp.sendEmail({
            to: adminEmail,
            subject: `[Gestion Bénévoles] ${subject}`,
            htmlBody: emailBody
        });

        logVolunteerInfo(`Email envoyé à l'admin: ${subject}`);

    } catch (error) {
        logVolunteerError('Échec envoi email admin', error);
    }
}