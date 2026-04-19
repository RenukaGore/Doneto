const express = require("express");
const route = express.Router();
const exe = require('./../connection');
const nodemailer = require("nodemailer");
const puppeteer = require("puppeteer");
const path = require("path");
const ejs = require("ejs");
const url = require("url");


route.get("/", async function (req, res) {
    var donor = await exe(`SELECT * FROM donor_register WHERE donor_id = '${req.session.donor_id}'`)
    var slider = await exe(`SELECT * FROM slider`);
    var site = await exe(`SELECT * FROM site_info WHERE site_id = 1`);
    var foundation_list = await exe(`SELECT * FROM foundation_details WHERE approval = 'approved'`);
    var obj = { "site": site, "slider": slider, "foundation_list": foundation_list, "is_login": is_loged(req), "donor": donor };
    res.render("user/index.ejs", obj);
})
route.get("/login", function (req, res) {
    req.session.donor_id = undefined;
    res.render("user/login.ejs");
})
route.get("/profile", async function (req, res) {
    var donor_id = req.session.donor_id;
    var slider = await exe(`SELECT * FROM slider`);
    var donor = await exe(`SELECT * FROM donor_register WHERE donor_id = '${donor_id}'`)
    var donations = await exe(`
    SELECT d.*, f.foundation_name
    FROM donation_detail d
    JOIN foundation_details f 
        ON d.foundation_id = f.foundation_id
    WHERE d.donor_id = ?
    `, [donor_id]);

    var obj = { "slider": slider, "is_login": is_loged(req), "donor": donor, "donations": donations };
    res.render("user/profile.ejs", obj);
})
route.get("/about", async function (req, res) {
    var foundation_list = await exe(`SELECT * FROM foundation_details WHERE approval = 'approved'`);
    var donor = await exe(`SELECT * FROM donor_register`);
    var donation = await exe(`SELECT * FROM donation_detail`);
    var slider = await exe(`SELECT * FROM slider`);
    var site = await exe(`SELECT * FROM site_info WHERE site_id = 1`);
    var obj = { "site": site, "slider": slider, "is_login": is_loged(req), "foundation_list": foundation_list, "donor": donor, "donation": donation };

    res.render("user/about.ejs", obj)
})
route.get("/foundation_register", function (req, res) {
    res.render("user/foundation_register.ejs");
})
route.post("/foundation_request", async function (req, res) {
    var d = req.body;
    var logo_image = "";
    var check = await exe(`SELECT * FROM foundation_details WHERE email = ? `, [d.email]);
    if (check.length > 0) {
        res.redirect("/login?email_is_already_register");
    } else {
        if (req.files && req.files.logo_image) {
            logo_image = Date.now() + "_" + req.files.logo_image.name;
            req.files.logo_image.mv("public/upload/" + logo_image);
        }

        var sql = `
        INSERT INTO foundation_details (
            foundation_name,
            description,
            logo_image,
            email,
            phone,
            address,
            website,
            upi_id,
            facebook,
            instagram,
            twitter,
            status,
            created_year,
            password,
            approval,
            category
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?,?)
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

        res.send("Submitted! We will inform you by email after admin verification." + `<a href="/">Home</a>`);
    }
});

route.post("/foundation_login", async function (req, res) {
    var d = req.body;
    var sql = `SELECT * FROM  foundation_register WHERE foundation_email = ? AND foundation_password = ?`;
    var data = await exe(sql, [d.foundation_email, d.foundation_password]);
    if (data.length > 0) {
        // ✅ login success
        req.session.foundation_email = d.foundation_email;
        res.redirect("/foundation");
    } else {
        // ❌ invalid credentials
        res.redirect("/login/?not found");
    }
})

route.get("/user_register", async function (req, res) {
    res.render("user/user_register.ejs");
})
route.post("/donor_register", async function (req, res) {
    var d = req.body;
    var check_email = await exe(`SELECT * FROM donor_register WHERE donor_email = '${d.r_donor_email}' `)
    if (!(check_email.length == 0)) {
        res.redirect("/user_register?:-email-is-already-registered");
    }
    var sql = `INSERT INTO donor_register(donor_name,donor_email,donor_phone,donor_address,donor_password) VALUES(?,?,?,?,?)`;
    await exe(sql, [d.donor_name, d.r_donor_email, d.donor_phone, d.donor_address, d.r_password]);
    res.redirect("/login");
})
route.post("/save_login", async function (req, res) {
    var d = req.body;
    var data = await exe(`SELECT * FROM donor_register WHERE donor_email = ? AND donor_password = ? `, [d.donor_email, d.donor_password]);
    if (data.length > 0) {
        req.session.donor_id = data[0].donor_id;
        req.session.is_login = true;
        res.redirect("/");

    } else {
        res.redirect("/login?INVALID_DONOR_ID_AND_PASSWORD")
    }

})
route.get("/logout", function (req, res) {
    req.session.donor_id = undefined;
    res.redirect("/");
})

route.get("/donate/:id", is_login, async function (req, res) {

    var site = await exe(`SELECT * FROM site_info WHERE site_id = 1`);

    var foundation = await exe(`SELECT * FROM foundation_details WHERE foundation_id = ?`, [req.params.id]);
    var is_login = true;
    var slider = await exe(`SELECT * FROM slider`);
    var foundation_list = await exe(`SELECT * FROM foundation_details WHERE approval = 'approved'`);
    var obj = { "site": site, "slider": slider, "foundation": foundation, "is_login": is_login, "foundation_list": foundation_list };
    res.render("user/donate_page.ejs", obj);
})
//payment
route.post("/proceed_to_pay", async function (req, res) {
    var d = req.body;
    var sql = `INSERT INTO donation_detail(foundation_id,donor_id,amount,status,donor_massage) VALUES(?,?,?,?,?)`;
    var data = await exe(sql, [d.foundation_id, req.session.donor_id, d.amount, 'pending', d.message]);
    var donation_id = data.insertId;
    var foundation = await exe(`SELECT * FROM foundation_details WHERE foundation_id = ?`, [d.foundation_id]);

    var obj = { "foundation": foundation, "amount": d.amount, "donation_id": donation_id, };
    res.render("user/payment.ejs", obj);

})
route.post("/check_payment/:donation_id", async function (req, res) {
    var donation_id = req.params.donation_id;
    var transaction_id = req.body.razorpay_payment_id;
    const ddate = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");

    await exe(`UPDATE donation_detail SET status = 'paid',distribution = 'pending',transaction_id = '${transaction_id}',date = '${ddate}' WHERE donation_id = '${donation_id}'`);

    var donation = await exe(`SELECT * FROM donation_detail WHERE donation_id = ?`, [donation_id]);

    var foundation = await exe(`SELECT * FROM foundation_details WHERE foundation_id = ?`, [donation[0].foundation_id]);
    var donor = await exe(`SELECT * FROM donor_register WHERE donor_id = ?`, [req.session.donor_id])
    const email_id = donor[0].donor_email;
    const found_email = foundation[0].email

    var obj = { "donation": donation, "foundation": foundation };


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
        to: [email_id, found_email],
        subject: "Thank You ",
        html: `
                <html lang="en">
                <head>
                <meta charset="UTF-8">
                <title>Thank You for Your Donation</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">

                <style>
                /* ===== RESET ===== */
                *{
                margin:0;
                padding:0;
                box-sizing:border-box;
                font-family:'Poppins',sans-serif;
                }

                /* ===== BACKGROUND ===== */


                /* ===== CARD ===== */
                .thank-card{
                width:450px;
                background:#fff;
                border-radius:20px;
                padding:35px;
                text-align:center;
                box-shadow:0 25px 50px rgba(0,0,0,.25);
                animation:fadeScale .9s ease;
                }

                @keyframes fadeScale{
                from{opacity:0;transform:scale(.85);}
                to{opacity:1;transform:scale(1);}
                }

                /* ===== CHECK ICON ===== */
                .check{
                width:80px;
                height:80px;
                background:#38ef7d;
                color:#fff;
                border-radius:50%;
                display:flex;
                justify-content:center;
                align-items:center;
                font-size:40px;
                margin:0 auto 20px;
                animation:pulse 1.5s infinite;
                }

                @keyframes pulse{
                0%{box-shadow:0 0 0 0 rgba(56,239,125,.6);}
                70%{box-shadow:0 0 0 25px rgba(56,239,125,0);}
                100%{box-shadow:0 0 0 0 rgba(56,239,125,0);}
                }

                /* ===== TEXT ===== */
                .thank-card h1{
                color:#11998e;
                font-size:28px;
                margin-bottom:8px;
                }

                .thank-card p{
                color:#555;
                font-size:15px;
                margin-bottom:25px;
                }

                /* ===== SUMMARY ===== */
                .summary{
                background:#f7f7f7;
                border-radius:14px;
                padding:18px;
                margin-bottom:25px;
                text-align:left;
                }

                .summary h3{
                color:#333;
                margin-bottom:12px;
                }

                .summary div{
                display:flex;
                justify-content:space-between;
                margin-bottom:8px;
                font-size:14px;
                color:#444;
                }

                /* ===== BUTTONS ===== */
                .actions{
                display:flex;
                gap:15px;
                }

                .actions a{
                flex:1;
                padding:12px;
                border-radius:30px;
                text-decoration:none;
                font-weight:600;
                text-align:center;
                transition:.4s;
                }

                .invoice-btn{
                background:linear-gradient(135deg,#11998e,#38ef7d);
                color:#fff;
                }

                .home-btn{
                border:2px solid #38ef7d;
                color:#11998e;
                }

                .actions a:hover{
                transform:translateY(-3px);
                box-shadow:0 10px 20px rgba(0,0,0,.2);
                }

                /* ===== FOOTER ===== */
                .footer-text{
                margin-top:18px;
                font-size:13px;
                color:#666;
                }
                </style>
                </head>

                <body>

                <div class="thank-card">

                <!-- Icon -->
                <div class="check">✓</div>

                <!-- Heading -->
                <h1>Thank You for Your Donation!</h1>
                <p>Your kindness helps make the world a better place 🌍</p>

                <!-- Summary -->
                <div class="summary">
                    <h3>Donation Summary</h3>

                    <div>
                    <span>Foundation</span>
                    <span> ${foundation[0].foundation_name} </span>
                    </div>

                    <div>
                    <span>Amount</span>
                    <span>₹ ${donation[0].amount}</span>
                    </div>

                    <div>
                    <span>Transaction ID</span>
                    <span>${donation[0].transaction_id}</span>
                    </div>

                    <div>
                    <span>Date</span>
                    <span>${donation[0].date}</span>
                    </div>
                </div>

                
                

                

                </div>

                </body>
                </html>
            `,
    });

    console.log("✅ thankyou email sent to:", email_id);
    // ✅ Correct SQL insert



    res.render("user/thankyou.ejs", obj);


})

route.get("/invoice/pdf/:donation_id", async (req, res) => {
    try {
        const donation_id = req.params.donation_id;

        const data = await exe(`
            SELECT 
                d.donation_id,
                d.amount,
                d.transaction_id,
                d.date,
                dr.donor_name,
                dr.donor_email,
                dr.donor_phone,
                fd.foundation_name,
                fd.email AS foundation_email
            FROM donation_detail d
            JOIN donor_register dr 
                ON d.donor_id = dr.donor_id
            JOIN foundation_details fd 
                ON d.foundation_id = fd.foundation_id
            WHERE d.donation_id = ?
        `, [donation_id]);

        if (data.length === 0) {
            return res.send("Invoice not found");
        }

        const invoice = data[0];

        // ✅ Correct path
        const html = await ejs.renderFile(
            path.join(__dirname, "../views/user/invoice.ejs"),
            { invoice }
        );

        const browser = await puppeteer.launch({
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "networkidle0" });

        const pdf = await page.pdf({
            format: "A4",
            printBackground: true
        });

        await browser.close();

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=Invoice_${invoice.donation_id}.pdf`
        );

        res.send(pdf);

    } catch (err) {
        console.error("INVOICE ERROR:", err);
        res.send(`<pre>${err}</pre>`);
    }
});

