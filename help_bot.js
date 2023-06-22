require('dotenv').config();
const fs = require('fs');
const app = require('express')();
const port = process.env.PORT || 3000;
const { Client, MessageActionRow, MessageSelectMenu } = require('discord.js');
const client = new Client({
    intents: ['GUILDS', 'GUILD_MESSAGES', 'GUILD_MESSAGE_REACTIONS'],
    partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
});

async function exportDataToFile(filename, format = 'json') {
    // 1. Query the data from the database
    let result;
    try {
        result = await pool.query("SELECT * FROM tickets");
    } catch (err) {
        console.error('Error retrieving data from the database', err);
        return;
    }

    // 2. Formatting the data
    let dataString;
    if (format === 'json') {
        dataString = JSON.stringify(result.rows);
    } else if (format === 'csv') {
        // First line is column names
        const headers = Object.keys(result.rows[0]).join(",");
        // Map each row's values into a comma-separated string
        const rows = result.rows.map(row => Object.values(row).join(","));
        // Combine everything into a single string
        dataString = headers + "\n" + rows.join("\n");
    }

    // 3. Writing the data to a file
    fs.writeFileSync(filename, dataString);

    console.log(`Data successfully exported to ${filename}`);
}

// Express setup
app.get('/', (req, res) => {
    res.send('Hello, this is the help bot server!');
});

app.get('/download', async (req, res) => {
    // Run the export data function before attempting to download the file.
    // Make sure to replace filename and format with appropriate values.
    await exportDataToFile('output.csv', 'csv');

    // Use a path relative to your project root
    const filePath = './output.csv'; 

    // Check if file exists
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath); // Sends the file to client for download
    } else {
        res.send("File does not exist");
    }
});


app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

const pool = require('./db/connection')

const selections = {};
const TA_ROLE_ID = '1113854941019242537';

// Bringing in help data
const cohorts = require('./EI/cohorts');
const rooms = require('./EI/rooms');

// Creating dropdown selections
const createSelectMenus = require('./select_menus');


const handleCommand = async (interaction) => {
    // Initialize or reset the selections for this user.
    selections[interaction.user.id] = { cohort: '', module: '', room: '' };

    // Determine which modules to display based on command name
    let commandModules;
    switch (interaction.commandName) {
        case 'help-js':
            commandModules = require('./EI/JS/modules');
            break;
        case 'help-frontend':
            commandModules = require('./EI/frontend/modules');
            break;
        case 'help-backend':
            commandModules = require('./EI/backend/modules');
            break;
        case 'help-dsa':
            commandModules = require('./EI/DSA/modules');
            break;
        default:
            return;
    }
    // Update the module selection menu with the appropriate options
    const [row1, row2, row3] = createSelectMenus(cohorts, commandModules, rooms);
    // ------------------- get data when ticket is made ***

    await interaction.reply({
        content: 'Starting selection...',
        components: [row1, row2, row3],
        fetchReply: true
    });
};

const handleSelectMenu = async (interaction) => {
    // If there's no selections object for this user, ignore the interaction.
    if (!selections[interaction.user.id]) return;

    // Update the relevant selection.
    selections[interaction.user.id][interaction.customId] = interaction.values[0];

    // If all options have been selected, send the final message.
    if (selections[interaction.user.id].cohort && selections[interaction.user.id].module && selections[interaction.user.id].room) {
        await interaction.update({
            content: `@help Cohort: ${selections[interaction.user.id].cohort} | Module: ${selections[interaction.user.id].module} | Room: ${selections[interaction.user.id].room}`,
            components: []
        });
        // Once the final message is sent, delete the selections object for this user.
        delete selections[interaction.user.id];
    }
    else {
        await interaction.deferUpdate();
    }
};

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    // Fetch the guild directly from Discord.
    const guild = await client.guilds.fetch('143897860721737729');

    await guild.commands.create({
        name: 'help-js',
        description: 'Creates a JavaScript help ticket',
    });

    await guild.commands.create({
        name: 'help-backend',
        description: 'Creates a Node.js help ticket',
    });

    await guild.commands.create({
        name: 'help-frontend',
        description: 'Creates a React help ticket',
    });

    await guild.commands.create({
        name: 'help-dsa',
        description: 'Creates a Data Structures and Algorithms help ticket',
    });

});

client.on('interactionCreate', async interaction => {
    // Handle all five commands
    if (interaction.isCommand() && ['help-js', 'help-backend', 'help-frontend', 'help-dsa'].includes(interaction.commandName)) {
        handleCommand(interaction);
    }
    else if (interaction.isSelectMenu()) {
        handleSelectMenu(interaction);
    }
});

// Storing current tickets
let currentTickets = new Map();

client.on('messageReactionAdd', async (reaction, user) => {
    if (reaction.message.partial) {
        try {
            await reaction.message.fetch();
        } catch (error) {
            console.error('Something went wrong when fetching the message:', error);
            return;
        }
    }

    if (user.bot) return;

    const member = await reaction.message.guild.members.fetch(user.id);

    if (!member.roles.cache.has(TA_ROLE_ID)) return;

    if (reaction.emoji.name === '👍') {
        // Extract the cohort, module, and room from the message content
        const messageContent = reaction.message.content;
        const contentParts = messageContent.split(" | ");
        const cohort = contentParts[0].split(": ")[1].trim();
        const module = contentParts[1].split(": ")[1].trim();
        const room = contentParts[2].split(": ")[1].trim();
        const taName = user.tag;

        const queryText = `
            INSERT INTO tickets(cohort, module, room, ta_name, ticket_completion_time, is_completed) 
            VALUES($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        const queryValues = [cohort, module, room, taName, 0, false];

        try {
            const res = await pool.query(queryText, queryValues);
            const ticket = res.rows[0];
            // Save the ticket ID and start time to the currentTickets Map with the user's ID as the key
            currentTickets.set(user.id, { ticketId: ticket.id, startTime: Date.now() });
            console.log("Ticket created in database: ", ticket);
        } catch (err) {
            console.error('Error saving data to the database', err);
        }
    } else if (reaction.emoji.name === '✅') {
        // Check if the user has a current ticket
        if (!currentTickets.has(user.id)) {
            console.error('No current ticket for this user');
            return;
        }

        // Get the ticket details and remove it from the Map
        const { ticketId, startTime } = currentTickets.get(user.id);
        currentTickets.delete(user.id);

        const ticketEndTime = Date.now();
        const timeSpent = (ticketEndTime - startTime) / 1000; // In seconds

        const queryText = `
            UPDATE tickets
            SET ticket_completion_time = $1, is_completed = $2, updated_at = NOW()
            WHERE id = $3
            RETURNING *
        `;
        const queryValues = [timeSpent, true, ticketId];

        try {
            const res = await pool.query(queryText, queryValues);
            const ticket = res.rows[0];
            console.log(`TA ${user.tag} has completed ticket #${ticket.id} in ${ticket.ticket_completion_time} seconds.`);
        } catch (err) {
            console.error('Error updating data in the database', err);
        }
    }
});





client.login(process.env.BOT_TOKEN);

// exportDataToFile('output.csv', 'csv');
