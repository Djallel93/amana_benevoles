/**
 * @file contactGroupsLabels.js
 * @description Gestion des groupes et labels Google Contacts
 */

function addToVolunteerGroup(resourceName) {
    try {
        const groupName = 'Bénévoles';
        let contactGroupResourceName = null;

        const listResponse = People.ContactGroups.list();

        if (listResponse.contactGroups) {
            for (const group of listResponse.contactGroups) {
                if (group.name === groupName) {
                    contactGroupResourceName = group.resourceName;
                    break;
                }
            }
        }

        if (!contactGroupResourceName) {
            const newGroup = People.ContactGroups.create({
                contactGroup: {
                    name: groupName
                }
            });
            contactGroupResourceName = newGroup.resourceName;
            logVolunteerInfo(`Groupe de contacts "${groupName}" créé`);
        }

        People.ContactGroups.Members.modify(
            {
                resourceNamesToAdd: [resourceName]
            },
            contactGroupResourceName
        );

    } catch (error) {
        logVolunteerWarning('Échec ajout contact au groupe', error);
    }
}

function applyStatusLabel(resourceName, statut) {
    try {
        if (statut !== VOLUNTEER_CONFIG.STATUS.REJETE &&
            statut !== VOLUNTEER_CONFIG.STATUS.ARCHIVE) {
            removeStatusLabels(resourceName);
            return;
        }

        const labelName = statut === VOLUNTEER_CONFIG.STATUS.REJETE ? 'Rejeté' : 'Archivé';
        let labelResourceName = findOrCreateLabel(labelName);

        if (!labelResourceName) {
            logVolunteerWarning(`Impossible de créer/trouver le label: ${labelName}`);
            return;
        }

        removeAllVolunteerLabels(resourceName);

        People.ContactGroups.Members.modify(
            {
                resourceNamesToAdd: [resourceName]
            },
            labelResourceName
        );

        logVolunteerInfo(`Label "${labelName}" appliqué au contact (tous les autres labels supprimés)`);

    } catch (error) {
        logVolunteerWarning('Échec application label de statut', error);
    }
}

function applyTirelireLabel(resourceName, confiance) {
    try {
        const labelName = 'Tirelire';

        if (confiance === true) {
            let labelResourceName = findOrCreateLabel(labelName);

            if (!labelResourceName) {
                logVolunteerWarning(`Impossible de créer/trouver le label: ${labelName}`);
                return;
            }

            People.ContactGroups.Members.modify(
                {
                    resourceNamesToAdd: [resourceName]
                },
                labelResourceName
            );

            logVolunteerInfo(`Label "${labelName}" appliqué au contact`);
        } else {
            removeTirelireLabel(resourceName);
        }

    } catch (error) {
        logVolunteerWarning('Échec application label Tirelire', error);
    }
}

function findOrCreateLabel(labelName) {
    try {
        const listResponse = People.ContactGroups.list();

        if (listResponse.contactGroups) {
            for (const group of listResponse.contactGroups) {
                if (group.name === labelName && group.groupType === 'USER_CONTACT_GROUP') {
                    return group.resourceName;
                }
            }
        }

        const newGroup = People.ContactGroups.create({
            contactGroup: {
                name: labelName
            }
        });

        logVolunteerInfo(`Label "${labelName}" créé`);
        return newGroup.resourceName;

    } catch (error) {
        logVolunteerError(`Échec création label: ${labelName}`, error);
        return null;
    }
}

function removeStatusLabels(resourceName) {
    try {
        const statusLabels = ['Rejeté', 'Archivé'];
        const listResponse = People.ContactGroups.list();

        if (!listResponse.contactGroups) return;

        statusLabels.forEach(labelName => {
            for (const group of listResponse.contactGroups) {
                if (group.name === labelName && group.groupType === 'USER_CONTACT_GROUP') {
                    try {
                        People.ContactGroups.Members.modify(
                            {
                                resourceNamesToRemove: [resourceName]
                            },
                            group.resourceName
                        );
                    } catch (e) {
                        // Ignore si le contact n'est pas dans le groupe
                    }
                    break;
                }
            }
        });

    } catch (error) {
        logVolunteerWarning('Échec suppression labels de statut', error);
    }
}

function removeTirelireLabel(resourceName) {
    try {
        const labelName = 'Tirelire';
        const listResponse = People.ContactGroups.list();

        if (!listResponse.contactGroups) return;

        for (const group of listResponse.contactGroups) {
            if (group.name === labelName && group.groupType === 'USER_CONTACT_GROUP') {
                try {
                    People.ContactGroups.Members.modify(
                        {
                            resourceNamesToRemove: [resourceName]
                        },
                        group.resourceName
                    );
                    logVolunteerInfo(`Label "${labelName}" retiré du contact`);
                } catch (e) {
                    // Ignore si le contact n'est pas dans le groupe
                }
                break;
            }
        }

    } catch (error) {
        logVolunteerWarning('Échec suppression label Tirelire', error);
    }
}

function removeAllVolunteerLabels(resourceName) {
    try {
        const allVolunteerLabels = ['Rejeté', 'Archivé', 'Tirelire'];
        const listResponse = People.ContactGroups.list();

        if (!listResponse.contactGroups) return;

        allVolunteerLabels.forEach(labelName => {
            for (const group of listResponse.contactGroups) {
                if (group.name === labelName && group.groupType === 'USER_CONTACT_GROUP') {
                    try {
                        People.ContactGroups.Members.modify(
                            {
                                resourceNamesToRemove: [resourceName]
                            },
                            group.resourceName
                        );
                    } catch (e) {
                        // Ignore si le contact n'est pas dans le groupe
                    }
                    break;
                }
            }
        });

        logVolunteerInfo('Tous les labels de bénévole supprimés');

    } catch (error) {
        logVolunteerWarning('Échec suppression labels de bénévole', error);
    }
}