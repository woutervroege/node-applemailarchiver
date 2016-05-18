#! /usr/bin/env node

/*
 * @package applemailarchiver
 * @copyright Copyright(c) 2016 Wouter Vroege. <wouter AT woutervroege DOT nl>
 * @author Wouter Vroege <wouter AT woutervroege DOT nl>
 * @license https://github.com/woutervroege/node-applemailarchiver/blob/master/LICENSE MIT License
 */

var emlx2json = require("emlx2json");
var searchfs = require('./node_modules/recursive-search/lib/recursive-search.js');
var _ = require("underscore");
var argv = require('optimist').argv;
var fs = require("fs");
var moment = require("moment");
var message = require("./lib/message");

/*
Constructor
*/

var archiver = {
    MAIL_HOME_DIR: false,
    accountsList: false,
    rootPath: false,
    mailboxes: [],
    currentMailboxName: false,
    records: [],
    backend: false,
    startDate: new moment("1970").utc().format(),
    endDate: new moment("2020").utc().format(),

    init: function(argv) {

        archiver.MAIL_HOME_DIR = argv.homedir || process.env['HOME'] + "/Library/Mail/V2/";

        if (argv.accountslist)
            return console.log(_.pluck(archiver.getAllAccounts(), "dirName").join("\n"));

        archiver.startDate = (argv.startDate) ? new moment(argv.startDate.toString()).utc().format() : archiver.startDate;
        archiver.endDate = (argv.endDate) ? new moment(argv.endDate.toString()).utc().format() : archiver.endDate;
        archiver.backend = require("./lib/backends/" + (argv.backend || "mongo"));

        var dboptions = {
            host: argv.host || "localhost",
            db: argv.db || "applemailarchive",
            port: argv.port || 27017,
            user: argv.user || false,
            password: argv.password || false,
            authDb: argv.authDb || argv.db
        };
        archiver.backend.dbconnect(dboptions, function(err) {
            if (err)
                return console.log("backend connection init failed :(");
            if (!argv.account)
                return archiver.archiveAllAccounts();
            archiver.archiveAccount(argv.account, true);
        });
    },

    processRecord: function(index) {
        if (index === archiver.getNumRecords())
            return archiver.shutdown();
        var record = archiver.records[index];
        emlx2json.parseFile(record.path, function(err, json) {
            index++;
            if (err) {
                console.log("\n" + index + " of " + archiver.getNumRecords() + "\nerror: ", err);
                return archiver.processRecord(index);
            }
            var dbrecord = new message(json);

            if (!(dbrecord.utcdate > archiver.startDate && dbrecord.utcdate < archiver.endDate)) {
                console.log("\n" + index + " of " + archiver.getNumRecords() + "\n" + dbrecord.subject + "\n" + dbrecord.date + "\nout of date range, skipping...");
                return archiver.processRecord(index);
            }

            dbrecord._mbox = record.mbox;
            dbrecord._account = record.account;

            archiver.backend.save(dbrecord, function() {
                console.log("\n" + index + " of " + archiver.getNumRecords() + "\n" + dbrecord.subject + "\n" + dbrecord.date);
                archiver.processRecord(index);
            })
        });
    },

    shutdown: function() {
        console.log("done processing records...");
        process.exit();
    },

    getNumRecords: function() {
        return archiver.records.length;
    },

    archiveAllAccounts: function() {
        var accounts = archiver.getAllAccounts();
        _.map(accounts, function(account) {
            return archiver.archiveAccount(account.accountName, true)
        });
        archiver.processRecord(argv.skip || 0);
    },

    archiveAccount: function(accountName, doArchive) {
        var accountDir = archiver.getDirectoryPathForAccount(accountName);
        var items = _.map(archiver.getAllMailBoxesForAccount(accountName), function(item) {
            archiver.addItemToRecords(item, accountDir, accountName)
        })
        if (doArchive)
            archiver.processRecord(argv.skip || 0);
    },

    addItemToRecords: function(item, accountDir, account) {
        _.map(archiver.getMessagesPathsForMbox(accountDir + item), function(msg) {
            archiver.records.push({
                path: msg,
                mbox: archiver.parseMboxName(item),
                account: account.accountName
            });
        })
    },

    parseMboxName: function(str) {
        return (str.match(/[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}/i)) ? "Inbox" : str.replace(/\.mbox$/, "");
    },

    getNumRecords: function() {
        return archiver.records.length;
    },

    getAllAccounts: function() {
        if (archiver.accountsList)
            return archiver.accountsList;
        var children = fs.readdirSync(archiver.MAIL_HOME_DIR);
        archiver.accountsList = archiver.parseAccountsDirsFromList(children);
        return archiver.accountsList;
    },

    getDirectoryPathForAccount: function(accountName) {
        return archiver.MAIL_HOME_DIR + accountName + "/INBOX.mbox/"
    },

    getAllMailBoxesForAccount: function(accountName) {
        var dirPath = archiver.getDirectoryPathForAccount(accountName);
        if (!fs.existsSync(dirPath))
            return console.error("Error: account '" + accountName + "' doesn't exist!");
        return _.filter(fs.readdirSync(dirPath), function(child) {
            return child.match(/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|\.mbox$)/i);
        });
    },

    getMailBoxForAccount: function(dirPath, mboxName) {
        var pattern = (mboxName.match(/inbox/i)) ? eval("/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i") : mboxName;
        var items = _.filter(fs.readdirSync(dirPath), function(child) {
            return child.match(pattern);
        });
        return items[0];
    },

    getMessagesPathsForMbox: function(mboxPath) {
        return searchfs.recursiveSearchSync(/(?!.partial.)(.emlx$|.eml$)/, mboxPath);
    },

    parseAccountsDirsFromList: function(items) {
        var dirNames = _.filter(items, function(child) {
            return child.match(/^(POP|IMAP)\-/);
        })
        return _.map(dirNames, function(dirName) {
            return {
                dirName: dirName,
                accountName: dirName
                    .replace(/^.*?\-/, "")
                    .replace(/(^.*?)\.(.*?)@.*?$/, "$1.$2")
            }
        })
    }
}

/*
fire
*/

archiver.init(argv);