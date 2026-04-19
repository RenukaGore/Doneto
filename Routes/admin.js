const express = require("express");
const route = express.Router();
const exe = require('./../connection');
const nodemailer = require("nodemailer");

// admin.js - Update your existing route.get("/")
route.get("/", async function (req, res) {
    // 1. Fetch counts for dashboard stat cards
    const foundations = await exe(`SELECT COUNT(*) as total FROM foundation_details`);
    const pending = await exe(`SELECT COUNT(*) as total FROM foundation_details WHERE approval = 'pending'`);
    const funds = await exe(`SELECT SUM(amount) as total FROM donation_detail WHERE status = 'paid'`);
    
    // 2. Fetch monthly data for the Chart
    // We must convert your string dates (dd-mm-yyyy) into actual MySQL dates for sorting
    const chartData = await exe(`
        SELECT 
            MONTHNAME(STR_TO_DATE(date, '%d-%m-%Y')) as month, 
            SUM(amount) as total 
        FROM donation_detail 
        WHERE status = 'paid' 
        GROUP BY month, MONTH(STR_TO_DATE(date, '%d-%m-%Y'))
        ORDER BY MONTH(STR_TO_DATE(date, '%d-%m-%Y')) ASC
    `);

    const obj = {
        distribution: 'index',
        totalFoundations: foundations[0].total || 0,
        totalPending: pending[0].total || 0,
        totalFunds: funds[0].total || 0,
        chartLabels: JSON.stringify(chartData.map(row => row.month)),
        chartValues: JSON.stringify(chartData.map(row => row.total))
    };

    res.render("admin/index.ejs", obj);
});

//slider
route.get("/slider", async function (req, res) {
    var slider = await exe(`SELECT * FROM slider`);
    var obj = { "slider": slider, "distribution": 'slider' };

    res.render("admin/slider.ejs", obj);
})
route.post("/save_slider", async function (req, res) {
    var d = req.body;
    var slider_image = " ";
    if (req.files) {
        slider_image = Date.now() + req.files.slider_image.name;
        req.files.slider_image.mv("public/upload/" + slider_image);
    }
    var slider = await exe(`INSERT INTO slider(slider_title,slider_discription,slider_btn_text,slider_btn_url,slider_image) VALUES(?,?,?,?,?)`, [d.slider_title, d.slider_discription, d.slider_btn_text, d.slider_btn_url, slider_image]);

    res.redirect("/admin/slider");

})
route.get("/delete/:id", async function (req, res) {
    await exe(`DELETE FROM slider WHERE slider_id = '${req.params.id}'`);
    res.redirect("/admin/slider");
})

// foundation list
route.get("/foundation_list", async function (req, res) {
    var pending_list = await exe(`SELECT * FROM foundation_details WHERE approval = 'pending'`);
    var approved_list = await exe(`SELECT * FROM foundation_details WHERE approval = 'approved'`);
    var rejected_list = await exe(`SELECT * FROM foundation_details WHERE approval = 'rejected'`);
    var obj = { "distribution": 'foundation_list', "pending_list": pending_list, "approved_list": approved_list, "rejected_list": rejected_list };
    res.render("admin/foundation_list.ejs", obj);
})

//approve
route.get("/approve/:foundation_id", async function (req, res) {
    try {
        const foundation_id = req.params.foundation_id;

        const data = await exe(
            "SELECT * FROM foundation_details WHERE foundation_id = ?",
            [foundation_id]
        );

        if (data.length === 0) {
            return res.send("Foundation not found");
        }

        const email_id = data[0].email;
        const password = data[0].password;

        if (!email_id) {
            return res.send("Foundation email missing");
        }

        // ✅ Gmail transporter
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: "harishgore2023@gmail.com",
                pass: "momb mhow gzav bovx", // App password
            },
        });

        // ✅ Send email
        await transporter.sendMail({
            from: '"DoneTo" <harishgore2023@gmail.com>',
            to: email_id,
            subject: "Foundation Approved ✅",
            html: `
                <h2>🎉 Approval Successful</h2>
                <p>Your foundation has been approved.</p>
                <p><b>Email:</b> ${email_id}</p>
                <p><b>Password:</b> ${password}</p>
                <p>Login now and start managing donations.</p>
            `,
        });

        console.log("✅ Email sent to:", email_id);
        await exe(`UPDATE foundation_details SET approval = 'approved' WHERE foundation_id = '${foundation_id}'`);
        // ✅ Correct SQL insert
        await exe(
            `INSERT INTO foundation_register
            (foundation_id, foundation_email, foundation_password)
            VALUES (?, ?, ?)`,
            [foundation_id, email_id, password]
        );

        res.redirect("/admin/foundation_list");

    } catch (err) {
        console.error("❌ Approval Error:", err);
        res.send("Something went wrong while approving foundation");
    }
});

