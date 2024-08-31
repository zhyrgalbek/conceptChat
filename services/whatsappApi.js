"use strict";
const { default: axios } = require("axios");
const FormData = require("form-data");
const fs = require("fs");
require('dotenv').config();
// const ffmpeg = require("fluent-ffmpeg");
// const { WHATSAPP_TOKEN: token } = require("../inc/inc");
const whatsappFileTypes = require("./whatsappFileTypes");
const { response } = require("express");
const token = process.env.WHATSAPP_TOKEN;
const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

exports.readMessage = async function ({ phone_number_id, token, msg_id }) {
    try {
        let responseRead = await axios({
            method: "POST",
            url: "https://graph.facebook.com/v17.0/" + PHONE_NUMBER_ID + "/messages",
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
                PHONE_NUMBER_ID +
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

exports.answeringMessage = async function ({
    prevMessageSecretKey,
    message,
    from
}) {
    try {
        let response = await axios({
            method: "POST", // Required, HTTP method, a string, e.g. POST, GET
            url:
                "https://graph.facebook.com/v19.0/" +
                PHONE_NUMBER_ID +
                "/messages",
            data: {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: from,
                context: {
                    message_id: prevMessageSecretKey
                },
                type: "text",
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
}

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
    from,
    mimtype,
    id,
    filename,
    caption
}) {
    try {
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

            let obj = {
                messaging_product: "whatsapp",
                to: from,
                // recipient_type: "individual",
                type: type.toLowerCase(),
                [type.toLowerCase()]: {
                    id: id,
                },
            }

            if (caption) {
                obj[type.toLowerCase()].caption = caption;
            }

            let response = await axios({
                method: "POST", // Required, HTTP method, a string, e.g. POST, GET
                url:
                    "https://graph.facebook.com/v12.0/" +
                    PHONE_NUMBER_ID +
                    "/messages?access_token=" +
                    token,
                data: obj,
                headers: {
                    Authorization: "Bearer " + token,
                    "Content-Type": "application/json",
                },
            });
            return response.data;
        } else {
            let obj = {
                messaging_product: "whatsapp",
                to: from,
                // recipient_type: "individual",
                type: type.toLowerCase(),
                [type.toLowerCase()]: {
                    id: id,
                    filename: filename,
                },
            }
            if (caption) {
                obj[type.toLowerCase()].caption = caption;
            }
            let response = await axios({
                method: "POST", // Required, HTTP method, a string, e.g. POST, GET
                url:
                    "https://graph.facebook.com/v12.0/" +
                    phone_number_id +
                    "/messages?access_token=" +
                    token,
                data: obj,
                headers: {
                    Authorization: "Bearer " + token,
                    "Content-Type": "application/json",
                },
            });
            return response.data;
        }
    } catch (error) {
        console.log(error);
    }
    // console.log(response.data)
}

exports.uploadFile = async function ({ file, from, caption }) {
    try {
        const formData = new FormData();
        formData.append("file", fs.createReadStream(file.path), {
            contentType: file.mimetype,
        });
        formData.append("messaging_product", "whatsapp");
        let response = await axios.post(
            `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/media`,
            formData,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...formData.getHeaders(),
                },
            }
        );
        // console.log("Media upload successful:", response.data);
        let messageFileId = await sendMessageFileId({
            phone_number_id: PHONE_NUMBER_ID,
            from,
            mimtype: file.mimetype,
            id: response.data.id,
            filename: file.filename,
            caption
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

exports.sendTemplate = async function ({ phoneNumber, templateName, code }) {
    try {
        let obj = {
            messaging_product: "whatsapp",
            to: phoneNumber,
            type: "template",
            template: {
                name: templateName,
                language: {
                    code: code
                }
            }
        }
        let response = await axios({
            method: "POST", // Required, HTTP method, a string, e.g. POST, GET
            url: `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
            data: obj,
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
    }
}

exports.createTemplate = async function ({ name, category = "UTILITY", allow_category_change = true, language = "ru", components }) {
    // let headerFormat = ["TEXT", "IMAGE", "VIDEO", "DOCUMENT", "LOCATION"];
    // let category = ["AUTHENTICATION", "MARKETING", "UTILITY"];
    // let componenst = [
    //     components: [
    //         {
    //             type: "HEADER",
    //             format: "TEXT",
    //             text: "Our {{1}} is on!",
    //             example: {
    //                 header_text: [
    //                     "Summer Sale"
    //                 ]
    //             }
    //         },
    //         {
    //             type: "BODY",
    //             text: "Shop now throught {{1}} and use code {{2}} to get {{3}} off of all merchandise.",
    //             example: {
    //                 body_text: [
    //                     "the end of August", "240FF", "25%"
    //                 ]
    //             }
    //         },
    //         {
    //             type: "FOOTER",
    //             text: "Use the buttons below to manage your marketing subscriptions"
    //         },
    //         {
    //             type: "BUTTONS",
    //             buttons: [
    //                 {
    //                     type: "PHONE_NUMBER",
    //                     text: "Call",
    //                     phone_number: "15550051310"
    //                 },
    //                 {
    //                     type: "URL",
    //                     text: "Shop Now",
    //                     url: "https://www.luckyshrub.com/shop?promo={{1}}",
    //                     example: [
    //                         "summer2023"
    //                     ]
    //                 },
    //                 {
    //                     type: "QUICK_REPLY",
    //                     text: "text btns"
    //                 }
    //             ]
    //         }
    //     ]
    // ]

    try {
        let body = {
            name,
            category,
            allow_category_change,
            language,
            components
        }
        let response = await axios({
            method: "POST", // Required, HTTP method, a string, e.g. POST, GET
            url: `https://graph.facebook.com/v19.0/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`,
            data: body,
            headers: {
                Authorization: "Bearer " + token,
                "Content-Type": "application/json",
            },
        });

        if (response.status === 200) {
            // let responseMessageWhatsapp = response.data;
            // console.log("responseMessageWhatsapp: ", JSON.stringify(responseMessageWhatsapp.data));
            return response.data;
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
            return error.response.data;
        } else if (error.request) {
            // The request was made but no response was received
            console.error(
                "Error uploading media. No response received from the server."
            );
            return { error: { message: "Error uploading media. No response received from the server." } };
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error(
                "Error uploading media. Request setup error:",
                error.message
            );
            return { error: { message: error.message } };
        }
    }

}

exports.updateTemplate = async function ({ components, message_template_id }) {
    try {
        let body = {
            components
        }
        let response = await axios({
            method: "POST", // Required, HTTP method, a string, e.g. POST, GET
            url: `https://graph.facebook.com/v19.0/${message_template_id}`,
            data: body,
            headers: {
                Authorization: "Bearer " + token,
                "Content-Type": "application/json",
            },
        });

        if (response.status === 200) {
            // let responseMessageWhatsapp = response.data;
            // console.log("responseMessageWhatsapp: ", JSON.stringify(responseMessageWhatsapp.data));
            return response.data;
        }
        else {
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
            return error.response.data;
        } else if (error.request) {
            // The request was made but no response was received
            console.error(
                "Error uploading media. No response received from the server."
            );
            return { error: { message: "Error uploading media. No response received from the server." } };
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error(
                "Error uploading media. Request setup error:",
                error.message
            );
            return { error: { message: error.message } };
        }
    }

}

exports.getTemplate = async function (name) {
    try {
        let response = await axios({
            method: "GET", // Required, HTTP method, a string, e.g. POST, GET
            url: `https://graph.facebook.com/v19.0/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?name=${name}`,
            headers: {
                Authorization: "Bearer " + token,
                "Content-Type": "application/json",
            },
        });
        if (response.status === 200) {
            // let responseMessageWhatsapp = response.data;
            // console.log("responseMessageWhatsapp: ", JSON.stringify(responseMessageWhatsapp.data));
            return response.data;
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
    }
}

exports.getTemplates = async function () {
    try {
        let response = await axios({
            method: "GET", // Required, HTTP method, a string, e.g. POST, GET
            url: `https://graph.facebook.com/v19.0/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`,
            headers: {
                Authorization: "Bearer " + token,
                "Content-Type": "application/json",
            },
        });
        if (response.status === 200) {
            // let responseMessageWhatsapp = response.data;
            // console.log("responseMessageWhatsapp: ", JSON.stringify(responseMessageWhatsapp.data));
            return response.data;
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
    }
}

exports.deleteTemplate = async function ({ message_template_id, templateName }) {
    try {
        let response = await axios({
            method: "DELETE", // Required, HTTP method, a string, e.g. POST, GET
            url: `https://graph.facebook.com/v19.0/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?hsm_id=${message_template_id}&name=${templateName}`,
            headers: {
                Authorization: "Bearer " + token,
                "Content-Type": "application/json",
            },
        });
        if (response.status === 200) {
            // let responseMessageWhatsapp = response.data;
            // console.log("responseMessageWhatsapp: ", JSON.stringify(responseMessageWhatsapp.data));
            return response.data;
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
            return error.response.data;
        } else if (error.request) {
            // The request was made but no response was received
            console.error(
                "Error uploading media. No response received from the server."
            );
            return { error: { message: "Error uploading media. No response received from the server." } }
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error(
                "Error uploading media. Request setup error:",
                error.message
            );
            return { error: { message: error.message } }
        }
    }
}