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
    throw new Error('A Slack signing secret and access token are required to run this app')
}

http.createServer(app).listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

// Commands
async function slackSlashCommand(req, res, next) {

    console.log(req.body);

    if (req.body.command === '/qrcode') {

        const text = req.body.text.split(" ");
        const promptpay = text[0];
        const amount = text[1];
        const payer = text[2];
        const message = `จ่ายค่าอาหาร ${amount} บาท มาเดี๋ยวนี้คุณ ${payer}`;
        const imageUrl = `https://pay2me-slack-bot.herokuapp.com/qrcode/${promptpay}/${amount}`;

        let block = {
            "response_type": "ephemeral",
            "attachments": [
                {
                    "blocks": [
                        {
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
                        }
                    ]
                }
            ]
        };

        res.send(block);

    } else {

        res.send('Please use / to see command list');

    }
}

async function generatePromptpayQRCode(promptpay, amount) {
    const {convert} = require('convert-svg-to-png');
    const promptpayQR = require('promptpay-qr');
    const qrcode = require('qrcode');

    const payload = promptpayQR(promptpay, {
        amount
    });

    const options = {
        type: 'svg',
        width: 200,
        color: {
            dark: '#000',
            light: '#fff'
        }
    };

    const qrCodeSVG = await new Promise((resolve, reject) => {
        qrcode.toString(payload, options, (err, svg) => {
            if (err) return reject(err);
            resolve(svg);
        });
    });

    // Convert to PNG
    return await convert(qrCodeSVG);
}

app.use('/slack/actions', slackInteractions.expressMiddleware());
app.post('/slack/commands', bodyParser.urlencoded({
    extended: false
}), slackSlashCommand);

app.get('/health', (req, res) => {
    return res.send({
        message: 'OK'
    });
});

app.get('/qrcode/:promptpay/:amonut', async (req, res) => {
    const qrCode = await generatePromptpayQRCode(req.params.promptpay, parseFloat(req.params.amonut));
    res.set('Content-Type', 'image/png');
    res.status(200);
    res.send(qrCode);
});