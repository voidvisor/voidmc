import { AzureFunction, Context, HttpRequest, HttpResponseSimple } from "@azure/functions"
import { InteractionResponseType, InteractionType, verifyKey } from "discord-interactions";
import fetch from "node-fetch";

const STATUS_COMMAND = {
    name: 'status',
    description: 'Check minecraft server status.',
}

const START_COMMAND = {
    name: 'start',
    description: 'Start minecraft server.',
}

interface mcbody {
    online?: boolean,
    players?: {
        online: number,
        max: number
    }
}

const getStatus = async function (serverip: string): Promise<string> {
    const statusUrl = `https://api.mcstatus.io/v2/status/java/${serverip}?query=false`
    const response = await fetch(statusUrl);
    //console.log(await response.json())

    if (response.ok) {
        if (response.body) {
            const body: mcbody = await response.json();
            const statusText = body.online ? 'online' : 'offline';
            let currentPlayers;
            let maxPlayers;
            if (body.players) {
                currentPlayers = body.players.online;
                maxPlayers = body.players.max;
            } else {
                currentPlayers = 0;
                maxPlayers = 0;
            }
            
            return (`Server is ${statusText} with ${currentPlayers} of ${maxPlayers} players.`);
        }
    } else {
        const text = await response.text();
        return (`mcstatus API error: ${text}`);
    }
}

const firstResponse = async function (message): Promise<void> {
    await fetch(`https://discord.com/api/interactions/${message.id}/${message.token}/callback`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json;charset=UTF-8'
        },
        body: JSON.stringify({
            type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
        })
    })
}

const updatedResponse = async function (message, text: string): Promise<void> {
    await fetch(`https://discord.com/api/webhooks/${process.env["DISCORD_APPLICATION_ID"]}/${message.token}`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json;charset=UTF-8'
        },
        body: JSON.stringify({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            content: text
        })
    })
}

const statusResponse = async function (message): Promise<HttpResponseSimple> {
    const statusMsg = await getStatus(process.env["SERVER_IP"])
    await updatedResponse(message, statusMsg)
    return {
        statusCode: 200
    }
}

const startServer = async function (message): Promise<HttpResponseSimple> {
    const statusMsg = await getStatus(process.env["SERVER_IP"])
    if (statusMsg.includes('online')) {
        await updatedResponse(message, 'Server is already running.')
        return {
            statusCode: 200
        }
    } else {
        await fetch(process.env["AZURE_POST_URL"], {
            method: "PUT"
        })
        await updatedResponse(message, 'Server starting... (please wait for message in <#1122622098272165898>)')
        return {
            statusCode: 200
        }
    }
}

const commandHandler = async function (context: Context, req: HttpRequest): Promise<HttpResponseSimple> {
    const message = req.body;

    if (message.type === InteractionType.PING) {
        return {
            headers: {
                'content-type': 'application/json;charset=UTF-8'
            },
            body: {
                type: InteractionResponseType.PONG
            }
        }
    }

    if (message.type === InteractionType.APPLICATION_COMMAND) {
        switch (message.data.name.toLowerCase()) {
            case STATUS_COMMAND.name.toLowerCase(): {
                context.log('Handling status request.');
                firstResponse(message);
                return statusResponse(message);
            }
            case START_COMMAND.name.toLowerCase(): {
                context.log('Handling start request.');
                firstResponse(message);
                return startServer(message);
            }
        }
    }
}

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<HttpResponseSimple> {
    context.log('HTTP trigger function processed a request.');
    const signature = req.get('x-signature-ed25519');
    const timestamp = req.get('x-signature-timestamp');
    const body = req.bufferBody;
    
    if (signature && timestamp) {
        const isValidRequest = verifyKey(
            body,
            signature,
            timestamp,
            process.env["DISCORD_PUBLIC_KEY"]
        )

        if (!isValidRequest) {
            context.log("Invalid request");
            return {
                statusCode: 401,
                body: "Bad request signature."
            }
        }
    } else {
        context.log("Invalid request");
        return {
            statusCode: 401,
            body: "Bad request signature."
        }
    }

    return commandHandler(context, req);
};

export default httpTrigger;