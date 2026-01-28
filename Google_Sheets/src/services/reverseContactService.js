/**
 * @file reverseContactService.js
 * @description Synchronisation inverse: Google Contacts → Google Sheets (People API)
 */

function updateVolunteerFromContact(email) {
    try {
        const volunteer = findVolunteerByEmail(email);

        if (!volunteer) {
            return {
                success: false,
                error: `Aucun bénévole trouvé avec l'email ${email}`
            };
        }

        const contact = findContactByEmail(email);

        if (!contact) {
            return {
                success: false,
                error: `Aucun contact Google trouvé avec l'email ${email}`
            };
        }

        const contactData = extractContactData(contact);

        const changes = detectContactChanges(volunteer, contactData);

        if (changes.length === 0) {
            return {
                success: true,
                message: 'Aucun changement détecté',
                updated: []
            };
        }

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

function extractContactData(contact) {
    const data = {
        prenom: '',
        nom: '',
        email: '',
        telephone: ''
    };

    if (contact.names && contact.names.length > 0) {
        data.prenom = contact.names[0].givenName || '';
        data.nom = contact.names[0].familyName || '';
    }

    if (contact.emailAddresses && contact.emailAddresses.length > 0) {
        data.email = contact.emailAddresses[0].value;
    }

    if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
        data.telephone = contact.phoneNumbers[0].value;
    }

    return data;
}

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

    const normalizedVolunteerPhone = normalizePhoneForComparison(volunteer.telephone);
    const normalizedContactPhone = normalizePhoneForComparison(contactData.telephone);

    if (normalizedVolunteerPhone !== normalizedContactPhone && contactData.telephone) {
        changes.push('telephone');
    }

    return changes;
}

function normalizePhoneForComparison(phone) {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
}

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

function detectRecentContactChanges(hoursAgo = 24) {
    try {
        const cutoffDate = new Date();
        cutoffDate.setHours(cutoffDate.getHours() - hoursAgo);

        const volunteers = getAllVolunteers({ actif: true });
        const recentChanges = [];

        volunteers.forEach(volunteer => {
            if (!volunteer.email) return;

            const contact = findContactByEmail(volunteer.email);
            if (!contact) return;

            if (contact.metadata && contact.metadata.sources) {
                for (const source of contact.metadata.sources) {
                    if (source.updateTime) {
                        const updateDate = new Date(source.updateTime);
                        if (updateDate > cutoffDate) {
                            recentChanges.push({
                                email: volunteer.email,
                                volunteerId: volunteer.id,
                                lastUpdated: updateDate
                            });
                            break;
                        }
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