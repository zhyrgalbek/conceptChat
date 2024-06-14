const axios = require("axios").default;
const { promisify } = require('util');
const fs = require("fs");
const unlinkAsync = promisify(fs.unlink);
const whatsappFileTypes = require("./whatsappFileTypes.js");
require('dotenv').config();

let headers = null;

let DOMAIN = process.env.DOMAIN;

async function getHeaderConcept() {
    // console.log(headers);
    // if (headers == null) {
    // console.log("start");

    let responseAxelor = await axios({
        method: "POST",
        url: DOMAIN + "/callback",
        data: {
            username: process.env.BD_USER,
            password: process.env.PASSWORD,
        },
        headers: {
            "Content-Type": "application/json",
        },
    });
    // console.log("end");
    // console.log(responseAxelor);
    headers = responseAxelor.headers["set-cookie"].toString();
    // setTimeout(() => {
    //   headers = null;
    // }, 12000 * 60);
    // } else {
    //     return headers;
    // }
    return headers;
};

exports.getHeaderConcept = getHeaderConcept;

async function getUsers({ headers }) {
    let obj = {
        "offset": 0,
        "limit": 40,
        "fields": ["fullName", "code", "group"],
        "sortBy": ["fullName"],
        "data": {
            "criteria": [{
                "operator": "or",
                "criteria": [{
                    "fieldName": "roles",
                    "operator": "=",
                    "value": "Admin"
                }]
            }]
        }
    }
    let response = await axios({
        headers: {
            "Content-Type": "application/json",
            Cookie: headers,
        },
        method: "POST",
        url: DOMAIN + "/ws/rest/com.axelor.auth.db.User/search",
        data: JSON.stringify(obj),
    });
    if (response.data.data) {
        return response.data.data;
    } else {
        return null;
    }
}

exports.getUsers = getUsers;

async function searchUsers({ headers, fullName }) {
    try {
        let obj = {
            "offset": 0,
            "limit": 40,
            "fields": ["fullName", "code", "group"],
            "sortBy": ["fullName"],
            "data": {
                "criteria": [{
                    "operator": "and",
                    "criteria": [{
                        "fieldName": "fullName",
                        "operator": "like",
                        "value": fullName
                    }, {
                        "fieldName": "roles",
                        "operator": "=",
                        "value": "Admin"
                    }]
                }]
            }
        }

        let response = await axios({
            headers: {
                "Content-Type": "application/json",
                Cookie: headers,
            },
            method: "POST",
            url: DOMAIN + "/ws/rest/com.axelor.auth.db.User/search",
            data: JSON.stringify(obj),
        });

        if (response.status === 200) {
            if (response.data.status === 0 && response.data.data) {
                return response.data.data;
            } else {
                throw new Error(response.data?.error ?? response.data.data);
            }
        } else {
            throw new Error(`${response.status} ${response.statusText}`);
        }
    } catch (error) {
        return error.message;
    }
}

exports.searchUsers = searchUsers;

async function getChat({ headers, chatId }) {
    let obj = {
        "offset": 0,
        "limit": 10,
        "fields": ["phoneNumberId", "fromNumber", "chatSeans", "typeChats", "members", "unreadMessageCount", "appeal", "completedUsers", "appeal.id", "appeal.status"],
        "data": {
            "criteria": [{
                "fieldName": "id",
                "operator": "=",
                "value": chatId
            }]
        }
    }
    let response = await axios({
        headers: {
            "Content-Type": "application/json",
            Cookie: headers,
        },
        method: "POST",
        url: DOMAIN + "/ws/rest/com.axelor.apps.msg.db.Chat/search",
        data: JSON.stringify(obj),
    });
    if (response.data.data) {
        return response.data.data[0];
    } else {
        return null;
    }
}

exports.getChat = getChat;

