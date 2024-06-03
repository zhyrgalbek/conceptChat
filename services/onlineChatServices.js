"use strict";
let onlineChats = [];
exports.onlineChats = onlineChats;

let sendEventsOnlineChats = function (event, data, onlineChats){
  console.log(data)
  let userPhone = data.messageChat.userPhone;
  onlineChats.forEach(res=>{
    if(res.userPhone == userPhone){
      res.res.write(`event: ${event}\n`);
      res.res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  })
}

exports.sendServerClient = function (onlineChats, messageChat){
  const event = "newMessage";
  const data = {message: "This is an SSE message", messageChat};
  sendEventsOnlineChats(event, data, onlineChats);
}

// exports.sendEventNewChat = function (sseRes, messageWhatsapp){
//   const event = "newChat";
//   const data = {message: "This is an SSE message", messageWhatsapp};
//   sendSSEEvent(event, data, sseRes);
// }

// exports.sendEventNewMessage = function (sseRes, messageWhatsapp){
//   const event = "newMessage";
//   const data = {message: "This is an SSE message", messageWhatsapp};
//   sendSSEEvent(event, data, sseRes);
// }

exports.onlineChatClose = function (userPhone, res){
  const index = onlineChats.findIndex(r=>+r.userPhone == +userPhone)
  console.log(index);
    if(index !== -1){
      res.end();
      onlineChats.splice(index, 1);
    }
}