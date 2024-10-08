const express = require("express");
const body_parser = require("body-parser");
const cors = require("cors");
const multer = require("multer");
const sanitizeFilename = require("sanitize-filename");
const expressWs = require("express-ws");
const app = express().use(body_parser.json());
const wsInstance = expressWs(app);
const FormData = require("FormData");
require('dotenv').config();

const conceptController = require("./controllers/conceptController");
const conceptApi = require("./services/conceptApi");
const whatsappApi = require("./services/whatsappApi");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");

const storageConfig = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads");
    },
    filename: (req, file, cb) => {
        const decodedFilename = Buffer.from(file.originalname, "latin1").toString(
            "utf-8"
        );
        // Sanitize the filename
        const sanitizedFilename = sanitizeFilename(decodedFilename);

        cb(null, sanitizedFilename);
    },
});

app.use(
    cors({
        origin: [
            "https://concept-test.brisklyminds.com",
            "https://concept.sanarip.org/concept"
            // "http://10.118.50.46:8080",
            // "https://fifth-sharp-clove.glitch.me",
            // "https://call.sanarip.org",
            // "https://pi.sanarip.org",
            // "https://www.customs.gov.kg"
        ], // Укажите домен, который будет иметь доступ к вашему серверу
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "Origin",
            "X-Requested-With",
            "Accept",
        ],
        credentials: true, // Включите передачу cookie
    }),
    multer({ storage: storageConfig }).single("file"),
    // express.static(path.join(__dirname, 'static'))
);

console.log(__dirname, 'static')

let wsFile = null;

app.post("/authorization", conceptController.authorization);

app.get('/chat', function (req, res) {
    res.sendFile(__dirname + "/index.html");
});

app.get("/", function (req, res) {
    res.sendFile(__dirname + "/html/index.html");
});

app.post("/chat/uploadFileAxelor", async function (req, res, next) {
    let messageAuthor = JSON.parse(req.body.messageAuthor);
    let chat = JSON.parse(req.body.chat);
    console.log(messageAuthor, chat);
    let file = req.file;
    let caption = req.body.caption ? JSON.parse(req.body?.caption) : null;
    let headers = await conceptApi.getHeaderConcept();
    let newMessage = await conceptApi.uploadFileAxelor({ file, headers, messageAuthor, chat, caption });
    let sendClients = [];
    if (newMessage) {
        new Promise(resolve => {
            for (let i = 0; i < chat.members.length; i++) {
                let member = chat.members[i];
                let sendClientArray = conceptController.clients.filter(client => client.currentUserId === member.id);
                if (sendClientArray.length > 0) {
                    sendClientArray.forEach((sendClient) => {
                        sendClients.push(sendClient);
                    });
                }
            }
            console.log("sendClients: ", sendClients);
            resolve();
        }).then(() => {
            sendClients.forEach(sendClient => {
                sendClient.ws.send(JSON.stringify({
                    event: "newMessage",
                    newMessage: newMessage.data ? newMessage.data : null
                }));
            });
        })
    }

    console.log(newMessage);

    res.sendStatus(200);
});

