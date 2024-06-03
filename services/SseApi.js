"use strict";

let sseClients = [];

exports.sseClients = sseClients;

let sendSSEEvent = function (event, data, sseClients){
  // console.log(res)
  sseClients.forEach(res=>{
    if(res){
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  })
}

exports.sendServerClient = function (sseRes, messageWhatsapp){
  const event = "exampleEvent";
  const data = {message: "This is an SSE message", messageWhatsapp};
  sendSSEEvent(event, data, sseRes);
}

exports.sendEventNewChat = function (sseRes, messageWhatsapp){
  const event = "newChat";
  const data = {message: "This is an SSE message", messageWhatsapp};
  sendSSEEvent(event, data, sseRes);
}

exports.sendEventNewMessage = function (sseRes, messageWhatsapp){
  const event = "newMessage";
  const data = {message: "This is an SSE message", messageWhatsapp};
  sendSSEEvent(event, data, sseRes);
}

exports.sseClose = function (res){
  const index = sseClients.indexOf(res)
    if(index !== -1){
      res.end();
      sseClients.splice(index, 1);
    }
}