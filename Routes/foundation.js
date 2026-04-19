const express = require("express");
const route = express.Router();
const exe = require('./../connection');

route.get("/", is_login, async function (req, res) {
    const foundation_email = req.session.foundation_email;
    
    // Get Foundation Info
    const foundation = await exe(`SELECT * FROM foundation_details WHERE email = ?`, [foundation_email]);
    const f_id = foundation[0].foundation_id;

    // Get Stats for Cards
    const totalDonors = await exe(`SELECT COUNT(DISTINCT donor_id) as total FROM donation_detail WHERE foundation_id = ? AND status = 'paid'`, [f_id]);
    const totalFunds = await exe(`SELECT SUM(amount) as total FROM donation_detail WHERE foundation_id = ? AND status = 'paid'`, [f_id]);
    const pendingPayouts = await exe(`SELECT SUM(amount) as total FROM donation_detail WHERE foundation_id = ? AND distribution = 'pending'`, [f_id]);

    // Get Monthly Chart Data
    const chartData = await exe(`
        SELECT 
            MONTHNAME(STR_TO_DATE(date, '%d-%m-%Y')) as month, 
            SUM(amount) as total 
        FROM donation_detail 
        WHERE foundation_id = ? AND status = 'paid'
        GROUP BY month, MONTH(STR_TO_DATE(date, '%d-%m-%Y'))
        ORDER BY MONTH(STR_TO_DATE(date, '%d-%m-%Y')) ASC
    `, [f_id]);

    const obj = { 
        foundation: foundation, 
        totalDonors: totalDonors[0].total,
        totalFunds: totalFunds[0].total || 0,
        pendingPayouts: pendingPayouts[0].total || 0,
        chartLabels: JSON.stringify(chartData.map(row => row.month)),
        chartValues: JSON.stringify(chartData.map(row => row.total))
    };
    
    res.render("foundation/index.ejs", obj);
});
route.get("/donor", is_login, async function (req, res) {
    var foundation_email = req.session.foundation_email;
    var foundation = await exe(`SELECT * FROM foundation_details WHERE email = ? `, [foundation_email]);
    var donors = await exe(`SELECT 
                d.donation_id,
                d.amount,
                d.date,
                d.distribution,
                dr.donor_name,
                dr.donor_email
            FROM donation_detail d
            JOIN donor_register dr ON d.donor_id = dr.donor_id
            WHERE d.foundation_id = ?
            ORDER BY d.date DESC;
        `,[foundation[0].foundation_id]);
    var obj = { "foundation": foundation ,"donors":donors};
    res.render("foundation/donor.ejs", obj)
})



//edit details 
route.get("/edit_details", is_login, async function (req, res) {
    var foundation_email = req.session.foundation_email;
    var foundation = await exe(`SELECT * FROM foundation_details WHERE email = ? `, [foundation_email]);
    res.render("foundation/update_detail.ejs", { foundation });
})
route.post("/update_detail", is_login, async function (req, res) {
    var d = req.body;
    var logo_image = "";

    if (req.files && req.files.logo_image) {
        logo_image = Date.now() + "_" + req.files.logo_image.name;
        await req.files.logo_image.mv("public/upload/" + logo_image);
    }

    var sql = `
        UPDATE foundation_details SET
            foundation_name = ?,
            description = ?,
            logo_image = ?,
            email = ?,
            phone = ?,
            address = ?,
            website = ?,
            upi_id = ?,
            facebook = ?,
            instagram = ?,
            twitter = ?,
            status = ?,
            created_year = ?,
            password = ?,
            approval = ?,
            category = ?
         WHERE email = '${d.email}'
    `;

    await exe(sql, [
        d.foundation_name,
        d.description,
        logo_image,
        d.email,
        d.phone,
        d.address,
        d.website,
        d.upi_id,
        d.facebook,
        d.instagram,
        d.twitter,
        d.status || 'inactive',
        d.created_year,
        d.password,
        'pending',
        d.category

    ]);
    res.redirect("/foundation");

})
route.get("/logout", is_login, function (req, res) {
    req.session.foundation_email = undefined;
    res.redirect("/login");
})

route.get("/fund_detail", async function (req, res) {
    var foundation = await exe(`SELECT * FROM foundation_details WHERE email = ? `, [req.session.foundation_email]);

    const dis_pen = await exe(`
        SELECT 
        d.donation_id,
        d.amount,
        d.date,
        d.distribution,
        dr.donor_name,
        f.foundation_name
        FROM donation_detail d
        JOIN donor_register dr 
            ON d.donor_id = dr.donor_id
        JOIN foundation_details f 
            ON d.foundation_id = f.foundation_id
        WHERE d.distribution = 'pending'
        ORDER BY d.date DESC;

    `);
    const fund_done = await exe(`
        SELECT 
        d.donation_id,
        d.amount,
        d.date,
        d.distribution,
        dr.donor_name,
        f.foundation_name
        FROM donation_detail d
        JOIN donor_register dr 
            ON d.donor_id = dr.donor_id
        JOIN foundation_details f 
            ON d.foundation_id = f.foundation_id
        WHERE d.distribution = 'done'
        ORDER BY d.date DESC;

    `);
    var obj = { "dis_pen": dis_pen, "fund_done": fund_done, "foundation": foundation };
    res.render("foundation/fund_detail.ejs", obj);

})



function is_login(req, res, next) {
    var user_id = req.session.foundation_email;
    if (user_id == undefined) {
        res.redirect("/login");
    }
    else {
        next();

    }
}


module.exports = route;


// INSERT INTO foundation_details (
//     foundation_name,
//     description,
//     logo_image,
//     email,
//     phone,
//     address,
//     website,
//     facebook,
//     instagram,
//     twitter,
//
//     status
// ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