async function getAllChats({ headers, currentUserId, typeChat }) {
    let obj = {
        offset: 0,
        limit: 10,
        fields: ["phoneNumberId", "fromNumber", "chatSeans", "typeChats", "members"],
        data: {
            criteria: [{
                operator: "and",
                criteria: [
                    {
                        fieldName: "members.id",
                        operator: "=",
                        value: currentUserId
                    }
                    // {
                    //     fieldName: "typeChats",
                    //     operator: "=",
                    //     value: typeChat
                    // },
                ]
            }]
        }
    };

    let response = await axios({
        headers: {
            "Content-Type": "application/json",
            Cookie: headers,
        },
        method: "POST",
        url: DOMAIN + "/ws/rest/com.axelor.apps.msg.db.Chat/search",
        data: JSON.stringify(obj),
    });
    if (response.data.data) {
        return response.data.data;
    } else {
        return null;
    }
}

// {
//     "status": 0,
//     "offset": 0,
//     "total": 1,
//     "data": [
//         {
//             "fromNumber": "5445455454",
//             "typeChats": "1",
//             "members": [
//                 {
//                     "code": "t.vsyakih",
//                     "fullName": "Татьяна Всяких Татьяна",
//                     "id": 6,
//                     "$version": 1
//                 },
//                 {
//                     "code": "tqm@concept.kg",
//                     "fullName": "Бегайым Токторова Бегайым",
//                     "id": 7,
//                     "$version": 1
//                 }
//             ],
//             "id": 1,
//             "chatSeans": true,
//             "version": 0,
//             "phoneNumberId": "990550405",
//             "$wkfStatus": null
//         }
//     ]
// }

exports.getAllChats = getAllChats

async function getAllChats2({ headers, currentUserId }) {
    try {
        let response = await axios({
            headers: {
                "Content-Type": "application/json",
                Cookie: headers,
            },
            method: "GET",
            url: DOMAIN + "/ws/chats/" + currentUserId,
        });
        if (response.status === 200) {
            if (response.data.status === 0) {
                if (response.data.data) {
                    return response.data.data;
                }
            }
            if (response.data.status === -1) {
                if (response.data.errors.message === "no chats") {
                    return [];
                }
            }
        } else {
            throw new Error("error");
        }
    } catch (error) {
        // console.log(error);
        return error;
    }
}

exports.getAllChats2 = getAllChats2;

async function getMessagesChat({ headers, chatId, limit = 40 }) {
    let obj = {
        offset: 0,
        limit: limit,
        sortBy: ["-createdOn"],
        fields: ["fileSize", "fileName", "fileId", "fileType", "messageSecretKey", "type", "body", "timestamp", "fromNumber", "operatorName", "messageAuthor", "chat", "appeal", "flags", "status", "appealType"],
        data: {
            criteria: [
                {
                    fieldName: "chat.id",
                    operator: "=",
                    value: chatId
                }
            ]
        }
    };
    let response = await axios({
        headers: {
            "Content-Type": "application/json",
            Cookie: headers,
        },
        method: "POST",
        url: DOMAIN + "/ws/rest/com.axelor.message.db.Message/search",
        data: JSON.stringify(obj),
    });
    if (response.data.data) {
        return response.data.data;
    } else {
        return [];
    }
}

exports.getMessagesChat = getMessagesChat;

async function lastMessageChat({ headers, chat }) {
    try {
        let obj = {
            offset: 0,
            limit: 1,
            sortBy: ["-createdOn"],
            fields: ["fileSize", "fileName", "fileId", "fileType", "messageSecretKey", "type", "body", "timestamp", "fromNumber", "operatorName", "messageAuthor", "chat", "appeal", "flags", "status"],
            data: {
                criteria: [
                    {
                        fieldName: "chat.id",
                        operator: "=",
                        value: chat.id
                    }
                ]
            }
        };
        let response = await axios({
            headers: {
                "Content-Type": "application/json",
                Cookie: headers,
            },
            method: "POST",
            url: DOMAIN + "/ws/rest/com.axelor.message.db.Message/search",
            data: JSON.stringify(obj),
        });
        if (response.status === 200) {
            if (response.data.status === 0 && response.data.data) {
                return response.data.data[0];
            } else {
                throw new Error(response.data?.error ?? response.data.data);
            }
        } else {
            throw new Error(`${response.status} ${response.statusText}`);
        }
    } catch (error) {
        return error.message;
    }
}

exports.lastMessageChat = lastMessageChat;

