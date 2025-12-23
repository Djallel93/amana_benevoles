/**
 * @file editVolunteer.js
 * @description JavaScript pour le formulaire de modification de bénévole
 */

let volunteers = [];

// Initialisation au chargement de la page
window.onload = function () {
    loadVolunteers();
    loadVehicles();
};

/**
 * Charge la liste des bénévoles
 */
function loadVolunteers() {
    document.getElementById('loadingBox').style.display = 'block';
    google.script.run
        .withSuccessHandler(function (data) {
            volunteers = data;
            displayVolunteers(data);
            document.getElementById('loadingBox').style.display = 'none';
        })
        .withFailureHandler(onError)
        .getAllVolunteers({});
}

/**
 * Charge la liste des véhicules
 */
function loadVehicles() {
    google.script.run
        .withSuccessHandler(populateVehicles)
        .getAllVehicles();
}

/**
 * Remplit le sélecteur de véhicules
 * @param {Array} vehicles - Liste des véhicules
 */
function populateVehicles(vehicles) {
    const select = document.getElementById('vehicule');
    vehicles.forEach(vehicle => {
        const option = document.createElement('option');
        option.value = vehicle.id;
        option.textContent = `${vehicle.type} (${vehicle.capaciteKg} kg)`;
        select.appendChild(option);
    });
}

/**
 * Affiche la liste des bénévoles
 * @param {Array} data - Liste des bénévoles
 */
function displayVolunteers(data) {
    const list = document.getElementById('volunteerList');
    list.innerHTML = '';

    if (data.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #666;">Aucun bénévole trouvé</p>';
        return;
    }

    data.forEach(volunteer => {
        const item = document.createElement('div');
        item.className = 'volunteer-item';

        let badges = '';
        if (volunteer.actif) {
            badges += '<span class="info-badge badge-active">Actif</span>';
        } else {
            badges += '<span class="info-badge badge-inactive">Inactif</span>';
        }
        if (volunteer.confiance) {
            badges += '<span class="info-badge badge-trust">Confiance</span>';
        }

        item.innerHTML = `
            <strong>${volunteer.prenom} ${volunteer.nom}</strong> ${badges}<br>
            <small style="color: #666;">${volunteer.email} | ${volunteer.statut}</small>
        `;

        item.onclick = () => selectVolunteer(volunteer);
        list.appendChild(item);
    });
}

/**
 * Gère la recherche de bénévoles
 */
document.getElementById('searchInput').addEventListener('input', function (e) {
    const term = e.target.value.toLowerCase();
    const filtered = volunteers.filter(v =>
        v.nom.toLowerCase().includes(term) ||
        v.prenom.toLowerCase().includes(term) ||
        v.email.toLowerCase().includes(term)
    );
    displayVolunteers(filtered);
});

/**
 * Sélectionne un bénévole pour l'édition
 * @param {Object} volunteer - Données du bénévole
 */
function selectVolunteer(volunteer) {
    document.getElementById('searchSection').style.display = 'none';
    document.getElementById('editForm').style.display = 'block';

    document.getElementById('volunteerId').value = volunteer.id;
    document.getElementById('nom').value = volunteer.nom;
    document.getElementById('prenom').value = volunteer.prenom;
    document.getElementById('email').value = volunteer.email;
    document.getElementById('telephone').value = volunteer.telephone;
    document.getElementById('statut').value = volunteer.statut;
    document.getElementById('actif').checked = volunteer.actif;
    document.getElementById('confiance').checked = volunteer.confiance;
    document.getElementById('vehicule').value = volunteer.idVehicule || '';
}

/**
 * Annule l'édition et retourne à la liste
 */
function cancelEdit() {
    document.getElementById('editForm').style.display = 'none';
    document.getElementById('searchSection').style.display = 'block';
    document.getElementById('editForm').reset();
    document.getElementById('searchInput').value = '';
    displayVolunteers(volunteers);
}

/**
 * Gère la soumission du formulaire d'édition
 */
document.getElementById('editForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const updateData = {
        nom: document.getElementById('nom').value.trim(),
        prenom: document.getElementById('prenom').value.trim(),
        email: document.getElementById('email').value.trim(),
        telephone: document.getElementById('telephone').value.trim(),
        statut: document.getElementById('statut').value,
        actif: document.getElementById('actif').checked,
        confiance: document.getElementById('confiance').checked,
        id_vehicule: document.getElementById('vehicule').value || null
    };

    const volunteerId = document.getElementById('volunteerId').value;

    document.getElementById('loadingBox').style.display = 'block';
    google.script.run
        .withSuccessHandler(onUpdateSuccess)
        .withFailureHandler(onError)
        .updateVolunteer(volunteerId, updateData);
});

/**
 * Archive un bénévole
 */
function archiveVolunteer() {
    const volunteerId = document.getElementById('volunteerId').value;
    if (confirm('Êtes-vous sûr de vouloir archiver ce bénévole ?')) {
        document.getElementById('loadingBox').style.display = 'block';
        google.script.run
            .withSuccessHandler(function (result) {
                if (result.success) {
                    showAlert('success', '✅ Bénévole archivé avec succès');
                    setTimeout(() => {
                        google.script.host.close();
                    }, 1500);
                } else {
                    showAlert('error', '❌ ' + result.error);
                }
                document.getElementById('loadingBox').style.display = 'none';
            })
            .withFailureHandler(onError)
            .archiveVolunteer(volunteerId);
    }
}

/**
 * Gestion du succès de la mise à jour
 * @param {Object} result - Résultat de l'opération
 */
function onUpdateSuccess(result) {
    document.getElementById('loadingBox').style.display = 'none';
    if (result.success) {
        showAlert('success', '✅ Bénévole mis à jour avec succès');
        setTimeout(() => {
            google.script.host.close();
        }, 1500);
    } else {
        showAlert('error', '❌ ' + result.error);
    }
}

/**
 * Gestion des erreurs
 * @param {Error} error - Erreur rencontrée
 */
function onError(error) {
    document.getElementById('loadingBox').style.display = 'none';
    showAlert('error', '❌ Erreur: ' + error.message);
}

/**
 * Affiche un message d'alerte
 * @param {string} type - Type d'alerte (success, error, warning, info)
 * @param {string} message - Message à afficher
 */
function showAlert(type, message) {
    const alertBox = document.getElementById('alertBox');
    alertBox.className = `alert alert-${type}`;
    alertBox.innerHTML = message;
    alertBox.style.display = 'block';
}