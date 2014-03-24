/*
 * @package applemailarchiver
 * @copyright Copyright(c) 2013 Wouter Vroege. <wouter AT woutervroege DOT nl>
 * @author Wouter Vroege <wouter AT woutervroege DOT nl>
 * @license https://github.com/woutervroege/node-applemailarchiver/blob/master/LICENSE MIT License
*/

var mysql = require("mysql");
var _ = require("underscore");

var backend = module.exports = {

    connection: false,
    dbName: false,
    options: {},

    dbconnect: function(options, callback) {
        backend.options = options;
        backend.connection = mysql.createConnection({
            host: options.host,
            user: options.user,
            password: options.password,
        });
        backend.dbName = options.db;
        callback();
    },

    save: function(data, callback) {
        var record = data;
        var attachments = data.attachments;
        delete data.attachments;
        delete record.attachments;
        backend.dbconnect(backend.options, function() {
            backend.connection.connect();
            backend.connection.query("INSERT INTO " + backend.dbName + ".messages SET ? ", record, function(err, result) {
                if (err)
                    console.log(err)
                backend.connection.end();
                if(attachments.length == 0)
                    return callback();
                backend.saveAttachments(attachments, function() {
                    callback();
                })
            });
        })
    },

    saveAttachments: function(attachments, callback) {
        backend.dbconnect(backend.options, function() {
            backend.connection.connect();
            backend.connection.query("INSERT INTO " + backend.dbName + ".attachments SET ? ", attachments, function(err, result) {
                if (err)
                    console.log(err)
                backend.connection.end();
                callback();
            });
        })
    }
}