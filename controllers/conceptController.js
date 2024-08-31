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
    console.log({ loading: "getAllChats2" });
    const chats = await conceptApi.getAllChats2({ typeChats: 1, headers, currentUserId });
    console.log({ chats });
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
            Clients,
            activeUserSearch: data.activeUserSearch
        }));
        return;
    }
    ws.send(JSON.stringify({
        event: "allChats",
        Colleagues,
        Clients,
        activeUserSearch: data.activeUserSearch
    }));
}

exports.getChatMessages = async function ({ ws, data }) {
    const chatId = data.chat.id;
    const limit = data.limit;
    const scrollTop = data.scrollTop;
    const headers = await conceptApi.getHeaderConcept();
    const messages = await conceptApi.getMessagesChat({ headers, chatId, limit });

    ws.send(JSON.stringify({
        event: "getChatMessages",
        messages: messages.data,
        total: messages.total,
        scrollTop
    }));
}

exports.sendMessage = async function ({ ws, data }) {
    const headers = await conceptApi.getHeaderConcept();
    const { message, chat, messageAuthor, from, file, prevMessage } = data;

    const newMessage = await conceptApi.createMessage({
        message,
        chatId: chat.id,
        messageAuthor,
        from,
        headers,
        file,
        prevMessageId: prevMessage?.id
    });
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
            chat: {
                ...chat,
                phoneNumber: appeal.phoneNumber,
                name: appeal.name,
                saleOrder: appeal.saleOrder,
                appeal: { ...chat.appeal, status: appeal.status, client: { fullName: appeal["client.fullName"], mobilePhone: appeal["client.mobilePhone"], id: appeal["client.id"] } }
            }
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
    const currentUserId = data?.currentUser?.id;
    const headers = await conceptApi.getHeaderConcept();
    const contacts = await conceptApi.getUsers({ headers });
    if (contacts) {
        const filterContacts = responseContacts.filter(contact => contact?.linkedUser?.id !== currentUserId.id);
        let newStructureContacts = {};
        filterContacts.forEach(contact => {
            newStructureContacts[contact.companyDepartment.id] = [];
        });
        filterContacts.forEach(contact => {
            newStructureContacts[contact.companyDepartment.id].push(contact);
        });
        ws.send(JSON.stringify({ event: 'getContacts', contacts: filterContacts }));
    } else {
        ws.send(JSON.stringify({ event: "getContacts", contacts: [] }));
    }
}

exports.searchContacts = async function ({ ws, data }) {
    const { currentUserId, fullName, department } = data;

    let headers = await conceptApi.getHeaderConcept();
    let responseContacts = await conceptApi.searchUsers({ headers, fullName, departMentId: department?.id });

    if (responseContacts) {
        const filterContacts = responseContacts.filter(contact => contact?.linkedUser?.id !== currentUserId.id);
        let newStructureContacts = {};
        filterContacts.forEach(contact => {
            newStructureContacts[contact?.companyDepartment?.id] = [];
        });
        filterContacts.forEach(contact => {
            newStructureContacts[contact?.companyDepartment?.id].push({ ...contact, checked: false });
        });
        ws.send(JSON.stringify({ event: 'getContacts', contacts: newStructureContacts, department }));
    } else {
        ws.send(JSON.stringify({ event: "getContacts", contacts: [], department }));
    }

}