async function isReadMessages({ headers, chat, currentUser }) {
    let obj = {
        chat: chat,
        user: currentUser
    };
    let response = await axios({
        headers: {
            "Content-Type": "application/json",
            Cookie: headers,
        },
        method: "POST",
        url: DOMAIN + "/ws/chats/flags",
        data: JSON.stringify(obj)
    });
    if (response.data.status === 0) {
        return response.data;
    } else {
        return null;
    }
}

exports.isReadMessages = isReadMessages;

async function createMessage({ message, chatId, messageAuthor, from, headers, file, appeal, status, msg_id, appealType }) {
    let obj = {
        type: message.type.toUpperCase(),
        timestamp: message.timestamp ?? null,
        messageAuthor: messageAuthor ?? null,
        fromNumber: from ?? "",
        chat: {
            id: chatId,
        },
        status: status ?? null,
        messageSecretKey: msg_id ?? null,
        appealType: appealType ?? null
    };
    if (message.text) {
        obj.body = message.text.body;
    }
    if (appeal) {
        obj.appeal = {
            id: appeal.id
        };
    }
    if (file) {
        obj.fileSize = file.fileSize;
        obj.fileName = file.fileName;
        obj.fileId = file.fileId;
        obj.fileType = file.fileType;
    }
    console.log("obj: ", obj);

    let response = await axios({
        headers: {
            "Content-Type": "application/json",
            Cookie: headers,
        },
        method: "POST",
        url: DOMAIN + "/ws/chats/message",
        data: JSON.stringify(obj),
    });

    return response.data;
}

exports.createMessage = createMessage;

async function findeMessageSecretKey({ headers, messageSecretKey }) {
    try {
        let obj = {
            offset: 0,
            limit: 1,
            fields: ["fileSize", "fileName", "fileId", "fileType", "messageSecretKey", "type", "body", "timestamp", "fromNumber", "operatorName", "messageAuthor", "chat", "appeal", "flags", "status"],
            data: {
                criteria: [
                    {
                        fieldName: "messageSecretKey",
                        operator: "=",
                        value: `${messageSecretKey}`
                    }
                ]
            }
        }
        let response = await axios({
            headers: {
                "Content-Type": "application/json",
                Cookie: headers,
            },
            method: "POST",
            url: DOMAIN + "/ws/rest/com.axelor.message.db.Message/search",
            data: JSON.stringify(obj),
        });

        if (response.status === 200) {
            if (response.data.status === 0 && response.data.data) {
                return response.data.data[0];
            } else {
                throw new Error(response.data?.error ?? response.data.data);
            }
        } else {
            throw new Error(`${response.status} ${response.statusText}`);
        }
    } catch (error) {
        return error.message;
    }
}

exports.findeMessageSecretKey = findeMessageSecretKey;

async function updateMessage({ headers, messageId, status, messageSecretKey }) {
    try {
        let obj = {
            data: {
                id: messageId,
            }
        }
        if (status) {
            obj.data.status = status;
        }
        if (messageSecretKey) {
            obj.data.messageSecretKey = messageSecretKey;
        }
        let response = await axios({
            headers: {
                "Content-Type": "application/json",
                Cookie: headers,
            },
            method: "POST",
            url: DOMAIN + "/ws/v2/rest/com.axelor.message.db.Message",
            data: JSON.stringify(obj),
        });
        if (response.status === 200) {
            if (response.data.status === 0 && response.data.data) {
                return response.data.data;
            } else {
                throw new Error(response.data?.error ?? response.data.data);
            }
        } else {
            throw new Error(`${response.status} ${response.statusText}`);
        }
    } catch (error) {
        return error.message;
    }

}

exports.updateMessage = updateMessage;

async function createChat({ headers, currentUserId, userId, typeChat }) {
    try {
        let obj = {
            data: {
                typeChats: typeChat,
                members: [
                    {
                        id: currentUserId,
                    },
                    {
                        id: userId,
                    }
                ]
            }
        }
        let response = await axios({
            headers: {
                "Content-Type": "application/json",
                Cookie: headers,
            },
            method: "PUT",
            url: DOMAIN + "/ws/rest/com.axelor.apps.msg.db.Chat",
            data: JSON.stringify(obj),
        });
        if (response.status === 200) {
            if (response.data.data) {
                return response.data.data[0];
            } else {
                throw new Error("dont create chat 1");
            }
        } else {
            throw new Error("dont create chat");
        }
    } catch (error) {
        return error;
    }

}