route.get("/reject/:foundation_id", async function (req, res) {
    try {
        const foundation_id = req.params.foundation_id;

        const data = await exe(
            "SELECT * FROM foundation_details WHERE foundation_id = ?",
            [foundation_id]
        );

        if (data.length === 0) {
            return res.send("Foundation not found");
        }

        const email_id = data[0].email;


        if (!email_id) {
            return res.send("Foundation email missing");
        }

        // ✅ Gmail transporter
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: "harishgore2023@gmail.com",
                pass: "momb mhow gzav bovx", // App password
            },
        });

        // ✅ Send email
        await transporter.sendMail({
            from: '"DoneTo" <harishgore2023@gmail.com>',
            to: email_id,
            subject: "Foundation Request Rejected ❌",
            html: `
                <h2>❌ Foundation Request Rejected</h2>
                <p>Dear Foundation,</p>
                <p>We regret to inform you that your foundation request has been rejected after review.</p>
                <p>If you believe this is a mistake, feel free to contact our support team.</p>
                <br>
                <p>Regards,<br><b>DoneTo Team</b></p>
                <P>contact : 8180058023 </p>
            `,
        });

        console.log("✅ Rejection email sent to:", email_id);



        await exe(`UPDATE foundation_details SET approval = 'rejected' WHERE foundation_id = '${foundation_id}'`);
        await exe(`DELETE FROM foundation_register WHERE foundation_id = '${foundation_id}'`);
        res.redirect("/admin/foundation_list");

    } catch (err) {
        console.error("❌ Approval Error:", err);
        res.send("Something went wrong while approving foundation");
    }

})

