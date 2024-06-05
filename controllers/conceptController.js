let conceptApi = require("../services/conceptApi");
const whatsappApi = require("../services/whatsappApi");
const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET_KEY = process.env.SECRET_KEY;

let clients = [];
let openAppealsClients = [];

exports.clients = clients;

exports.authorization = async function (req, res) {
    let name = req.body.name;

    let payload = {
        name: name
    };

    const options = {
        expiresIn: '1h'
    };

    const token = jwt.sign(payload, SECRET_KEY, options);

    res.send({ name: name, token });
}

exports.authorizationSocket = async function ({ ws, data }) {
    let token = data.token;
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            // console.log("Ошибка валидации токена:", err);
            // ws.close("Ошибка валидации токена:");
            ws.send(JSON.stringify({ event: "close", text: "Ошибка валидации токена:" }));
        } else {
            // console.log("Токен валиден. Декодированные данные: ", decoded);
            ws.send(JSON.stringify({ message: "Токен валиден. Декодированные данные: ", decoded }));
        }
    });
}

exports.getAllChats = async function ({ ws, data }) {
    const currentUserId = data.currentUserId.id;
    if (data.connect) {
        clients.push({ ws, currentUserId });
        console.log("clients: ", clients);
    }
    const headers = await conceptApi.getHeaderConcept();
    // const chats = await conceptApi.getAllChats({ typeChats: 1, headers, currentUserId });
    const chats = await conceptApi.getAllChats2({ typeChats: 1, headers, currentUserId });
    let Colleagues = [];
    let Clients = [];
    if (chats && chats.length > 0) {
        chats.forEach((chat) => {
            if (+chat.typeChats === 1 && !chat.appeal) {
                let collega = chat.members.find(el => el.id !== currentUserId);
                Colleagues.push({ ...chat, collegaId: collega.id, fullName: collega.fullName, code: collega.code });
            }
            if (+chat.typeChats === 1 && chat.appeal) {
                let findUser = chat.members.find(el => el.id === currentUserId);
                if (findUser) {
                    Clients.push({ ...chat, appealId: chat.appeal.id, fullName: chat.appeal.name, phoneNumber: chat.appeal.phoneNumber });
                }
            }
        });
        ws.send(JSON.stringify({
            event: "allChats",
            Colleagues,
            Clients
        }));
        return;
    }
    ws.send(JSON.stringify({
        event: "allChats",
        Colleagues,
        Clients
    }));
}

exports.getChatMessages = async function ({ ws, data }) {
    const chatId = data.chat.id;
    // console.log(chatId)
    const headers = await conceptApi.getHeaderConcept();
    const messages = await conceptApi.getMessagesChat({ headers, chatId });
    // console.log(messages);

    ws.send(JSON.stringify({
        event: "getChatMessages",
        messages
    }));
}

exports.sendMessage = async function ({ ws, data }) {
    // console.log(data);
    const headers = await conceptApi.getHeaderConcept();
    const { message, chat, messageAuthor, from, file } = data;

    const newMessage = await conceptApi.createMessage({ message, chatId: chat.id, messageAuthor, from, headers, file });
    if (chat) {
        let sendClients = [];
        new Promise(resolve => {
            for (let i = 0; i < chat.members.length; i++) {
                let member = chat.members[i];
                let sendClientArray = clients.filter(client => client.currentUserId === member.id);
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
                    event: "newMessage",
                    newMessage: newMessage.data ? newMessage.data : null
                }));
            });
        })
    }

    console.log("clients: ", clients);

}

exports.uploadFile = async function ({ ws, data }) {
    let { file, messageAuthor, chat } = data;
    // console.log("file: ", file);
    // let headers = await conceptApi.getHeaderConcept();
    // let response = await conceptApi.uploadFileAxelor({ file, headers, messageAuthor, chat });

    // console.log("uploadFile: ", response);
}

exports.isReadMessages = async function ({ ws, data }) {
    let { chat, user } = data;
    let headers = await conceptApi.getHeaderConcept();
    let responseData = await conceptApi.isReadMessages({ headers, chat, currentUser: user });
    // if (responseData?.status === 0) {
    ws.send(JSON.stringify({ event: "unreadMessageCount", chat }));
    // } else {
    // ws.send(JSON.stringify({ event: "unreadMessageCount", error: 'no success' }));
    // }
}

exports.getChat = async function ({ ws, data }) {
    let chatId = data.activeChat.id;
    if (data.currentUserId && data.connect) {
        let currentUserId = data?.currentUserId.id;
        clients.push({ ws, currentUserId });
        console.log("clients: ", clients)
    }
    const headers = await conceptApi.getHeaderConcept();
    const chat = await conceptApi.getChat({ headers, chatId });
    if (chat.appeal) {
        const appeal = await conceptApi.getAppeal({ headers, appeal: chat.appeal });
        ws.send(JSON.stringify({
            event: "getChat",
            chat: { ...chat, phoneNumber: appeal.phoneNumber, name: appeal.name, saleOrder: appeal.saleOrder }
        }));
        return;
    }
    ws.send(JSON.stringify({
        event: "getChat",
        chat
    }));
}

