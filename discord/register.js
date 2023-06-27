import { STATUS_COMMAND, START_COMMAND } from "./commands.js";
import fetch from "node-fetch";

const token = process.env.DISCORD_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;

if (!token) {
    throw new Error("Missing DISCORD_TOKEN");
}
if (!applicationId) {
    throw new Error("Missing DISCORD_APPLICATION_ID");
}

async function registerGlobalCommands() {
    const url = `https://discord.com/api/v10/applications/${applicationId}/commands`
    await registerCommands(url);
}

async function registerCommands(url) {
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bot ${token}`,
        },
        method: 'PUT',
        body: JSON.stringify([STATUS_COMMAND, START_COMMAND]),
    })

    if (response.ok) {
        console.log("Successfully registered global commands");
    } else {
        console.error("Failed to register global commands");
        const text = await response.text();
        console.error(text);
    }
    return response;
}

await registerGlobalCommands();