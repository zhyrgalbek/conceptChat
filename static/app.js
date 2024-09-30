const express = require("express");
const http = require('http');
const body_parser = require("body-parser");
const cors = require("cors");
const multer = require("multer");
const sanitizeFilename = require("sanitize-filename");
const expressWs = require("express-ws");
const app = express().use(body_parser.json());
// const server = http.createServer(app);
const wsInstance = expressWs(app);
const jwt = require('jsonwebtoken');
const FormData = require("FormData");
require('dotenv').config();

const chatController = require("./controllers/chatController");
const SseController = require("./controllers/SseController");
const onlineChatController = require("./controllers/onlineChatController");
const whatsappController = require("./controllers/whatsappController");
const conceptController = require("./controllers/conceptController");
const { VERIFY_TOKEN } = require("./inc/inc");
const path = require('path');
const conceptApi = require("./services/conceptApi");
const whatsappFileTypes = require("./services/whatsappFileTypes");
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

// app.get("/chat", chatController.chatCtrl);
// app.get("/chat/sse", SseController.SseCtrl);
// app.get("/chat/onlineChat", onlineChatController.onlineChat); // Подключения к онлайн чату со стороны сайта
// app.post("/chat/webhook/onlineChat/newMessage/operator", onlineChatController.newMessageOperatorSendClient); // Оператор добавляет новое сообщение
// app.post("/chat/webhook/onlineChat/newMessage/client", onlineChatController.newMessageClientSendOperator); // Клиент добавляет новое сообщение
// app.post("/chat/webhook/onlineChat", onlineChatController.signUporSignIn); // sign up or sign in 
// app.post("/chat/onlineChat/upload", onlineChatController.fileUploade); // загрузка файла

// app.post("/chat/whatsapp/newMessage/operator", whatsappController.newMessageOperatorSendClient); // Оператор отправляет сообщение к клиенту
// app.post("/chat/whatsapp/upload", whatsappController.uploadOperatorSendClient); // Оператор отправляет файл к клиенту
// app.post("/chat/whatsapp/newMessage/client"); // Клиент отправляет сообщение 
// app.get("/chat/webhook", function (req, res){
//     let mode = req.query['hub.mode'];
//     let token = req.query['hub.verify_token'];
//     let challenge = req.query['hub.challenge'];
//     if(mode === "subscribe" && token === VERIFY_TOKEN){
//         console.log("WEBHOOK_VERIFIED");
//         res.status(200).send(challenge);
//     } else {
//         res.sendStatus(403);
//     }
// });

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
    let headers = await conceptApi.getHeaderConcept();
    let newMessage = await conceptApi.uploadFileAxelor({ file, headers, messageAuthor, chat });
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
                    chat
                })

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

                file.path = file.path + ".mp3";
                file.mimetype = "audio/mpeg";

                await whatsappApi.uploadFile({
                    file,
                    phoneNumberId: chat.phoneNumberId,
                    from: chat.phoneNumber
                })
                
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

        let responseFileWhatsap = await whatsappApi.uploadFile({ phoneNumberId: chat.phoneNumberId, file, from: chat.phoneNumber });
        let newMessage = await conceptApi.uploadFileAxelor({ file, headers, messageAuthor, chat });

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
    }


    res.sendStatus(200);
});

app.post("/webhook", async (req, res) => {
    let body = req.body;

    // console.log(JSON.stringify(req.body, null, 2));

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
            let messages = req.body.entry[0].changes[0].value.messages[0];
            await conceptController.webhookController({ messages, phone_number_id, userName, userPhoneNumber, from });

            console.log("phone_number_id: ", phone_number_id)
            console.log("from: ", from);
            console.log("msg_id: ", msg_id);
            console.log("userName: ", userName);
            console.log("userPhoneNumber: ", userPhoneNumber);
            console.log("messages: ", messages);
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