exports.close = async function ({ ws, data }) {
    // Удаляем отключившегося клиента из хранилища
    // console.log(ws)
    const index = clients.findIndex((client) => client.ws === ws);
    if (index !== -1) {
        clients.splice(index, 1);
        // console.log('Клиент вышел из чата:');
    } else {
        // console.log('Ошибка: клиент не найден в списке');
    }
    // console.log('WebSocket соединение закрыто');
}

exports.getContacts = async function ({ ws, data }) {
    const currentUserId = data.currentUser.id;
    const headers = await conceptApi.getHeaderConcept();
    const contacts = await conceptApi.getUsers({ headers });
    if (contacts) {
        const filterContacts = contacts.filter(contact => contact.id !== currentUserId);
        ws.send(JSON.stringify({ event: 'getContacts', contacts: filterContacts }));
    } else {
        ws.send(JSON.stringify({ event: "getContacts", contacts: [] }));
    }
}

exports.createorGetChat = async function ({ ws, data }) {
    let { currentUserId, userId, typeChat } = data;
    let headers = await conceptApi.getHeaderConcept();
    let chat = await conceptApi.getChatTwoUsers({ headers, currentUserId: currentUserId.id, userId });
    if (chat) {
        ws.send(JSON.stringify({ event: "newChat", chat }));
    } else {
        let newChat = await conceptApi.createChat({ headers, currentUserId: currentUserId.id, userId, typeChat });
        ws.send(JSON.stringify({ event: "newChat", newChat }));
    }
}


exports.allAppeals = async function ({ ws, data }) {

    openAppealsClients.push(ws);

    let headers = await conceptApi.getHeaderConcept();
    let response = await conceptApi.getAppeals({ headers });

    ws.send(JSON.stringify({ event: "AllAppeals", appeals: response }));
}

exports.closeAppeals = async function ({ ws, data }) {
    const index = openAppealsClients.findIndex((client) => client === ws);
    if (index !== -1) {
        clients.splice(index, 1);
        // console.log('Клиент вышел из чата:');
    } else {
        // console.log('Ошибка: клиент не найден в списке');
    }
    console.log("clients: ", clients);
}

exports.updateAppealAndChat = async function ({ ws, data }) {
    let appeal = data.appeal;
    let status = data.status;
    let currentUserId = data.currentUserId;
    let headers = await conceptApi.getHeaderConcept();
    let responseAppeal = await conceptApi.updateAppeal({ headers, appeal, status });
    let chat = await conceptApi.getChat({ headers, chatId: appeal.chat.id });
    let members = chat.members ?? [];
    let completedUsers = chat.completedUsers ?? [];
    let newCompletedUsers = completedUsers.filter(el => el.id !== currentUserId.id);
    members.push({ id: currentUserId.id });
    let responseChat = await conceptApi.updateChat({ headers, chat, members, completedUsers: newCompletedUsers });
    console.log("clients: ", clients);
    clients.forEach((client) => {
        if (client.currentUserId === currentUserId.id) {
            client.ws.send(JSON.stringify({
                event: "newWorkAppeal",
                newClient: {
                    ...responseChat,
                    appealId: responseAppeal.id,
                    fullName: responseAppeal.name,
                    phoneNumber: responseAppeal.phoneNumber,
                    lastMessage: responseAppeal.lastMessage
                }
            }));
        }
    });
    // console.log("chat: ", chat);
    // console.log("responseChat: ", responseChat);
    // console.log("members: ", members);

    openAppealsClients.forEach((openAppeal) => {
        openAppeal.send(JSON.stringify({
            event: "workAppeal",
            appeal: responseAppeal
        }));
    });

}

exports.getChatorderpage = async function ({ ws, data }) {
    let chat = data.data.chat;
    let headers = await conceptApi.getHeaderConcept();
    let appeal = await conceptApi.getAppeal({ headers, appeal: { id: chat.appeal.id } });
    if (appeal) {
        ws.send(JSON.stringify({
            event: "chatOrderPage",
            chat: { ...chat, appeal: appeal, phoneNumber: appeal.phoneNumber, fullName: appeal.name, lastMessage: appeal.lastMessage }
        }));
    }
}

