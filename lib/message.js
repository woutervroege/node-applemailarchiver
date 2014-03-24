/*
 * @package applemailarchiver
 * @copyright Copyright(c) 2013 Wouter Vroege. <wouter AT woutervroege DOT nl>
 * @author Wouter Vroege <wouter AT woutervroege DOT nl>
 * @license https://github.com/woutervroege/node-applemailarchiver/blob/master/LICENSE MIT License
*/

var _ = require("underscore");
var utils = require("./utils");

/**
 * Parses a emlx2json record to a database record object
 *
 */

var message = module.exports = function(data) {
    var uuid = utils.getMessageUUID(data);
    return {
        uuid: uuid,
        subject: data['Subject'],
        date: data['Date'],
        utcdate: utils.parseDateToUTCIsoDateTime(data['Date']),
        from: data['From'] || "",
        fromName: utils.getNameFromContactHeaderString(data['From']) || "",
        fromEmail: utils.getEmailFromContactHeaderString(data['From'] || ""),
        to: data['To'] || "",
        toName: utils.getNameFromContactHeaderString(data['To']) || "",
        toEmail: utils.getEmailFromContactHeaderString(data['To'] || ""),
        cc: data['CC'] || "",
        ccName: utils.getNameFromContactHeaderString(data['CC']) || "",
        ccEmail: utils.getEmailFromContactHeaderString(data['CC'] || ""),
        mimeType: utils.getMimeType(data['Content-Type'] || data['Content-type']),
        transferEncoding: parseTransferEncoding(data['Content-Transfer-Encoding'] || ""),
        plainpart: getPartByMimeType(data['parts'], "text/plain").body,
        plainpartTransferEncoding: parsePartTransferEncoding(data['parts'], "text/plain"),
        htmlpart: getPartByMimeType(data['parts'], "text/html").body,
        htmlpartTransferEncoding: parsePartTransferEncoding(data['parts'], "text/html"),
        attachments: getAttachments(data['parts'], uuid)
    };
}

    function getPartByMimeType(parts, mimeType) {
        var item = {
            headers: [],
            body: ""
        };
        if (parts.length == 0)
            return item;
        var parts = _.filter(parts, function(part) {
            return (part['headers']['Content-Type'] && part['headers']['Content-Type'].match(new RegExp(mimeType, "gi")))
        });
        if (!parts[0])
            return item;
        return parts[0];
    }


    function getAttachments(parts, uuid) {
        var attachmentParts = _.filter(parts, function(part) {
            return (part['headers']['Content-Transfer-Encoding'] && part['headers']['Content-Transfer-Encoding'].match(/base64/i))
        });
        var attachments = _.map(attachmentParts, function(attachmentPart) {
            return parsePartToAttachment(attachmentPart, uuid);
        })
        return attachments;
    }

    function parsePartToAttachment(part, uuid) {
        return {
            messages_uuid: uuid,
            contents: part['body'].replace(/(^\s+|\s+$)/g, ""),
            transferEncoding: parseTransferEncoding(part['headers']['Content-Transfer-Encoding'] || ""),
            disposition: parseDisposition(part['headers']['Content-Disposition'] || ""),
            name: parseFilename(part['headers']['Content-Disposition'] || ""),
            cid: parseCid(part['headers']['Content-Id'] || ""),
            mimeType: parseMimeType(part['headers']['Content-Type'] || "")
        }
    }

    function parsePartTransferEncoding(parts, mimeType) {
        var part = getPartByMimeType(parts, mimeType);
        return parseTransferEncoding(part['headers']['Content-Transfer-Encoding'] || "");
    }
    function parseTransferEncoding(str) {
        return utils.removewhiteSpaces(str
            .split(/\;/g)[0]
        ).toLowerCase()
    }

    function parseDisposition(str) {
        return utils.removewhiteSpaces(str
            .split(/\;/g)[0]
        ).toLowerCase()
    }

    function parseFilename(str) {
        return utils.removewhiteSpaces(str
            .replace(/\n/g, "")
            .replace(/^.*?name=(.*?)/, "$1")
            .replace(/(\"|\')/g, "")
        )
    }

    function parseCid(str) {
        return utils.removewhiteSpaces(str
            .replace(/(\<|\>)/g, "")
        )
    }

    function parseMimeType(str) {
        return utils.removewhiteSpaces(str
            .split(/\;/g)[0]
        ).toLowerCase()
    }