/**
 * @file utils.js
 * @description Fonctions utilitaires génériques
 */

/**
 * Valide un objet de données contre un schéma
 * @param {Object} data - Données à valider
 * @param {Object} schema - Schéma de validation
 * @returns {Object} {isValid: boolean, errors: Array}
 */
function validateDataSchema(data, schema) {
    const errors = [];

    Object.keys(schema).forEach(key => {
        const rule = schema[key];
        const value = data[key];

        // Vérification requis
        if (rule.required && (value === undefined || value === null || value === '')) {
            errors.push(`${key} est requis`);
            return;
        }

        // Vérification type
        if (value !== undefined && value !== null && rule.type) {
            const actualType = typeof value;
            if (actualType !== rule.type) {
                errors.push(`${key} doit être de type ${rule.type}`);
            }
        }

        // Vérification longueur min
        if (value && rule.minLength && value.length < rule.minLength) {
            errors.push(`${key} doit contenir au moins ${rule.minLength} caractères`);
        }

        // Vérification longueur max
        if (value && rule.maxLength && value.length > rule.maxLength) {
            errors.push(`${key} doit contenir au maximum ${rule.maxLength} caractères`);
        }

        // Validation personnalisée
        if (value && rule.validator && typeof rule.validator === 'function') {
            if (!rule.validator(value)) {
                errors.push(`${key} n'est pas valide`);
            }
        }
    });

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

/**
 * Convertit une date en format ISO court (YYYY-MM-DD)
 * @param {Date} date - Date à convertir
 * @returns {string} Date formatée
 */
function toIsoDateString(date) {
    if (!date) return '';
    const d = new Date(date);
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/**
 * Calcule la différence en jours entre deux dates
 * @param {Date} date1 - Première date
 * @param {Date} date2 - Deuxième date
 * @returns {number} Nombre de jours
 */
function daysBetween(date1, date2) {
    const oneDay = 24 * 60 * 60 * 1000;
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.round(Math.abs((d1 - d2) / oneDay));
}

/**
 * Supprime les doublons d'un tableau
 * @param {Array} array - Tableau source
 * @returns {Array} Tableau sans doublons
 */
function removeDuplicates(array) {
    return [...new Set(array)];
}

/**
 * Trie un tableau d'objets par une propriété
 * @param {Array} array - Tableau à trier
 * @param {string} property - Propriété de tri
 * @param {boolean} ascending - Ordre croissant
 * @returns {Array} Tableau trié
 */
function sortByProperty(array, property, ascending = true) {
    return array.sort((a, b) => {
        const valA = a[property];
        const valB = b[property];

        if (valA < valB) return ascending ? -1 : 1;
        if (valA > valB) return ascending ? 1 : -1;
        return 0;
    });
}

/**
 * Groupe un tableau d'objets par une propriété
 * @param {Array} array - Tableau à grouper
 * @param {string} property - Propriété de groupement
 * @returns {Object} Objet avec groupes
 */
function groupBy(array, property) {
    return array.reduce((groups, item) => {
        const key = item[property];
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(item);
        return groups;
    }, {});
}

/**
 * Filtre un tableau d'objets selon des critères
 * @param {Array} array - Tableau à filtrer
 * @param {Object} filters - Filtres à appliquer
 * @returns {Array} Tableau filtré
 */
function filterByMultipleCriteria(array, filters) {
    return array.filter(item => {
        return Object.keys(filters).every(key => {
            const filterValue = filters[key];
            const itemValue = item[key];

            if (filterValue === undefined || filterValue === null) {
                return true;
            }

            return itemValue === filterValue;
        });
    });
}

/**
 * Convertit une chaîne en format titre (première lettre en majuscule)
 * @param {string} str - Chaîne à convertir
 * @returns {string} Chaîne formatée
 */
function toTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Tronque une chaîne à une longueur maximale
 * @param {string} str - Chaîne à tronquer
 * @param {number} maxLength - Longueur maximale
 * @param {string} suffix - Suffixe à ajouter (défaut: '...')
 * @returns {string} Chaîne tronquée
 */
function truncateString(str, maxLength, suffix = '...') {
    if (!str || str.length <= maxLength) return str;
    return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Vérifie si une valeur est vide (null, undefined, '', [], {})
 * @param {*} value - Valeur à vérifier
 * @returns {boolean} True si vide
 */
function isEmpty(value) {
    if (value === null || value === undefined || value === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (typeof value === 'object' && Object.keys(value).length === 0) return true;
    return false;
}

/**
 * Clone profond d'un objet
 * @param {Object} obj - Objet à cloner
 * @returns {Object} Objet cloné
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Fusionne deux objets en profondeur
 * @param {Object} target - Objet cible
 * @param {Object} source - Objet source
 * @returns {Object} Objet fusionné
 */
function deepMerge(target, source) {
    const output = Object.assign({}, target);

    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }

    return output;
}

/**
 * Vérifie si une valeur est un objet
 * @param {*} item - Valeur à vérifier
 * @returns {boolean} True si objet
 */
function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Génère un UUID simple
 * @returns {string} UUID
 */
function generateUUID() {
    return Utilities.getUuid();
}

/**
 * Convertit une valeur en booléen de manière sûre
 * @param {*} value - Valeur à convertir
 * @returns {boolean} Booléen
 */
function toBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const lower = value.toLowerCase().trim();
        return lower === 'true' || lower === '1' || lower === 'yes' || lower === 'oui';
    }
    if (typeof value === 'number') return value !== 0;
    return false;
}

/**
 * Extrait les nombres d'une chaîne
 * @param {string} str - Chaîne source
 * @returns {string} Nombres extraits
 */
function extractNumbers(str) {
    if (!str) return '';
    return str.replace(/\D/g, '');
}

/**
 * Formate un nombre avec des séparateurs de milliers
 * @param {number} number - Nombre à formater
 * @param {string} separator - Séparateur (défaut: espace)
 * @returns {string} Nombre formaté
 */
function formatNumber(number, separator = ' ') {
    if (number === null || number === undefined) return '';
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/**
 * Calcule un hash simple d'une chaîne
 * @param {string} str - Chaîne à hasher
 * @returns {number} Hash
 */
function simpleHash(str) {
    let hash = 0;
    if (!str || str.length === 0) return hash;

    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }

    return Math.abs(hash);
}

/**
 * Retry une fonction avec backoff exponentiel
 * @param {Function} fn - Fonction à exécuter
 * @param {number} maxRetries - Nombre maximum de tentatives
 * @param {number} delay - Délai initial en ms
 * @returns {*} Résultat de la fonction
 */
function retryWithBackoff(fn, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            Utilities.sleep(delay * Math.pow(2, i));
        }
    }
}