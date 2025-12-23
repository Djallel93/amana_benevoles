/**
 * @file reverseContactService.js
 * @description Synchronisation inverse: Google Contacts → Google Sheets
 */

/**
 * Met à jour un bénévole depuis Google Contacts
 * @param {string} email - Email du contact
 * @returns {Object} {success: boolean, updated?: Array, error?: string}
 */
function updateVolunteerFromContact(email) {
    try {
        // Recherche du bénévole par email
        const volunteer = findVolunteerByEmail(email);

        if (!volunteer) {
            return {
                success: false,
                error: `Aucun bénévole trouvé avec l'email ${email}`
            };
        }

        // Recherche du contact Google
        const contact = findContactByEmail(email);

        if (!contact) {
            return {
                success: false,
                error: `Aucun contact Google trouvé avec l'email ${email}`
            };
        }

        // Extraction des données du contact
        const contactData = extractContactData(contact);

        // Vérification des changements
        const changes = detectContactChanges(volunteer, contactData);

        if (changes.length === 0) {
            return {
                success: true,
                message: 'Aucun changement détecté',
                updated: []
            };
        }

        // Mise à jour du bénévole
        const updateData = {};

        if (changes.includes('nom')) {
            updateData.nom = contactData.nom;
        }
        if (changes.includes('prenom')) {
            updateData.prenom = contactData.prenom;
        }
        if (changes.includes('telephone')) {
            updateData.telephone = contactData.telephone;
        }
        if (changes.includes('email')) {
            updateData.email = contactData.email;
        }

        const result = updateVolunteer(volunteer.id, updateData);

        if (!result.success) {
            return result;
        }

        logVolunteerInfo(`Bénévole ${volunteer.id} mis à jour depuis Google Contacts`, changes);

        return {
            success: true,
            updated: changes,
            volunteerId: volunteer.id
        };

    } catch (error) {
        logVolunteerError(`Échec mise à jour depuis contact: ${email}`, error);
        return {
            success: false,
            error: error.toString()
        };
    }
}

/**
 * Extrait les données d'un contact Google
 * @param {Contact} contact - Contact Google
 * @returns {Object} Données extraites
 */
function extractContactData(contact) {
    const data = {
        prenom: contact.getGivenName() || '',
        nom: contact.getFamilyName() || '',
        email: '',
        telephone: ''
    };

    // Récupération de l'email
    const emails = contact.getEmails();
    if (emails.length > 0) {
        data.email = emails[0].getAddress();
    }

    // Récupération du téléphone
    const phones = contact.getPhones();
    if (phones.length > 0) {
        data.telephone = phones[0].getPhoneNumber();
    }

    return data;
}

/**
 * Détecte les changements entre un bénévole et un contact
 * @param {Object} volunteer - Données du bénévole
 * @param {Object} contactData - Données du contact
 * @returns {Array} Liste des champs modifiés
 */
function detectContactChanges(volunteer, contactData) {
    const changes = [];

    if (volunteer.nom !== contactData.nom && contactData.nom) {
        changes.push('nom');
    }

    if (volunteer.prenom !== contactData.prenom && contactData.prenom) {
        changes.push('prenom');
    }

    if (volunteer.email !== contactData.email && contactData.email) {
        changes.push('email');
    }

    // Normalisation des téléphones pour comparaison
    const normalizedVolunteerPhone = normalizePhoneForComparison(volunteer.telephone);
    const normalizedContactPhone = normalizePhoneForComparison(contactData.telephone);

    if (normalizedVolunteerPhone !== normalizedContactPhone && contactData.telephone) {
        changes.push('telephone');
    }

    return changes;
}

/**
 * Normalise un téléphone pour comparaison
 * @param {string} phone - Numéro de téléphone
 * @returns {string} Téléphone normalisé (chiffres seulement)
 */
function normalizePhoneForComparison(phone) {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
}

