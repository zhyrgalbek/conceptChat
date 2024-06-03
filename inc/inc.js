
require('dotenv').config();

exports.VERIFY_TOKEN = process.env.VERIFY_TOKEN;
// domain: "call.sanarip.org/axelor-erp", //https://pi.sanarip.org/sanarip-tamga

exports.AXELOR = {
    domain: process.env.DOMAIN,
    username: process.env.USER, 
    password: process.env.PASSWORD
}
