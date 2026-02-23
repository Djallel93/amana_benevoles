/**
 * Vehicle management for volunteers
 */

function getVehicleById(vehicleId) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.VEHICULES);

        if (!sheet) throw new Error('Sheet "vehicules" not found');

        const data = sheet.getDataRange().getValues();
        const targetId = String(vehicleId).trim();

        for (let i = 1; i < data.length; i++) {
            if (String(data[i][VEHICULE_COLUMNS.ID]).trim() === targetId) {
                return rowToVehicle(data[i]);
            }
        }

        return null;
    } catch (error) {
        logVolunteerError(`Failed to get vehicle ${vehicleId}`, error);
        return null;
    }
}

function getAllVehicles() {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.VEHICULES);

        if (!sheet) throw new Error('Sheet "vehicules" not found');

        const data = sheet.getDataRange().getValues();
        const vehicles = [];

        for (let i = 1; i < data.length; i++) {
            vehicles.push(rowToVehicle(data[i]));
        }

        return vehicles;
    } catch (error) {
        logVolunteerError('Failed to get vehicles', error);
        return [];
    }
}

function getVolunteersByVehicle(vehicleId) {
    try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet()
            .getSheetByName(VOLUNTEER_CONFIG.SHEETS.BENEVOLES);

        if (!sheet) return [];

        const data = sheet.getDataRange().getValues();
        const targetId = String(vehicleId).trim();
        const volunteers = [];

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (String(row[BENEVOLE_COLUMNS.ID_VEHICULE]).trim() === targetId) {
                volunteers.push({
                    id: row[BENEVOLE_COLUMNS.ID],
                    nom: row[BENEVOLE_COLUMNS.NOM],
                    prenom: row[BENEVOLE_COLUMNS.PRENOM],
                    email: row[BENEVOLE_COLUMNS.EMAIL]
                });
            }
        }

        return volunteers;
    } catch (error) {
        logVolunteerError(`Failed to get volunteers for vehicle ${vehicleId}`, error);
        return [];
    }
}

function rowToVehicle(row) {
    return {
        id: row[VEHICULE_COLUMNS.ID],
        type: row[VEHICULE_COLUMNS.TYPE],
        capaciteKg: row[VEHICULE_COLUMNS.CAPACITE_KG],
        nombrePartMax: row[VEHICULE_COLUMNS.NOMBRE_PART_MAX] || null
    };
}