/**
 * Test function — sends the mission briefing email to volunteer ID 4 only.
 * Run manually from the Apps Script editor (▶ Run button).
 *
 * Adjust TEST_DATE and TEST_TIME as needed before running.
 */
function testMissionBriefingVolunteer4() {
    const TEST_DATE = '2025-04-12'; // YYYY-MM-DD
    const TEST_TIME = '08:00';      // HH:MM

    const dateFormatted = formatMissionDate(TEST_DATE);
    const timeFormatted = formatMissionTime(TEST_TIME);

    const volunteer = getVolunteerById(4);

    if (!volunteer) {
        Logger.log('❌ Bénévole ID 4 introuvable.');
        return;
    }

    Logger.log(`📋 Envoi test à : ${volunteer.prenom} ${volunteer.nom} (${volunteer.email})`);
    Logger.log(`   Date : ${dateFormatted} — Heure : ${timeFormatted}`);

    const result = sendMissionBriefingEmail(volunteer, dateFormatted, timeFormatted);

    if (result.success) {
        Logger.log('✅ Email de test envoyé avec succès.');
    } else {
        Logger.log(`❌ Échec : ${result.error}`);
    }
}