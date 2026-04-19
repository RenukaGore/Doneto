const mysql = require("mysql2");
const util = require("util");




const conn = mysql.createConnection({
    host:"b7rjbapbslmsrec36mm1-mysql.services.clever-cloud.com",
    user:"ux43q7abgmmkyhmb",
    password:"bJaiU4ld2N9GQ60s8z8t",
    database:"b7rjbapbslmsrec36mm1"
})

const exe = util.promisify(conn.query).bind(conn);
module.exports = exe;
