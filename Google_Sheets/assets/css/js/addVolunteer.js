/**
 * @file addVolunteer.js
 * @description JavaScript pour le formulaire d'ajout de bénévole
 */

// Charger la liste des véhicules au chargement de la page
window.onload = function () {
    google.script.run
        .withSuccessHandler(populateVehicles)
        .withFailureHandler(onError)
        .getAllVehicles();
};

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
 * Gestion de la soumission du formulaire
 */
document.getElementById('volunteerForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const formData = {
        nom: document.getElementById('nom').value.trim(),
        prenom: document.getElementById('prenom').value.trim(),
        email: document.getElementById('email').value.trim(),
        telephone: document.getElementById('telephone').value.trim(),
        id_vehicule: document.getElementById('vehicule').value || null,
        confiance: document.getElementById('confiance').checked
    };

    document.getElementById('loadingBox').style.display = 'block';
    document.getElementById('alertBox').style.display = 'none';

    google.script.run
        .withSuccessHandler(onSuccess)
        .withFailureHandler(onError)
        .createVolunteer(formData);
});

/**
 * Gestion du succès de la création
 * @param {Object} result - Résultat de l'opération
 */
function onSuccess(result) {
    document.getElementById('loadingBox').style.display = 'none';

    if (result.success) {
        showAlert('success', `✅ Bénévole créé avec succès ! ID: ${result.volunteerId}`);
        document.getElementById('volunteerForm').reset();

        setTimeout(() => {
            google.script.host.close();
        }, 2000);
    } else {
        showAlert('error', `❌ Erreur: ${result.error}`);
    }
}

/**
 * Gestion des erreurs
 * @param {Error} error - Erreur rencontrée
 */
function onError(error) {
    document.getElementById('loadingBox').style.display = 'none';
    showAlert('error', `❌ Erreur système: ${error.message}`);
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