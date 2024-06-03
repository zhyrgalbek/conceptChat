const onlineChatMethods = require("../services/onlineChatServices");
const axelorApi = require("../services/axelorApi");
const SseMethods = require("../services/SseApi");
const { VERIFY_TOKEN } = require("../inc/inc");

exports.onlineChat = async function (req, res) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const { userPhone, userName } = req.query;

    console.log("userPhone: ", userPhone);
    console.log("userName: ", userName);

    onlineChatMethods.onlineChats.push({ userPhone: userPhone, res });

    let headers = await axelorApi.getHeaderSanaripTamga();
    let messages = await axelorApi.getOnlineChatMessages(headers, userPhone);
    // console.log(messages);
    // onlineChatMethods.sendServerClient(onlineChatMethods.onlineChats, {messages, userPhone: userPhone});

    let messagesText = JSON.stringify(messages);

    let message = {
        message: "Welcome to the online chat sse endpoint",
        messagesText,
    };

    res.write(`data: ${JSON.stringify(message)}\n\n`);

    console.log(onlineChatMethods.onlineChats);

    req.on("close", () => {
        onlineChatMethods.onlineChatClose(userPhone, res);
        console.log("userPhone: ", userPhone);
        console.log(
            "onlineChatMethods.onlineChats: ",
            onlineChatMethods.onlineChats
        );
    });
}

exports.newMessageOperatorSendClient = async function (req, res) {
    try {
        let { message, from, chatId, timestamp } = req.body.data;
        console.log(req.body.data);

        let newMessage = {
            type: message.type,
            text: {
                body: message.body,
            },
            timestamp,
        };
        console.log(req.body.data);
        let headers = await axelorApi.getHeaderSanaripTamga();

        await axelorApi.newMessage({
            message: newMessage,
            headers,
            chatId: chatId,
            author: "operator",
            from: from,
        });

        let messages = await axelorApi.getOnlineChatMessages(headers, from);

        let messagesText = JSON.stringify(messages);

        onlineChatMethods.sendServerClient(onlineChatMethods.onlineChats, { //Сообщения отправляются к клиенту
            newMessage,
            userPhone: from,
            messagesText,
        });

        SseMethods.sendEventNewMessage(SseMethods.sseClients, { // Событие к оператору новое сообщение
            msg_body: newMessage,
            from: from,
        });

        res.status(200).send({ status: 0 });
    } catch (error) {
        console.log(error);
        res.status(404).send({ message: "not found" });
    }
}

exports.newMessageClientSendOperator = async function (req, res) {
    let body = req.body.data;
    if (
        body.userPhone &&
        body.message &&
        VERIFY_TOKEN == req.headers.authorization &&
        body.userName
    ) {
        let { userPhone, message, userName, timestamp } = body;
        let newMessage = {
            type: "text",
            text: {
                body: message,
            },
            timestamp,
        };
        let headers = await axelorApi.getHeaderSanaripTamga();
        let chat = await axelorApi.getChat({
            headers: headers,
            from: userPhone,
            typeChats: "onlineChat",
        });
        console.log(chat);
        if (chat) {
            await axelorApi.newMessage({
                message: newMessage,
                headers,
                chatId: chat.id,
                author: "client",
                from: userPhone,
            });

            let messages = await axelorApi.getOnlineChatMessages(headers, userPhone);

            let messagesText = JSON.stringify(messages);

            onlineChatMethods.sendServerClient(onlineChatMethods.onlineChats, {
                messages,
                userPhone: userPhone,
                messagesText,
            });

            SseMethods.sendEventNewMessage(SseMethods.sseClients, {
                msg_body: newMessage,
                from: userPhone,
            });
        } else {
            let userContact = await axelorApi.examinationContact({
                userPhoneNumber: userPhone,
                headers,
                userName,
            });
            let ticket = await axelorApi.createTicketandChat({
                headers,
                from: userPhone,
                userContact,
                formType: 3,
            });
            await axelorApi.newMessage({
                message: newMessage,
                headers,
                chatId: ticket.chat.id,
                author: "client",
                from: userPhone,
            });

            let messages = await axelorApi.getOnlineChatMessages(headers, userPhone);
            let messagesText = JSON.stringify(messages);
            onlineChatMethods.sendServerClient(onlineChatMethods.onlineChats, {
                messages,
                userPhone: userPhone,
                messagesText,
            });

            SseMethods.sendEventNewChat(SseMethods.sseClients, {
                msg_body: newMessage,
                from: userPhone,
            });
            // console.log("ticket: ", ticket)
        }

        res.status(200).send({ status: 0 });
    } else {
        res.status(200).send({ status: -1 });
    }
}