exports.createChat = createChat;

async function getChatTwoUsers({ headers, currentUserId: userId1, userId: userId2, typeChat }) {
    try {
        let response = await axios({
            headers: {
                "Content-Type": "application/json",
                Cookie: headers,
            },
            method: "GET",
            url: DOMAIN + "/ws/chats?userId1=" + userId1 + "&userId2=" + userId2,
        });
        if (response.status === 200) {
            if (response.data.status === 0 && response.data.data) {
                return response.data.data;
            } else {
                throw new Error(response.data.error);
            }
        } else {
            throw new Error("dont etharnet");
        }
    } catch (error) {
        return error.message;
    }
}

exports.getChatTwoUsers = getChatTwoUsers;

async function getAppeals({ headers, status }) {
    try {
        let obj = {};
        if (status) {
            obj.offset = 0;
            obj.limit = 12;
            obj.sortBy = ["-updatedOn"];
            obj.data = {
                _domain: "self.status = :status",
                _domainContext: {
                    status: status
                }
            }
        } else {
            obj.offset = 0;
            obj.limit = 12;
            obj.fields = ["name", "phoneNumber", "client.mobilePhone", "client.fullName", "client.name", "client.id", "chat.id", "status"];
            obj.sortBy = ["-updatedOn"];
        }
        let response = await axios({
            headers: {
                "Content-Type": "application/json",
                Cookie: headers,
            },
            method: "POST",
            url: DOMAIN + "/ws/rest/com.axelor.apps.msg.db.Appeal/search",
            data: JSON.stringify(obj),
        });
        if (response.status === 200) {
            if (response.data.status === 0 && response.data.data) {
                return response.data.data;
            } else {
                throw new Error(response.data?.error ?? response.data.data);
            }
        } else {
            throw new Error(`${response.status} ${response.statusText}`);
        }
    } catch (error) {
        return error.message;
    }
}

async function getPartner({ headers, id }) {
    try {
        let obj = {
            offset: 0,
            limit: 12,
            fields: ["fullName", "mobilePhone"],
            sortBy: ["-updatedOn"],
            data: {
                criteria: [
                    {
                        operator: "or",
                        criteria: [{
                            fieldName: "id",
                            operator: "=",
                            value: id
                        }]
                    }
                ]
            }
        }

        let response = await axios({
            headers: {
                "Content-Type": "application/json",
                Cookie: headers,
            },
            method: "POST",
            url: DOMAIN + "/ws/rest/com.axelor.apps.base.db.Partner/search",
            data: JSON.stringify(obj),
        });
        if (response.status === 200) {
            if (response.data.status === 0 && response.data.data) {
                return response.data.data[0];
            } else {
                throw new Error(response.data?.error ?? response.data.data);
            }
        } else {
            throw new Error(`${response.status} ${response.statusText}`);
        }
    } catch (error) {
        return error.message;
    }
}

exports.getPartner = getPartner;


exports.getAppeals = getAppeals;

async function createAppeal({ headers, userName, userPhoneNumber, status = 1 }) {
    try {

        let obj = {
            data: {
                name: userName ?? "",
                phoneNumber: userPhoneNumber,
                status: status
            }
        }

        let response = await axios({
            headers: {
                "Content-Type": "application/json",
                Cookie: headers,
            },
            method: "PUT",
            url: DOMAIN + "/ws/rest/com.axelor.apps.msg.db.Appeal",
            data: JSON.stringify(obj),
        });

        if (response.status === 200) {
            if (response.data.status === 0 && response.data.data) {
                return response.data.data[0];
            } else {
                throw new Error(response.data.error ?? response.data.data);
            }
        } else {
            throw new Error(`${response.status} ${response.statusText}`);
        }
    } catch (error) {
        return error.message;
    }
}

exports.createAppeal = createAppeal;

