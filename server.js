const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const http = require("http");

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = String(process.env.ADMIN_CHAT_ID || "");

const ACTIVATION_WEBSITE =
  "https://noob738.github.io/sunny999-activation-center/";

const SUPPORT_BOT = "https://t.me/IDActivationBot";

const DATA_FILE = "activation-data.json";

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN missing");
  process.exit(1);
}

if (!ADMIN_CHAT_ID) {
  console.error("ADMIN_CHAT_ID missing");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, {
  polling: true
});

const PLANS = {
  prime5: {
    name: "PRIME 5",
    amount: 999
  },
  prime6: {
    name: "PRIME 6",
    amount: 1299
  },
  prime7: {
    name: "PRIME 7",
    amount: 1999
  },
  prime8: {
    name: "PRIME 8",
    amount: 3999
  }
};


function loadData() {

  try {

    if (!fs.existsSync(DATA_FILE)) {

      return {
        orders: [],
        usedScreenshots: [],
        usedUTR: [],
        generatedCodes: [],
        generatedLogins: []
      };

    }

    const data = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );

    return {
      orders: data.orders || [],
      usedScreenshots: data.usedScreenshots || [],
      usedUTR: data.usedUTR || [],
      generatedCodes: data.generatedCodes || [],
      generatedLogins: data.generatedLogins || []
    };

  } catch (e) {

    console.error("Database load error:", e);

    return {
      orders: [],
      usedScreenshots: [],
      usedUTR: [],
      generatedCodes: [],
      generatedLogins: []
    };

  }

}


function saveData(data) {

  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(data, null, 2)
  );

}


let data = loadData();


function randomString(length) {

  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

  let result = "";

  for (let i = 0; i < length; i++) {

    result += chars.charAt(
      Math.floor(Math.random() * chars.length)
    );

  }

  return result;

}


function generateActivationCode() {

  let code;

  do {

    code = "";

    for (let i = 0; i < 10; i++) {

      code += Math.floor(Math.random() * 10);

    }

  } while (data.generatedCodes.includes(code));

  data.generatedCodes.push(code);

  return code;

}


function generateLogin() {

  let login;

  do {

    login =
      "sunny" +
      randomString(10).toLowerCase() +
      "@gmail.com";

  } while (data.generatedLogins.includes(login));

  data.generatedLogins.push(login);

  return login;

}


function generatePassword() {

  return randomString(16);

}


function findUserWaiting(userId) {

  return data.orders
    .slice()
    .reverse()
    .find(order =>
      String(order.userId) === String(userId) &&
      order.status === "WAITING_SCREENSHOT"
    );

}


function createOrder(user, planKey, utr) {

  const plan = PLANS[planKey];

  if (!plan) {
    return null;
  }

  if (!/^[0-9]{12}$/.test(utr)) {
    return null;
  }

  if (data.usedUTR.includes(utr)) {
    return "DUPLICATE_UTR";
  }

  const order = {

    id:
      "ORD-" +
      Date.now() +
      "-" +
      Math.floor(Math.random() * 1000),

    userId: user.id,

    username: user.username || "",

    firstName: user.first_name || "",

    plan: planKey,

    planName: plan.name,

    amount: plan.amount,

    utr: utr,

    status: "WAITING_SCREENSHOT",

    createdAt: new Date().toISOString(),

    screenshotId: null,

    credentials: null

  };

  data.orders.push(order);

  data.usedUTR.push(utr);

  saveData(data);

  return order;

}


/*
START
*/

