/**
 * @file contactService.js
 * @description Synchronisation avec Google Contacts
 */

/**
 * Crée ou met à jour un contact Google depuis un bénévole
 * @param {string} volunteerId - ID du bénévole
 * @returns {Object} {success: boolean, contactId?: string, error?: string}
 */
function syncVolunteerToContact(volunteerId) {
    try {
        const volunteer = getVolunteerById(volunteerId);

        if (!volunteer) {
            return {
                success: false,
                error: 'Bénévole introuvable'
            };
        }

        // Recherche d'un contact existant par email
        const existingContact = findContactByEmail(volunteer.email);

        if (existingContact) {
            // Mise à jour du contact existant
            return updateGoogleContact(existingContact, volunteer);
        } else {
            // Création d'un nouveau contact
            return createGoogleContact(volunteer);
        }

    } catch (error) {
        logVolunteerError(`Échec sync contact pour ${volunteerId}`, error);
        return {
            success: false,
            error: error.toString()
        };
    }
}

/**
 * Crée un nouveau contact Google
 * @param {Object} volunteer - Données du bénévole
 * @returns {Object} Résultat de la création
 */
function createGoogleContact(volunteer) {
    try {
        const contact = ContactsApp.createContact(
            volunteer.prenom,
            volunteer.nom,
            volunteer.email
        );

        // Ajout du numéro de téléphone
        if (volunteer.telephone) {
            contact.addPhone(ContactsApp.Field.MOBILE_PHONE, volunteer.telephone);
        }

        // Ajout de notes
        const notes = buildContactNotes(volunteer);
        contact.setNotes(notes);

        // Ajout dans un groupe "Bénévoles"
        addToVolunteerGroup(contact);

        logVolunteerInfo(`Contact Google créé pour ${volunteer.id}`);

        return {
            success: true,
            contactId: contact.getId()
        };

    } catch (error) {
        logVolunteerError('Échec création contact Google', error);
        return {
            success: false,
            error: error.toString()
        };
    }
}

/**
 * Met à jour un contact Google existant
 * @param {Contact} contact - Contact Google
 * @param {Object} volunteer - Données du bénévole
 * @returns {Object} Résultat de la mise à jour
 */
function updateGoogleContact(contact, volunteer) {
    try {
        // Mise à jour du nom
        contact.setGivenName(volunteer.prenom);
        contact.setFamilyName(volunteer.nom);

        // Mise à jour de l'email
        const emails = contact.getEmails();
        if (emails.length > 0) {
            contact.removeEmail(emails[0]);
        }
        contact.addEmail(ContactsApp.Field.HOME_EMAIL, volunteer.email);

        // Mise à jour du téléphone
        const phones = contact.getPhones();
        if (phones.length > 0) {
            contact.removePhone(phones[0]);
        }
        if (volunteer.telephone) {
            contact.addPhone(ContactsApp.Field.MOBILE_PHONE, volunteer.telephone);
        }

        // Mise à jour des notes
        const notes = buildContactNotes(volunteer);
        contact.setNotes(notes);

        logVolunteerInfo(`Contact Google mis à jour pour ${volunteer.id}`);

        return {
            success: true,
            contactId: contact.getId()
        };

    } catch (error) {
        logVolunteerError('Échec mise à jour contact Google', error);
        return {
            success: false,
            error: error.toString()
        };
    }
}

/**
 * Construit les notes du contact
 * @param {Object} volunteer - Données du bénévole
 * @returns {string} Notes formatées
 */