//change password
route.post("/change_password", async function (req, res) {
    var donor_id = req.session.donor_id;
    var d = req.body;
    if (d.new !== d.confirm) {
        res.redirect("/profile?confirm-password-not-match")
    }
    var pass = await exe(`SELECT * FROM donor_register WHERE donor_password = ?`, [d.current]);
    if (pass.length > 0) {
        await exe(`UPDATE donor_register SET donor_password = ? WHERE donor_id = ?`, [d.new, donor_id])
        res.redirect("/login");
    } else {
        res.redirect("/profile?current-password-not-match");
    }
})
//edit profile
route.post("/update-profile", async function (req, res) {
    var donor_id = req.session.donor_id;
    var d = req.body;
    
    if (d.donor_name && d.donor_email && d.donor_phone) {

        await exe(`UPDATE donor_register SET donor_name = ?,donor_email = ?,donor_phone = ? WHERE donor_id = ?`, [d.name, d.email, d.phone, donor_id])

    } else {
        if (d.donor_name) {
            await exe(`UPDATE donor_register SET donor_name = ? WHERE donor_id = ?`, [d.donor_name, donor_id])
        }
        if (d.donor_email) {
            await exe(`UPDATE donor_register SET donor_email = ? WHERE donor_id = ?`, [d.donor_email, donor_id])
        }
        if (d.donor_phone) {
            await exe(`UPDATE donor_register SET donor_phone = ? WHERE donor_id = ?`, [d.donor_phone, donor_id])
        }
    }
    res.redirect("/profile");
})