async function searchAppeal({ headers, phoneNumber, name, client }) {
    try {

        let obj = {
            offset: 0,
            limit: 12,
            fields: ["name", "phoneNumber", "client.mobilePhone", "client.fullName", "client.name", "client.id", "chat.id", "status", "lastMessage"],
            sortBy: ["-createdOn"],
            data: {
                criteria: [{
                    operator: "or",
                }]
            }
        }

        if (client) {
            obj.data.criteria[0].criteria = [{
                fieldName: "id",
                operator: "=",
                value: client.id
            }];
        }

        if (phoneNumber) {
            obj.data.criteria[0].criteria = [{
                fieldName: "phoneNumber",
                operator: "like",
                value: phoneNumber
            }]
        }
        if (name) {
            obj.data.criteria[0].criteria = [{
                fieldName: "name",
                operator: "like",
                value: name
            }, {
                fieldName: "client.fullName",
                operator: "like",
                value: name
            }]
        }

        console.log("obj: ", obj);

        let response = await axios({
            headers: {
                "Content-Type": "application/json",
                Cookie: headers,
            },
            method: "POST",
            url: DOMAIN + "/ws/rest/com.axelor.apps.msg.db.Appeal/search",
            data: JSON.stringify(obj),
        });

        if (response.status === 200) {
            if (response.data.status === 0 && response.data.data) {
                return response.data.data;
            } else {
                throw new Error(response.data.error ?? response.data.data);
            }
        } else {
            throw new Error(`${response.status} ${response.statusText}`);
        }
    } catch (error) {
        return error.message;
    }
}

exports.searchAppeal = searchAppeal;

async function searchActiveClients({ headers, phoneNumber, name, currentUserId }) {
    try {
        let searchText = phoneNumber ?? name;
        let response = await axios({
            headers: {
                "Content-Type": "application/json",
                Cookie: headers,
            },
            method: "GET",
            url: DOMAIN + "/ws/chats/" + currentUserId.id + "?clientSearch=" + searchText,
        });

        if (response.status === 200) {
            if (response.data.status === 0 && response.data.data) {
                return response.data.data;
            }
            if (response.data.status === -1) {
                return [];
            } else {
                throw new Error(response.data.error ?? response.data.data);
            }
        } else {
            throw new Error(`${response.status} ${response.statusText}`);
        }
    } catch (error) {
        return error.message;
    }
}

exports.searchActiveClients = searchActiveClients;

async function searchActiveUsers({ headers, name, currentUserId }) {
    try {
        let searchText = name;
        let response = await axios({
            headers: {
                "Content-Type": "application/json",
                Cookie: headers,
            },
            method: "GET",
            url: DOMAIN + "/ws/chats/" + currentUserId.id + "?userSearch=" + searchText,
        });

        console.log("response.status: ", response.status)

        if (response.status === 200) {
            if (response.data.status === 0 && response.data.data) {
                return response.data.data;
            }
            if (response.data.status === -1) {
                return [];
            } else {
                throw new Error(response.data.error ?? response.data.data);
            }
        } else {
            throw new Error(`${response.status} ${response.statusText}`);
        }
    } catch (error) {
        return error.message;
    }
}

exports.searchActiveUsers = searchActiveUsers;

async function createChatAppeal({ headers, phone_number_id, appealId, from }) {
    try {

        let obj = {
            data: {
                fromNumber: from ?? null,
                phoneNumberId: phone_number_id,
                typeChats: 1,
                appeal: {
                    id: appealId
                }
            }
        }

        let response = await axios({
            headers: {
                "Content-Type": "application/json",
                Cookie: headers,
            },
            method: "PUT",
            url: DOMAIN + "/ws/rest/com.axelor.apps.msg.db.Chat",
            data: JSON.stringify(obj),
        });

        if (response.status === 200) {
            if (response.data.status === 0 && response.data.data) {
                return response.data.data[0];
            } else {
                throw new Error(response.data.error ?? response.data.data);
            }
        } else {
            throw new Error(`${response.status} ${response.statusText}`);
        }
    } catch (error) {
        return error.message;
    }
}

exports.createChatAppeal = createChatAppeal;