function buildContactNotes(volunteer) {
    let notes = `🆔 ID: ${volunteer.id}\n`;
    notes += `📅 Inscrit le: ${volunteer.dateInscription}\n`;
    notes += `✅ Statut: ${volunteer.statut}\n`;
    notes += `🔄 Actif: ${volunteer.actif ? 'Oui' : 'Non'}\n`;

    if (volunteer.confiance) {
        notes += `🔒 Bénévole de confiance\n`;
    }

    if (volunteer.idVehicule) {
        const vehicle = getVehicleById(volunteer.idVehicule);
        if (vehicle) {
            notes += `🚗 Véhicule: ${vehicle.type} (${vehicle.capaciteKg} kg)\n`;
        }
    }

    // Disponibilités
    const availabilities = getVolunteerAvailabilities(volunteer.id);
    if (availabilities.length > 0) {
        notes += `\n⏰ Disponibilités:\n`;
        availabilities.forEach(avail => {
            notes += `  • ${avail.disponibilite}`;
            if (avail.courtDelaiOk) {
                notes += ' (Court délai OK)';
            }
            notes += '\n';
        });
    }

    notes += `\n📝 Dernière mise à jour: ${volunteer.derniereMaj}`;

    return notes;
}

/**
 * Recherche un contact par email
 * @param {string} email - Email à rechercher
 * @returns {Contact|null} Contact trouvé ou null
 */
function findContactByEmail(email) {
    try {
        const contacts = ContactsApp.getContactsByEmailAddress(email);
        return contacts.length > 0 ? contacts[0] : null;
    } catch (error) {
        logVolunteerError(`Échec recherche contact par email: ${email}`, error);
        return null;
    }
}

/**
 * Ajoute un contact au groupe "Bénévoles"
 * @param {Contact} contact - Contact à ajouter
 */
function addToVolunteerGroup(contact) {
    try {
        const groupName = 'Bénévoles';
        let group = null;

        // Recherche du groupe
        const groups = ContactsApp.getContactGroups();
        for (let i = 0; i < groups.length; i++) {
            if (groups[i].getName() === groupName) {
                group = groups[i];
                break;
            }
        }

        // Création du groupe s'il n'existe pas
        if (!group) {
            group = ContactsApp.createContactGroup(groupName);
            logVolunteerInfo(`Groupe de contacts "${groupName}" créé`);
        }

        // Ajout du contact au groupe
        contact.addToGroup(group);

    } catch (error) {
        logVolunteerWarning('Échec ajout contact au groupe', error);
    }
}

/**
 * Synchronise tous les bénévoles actifs vers Google Contacts
 * @returns {Object} Résultats de la synchronisation
 */
function syncAllVolunteersToContacts() {
    try {
        const volunteers = getAllVolunteers({ actif: true });

        const results = {
            total: volunteers.length,
            synced: 0,
            failed: 0,
            errors: []
        };

        volunteers.forEach(volunteer => {
            const result = syncVolunteerToContact(volunteer.id);

            if (result.success) {
                results.synced++;
            } else {
                results.failed++;
                results.errors.push({
                    volunteerId: volunteer.id,
                    error: result.error
                });
            }

            // Petit délai pour éviter les quotas
            Utilities.sleep(100);
        });

        logVolunteerInfo('Synchronisation contacts terminée', results);

        notifyVolunteerAdmin(
            'Synchronisation Google Contacts',
            `Total: ${results.total}\nSynchronisés: ${results.synced}\nÉchecs: ${results.failed}`
        );

        return results;

    } catch (error) {
        logVolunteerError('Échec synchronisation massive contacts', error);
        return {
            total: 0,
            synced: 0,
            failed: 0,
            errors: [error.toString()]
        };
    }
}

/**
 * Supprime un contact Google pour un bénévole
 * @param {string} volunteerId - ID du bénévole
 * @returns {Object} Résultat de la suppression
 */
function deleteVolunteerContact(volunteerId) {
    try {
        const volunteer = getVolunteerById(volunteerId);

        if (!volunteer) {
            return {
                success: false,
                error: 'Bénévole introuvable'
            };
        }

        const contact = findContactByEmail(volunteer.email);

        if (!contact) {
            return {
                success: false,
                error: 'Contact Google introuvable'
            };
        }

        ContactsApp.deleteContact(contact);

        logVolunteerInfo(`Contact Google supprimé pour ${volunteerId}`);

        return {
            success: true
        };

    } catch (error) {
        logVolunteerError('Échec suppression contact', error);
        return {
            success: false,
            error: error.toString()
        };
    }
}