//foundation_page
route.get("/foundation_page", async function (req, res) {

    var url_data = url.parse(req.url, true).query;
    var foundation_list;
    var cat = await exe(`SELECT DISTINCT category FROM foundation_details WHERE approval = 'approved'`);
    if (url_data.category_name) {
        foundation_list = await exe(`SELECT * FROM foundation_details WHERE category = '${url_data.category_name}' AND approval = 'approved'`);
    } else {
        foundation_list = await exe(`SELECT * FROM foundation_details WHERE approval = 'approved'`);
    }
    var site = await exe(`SELECT * FROM site_info WHERE site_id = 1`);
    var donor = await exe(`SELECT * FROM donor_register WHERE donor_id = '${req.session.donor_id}'`)
    var obj = { "site": site, "categories": cat, "foundation_list": foundation_list, "is_login": is_loged(req), "donor": donor };
    res.render("user/foundation_page.ejs", obj)
})
route.get('/foundation_details/:id', async (req, res) => {
    const id = req.params.id;

    const foundation = await exe(
        `SELECT * FROM foundation_details WHERE foundation_id = ? `,
        [id]
    );

    const progress = Math.min(
        (50 / 20) * 100,
        100
    );
    var obj = { "foundation": foundation, "progress": progress }

    res.render('user/foundation_details.ejs', obj);
});

//contact
route.get("/contact",async (req,res)=>{
     var site = await exe(`SELECT * FROM site_info WHERE site_id = 1`);

    
    var slider = await exe(`SELECT * FROM slider`);
    var foundation_list = await exe(`SELECT * FROM foundation_details WHERE approval = 'approved'`);
    var obj = { "site": site,  "is_login": is_loged(req)};
    res.render("user/contact.ejs", obj)
})



function is_login(req, res, next) {
    if (req.session.donor_id == undefined) {
        res.redirect("/login");

    } else {
        next();
    }
}
function is_loged(req, res, next) {
    var user_id = req.session.donor_id;
    if (user_id == undefined) {
        return false;
    }
    else {
        return true;
    }
}
module.exports = route;
