import nodemailer from "nodemailer";

export function sendmail(to, subject, text) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASSWORD,
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
  });

  const mailOptions = {
    from: process.env.EMAIL,
    to,
    subject,
    text,
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log("Error:", error);
    } else {
      console.log("Email sent:", info.response);
    }
  });
}

export async function sendSubscriptionInvoiceEmail({
  to,
  username,
  planName,
  planPrice,
  watchLimit,
  invoiceId,
  paymentDate,
}) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASSWORD,
    },
    connectionTimeout: 5000, // 5 seconds
    greetingTimeout: 5000,
    socketTimeout: 5000,
  });

  const template = generateSubscriptionEmail({
    username,
    planName,
    planPrice,
    watchLimit,
    invoiceId,
    paymentDate,
  });

  return transporter.sendMail({
    from: process.env.EMAIL,
    to,
    subject: `Invoice - ${planName} Plan Upgrade`,
    html: template,
  });
}

function generateSubscriptionEmail({
  username,
  planName,
  planPrice,
  watchLimit,
  invoiceId,
  paymentDate,
}) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
  <meta charset="UTF-8">
  <style>
  body{
    font-family: Arial, sans-serif;
    background:#f4f6f8;
    padding:20px;
  }
  
  .container{
    max-width:600px;
    margin:auto;
    background:white;
    border-radius:8px;
    overflow:hidden;
  }
  
  .header{
    background:#ff0000;
    color:white;
    text-align:center;
    padding:20px;
  }
  
  .content{
    padding:25px;
  }
  
  .plan-box{
    background:#f9fafb;
    border:1px solid #e5e7eb;
    padding:15px;
    border-radius:6px;
    margin:20px 0;
  }
  
  table{
    width:100%;
    border-collapse:collapse;
  }
  
  th,td{
    border:1px solid #ddd;
    padding:10px;
  }
  
  th{
    background:#f3f4f6;
  }
  
  .footer{
    text-align:center;
    font-size:12px;
    color:#777;
    padding:15px;
  }
  </style>
  </head>
  
  <body>
  
  <div class="container">
  
  <div class="header">
  <h2>Subscription Upgrade Successful 🎉</h2>
  </div>
  
  <div class="content">
  
  <p>Hello <strong>${username}</strong>,</p>
  
  <p>Your subscription upgrade was successful. Below are your plan and payment details.</p>
  
  <div class="plan-box">
  <h3>Plan Details</h3>
  <p><strong>Plan:</strong> ${planName}</p>
  <p><strong>Price:</strong> ₹${planPrice}</p>
  <p><strong>Watch Time:</strong> ${watchLimit}</p>
  </div>
  
  <h3>Invoice Summary</h3>
  
  <table>
  <tr>
  <th>Invoice ID</th>
  <td>${invoiceId}</td>
  </tr>
  
  <tr>
  <th>Payment Date</th>
  <td>${paymentDate}</td>
  </tr>
  
  <tr>
  <th>Plan</th>
  <td>${planName}</td>
  </tr>
  
  <tr>
  <th>Amount Paid</th>
  <td>₹${planPrice}</td>
  </tr>
  
  <tr>
  <th>Status</th>
  <td>Paid ✅</td>
  </tr>
  </table>
  
  <p>You can now enjoy your upgraded viewing experience.</p>
  
  <p>Happy Watching 🎬</p>
  
  </div>
  
  <div class="footer">
  © 2026 Video Platform
  </div>
  
  </div>
  
  </body>
  </html>
  `;
}