/**
 * Synchronise tous les bénévoles depuis Google Contacts
 * @returns {Object} Résultats de la synchronisation
 */
function syncAllContactsToVolunteers() {
    try {
        const volunteers = getAllVolunteers({ actif: true });

        const results = {
            total: volunteers.length,
            updated: 0,
            unchanged: 0,
            failed: 0,
            errors: [],
            details: []
        };

        volunteers.forEach(volunteer => {
            if (!volunteer.email) {
                results.unchanged++;
                return;
            }

            const result = updateVolunteerFromContact(volunteer.email);

            if (result.success) {
                if (result.updated && result.updated.length > 0) {
                    results.updated++;
                    results.details.push({
                        volunteerId: volunteer.id,
                        changes: result.updated
                    });
                } else {
                    results.unchanged++;
                }
            } else {
                results.failed++;
                results.errors.push({
                    volunteerId: volunteer.id,
                    email: volunteer.email,
                    error: result.error
                });
            }

            // Délai pour éviter les quotas
            Utilities.sleep(100);
        });

        logVolunteerInfo('Synchronisation inverse contacts terminée', results);

        if (results.updated > 0) {
            notifyVolunteerAdmin(
                'Synchronisation inverse Google Contacts',
                `Total: ${results.total}\nMis à jour: ${results.updated}\nInchangés: ${results.unchanged}\nÉchecs: ${results.failed}`
            );
        }

        return results;

    } catch (error) {
        logVolunteerError('Échec synchronisation inverse massive', error);
        return {
            total: 0,
            updated: 0,
            unchanged: 0,
            failed: 0,
            errors: [error.toString()],
            details: []
        };
    }
}

/**
 * Détecte les contacts modifiés récemment
 * @param {number} hoursAgo - Nombre d'heures en arrière
 * @returns {Array} Liste des contacts modifiés
 */
function detectRecentContactChanges(hoursAgo = 24) {
    try {
        const cutoffDate = new Date();
        cutoffDate.setHours(cutoffDate.getHours() - hoursAgo);

        const allContacts = ContactsApp.getContacts();
        const recentChanges = [];

        allContacts.forEach(contact => {
            const lastUpdated = contact.getLastUpdated();

            if (lastUpdated && lastUpdated > cutoffDate) {
                const emails = contact.getEmails();
                if (emails.length > 0) {
                    const email = emails[0].getAddress();
                    const volunteer = findVolunteerByEmail(email);

                    if (volunteer) {
                        recentChanges.push({
                            email: email,
                            volunteerId: volunteer.id,
                            lastUpdated: lastUpdated
                        });
                    }
                }
            }
        });

        return recentChanges;

    } catch (error) {
        logVolunteerError('Échec détection changements contacts récents', error);
        return [];
    }
}

/**
 * Synchronise uniquement les contacts modifiés récemment
 * @param {number} hoursAgo - Nombre d'heures en arrière
 * @returns {Object} Résultats de la synchronisation
 */
function syncRecentContactChanges(hoursAgo = 24) {
    try {
        const recentChanges = detectRecentContactChanges(hoursAgo);

        const results = {
            total: recentChanges.length,
            updated: 0,
            unchanged: 0,
            failed: 0,
            errors: []
        };

        recentChanges.forEach(change => {
            const result = updateVolunteerFromContact(change.email);

            if (result.success) {
                if (result.updated && result.updated.length > 0) {
                    results.updated++;
                } else {
                    results.unchanged++;
                }
            } else {
                results.failed++;
                results.errors.push({
                    email: change.email,
                    volunteerId: change.volunteerId,
                    error: result.error
                });
            }
        });

        logVolunteerInfo(`Synchronisation contacts récents (${hoursAgo}h) terminée`, results);

        return results;

    } catch (error) {
        logVolunteerError('Échec synchronisation contacts récents', error);
        return {
            total: 0,
            updated: 0,
            unchanged: 0,
            failed: 0,
            errors: [error.toString()]
        };
    }
}