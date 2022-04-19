const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const {
    createMessageAdapter
} = require('@slack/interactive-messages');
const {
    WebClient
} = require('@slack/web-api');

const slackSigningSecret = process.env.SLACK_SIGNING_SECRET ?? '';
const slackAccessToken = process.env.SLACK_ACCESS_TOKEN ?? '';

// Create the adapter using the app's signing secret
const slackInteractions = createMessageAdapter(slackSigningSecret);

// Create a Slack Web API client using the access token
const web = new WebClient(slackAccessToken);

// Initialize an Express application
const app = express();
const port = process.env.PORT ?? '80';

if (!slackSigningSecret || !slackAccessToken) {
    throw new Error('A Slack signing secret and access token are required to run this app');
}

http.createServer(app).listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

// Commands
async function slackSlashCommand(req, res, next) {

    if (req.body.command === '/qrcode') {

        const text = req.body.text.split(" ");
        const promptpay = text[0];
        const amount = text[1];
        const payer = text[2];
        const message = `${payer}`;
        const imageUrl = `https://pay2me-slack-bot.herokuapp.com/qrcode/${promptpay}/${amount}`;

        let block = {
            "response_type": "in_channel",
            "attachments": [{
                "blocks": [{
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `${message}`
                    },
                    "accessory": {
                        "type": "image",
                        "image_url": `${imageUrl}`,
                        "alt_text": "QR Code"
                    }
                }]
            }]
        };

        res.send(block);

    } else if (req.body.command === '/create') {

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
                        "block_id": "party",
                        "type": "input",
                        "element": {
                            "type": "plain_text_input"
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
                            }
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "Promptpay"
                        }
                    },
                    {
                        "type": "divider"
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": "Payer"
                        },
                        "accessory": {
                            "type": "users_select",
                            "placeholder": {
                                "type": "plain_text",
                                "text": "Select a user",
                                "emoji": true
                            },
                            "action_id": "users"
                        }
                    },
                    {
                        "type": "input",
                        "element": {
                            "type": "plain_text_input",
                            "placeholder": {
                                "type": "plain_text",
                                "text": "Write order amount"
                            },
                            "action_id": "amounts"
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "Amount",
                            "emoji": true
                        }
                    },
                    {
                        "type": "divider"
                    },
                    {
                        "type": "actions",
                        "elements": [{
                            "type": "button",
                            "action_id": "add_payer",
                            "text": {
                                "type": "plain_text",
                                "text": "Add another payer"
                            }
                        }]
                    }
                ],
                "type": "modal",
                "callback_id": "create-qrcode-modal"
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

    if (payload.type === 'block_actions') {

        if (payload.actions[0].action_id === 'add_payer') {
            const triggerID = payload.trigger_id

            const result = await web.views.push({
                "trigger_id": triggerID,
                "view": {
                    "type": 'modal',
                    "blocks": [{
                        "type": 'section',
                        "text": {
                            "type": 'plain_text',
                            "text": 'An updated modal, indeed'
                        }
                    }]
                }
            });

            console.log(`Successfully updated view ${viewID}`);

        }

    }

    res.send()
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
        'Content-Type': 'image/png',
        'Content-Length': img.length
    });

    res.end(img);
});