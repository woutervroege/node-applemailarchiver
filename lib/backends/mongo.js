/*
 * @package applemailarchiver
 * @copyright Copyright(c) 2013 Wouter Vroege. <wouter AT woutervroege DOT nl>
 * @author Wouter Vroege <wouter AT woutervroege DOT nl>
 * @license https://github.com/woutervroege/node-applemailarchiver/blob/master/LICENSE MIT License
*/

 var mongo = require("mongodb");

var backend = module.exports = {

    mongoDB: false,
    collection: false,

    dbconnect: function(options, callback) {
        var connUrl =  backend.getDbConnectionURL(options);
        MongoClient = require("mongodb").MongoClient,
        MongoClient.connect(connUrl, {
            read: "secondary",
            auto_reconnect: true,
            safe: true
        }, function(err, conn) {
            if (err)
                return callback(err);
            conn.databaseName = options.db;
            backend.mongoDB = conn;
            backend.collection = conn.collection("messages");
            callback();
        });
    },
    getDbConnectionURL: function(options) {
        var url = "mongodb://";
        if (options.user && options.password)
            url += options.user + ":" + options.password;
        url += "@" + options.host + ":" + options.port + "/" + (options.authDb || options.db)
        return url;
    },

    save: function(data, callback) {
        backend.collection.save(data, function(err, data) {
            if (err)
                console.log("database error: " + err.code)
            callback();
        })
    },

}