app.post("/chat/uploadFileWhatsapp", async function (req, res, next) {
    let messageAuthor = JSON.parse(req.body.messageAuthor);
    let chat = JSON.parse(req.body.chat);
    console.log(messageAuthor, chat);
    let file = req.file;
    let caption = req.body.caption ? JSON.parse(req.body?.caption) : null;
    let headers = await conceptApi.getHeaderConcept();
    if (file.mimetype === "audio/webm") {
        ffmpeg()
            .input(file.path)
            .audioCodec("libmp3lame")
            .on("end", async () => {
                console.log("Conversion finished!");

                let newMessage = await conceptApi.uploadFileAxelor({
                    headers,
                    file: req.file,
                    messageAuthor,
                    chat,
                    appealType: 'whatsapp',
                    status: 'sent'
                });

                let sendClients = [];
                if (newMessage) {
                    new Promise(resolve => {
                        for (let i = 0; i < chat.members.length; i++) {
                            let member = chat.members[i];
                            let sendClientArray = conceptController.clients.filter(client => client.currentUserId === member.id);
                            if (sendClientArray.length > 0) {
                                sendClientArray.forEach((sendClient) => {
                                    sendClients.push(sendClient);
                                });
                            }
                        }
                        console.log("sendClients: ", sendClients);
                        resolve();
                    }).then(() => {
                        sendClients.forEach(sendClient => {
                            sendClient.ws.send(JSON.stringify({
                                event: "newMessageAppeal",
                                newMessage: { ...newMessage.data, appeal: chat.appeal }
                            }));
                        });
                    })
                }

                file.path = file.path + ".mp3";
                file.mimetype = "audio/mpeg";

                let responseWhatsappFile = await whatsappApi.uploadFile({
                    file,
                    phoneNumberId: chat.phoneNumberId,
                    from: chat.phoneNumber,

                })
                await conceptApi.updateMessage({ headers, messageId: newMessage.data.id, messageSecretKey: responseWhatsappFile.messages[0].id });
                // console.log("responseWhatsappFile: ", responseWhatsappFile);
                fs.unlink(file.path, err => {
                    if (err) throw err; // не удалось удалить файл
                    console.log('Файл успешно удалён');
                });
            })
            .on("error", (err) => {
                console.error("Error:", err);
            })
            .save(req.file.path + ".mp3");

    } else {

        let newMessage = await conceptApi.uploadFileAxelor({
            file, headers, messageAuthor, chat, appealType: 'whatsapp',
            status: 'sent',
            caption
        });

        let sendClients = [];
        if (newMessage) {
            new Promise(resolve => {
                for (let i = 0; i < chat.members.length; i++) {
                    let member = chat.members[i];
                    let sendClientArray = conceptController.clients.filter(client => client.currentUserId === member.id);
                    if (sendClientArray.length > 0) {
                        sendClientArray.forEach((sendClient) => {
                            sendClients.push(sendClient);
                        });
                    }
                }
                resolve();
            }).then(() => {
                sendClients.forEach(sendClient => {
                    sendClient.ws.send(JSON.stringify({
                        event: "newMessageAppeal",
                        newMessage: { ...newMessage.data, appeal: chat.appeal }
                    }));
                });
            })
        }
        let responseWhatsappFile = await whatsappApi.uploadFile({ file, from: chat.phoneNumber, caption });
        await conceptApi.deleteFile(file.path)
        await conceptApi.updateMessage({ headers, messageId: newMessage.data.id, messageSecretKey: responseWhatsappFile.messages[0].id });
    }

    res.sendStatus(200);
});

app.post("/call", async function (req, res) {
    try {
        const verify_token = process.env.VERIFY_TOKEN;
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith("Bearer")) {
            const token = authHeader.split(" ")[1];
            if (token !== verify_token) {
                throw new Error("no valid token!");
            }
            let data = req.body;
            await conceptController.callMessage({ data });
            res.sendStatus(200);
        } else {
            throw new Error("no valid token!");
        }
    } catch (error) {
        res.sendStatus(404);
    }
});

