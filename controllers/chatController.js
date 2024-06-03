const path = require("path")
const desiredPath = "/html/build/index.html";
const relativePath = "/controllers/chatController.js";
const absolutePath = path.join(desiredPath, relativePath);
exports.chatCtrl = function (req, res){
    res.sendFile("/var/www/chat/index.html");
}