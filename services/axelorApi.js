const axios = require("axios").default;
const { promisify } = require("util");
const fs = require("fs");
const unlinkAsync = promisify(fs.unlink);
const Blob = require("node-blob");
const crypto = require("crypto");
// const whatsappFileTypes = require("./whatsapp-file-types.js");

// const FormData = require("FormData");
// const domain = "https://pi.sanarip.org/sanarip-tamga";
const domain = "https://call.customs.gov.kg/sanarip-tamga";
// const domain = "https://call.brisklyminds.com/sanarip-tamga"
// const domain = "https://call.sanarip.org/axelor-erp";

let headers = null;

// exports.headers = headers;
console.log("headers: ", headers);

let getHeaderSanaripTamga = async function () {
  if (headers == null) {
    let responseAxelor = await axios({
      method: "POST",
      url: domain + "/login.jsp",
      data: JSON.stringify({
        username: "chat",
        password: "chatCallCenter123",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
    headers = await responseAxelor.headers["set-cookie"].toString();
    console.log("headers: ", headers);

    // setTimeout(() => {
    //   headers = null;
    // }, 12000 * 60);
  } else {
    return headers;
  }
  return headers;
};
exports.getHeaderSanaripTamga = getHeaderSanaripTamga;

let createTicket = async function ({
  userPhoneNumber,
  chatRoom,
  headers,
  userContact,
  applicationForm,
}) {
  let responseTicket = await axios({
    method: "PUT",
    url: domain + "/ws/rest/com.axelor.apps.helpdesk.db.Ticket",
    headers: {
      "Content-Type": "application/json",
      Cookie: headers,
    },
    data: JSON.stringify({
      data: {
        subject: userPhoneNumber,
        formAppeal: applicationForm,
        statusSelect: 5,
        chatRoom: chatRoom,
        userContact: userContact,
      },
    }),
  });
  return responseTicket;
};

let examinationContact = async function ({
  userPhoneNumber,
  userName,
  headers,
}) {
  let responseContact = await axios({
    headers: {
      "Content-Type": "application/json",
      Cookie: headers,
    },
    method: "POST",
    url: domain + "/ws/rest/com.axelor.apps.helpdesk.db.UserContact/search",
    data: JSON.stringify({
      offset: 0,
      limit: 10,
      data: {
        criteria: [
          {
            operator: "or",
            criteria: [
              {
                fieldName: "phoneNumber",
                operator: "=",
                value: userPhoneNumber,
              },
            ],
          },
        ],
      },
    }),
  });
  console.log("responseContact: ", responseContact);
  let total = responseContact.data.total;
  let userContact = {};
  if (total != 0) {
    userContact.id = responseContact.data.data[0].id;
  } else {
    let responseCreateContact = await axios({
      headers: {
        "Content-Type": "application/json",
        Cookie: headers,
      },
      method: "PUT",
      url: domain + "/ws/rest/com.axelor.apps.helpdesk.db.UserContact",
      data: JSON.stringify({
        data: {
          phoneNumber: userPhoneNumber,
          firstName: userName ? userName : "",
        },
      }),
    });
    console.log("responseCreateContact: ", responseCreateContact);
    userContact.id = await responseCreateContact.data.data[0].id;
  }
  return userContact;
};

exports.examinationContact = examinationContact;

async function getChat({ phoneNumberId, from, typeChats, headers }) {
  let obj = {
    offset: 0,
    fields: ["id", "chatSeans"],
    sortBy: ["-createdOn"],
    data: {
      criteria: [
        {
          operator: "and",
          criteria: [
            {
              fieldName: "fromNumber",
              operator: "=",
              value: from,
            },
            {
              fieldName: "typeChats",
              operator: "=",
              value: typeChats,
            },
            {
              fieldName: "chatSeans",
              operator: "=",
              value: true,
            },
          ],
        },
      ],
    },
  };

  let response = await axios({
    headers: {
      "Content-Type": "application/json",
      Cookie: headers,
    },
    method: "POST",
    url: domain + "/ws/rest/com.axelor.apps.helpdesk.db.Chats/search",
    data: JSON.stringify(obj),
  });
  
  console.log({ phoneNumberId, from, typeChats, headers })

  if (response.data.data) {
    return response.data.data[0];
  } else {
    return null;
  }
}

exports.getChat = getChat;

exports.createTicketandChat = async function ({
  phoneNumberId,
  from,
  userContact,
  formType,
  headers,
}) {
  let obj = {
    data: {
      subject: from,
      userContact: userContact,
      formAppeal: formType,
      statusSelect: 5,
      chat: {
        phoneNumberId: phoneNumberId ? phoneNumberId : "",
        userContact: userContact,
        chatSeans: true,
        fromNumber: from,
        typeChats:
          (formType == 4 && "whatsapp") || (formType == 3 && "onlineChat"),
      },
    },
  };

  let response = await axios({
    headers: {
      "Content-Type": "application/json",
      Cookie: headers,
    },
    method: "PUT",
    url: domain + "/ws/rest/com.axelor.apps.helpdesk.db.Ticket",
    data: JSON.stringify(obj),
  });
  
  console.log("Hello Test: ",response.data)

  return response.data.data[0];
};

async function newMessage({
  message,
  chatId,
  author,
  from,
  headers,
  file,
  operatorName,
  clientName,
  messageSecretKey,
}) {
  let obj = {
    data: {
      type: message.type,
      timestamp: message.timestamp ? message.timestamp : null,
      messageAuthor: author,
      fromNumber: from ? from : "",
      chat: {
        id: chatId,
      },
    },
  };
  if (operatorName) {
    obj.data.operatorName = operatorName;
  }
  if (clientName) {
    obj.data.clientName = clientName;
  }
  if (messageSecretKey) {
    obj.data.messageSecretKey = messageSecretKey;
  }
  if (message.text) {
    obj.data.body = message.text.body;
  }
  if (file) {
    obj.data.fileSize = file.fileSize;
    obj.data.fileName = file.fileName;
    obj.data.fileId = file.fileId;
    obj.data.fileType = file.fileType;
  }

  let response = await axios({
    headers: {
      "Content-Type": "application/json",
      Cookie: headers,
    },
    method: "PUT",
    url: domain + "/ws/rest/com.axelor.apps.helpdesk.db.Messages",
    data: JSON.stringify(obj),
  });

  return response.data;
}

exports.newMessage = newMessage;

exports.getOnlineChatMessages = async function ({ headers, userPhone }) {
  let obj = {
    offset: 0,
    fields: [
      "body",
      "type",
      "messageAuthor",
      "fromNumber",
      "timestamp",
      "operatorName",
      "clientName",
      "fileId",
      "fileType",
      "fileSize",
      "fileName",
      "messageSecretKey",
    ],
    sortBy: ["createdOn"],
    data: {
      criteria: [
        {
          operator: "and",
          criteria: [
            {
              fieldName: "fromNumber",
              operator: "=",
              value: userPhone,
            },
          ],
        },
      ],
    },
  };
  

  let response = await axios({
    headers: {
      "Content-Type": "application/json",
      Cookie: headers,
    },
    method: "POST",
    url: domain + "/ws/rest/com.axelor.apps.helpdesk.db.Messages/search",
    data: JSON.stringify(obj),
  });
  return response.data;
};

exports.createCard = async function ({
  userPhoneNumber,
  userName,
  chatRoom,
  applicationForm,
}) {
  let headers = await getHeaderSanaripTamga();
  let userContact = await examinationContact({
    userPhoneNumber,
    userName,
    headers,
  });
  let responseTicket = await createTicket({
    userPhoneNumber,
    chatRoom,
    userContact,
    headers,
    applicationForm,
  });
  return responseTicket;
};

exports.uploadFileAxelor = async function ({
  file,
  phoneNumberId,
  from,
  operatorName,
  messageAuthor,
  clientName,
  typeChats,
}) {
  let headers = await getHeaderSanaripTamga();
  let typeHeaders = {
    Cookie: headers,
    "Content-Type": "application/octet-stream",
    "X-File-Type": file.mimetype,
    "X-File-Offset": 0,
    "X-File-Size": file.size,
    "X-File-Name": encodeURI(file.filename),
  };

  console.log("headers: ", headers);
  console.log("typeHeaders: ", typeHeaders);

  let uploadFile = await uploadChunk1({
    typeHeaders,
    file: await fs.createReadStream(file.path),
  });
  console.log("uploadFile: ", uploadFile);

  let chat = await getChat({
    phoneNumberId: phoneNumberId,
    from: from,
    typeChats,
    headers,
  });

  console.log("chat: ", chat);

  let dmsFileData = {
    fileName: uploadFile.data.fileName,
    metaFile: { id: uploadFile.data.id },
    relatedId: chat.id,
    relatedModel: "com.axelor.apps.helpdesk.db.Chats",
  };
  console.log("dmsFileData: ", dmsFileData);
  let responseDmsFIle = await axios({
    url: domain + "/ws/rest/com.axelor.dms.db.DMSFile",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: headers,
    },
    data: {
      data: dmsFileData,
    },
  });

  console.log("responseDmsFIle: ", responseDmsFIle);

  let newMessageObj = {
    fileSize: responseDmsFIle.data.data[0]["metaFile.sizeText"],
    fileName: responseDmsFIle.data.data[0].metaFile.fileName,
    fileId: responseDmsFIle.data.data[0].id,
    fileType: responseDmsFIle.data.data[0].fileType,
  };

  let message = {
    type: whatsappFileTypes.getType(file.mimetype),
    timestamp: createTimeStamp(),
  };

  if (messageAuthor === "operator") {
    let response = await newMessage({
      message,
      chatId: chat.id,
      author: messageAuthor,
      from,
      headers,
      file: newMessageObj,
      operatorName: JSON.parse(operatorName),
      messageSecretKey: generateRandomString(200),
    });
  }

  if (messageAuthor === "client") {
    let response = await newMessage({
      message,
      chatId: chat.id,
      author: messageAuthor,
      from,
      headers,
      file: newMessageObj,
      clientName: clientName,
      messageSecretKey: generateRandomString(200),
    });
  }

  deleteFile(file.path);
  return newMessageObj;
};

exports.uploadFileChunks = async function ({
  messages,
  responseFile,
  phone_number_id,
  type,
  from,
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
  console.log("uploadFile: ", uploadFile);

  let chat = await getChat({
    phoneNumberId: phone_number_id,
    from: from,
    typeChats: "whatsapp",
    headers,
  });

  let dmsFileData = {
    fileName: uploadFile.data.fileName,
    metaFile: { id: uploadFile.data.id },
    relatedId: chat.id,
    relatedModel: "com.axelor.apps.helpdesk.db.Chats",
  };

  let responseDmsFIle = await axios({
    url: domain + "/ws/rest/com.axelor.dms.db.DMSFile",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: headers,
    },
    data: {
      data: dmsFileData,
    },
  });
  console.log("responseDmsFIle: ", responseDmsFIle);
  let newMessage = {
    fileSize: responseDmsFIle.data.data[0]["metaFile.sizeText"],
    fileName: responseDmsFIle.data.data[0].metaFile.fileName,
    fileId: responseDmsFIle.data.data[0].id,
    fileType: responseDmsFIle.data.data[0].fileType,
  };
  console.log(newMessage);
  return newMessage;
};

async function uploadChunk1({ typeHeaders, file }) {
  try {
    let headers = await getHeaderSanaripTamga();
    let uploadFile = await axios({
      url: domain + "/ws/files/upload",
      method: "POST",
      headers: typeHeaders,
      data: file,
    });

    return uploadFile;
  } catch (error) {
    return error;
  }
}

exports.getFile = async function (fileId) {
  try {
    let headers = await getHeaderSanaripTamga();
    let responseFile = await axios({
      method: "GET",
      responseType: "binary",
      url: domain + "/ws/dms/inline/" + fileId,
      headers: {
        Cookie: headers,
      },
    });
    return responseFile;
  } catch (error) {
    return error;
  }
};

function createTimeStamp() {
  let date = new Date();
  return date.getTime() / 1000;
}

async function deleteFile(path) {
  try {
    await unlinkAsync(path);
    console.log("Файл успешно удалён");
  } catch (err) {
    throw err; // не удалось удалить файл
  }
}

function generateRandomString(length) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let randomString = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    randomString += characters.charAt(randomIndex);
  }

  return randomString;
}

exports.offChatSeans = async function ({ chatVersion, chatId, headers }) {
  try {
    let obj = {
      data: {
        version: chatVersion,
        chatSeans: false,
      },
    };

    let response = await axios({
      method: "POST",
      url: domain + "/ws/rest/com.axelor.apps.helpdesk.db.Chats/" + chatId,
      headers: {
        "Content-Type": "application/json",
        Cookie: headers,
      },
      data: obj,
    });
  } catch (error) {
    console.log(error);
  }
};

exports.updateTicketColMessage = async function ({ chatVersion, chat, headers, ticket, increase }) {
  try {
    let obj = {
      data: {
        id: ticket.id,
        version: ticket.version,
        colMessage: increase === true ? +ticket.colMessage + 1 : 0,
      },
    };

    let response = await axios({
      method: "POST",
      url: domain + "/ws/rest/com.axelor.apps.helpdesk.db.Ticket/" + ticket.id,
      headers: {
        "Content-Type": "application/json",
        Cookie: headers,
      },
      data: obj,
    });
    return response.data.data[0];
  } catch (error) {
    console.log(error);
  }
};

exports.getTicket = async function ({chat, headers}){
  try {
    
    let obj = {
      offset: 0,
      limit: 10,
      data: {
        _domain: `self.chat = ${chat.id}`
      }
    }
    
    let response = await axios({
      method: "POST",
      url: domain + "/ws/rest/com.axelor.apps.helpdesk.db.Ticket/search",
      headers: {
        "Content-Type": "application/json",
        Cookie: headers,
      },
      data: obj
    });
    console.log("ticket: ", response.data.data[0])
    return await response.data.data[0];
  } catch (error) {
    console.log(error);
  }
}