async function existenceCheckAppeal({ headers, userPhoneNumber }) {
    try {
        let obj = {
            offset: 0,
            limit: 12,
            sortBy: ["-updatedOn"],
            data: {
                _domain: "self.phoneNumber = :phoneNumber",
                _domainContext: {
                    phoneNumber: userPhoneNumber
                }
            }
        };
        let response = await axios({
            headers: {
                "Content-Type": "application/json",
                Cookie: headers,
            },
            method: "POST",
            url: DOMAIN + "/ws/rest/com.axelor.apps.msg.db.Appeal/search",
            data: JSON.stringify(obj),
        });
        if (response.status === 200) {
            if (response.data.status === 0 && response.data.data) {
                return response.data.data[0];
            } else {
                // throw new Error(response?.data?.error ?? response?.data?.data);
                return null;
            }
        } else {
            throw new Error(`${response.status} ${response.statusText}`);
        }
    } catch (error) {
        return error.message;
    }
}

exports.existenceCheckAppeal = existenceCheckAppeal;

async function updateAppeal({ headers, appeal, status }) {
    try {
        let obj = {
            data: {
                id: appeal.id,
                version: appeal.version ?? appeal.$version,
                status
            }
        }
        let response = await axios({
            headers: {
                "Content-Type": "application/json",
                Cookie: headers,
            },
            method: "POST",
            url: DOMAIN + "/ws/rest/com.axelor.apps.msg.db.Appeal/" + appeal.id,
            data: JSON.stringify(obj),
        });
        if (response.status === 200) {
            if (response.data.status === 0 && response.data.data) {
                return response.data.data[0];
            } else {
                // throw new Error(response?.data?.error ?? response?.data?.data);
                return null;
            }
        } else {
            throw new Error(`${response.status} ${response.statusText}`);
        }
    } catch (error) {
        return error.message;
    }
}

exports.updateAppeal = updateAppeal;

async function updateChat({ headers, chat, members, completedUsers }) {
    try {
        let obj = {
            data: {
                id: chat.id,
                version: chat.version,
                members,
                completedUsers
            }
        }
        let response = await axios({
            headers: {
                "Content-Type": "application/json",
                Cookie: headers,
            },
            method: "POST",
            url: DOMAIN + "/ws/rest/com.axelor.apps.msg.db.Chat/" + chat.id,
            data: JSON.stringify(obj),
        });
        if (response.status === 200) {
            if (response.data.status === 0 && response.data.data) {
                return response.data.data[0];
            } else {
                // throw new Error(response?.data?.error ?? response?.data?.data);
                return null;
            }
        } else {
            throw new Error(`${response.status} ${response.statusText}`);
        }
    } catch (error) {
        return error.message;
    }
}

exports.updateChat = updateChat;

async function getAppeal({ headers, appeal }) {
    try {
        let obj = {
            offset: 0,
            limit: 1,
            fields: ["name", "phoneNumber", "client.mobilePhone", "client.fullName", "client.name", "client.id", "chat.id", "status", "lastMessage", "saleOrders"],
            sortBy: ["-createdOn"],
            data: {
                _domain: "self.id = :appealId",
                _domainContext: {
                    appealId: appeal.id
                }
            }
        }
        let response = await axios({
            headers: {
                "Content-Type": "application/json",
                Cookie: headers,
            },
            method: "POST",
            url: DOMAIN + "/ws/rest/com.axelor.apps.msg.db.Appeal/search",
            data: JSON.stringify(obj),
        });
        if (response.status === 200) {
            if (response.data.status === 0 && response.data.data) {
                return response.data.data[0];
            } else {
                // throw new Error(response?.data?.error ?? response?.data?.data);
                return null;
            }
        } else {
            throw new Error(`${response.status} ${response.statusText}`);
        }
    } catch (error) {
        return error.message;
    }
}

exports.getAppeal = getAppeal;

