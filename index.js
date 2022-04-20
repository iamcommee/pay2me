const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const {
    createMessageAdapter
} = require('@slack/interactive-messages');
const {
    WebClient
} = require('@slack/web-api');

const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const slackAccessToken = process.env.SLACK_ACCESS_TOKEN;

// Create the adapter using the app's signing secret
const slackInteractions = createMessageAdapter(slackSigningSecret);

// Create a Slack Web API client using the access token
const web = new WebClient(slackAccessToken);

// Initialize an Express application
const app = express();
const port = process.env.PORT ?? '80';

http.createServer(app).listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

async function slackSlashCommand(req, res, next) {

    if (req.body.command === '/create') {

        const triggerID = req.body.trigger_id;

        const result = await web.views.open({
            trigger_id: triggerID,
            view: {
                "title": {
                    "type": "plain_text",
                    "text": "pay2me"
                },
                "submit": {
                    "type": "plain_text",
                    "text": "Submit"
                },
                "blocks": [{
                        "block_id": "channel",
                        "type": "input",
                        "label": {
                            "type": "plain_text",
                            "text": "Select a channel to post the result on",
                        },
                        "element": {
                            "action_id": "channel_input",
                            "type": "conversations_select",
                            "default_to_current_conversation": true,
                            "response_url_enabled": true,
                        },
                    },
                    {
                        "block_id": "party",
                        "type": "input",
                        "element": {
                            "type": "plain_text_input",
                            "action_id": "party_input"
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "Party"
                        }
                    },
                    {
                        "block_id": "promptpay",
                        "type": "input",
                        "element": {
                            "type": "plain_text_input",
                            "placeholder": {
                                "type": "plain_text",
                                "text": "Write ID Card or Phone Number"
                            },
                            "action_id": "promptpay_input"
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "Promptpay"
                        }
                    },
                    {
                        "block_id": "order",
                        "type": "input",
                        "element": {
                            "type": "plain_text_input",
                            "multiline": true,
                            "action_id": "order_input",
                            "placeholder": {
                                "type": "plain_text",
                                "text": "Write order list with pattern order_amount"
                            },
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "Order",
                            "emoji": true
                        }
                    },
                    {
                        "type": "context",
                        "elements": [{
                            "type": "mrkdwn",
                            "text": "`order_amount` e.g. \n OrderA_30 \n OrderB_50"
                        }]
                    }
                ],
                "type": "modal",
                "callback_id": "create_qrcode"
            }
        });

        console.log(`Successfully opened root view ${result.view.id}`);

        res.send();

    } else if (req.body.command === '/share') {

        const triggerID = req.body.trigger_id;

        const result = await web.views.open({
            trigger_id: triggerID,
            view: {
                "title": {
                    "type": "plain_text",
                    "text": "pay2me"
                },
                "submit": {
                    "type": "plain_text",
                    "text": "Submit"
                },
                "blocks": [{
                        "block_id": "user",
                        "type": "input",
                        "element": {
                            "type": "multi_users_select",
                            "placeholder": {
                                "type": "plain_text",
                                "text": "Select users",
                                "emoji": true
                            },
                            "action_id": "user_input"
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "Select users to post the result on",
                            "emoji": true
                        }
                    },
                    {
                        "block_id": "party",
                        "type": "input",
                        "element": {
                            "type": "plain_text_input",
                            "action_id": "party_input"
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "Party"
                        }
                    },
                    {
                        "block_id": "promptpay",
                        "type": "input",
                        "element": {
                            "type": "plain_text_input",
                            "placeholder": {
                                "type": "plain_text",
                                "text": "Write ID Card or Phone Number"
                            },
                            "action_id": "promptpay_input"
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "Promptpay"
                        }
                    },
                    {
                        "block_id": "amount",
                        "type": "input",
                        "element": {
                            "type": "plain_text_input",
                            "placeholder": {
                                "type": "plain_text",
                                "text": "Write amount"
                            },
                            "action_id": "amount_input"
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "Amount"
                        }
                    },
                    {
                        "block_id": "message",
                        "type": "input",
                        "element": {
                            "type": "plain_text_input",
                            "multiline": true,
                            "action_id": "message_input"
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "Message",
                            "emoji": true
                        }
                    }
                ],
                "type": "modal",
                "callback_id": "create_sharing_qrcode"
            }
        });

        console.log(`Successfully opened root view ${result.view.id}`);

        res.send();

    } else {

        res.send('Please use / to see command list');

    }
}

