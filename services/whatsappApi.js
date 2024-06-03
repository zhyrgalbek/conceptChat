"use strict";
const { default: axios } = require("axios");
const FormData = require("form-data");
const fs = require("fs");
require('dotenv').config();
// const ffmpeg = require("fluent-ffmpeg");
// const { WHATSAPP_TOKEN: token } = require("../inc/inc");
const whatsappFileTypes = require("./whatsappFileTypes");
const token = process.env.WHATSAPP_TOKEN;

console.log(whatsappFileTypes.getType("application/vnd.ms-publisher"));

exports.readMessage = async function ({ phone_number_id, token, msg_id }) {
    let responseRead = await axios({
        method: "POST",
        url: "https://graph.facebook.com/v17.0/" + phone_number_id + "/messages",
        headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
        },
        data: {
            messaging_product: "whatsapp",
            status: "read",
            message_id: msg_id,
        },
    });
    return responseRead;
};

exports.sendMessage = async function ({
    phone_number_id,
    from,
    message,
}) {
    // console.log("phone_number_id: ", phone_number_id);
    // console.log("from: ", from);
    // console.log("message: ", message);
    try {
        let response = await axios({
            method: "POST", // Required, HTTP method, a string, e.g. POST, GET
            url:
                "https://graph.facebook.com/v12.0/" +
                phone_number_id +
                "/messages?access_token=" +
                token,
            data: {
                messaging_product: "whatsapp",
                to: from,
                text: { body: message },
            },
            headers: {
                Authorization: "Bearer " + token,
                "Content-Type": "application/json",
            },
        });
        if (response.status === 200) {
            let responseMessageWhatsapp = response.data;
            // console.log("responseMessageWhatsapp: ", JSON.stringify(responseMessageWhatsapp.data));
            return responseMessageWhatsapp;
        } else {
            throw new Error(`${response.status} ${response.statusText}`);
        }
    } catch (error) {
        if (error.response) {
            // The request was made and the server responded with a status code
            console.error(
                "Error uploading media. Server responded with:",
                error.response.status,
                error.response.data
            );
        } else if (error.request) {
            // The request was made but no response was received
            console.error(
                "Error uploading media. No response received from the server."
            );
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error(
                "Error uploading media. Request setup error:",
                error.message
            );
        }
        return null;
    }
};

exports.getFile = async function (messages, type) {
    try {
        let fileType = messages[type];
        let fileId = fileType.id;
        let response = await axios({
            method: "GET",
            url: "https://graph.facebook.com/v12.0/" + fileId,
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + token,
            },
        });
        let mediaUrl = await response.data.url;
        let responseFile = await axios({
            url: mediaUrl,
            method: "GET",
            responseType: "arraybuffer",
            headers: {
                Authorization: "Bearer " + token,
            },
        });

        return {
            file: responseFile.data,
            file_size: response.data.file_size,
            sha256: response.data.sha256,
        };
    } catch (error) {
        console.log("Error fetching file: ", error);
        throw error;
    }
};

async function sendMessageFileId({
    phone_number_id,
    token,
    from,
    mimtype,
    id,
    filename,
}) {
    // console.log(phone_number_id, token, from, mimtype, id);
    let type = whatsappFileTypes.getType(mimtype);
    // console.log("phone_number_id: ", phone_number_id);
    // console.log("token: ", token);
    // console.log("from: ", from);
    // console.log("mimtype: ", mimtype);
    // console.log("id: ", id);
    // console.log("filename: ", filename);
    // console.log("type: ", type.toLowerCase());
    if (type.toLowerCase() !== "document") {
        let response = await axios({
            method: "POST", // Required, HTTP method, a string, e.g. POST, GET
            url:
                "https://graph.facebook.com/v12.0/" +
                phone_number_id +
                "/messages?access_token=" +
                token,
            data: {
                messaging_product: "whatsapp",
                to: from,
                // recipient_type: "individual",
                type: type.toLowerCase(),
                [type.toLowerCase()]: {
                    id: id,
                },
            },
            headers: {
                Authorization: "Bearer " + token,
                "Content-Type": "application/json",
            },
        });
        return response.data;
    } else {
        let response = await axios({
            method: "POST", // Required, HTTP method, a string, e.g. POST, GET
            url:
                "https://graph.facebook.com/v12.0/" +
                phone_number_id +
                "/messages?access_token=" +
                token,
            data: {
                messaging_product: "whatsapp",
                to: from,
                // recipient_type: "individual",
                type: type.toLowerCase(),
                [type.toLowerCase()]: {
                    id: id,
                    filename: filename,
                },
            },
            headers: {
                Authorization: "Bearer " + token,
                "Content-Type": "application/json",
            },
        });
        return response.data;
    }
    // console.log(response.data)
}

exports.uploadFile = async function ({ phoneNumberId, file, from }) {
    try {
        const formData = new FormData();
        formData.append("file", fs.createReadStream(file.path), {
            contentType: file.mimetype,
        });
        console.log("file: ", file);
        formData.append("messaging_product", "whatsapp");
        let response = await axios.post(
            `https://graph.facebook.com/v18.0/${phoneNumberId}/media`,
            formData,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...formData.getHeaders(),
                },
            }
        );
        console.log("Media upload successful:", response.data);
        let messageFileId = await sendMessageFileId({
            phone_number_id: phoneNumberId,
            token,
            from,
            mimtype: file.mimetype,
            id: response.data.id,
            filename: file.filename,
        });

        return messageFileId;

    } catch (error) {
        if (error.response) {
            // The request was made and the server responded with a status code
            console.error(
                "Error uploading media. Server responded with:",
                error.response.status,
                error.response.data
            );
        } else if (error.request) {
            // The request was made but no response was received
            console.error(
                "Error uploading media. No response received from the server."
            );
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error(
                "Error uploading media. Request setup error:",
                error.message
            );
        }
    }
};