exports.completeClient = async function ({ ws, data }) {
    // console.log("completeClient: ", data);

    let { chat, currentUserId } = data;
    let appeal = chat.appeal;

    console.log("clients: ", clients);

    let headers = await conceptApi.getHeaderConcept();
    let newAppeal = await conceptApi.updateAppeal({ headers, appeal, status: 3 });
    let newCompletedUsers = chat.completedUsers ?? [];
    newCompletedUsers.push(currentUserId);
    let newChat = await conceptApi.updateChat({ headers, chat, completedUsers: newCompletedUsers });

    clients.forEach((el) => {
        if (el.currentUserId === currentUserId.id) {
            el.ws.send(JSON.stringify({
                event: "newWorkAppeal",
                newClient: {
                    ...newChat,
                    appealId: newAppeal.id,
                    fullName: newAppeal.name,
                    phoneNumber: newAppeal.phoneNumber,
                    lastMessage: newAppeal.lastMessage
                }
            }));
        }
    });



    // console.log("newAppeal: ", newAppeal);

    // console.log("clients: ", clients);


    // ???

    // let newChat = await conceptApi.updateChat({ chat })
}

exports.sendMessageWhatsapp = async function ({ ws, data }) {
    let { messageAuthor, chat, message } = data;
    let headers = await conceptApi.getHeaderConcept();
    let newMessage = null;
    let sendClients = [];
    for (let i = 0; i < chat.members.length; i++) {
        let member = chat.members[i];
        let sendClientArray = clients.filter(client => client.currentUserId === member.id);
        if (sendClientArray.length > 0) {
            sendClientArray.forEach((sendClient) => {
                sendClients.push(sendClient);
            });
        }
    }

    if (message.type.toLowerCase() === "text") {
        newMessage = await conceptApi.createMessage({ message, chatId: chat.id, messageAuthor, from: chat.fromNumber, headers, status: 'sent', appealType: 'whatsapp' });
        sendClients.forEach(sendClient => {
            sendClient.ws.send(JSON.stringify({
                event: "newMessage",
                newMessage: newMessage.data ? newMessage.data : null
            }));
        });
        let responseMessageWhatsapp = await whatsappApi.sendMessage({ phone_number_id: chat.phoneNumberId, from: chat.phoneNumber, message: message.text.body });
        let updateMessage = await conceptApi.updateMessage({ headers, messageId: newMessage.data.id, messageSecretKey: responseMessageWhatsapp.messages[0].id });
    }



}

exports.updateMessage = async function ({ id, status }) {
    let headers = await conceptApi.getHeaderConcept();
    let findMessage = await conceptApi.findeMessageSecretKey({ headers, messageSecretKey: id });
    let newMessage = await conceptApi.updateMessage({ headers, messageId: findMessage.id, status });
    let chat = await conceptApi.getChat({ headers, chatId: findMessage.chat.id });
    let sendClients = [];
    for (let i = 0; i < chat.members.length; i++) {
        let member = chat.members[i];
        let sendClientArray = clients.filter(client => client.currentUserId === member.id);
        if (sendClientArray.length > 0) {
            sendClientArray.forEach((sendClient) => {
                sendClients.push(sendClient);
            });
        }
    }
    sendClients.forEach(sendClient => {
        sendClient.ws.send(JSON.stringify({
            event: "statuses",
            newMessage: findMessage,
            status
        }));
    });
}

const messageQueue = [];
let bool = false;

