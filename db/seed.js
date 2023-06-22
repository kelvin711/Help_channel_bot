const { Client } = require("pg");
require('dotenv').config({ path: '../.env'});
const client = new Client(process.env.DATABASE_URL);

const rebuildDB = async () => {
    try {
        await client.connect();
        await client.query(
            `
            CREATE TABLE IF NOT EXISTS tickets (
                id SERIAL PRIMARY KEY,
                cohort TEXT NOT NULL,
                module TEXT NOT NULL,
                room TEXT NOT NULL,
                ta_name TEXT NOT NULL,
                ticket_completion_time REAL NOT NULL,
                is_completed BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
            `
        );
        console.log("Database initialized successfully.");
    } catch (error) {
        console.error("Error initializing the database:", error);
    } finally {
        await client.end();
    }
};

rebuildDB();