exports.getDepartMents = async function ({ ws, data }) {
    let { currentUserId, department } = data;

    let headers = await conceptApi.getHeaderConcept();

    let responseDepartMents = await conceptApi.getDepartMents({ headers, currentUserId });

    ws.send(JSON.stringify({
        event: "DepartMents",
        departMents: responseDepartMents.map((el) => {
            return { ...el, checked: false }
        })
    }));

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
    let response = await conceptApi.getAppeals({ headers, status: 1 });

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

exports.searchClients = async function ({ ws, data }) {
    let { currentUserId, phoneNumber, name } = data;
    let headers = await conceptApi.getHeaderConcept();
    let searchClients = await conceptApi.searchAppeal({ headers, phoneNumber, name });
    if (searchClients) {
        ws.send(JSON.stringify({
            event: "getClients",
            clients: searchClients
        }));
        return;
    }
    ws.send(JSON.stringify({
        event: "getClients",
        clients: []
    }));
    // console.log("searchClients: ", searchClients);

}

exports.searchActiveClients = async function ({ ws, data }) {
    let { currentUserId, phoneNumber, name } = data;
    let headers = await conceptApi.getHeaderConcept();
    let activeClients = await conceptApi.searchActiveClients({ headers, name, phoneNumber, currentUserId });
    let Colleagues = [];
    let Clients = [];
    if (activeClients && activeClients.length > 0) {
        activeClients.forEach((chat) => {
            if (+chat.typeChats === 1 && chat.appeal) {
                let findUser = chat.members.find(el => el.id === currentUserId.id);
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

exports.searchActiveUsers = async function ({ ws, data }) {
    let { currentUserId, phoneNumber, name } = data;
    let headers = await conceptApi.getHeaderConcept();
    let activeUsers = await conceptApi.searchActiveUsers({ headers, name, currentUserId });
    let Colleagues = [];
    let Clients = [];
    if (activeUsers && activeUsers.length > 0) {
        activeUsers.forEach((chat) => {
            if (+chat.typeChats === 1 && !chat.appeal) {
                let collega = chat.members.find(el => el.id !== currentUserId.id);
                Colleagues.push({ ...chat, collegaId: collega.id, fullName: collega.fullName, code: collega.code });
            }
        });
        ws.send(JSON.stringify({
            event: "allChats",
            Colleagues,
            Clients
        }));
        return;
    }
}

exports.createOrgetChatClient = async function ({ ws, data }) {
    let { currentUserId, client, typeChat } = data;
    let headers = await conceptApi.getHeaderConcept();
    // let appeal = await conceptApi.searchAppeal({ headers, client });
    let chat = await conceptApi.getChat({ headers, chatId: client["chat.id"] });
    // if (chat["appeal.status"] === 1) {
    //     await updateAppealAndChat({
    //         ws, data: {
    //             appeal: {
    //                 id: chat.appeal.id,
    //                 $version: chat.appeal.version,
    //                 chat: {
    //                     id: chat.id
    //                 }
    //             }, status: 2, currentUserId
    //         }
    //     });
    // }
    if (chat["appeal.status"] === 2 || chat["appeal.status"] === 3 || chat["appeal.status"] === 1) {
        let completedUsers = chat.completedUsers ?? [];
        let members = chat.members ?? [];
        let findUserMembers = members.find(el => el.id === currentUserId.id);
        let findUserCompleted = completedUsers.find(el => el.id === currentUserId.id);
        let responseAppeal = null;
        if (!findUserMembers && chat["appeal.status"] === 3) {
            members.push({ id: currentUserId.id });
            completedUsers.push({ id: currentUserId.id });
            // responseAppeal = await conceptApi.updateAppeal({ headers, appeal: chat.appeal, status: 2 });
            // responseAppeal = await conceptApi.searchAppea({headers, client: responseAppeal});
        }
        if (!findUserMembers && chat["appeal.status"] === 2) {
            members.push({ id: currentUserId.id });
            completedUsers.push({ id: currentUserId.id });
        }

        if (!findUserMembers && chat["appeal.status"] === 1) {
            members.push({ id: currentUserId.id });
            completedUsers.push({ id: currentUserId.id });
        }
        // if (findUserMembers && chat["appeal.status"] === 3) {
        //     console.log("3333333333")
        //     completedUsers = completedUsers.filter(el => el.id !== currentUserId.id);
        //     responseAppeal = await conceptApi.updateAppeal({ headers, appeal: chat.appeal, status: 2 });
        //     // responseAppeal = await conceptApi.searchAppea({headers, client: responseAppeal});
        // }
        // if (findUserMembers && chat["appeal.status"] === 2) {
        //     completedUsers = completedUsers.filter(el => el.id !== currentUserId);
        //     // completedUsers = completedUsers.filter(el => el.id !== currentUserId);
        // }
        let responseChat = await conceptApi.updateChat({ headers, chat, members, completedUsers });
        let lastMessage = await conceptApi.lastMessageChat({ headers, chat });
        let transfers = await conceptApi.getTransferChat({ headers, chatId: responseChat.id });
        let sendClients = [];
        for (let i = 0; i < responseChat.members.length; i++) {
            let member = responseChat.members[i];
            let sendClientArray = clients.filter(client => client.currentUserId === member.id);
            if (sendClientArray.length > 0) {
                sendClientArray.forEach((sendClient) => {
                    sendClients.push(sendClient);
                });
            }
        }
        sendClients.forEach(sendClient => {
            sendClient.ws.send(JSON.stringify({
                event: "newWorkAppeal",
                newClient: {
                    ...responseChat,
                    appealId: client.id,
                    fullName: client.name,
                    phoneNumber: client.phoneNumber,
                    lastMessage: lastMessage,
                    appeal: {
                        ...client,
                        status: responseAppeal ? responseAppeal.status : client.status,
                        client: {
                            fullName: client["client.fullName"],
                            id: client["client.id"],
                            mobilePhone: client["client.mobilePhone"]
                        },
                        transfer: transfers ? [transfers[transfers.length - 1]] : null
                    }
                }
            }));
        });
    }
}

exports.getClients = async function ({ ws, data }) {

    let { currentUserId } = data;
    let headers = await conceptApi.getHeaderConcept();
    let clients = await conceptApi.getAppeals({ headers });

    ws.send(JSON.stringify({ event: "getClients", clients }));

}

async function updateAppealAndChat({ ws, data }) {
    let appeal = data.appeal;
    let status = data.status;
    let currentUserId = data.currentUserId;
    let headers = await conceptApi.getHeaderConcept();
    let responseAppeal = await conceptApi.updateAppeal({ headers, appeal, status });
    let searchAppeal = await conceptApi.searchAppeal({ headers, client: responseAppeal });
    let chat = await conceptApi.getChat({ headers, chatId: appeal?.chat?.id || appeal["chat.id"] });
    let members = chat.members ?? [];
    let completedUsers = chat.completedUsers ?? [];
    let newCompletedUsers = completedUsers.filter(el => el.id !== currentUserId.id);
    members.push({ id: currentUserId.id });
    let responseChat = await conceptApi.updateChat({ headers, chat, members, completedUsers: newCompletedUsers });
    let transfers = await conceptApi.getTransferChat({ headers, chatId: responseChat.id });
    let lastMessage = await conceptApi.lastMessageChat({ headers, chat });
    let responseSearchLead = await conceptApi.searchLead({
        mobilePhone: searchAppeal[0].phoneNumber
    });
    if (responseSearchLead) {
        await conceptApi.updateLead({
            id: responseSearchLead.id,
            version: responseSearchLead.version ?? responseSearchLead.$version
        })
    }
    let sendClients = [];
    for (let i = 0; i < responseChat.members.length; i++) {
        let member = responseChat.members[i];
        let sendClientArray = clients.filter(client => client.currentUserId === member.id);
        if (sendClientArray.length > 0) {
            sendClientArray.forEach((sendClient) => {
                sendClients.push(sendClient);
            });
        }
    }
    sendClients.forEach(sendClient => {
        sendClient.ws.send(JSON.stringify({
            event: "newWorkAppeal",
            newClient: {
                ...responseChat,
                appealId: responseAppeal.id,
                fullName: responseAppeal.name,
                phoneNumber: responseAppeal.phoneNumber,
                lastMessage: lastMessage,
                appeal: {
                    ...responseAppeal,
                    status: responseAppeal.status,
                    client: {
                        fullName: searchAppeal[0]["client.fullName"],
                        id: searchAppeal[0]["client.id"],
                        mobilePhone: searchAppeal[0]["client.mobilePhone"]
                    },
                    transfer: transfers ? [transfers[transfers.length - 1]] : null
                }
            }
        }));
    });

    openAppealsClients.forEach((openAppeal) => {
        openAppeal.send(JSON.stringify({
            event: "workAppeal",
            appeal: responseAppeal
        }));
    });
}

exports.updateAppealAndChat = updateAppealAndChat;

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
    let { chat, currentUserId } = data;
    let appeal = chat.appeal;

    let headers = await conceptApi.getHeaderConcept();
    let newCompletedUsers = chat.completedUsers ?? [];
    newCompletedUsers.push(currentUserId);
    let newChat = await conceptApi.updateChat({ headers, chat, completedUsers: newCompletedUsers });
    let completedUsers = newChat.completedUsers ?? [];
    let members = newChat.members ?? [];

    let newAppeal = completedUsers.length === members.length ? await conceptApi.updateAppeal({ headers, appeal, status: 3 }) : appeal;

    let searchAppeal = await conceptApi.searchAppeal({ headers, client: newAppeal });
    let transfers = await conceptApi.getTransferChat({ headers, chatId: newChat.id });
    let lastMessage = await conceptApi.lastMessageChat({ headers, chat: newChat });

    let sendClients = [];
    for (let i = 0; i < newChat.members.length; i++) {
        let member = newChat.members[i];
        let sendClientArray = clients.filter(client => client.currentUserId === member.id);
        if (sendClientArray.length > 0) {
            sendClientArray.forEach((sendClient) => {
                sendClients.push(sendClient);
            });
        }
    }
    sendClients.forEach(sendClient => {
        sendClient.ws.send(JSON.stringify({
            event: "newWorkAppeal",
            newClient: {
                ...newChat,
                appealId: searchAppeal[0].id,
                fullName: searchAppeal[0].name,
                phoneNumber: searchAppeal[0].phoneNumber,
                lastMessage: lastMessage,
                appeal: {
                    ...newAppeal,
                    status: searchAppeal[0].status,
                    client: {
                        fullName: searchAppeal[0]["client.fullName"],
                        id: searchAppeal[0]["client.id"],
                        mobilePhone: searchAppeal[0]["client.mobilePhone"]
                    },
                    transfer: transfers ? [transfers[transfers.length - 1]] : null
                }
            },
        }));
    });
}

exports.sendMessageWhatsapp = async function ({ ws, data }) {
    let { messageAuthor, chat, message, prevMessageSecretKey } = data;
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

    if (message.type.toLowerCase() === "text" && !prevMessageSecretKey) {
        newMessage = await conceptApi.createMessage({
            message,
            chatId: chat.id,
            messageAuthor,
            from: chat.fromNumber,
            headers,
            status: 'sent',
            appealType: 'whatsapp'
        });

        sendClients.forEach(sendClient => {
            sendClient.ws.send(JSON.stringify({
                event: "newMessageAppeal",
                newMessage: { ...newMessage.data, appeal: chat.appeal }
            }));
        });
        let responseMessageWhatsapp = await whatsappApi.sendMessage({ phone_number_id: chat.phoneNumberId, from: chat.phoneNumber, message: message.text.body });

        if (responseMessageWhatsapp) {
            let updateMessage = await conceptApi.updateMessage({
                headers,
                messageId: newMessage.data.id,
                messageSecretKey: responseMessageWhatsapp.messages[0].id
            });
        }
    }

    if (message.type.toLowerCase() === "text" && prevMessageSecretKey) {
        newMessage = await conceptApi.createMessage({
            message,
            chatId: chat.id,
            messageAuthor,
            from: chat.fromNumber,
            headers,
            status: 'sent',
            appealType: 'whatsapp',
            prevMessageSecretKey: prevMessageSecretKey
        });

        sendClients.forEach(sendClient => {
            sendClient.ws.send(JSON.stringify({
                event: "newMessageAppeal",
                newMessage: { ...newMessage.data, appeal: chat.appeal }
            }));
        });
        let responseMessageWhatsapp = await whatsappApi.answeringMessage({
            prevMessageSecretKey,
            from: chat.phoneNumber,
            message: message.text.body
        });

        if (responseMessageWhatsapp) {
            let updateMessage = await conceptApi.updateMessage({
                headers,
                messageId: newMessage.data.id,
                messageSecretKey: responseMessageWhatsapp.messages[0].id
            });
        }
    }
}

exports.updateMessage = async function ({ id, status }) {
    let headers = await conceptApi.getHeaderConcept();
    let findMessage = await conceptApi.findeMessageSecretKey({ headers, messageSecretKey: id });
    if (findMessage) {
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

}

exports.sendTemplate = async function ({ ws, data }) {
    let { chat, currentUserId, template } = data;
    let phoneNumber = chat.phoneNumber;
    let templateName = template.name;
    let code = template.language;
    let message = {
        type: "TEMPLATE",
        timestamp: conceptApi.createTimeStamp(),
        text: {
            body: JSON.stringify(template)
        }
    }

    let headers = await conceptApi.getHeaderConcept();

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

    let responseCreateMessage = await conceptApi.createMessage({
        message,
        chatId: chat.id,
        messageAuthor: currentUserId,
        from: chat.fromNumber,
        headers,
        status: 'sent',
        appealType: 'whatsapp'
    });

    sendClients.forEach(sendClient => {
        sendClient.ws.send(JSON.stringify({
            event: "newMessageAppeal",
            newMessage: { ...responseCreateMessage.data, appeal: chat.appeal }
        }));
    });

    let responseTemplateWhatsapp = await whatsappApi.sendTemplate({ phoneNumber, templateName, code });
    let responseUpdateMessage = await conceptApi.updateMessage({
        headers,
        messageId: responseCreateMessage.data.id,
        messageSecretKey: responseTemplateWhatsapp.messages[0].id
    })
    await updateAppealAndChat({
        ws, data: {
            appeal: {
                id: chat.appeal.id,
                $version: chat.appeal['$version'],
                chat: {
                    id: chat.id
                }
            },
            status: 2,
            currentUserId,
            lastMessage: { ...responseCreateMessage.data, appeal: chat.appeal }
        }
    });
}

exports.createTemplate = async function ({ ws, data }) {
    let { form } = data;
    let components = [];
    components.push({
        type: "BODY",
        text: data.form.body
    })
    if (data.form.header) {
        components.push({
            type: "HEADER",
            format: "text",
            text: data.form.header,
        });
    }
    if (data.form.footer) {
        components.push({
            type: "FOOTER",
            text: data.form.footer
        });
    }
    if (data.form.buttons) {
        let buttons = [];
        data.form.buttons.forEach((btn) => {
            if (btn.type === "PHONE_NUMBER") {
                buttons.push({
                    type: "PHONE_NUMBER",
                    text: btn.text,
                    phone_number: btn.phone_number
                })
            }
            if (btn.type === "URL") {
                buttons.push({
                    type: "URL",
                    text: btn.text,
                    url: btn.url
                })
            }
            if (btn.type === "QUICK_REPLY") {
                buttons.push({
                    type: "QUICK_REPLY",
                    text: btn.text,
                })
            }
        })
        components.push({
            type: "BUTTONS",
            buttons: buttons
        });
    }


    let responseCreateTemplate = await whatsappApi.createTemplate({ name: data.form.name, components, language: data.form.language });
    if (!responseCreateTemplate.error) {
        ws.send(JSON.stringify({
            event: "createTemplate", response: {
                success: {
                    ...responseCreateTemplate,
                    name: data.form.name,
                    components,
                    language: data.form.language
                }
            }
        }));
    }
    if (responseCreateTemplate.error) {
        ws.send(JSON.stringify({
            event: "createTemplate", response: {
                error: {
                    message: responseCreateTemplate.error.error_user_title + "." + responseCreateTemplate.error.error_user_msg,
                }
            }
        }));
    }
}

exports.updateTemplate = async function ({ ws, data }) {
    let { form } = data;
    let components = [];
    components.push({
        type: "BODY",
        text: data.form.body
    })
    if (data.form.header) {
        components.push({
            type: "HEADER",
            format: "text",
            text: data.form.header,
        });
    }
    if (data.form.footer) {
        components.push({
            type: "FOOTER",
            text: data.form.footer
        });
    }
    if (data.form.buttons) {
        let buttons = [];
        data.form.buttons.forEach((btn) => {
            if (btn.type === "PHONE_NUMBER") {
                buttons.push({
                    type: "PHONE_NUMBER",
                    text: btn.text,
                    phone_number: btn.phone_number
                })
            }
            if (btn.type === "URL") {
                buttons.push({
                    type: "URL",
                    text: btn.text,
                    url: btn.url
                })
            }
            if (btn.type === "QUICK_REPLY") {
                buttons.push({
                    type: "QUICK_REPLY",
                    text: btn.text,
                })
            }
        })
        components.push({
            type: "BUTTONS",
            buttons: buttons
        });
    }


    let responseUpdateTemplate = await whatsappApi.updateTemplate({ components, message_template_id: data.form.id });
    if (!responseUpdateTemplate.error) {
        ws.send(JSON.stringify({
            event: "updateTemplate", response: {
                success: {
                    ...responseUpdateTemplate,
                    name: data.form.name,
                    components,
                    language: data.form.language
                }
            }
        }));
    }
    if (responseUpdateTemplate.error) {
        ws.send(JSON.stringify({
            event: "updateTemplate", response: {
                error: {
                    message: responseUpdateTemplate.error.error_user_title + "." + responseUpdateTemplate.error.error_user_msg,
                }
            }
        }));
    }
}

exports.deleteTemplate = async function ({ ws, data }) {
    let { templateName, templateID } = data;
    let responseDeleteTemplate = await whatsappApi.deleteTemplate({ message_template_id: templateID, templateName: templateName });

    if (!responseDeleteTemplate.error) {
        ws.send(JSON.stringify({
            event: "deleteTemplate",
            response: {
                success: responseDeleteTemplate.success
            }
        }))
    }
    if (responseDeleteTemplate.error) {
        ws.send(JSON.stringify({
            event: "deleteTemplate",
            error: {
                message: responseDeleteTemplate.error.error_user_title + "." + responseDeleteTemplate.error.error_user_msg
            }
        }))
    }
}

exports.getTemplates = async function ({ ws, data }) {
    let response = await whatsappApi.getTemplates();

    ws.send(JSON.stringify({
        event: "getTemplate",
        templates: response.data
    }))

}

exports.sendTemplateBeginchat = async function ({ ws, data }) {
    let { currentUserId, phoneNumber } = data;
    let templateName = "hello_world";
    let code = "en_US";

    let headers = await conceptApi.getHeaderConcept();
    let appeal = await conceptApi.createAppeal({ headers, userPhoneNumber: phoneNumber, status: 2 });
    let chat = await conceptApi.createChatAppeal({ headers, appealId: appeal.id, from })

}

exports.addClient = async function ({ ws, data }) {
    let { currentUserId, clientPhoneNumber } = data;
    let headers = await conceptApi.getHeaderConcept();
    let appeal = await conceptApi.existenceCheckAppeal({ headers, userPhoneNumber: clientPhoneNumber });
    if (!appeal) {
        let responseCreateAppeal = await conceptApi.createAppeal({ headers, userPhoneNumber: clientPhoneNumber, status: 2 });
        let searchAppeal = await conceptApi.searchAppeal({ headers, client: responseCreateAppeal });
        let responseCreateChatAppeal = await conceptApi.createChatAppeal({ headers, phone_number_id: process.env.PHONE_NUMBER_ID, appealId: responseCreateAppeal.id });
        let members = responseCreateChatAppeal.members ?? [];
        members.push({ id: currentUserId.id });
        let responseUpdateChat = await conceptApi.updateChat({ headers, chat: responseCreateChatAppeal, members });
        let transfers = await conceptApi.getTransferChat({ headers, chatId: responseUpdateChat.id });
        let lastMessage = await conceptApi.lastMessageChat({ headers, chat: responseUpdateChat });
        let responseCreateLead = await conceptApi.createLead({
            name: clientPhoneNumber,
            mobilePhone: clientPhoneNumber,
            status: "inProgress"
        });
        clients.forEach((el) => {
            responseUpdateChat.members.forEach((member) => {
                if (el.currentUserId === member.id) {
                    el.ws.send(JSON.stringify({
                        event: "newWorkAppeal",
                        newClient: {
                            ...responseUpdateChat,
                            appealId: responseCreateAppeal.id,
                            fullName: responseCreateAppeal.name,
                            phoneNumber: responseCreateAppeal.phoneNumber,
                            lastMessage: lastMessage,
                            appeal: {
                                ...responseCreateAppeal,
                                status: responseCreateAppeal.status,
                                client: {
                                    fullName: searchAppeal[0]["client.fullName"],
                                    id: searchAppeal[0]["client.id"],
                                    mobilePhone: searchAppeal[0]["client.mobilePhone"]
                                },
                                transfer: transfers ? [transfers[transfers.length - 1]] : null
                            }
                        }
                    }))
                }
            })
        })
    } else {
        let updateAppeal = await conceptApi.updateAppeal({ headers, appeal, status: 2 });
        let searchAppeal = await conceptApi.searchAppeal({ headers, client: updateAppeal });
        let responseChat = await conceptApi.getChat({ headers, chatId: updateAppeal.chat.id });
        let members = responseChat.members ?? [];
        members.push({ id: currentUserId.id });
        let updateChat = await conceptApi.updateChat({ headers, chat: responseChat, members });
        let searchLead = await conceptApi.searchLead({ mobilePhone: clientPhoneNumber });
        let transfers = await conceptApi.getTransferChat({ headers, chatId: updateChat.id });
        let lastMessage = await conceptApi.lastMessageChat({ headers, chat: updateChat });
        if (searchLead) {
            await conceptApi.updateLead({
                id: searchLead.id,
                version: searchLead.version ?? searchLead.$version
            });
        }
        if (+appeal.status === 3) {
            openAppealsClients.forEach((ws) => {
                ws.send(JSON.stringify({ event: "workAppeal", appeal: updateAppeal }));
            });
        }
        clients.forEach((el) => {
            updateChat.members.forEach((member) => {
                if (el.currentUserId === member.id) {
                    el.ws.send(JSON.stringify({
                        event: "newWorkAppeal",
                        newClient: {
                            ...updateChat,
                            appealId: updateAppeal.id,
                            fullName: updateAppeal.name,
                            phoneNumber: updateAppeal.phoneNumber,
                            lastMessage: lastMessage,
                            appeal: {
                                ...updateAppeal,
                                status: updateAppeal.status,
                                client: {
                                    fullName: searchAppeal[0]["client.fullName"],
                                    id: searchAppeal[0]["client.id"],
                                    mobilePhone: searchAppeal[0]["client.mobilePhone"]
                                },
                                transfer: transfers ? [transfers[transfers.length - 1]] : null
                            }
                        }
                    }))
                }
            })
        })
    }
}

exports.transferClient = async function ({ ws, data }) {
    let { currentUserId, chat, checkedContacts, lastMessage } = data;
    let appeal = chat.appeal;
    let members = chat.members;
    let completedUsers = chat.completedUsers;
    completedUsers.push({ id: currentUserId.id });
    checkedContacts.forEach((contact) => {
        members.push({ id: contact?.linkedUser?.id });
        completedUsers = completedUsers.filter(el => el.id !== contact.linkedUser.id);
    });

    let transferTo = checkedContacts.map((el) => {
        return { id: el.linkedUser.id };
    });


    let headers = await conceptApi.getHeaderConcept();
    let updateChat = await conceptApi.updateChat({ headers, chat, members, completedUsers });
    let createTransfer = await conceptApi.createTransfer({ headers, transferFrom: currentUserId, transferTo });
    let responseAppeal = await conceptApi.searchAppeal({ headers, client: appeal });
    let updateAppeal = await conceptApi.updateAppeal({ headers, appeal: responseAppeal[0], transfer: { id: createTransfer.id } });

    let message = {
        type: "TRANSFER",
        timestamp: conceptApi.createTimeStamp(),
        text: {
            body: ""
        }
    }

    let createMessage = await conceptApi.createMessage({
        headers,
        message,
        messageAuthor: currentUserId,
        chatId: chat.id,
        appealType: "whatsapp",
        status: 'sent',
        appeal: updateAppeal,
        transfer: createTransfer
    });

    clients.forEach(el => {
        updateChat.members.forEach((member) => {
            let findCheckedContact = checkedContacts.find(chekEl => chekEl.linkedUser.id === el.currentUserId);
            if (el.currentUserId === member.id || findCheckedContact) {
                el.ws.send(JSON.stringify({
                    event: "transferClient",
                    transferChat: {
                        ...updateChat,
                        appealId: updateAppeal.id,
                        fullName: updateAppeal.name,
                        phoneNumber: updateAppeal.phoneNumber,
                        lastMessage: createMessage.data,
                        appeal: {
                            ...updateAppeal,
                            transfer: [createTransfer],
                            status: updateAppeal.status,
                            client: {
                                fullName: responseAppeal[0]["client.fullName"],
                                id: responseAppeal[0]["client.id"],
                                mobilePhone: responseAppeal[0]["client.mobilePhone"]
                            }
                        }
                    },
                    transferMessage: createMessage
                }))
            }
        })
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
        let newMessage = await conceptApi.createMessage({ headers, chatId, appeal, message: messages, file: responseDmsFile, msg_id, appealType });
        // console.log("responseFile: ", responseFile);
        // console.log("responseDmsFile: ", responseDmsFile);
        // console.log("newMessage: ", newMessage);
        return newMessage;
    }

    if (messages.type === "document") {
        let responseFile = await whatsappApi.getFile(messages, "document");
        let responseDmsFile = await conceptApi.uploadFileChunks({ headers, messages, chat: { id: chatId }, type: "document", responseFile });
        let newMessage = await conceptApi.createMessage({ headers, chatId, appeal, message: messages, file: responseDmsFile, msg_id, appealType });
        // console.log("responseFile: ", responseFile);
        // console.log("responseDmsFile: ", responseDmsFile);
        // console.log("newMessage: ", newMessage);
        return newMessage;
    }

    if (messages.type === "audio") {
        let responseFile = await whatsappApi.getFile(messages, "audio");
        let responseDmsFile = await conceptApi.uploadFileChunks({ headers, messages, chat: { id: chatId }, type: "audio", responseFile });
        let newMessage = await conceptApi.createMessage({ headers, chatId, appeal, message: messages, file: responseDmsFile, msg_id, appealType });
        // console.log("responseFile: ", responseFile);
        // console.log("responseDmsFile: ", responseDmsFile);
        // console.log("newMessage: ", newMessage);
        return newMessage;
    }
    if (messages.type === "video") {
        let responseFile = await whatsappApi.getFile(messages, "video");
        let responseDmsFile = await conceptApi.uploadFileChunks({ headers, messages, chat: { id: chatId }, type: "video", responseFile });
        let newMessage = await conceptApi.createMessage({ headers, chatId, appeal, message: messages, file: responseDmsFile, msg_id, appealType });
        // console.log("responseFile: ", responseFile);
        // console.log("responseDmsFile: ", responseDmsFile);
        // console.log("newMessage: ", newMessage);
        return newMessage;
    } else {
        let autoMessage = {
            body: "Извините мы принимаем только картинки, документы и аудиофайлы!",
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
    bool = true;
    let headers = await conceptApi.getHeaderConcept();
    let appeal = null;
    let clientChat = null;
    appeal = await conceptApi.existenceCheckAppeal({ headers, userPhoneNumber });
    if (!appeal) {
        appeal = await conceptApi.createAppeal({ headers, userName, userPhoneNumber });
        if (!appeal?.chat) {
            clientChat = await conceptApi.createChatAppeal({ headers, phone_number_id, appealId: appeal.id, from: messages.from });
        }
        bool = false;
        let newMessage = await createMessageWhatsapp({ headers, messages, chatId: clientChat?.id, appeal, phone_number_id, msg_id, appealType });
        let newAppeal = await conceptApi.getAppeal({ headers, appeal });
        let responseCreateLead = await conceptApi.createLead({
            name: userName,
            mobilePhone: userPhoneNumber,
            status: "new"
        });
        openAppealsClients.forEach((ws) => {
            ws.send(JSON.stringify({ event: "newAppeal", newAppeal: { ...newAppeal, chat: clientChat } }));
        });
    } else {
        bool = false;
        clientChat = appeal.chat;
        let responseSearchLead = await conceptApi.searchLead({
            mobilePhone: appeal.phoneNumber
        });
        if (responseSearchLead) {
            await conceptApi.updateLead({
                id: responseSearchLead.id,
                version: responseSearchLead.version ?? responseSearchLead.$version
            })
        }
        let newMessage = await createMessageWhatsapp({ headers, chatId: clientChat?.id, appeal, messages, phone_number_id, msg_id, appealType });
        if (+appeal.status === 3) {
            let updateAppeal = await conceptApi.updateAppeal({ headers, appeal, status: 1 });
            let searchAppeal = await conceptApi.searchAppeal({ headers, client: updateAppeal });
            let responseChat = await conceptApi.getChat({ headers, chatId: updateAppeal.chat.id });
            let transfers = await conceptApi.getTransferChat({ headers, chatId: responseChat.id });
            openAppealsClients.forEach((ws) => {
                ws.send(JSON.stringify({ event: "newAppeal", newAppeal: updateAppeal }));
            });
            clients.forEach((el) => {
                responseChat.members.forEach((member) => {
                    if (el.currentUserId === member.id) {
                        el.ws.send(JSON.stringify({
                            event: "newWorkAppeal",
                            newClient: {
                                ...responseChat,
                                appealId: updateAppeal.id,
                                fullName: updateAppeal.name,
                                phoneNumber: updateAppeal.phoneNumber,
                                lastMessage: updateAppeal.lastMessage,
                                appeal: {
                                    ...updateAppeal,
                                    status: updateAppeal.status,
                                    client: {
                                        fullName: searchAppeal[0]["client.fullName"],
                                        id: searchAppeal[0]["client.id"],
                                        mobilePhone: searchAppeal[0]["client.mobilePhone"]
                                    },
                                    transfer: transfers ? [transfers[transfers.length - 1]] : null
                                }
                            }
                        }));
                    }
                });
            });
        }
        if (+appeal.status === 1 && newMessage) {
            openAppealsClients.forEach((ws) => {
                ws.send(JSON.stringify({ event: "newMessageAppeal", newMessage: { ...newMessage.data, appeal: { ...newMessage.appeal, name: appeal.name } } }));
            });
        } else if (+appeal.status === 2 && newMessage) {
            let chat = await conceptApi.getChat({ headers, chatId: newMessage.data.chat.id });
            if (appeal.name === "" || appeal.phoneNumber === "") {
                appeal = await conceptApi.updateAppeal({ headers, name: userName, phoneNumber: userPhoneNumber, appeal });
            }
            clients.forEach((el) => {
                chat.members.forEach((member) => {
                    if (el.currentUserId === member.id) {
                        el.ws.send(JSON.stringify({
                            event: "newMessageAppeal",
                            newMessage: {
                                ...newMessage.data,
                                appeal: {
                                    ...appeal,
                                }
                            }
                        }));
                    }
                });
            });
        }
    }
}