async function startWorker() {
    while (true) {
        if (!bool) {
            if (messageQueue.length > 0) {
                const message = messageQueue.shift();
                try {
                    newAppealorNewMessage(message);
                    // console.log(" [x] Контакт успешно создан.");
                } catch (error) {
                    console.error(" [x] Произошла ошибка при создании контакта:", error);
                }
            }
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

function enqueueMessage(message) {
    messageQueue.push(message);
}

startWorker().catch(console.error);

exports.webhookController = async function webhookController({ messages, phone_number_id, userName, userPhoneNumber, msg_id, appealType }) {
    try {
        // console.log(messages);
        enqueueMessage({ messages, phone_number_id, userName, userPhoneNumber, msg_id, appealType });
        // webhookSync({phone_number_id, chat,from, messages, userName, headers, token, msg_id});
    } finally {
    }
};

async function createMessageWhatsapp({ headers, messages, chatId, appeal, phone_number_id, msg_id, appealType }) {



    if (messages.type === "text") {
        let newMessage = await conceptApi.createMessage({ headers, chatId, appeal, message: messages, msg_id, appealType });
        return newMessage;
    }

    if (messages.type === "image") {
        let responseFile = await whatsappApi.getFile(messages, "image");
        let responseDmsFile = await conceptApi.uploadFileChunks({ headers, messages, chat: { id: chatId }, type: "image", responseFile });
<<<<<<< HEAD
        let newMessage = await conceptApi.createMessage({ headers, chatId, appeal, message: messages, file: responseDmsFile });
=======
        let newMessage = await conceptApi.createMessage({ headers, chatId, appeal, message: messages, file: responseDmsFile, msg_id, appealType });
>>>>>>> b788a5caadbd6da35278a71d1d85e96e3d72dc2c
        // console.log("responseFile: ", responseFile);
        // console.log("responseDmsFile: ", responseDmsFile);
        // console.log("newMessage: ", newMessage);
        return newMessage;
    }

    if (messages.type === "document") {
        let responseFile = await whatsappApi.getFile(messages, "document");
        let responseDmsFile = await conceptApi.uploadFileChunks({ headers, messages, chat: { id: chatId }, type: "document", responseFile });
<<<<<<< HEAD
        let newMessage = await conceptApi.createMessage({ headers, chatId, appeal, message: messages, file: responseDmsFile });
=======
        let newMessage = await conceptApi.createMessage({ headers, chatId, appeal, message: messages, file: responseDmsFile, msg_id, appealType });
>>>>>>> b788a5caadbd6da35278a71d1d85e96e3d72dc2c
        // console.log("responseFile: ", responseFile);
        // console.log("responseDmsFile: ", responseDmsFile);
        // console.log("newMessage: ", newMessage);
        return newMessage;
    }

    if (messages.type === "audio") {
        let responseFile = await whatsappApi.getFile(messages, "audio");
        let responseDmsFile = await conceptApi.uploadFileChunks({ headers, messages, chat: { id: chatId }, type: "audio", responseFile });
<<<<<<< HEAD
        let newMessage = await conceptApi.createMessage({ headers, chatId, appeal, message: messages, file: responseDmsFile });
=======
        let newMessage = await conceptApi.createMessage({ headers, chatId, appeal, message: messages, file: responseDmsFile, msg_id, appealType });
>>>>>>> b788a5caadbd6da35278a71d1d85e96e3d72dc2c
        // console.log("responseFile: ", responseFile);
        // console.log("responseDmsFile: ", responseDmsFile);
        // console.log("newMessage: ", newMessage);
        return newMessage;
    } else {
        let autoMessage = {
            body: "Извините мы принимаем только картинки и документы и аудиофайлы!",
        };
        await whatsappApi.sendMessage({
            phone_number_id,
            from: messages.from,
            message: autoMessage.body,
        });
        return null;
    }

}

async function newAppealorNewMessage({ messages, phone_number_id, userName, userPhoneNumber, msg_id, appealType }) {
    // console.log(messages);
    let headers = await conceptApi.getHeaderConcept();
    let appeal = null;
    let clientChat = null;
    appeal = await conceptApi.existenceCheckAppeal({ headers, userPhoneNumber });
<<<<<<< HEAD
    // console.log(appeal)
=======
>>>>>>> b788a5caadbd6da35278a71d1d85e96e3d72dc2c
    if (!appeal) {
        appeal = await conceptApi.createAppeal({ headers, userName, userPhoneNumber });
        if (!appeal?.chat) {
            clientChat = await conceptApi.createChatAppeal({ headers, phone_number_id, appealId: appeal.id, from: messages.from });
        }
        let newMessage = await createMessageWhatsapp({ headers, messages, chatId: clientChat?.id, appeal, phone_number_id, msg_id, appealType });
        let newAppeal = await conceptApi.getAppeal({ headers, appeal });
        openAppealsClients.forEach((ws) => {
            ws.send(JSON.stringify({ event: "newAppeal", newAppeal }));
        });
    } else {
        clientChat = appeal.chat;
        let newMessage = await createMessageWhatsapp({ headers, chatId: clientChat?.id, appeal, messages, phone_number_id, msg_id, appealType });
        if (+appeal.status === 3) {
            let updateAppeal = await conceptApi.updateAppeal({ headers, appeal, status: 1 });
            openAppealsClients.forEach((ws) => {
                ws.send(JSON.stringify({ event: "newAppeal", newAppeal: updateAppeal }));
            });
        }
        if (+appeal.status === 1 && newMessage) {
            openAppealsClients.forEach((ws) => {
                ws.send(JSON.stringify({ event: "newMessageAppeal", newMessage: { ...newMessage.data, appeal: { ...newMessage.appeal, name: appeal.name } } }));
            });
        } else if (+appeal.status === 2 && newMessage) {
            let chat = await conceptApi.getChat({ headers, chatId: newMessage.data.chat.id });
            clients.forEach((el) => {
                chat.members.forEach((member) => {
                    if (el.currentUserId === member.id) {
                        el.ws.send(JSON.stringify({
                            event: "newMessageAppeal",
<<<<<<< HEAD
                            newMessage: { ...newMessage.data, appeal: { ...newMessage.appeal, name: appeal.name, } }
=======
                            newMessage: { ...newMessage.data, appeal: { ...newMessage.appeal, name: appeal.name } }
>>>>>>> b788a5caadbd6da35278a71d1d85e96e3d72dc2c
                        }));
                    }
                });
            });
        }
    }
}
