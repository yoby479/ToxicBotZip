const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const config = require('./config');

const SESSION_PATH = `sessions/${config.SESSION_ID}`;

// Create sessions folder
if (!fs.existsSync('./sessions')) {
    fs.mkdirSync('./sessions');
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        browser: [config.BOT_NAME, "Chrome", "1.0"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log("SCAN THE QR CODE");
        }

        if (connection === 'open') {
            console.log(`\n✅ ${config.BOT_NAME} CONNECTED!`);
        } else if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const msg of messages) {
            if (!msg.message) return;
            const messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text;
            if (!messageContent) return;

            const from = msg.key.remoteJid;
            const text = messageContent;
            
            // Auto Fake Typing & Recording
            try {
                await sock.sendPresenceUpdate('composing', from);
                await delay(2000);
                await sock.sendPresenceUpdate('recording', from);
                await delay(1000);
            } catch (e) {}

            if (!text.startsWith(config.PREFIX)) return; 
            const command = text.slice(config.PREFIX.length).split(' ')[0].toLowerCase();

            if (command === 'menu') {
                const menuText = `
╔══════════════════╗
║ *${config.BOT_NAME}* ║
╚══════════════════╝
*Owner:* ${config.OWNER_NAME}

╔══════ FEATURES ════╗
║ .menu   - Menu     ║
║ .alive  - Status   ║
║ .ping   - Speed    ║
║ .toxic  - Roast    ║
╚═════════════════════╝
                `;
                await sock.sendMessage(from, { text: menuText }, { quoted: msg });
            }
            else if (command === 'alive') {
                await sock.sendMessage(from, { text: `✅ ${config.BOT_NAME} is Alive!` }, { quoted: msg });
            }
            else if (command === 'toxic') {
                const toxicMsg = ["You look like a potato 🥔", "TOXIC TECH YOBBY 😈"];
                await sock.sendMessage(from, { text: toxicMsg[Math.floor(Math.random() * toxicMsg.length)] }, { quoted: msg });
            }
        }
    });
}

startBot();