bot.onText(/^\/start(?:\s+(.+))?$/i, async (msg, match) => {

  const userId = msg.from.id;

  const payload = match && match[1]
    ? match[1].trim()
    : "";

  if (!payload) {

    await bot.sendMessage(
      userId,
      "👑 SUNNY 999 BOT\n\n" +
      "🆔 ID ACTIVATION CENTER\n\n" +
      "Pehle activation website par apna Prime select karo.\n\n" +
      "💳 Activation payment karo.\n" +
      "📌 12 digit UTR enter karo.\n" +
      "📸 Payment screenshot yahin bot par bhejo.\n\n" +
      "🌐 " + ACTIVATION_WEBSITE
    );

    return;

  }

  const planKey = payload.toLowerCase();

  if (!PLANS[planKey]) {

    await bot.sendMessage(
      userId,
      "❌ Invalid Prime.\n\n" +
      "Activation website se process start karo:\n" +
      ACTIVATION_WEBSITE
    );

    return;

  }

  await bot.sendMessage(
    userId,
    "🔥 " + PLANS[planKey].name + "\n\n" +
    "💳 Activation Amount: ₹" +
    PLANS[planKey].amount +
    "\n\n" +
    "Payment complete karne ke baad:\n" +
    "1️⃣ 12-digit UTR bhejo\n" +
    "2️⃣ Payment screenshot bhejo\n\n" +
    "⚠️ Sirf real payment proof submit karo."
  );

});


/*
WEBSITE SE AAYA TEXT
Example:
Payment Verification
Prime: 5
Amount: ₹999
UTR: 123456789012
*/

bot.on("message", async (msg) => {

  if (!msg.text) return;

  if (msg.text.startsWith("/")) return;

  const text = msg.text;

  const primeMatch =
    text.match(/Prime\s*:\s*(5|6|7|8)/i);

  const utrMatch =
    text.match(/UTR\s*:\s*(\d{12})/i);

  if (!primeMatch || !utrMatch) return;

  const primeNumber = primeMatch[1];

  const utr = utrMatch[1];

  const planKey = "prime" + primeNumber;

  if (!PLANS[planKey]) {

    await bot.sendMessage(
      msg.chat.id,
      "❌ Invalid Prime."
    );

    return;

  }

  const order = createOrder(
    msg.from,
    planKey,
    utr
  );

  if (order === "DUPLICATE_UTR") {

    await bot.sendMessage(
      msg.chat.id,
      "❌ Ye UTR already submit ho chuka hai.\n\n" +
      "Same payment ko dobara submit nahi kar sakte."
    );

    return;

  }

  if (!order) {

    await bot.sendMessage(
      msg.chat.id,
      "❌ Invalid UTR.\n\n" +
      "12 digit UTR enter karo."
    );

    return;

  }

  await bot.sendMessage(
    msg.chat.id,
    "✅ PAYMENT DETAILS RECEIVED\n\n" +
    "🔥 " + order.planName + "\n" +
    "💰 Amount: ₹" + order.amount + "\n" +
    "🔢 UTR: " + order.utr + "\n\n" +
    "📸 Ab isi chat mein payment screenshot bhejo.\n\n" +
    "⏳ Screenshot ke baad admin verification hogi."
  );

});


/*
SCREENSHOT
*/

bot.on("photo", async (msg) => {

  const userId = msg.from.id;

  const order = findUserWaiting(userId);

  if (!order) {

    await bot.sendMessage(
      userId,
      "❌ Koi pending payment order nahi mila.\n\n" +
      "Pehle activation website se payment details submit karo."
    );

    return;

  }

  const photo =
    msg.photo[msg.photo.length - 1];

  const uniqueId =
    photo.file_unique_id;

  if (data.usedScreenshots.includes(uniqueId)) {

    await bot.sendMessage(
      userId,
      "❌ Ye payment screenshot already submit ho chuka hai."
    );

    return;

  }

  data.usedScreenshots.push(uniqueId);

  order.screenshotId = photo.file_id;

  order.status =
    "PENDING_ADMIN_VERIFICATION";

  order.screenshotUniqueId =
    uniqueId;

  saveData(data);


  await bot.sendMessage(
    userId,
    "📸 SCREENSHOT RECEIVED\n\n" +
    "⏳ Payment admin verification ke liye bhej diya gaya hai.\n\n" +
    "Approval ke baad aapko:\n" +
    "🆔 Login ID\n" +
    "🔐 Password\n" +
    "🔑 10 Digit Activation Code\n" +
    "🌐 Activation Website\n\n" +
    "mil jayega."
  );


  const adminText =

    "💳 NEW ACTIVATION PAYMENT\n\n" +

    "🆔 Order: " + order.id + "\n" +

    "👤 Name: " +
    (order.firstName || "N/A") + "\n" +

    "📱 Username: @" +
    (order.username || "N/A") + "\n\n" +

    "🔥 Plan: " +
    order.planName + "\n" +

    "💰 Amount: ₹" +
    order.amount + "\n" +

    "🔢 UTR: " +
    order.utr + "\n\n" +

    "⏳ STATUS: PENDING VERIFICATION";


  await bot.sendPhoto(
    ADMIN_CHAT_ID,
    photo.file_id,
    {
      caption: adminText,
      reply_markup: {
        inline_keyboard: [

          [
            {
              text: "✅ APPROVE",
              callback_data:
                "approve_" + order.id
            },

            {
              text: "❌ REJECT",
              callback_data:
                "reject_" + order.id
            }
          ]

        ]
      }
    }
  );

});


