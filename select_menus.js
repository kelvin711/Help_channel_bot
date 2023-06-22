const { MessageActionRow, MessageSelectMenu } = require('discord.js');

module.exports = (cohorts, modules, rooms) => {
    const row1 = new MessageActionRow()
        .addComponents(
            new MessageSelectMenu()
                .setCustomId('cohort')
                .setPlaceholder('Please select your cohort date')
                .addOptions(cohorts.map(cohort => ({ label: cohort, value: cohort }))),
        );

    const row2 = new MessageActionRow()
        .addComponents(
            new MessageSelectMenu()
                .setCustomId('module')
                .setPlaceholder('Please select your module that you need help with')
                .addOptions(modules.map(module => ({ label: module, value: module }))),
        );

    const row3 = new MessageActionRow()
        .addComponents(
            new MessageSelectMenu()
                .setCustomId('room')
                .setPlaceholder('What room are you located in')
                .addOptions(rooms.map(room => ({ label: room, value: room }))),
        );

    return [row1, row2, row3];
};