async function slackActivity(req, res, next) {

    const payload = JSON.parse(req.body.payload);

    try {
        if (payload.type === 'view_submission') {

            if (payload.view.callback_id === 'create_qrcode') {

                const party = payload.view.state.values.party.party_input.value;
                const promptpay = payload.view.state.values.promptpay.promptpay_input.value;
                const orderList = payload.view.state.values.order.order_input.value.split("\n");
                const channelID = payload.response_urls[0].channel_id;
                const responseURL = payload.response_urls[0].response_url;

                let blocks = [];
                for (let i = 0; i < orderList.length; i++) {

                    const orderDetail = orderList[i].split("_")
                    const order = orderDetail[0];
                    const amount = orderDetail[1];
                    const message = `${order} ${amount} บาท`
                    const imageUrl = `https://pay2me-slack-bot.herokuapp.com/qrcode/${promptpay}/${amount}`;

                    blocks.push({
                        "type": "divider"
                    }, {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": `${message} \n <${imageUrl}|QR Code Image>`
                        },
                        "accessory": {
                            "type": "image",
                            "image_url": `${imageUrl}`,
                            "alt_text": "QR Code"
                        }
                    });
                }

                const axios = require('axios');

                await axios.post(`${responseURL}`, {
                    "response_type": "in_channel",
                    "text": `Party : ${party} | Promptpay : ${promptpay}`,
                    "attachments": [{
                        "blocks": blocks
                    }]
                });

                console.log(`Successfully create qr code ${payload.view.id}`);
            } else if (payload.view.callback_id === 'create_sharing_qrcode') {

                const userList = payload.view.state.values.user.user_input.selected_users;
                const party = payload.view.state.values.party.party_input.value;
                const promptpay = payload.view.state.values.promptpay.promptpay_input.value;
                const amount = payload.view.state.values.amount.amount_input.value;
                const sharedAmount = parseFloat(amount).toFixed(2);
                const message = payload.view.state.values.message.message_input.value;
                const imageUrl = `https://pay2me-slack-bot.herokuapp.com/qrcode/${promptpay}/${amount}`;

                for (let i = 0; i < userList.length; i++) {
                    let blocks = [{
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": `${message} \n <${imageUrl}|QR Code Image>`
                        },
                        "accessory": {
                            "type": "image",
                            "image_url": `${imageUrl}`,
                            "alt_text": "QR Code"
                        }
                    }];

                    await web.chat.postMessage({
                        "channel": userList[i],
                        "text": `Party : ${party} ${userList.length} คน | Promptpay : ${promptpay} | Total Amount : ${amount} บาท | Shared Amount : ${sharedAmount} บาท`,
                        "attachments": [{
                            "blocks": blocks
                        }]
                    });
                }

                console.log(`Successfully sharing create qr code ${payload.view.id}`);
            }
        }

        res.send();
    } catch (e) {
        console.error(e);
        res.status(500).send({
            message: 'ERROR'
        });
    }
}

async function generatePromptpayQRCode(promptpay, amount) {
    const promptpayQR = require('promptpay-qr');
    const qrcode = require('qrcode');

    const payload = promptpayQR(promptpay, {
        amount
    });

    const qrCodeImageBase64 = await new Promise((resolve, reject) => {
        qrcode.toDataURL(payload, (err, svg) => {
            if (err) return reject(err);
            resolve(svg);
        });
    });

    return qrCodeImageBase64;
}

app.use('/slack/actions', slackInteractions.expressMiddleware());
app.post('/slack/commands', bodyParser.urlencoded({
    extended: false
}), slackSlashCommand);
app.post('/slack/activities', bodyParser.urlencoded({
    extended: false
}), slackActivity);

app.get('/health', (req, res) => {
    return res.send({
        message: 'OK'
    });
});

app.get('/qrcode/:promptpay/:amonut', async (req, res) => {
    const qrCodeImageBase64 = await generatePromptpayQRCode(req.params.promptpay, parseFloat(req.params.amonut));
    const img = Buffer.from(qrCodeImageBase64.replace(/^data:image\/png;base64,/, ''), 'base64');

    res.writeHead(200, {
        "Content-Type": "image/png",
        "Content-Length": img.length
    });

    res.end(img);
});