/*
ADMIN APPROVE / REJECT
*/

bot.on("callback_query", async (query) => {

  const adminId =
    String(query.from.id);

  if (adminId !== ADMIN_CHAT_ID) {

    await bot.answerCallbackQuery(
      query.id,
      {
        text: "Not authorized"
      }
    );

    return;

  }

  const action =
    query.data || "";

  const parts =
    action.split("_");

  const type =
    parts[0];

  const orderId =
    parts.slice(1).join("_");


  const order =
    data.orders.find(
      o => o.id === orderId
    );


  if (!order) {

    await bot.answerCallbackQuery(
      query.id,
      {
        text: "Order not found"
      }
    );

    return;

  }


  if (
    order.status !==
    "PENDING_ADMIN_VERIFICATION"
  ) {

    await bot.answerCallbackQuery(
      query.id,
      {
        text: "Order already processed"
      }
    );

    return;

  }


  /*
  REJECT
  */

  if (type === "reject") {

    order.status = "REJECTED";

    saveData(data);

    await bot.sendMessage(
      order.userId,
      "❌ PAYMENT REJECTED\n\n" +
      "Aapka payment proof verify nahi ho saka.\n\n" +
      "Agar payment genuine hai to support se contact karo:\n" +
      SUPPORT_BOT
    );

    await bot.answerCallbackQuery(
      query.id,
      {
        text: "Payment rejected"
      }
    );

    try {

      await bot.editMessageCaption(
        "❌ PAYMENT REJECTED\n\n" +
        "Order: " + order.id +
        "\nPlan: " + order.planName +
        "\nAmount: ₹" + order.amount +
        "\nUTR: " + order.utr,
        {
          chat_id: ADMIN_CHAT_ID,
          message_id:
            query.message.message_id
        }
      );

    } catch (e) {}

    return;

  }


  /*
  APPROVE
  */

  if (type === "approve") {

    const login =
      generateLogin();

    const password =
      generatePassword();

    const activationCode =
      generateActivationCode();


    order.status = "APPROVED";

    order.approvedAt =
      new Date().toISOString();

    order.credentials = {

      login: login,

      password: password,

      activationCode:
        activationCode

    };

    saveData(data);


    await bot.sendMessage(
      order.userId,

      "✅ PAYMENT APPROVED\n\n" +

      "🔥 " + order.planName + "\n" +

      "💰 Activation Payment: ₹" +
      order.amount + "\n\n" +

      "🆔 LOGIN ID\n" +
      login + "\n\n" +

      "🔐 PASSWORD\n" +
      password + "\n\n" +

      "🔑 ACTIVATION CODE\n" +
      activationCode + "\n\n" +

      "🌐 ACTIVATION WEBSITE\n" +
      ACTIVATION_WEBSITE + "\n\n" +

      "📌 Activation website par ye details enter karke process continue karo."
    );


    await bot.answerCallbackQuery(
      query.id,
      {
        text: "Payment approved"
      }
    );


    try {

      await bot.editMessageCaption(

        "✅ PAYMENT APPROVED\n\n" +

        "Order: " + order.id + "\n" +

        "Plan: " + order.planName + "\n" +

        "Amount: ₹" + order.amount + "\n" +

        "UTR: " + order.utr + "\n\n" +

        "🆔 Credentials generated\n" +

        "🔑 Activation code generated\n\n" +

        "👤 Buyer notified.",

        {
          chat_id: ADMIN_CHAT_ID,
          message_id:
            query.message.message_id
        }

      );

    } catch (e) {}

    return;

  }

});


