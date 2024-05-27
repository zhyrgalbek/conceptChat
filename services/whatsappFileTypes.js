
let fileTypes = {
    audio: {
        type: "AUDIO",
        filestypes: [
            "audio/aac",
            "audio/mp4",
            "audio/mpeg",
            "audio/amr",
            "audio/ogg",
            "audio/webm",
            "audio/wav"
        ],
    },
    document: {
        type: "DOCUMENT",
        filestypes: [
            "text/plain",
            "application/pdf",
            "application/vnd.ms-powerpoint",
            "application/msword",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-publisher",
            "text/csv"
        ],
    },
    image: {
        type: "IMAGE",
        filestypes: ["image/jpeg", "image/png"]
    },
    sticker: {
        type: "STICKER",
        filestypes: ["image/webp"]
    },
};

let fileTypeArr = getFileType({ fileTypes });

exports.fileTypes = fileTypeArr;

exports.getType = function (fileType) {
    let type = null;
    for (let i = 0; i < fileTypeArr.length; i++) {
        let item = fileTypeArr[i];
        if (item.fileTypes === fileType) {
            type = item.type;
            break;
        } else {
            type = "document";
        }
    }
    return type;
}

function getFileType({ fileTypes }) {
    let { image, document, sticker, audio } = fileTypes;
    let arr = [];
    let imageTypes = gettypesArr(image);
    let documentTypes = gettypesArr(document);
    let stickerTypes = gettypesArr(sticker);
    let audioTypes = gettypesArr(audio);
    arr = [...imageTypes, ...documentTypes, ...stickerTypes, ...audioTypes];
    return arr;
}

function gettypesArr(obj) {
    let arr = [];
    for (let i = 0; i < obj.filestypes.length; i++) {
        arr.push({ fileTypes: obj.filestypes[i], type: obj.type });
    }
    return arr;
}