app.post("/webhook", async (req, res) => {
    let body = req.body;

    console.log(JSON.stringify(req.body, null, 2));
    // console.log(body);

    if (req.body.object) {
        if (req.body.entry &&
            req.body.entry[0].changes &&
            req.body.entry[0].changes[0] &&
            req.body.entry[0].changes[0].value.messages &&
            req.body.entry[0].changes[0].value.messages[0]
        ) {
            let phone_number_id = req.body.entry[0].changes[0].value.metadata.phone_number_id;
            let from = req.body.entry[0].changes[0].value.messages[0].from;
            let msg_id = req.body.entry[0].changes[0].value.messages[0].id;

            let userName = req.body.entry[0].changes[0].value.contacts[0].profile.name;
            let userPhoneNumber = req.body.entry[0].changes[0].value.contacts[0].wa_id;
            let messages = req.body.entry[0].changes[0].value?.messages[0];
            // console.log("phone_number_id: ", phone_number_id)
            // console.log("from: ", from);
            // console.log("msg_id: ", msg_id);
            // console.log("userName: ", userName);
            // console.log("userPhoneNumber: ", userPhoneNumber);
            // console.log("messages: ", messages);
            await conceptController.webhookController({ messages, phone_number_id, userName, userPhoneNumber, from, msg_id, appealType: 'whatsapp' });
        }
        if (req.body.entry &&
            req.body.entry[0].changes &&
            req.body.entry[0].changes[0] &&
            req.body.entry[0].changes[0].value &&
            req.body.entry[0].changes[0].value.statuses &&
            req.body.entry[0].changes[0].value.statuses[0] &&
            req.body.entry[0].changes[0].value.statuses[0].status === "delivered" ||
            req.body.entry &&
            req.body.entry[0].changes &&
            req.body.entry[0].changes[0] &&
            req.body.entry[0].changes[0].value &&
            req.body.entry[0].changes[0].value.statuses &&
            req.body.entry[0].changes[0].value.statuses[0] &&
            req.body.entry[0].changes[0].value.statuses[0].status === "failed"
        ) {
            let statuses = req.body.entry[0].changes[0].value.statuses[0];
            // await conceptController.updateMessage({ id: statuses.id, status: statuses.status });
            if (statuses.status === "delivered") {
                await conceptController.updateMessage({ id: statuses.id, status: statuses.status });
            }
            if (statuses.status === "failed") {
                await conceptController.updateMessage({ id: statuses.id, status: statuses.errors[0].code });
            }
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

app.get("/webhook", (req, res) => {
    const verify_token = process.env.VERIFY_TOKEN;

    let mode = req.query["hub.mode"];
    let token = req.query["hub.verify_token"];
    let challenge = req.query["hub.challenge"];
    if (mode && token) {
        if (mode === "subscribe" && token === verify_token) {
            console.log("WEBHOOK_VERIFIED");
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

const SECRET_KEY = process.env.SECRET_KEY;

app.ws("/ws", (ws, req) => {
    wsFile = ws;
    ws.on("open", function (msg) {
        let data = JSON.parse(msg);
        console.log(data)
    });

    ws.on("message", function (msg) {

        let data = JSON.parse(msg);
        switch (data.event) {
            case "Ping":
                ws.send(JSON.stringify({ event: "PONG" }));
                break;
            case "currentUser":
                conceptController.getAllChats({ ws, data: data.data });
                break;
            // case "authorization":
            //     conceptController.authorizationSocket({ ws, data });
            //     break;
            case "getChatMessages":
                conceptController.getChatMessages({ ws, data: data.data });
                break;
            case "sendMessage":
                conceptController.sendMessage({ ws, data: data.data });
                break;
            case "getChat":
                conceptController.getChat({ ws, data: data.data });
                break;
            case "close":
                conceptController.close({ ws, data: data.data });
                break;
            case "getContacts":
                conceptController.getContacts({ ws, data: data.data });
                break;
            case "getDepartments":
                conceptController.getDepartMents({ ws, data: data.data });
                break;
            case "searchContacts":
                conceptController.searchContacts({ ws, data: data.data });
                break;
            case "createorGetChat":
                conceptController.createorGetChat({ ws, data: data.data });
                break;
            case "isReadMessages":
                conceptController.isReadMessages({ ws, data: data.data });
                break;
            case "getChatorderpage":
                conceptController.getChatorderpage({ ws, data: data });
                break;
            case "completeClient":
                conceptController.completeClient({ ws, data: data.data });
                break;
            case "sendMessageWhatsapp":
                conceptController.sendMessageWhatsapp({ ws, data: data.data });
                break;
            case "sendTemplate":
                conceptController.sendTemplate({ ws, data: data.data });
                break;
            case "searchClients":
                conceptController.searchClients({ ws, data: data.data });
                break;
            case "getClients":
                conceptController.getClients({ ws, data: data.data });
                break;
            case "createOrgetChatClient":
                conceptController.createOrgetChatClient({ ws, data: data.data });
                break;
            case "searchActiveClients":
                conceptController.searchActiveClients({ ws, data: data.data });
                break;
            case "searchActiveUsers":
                conceptController.searchActiveUsers({ ws, data: data.data });
                break;
            case "updateAppeal":
                conceptController.updateAppealAndChat({ ws, data: data.data });
                break;
            case "createTemplate":
                conceptController.createTemplate({ ws, data: data.data });
                break;
            case "getTemplates":
                conceptController.getTemplates({ ws, data: data.data });
                break;
            case "updateTemplate":
                conceptController.updateTemplate({ ws, data: data.data });
                break;
            case "deleteTemplate":
                conceptController.deleteTemplate({ ws, data: data.data });
                break;
            case "addClient":
                conceptController.addClient({ ws, data: data.data });
                break;
            case "transferClient":
                conceptController.transferClient({ ws, data: data.data });
                break;
        }
    });

    ws.on("close", function (event) {
        // ws.send(JSON.stringify({ erro: text }));
        conceptController.close({ ws });
    });

    // console.log('socket', req.testing);
});

app.ws("/appeals", (ws, req) => {
    ws.on("open", function (msg) {
        let data = JSON.parse(msg);
        console.log(data)
    });

    ws.on("message", function (msg) {
        let data = JSON.parse(msg);
        switch (data.event) {
            case "Ping":
                ws.send(JSON.stringify({ event: "PONG" }));
                break;
            case "AllAppeals":
                conceptController.allAppeals({ ws, data });
                break;
            case "updateAppeal":
                conceptController.updateAppealAndChat({ ws, data: data.data });
                break;
        }
    });

    ws.on("close", function (event) {
        // ws.send(JSON.stringify({ erro: text }));
        conceptController.closeAppeals({ ws });
        console.log("WebSocket соединение закрыто");
    });
});

const aWss = wsInstance.getWss('/ws');

app.listen(3000, async function () {
    console.log("Start server chat...");
    // console.log(chat);
    // console.log(chat);
    // console.log(token);
});