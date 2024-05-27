const axelorApi = require("../services/axelorApi");
const SseMethods = require("../services/SseApi");
const whatsappApi = require("../services/whatsappApi");
const ffmpeg = require("fluent-ffmpeg");

exports.newMessageOperatorSendClient = async function (req, res) {
    try {
        let { phoneNumberId, message, from, chatId, timestamp } = req.body.data;
        console.log(req.body.data);

        let headers = await axelorApi.getHeaderSanaripTamga();

        console.log(headers);

        await whatsappApi.sendMessage({
            phone_number_id: phoneNumberId,
            token,
            from,
            message: message.body,
        });

        await axelorApi.newMessage({
            message: {
                type: message.type,
                text: { body: message.body },
                timestamp,
            },
            headers,
            chatId: chatId,
            author: "operator",
        });

        SseMethods.sendEventNewMessage(SseMethods.sseClients, {
            msg_body: message.body,
            phone_number_id: phoneNumberId,
            token,
            from,
        });

        res.status(200).send({ status: 0 });
    } catch (error) {
        console.log(error.response.message);
        res.status(404).send({ message: "not found" });
    }
}

exports.uploadOperatorSendClient = async function (req, res, next) {
    try {
        const phoneNumberId = req.body.phoneNumberId;
        const file = req.file;
        const from = req.body.from;
        if (req.file.mimetype === "audio/webm") {
            ffmpeg()
                .input(req.file.path)
                .audioCodec("libmp3lame")
                .on("end", async () => {
                    console.log("Conversion finished!");


                    await axelorApi.uploadFileAxelor({
                        file: req.file,
                        phoneNumberId,
                        from,
                    });

                    SseMethods.sendEventNewMessage(SseMethods.sseClients, {
                        phone_number_id: phoneNumberId,
                        token,
                        from,
                    });


                    file.path = file.path + ".mp3";
                    file.mimetype = "audio/mpeg";
                    await whatsappApi.uploadFile({
                        phoneNumberId,
                        file,
                        from: req.body.from,
                    });

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
            console.log(req.file);

            await whatsappApi.uploadFile({
                phoneNumberId,
                file,
                from: req.body.from,
            });

            await axelorApi.uploadFileAxelor({ file, phoneNumberId, from });

            SseMethods.sendEventNewMessage(SseMethods.sseClients, {
                phone_number_id: phoneNumberId,
                token,
                from,
            });
        }

        res.status(200).send({ status: 0 });
    } catch (error) {
        console.log(error);
        res.status(404).send({ message: "not found" });
    }
}

exports.newMessageClientSendOperator = async function (req, res) {
    // Parse the request body from the POST

    // Check the Incoming webhook message
    console.log(JSON.stringify(req.body, null, 2));
    // info on WhatsApp text message payload: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples#text-messages
    if (req.body.object) {
        if (
            req.body.entry &&
            req.body.entry[0].changes &&
            req.body.entry[0].changes[0] &&
            req.body.entry[0].changes[0].value.messages &&
            req.body.entry[0].changes[0].value.messages[0]
        ) {
            let phone_number_id =
                req.body.entry[0].changes[0].value.metadata.phone_number_id;
            let from = req.body.entry[0].changes[0].value.messages[0].from; // extract the phone number from the webhook payload
            // let msg_body = req.body.entry[0].changes[0].value.messages[0].text.body; // extract the message text from the webhook payload
            let msg_id = req.body.entry[0].changes[0].value.messages[0].id;

            let userName =
                req.body.entry[0].changes[0].value.contacts[0].profile.name;
            let userPhoneNumber =
                req.body.entry[0].changes[0].value.contacts[0].wa_id;
            let messages = req.body.entry[0].changes[0].value.messages[0];

            try {
                await whatsappApi.readMessage({ phone_number_id, token, msg_id });
                let chat = null;
                let headers = await axelorApi.getHeaderSanaripTamga();
                let responseChat = await axelorApi.getChat({
                    phoneNumberId: phone_number_id,
                    from: from,
                    typeChats: "whatsapp",
                    headers,
                });

                new Promise(async (resolve, reject) => {
                    console.log("promise");
                    console.log("responseChat:", responseChat);

                    if (responseChat) {
                        chat = responseChat;
                        console.log("1", chat);
                        resolve(chat);
                    } else {
                        let userContact = await axelorApi.examinationContact({
                            userPhoneNumber: from,
                            userName,
                            headers,
                        });
                        let ticket = await axelorApi.createTicketandChat({
                            phoneNumberId: phone_number_id,
                            headers,
                            from,
                            userContact,
                            formType: 4,
                        });
                        SseMethods.sendEventNewChat(SseMethods.sseClients, {
                            messages,
                            msg_id,
                            phone_number_id,
                            token,
                            from,
                        });
                        chat = await ticket.chat;
                        console.log("2", chat);
                        resolve(chat);
                    }
                }).then(async (chat) => {
                    switch (messages.type) {
                        case "text":
                            console.log("3", chat);
                            await axelorApi.newMessage({
                                message: messages,
                                chatId: chat.id,
                                author: "client",
                                headers,
                            });
                            SseMethods.sendEventNewMessage(SseMethods.sseClients, {
                                messages,
                                msg_id,
                                phone_number_id,
                                token,
                                from,
                            });
                            break;
                        case "image":
                            const responseFileImage = await whatsappApi.getFile(messages, "image");

                            let responseDmsFIleImage = await axelorApi.uploadFileChunks({
                                messages,
                                responseFile: responseFileImage,
                                phone_number_id,
                                type: "image",
                                from,
                            });

                            await axelorApi.newMessage({
                                message: messages,
                                chatId: chat.id,
                                author: "client",
                                headers,
                                file: responseDmsFIleImage,
                            });

                            SseMethods.sendEventNewMessage(SseMethods.sseClients, {
                                messages,
                                msg_id,
                                phone_number_id,
                                token,
                                from,
                            });

                            console.log(responseDmsFIle);
                            break;
                        case "document":
                            const responseFileDocument = await whatsappApi.getFile(
                                messages,
                                "document"
                            );

                            let responseDmsFIleDocument = await axelorApi.uploadFileChunks({
                                messages,
                                responseFile: responseFileDocument,
                                phone_number_id,
                                type: "document",
                                from,
                            });

                            await axelorApi.newMessage({
                                message: messages,
                                chatId: chat.id,
                                author: "client",
                                headers,
                                file: responseDmsFIleDocument,
                            });

                            SseMethods.sendEventNewMessage(SseMethods.sseClients, {
                                messages,
                                msg_id,
                                phone_number_id,
                                token,
                                from,
                            });

                            console.log(responseDmsFIle);
                            break;
                        case "audio":
                            const responseFileAudio = await whatsappApi.getFile(messages, "audio");

                            let responseDmsFIleAudio = await axelorApi.uploadFileChunks({
                                messages,
                                responseFile: responseFileAudio,
                                phone_number_id,
                                type: "audio",
                                from,
                            });

                            await axelorApi.newMessage({
                                message: messages,
                                chatId: chat.id,
                                author: "client",
                                headers,
                                file: responseDmsFIleAudio,
                            });

                            SseMethods.sendEventNewMessage(SseMethods.sseClients, {
                                messages,
                                msg_id,
                                phone_number_id,
                                token,
                                from,
                            });

                            console.log(responseDmsFIle);
                            break;
                        default:
                            let autoMessage = {
                                body: "Извините мы принимаем только картинки и документы и аудиофайлы!",
                            };
                            await whatsappApi.sendMessage({
                                phone_number_id,
                                token,
                                from,
                                message: autoMessage.body,
                            });
                    }
                });

            } catch (error) {
                console.log(error);
            }
        }
        res.sendStatus(200);
    } else {
        // Return a '404 Not Found' if event is not from a WhatsApp API
        res.sendStatus(404);
    }
}