// foundation_info
route.get("/foundation_info/:foundation_id", async function (req, res) {
    
    var foundation_info = await exe(`SELECT * FROM foundation_details WHERE foundation_id = '${req.params.foundation_id}'`);
    var obj = {"foundation_info":foundation_info,"distribution":'foundation_list'}
    res.render("admin/foundation_info.ejs", obj);
})
route.get("/re_apply/:foundation_id", async function (req, res) {
    var foundation_id = req.params.foundation_id;
    var foundation = await exe(`SELECT * FROM foundation_details WHERE foundation_id = ?`, [foundation_id])
    const foundationName = foundation[0].foundation_name;
    const rejectionReason = "Incomplete documents / Invalid registration details";
    const reapplyLink = "http://localhost:2000/foundation_register";
    const platformName = "Doneto";
    const year = new Date().getFullYear();
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: "harishgore2023@gmail.com",
            pass: "momb mhow gzav bovx", // App password
        },
    });
    await transporter.sendMail({
        from: '"Doneto Admin" <harishgore2023@gmail.com>',
        to: foundation[0].email,
        subject: "Foundation Application Update",
        html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
        <meta charset="UTF-8">
        <title>Foundation Application Status</title>

        <style>
        body{
            margin:0;
            padding:0;
            background:#f4f6f8;
            font-family:Arial,Helvetica,sans-serif;
        }
        .email-container{
            max-width:600px;
            margin:40px auto;
            background:#fff;
            border-radius:8px;
            overflow:hidden;
            box-shadow:0 4px 12px rgba(0,0,0,.08);
        }
        .header{
            background:linear-gradient(135deg,#e53935,#d32f2f);
            color:#fff;
            padding:24px;
            text-align:center;
        }
        .content{
            padding:30px;
            color:#333;
            line-height:1.6;
        }
        .reason-box{
            background:#fff3f3;
            border-left:4px solid #e53935;
            padding:15px;
            margin:20px 0;
            border-radius:4px;
        }
        .cta{
            text-align:center;
            margin:30px 0;
        }
        .cta a{
            background:#2e7d32;
            color:#fff;
            padding:12px 28px;
            text-decoration:none;
            border-radius:6px;
            font-weight:bold;
        }
        .footer{
            background:#f0f2f5;
            padding:20px;
            text-align:center;
            font-size:13px;
            color:#666;
        }
        </style>
        </head>

        <body>

        <div class="email-container">

        <div class="header">
        <h1>Foundation Application Update</h1>
        </div>

        <div class="content">
        <p>Dear <strong>${foundationName}</strong>,</p>

        <p>
        Thank you for submitting your foundation registration request.
        After careful review, your application could not be approved at this time.
        </p>

        <div class="reason-box">
        <strong>Reason for Rejection:</strong><br>
        ${rejectionReason}
        </div>

        <p>Please update the details and re-apply.</p>

        <div class="cta">
        <a href="${reapplyLink}">Re-Apply Now</a>
        </div>

        <p>
        Best regards,<br>
        <strong>Admin Team</strong><br>
        ${platformName}
        </p>
        </div>

        <div class="footer">
        <span>This is an automated email.</span>
        <span>© ${year} ${platformName}. All rights reserved.</span>
        </div>

        </div>

        </body>
        </html>
        `
    });
    await exe(`DELETE FROM foundation_details WHERE foundation_id = ?`, [foundation_id]);

    res.redirect("/admin");

})
route.get("/setting", async function (req, res) {
    var site = await exe(`SELECT * FROM site_info WHERE site_id = 1`);
    var obj = { "site": site, "distribution": 'setting' };
    res.render("admin/web_setting.ejs", obj);
})
route.post("/web_setting", async function (req, res) {
    var d = req.body;
    if (req.files !== null) {
        var logo = Date.now() + req.files.site_logo.name;
        req.files.site_logo.mv("public/upload/" + logo);
        await exe(`UPDATE site_info SET site_logo = ? WHERE site_id = 1`, [logo]);

    }
    await exe(`UPDATE site_info SET site_name = ? , tagline = ? , footer_text = ? , contact_email = ? , phone = ? , instagram = ? , facebook = ? , twitter = ?  WHERE site_id = 1`, [d.site_name, d.tagline, d.footer_text, d.contact_email, d.phone, d.instagram, d.facebook, d.twitter])
    res.redirect("/admin");

})
//edit slider
route.get("/edit_slider/:id", async function (req, res) {
    var slider_id = req.params.id;
    var slider = await exe(`SELECT * FROM slider WHERE slider_id = ?`, [slider_id]);
    var obj = { "distribution": 'slider', "slider": slider }
    res.render("admin/update_slider.ejs", obj);
})
route.post("/update_slider/:id", async function (req, res) {
    var d = req.body;
    var slider_id = req.params.id;
    var slider_image = " ";
    if (req.files) {
        slider_image = Date.now() + req.files.slider_image.name;
        req.files.slider_image.mv("public/upload/" + slider_image);
    } else {
        slider_image = d.old_image
    }
    await exe(`UPDATE  slider SET slider_title = ?,slider_discription = ?,slider_btn_text = ?,slider_btn_url = ?,slider_image = ? WHERE slider_id = ? `, [d.slider_title, d.slider_discription, d.slider_btn_text, d.slider_btn_url, slider_image, slider_id]);
    res.redirect("/admin/slider");
})

// admin fund details page
route.get("/distribute_fund", async (req, res) => {

    const funds = await exe(`
        SELECT 
        d.donation_id,
        d.amount,
        d.date,
        dr.donor_name,
        f.foundation_name,
        f.upi_id
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
        dr.donor_name,
        f.foundation_name,
        f.upi_id
        FROM donation_detail d
        JOIN donor_register dr 
            ON d.donor_id = dr.donor_id
        JOIN foundation_details f 
            ON d.foundation_id = f.foundation_id
        WHERE d.distribution = 'done'
        ORDER BY d.date DESC;

    `);


    res.render("admin/fund.ejs", {
        funds,
        distribution: 'fund',
        fund_done
    });


});
route.get("/distribute_money/:id", async function (req, res) {
    var donation_id = req.params.id;
    var donation = await exe(`SELECT * FROM donation_detail WHERE donation_id = ?`, [donation_id]);
    var foundation_email = await exe(`SELECT email FROM foundation_details WHERE foundation_id = ?`, [donation[0].foundation_id]);
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: "harishgore2023@gmail.com",
            pass: "momb mhow gzav bovx", // App password
        },
    });

    // ✅ Send email
    await transporter.sendMail({
        from: '"DoneTo" <harishgore2023@gmail.com>',
        to: foundation_email[0].email,
        subject: "Fund Distributed by Admin ",
        html: `
                <p>Dear Foundation,</p>
                <p>Admin Distributed your recent Donation of RS :${donation[0].amount} </p>
                <p>If you will not recieved, feel free to contact our support team.</p>
                <br>
                <p>Regards,<br><b>DoneTo Team</b></p>
                <P>contact : 8180058023 </p>
            `,
    });

    await exe(`UPDATE donation_detail SET distribution = 'done' WHERE donation_id = '${donation_id}'`);
    res.redirect("/admin/distribute_fund");
})
module.exports = route;