exports.signUporSignIn = async function (req, res) {
    console.log(req);
    if (req.body.name && req.body.number) {
        try {
            let { name: userName, textareaMessage: textareaMessage, number: userPhone, timestamp } = req.body;

            //        const cookie = Cookie.serialize('userPhone', userPhone, {
            //           maxAge: 3600, // Срок действия в секундах
            //         });

            // res.setHeader('Set-Cookie', cookie);
            const user = {
                userPhone: userPhone,
                userName: userName,
            };

            // const jwtToken = jwt.sign(user, VERIFY_TOKEN, {expiresIn: '1h'});

            let headers = await axelorApi.getHeaderSanaripTamga();

            let newMessage = {
                type: "text",
                text: {
                    body: textareaMessage,
                },
                timestamp,
            };

            let chat = await axelorApi.getChat({
                headers: headers,
                from: userPhone,
                typeChats: "onlineChat",
            });

            if (!chat) {
                let userContact = await axelorApi.examinationContact({
                    userPhoneNumber: userPhone,
                    userName,
                    headers,
                });
                let ticket = await axelorApi.createTicketandChat({
                    headers,
                    from: userPhone,
                    userContact,
                    formType: 3,
                });

                if (textareaMessage) {
                    await axelorApi.newMessage({
                        message: newMessage,
                        headers,
                        chatId: ticket.chat.id,
                        author: "client",
                        from: userPhone,
                    });
                }

                SseMethods.sendEventNewChat(SseMethods.sseClients, {
                    from: userPhone,
                    userName: userName,
                });
            } else if (textareaMessage) {

                await axelorApi.newMessage({
                    message: newMessage,
                    headers,
                    chatId: chat.id,
                    author: "client",
                    from: userPhone,
                });

                SseMethods.sendEventNewMessage(SseMethods.sseClients, {
                    msg_body: newMessage,
                    from: userPhone,
                });

            }

            res.status(200).send({ status: 0, user });

        } catch (error) {
            console.log(error);
        }
    } else {
        res.status(404).send({
            status: -1,
        });
    }
}

exports.fileUploade = async function (req, res) {
    try {
        let { timestamp, messageAuthor, userPhone } = req.body;
        let file = req.file;
        let headers = await axelorApi.getHeaderSanaripTamga();
    
        if (messageAuthor === "client") {
          let userPhone = req.body.userPhone;
          let id = req.body.id;
          let newMessage = await axelorApi.uploadFileAxelor({
            file,
            from: userPhone,
            clientName: { id: id },
            messageAuthor,
            typeChats: "onlineChat",
          });
    
          let messages = await axelorApi.getOnlineChatMessages({
            headers,
            userPhone,
          });
          let messagesText = JSON.stringify(messages);
    
          onlineChatMethods.sendServerClient(onlineChatMethods.onlineChats, {
            messages,
            userPhone: userPhone,
            messagesText,
          });
    
          SseMethods.sendEventNewMessage(SseMethods.sseClients, {
            msg_body: newMessage,
            from: userPhone,
          });
    
          SseMethods.musics(SseMethods.sseClients, {
            msg_body: newMessage,
            from: userPhone,
          });
        }
    
        if (messageAuthor === "operator") {
          let operatorName = req.body.operatorName;
          let from = req.body.from;
          let newMessage = await axelorApi.uploadFileAxelor({
            file,
            from,
            operatorName,
            messageAuthor,
            typeChats: "onlineChat",
          });
    
          let messages = await axelorApi.getOnlineChatMessages({ headers, from });
          let messagesText = JSON.stringify(messages);
    
          onlineChatMethods.sendServerClient(onlineChatMethods.onlineChats, {
            newMessage,
            userPhone: from,
            messagesText,
          });
    
          onlineChatMethods.musics(onlineChatMethods.onlineChats, {
            newMessage,
            userPhone: from,
            messagesText,
          });
    
          SseMethods.sendEventNewMessage(SseMethods.sseClients, {
            msg_body: newMessage,
            from: from,
          });
        }
    
        res.status(200).send({ status: 0 });
      } catch (error) {
        console.log(error);
        res.status(404).send({ message: "not found" });
      }
}