/*
ADMIN COMMANDS
*/

bot.onText(/^\/admin$/i, async (msg) => {

  if (
    String(msg.from.id) !==
    ADMIN_CHAT_ID
  ) return;

  await bot.sendMessage(
    msg.chat.id,
    "👑 ADMIN PANEL\n\n" +
    "/orders - Recent orders\n" +
    "/credentials - Generated credentials\n" +
    "/stats - Statistics"
  );

});


bot.onText(/^\/orders$/i, async (msg) => {

  if (
    String(msg.from.id) !==
    ADMIN_CHAT_ID
  ) return;

  const recent =
    data.orders.slice(-10).reverse();

  if (!recent.length) {

    await bot.sendMessage(
      msg.chat.id,
      "No orders yet."
    );

    return;

  }

  let text =
    "📋 RECENT ORDERS\n\n";

  recent.forEach((o, i) => {

    text +=
      (i + 1) +
      ". " +
      o.id +
      "\n" +
      "🔥 " +
      o.planName +
      "\n" +
      "💰 ₹" +
      o.amount +
      "\n" +
      "🔢 " +
      o.utr +
      "\n" +
      "📌 " +
      o.status +
      "\n\n";

  });

  await bot.sendMessage(
    msg.chat.id,
    text
  );

});


bot.onText(/^\/credentials$/i, async (msg) => {

  if (
    String(msg.from.id) !==
    ADMIN_CHAT_ID
  ) return;

  const approved =
    data.orders
      .filter(o =>
        o.status === "APPROVED" &&
        o.credentials
      )
      .slice(-10)
      .reverse();

  if (!approved.length) {

    await bot.sendMessage(
      msg.chat.id,
      "No approved credentials yet."
    );

    return;

  }

  let text =
    "🔐 GENERATED CREDENTIALS\n\n";

  approved.forEach((o) => {

    text +=
      "🔥 " + o.planName + "\n" +
      "🆔 " + o.credentials.login + "\n" +
      "🔐 " + o.credentials.password + "\n" +
      "🔑 " + o.credentials.activationCode + "\n\n";

  });

  await bot.sendMessage(
    msg.chat.id,
    text
  );

});


bot.onText(/^\/stats$/i, async (msg) => {

  if (
    String(msg.from.id) !==
    ADMIN_CHAT_ID
  ) return;

  const total =
    data.orders.length;

  const approved =
    data.orders.filter(
      o => o.status === "APPROVED"
    ).length;

  const rejected =
    data.orders.filter(
      o => o.status === "REJECTED"
    ).length;

  const pending =
    data.orders.filter(
      o =>
        o.status ===
        "PENDING_ADMIN_VERIFICATION"
    ).length;

  await bot.sendMessage(
    msg.chat.id,

    "📊 ACTIVATION STATS\n\n" +

    "📦 Total Orders: " + total + "\n" +

    "✅ Approved: " + approved + "\n" +

    "❌ Rejected: " + rejected + "\n" +

    "⏳ Pending: " + pending
  );

});


bot.on("polling_error", (error) => {

  console.error(
    "Polling error:",
    error.message
  );

});


/*
RAILWAY WEB SERVER
*/

const PORT =
  process.env.PORT || 10000;

http
  .createServer((req, res) => {

    res.writeHead(200, {
      "Content-Type":
        "text/plain"
    });

    res.end(
      "IDActivationBot is running."
    );

  })
  .listen(PORT, () => {

    console.log(
      "IDActivationBot started successfully."
    );

  });
