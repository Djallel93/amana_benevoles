/**
 * Synchronisation principale avec Google Contacts via People API
 */

function syncVolunteerToContact(volunteerId) {
    try {
        const volunteer = getVolunteerById(volunteerId);

        if (!volunteer) return { success: false, error: 'Bénévole introuvable' };

        const existingContact = findContactByEmail(volunteer.email);

        return existingContact
            ? updateGoogleContact(existingContact, volunteer)
            : createGoogleContact(volunteer);
    } catch (error) {
        logVolunteerError(`Échec sync contact pour ${volunteerId}`, error);
        return { success: false, error: error.toString() };
    }
}

function createGoogleContact(volunteer) {
    try {
        const paddedId = String(volunteer.id).padStart(3, '0');

        const person = {
            names: [{
                givenName: `${paddedId} -`,
                middleName: volunteer.prenom,
                familyName: volunteer.nom
            }],
            emailAddresses: [{ value: volunteer.email, type: 'home' }],
            userDefined: buildCustomFields(volunteer)
        };

        if (volunteer.telephone) {
            person.phoneNumbers = [{
                value: volunteer.telephone.replace(/'/g, ''),
                type: 'mobile'
            }];
        }

        const createdPerson = People.People.createContact(person);

        addToVolunteerGroup(createdPerson.resourceName);
        applyStatusLabel(createdPerson.resourceName, volunteer.statut);
        applyTirelireLabel(createdPerson.resourceName, volunteer.confiance);

        logVolunteerInfo(`Contact Google créé pour ${volunteer.id}`);

        return { success: true, contactId: createdPerson.resourceName };
    } catch (error) {
        logVolunteerError('Échec création contact Google', error);
        return { success: false, error: error.toString() };
    }
}

function updateGoogleContact(existingContact, volunteer) {
    try {
        const paddedId = String(volunteer.id).padStart(3, '0');

        const person = {
            resourceName: existingContact.resourceName,
            etag: existingContact.etag,
            names: [{
                givenName: `${paddedId} -`,
                middleName: volunteer.prenom,
                familyName: volunteer.nom
            }],
            emailAddresses: [{ value: volunteer.email, type: 'home' }],
            userDefined: buildCustomFields(volunteer)
        };

        if (volunteer.telephone) {
            person.phoneNumbers = [{
                value: volunteer.telephone.replace(/'/g, ''),
                type: 'mobile'
            }];
        }

        const updatedPerson = People.People.updateContact(
            person,
            existingContact.resourceName,
            { updatePersonFields: 'names,emailAddresses,phoneNumbers,userDefined' }
        );

        applyStatusLabel(updatedPerson.resourceName, volunteer.statut);
        applyTirelireLabel(updatedPerson.resourceName, volunteer.confiance);

        logVolunteerInfo(`Contact Google mis à jour pour ${volunteer.id}`);

        return { success: true, contactId: updatedPerson.resourceName };
    } catch (error) {
        logVolunteerError('Échec mise à jour contact Google', error);
        return { success: false, error: error.toString() };
    }
}

function buildCustomFields(volunteer) {
    const customFields = [];

    customFields.push({ key: 'Inscrit le', value: formatSheetDateTime(volunteer.dateInscription) });
    customFields.push({ key: 'Dernière MAJ', value: formatSheetDateTime(volunteer.derniereMaj) });

    if (volunteer.idVehicule) {
        const vehicle = getVehicleById(volunteer.idVehicule);
        if (vehicle) {
            let vehicleLabel = `${vehicle.type} (${vehicle.capaciteKg} kg)`;
            if (vehicle.nombrePartMax !== null && vehicle.nombrePartMax !== undefined && vehicle.nombrePartMax !== '') {
                vehicleLabel += ` - max ${vehicle.nombrePartMax} part.`;
            }
            customFields.push({ key: 'Véhicule', value: vehicleLabel });
        }
    }

    const availabilities = getVolunteerAvailabilities(volunteer.id);
    if (availabilities.length > 0) {
        const dispoList = availabilities.map(avail => {
            return avail.courtDelaiOk
                ? `${avail.disponibilite} (Court délai)`
                : avail.disponibilite;
        }).join(', ');

        customFields.push({ key: 'Disponibilités', value: dispoList });
    }

    return customFields;
}

function findContactByEmail(email) {
    try {
        const response = People.People.searchContacts({
            query: email,
            readMask: 'names,emailAddresses,phoneNumbers,userDefined,memberships'
        });

        if (!response.results || response.results.length === 0) return null;

        for (const result of response.results) {
            const person = result.person;
            if (person.emailAddresses) {
                for (const emailAddr of person.emailAddresses) {
                    if (emailAddr.value === email) return person;
                }
            }
        }

        return null;
    } catch (error) {
        logVolunteerError(`Échec recherche contact par email: ${email}`, error);
        return null;
    }
}

function deleteVolunteerContact(volunteerId) {
    try {
        const volunteer = getVolunteerById(volunteerId);

        if (!volunteer) return { success: false, error: 'Bénévole introuvable' };

        const contact = findContactByEmail(volunteer.email);

        if (!contact) return { success: false, error: 'Contact Google introuvable' };

        People.People.deleteContact(contact.resourceName);

        logVolunteerInfo(`Contact Google supprimé pour ${volunteerId}`);

        return { success: true };
    } catch (error) {
        logVolunteerError('Échec suppression contact', error);
        return { success: false, error: error.toString() };
    }
}

function syncAllVolunteersToContacts() {
    try {
        const volunteers = getAllVolunteers({ actif: true });
        const results = { total: volunteers.length, synced: 0, failed: 0, errors: [] };

        volunteers.forEach(volunteer => {
            const result = syncVolunteerToContact(volunteer.id);

            if (result.success) {
                results.synced++;
            } else {
                results.failed++;
                results.errors.push({ volunteerId: volunteer.id, error: result.error });
            }

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
        return { total: 0, synced: 0, failed: 0, errors: [error.toString()] };
    }
}