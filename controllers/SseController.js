const SseMethods = require("../services/SseApi");

exports.SseCtrl = function (req, res) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    let message = {
        message: "Welcome to the SSE endpoint",
    };

    res.write(`data: ${JSON.stringify(message)}\n\n`);

    SseMethods.sseClients.push(res);

    req.on("close", () => {
        // clearInterval(interval);
        SseMethods.sseClose(res);
    });
}