exports.uploadFileAxelor = async function ({ file, headers, messageAuthor, chat, appealType, status }) {
    // let headers = await getHeaderConcept();
    let typeHeaders = {
        Cookie: headers,
        "Content-Type": "application/octet-stream",
        "X-File-Type": file.mimetype,
        "X-File-Offset": 0,
        "X-File-Size": file.size,
        "X-File-Name": encodeURI(file.filename),
    };

    // console.log("headers: ", headers);
    // console.log("typeHeaders: ", typeHeaders);

    let uploadFile = await uploadChunk1({
        headers,
        typeHeaders,
        file: await fs.createReadStream(file.path),
    });
    // console.log("uploadFile: ", uploadFile);

    // let chat = await getChat({
    //     currentUserId,
    //     userId,
    //     typeChats: typeChat,
    //     headers,
    // });

    // console.log("chat: ", chat);

    let dmsFileData = {
        fileName: uploadFile.data.fileName,
        metaFile: { id: uploadFile.data.id },
        relatedId: chat.id,
        relatedModel: "com.axelor.apps.msg.db.Chat",
    };
    // console.log("dmsFileData: ", dmsFileData);
    let responseDmsFIle = await axios({
        url: DOMAIN + "/ws/rest/com.axelor.dms.db.DMSFile",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Cookie: headers,
        },
        data: {
            data: dmsFileData,
        },
    });

    // console.log("responseDmsFIle: ", responseDmsFIle);

    let newMessageObj = {
        fileSize: responseDmsFIle.data.data[0]["metaFile.sizeText"],
        fileName: responseDmsFIle.data.data[0].metaFile.fileName,
        fileId: responseDmsFIle.data.data[0].id,
        fileType: responseDmsFIle.data.data[0].fileType,
    };

    // console.log("newMessageObj: ", newMessageObj);


    let message = {
        type: whatsappFileTypes.getType(file.mimetype),
        timestamp: createTimeStamp(),
    };
    // { message, chatId, messageAuthor, from, headers, file }
    let response = await createMessage({
        message,
        chatId: chat.id,
        messageAuthor,
        headers,
        file: newMessageObj,
        appealType,
        status
    });

    // console.log(response);


    return response;
    // console.log(response);
};

async function uploadChunk1({ typeHeaders, file, headers }) {
    try {
        // let headers = await getHeaderSanaripTamga();
        let uploadFile = await axios({
            url: DOMAIN + "/ws/files/upload",
            method: "POST",
            headers: typeHeaders,
            data: file,
        });

        return uploadFile;
    } catch (error) {
        return error;
    }
}

exports.uploadFileChunks = async function ({
    messages,
    responseFile,
    phone_number_id,
    chat,
    type,
    headers
}) {
    let fileSize = responseFile.file_size;
    let fileSha256 = responseFile.sha256;
    let fileNameType = "";
    if (type === "image") {
        fileNameType = messages[type].mime_type.split("/");
        fileNameType = "." + fileNameType[1];
    }
    let typeHeaders = {
        Cookie: headers,
        "Content-Type": "application/octet-stream",
        "X-File-Type": messages[type].mime_type,
        "X-File-Offset": 0,
        "X-File-Size": fileSize,
        "X-File-Name":
            messages.type === "document"
                ? encodeURI(messages.document.filename)
                : encodeURI("Whatsapp " + type + messages.timestamp) + fileNameType,
    };

    let uploadFile = await uploadChunk1({
        typeHeaders,
        file: responseFile.file,
    });
    // console.log("uploadFile: ", uploadFile);

    // let chat = await getChat({
    //     phoneNumberId: phone_number_id,
    //     from: from,
    //     typeChats: "whatsapp",
    //     headers,
    // });

    let dmsFileData = {
        fileName: uploadFile.data.fileName,
        metaFile: { id: uploadFile.data.id },
        relatedId: chat.id,
        relatedModel: "com.axelor.apps.msg.db.Chat",
    };

    let responseDmsFIle = await axios({
        url: DOMAIN + "/ws/rest/com.axelor.dms.db.DMSFile",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Cookie: headers,
        },
        data: {
            data: dmsFileData,
        },
    });
    // console.log("responseDmsFIle: ", responseDmsFIle);
    let newMessage = {
        fileSize: responseDmsFIle.data.data[0]["metaFile.sizeText"],
        fileName: responseDmsFIle.data.data[0].metaFile.fileName,
        fileId: responseDmsFIle.data.data[0].id,
        fileType: responseDmsFIle.data.data[0].fileType,
    };
    // console.log(newMessage);
    return newMessage;
};

function createTimeStamp() {
    let date = new Date();
    return date.getTime() / 1000;
}

async function deleteFile(path) {
    try {
        await unlinkAsync(path);
        // console.log('Файл успешно удалён');
    } catch (err) {
        throw err; // не удалось удалить файл
    }
}

exports.deleteFile = deleteFile;